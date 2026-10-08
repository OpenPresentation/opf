// FA-20 (OPF 0.15): catalog groups, references, the one resolution rule, embed, copySlides, updateFromCatalog and the
// unresolved-reference diagnostic. One test per row of the design's tests table that concerns references, embedding,
// copying, updates and missing references (docs/programs/format-audit/0.15-design.md).
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  OPFUnresolvedReferenceError,
  applyPatch,
  catalogRecords,
  copySlides,
  embed,
  paginate,
  parseReference,
  resolveReference,
  resolveSlideContext,
  updateFromCatalog,
  validate,
} from '../dist/index.js';

const GALLERY = 'https://gallery.example';
const ACME = 'pkg:@acme/opf-catalog';
const layout = (name, ...types) => ({ name, placeholders: types.map((type) => ({ type })) });
const scheme = (accent1) => ({ name: `Scheme ${accent1}`, accent1, accent2: '#222222', accent3: '#333333', accent4: '#444444', accent5: '#555555', accent6: '#666666', dark1: '#000000', dark2: '#111111', light1: '#FFFFFF', light2: '#EEEEEE', hyperlink: '#0000EE', followedHyperlink: '#551A8B' });
const fonts = (major) => ({ name: major, major, minor: major });

/** A small stand-in for the gallery: the host default in these tests. */
const gallery = {
  source: GALLERY,
  layouts: {
    'two-column': { ...layout('Two column', 'title', 'text', 'text'), composition: { mode: 'row', weights: [1, 1] }, design: { contentBox: true }, 'x-gallery': { category: 'Text' } },
    'chart-left': layout('Chart left', 'title', 'chart', 'text'),
    'title-only': layout('Title', 'title'),
  },
  themes: { minimal: { name: 'Minimal', colorScheme: 'cool', fontScheme: 'sans', 'x-gallery': { order: 1 } } },
  colorSchemes: { cool: scheme('#2874A6'), ocean: scheme('#0B7285') },
  fontSchemes: { sans: fonts('Aptos'), inter: fonts('Arial') },
  narratives: { 'classic-story': { name: 'Classic story', beats: [{ id: 'hook', name: 'Hook' }] } },
  tones: { formal: { name: 'Formal' } },
};
/** A company catalog, registered by the host only in some tests. */
const acme = {
  source: ACME,
  layouts: { hero: layout('Hero', 'title', 'subtitle') },
  themes: { brand: { name: 'Brand', colorScheme: 'ocean', fontScheme: 'inter' } },
  colorSchemes: { ocean: scheme('#FF6F61') },
  fontSchemes: { inter: fonts('Inter') },
};
const deck = (extra = {}) => ({ slides: [{ title: 'One' }], ...extra });
const references = (report) => report.findings.filter((finding) => finding.ruleId === 'opf/unresolved-reference' || finding.ruleId === 'opf/undeclared-catalog');

