import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, writeFile, realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {sourceDeck, bodyDeck, routes, qualificationRoutes, outcomeTemplate, fixtureFontPolicy} from '../scripts/keynote-qualification/fixtures.mjs';
import {hash, inspectArchive, nativeFindings, importedFindings, currentSlideText, verifySeal, prepareCopy, bodyCapability, verifyCandidate} from '../scripts/keynote-qualification/pack.mjs';

const resolver = createRequire(path.join(process.env.OPF_KEYNOTE_TEST_CONSUMER ?? process.cwd(), 'package.json'));
const dependencies = createRequire(resolver.resolve('@openpresentation/opf-pptx/package.json'));
const fflate = dependencies('fflate'), xml = dependencies('fast-xml-parser'), engine = {fflate, xml};
const deck = sourceDeck('data:image/png;base64,AA==');
assert.equal(deck.slides.length, 16);
assert.deepEqual(deck.slides.map(slide => slide.title.match(/^K\d{2}/)[0]), Array.from({length: 16}, (_, index) => `K${String(index + 1).padStart(2, '0')}`));
assert.ok(deck.slides.every(slide => slide.notes.includes('preserve this sentence')));
assert.equal(deck.design.footer.right.text, '{{slide.number}}');
assert.deepEqual(deck.design.fontScheme, {major: 'Arial', minor: 'Arial'}, 'Both authored title and body select Arial, avoiding Arial Black catalog headings');
assert.equal(fixtureFontPolicy.previewAlias, 'Arimo');
assert.equal(fixtureFontPolicy.variants.length, 4);
assert.ok(deck.slides[2].text.some(run => run.bold && run.italic), 'The rich-text control exercises bold italic as well as individual styles');
for (const route of Object.keys(routes)) {
  const result = outcomeTemplate(route);
  assert.equal(Object.keys(result.directions).length, 4);
  assert.ok(Object.values(result.directions).every(value => value.status === 'not-run'));
  assert.ok(result.actions.every(value => value.status === 'not-run'));
  assert.equal(result.nativeAcceptance, false);
  for (const action of routes[route].actions) assert.ok(deck.slides.some(slide => slide.title.startsWith(action.slide)));
}
assert.throws(() => outcomeTemplate('../escape'), /Unknown qualification route/);

const paired = bodyDeck('data:image/png;base64,AA==');
assert.equal(paired.slides.length, 17);
assert.deepEqual(paired.slides.filter((_, index) => index !== 5 && index < 16), deck.slides.filter((_, index) => index !== 5));
assert.equal(paired.slides[5].layout, 'list'); assert.equal(paired.slides[5].items.length, 14);
assert.ok(paired.slides[16].title.startsWith('K17'));
assert.ok(qualificationRoutes(true)['content-edits'].actions.some(action => action.id === 'flat-list' && action.secondMarker));
assert.equal(qualificationRoutes(true)['layout-structure'].expectedSlides, 18);
assert.equal(outcomeTemplate('content-edits', true).actions.at(-1).id, 'flat-list');
assert.equal(sourceDeck('data:image/png;base64,AA==').slides.length, 16, 'Paired fixture never mutates original baseline');
const inline = value => typeof value === 'string' ? value : Array.isArray(value) ? value.map(inline).join('') : value?.text !== undefined ? inline(value.text) : '';
const bodyControls = new Set(['K02', 'K03', 'K05', 'K07', 'K17']);
const capabilityInspection = {slides: paired.slides.map(slide => {
  const marker = slide.title.slice(0, 3), value = marker === 'K07' ? slide.blocks[0].text : slide.text ?? slide.items;
  return {marker, shapes: bodyControls.has(marker) ? [{name: 'OPF native body control', placeholder: {type: 'body', idx: '300'},
    text: [inline(value).replace(/\r\n|\r|\n/g, '')], paragraphs: marker === 'K17' ? slide.items.length : inline(value).split(/\r\n|\r|\n/).length,
    paragraphProperties: marker === 'K17' ? slide.items.map(() => ({'a:buChar': {char: '•'}})) : [],
    bodyProperties: {wrap: 'square', 'a:noAutofit': ''}}] : []};
})};
const fallbackDiagnostics = [{code: 'native-body-fallback', path: 'slides.3.items', reason: 'unsupported-list'}, {code: 'native-body-fallback', path: 'slides.5.items', reason: 'multi-column'}];
assert.equal(bodyCapability(capabilityInspection, paired, fallbackDiagnostics, 'native').controls.length, 5);
const ignored = structuredClone(capabilityInspection); ignored.slides.forEach(slide => {slide.shapes = [];});
assert.throws(() => bodyCapability(ignored, paired, [], 'native'), /one actual Body placeholder/, 'An old exporter ignoring bodyText fails closed');
assert.equal(bodyCapability(ignored, paired, [], 'measured').controls.length, 0);
assert.throws(() => bodyCapability(capabilityInspection, paired, [], 'measured'), /retain measured/);
const split = structuredClone(capabilityInspection); split.slides[1].shapes.push(structuredClone(split.slides[1].shapes[0]));
assert.throws(() => bodyCapability(split, paired, fallbackDiagnostics, 'native'), /one actual Body placeholder/, 'Per-line fake bodies are refused');
const partial = structuredClone(capabilityInspection); partial.slides[1].shapes[0].text = ['only part'];
assert.throws(() => bodyCapability(partial, paired, fallbackDiagnostics, 'native'), /all current source characters/);
const soft = structuredClone(capabilityInspection); soft.slides[4].shapes[0].paragraphs++;
assert.throws(() => bodyCapability(soft, paired, fallbackDiagnostics, 'native'), /authored paragraphs only/);
const fakeBullets = structuredClone(capabilityInspection); fakeBullets.slides[16].shapes[0].paragraphProperties[1] = {};
assert.throws(() => bodyCapability(fakeBullets, paired, fallbackDiagnostics, 'native'), /real flat character bullet/);
assert.throws(() => bodyCapability(capabilityInspection, paired, [], 'native'), /missing unsupported-list fallback/);
const wrongFallback = structuredClone(fallbackDiagnostics); wrongFallback[1].reason = 'unsupported-list';
assert.throws(() => bodyCapability(capabilityInspection, paired, wrongFallback, 'native'), /missing multi-column fallback/);
await assert.rejects(verifyCandidate(undefined, {}), /requires --candidate/);

