import assert from 'node:assert/strict';
import {readdirSync, readFileSync} from 'node:fs';
import {strFromU8, unzipSync} from 'fflate';
import {OPFCatalogsOptionError, resolveSlideContext} from '@openpresentation/opf';
import {defaultCatalog} from '@openpresentation/opf/catalog';
import {fromPptx, toPptx} from '../dist/index.js';

// FA-23 (format audit, OPF 0.15), catalogs half: the exporter and the importer resolve every reference through core with the
// catalogs the host registered (`catalogs: Catalog[]`, matched by `source`, never fetched), keep no catalog lookup of their
// own, report a reference that resolves nowhere as core's `unresolved-reference`, and fail on it under strict export.
// Design: core docs/programs/format-audit/0.15-design.md ("Resolution", "Acceptance criteria and tests").

// 1. The exporter never imports the opt-in gallery snapshot, nor any removed 0.14 catalog name (static scan of src/).
{
  const source = new URL('../src/', import.meta.url);
  const files = readdirSync(source).filter(name => /\.(?:js|d\.ts)$/.test(name));
  assert.ok(files.length > 40, 'src was scanned');
  for (const file of files) {
    const text = readFileSync(new URL(file, source), 'utf8');
    assert.doesNotMatch(text, /['"]@openpresentation\/opf\/catalogs?['"]/, `${file} imports no catalog snapshot`);
    assert.doesNotMatch(text, /\bcatalogs\s+as\s+bundledCatalogs\b|\bbundledCatalogs\b/, `${file} reads no bundled catalogs`);
    assert.doesNotMatch(text, /\bcatalogSources\b/, `${file} has no catalogSources`);
    assert.doesNotMatch(text, /(?<!ENGINE_)\bDEFAULT_FONT_SCHEME\b/, `${file} uses ENGINE_DEFAULT_FONT_SCHEME, not the removed id`);
    assert.doesNotMatch(text, /\bsocialPlatformRecords\b|\bmatchCatalogLanguage\b/, `${file} keeps no catalog lookup of its own`);
  }
}

const slideXml = bytes => strFromU8(unzipSync(new Uint8Array(bytes))['ppt/slides/slide1.xml']);
const collect = async (deck, options = {}) => {
  const diagnostics = [];
  const bytes = await toPptx(structuredClone(deck), {seed: 1, ...options, onDiagnostic: diagnostic => diagnostics.push(diagnostic)});
  return {bytes, xml: slideXml(bytes), unresolved: diagnostics.filter(diagnostic => diagnostic.code === 'unresolved-reference')};
};
const brief = ({kind, reference, path, group, source, fallback}) => ({kind, reference, path, group, ...(source !== undefined ? {source} : {}), fallback});

// 2. A layout that only a registered catalog holds resolves in export exactly like the same record embedded in the document.
const hero = {name: 'Hero', placeholders: [{type: 'title'}, {type: 'text'}, {type: 'text'}], composition: {mode: 'row', weights: [2, 1]}};
const ACME = 'pkg:@acme/opf-catalog';
const acmeCatalog = {source: ACME, layouts: {hero}};
const slides = [{layout: 'acme:hero', title: 'Two drivers', blocks: [{type: 'text', text: 'Enterprise seats up 31%'}, {type: 'text', text: 'Churn down to 2.1%'}]}];
const embeddedDeck = {name: 'Catalogs', catalogs: {acme: {source: ACME, layouts: {hero}}}, slides};
const hostDeck = {name: 'Catalogs', catalogs: {acme: {source: ACME}}, slides};
{
  const embedded = await collect(embeddedDeck);
  const hosted = await collect(hostDeck, {catalogs: [acmeCatalog]});
  assert.deepEqual(embedded.unresolved, []);
  assert.deepEqual(hosted.unresolved, [], 'the registered catalog resolves the reference');
  assert.equal(hosted.xml, embedded.xml, 'a host-only layout exports exactly like an embedded one');
  assert.deepEqual(resolveSlideContext(hostDeck, 0, {catalogs: [acmeCatalog]}).options.layout, resolveSlideContext(embeddedDeck, 0).options.layout, 'core sees the same record');
  // The record is not embedded by export: the slide tag carries none, and import resolves it only where the host registers it.
  const restored = [], missing = [];
  const withHost = await fromPptx(hosted.bytes, {catalogs: [acmeCatalog], onDiagnostic: diagnostic => restored.push(diagnostic.code)});
  assert.equal(withHost.slides[0].layout, 'acme:hero');
  assert.deepEqual(withHost.catalogs, {acme: {source: ACME}}, 'the group declaration returns; no record is embedded');
  assert.ok(!restored.includes('unresolved-reference'));
  const withoutHost = await fromPptx(hosted.bytes, {onDiagnostic: diagnostic => missing.push(diagnostic)});
  assert.equal(withoutHost.slides[0].layout, undefined);
  assert.deepEqual(missing.filter(diagnostic => diagnostic.code === 'unresolved-reference').map(diagnostic => diagnostic.path), ['slides.0.layout']);
  // The embedded record travels in the package and restores with no host catalog at all.
  const own = await fromPptx(embedded.bytes);
  assert.equal(own.slides[0].layout, 'acme:hero');
  assert.deepEqual(own.catalogs, embeddedDeck.catalogs);
}

// 3. A reference that resolves nowhere warns once (`unresolved-reference`, naming the reference and the catalog source) and
// composes automatically; strict export fails naming the same reference.
{
  const automatic = await collect({name: 'Catalogs', slides: [{title: slides[0].title, blocks: slides[0].blocks}]});
  for (const catalogs of [undefined, [], [defaultCatalog]]) {
    const result = await collect(hostDeck, catalogs === undefined ? {} : {catalogs});
    assert.deepEqual(result.unresolved.map(brief), [{kind: 'layouts', reference: 'acme:hero', path: 'slides.0.layout', group: 'acme', source: ACME, fallback: 'automatic'}]);
    assert.match(result.unresolved[0].message, /acme:hero/);
    assert.equal(result.xml.replace(/<p:custDataLst>[\s\S]*?<\/p:custDataLst>/, ''), automatic.xml.replace(/<p:custDataLst>[\s\S]*?<\/p:custDataLst>/, ''), 'the slide composes automatically');
  }
  const strict = error => {
    assert.equal(error.name, 'OPFPptxError');
    assert.equal(error.code, 'unresolved-reference');
    assert.equal(error.path, 'slides.0.layout');
    assert.deepEqual(error.diagnostics.map(brief), [{kind: 'layouts', reference: 'acme:hero', path: 'slides.0.layout', group: 'acme', source: ACME, fallback: 'automatic'}]);
    assert.match(error.message, /acme:hero/);
    return true;
  };
  await assert.rejects(toPptx(structuredClone(hostDeck), {strictReferences: true}), strict);
  // strictReferences defaults to strictAssets, and can be turned off on its own.
  await assert.rejects(toPptx(structuredClone(hostDeck), {strictAssets: true}), strict);
  assert.ok((await toPptx(structuredClone(hostDeck), {strictAssets: true, strictReferences: false})).length > 0);
  assert.ok((await toPptx(structuredClone(hostDeck), {strictAssets: true, catalogs: [acmeCatalog]})).length > 0, 'strict export passes once the reference resolves');
  // A theme or colour scheme that resolves nowhere draws with core's engine defaults and fails strict export the same way.
  const theme = await collect({name: 'Theme', design: {theme: 'acme:brand'}, catalogs: {acme: {source: ACME}}, slides: [{title: 'One'}]}, {catalogs: [acmeCatalog]});
  assert.deepEqual(theme.unresolved.map(brief), [{kind: 'themes', reference: 'acme:brand', path: 'design.theme', group: 'acme', source: ACME, fallback: 'engine-default'}]);
  await assert.rejects(toPptx({name: 'Theme', design: {theme: 'acme:brand'}, catalogs: {acme: {source: ACME}}, slides: [{title: 'One'}]}, {catalogs: [acmeCatalog], strictReferences: true}),
    error => error.code === 'unresolved-reference' && error.path === 'design.theme');
}

// 4. `"default": false` with a bare id: unresolved even though the host registers a default catalog; without it the bare id
// resolves in the host default (the first registered catalog).
{
  const bare = {name: 'Bare', slides: [{layout: 'two-column', title: 'Before and after', blocks: [{type: 'text', text: 'Manual'}, {type: 'text', text: 'One click'}]}]};
  const resolved = await collect(bare, {catalogs: [defaultCatalog]});
  assert.deepEqual(resolved.unresolved, [], 'a bare id resolves in the host default catalog');
  const closed = await collect({...bare, catalogs: {default: false}}, {catalogs: [defaultCatalog]});
  assert.deepEqual(closed.unresolved.map(brief), [{kind: 'layouts', reference: 'two-column', path: 'slides.0.layout', group: 'default', fallback: 'automatic'}]);
  await assert.rejects(toPptx({...structuredClone(bare), catalogs: {default: false}}, {catalogs: [defaultCatalog], strictReferences: true}), error => error.code === 'unresolved-reference');
  // The host default is the first registered catalog only: a bare id does not reach a second one.
  const second = await collect(bare, {catalogs: [acmeCatalog, defaultCatalog]});
  assert.deepEqual(second.unresolved.map(diagnostic => diagnostic.reference), ['two-column']);
}

// 5. A reference inside an embedded record resolves in that record's group first: acme's theme names `ocean`, which acme
// embeds, so acme's ocean wins over the custom group's.
{
  const ocean = {name: 'Ocean', dark1: '#000000', light1: '#FFFFFF', dark2: '#0B2545', light2: '#EEF4ED', accent1: '#13315C', accent2: '#134074', accent3: '#8DA9C4', accent4: '#5FA8D3', accent5: '#1B998B', accent6: '#2E294E', hyperlink: '#13315C', followedHyperlink: '#134074'};
  const deck = {name: 'Nested', design: {theme: 'acme:brand'}, catalogs: {
    default: false,
    acme: {source: ACME, themes: {brand: {name: 'Brand', colorScheme: 'ocean'}}, colorSchemes: {ocean}},
    custom: {colorSchemes: {ocean: {...ocean, name: 'Not this', accent1: '#FF0000'}}},
  }, slides: [{title: 'One'}]};
  const result = await collect(deck);
  assert.deepEqual(result.unresolved, []);
  const theme = strFromU8(unzipSync(new Uint8Array(result.bytes))['ppt/theme/theme1.xml']);
  assert.match(theme, /<a:accent1><a:srgbClr val="13315C"\/><\/a:accent1>/, "acme's scheme wins over the custom one");
  assert.match(theme, /<a:theme\b[^>]*\bname="Brand"/, 'the resolved theme names the theme part');
  // Document provenance keeps the referenced records (and the reference inside the theme) and every group declaration.
  const back = await fromPptx(result.bytes);
  assert.equal(back.design.theme, 'acme:brand');
  assert.deepEqual(back.catalogs, {default: false, acme: deck.catalogs.acme});
}

// 6. Import: theme and colour-scheme recovery match only registered catalogs (the first is the host default, whose records a
// bare id names); with none registered the colour scheme imports inline and no theme id is recovered. The dominant run
// language imports as a BCP-47 tag.
{
  const bytes = await toPptx({name: 'Recovery', language: 'ja', design: {theme: 'minimal'}, slides: [{title: 'こんにちは'}]}, {catalogs: [defaultCatalog], provenance: false});
  const registered = await fromPptx(bytes, {catalogs: [defaultCatalog]});
  assert.equal(registered.design.theme, 'minimal');
  assert.equal(registered.design.colorScheme, 'cool-horizon');
  const unregistered = await fromPptx(bytes);
  assert.equal(unregistered.design.theme, undefined);
  assert.equal(typeof unregistered.design.colorScheme, 'object');
  assert.equal(unregistered.design.colorScheme.accent1.toUpperCase(), '#2874A6');
  assert.equal(unregistered.language, 'ja-JP', 'the run tag, as a BCP-47 tag');
  // Another registered catalog is no host default: an exact match there still imports inline.
  const elsewhere = await fromPptx(bytes, {catalogs: [acmeCatalog, defaultCatalog]});
  assert.equal(elsewhere.design.theme, undefined);
  assert.equal(typeof elsewhere.design.colorScheme, 'object');
}

// 7. The removed 0.14 option shapes are refused, not reinterpreted: core's OPFCatalogsOptionError (code invalid-catalogs),
// for a value that is no array and for an entry that is no registered catalog.
const catalogsError = error => error instanceof OPFCatalogsOptionError && error.code === 'invalid-catalogs';
await assert.rejects(toPptx({name: 'Old', slides: [{title: 'One'}]}, {catalogs: {layouts: []}}), catalogsError);
await assert.rejects(fromPptx(await toPptx({name: 'Old', slides: [{title: 'One'}]}), {catalogs: {layouts: {records: []}}}), catalogsError);
await assert.rejects(toPptx({name: 'Old', slides: [{title: 'One', layout: 'two-column'}]}, {catalogs: [{layouts: [{id: 'two-column'}]}]}), catalogsError);

// 8. A reference with an undeclared catalog prefix (foo:hero with no catalogs.foo) is a format error (opf/undeclared-catalog):
// export refuses the document at the boundary, before any composition, whatever the strict policy.
for (const strictReferences of [false, true]) {
  await assert.rejects(toPptx({name: 'Undeclared', slides: [{title: 'One', layout: 'foo:hero'}]}, {catalogs: [defaultCatalog], strictReferences}),
    error => error.code === 'invalid-opf' && error.findings.some(finding => finding.ruleId === 'opf/undeclared-catalog' && finding.path === '/slides/0/layout'));
}

console.log('FA-23 catalogs passed: no exporter-side catalog lookup, host-only layouts export like embedded ones, unresolved references warn and fail strict export, default:false, in-group nested references, import recovery against registered catalogs, BCP-47 language import, OPFCatalogsOptionError and undeclared catalogs refused.');