describe('references', () => {
  test('parseReference reads a bare id and name:id, and nothing else', () => {
    assert.deepEqual(parseReference('two-column'), { id: 'two-column' });
    assert.deepEqual(parseReference('acme:hero'), { group: 'acme', id: 'hero' });
    for (const value of ['https://acme.com/hero.json', 'pkg:@acme/x', 'Acme:Hero', 'a:b:c', '', 3]) assert.equal(parseReference(value), undefined, String(value));
  });

  test('acme:hero resolves from the document, then from the host, otherwise one opf/unresolved-reference naming it and its source', () => {
    const embedded = deck({ catalogs: { acme: { source: ACME, layouts: { hero: layout('Hero', 'title') } } }, slides: [{ layout: 'acme:hero', title: 'Hi' }] });
    assert.equal(resolveReference(embedded, 'layouts', 'acme:hero', { catalogs: [] })?.origin, 'document');
    assert.deepEqual(references(validate(embedded, { catalogs: [] })), []);

    const declaredOnly = deck({ catalogs: { acme: { source: ACME } }, slides: [{ layout: 'acme:hero', title: 'Hi' }] });
    const hosted = resolveReference(declaredOnly, 'layouts', 'acme:hero', { catalogs: [gallery, acme] });
    assert.equal(hosted?.origin, 'host');
    assert.equal(hosted?.source, ACME);
    assert.deepEqual(references(validate(declaredOnly, { catalogs: [gallery, acme] })), []);

    const neither = references(validate(declaredOnly, { catalogs: [gallery] }));
    assert.equal(neither.length, 1);
    assert.equal(neither[0].ruleId, 'opf/unresolved-reference');
    assert.equal(neither[0].severity, 'warning');
    assert.equal(neither[0].path, '/slides/0/layout');
    assert.match(neither[0].message, /'acme:hero'/);
    assert.ok(neither[0].message.includes(ACME), neither[0].message);
  });

  test('a reference with an undeclared prefix is a validation error at the reference', () => {
    const report = validate(deck({ slides: [{ layout: 'foo:hero', title: 'x' }] }), { catalogs: [gallery] });
    assert.equal(report.valid, false);
    assert.deepEqual(references(report).map(({ ruleId, path, severity }) => ({ ruleId, path, severity })), [{ ruleId: 'opf/undeclared-catalog', path: '/slides/0/layout', severity: 'error' }]);
  });

  test('"default": false and a bare id that is not in custom stay unresolved, even when the host registers a default catalog', () => {
    const document = deck({ catalogs: { default: false }, slides: [{ layout: 'two-column', title: 'x' }] });
    assert.equal(resolveReference(document, 'layouts', 'two-column', { catalogs: [gallery] }), undefined);
    const context = resolveSlideContext(document, 0, { catalogs: [gallery] });
    assert.equal(context.options.layout, undefined);
    assert.deepEqual(context.diagnostics.map((entry) => [entry.code, entry.reference, entry.fallback]), [['unresolved-reference', 'two-column', 'automatic']]);
    const custom = deck({ catalogs: { default: false, custom: { layouts: { 'two-column': layout('Mine', 'title') } } }, slides: [{ layout: 'two-column', title: 'x' }] });
    assert.equal(resolveReference(custom, 'layouts', 'two-column', { catalogs: [gallery] })?.group, 'custom');
  });

  test("acme's theme names a colour scheme that acme also embeds: acme's scheme wins over the default catalog's", () => {
    const document = deck({
      design: { theme: 'acme:brand' },
      catalogs: {
        default: { source: GALLERY, colorSchemes: { ocean: scheme('#000001') } },
        acme: { source: ACME, themes: { brand: { name: 'Brand', colorScheme: 'ocean', fontScheme: 'inter' } }, colorSchemes: { ocean: scheme('#FF6F61') }, fontSchemes: { inter: fonts('Inter') } },
      },
    });
    const context = resolveSlideContext(document, 0, { catalogs: [gallery] });
    assert.equal(context.resolved.colorScheme.accent1, '#FF6F61');
    assert.equal(context.options.fontFamilies.heading, 'Inter');
    assert.deepEqual(context.diagnostics, []);
  });

  test('a bare id resolves in custom, then in the records embedded under default, then in the host catalog for default.source', () => {
    const base = { slides: [{ layout: 'two-column', title: 'x' }] };
    assert.equal(resolveReference({ ...base, catalogs: { custom: { layouts: { 'two-column': layout('Mine', 'title') } }, default: { source: GALLERY, layouts: { 'two-column': layout('Embedded', 'title') } } } }, 'layouts', 'two-column', { catalogs: [gallery] }).record.name, 'Mine');
    assert.equal(resolveReference({ ...base, catalogs: { default: { source: GALLERY, layouts: { 'two-column': layout('Embedded', 'title') } } } }, 'layouts', 'two-column', { catalogs: [gallery] }).record.name, 'Embedded');
    assert.equal(resolveReference(base, 'layouts', 'two-column', { catalogs: [gallery] }).record.name, 'Two column');
    // default.source names the registered catalog; the first registered one is only the default when default is omitted.
    assert.equal(resolveReference({ ...base, catalogs: { default: { source: ACME } } }, 'layouts', 'hero', { catalogs: [gallery, acme] })?.source, ACME);
    assert.equal(resolveReference(base, 'layouts', 'hero', { catalogs: [gallery, acme] }), undefined);
  });

  test('catalogRecords lists embedded records first, then registered ones, with the reference to write', () => {
    const document = deck({ catalogs: { custom: { layouts: { mine: layout('Mine', 'title') } }, acme: { source: ACME } } });
    const listed = catalogRecords(document, 'layouts', { catalogs: [gallery, acme] }).map((entry) => [entry.reference, entry.origin]);
    assert.deepEqual(listed, [['mine', 'document'], ['two-column', 'host'], ['chart-left', 'host'], ['title-only', 'host'], ['acme:hero', 'host']]);
  });

  test('chart.type, socials keys and the language tag are engine vocabularies, validated directly', () => {
    const report = (extra) => validate(deck(extra), { only: ['format'], catalogs: [] });
    assert.equal(report({ slides: [{ title: 'x', chart: { type: 'column', data: { columns: ['A', 'B'], rows: [['a', 1]] } } }] }).valid, true);
    assert.equal(report({ slides: [{ title: 'x', chart: { type: 'no-such-chart', data: { columns: ['A', 'B'], rows: [['a', 1]] } } }] }).valid, false);
    assert.equal(report({ organization: { id: 'acme', name: 'Acme', socials: { x: '@acme' } } }).valid, true);
    assert.equal(report({ organization: { id: 'acme', name: 'Acme', socials: { myspace: 'acme' } } }).valid, false);
    assert.equal(report({ language: 'en-GB' }).valid, true);
    assert.equal(report({ language: 'english-gb' }).valid, false, 'a languages catalog id is not a tag');
    assert.equal(report({ language: { bcp47: 'ar-SA', direction: 'rtl' } }).valid, true);
    assert.equal(report({ language: { id: 'arabic' } }).valid, false);
  });

  test('URL and pkg: references are not references', () => {
    for (const layoutRef of ['https://acme.com/layouts/cover.json', 'pkg:@acme/decks/layouts/cover'])
      assert.equal(validate(deck({ slides: [{ layout: layoutRef, title: 'x' }] }), { only: ['format'] }).valid, false, layoutRef);
    assert.equal(validate(deck({ design: { theme: { id: 'minimal' } } }), { only: ['format'] }).valid, false, 'design.theme is a reference string');
  });

  test('catalog groups: names, reserved groups and the source rules', () => {
    const format = (catalogs) => validate(deck({ catalogs }), { only: ['format'], catalogs: [] }).valid;
    assert.equal(format({ default: { source: GALLERY, layouts: { a: layout('A', 'title') } } }), true);
    assert.equal(format({ default: { layouts: { a: layout('A', 'title') } } }), false, 'default with records needs a source');
    assert.equal(format({ default: false }), true);
    assert.equal(format({ custom: { source: GALLERY } }), false, 'custom has no source');
    assert.equal(format({ acme: { layouts: {} } }), false, 'a named group has a source');
    assert.equal(format({ Acme: { source: ACME } }), false, 'group names are kebab-case');
    assert.equal(format({ custom: { layouts: { a: { $schema: 'https://openpresentation.org/schema/opf-layout/v1', name: 'A' } } } }), false, 'no $schema in an embedded record');
    assert.equal(format({ custom: { layouts: { a: { id: 'a', name: 'A' } } } }), false, 'no id in an embedded record');
    assert.equal(format({ custom: { languages: {} } }), false, 'languages are not a catalog kind');
    const invalid = validate(deck({ catalogs: { custom: { layouts: { a: { placeholders: 'title' } } } } }), { catalogs: [] });
    assert.ok(invalid.findings.some((finding) => finding.ruleId === 'opf/catalog-record' && finding.path.startsWith('/catalogs/custom/layouts/a')), JSON.stringify(invalid.findings));
  });
});