// Independent XML fixture: presentation order differs from numeric part order; no OPF importer/provenance involved.
const {strToU8, zipSync} = fflate;
const relationships = values => `<Relationships>${values.map(([id, type, target]) => `<Relationship Id="${id}" Type="urn:test/${type}" Target="${target}"/>`).join('')}</Relationships>`;
const textShape = (marker, ph = '') => `<p:sp><p:nvSpPr><p:cNvPr name="${marker}"/><p:nvPr>${ph}</p:nvPr></p:nvSpPr><p:txBody><a:bodyPr wrap="square"/><a:p><a:r><a:t>${marker}</a:t></a:r></a:p></p:txBody></p:sp>`;
const parts = {
  '[Content_Types].xml': '<Types/>',
  '_rels/.rels': relationships([['main', 'officeDocument', 'ppt/presentation.xml']]),
  'ppt/presentation.xml': '<p:presentation><p:sldIdLst><p:sldId r:id="second"/><p:sldId r:id="first"/></p:sldIdLst></p:presentation>',
  'ppt/_rels/presentation.xml.rels': relationships([['first', 'slide', 'slides/slide1.xml'], ['second', 'slide', '/ppt/slides/slide2.xml']]),
  'ppt/slides/slide1.xml': `<p:sld><p:cSld><p:spTree>${textShape('K01', '<p:ph type="title" idx="0"/>')}<p:graphicFrame><c:chart r:id="chart"/></p:graphicFrame><p:graphicFrame><a:tbl><a:tr><a:tc><a:txBody><a:p><a:r><a:t>Cell</a:t></a:r></a:p></a:txBody></a:tc></a:tr></a:tbl></p:graphicFrame></p:spTree></p:cSld></p:sld>`,
  'ppt/slides/slide2.xml': `<p:sld><p:cSld><p:spTree>${textShape('K02', '<p:ph type="body" idx="1"/>')}</p:spTree></p:cSld></p:sld>`,
  'ppt/slides/_rels/slide1.xml.rels': relationships([['chart', 'chart', '../charts/chart1.xml'], ['notes', 'notesSlide', '../notesSlides/notesSlide1.xml']]),
  'ppt/charts/chart1.xml': '<c:chartSpace><c:numCache><c:pt idx="0"><c:v>900</c:v></c:pt></c:numCache></c:chartSpace>',
  'ppt/notesSlides/notesSlide1.xml': '<p:notes><a:p><a:r><a:t>KN_EDIT_NOTES</a:t></a:r></a:p></p:notes>',
  'ppt/slideLayouts/slideLayout1.xml': '<p:sldLayout><p:ph type="body" idx="1"/></p:sldLayout>',
};
const archive = values => zipSync(Object.fromEntries(Object.entries(values).map(([name, value]) => [name, strToU8(value)])));
const inspection = inspectArchive(archive(parts), engine);
assert.deepEqual(inspection.slides.map(slide => slide.marker), ['K02', 'K01']);
assert.equal(inspection.slides[0].shapes[0].placeholder.type, 'body');
assert.equal(inspection.slides[1].shapes[0].paragraphs, 1);
assert.equal(inspection.nativeChartCount, 1); assert.equal(inspection.nativeTableCount, 1);
assert.deepEqual(inspection.slides[1].charts[0].values, [900]);
assert.deepEqual(inspection.slides[1].notes, ['KN_EDIT_NOTES']);
assert.throws(() => inspectArchive(archive({...parts, 'ppt/slides/_rels/slide1.xml.rels': relationships([['chart', 'chart', '../missing.xml']])}), engine), /Missing relationship target/);
assert.throws(() => inspectArchive(archive({...parts, 'ppt/slides/slide2.xml': '<p:sld>'}), engine), /Invalid XML/);

