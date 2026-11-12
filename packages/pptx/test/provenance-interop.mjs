import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSpec} from '../../../scripts/package-manager.mjs';
import {unzipSync, zipSync} from 'fflate';
import {XMLParser} from 'fast-xml-parser';
// OPF 0.15: the gallery ids these decks name (layouts, font schemes, the narrative) resolve from the registered default catalog.
import {toPptx, fromPptx} from './helpers/default-catalog.mjs';

// Spec-gap P1 interop preserves the common supported vocabulary with the
// PUBLISHED importer. Current vocabulary2 furniture intentionally falls back to
// current native content in 0.11.6; it is tested separately below. Importers up to 0.11.6 reject an OPF_DOCUMENT_V1 whose
// `design`/`metadata` carries a key they do not know (and an OPF_SLIDE_V1 whose
// `design` does), dropping the whole tag. The new keys therefore live under
// `supplement`, which those importers ignore. Run through `pnpm run test:packed`
// (needs the npm CLI and registry access).
const PUBLISHED = '0.11.6';
// Test-local observations only: no imported document or archive is migrated.
const provenanceIssues = reports => reports.filter(issue => /^invalid-.*provenance$|^document-provenance/.test(issue.code));
const fallbackIssues = count => Array.from({length: count}, (_, index) => ({code: 'invalid-furniture-provenance', path: `slides.${index}.design`, message: 'Invalid furniture zone. Ordinary import retains current native content; no old source words are restored.'}));
const orderedXml = new XMLParser({preserveOrder: true, ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: false, parseAttributeValue: false, trimValues: false});
function nativeSlide(parts, index) {
  const chunks = [], fields = [], placeholders = [], text = rows => rows.filter(row => Object.hasOwn(row, '#text')).map(row => {assert.equal(typeof row['#text'], 'string'); return row['#text'];}).join('');
  const scan = rows => {for (const row of rows) for (const [key, children] of Object.entries(row)) {
    if (key === 'a:t') chunks.push(text(children));
    if (key === 'p:ph') placeholders.push(row[':@']?.type);
    if (key === 'a:fld') {const cache = children.filter(child => child['a:t']).map(child => text(child['a:t'])).join(''); assert.ok(cache.length); fields.push({type: row[':@']?.type, text: cache});}
    if (Array.isArray(children)) scan(children);
  }};
  scan(orderedXml.parse(new TextDecoder().decode(parts[`ppt/slides/slide${index + 1}.xml`])));
  return {chunks, fields, placeholders};
}
function publicSlideText(document, index) {
  const result = [], rich = value => {if (typeof value === 'string') result.push(value); else if (Array.isArray(value)) {assert.ok(value.every(run => run && typeof run.text === 'string')); result.push(value.map(run => run.text).join(''));}};
  const payload = node => {if (typeof node === 'string' || Array.isArray(node)) {rich(node); return;} if (!node || typeof node !== 'object') return;
    for (const field of ['title', 'subtitle', 'tag', 'text', 'description', 'attribution']) rich(node[field]);
    if (node.quote) {payload(node.quote); rich(node.quote.source);}
    for (const field of ['blocks', 'items']) for (const child of node[field] ?? []) payload(child);
  };
  const slide = document.slides[index]; payload(slide);
  for (const kind of ['header', 'footer']) {const furniture = slide.design?.[kind] ?? document.design?.[kind]; for (const zone of ['left', 'center', 'right', 'start', 'end']) {rich(furniture?.[zone]?.text); rich(furniture?.[zone]?.date);}}
  return result;
}
function assertNativeWords(parts, document) {
  const words = values => values.flatMap(value => value.match(/[\p{L}\p{N}]+/gu) ?? []), counts = values => {const result = new Map(); for (const word of values) result.set(word, (result.get(word) ?? 0) + 1); return result;};
  for (let index = 0; index < document.slides.length; index++) {
    const native = nativeSlide(parts, index), observed = publicSlideText(document, index), expected = counts(words(native.chunks)), actual = counts(words(observed));
    assert.ok(expected.size > 0); for (const [word, count] of expected) assert.ok((actual.get(word) ?? 0) >= count, `Current native word/count on slide${index}: ${word}`);
    // Cached field text is exact, not just a token/word comparison.
    for (const field of native.fields) assert.ok(observed.some(value => value.includes(field.text)), `Current native ${field.type} cache on slide${index}`);
  }
}
function assertCurrentFurniture(parts, count) {
  for (let index = 0; index < count; index++) {
    const xml = new TextDecoder().decode(parts[`ppt/tags/opfFurnitureSlide${index}.xml`]), value = JSON.parse(Buffer.from(xml.match(/\bval="([^"\s]+)"/u)[1], 'hex').toString('utf8'));
    assert.equal(value.vocabulary, 2); assert.deepEqual(Object.keys(value.definitions.footer.value).sort(), ['center', 'end', 'start']);
    for (const part of value.parts) assert.ok(['start', 'center', 'end'].includes(part.zone));
  }
}
const consumer = await mkdtemp(path.join(tmpdir(), 'opf-pptx-interop-'));
try {
  await writeFile(path.join(consumer, 'package.json'), JSON.stringify({name: 'interop-consumer', private: true, type: 'module'}));
  const install = spawnSpec(['npm', 'install', `@openpresentation/opf-pptx@${PUBLISHED}`, '--no-audit', '--no-fund', '--ignore-scripts']);
  execFileSync(install.command, install.args, {...install.options, cwd: consumer, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024});
  const published = await import(pathToFileURL(path.join(consumer, 'node_modules/@openpresentation/opf-pptx/dist/index.js')).href);
  const dec = new TextDecoder();
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  const deck = {name: 'Interop', filename: 'interop-deck', extensions: {'x-vendor': {a: 1}}, tone: 'formal', purpose: 'inform',
    organization: {id: 'acme', name: 'Acme', logo: png}, assets: {spare: png},
    design: {fontScheme: 'arial', logo: 'var:organization.acme.logo', contentAlignment: 'center'},
    slides: [{id: 'one', layout: 'cover', title: 'One', subtitle: 'Two', section: 'Intro', extensions: {'x-s': true}, design: {logo: false, titleAlignment: 'center'}},
      {title: 'Two', section: 'Intro', blocks: [{type: 'group', id: 'g', blocks: [{type: 'text', text: 'a'}, {type: 'text', text: 'b'}]}]}]};
  const bytes = await toPptx(deck, {timestamp: '2026-01-01T00:00:00Z', seed: 1});
  const entries = unzipSync(bytes);
  const tagValue = part => JSON.parse(Buffer.from(dec.decode(entries[part]).match(/\bval="([^"]+)"/)[1], 'hex').toString('utf8'));
  const document = tagValue('ppt/tags/opfDocument.xml'), slide = tagValue('ppt/tags/opfSlide1.xml');
  assert.deepEqual(Object.keys(document.supplement), ['design', 'metadata'], 'new document keys live under supplement');
  // design.logo is a logo reference or false (RR-71); the logo itself is the organization's.
  assert.deepEqual(Object.keys(document.supplement.design), ['logo']); assert.equal(document.supplement.design.logo, 'var:organization.acme.logo', 'the deck logo reference is stored');
  assert.deepEqual(Object.keys(document.supplement.metadata).sort(), ['extensions', 'filename']);
  assert.equal(document.design.logo, undefined); assert.equal(document.metadata.filename, undefined);
  assert.deepEqual(Object.keys(slide.supplement), ['design']); assert.equal(slide.supplement.design.logo, false, 'the slide logo is stored'); assert.equal(slide.design.logo, undefined);

  // The published importer keeps known provenance; v2 cover has no v1 alias and is reported once.
  const issues = [];
  const old = await published.fromPptx(bytes, {onDiagnostic: issue => issues.push(issue)});
  const layoutIssue=issues.filter(issue=>issue.code==='unresolved-layout-reference');
  assert.equal(layoutIssue.length,1,'0.11.6 reports the unsupported v2 layout exactly once');
  assert.equal(layoutIssue[0].path,'slides.0.layout');
  assert.equal(layoutIssue[0].message,"Layout 'cover' is not a bundled layout and the PPTX carries no inline record for it, so slides.0.layout was not restored; the imported slide keeps its observed arrangement.");
  assert.deepEqual(issues.filter(issue => /provenance|reference/.test(issue.code)&&issue.code!=='unresolved-layout-reference'), [], `published ${PUBLISHED} accepts the tags: ${JSON.stringify(issues.map(issue => issue.code))}`);
  assert.equal(old.slides[0].title,'One'); assert.equal(old.slides[0].subtitle,'Two');
  assert.equal(old.tone, 'formal'); assert.equal(old.purpose, 'inform');
  assert.deepEqual(old.organization, {id: 'acme', name: 'Acme', logo: png});
  assert.equal(old.design.contentAlignment, 'center'); assert.equal(old.design.fontScheme, 'arial');
  assert.deepEqual(old.slides.map(item => [item.id, item.layout, item.design?.titleAlignment]), [['one', undefined, 'center'], [undefined, undefined, undefined]]);
  assert.equal(old.filename, undefined); assert.equal(old.design.logo, undefined); assert.equal(old.slides[1].blocks[0].type, 'text', 'older importers keep flat blocks');

  // This build restores everything.
  const current = await fromPptx(bytes);
  assert.equal(current.slides[0].layout,'cover','current importer restores the v2 layout identity');
  assert.equal(current.filename, 'interop-deck'); assert.deepEqual(current.extensions, {'x-vendor': {a: 1}});
  assert.equal(current.design.logo, 'var:organization.acme.logo'); assert.equal(current.slides[0].design.logo, false);
  assert.deepEqual(current.organization, {id: 'acme', name: 'Acme', logo: png});
  assert.deepEqual(current.slides.map(item => item.section), ['Intro', 'Intro']);
  assert.equal(current.slides[1].blocks[0].type, 'group');
  // Spec-gap P2: a design-fields export (cover logo, footer logo, picture bullets). FA-07 (0.14) made FontScheme roles
  // family strings, which importers before 0.14 do not read, so the scheme carries no role override here (design-fields.mjs
  // round-trips role overrides with this build). The current logical start/end furniture vocabulary is breaking:
  // 0.11.6 refuses each complete furniture record with a specific finding and keeps current native content instead.
  // Other metadata and the current reader's exact typed restoration remain separate positive contracts.
  {
    const {resolveLogo} = await import('@openpresentation/opf/composition');
    const rich = typeof resolveLogo === 'function';
    const square = png;
    const p2 = {name: 'Interop P2', narrative: 'problem-solution', audience: 'Executives',
      organization: {id: 'acme', name: 'Acme', role: 'primary', logo: square},
      design: {fontScheme: {id: 'aptos'}, listBullet: 'image', background: {type: 'solid', color: '#FFFFFF'},
        header: {end: {image: 'var:organization.logo.icon'}}, footer: {start: {image: 'var:organization.logo.icon'}, center: {text: 'Confidential'}, end: {text: '{{slide.number}}'}}},
      slides: [{tag: 'Eyebrow', title: 'Cover', subtitle: 'Subtitle', layout: 'cover'},
        {title: 'Section', layout: 'section', section: 'Part one'},
        {title: 'Items', items: ['Alpha', 'Beta', 'Gamma']},
        {title: 'Quote', quote: {text: 'Design is how it works.', attribution: 'Someone'}}]};
    const exported = await toPptx(p2, {timestamp: '2026-01-01T00:00:00Z', seed: 1});
    const parts = unzipSync(exported);
    assertCurrentFurniture(parts, 4);
    const cover = dec.decode(parts['ppt/slides/slide1.xml']);
    assert.equal(/name="OPF logo"/.test(cover), rich, 'the cover logo picture exists exactly when core composes it');
    assert.equal(/<a:buBlip>/.test(dec.decode(parts['ppt/slides/slide3.xml'])), rich, 'picture bullets exist exactly when core composes them');
    const reports = [];
    const older = await published.fromPptx(exported, {onDiagnostic: issue => reports.push(issue)});
    assert.deepEqual(provenanceIssues(reports), fallbackIssues(4), 'Only the four unsupported current furniture records fall back; no additional provenance rejection');
    assertNativeWords(parts, older);
    assert.equal(older.narrative, 'problem-solution'); assert.equal(older.audience, 'Executives');
    assert.deepEqual(older.design.fontScheme, {id: 'aptos'});
    assert.equal(older.design.listBullet, 'image');
    // The old reader does not restore current logical zones or the authored token.
    // Its ordinary current content must include every displayed footer and cached slide number.
    for (let index = 0; index < 4; index++) {assert.ok(publicSlideText(older, index).includes('Confidential')); assert.deepEqual(nativeSlide(parts, index).fields.filter(field => field.type === 'slidenum').map(field => field.text), [String(index + 1)]);}
    assert.equal(older.slides[0].tag, 'Eyebrow'); assert.equal(older.slides[0].title, 'Cover');
    // The published importer does not know a:buBlip bullets or the logo pictures: the entries import as text lines, the logos as ordinary pictures.
    for (const entry of ['Alpha', 'Beta', 'Gamma']) assert.ok(JSON.stringify(older.slides[2]).includes(entry), `${entry} is kept`);
    const newer = await fromPptx(exported);
    assert.deepEqual(newer.design.fontScheme, {id: 'aptos'});
    assert.equal(newer.design.listBullet, 'image');
    assert.equal(newer.organization.logo, square);
    assert.deepEqual(newer.design.footer?.end, {text: '{{slide.number}}'}); assert.deepEqual(newer.design.footer?.center, {text: 'Confidential'});
    if (rich) {
      assert.deepEqual(newer.design.footer?.start, {image: 'var:organization.logo.icon'}); assert.deepEqual(newer.design.header?.end, {image: 'var:organization.logo.icon'});
      // RR-72: the logos are the same on every slide, so they are drawn once, on the slide master. The published importer reads slide
      // shapes only: its unsupported-record fallback does not restore the master logo.
      assert.ok(!JSON.stringify(older.slides[0].design?.footer ?? {}).includes('data:image/png'), 'an older importer does not see the master logo');
      assert.ok(!newer.slides[0].image && !newer.slides[0].blocks, 'the cover logo is not content');
      assert.equal(Array.isArray(newer.slides[2].items) ? newer.slides[2].items.length : newer.slides[2].blocks?.[0]?.items?.length, 3, 'picture-bullet entries import as a list');
    }
  }
  // RR-11: footer text, date and slide number are native placeholders that keep their furniture tags and the manifest's
  // part list. An old reader's typed-zone refusal must still retain current native words, not replay old source.
  {
    const nativeFooter = {design: {fontScheme: 'arial', footer: {start: {date: true}, center: {text: 'Native footer'}, end: {text: '{{slide.number}}'}}}, slides: [{title: 'A', text: 'Body'}, {title: 'B', text: 'Body'}]};
    const exported = await toPptx(nativeFooter, {timestamp: '2026-01-01T00:00:00Z', seed: 1, date: '2026-09-10'});
    const parts = unzipSync(exported); assertCurrentFurniture(parts, 2);
    for (let index = 0; index < 2; index++) {const placeholders = nativeSlide(parts, index).placeholders; assert.deepEqual(placeholders.filter(type => type !== 'title').sort(), ['dt', 'ftr', 'sldNum']); assert.equal(placeholders.filter(type => type === 'title').length, 1, 'The automatic native title is separate from the three furniture placeholders'); assert.deepEqual(nativeSlide(parts, index).fields.filter(field => field.type === 'slidenum').map(field => field.text), [String(index + 1)]);}
    const reports = [];
    const older = await published.fromPptx(exported, {onDiagnostic: issue => reports.push(issue)});
    assert.deepEqual(provenanceIssues(reports), fallbackIssues(2)); assertNativeWords(parts, older);
    for (let index = 0; index < 2; index++) assert.ok(publicSlideText(older, index).includes('Native footer'));
    assert.deepEqual((await fromPptx(exported)).design.footer, nativeFooter.design.footer);
    const original = new Uint8Array(exported), changed = {...parts};
    for (let index = 1; index <= 2; index++) {const name = `ppt/slides/slide${index}.xml`, xml = dec.decode(parts[name]), old = '<a:t>Native footer</a:t>'; assert.equal(xml.split(old).length, 2); changed[name] = new TextEncoder().encode(xml.replace(old, '<a:t>Current  footer</a:t>'));}
    const editedBytes = zipSync(changed), editedCopy = new Uint8Array(editedBytes), editedReports = [], editedOld = await published.fromPptx(editedBytes, {onDiagnostic: issue => editedReports.push(issue)}), editedCurrent = await fromPptx(editedBytes);
    assert.deepEqual(provenanceIssues(editedReports), fallbackIssues(2)); assertNativeWords(changed, editedOld);
    for (let index = 0; index < 2; index++) {assert.ok(publicSlideText(editedOld, index).includes('Current  footer'), 'Old ordinary import preserves both current spaces'); assert.ok(publicSlideText(editedOld, index).every(text => !text.includes('Native footer')), 'No stale footer phrase survives inside any current content'); assert.deepEqual((editedCurrent.slides[index].design?.footer ?? editedCurrent.design.footer).center, {text: 'Current  footer'});}
    for (const name of Object.keys(parts)) if (!/^ppt\/slides\/slide[12]\.xml$/u.test(name)) assert.deepEqual(changed[name], parts[name], 'All metadata, tags and other parts remain unchanged during native text edit');
    assert.deepEqual(new Uint8Array(exported), original); assert.deepEqual(new Uint8Array(editedBytes), editedCopy);
  }
  // Strict positive in the old furniture domain remains: center is shared vocabulary, not an alias.
  {
    const common = {design: {fontScheme: 'arial', footer: {center: {text: 'Common  footer'}}}, slides: [{title: 'Common', text: 'Body'}]}, exported = await toPptx(common, {timestamp: '2026-01-01T00:00:00Z', seed: 1}), reports = [];
    const older = await published.fromPptx(exported, {onDiagnostic: issue => reports.push(issue)}); assert.deepEqual(provenanceIssues(reports), []); assert.deepEqual(older.slides[0].design?.footer ?? older.design.footer, common.design.footer); assertNativeWords(unzipSync(exported), older); assert.deepEqual((await fromPptx(exported)).design.footer, common.design.footer);
  }
  console.log(`Provenance interop passed: an export of this build imports with published opf-pptx ${PUBLISHED} (common-domain metadata/furniture kept; unsupported current layouts/furniture reported; native words and edits preserved) and current typed fields fully with this build.`);
} finally {
  await rm(consumer, {recursive: true, force: true});
}