describe('missing references', () => {
  test('a slide with no layout: no finding, automatic composition', () => {
    const report = validate(deck(), { catalogs: [gallery] });
    assert.deepEqual(references(report), []);
    const context = resolveSlideContext(deck(), 0, { catalogs: [gallery] });
    assert.equal(context.options.layout, undefined);
    assert.deepEqual(context.diagnostics, []);
  });

  test('a slide naming an id that resolves nowhere: one warning naming the id, automatic composition, strict export fails with the same id', () => {
    const document = deck({ slides: [{ layout: 'no-such-layout', title: 'x', text: 'y' }] });
    const found = references(validate(document, { catalogs: [gallery] }));
    assert.deepEqual(found.map(({ ruleId, path }) => [ruleId, path]), [['opf/unresolved-reference', '/slides/0/layout']]);
    assert.match(found[0].message, /'no-such-layout'/);
    const context = resolveSlideContext(document, 0, { catalogs: [gallery] });
    assert.equal(context.options.layout, undefined);
    assert.deepEqual(context.diagnostics.map(({ code, path, reference, source }) => ({ code, path, reference, source })), [{ code: 'unresolved-reference', path: 'slides.0.layout', reference: 'no-such-layout', source: GALLERY }]);
    assert.throws(() => resolveSlideContext(document, 0, { catalogs: [gallery], strictReferences: true }), (error) => error instanceof OPFUnresolvedReferenceError && error.diagnostics[0].reference === 'no-such-layout');
    assert.throws(() => paginate(document, { catalogs: [gallery], strictReferences: true }), (error) => error instanceof OPFUnresolvedReferenceError && /no-such-layout/.test(error.message));
  });

  test('an id present only in a registered host catalog resolves the same in the slide context, pagination and validate', () => {
    const document = deck({ slides: [{ layout: 'chart-left', title: 'x', text: 'y' }] });
    const context = resolveSlideContext(document, 0, { catalogs: [gallery] });
    assert.equal(context.options.layout.name, 'Chart left');
    const seen = [];
    const result = paginate(document, { catalogs: [gallery], onDiagnostic: (diagnostic) => seen.push(diagnostic) });
    assert.deepEqual(seen, []);
    assert.equal(result.presentation.slides[0].layout, 'chart-left');
    assert.deepEqual(references(validate(document, { catalogs: [gallery] })), []);
    // Without the host catalog the same document reports the reference, in pagination too.
    paginate(document, { catalogs: [], onDiagnostic: (diagnostic) => seen.push(diagnostic) });
    assert.deepEqual(seen.map((entry) => entry.reference), ['chart-left']);
  });

  test('an unresolved theme falls back to the engine default and says so', () => {
    const context = resolveSlideContext(deck({ design: { theme: 'nope' } }), 0, { catalogs: [gallery] });
    assert.deepEqual(context.diagnostics.map(({ kind, reference, fallback, path }) => ({ kind, reference, fallback, path })), [{ kind: 'themes', reference: 'nope', fallback: 'engine-default', path: 'design.theme' }]);
    assert.equal(context.resolved.colorScheme.accent1, '#2874A6', 'the engine default colour scheme');
    assert.equal(context.options.fontFamilies.heading, 'Aptos Display', 'the engine default font scheme');
  });
});