const semantic = text => ({objects: [{name: 'authored', placeholderRole: null, paragraphs: [text], fields: {}}], fields: {}});
const observed = {nativeChartCount: 2, nativeTableCount: 2, slides: deck.slides.map(slide => ({marker: slide.title.slice(0, 3), text: [slide.title], notes: [slide.notes], charts: [], textSemantics: semantic(slide.title), notesSemantics: semantic(slide.notes)}))};
assert.deepEqual(nativeFindings(observed, 'no-op', observed), []);
const removed = structuredClone(observed); removed.slides.pop(); removed.nativeChartCount = 0;
assert.ok(nativeFindings(removed, 'no-op', observed).some(value => value.includes('K16')));
assert.ok(nativeFindings(removed, 'no-op', observed).some(value => value.includes('native chart')));
const changed = structuredClone(observed); changed.slides[1].text.push('stale changed text');
changed.slides[1].textSemantics.objects[0].paragraphs.push('stale changed text');
assert.ok(nativeFindings(changed, 'no-op', observed).some(value => value.includes('ordered authored text changed')));
assert.ok(nativeFindings(observed, 'content-edits', observed).some(value => value.includes('edited notes missing')));
assert.ok(nativeFindings(observed, 'content-edits', observed).some(value => value.includes('chart series/category/value cache missing')));
assert.ok(nativeFindings(observed, 'layout-structure', observed).some(value => value.includes('K14 must immediately follow')));
const stale = structuredClone(deck);
stale.extensions = {cached: 'KN_EDIT_PARAGRAPH KN_EDIT_LIST KN_EDIT_CELL KN_EDIT_NOTES'};
stale.slides[1].notes += ' KN_EDIT_PARAGRAPH';
stale.slides[0].text = 'KN_EDIT_LIST KN_EDIT_CELL';
const importedFailures = importedFindings(stale, 'content-edits');
assert.ok(importedFailures.some(value => value.startsWith('paragraph: edited marker missing')));
assert.ok(importedFailures.some(value => value.startsWith('paragraph: replaced old text resurrected')));
assert.ok(importedFailures.some(value => value.startsWith('list: edited marker missing')));
assert.ok(importedFailures.some(value => value.startsWith('table-cell: edited marker missing')));
assert.ok(importedFailures.some(value => value.startsWith('notes: edited marker missing')));
assert.equal(currentSlideText({title: 'K02', extensions: {text: 'KN_EDIT_PARAGRAPH'}, notes: 'KN_EDIT_PARAGRAPH'}), 'K02');
const splitNew = {slides: [...deck.slides, {title: 'KN_NEW_TITLE'}, {text: 'KN_NEW_BODY'}]};
assert.ok(importedFindings(splitNew, 'layout-structure').some(value => value.startsWith('new-slide: new body missing')));
splitNew.slides.at(-2).text = 'KN_NEW_BODY';
assert.ok(!importedFindings(splitNew, 'layout-structure').some(value => value.startsWith('new-slide:')));
const chartEdited = structuredClone(deck), cacheEdited = structuredClone(observed);
chartEdited.slides[9].chart.data.rows[1][1] = 900;
cacheEdited.slides[9].charts = [{series: [{name: 'Revenue', categories: ['Q1', 'Q2', 'Q3'], values: [12, 900, 18]}]}];
assert.ok(!importedFindings(chartEdited, 'content-edits').some(value => value.startsWith('chart-data:')));
assert.ok(!nativeFindings(cacheEdited, 'content-edits', observed).some(value => value.startsWith('chart-data:')));
chartEdited.slides[9].chart.data.rows[0][1] = 900; chartEdited.slides[9].chart.data.rows[1][1] = 24;
cacheEdited.slides[9].charts[0].series[0].values = [900, 24, 18];
assert.ok(importedFindings(chartEdited, 'content-edits').some(value => value.startsWith('chart-data:')));
assert.ok(nativeFindings(cacheEdited, 'content-edits', observed).some(value => value.startsWith('chart-data:')));

const temporary = await realpath(await mkdtemp(path.join(tmpdir(), 'keynote-pack-'))), suiteDirectory = path.join(temporary, 'suite');
// Receipt checks bind every generation to the same installed payload and exact consumer pins.
const candidateDirectory = path.join(temporary, 'candidate'); await mkdir(candidateDirectory);
const packed = Buffer.from('candidate tarball control'), manifest = {private: true, dependencies: {'@openpresentation/opf': '0.20.1'}}, lock = Buffer.from('{"lockfileVersion":3}\n');
await writeFile(path.join(candidateDirectory, 'package.json'), JSON.stringify(manifest));
await writeFile(path.join(candidateDirectory, 'package-lock.json'), lock);
const tarball = path.join(temporary, 'candidate.tgz'), candidateFile = path.join(temporary, 'candidate.json'); await writeFile(tarball, packed);
const receipt = {schemaVersion: 1, kind: 'local-pptx-source-candidate', registryAcceptance: false, nativeAcceptance: false,
  source: {revision: 'a'.repeat(40), clean: true}, tarball: {file: tarball, bytes: packed.length, sha256: hash(packed), integrity: 'sha512-' + createHash('sha512').update(packed).digest('base64')},
  consumer: {directory: candidateDirectory, manifestSha256: hash(Buffer.from(JSON.stringify(manifest, null, 2) + '\n')), lockSha256: hash(lock)}, packages: []};
await writeFile(candidateFile, JSON.stringify(receipt));
const candidateEngine = {consumer: candidateDirectory, packages: []};
assert.deepEqual(await verifyCandidate(candidateFile, candidateEngine), receipt);
await assert.rejects(verifyCandidate(candidateFile, {...candidateEngine, consumer: temporary}), /another consumer/);
await assert.rejects(verifyCandidate(candidateFile, {...candidateEngine, packages: [{name: 'old-public-exporter'}]}), /runtime differs/);
await writeFile(path.join(candidateDirectory, 'package-lock.json'), 'changed');
await assert.rejects(verifyCandidate(candidateFile, candidateEngine), /lockfile changed/);
await writeFile(path.join(candidateDirectory, 'package-lock.json'), lock);
await writeFile(path.join(candidateDirectory, 'package.json'), JSON.stringify({...manifest, dependencies: {}}));
await assert.rejects(verifyCandidate(candidateFile, candidateEngine), /pins changed/);
await writeFile(path.join(candidateDirectory, 'package.json'), JSON.stringify(manifest));
await writeFile(tarball, 'changed');
await assert.rejects(verifyCandidate(candidateFile, candidateEngine), /AssertionError/);
await mkdir(path.join(suiteDirectory, 'inputs'), {recursive: true});
const bytes = Buffer.from('sealed input'); await writeFile(path.join(suiteDirectory, 'inputs/deck.pptx'), bytes);
const suite = {schemaVersion: 1, kind: 'keynote-qualification', files: [{path: 'inputs/deck.pptx', bytes: bytes.length, sha256: hash(bytes)}]};
await writeFile(path.join(suiteDirectory, 'suite.json'), JSON.stringify(suite));
await verifySeal(suiteDirectory);
const output = path.join(temporary, 'new-attempt');
await prepareCopy({suite: suiteDirectory, route: 'no-op', output});
assert.deepEqual(await readFile(path.join(output, 'editable.pptx')), bytes);
await assert.rejects(prepareCopy({suite: suiteDirectory, route: 'no-op', output}), /EEXIST/);
await assert.rejects(prepareCopy({suite: suiteDirectory, route: 'bad', output: path.join(temporary, 'bad-route')}), /Unknown route/);
await writeFile(path.join(suiteDirectory, 'inputs/deck.pptx'), 'tampered');
await assert.rejects(verifySeal(suiteDirectory), /bytes|sha256/);
await writeFile(path.join(suiteDirectory, 'inputs/deck.pptx'), bytes);
await writeFile(path.join(suiteDirectory, 'extra.txt'), 'unsealed');
await assert.rejects(verifySeal(suiteDirectory), /missing, extra or changed/);
await writeFile(path.join(suiteDirectory, 'suite.json'), JSON.stringify({...suite, files: [{...suite.files[0], path: '../outside'}]}));
await assert.rejects(verifySeal(suiteDirectory), /Unsafe sealed file path/);
console.log('Keynote qualification: unchanged 16-case baseline, paired 17-case body fixture, actual-body/ignored-option/fallback guards, three routes, independent XML/object/order checks and fresh sealed-copy/tamper controls pass; no native acceptance claimed.');