describe('embed', () => {
  const document = deck({
    design: { theme: 'minimal' },
    slides: [
      { layout: 'two-column', title: 'a' },
      { layout: 'chart-left', title: 'b' },
      { layout: 'two-column', title: 'c' },
      { layout: 'title-only', title: 'd' },
    ],
  });

  test('3 layout ids, one used twice, and a theme: each embedded once under its group with the theme schemes; no x-*, $schema or id', () => {
    const { document: out, added, unresolved } = embed(document, { catalogs: [gallery] });
    assert.deepEqual(unresolved, []);
    assert.deepEqual(Object.keys(out.catalogs), ['default']);
    assert.equal(out.catalogs.default.source, GALLERY);
    assert.deepEqual(Object.keys(out.catalogs.default.layouts).sort(), ['chart-left', 'title-only', 'two-column']);
    assert.deepEqual(Object.keys(out.catalogs.default.themes), ['minimal']);
    assert.deepEqual(Object.keys(out.catalogs.default.colorSchemes), ['cool']);
    assert.deepEqual(Object.keys(out.catalogs.default.fontSchemes), ['sans']);
    assert.equal(added.length, 6);
    const text = JSON.stringify(out.catalogs);
    assert.equal(/"x-|"\$schema"|"id":/.test(text), false, text);
    assert.deepEqual(document.catalogs, undefined, 'the input is not mutated');
  });

  test('the embedded document renders the same with no catalog registered, and embedding twice is a no-op', () => {
    const { document: out } = embed(document, { catalogs: [gallery] });
    for (let index = 0; index < out.slides.length; index++) {
      const hosted = resolveSlideContext(document, index, { catalogs: [gallery] });
      const alone = resolveSlideContext(out, index, { catalogs: [] });
      assert.deepEqual(alone.diagnostics, []);
      assert.deepEqual(alone.options.layout, hosted.options.layout && Object.fromEntries(Object.entries(hosted.options.layout).filter(([key]) => !key.startsWith('x-'))));
      assert.deepEqual(alone.options.fontFamilies, hosted.options.fontFamilies);
      assert.deepEqual(alone.resolved.colorScheme, hosted.resolved.colorScheme);
    }
    assert.deepEqual(references(validate(out, { catalogs: [] })), []);
    const again = embed(out, { catalogs: [gallery] });
    assert.deepEqual(again.added, []);
    assert.deepEqual(again.document, out);
  });

  test('records keep their group: a named catalog stays named, and an embedded record is kept as it is', () => {
    const named = deck({ design: { theme: 'acme:brand' }, catalogs: { acme: { source: ACME } }, slides: [{ layout: 'acme:hero', title: 'x' }] });
    const { document: out } = embed(named, { catalogs: [gallery, acme] });
    assert.deepEqual(Object.keys(out.catalogs.acme).sort(), ['colorSchemes', 'fontSchemes', 'layouts', 'source', 'themes']);
    assert.equal(out.catalogs.default, undefined);
    const kept = embed(deck({ catalogs: { default: { source: GALLERY, layouts: { 'two-column': layout('Older', 'title') } } }, slides: [{ layout: 'two-column' }] }), { catalogs: [gallery] });
    assert.equal(kept.document.catalogs.default.layouts['two-column'].name, 'Older');
  });

  test('layout defaults stay defaults: embedding never writes layout design keys into slide.design', () => {
    const { document: out } = embed(deck({ design: { contentBox: false }, slides: [{ layout: 'two-column', title: 'x' }] }), { catalogs: [gallery] });
    assert.equal(out.slides[0].design, undefined);
    assert.deepEqual(out.design, { contentBox: false });
  });

  test('a reference that resolves nowhere is reported and left as written', () => {
    const { document: out, unresolved } = embed(deck({ slides: [{ layout: 'nope', title: 'x' }] }), { catalogs: [gallery] });
    assert.equal(out.slides[0].layout, 'nope');
    assert.deepEqual(unresolved.map((entry) => entry.reference), ['nope']);
  });
});

describe('copySlides', () => {
  test('a record that already exists in the target with the same content is reused, with no rename', () => {
    const from = deck({ catalogs: { custom: { layouts: { mine: layout('Mine', 'title') } } }, slides: [{ layout: 'mine', title: 'from' }] });
    const to = deck({ catalogs: { custom: { layouts: { mine: layout('Mine', 'title') } } }, slides: [{ layout: 'mine', title: 'to' }] });
    const result = copySlides(from, to, [0], { catalogs: [] });
    assert.deepEqual(result.renamed, []);
    assert.deepEqual(result.added, []);
    assert.deepEqual(Object.keys(result.document.catalogs.custom.layouts), ['mine']);
    assert.equal(result.document.slides[1].layout, 'mine');
    assert.deepEqual(result.slides, [1]);
  });

  test('a custom id the target uses for different content is renamed <id>-2; the target slides are unchanged', () => {
    const from = deck({ catalogs: { custom: { layouts: { mine: layout('Theirs', 'title', 'text') } } }, slides: [{ layout: 'mine', title: 'from' }] });
    const to = deck({ catalogs: { custom: { layouts: { mine: layout('Mine', 'title') } } }, slides: [{ layout: 'mine', title: 'to' }] });
    const result = copySlides(from, to, [0], { catalogs: [] });
    assert.deepEqual(result.renamed, [{ kind: 'layouts', from: 'mine', to: 'mine-2', reason: 'custom-conflict' }]);
    assert.equal(result.document.slides[0].layout, 'mine');
    assert.equal(result.document.slides[1].layout, 'mine-2');
    assert.equal(result.document.catalogs.custom.layouts['mine-2'].name, 'Theirs');
    assert.equal(result.document.catalogs.custom.layouts.mine.name, 'Mine');
    assert.equal(to.catalogs.custom.layouts['mine-2'], undefined, 'the target is not mutated');
  });

  test('source and target name the same catalog source differently: copied references use the target name', () => {
    const from = deck({ design: {}, catalogs: { acme: { source: ACME, layouts: { hero: layout('Hero', 'title', 'subtitle') } } }, slides: [{ layout: 'acme:hero', title: 'from', design: { theme: 'acme:brand' } }] });
    const to = deck({ catalogs: { brand: { source: ACME } } });
    const result = copySlides(from, to, [0], { catalogs: [gallery, acme] });
    assert.equal(result.document.slides[1].layout, 'brand:hero');
    assert.equal(result.document.slides[1].design.theme, 'brand:brand');
    assert.deepEqual(Object.keys(result.document.catalogs.brand).sort(), ['colorSchemes', 'fontSchemes', 'layouts', 'source', 'themes']);
    assert.deepEqual(result.addedGroups, []);
    assert.deepEqual(references(validate(result.document, { catalogs: [] })), []);
    // A group the target does not have is added, renamed when its name is taken.
    const taken = copySlides(from, deck({ catalogs: { acme: { source: 'pkg:@other/catalog' } } }), [0], { catalogs: [gallery, acme] });
    assert.deepEqual(taken.addedGroups, [{ name: 'acme-2', source: ACME }]);
    assert.equal(taken.document.slides[1].layout, 'acme-2:hero');
  });

  test('the target holds a different revision of the same catalog record: the incoming one moves to custom as <id>-2 and is listed', () => {
    const from = deck({ catalogs: { default: { source: GALLERY, layouts: { 'two-column': layout('Two column, 2025 revision', 'title', 'text') } } }, slides: [{ layout: 'two-column', title: 'from' }] });
    const to = deck({ catalogs: { default: { source: GALLERY, layouts: { 'two-column': layout('Two column', 'title', 'text', 'text') } } }, slides: [{ layout: 'two-column', title: 'to' }] });
    const result = copySlides(from, to, [0], { catalogs: [gallery] });
    assert.deepEqual(result.renamed, [{ kind: 'layouts', from: 'two-column', to: 'two-column-2', reason: 'catalog-revision' }]);
    assert.equal(result.document.slides[1].layout, 'two-column-2');
    assert.equal(result.document.catalogs.custom.layouts['two-column-2'].name, 'Two column, 2025 revision');
    assert.equal(result.document.slides[0].layout, 'two-column');
    // The copied slide looks unchanged: it composes with the record it had in the source.
    assert.deepEqual(resolveSlideContext(result.document, 1, { catalogs: [] }).options.layout, resolveSlideContext(from, 0, { catalogs: [] }).options.layout);
  });

  test('copying the same slide twice reuses the first copy\'s record', () => {
    const from = deck({ catalogs: { custom: { layouts: { mine: layout('Theirs', 'title', 'text') } } }, slides: [{ layout: 'mine', title: 'from' }] });
    const to = deck({ catalogs: { custom: { layouts: { mine: layout('Mine', 'title') } } } });
    const once = copySlides(from, to, [0], { catalogs: [] });
    const twice = copySlides(from, once.document, [0], { catalogs: [] });
    assert.deepEqual(Object.keys(twice.document.catalogs.custom.layouts).sort(), ['mine', 'mine-2']);
    assert.equal(twice.document.slides[2].layout, 'mine-2');
    assert.deepEqual(twice.added, []);
  });

  test('a host-only record is carried into the target, and an acme theme keeps its own schemes', () => {
    const from = deck({ catalogs: { acme: { source: ACME } }, slides: [{ layout: 'chart-left', title: 'x', design: { theme: 'acme:brand' } }] });
    const result = copySlides(from, deck({ catalogs: { default: false } }), [0], { catalogs: [gallery, acme] });
    const group = result.addedGroups.find((entry) => entry.source === GALLERY);
    assert.ok(group, JSON.stringify(result.addedGroups));
    assert.equal(result.document.slides[1].layout, `${group.name}:chart-left`);
    assert.equal(result.document.catalogs.acme.themes.brand.colorScheme, 'ocean');
    const alone = resolveSlideContext(result.document, 1, { catalogs: [] });
    assert.deepEqual(alone.diagnostics, []);
    assert.equal(alone.resolved.colorScheme.accent1, '#FF6F61');
  });
});

describe('updateFromCatalog', () => {
  const published = { ...gallery, layouts: { ...gallery.layouts, 'two-column': { ...gallery.layouts['two-column'], composition: { mode: 'row', weights: [2, 1] } } } };
  const saved = embed(deck({ slides: [{ layout: 'two-column', title: 'x' }, { layout: 'chart-left', title: 'y' }] }), { catalogs: [gallery] }).document;

  test('the catalog publishes a new revision: the embedded record is unchanged on reopening, and an update check lists the difference', () => {
    const context = resolveSlideContext(saved, 0, { catalogs: [published] });
    assert.deepEqual(context.options.layout.composition, { mode: 'row', weights: [1, 1] }, 'engines never replace an embedded record');
    const update = updateFromCatalog(saved, [published]);
    assert.deepEqual(update.changes.map(({ kind, reference, group, source }) => ({ kind, reference, group, source })), [{ kind: 'layouts', reference: 'two-column', group: 'default', source: GALLERY }]);
    assert.deepEqual(update.changes[0].current.composition, { mode: 'row', weights: [2, 1] });
    assert.deepEqual(saved.catalogs.default.layouts['two-column'].composition, { mode: 'row', weights: [1, 1] }, 'nothing is applied');
  });

  test('the author runs update from catalog for one reference: only that record changes, after approval', () => {
    const twice = { ...published, layouts: { ...published.layouts, 'chart-left': { ...gallery.layouts['chart-left'], name: 'Chart left, renamed' } } };
    assert.equal(updateFromCatalog(saved, [twice]).changes.length, 2);
    const update = updateFromCatalog(saved, [twice], [{ kind: 'layouts', reference: 'two-column' }]);
    assert.deepEqual(update.changes.map((change) => change.id), ['two-column']);
    const presentation = applyPatch(saved, update.patch);
    assert.deepEqual(presentation.catalogs.default.layouts['two-column'].composition, { mode: 'row', weights: [2, 1] });
    assert.equal(presentation.catalogs.default.layouts['chart-left'].name, 'Chart left');
    assert.equal(/"x-/.test(JSON.stringify(presentation.catalogs)), false, 'the update embeds without display metadata');
  });

  test('custom records are the document\'s own and are never compared', () => {
    const own = deck({ catalogs: { custom: { layouts: { 'two-column': layout('Mine', 'title') } } } });
    assert.deepEqual(updateFromCatalog(own, [published]).changes, []);
  });
});

describe('inheritance when catalogs or catalogs.default is missing', () => {
  const OTHER = 'https://other.example';
  const other = { source: OTHER, layouts: { 'two-column': layout('Other two column', 'title') } };

  test('with no catalogs option nothing is registered: bare ids resolve only from embedded records', () => {
    const document = deck({ slides: [{ layout: 'two-column', title: 'x' }] });
    assert.equal(resolveReference(document, 'layouts', 'two-column'), undefined);
    assert.deepEqual(resolveSlideContext(document, 0).diagnostics.map((entry) => entry.reference), ['two-column']);
  });

  test('a declaration-only group is valid and resolves from the host catalog for its source', () => {
    const document = deck({ catalogs: { acme: { source: ACME } }, slides: [{ layout: 'acme:hero', title: 'x' }] });
    assert.equal(validate(document, { only: ['format'] }).valid, true);
    assert.equal(resolveReference(document, 'layouts', 'acme:hero', { catalogs: [gallery, acme] })?.origin, 'host');
  });

  test('catalogs.default with a source the host has not registered leaves bare ids unresolved, even with another catalog registered first', () => {
    const document = deck({ catalogs: { default: { source: 'https://unregistered.example' } }, slides: [{ layout: 'two-column', title: 'x' }] });
    assert.equal(resolveReference(document, 'layouts', 'two-column', { catalogs: [gallery, acme] }), undefined);
    const [diagnostic] = resolveSlideContext(document, 0, { catalogs: [gallery, acme] }).diagnostics;
    assert.equal(diagnostic.source, 'https://unregistered.example');
  });

  test('embed on a document with no catalogs creates default with the host default source', () => {
    const { document } = embed(deck({ slides: [{ layout: 'two-column', title: 'x' }] }), { catalogs: [gallery, acme] });
    assert.equal(document.catalogs.default.source, GALLERY);
    assert.ok(document.catalogs.default.layouts['two-column']);
  });

  test('copySlides, same source: an inherited default stays the default and references stay bare', () => {
    const from = deck({ slides: [{ layout: 'two-column', title: 'from' }] });
    const result = copySlides(from, deck(), [0], { catalogs: [gallery] });
    assert.equal(result.document.slides[1].layout, 'two-column');
    assert.deepEqual(result.addedGroups, []);
    assert.equal(result.document.catalogs.default.source, GALLERY);
    assert.ok(result.document.catalogs.default.layouts['two-column']);
  });

  test('copySlides, different source: the inherited catalog becomes a named group and references are prefixed', () => {
    const from = deck({ slides: [{ layout: 'two-column', title: 'from' }] });
    const to = deck({ catalogs: { default: { source: OTHER } }, slides: [{ layout: 'two-column', title: 'to' }] });
    const result = copySlides(from, to, [0], { catalogs: [gallery, other] });
    assert.equal(result.addedGroups.length, 1);
    const [{ name, source }] = result.addedGroups;
    assert.equal(source, GALLERY);
    assert.equal(result.document.slides[1].layout, `${name}:two-column`);
    assert.equal(result.document.slides[0].layout, 'two-column', 'the target slides keep their catalog');
    assert.equal(resolveSlideContext(result.document, 1, { catalogs: [] }).options.layout.name, 'Two column');
    assert.equal(resolveSlideContext(result.document, 0, { catalogs: [gallery, other] }).options.layout.name, 'Other two column');
  });

  test('copySlides, target default false: the inherited catalog becomes a named group and references are prefixed', () => {
    const from = deck({ slides: [{ layout: 'two-column', title: 'from' }] });
    const result = copySlides(from, deck({ catalogs: { default: false } }), [0], { catalogs: [gallery] });
    assert.equal(result.addedGroups.length, 1);
    assert.equal(result.document.slides[1].layout, `${result.addedGroups[0].name}:two-column`);
    assert.equal(result.document.catalogs.default, false);
    assert.deepEqual(resolveSlideContext(result.document, 1, { catalogs: [] }).diagnostics, []);
  });
});

describe('opf/catalog-record-not-in-source', () => {
  const notInSource = (document, catalogs) => validate(document, { only: ['references'], catalogs }).findings.filter((finding) => finding.ruleId === 'opf/catalog-record-not-in-source');

  test('fires when a record under a catalog group is missing from the catalog registered for its source', () => {
    const document = deck({ catalogs: { default: { source: GALLERY, layouts: { 'my-special': layout('Mine', 'title') } } }, slides: [{ layout: 'my-special', title: 'x' }] });
    const found = notInSource(document, [gallery]);
    assert.deepEqual(found.map(({ path, severity, category }) => ({ path, severity, category })), [{ path: '/catalogs/default/layouts/my-special', severity: 'warning', category: 'references' }]);
    assert.match(found[0].message, /'?"my-special"'?/);
    assert.ok(found[0].message.includes(GALLERY) && found[0].message.includes('catalogs.custom'), found[0].message);
    // Rendering is unchanged: the embedded record still wins.
    assert.equal(resolveSlideContext(document, 0, { catalogs: [gallery] }).options.layout.name, 'Mine');
    const named = deck({ catalogs: { acme: { source: ACME, themes: { unknown: { name: 'Unknown' } } } } });
    assert.deepEqual(notInSource(named, [gallery, acme]).map((finding) => finding.path), ['/catalogs/acme/themes/unknown']);
  });

  test('silent when the record exists in the registered catalog, even with different content', () => {
    const document = deck({ catalogs: { default: { source: GALLERY, layouts: { 'two-column': layout('Older revision', 'title') } } } });
    assert.deepEqual(notInSource(document, [gallery]), []);
  });

  test('silent when no catalog is registered for the source', () => {
    const document = deck({ catalogs: { default: { source: GALLERY, layouts: { 'my-special': layout('Mine', 'title') } } } });
    assert.deepEqual(notInSource(document, []), []);
    assert.deepEqual(notInSource(document, [acme]), []);
  });

  test('silent for custom', () => {
    assert.deepEqual(notInSource(deck({ catalogs: { custom: { layouts: { 'my-special': layout('Mine', 'title') } } } }), [gallery]), []);
  });
});
