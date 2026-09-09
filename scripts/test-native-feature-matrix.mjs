// Native feature coverage. Registry-only by default; an explicit candidate is hash-bound and labelled separately.
// node scripts/test-native-feature-matrix.mjs <registry-consumer> <output-directory> generate|compare [candidate-pptx-entry]
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, realpath } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [consumerArg, outputArg, mode] = process.argv.slice(2);
assert.ok(consumerArg && outputArg && ['generate', 'compare'].includes(mode), 'Expected consumer, output and generate|compare');
const consumer = path.resolve(consumerArg), output = path.resolve(outputArg);
const require = createRequire(path.join(consumer, 'package.json'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const json = async file => JSON.parse((await readFile(file, 'utf8')).replace(/^\uFEFF/, ''));
const writeJson = (file, value) => writeFile(path.join(output, file), JSON.stringify(value, null, 2) + '\n');
await mkdir(output, {recursive: true});
const lock = await json(path.join(consumer, 'package-lock.json'));
const modules = await realpath(path.join(consumer, 'node_modules'));
const packages = {};
for (const name of ['opf', 'opf-render', 'opf-pptx']) {
  const fullName = '@openpresentation/' + name;
  const manifestPath = require.resolve(fullName + '/package.json');
  const manifest = await json(manifestPath), record = lock.packages['node_modules/' + fullName];
  assert.ok((await realpath(path.dirname(manifestPath))).startsWith(modules + path.sep));
  assert.ok(record?.version === manifest.version && !record.link && record.resolved?.startsWith('https://registry.npmjs.org/') && record.integrity?.startsWith('sha512-'), 'Actual registry package required: ' + fullName);
  packages[name] = {version: manifest.version, integrity: record.integrity};
}
const load = async (name, subpath = '.') => {
  const manifestPath = require.resolve('@openpresentation/' + name + '/package.json');
  const manifest = await json(manifestPath), entry = manifest.exports[subpath];
  return import(pathToFileURL(path.resolve(path.dirname(manifestPath), typeof entry === 'string' ? entry : entry.import ?? entry.default)).href);
};
const { validatePresentation } = await load('opf');
const { examples } = await load('opf', './examples');
const { renderSvgDeck, svgToPng } = await load('opf-render');
const { createFontRegistry } = await load('opf-render', './fonts');
const candidateEntry = process.argv[5] ? await realpath(path.resolve(process.argv[5])) : null;
let candidate = null;
if (candidateEntry) {
  // Hash the complete shipped runtime, including internal imports and vendored code.
  const candidateRoot = path.resolve(path.dirname(candidateEntry), '..');
  const manifest = await json(path.join(candidateRoot, 'package.json'));
  const candidateLock = await json(path.join(candidateRoot, 'package-lock.json'));
  const candidateRequire = createRequire(path.join(candidateRoot, 'package.json'));
  assert.equal(manifest.name, '@openpresentation/opf-pptx');
  assert.equal(candidateEntry, await realpath(path.join(candidateRoot, 'dist/index.js')));
  for (const name of ['opf', 'opf-render']) {
    const fullName = '@openpresentation/' + name;
    const installed = await json(candidateRequire.resolve(fullName + '/package.json'));
    const locked = candidateLock.packages['node_modules/' + fullName];
    assert.equal(installed.version, packages[name].version, 'Candidate must use the same core/renderer versions');
    assert.equal(locked?.integrity, packages[name].integrity, 'Candidate must use the same registry core/renderer tarballs');
  }
  const {readdir} = await import('node:fs/promises');
  const files = {};
  const walk = async directory => {
    for (const entry of (await readdir(path.join(candidateRoot, directory), {withFileTypes: true})).sort((a, b) => a.name.localeCompare(b.name))) {
      const relative = directory + '/' + entry.name;
      assert.ok(!entry.isSymbolicLink(), 'Candidate runtime must not contain symlinks');
      if (entry.isDirectory()) await walk(relative);
      else if (entry.isFile()) files[relative] = hash(await readFile(path.join(candidateRoot, relative)));
    }
  };
  await walk('dist');
  await walk('vendor');
  files['package.json'] = hash(await readFile(path.join(candidateRoot, 'package.json')));
  files['package-lock.json'] = hash(await readFile(path.join(candidateRoot, 'package-lock.json')));
  candidate = {kind: 'local-candidate-not-registry-release', package: manifest.name, declaredVersion: manifest.version, files};
}
const { toPptx, fromPptx } = candidateEntry ? await import(pathToFileURL(candidateEntry).href) : await load('opf-pptx');
const sharp = require('sharp');
const selected = ['rich-text-runs', 'dynamic-composition', 'table-cell-types', 'table-and-code', 'metrics-quotes-timeline', 'rows-chart', 'grid-spans'];

if (mode === 'generate') {
  const fontDirectory = path.join(process.env.WINDIR ?? 'C:/Windows', 'Fonts');
  const faces = [['calibri.ttf', 400, false], ['calibrib.ttf', 700, false], ['calibrii.ttf', 400, true], ['calibriz.ttf', 700, true]];
  const fontFiles = faces.map(([file]) => path.join(fontDirectory, file));
  const fontHashes = Object.fromEntries(await Promise.all(faces.map(async ([file]) => [file, hash(await readFile(path.join(fontDirectory, file)))])));
  const fonts = createFontRegistry(await Promise.all(faces.map(async ([file, weight, italic]) => ({data: new Uint8Array(await readFile(path.join(fontDirectory, file))), family: 'Calibri', weight, italic}))), {substitutionPolicy: 'none'});
  const records = [];
  const cases = selected.map(id => {
    const source = examples.find(item => item.file.endsWith('/' + id + '.opf.json'));
    assert.ok(source, 'Missing published example: ' + id);
    return {id, source: source.file, original: source.deck};
  });
  const assetExample = examples.find(item => item.file.endsWith('/asset-source-forms.opf.json'));
  assert.ok(assetExample);
  cases.push({id: 'embedded-raster', source: assetExample.file + '#data-uri-image', original: {name: 'Embedded raster', slides: [{title: 'Embedded raster stays an image', image: {src: assetExample.deck.assets['data-uri-image'], alt: 'Published inline image'}}]}});
  for (const {id, source, original} of cases) {
    const document = structuredClone(original), fontChanges = [];
    // Controlled local-font comparison: record every authored font override, never distribute Office font binaries.
    const normalizeFonts = (node, at = '') => {
      if (!node || typeof node !== 'object') return;
      for (const [key, value] of Object.entries(node)) {
        const field = at + '/' + key;
        if (key === 'fontFamily' || key === 'fontScheme') {
          fontChanges.push({path: field, original: value, replacement: 'Calibri'});
          node[key] = key === 'fontFamily' ? 'Calibri' : {id: 'calibri', code: {family: 'Calibri'}};
        } else normalizeFonts(value, field);
      }
    };
    normalizeFonts(document);
    document.design = {...document.design, fontScheme: {id: 'calibri', code: {family: 'Calibri'}}, dimensions: {widthInches: 1280 / 96, heightInches: 720 / 96}};
    assert.equal(validatePresentation(document).valid, true, id);
    const diagnostics = [], options = {textMeasurement: fonts.textMeasurement, strictAssets: true, onDiagnostic: issue => diagnostics.push(issue)};
    const svgs = renderSvgDeck(document, options), hashes = {};
    const save = async (file, bytes) => {await writeFile(path.join(output, file), bytes); hashes[file] = hash(bytes);};
    for (const [index, svg] of svgs.entries()) {
      await save(`${id}-renderer-${index + 1}.png`, await svgToPng(svg, {fontFiles, useBundledFonts: false, loadSystemFonts: false}));
    }
    await save(id + '.pptx', await toPptx(document, options));
    await save(id + '.opf.json', JSON.stringify(document, null, 2) + '\n');
    records.push({id, source, sourceSha256: hash(JSON.stringify(original)), slides: document.slides.length, fontChanges, diagnostics, hashes});
    console.log(`Generated ${id}: ${document.slides.length} slides`);
  }
  assert.ok(fonts.substitutions.every(item => item.requestedFamily === 'Calibri' && item.resolvedFamily === 'Calibri'), 'No family substitution allowed');
  await writeJson('generation.json', {packages, candidate, fontFamily: 'Calibri', fontFiles: faces.map(([file]) => file), fontHashes, fontSubstitutions: fonts.substitutions, scope: 'Published technical examples with explicit local Calibri and 1280x720 dimensions; intermediate font weights resolve to available regular/bold faces and are recorded. Embedded image case uses only the published data URI. No external assets or proprietary fonts distributed. The candidate field, when present, replaces the registry PPTX implementation and prevents a registry-release claim.', decks: records});
} else {
  const generation = await json(path.join(output, 'generation.json'));
  const native = await json(path.join(output, 'native.json'));
  assert.deepEqual(generation.packages, packages, 'Regenerate when registry packages change');
  assert.deepEqual(generation.candidate ?? null, candidate, 'Regenerate when the candidate implementation changes');
  const decks = [], contacts = [], contactSheets = [];
  for (const record of generation.decks) {
    const {id} = record;
    assert.match(id, /^[a-z0-9-]+$/);
    for (const [file, digest] of Object.entries(record.hashes)) {
      assert.equal(path.basename(file), file, 'Fixture paths must be local filenames');
      assert.equal(hash(await readFile(path.join(output, file))), digest, 'Changed generated fixture: ' + file);
    }
    const observation = native.decks.find(item => item.id === id);
    assert.ok(observation && observation.slides.length === record.slides && observation.editsReopened === record.slides, 'Missing native slide/edit evidence: ' + id);
    assert.equal(observation.sourceSha256, record.hashes[id + '.pptx']);
    assert.equal(hash(await readFile(path.join(output, id + '-native-saved.pptx'))), observation.savedSha256);
    assert.equal(hash(await readFile(path.join(output, id + '-native-edited.pptx'))), observation.editedSha256);
    const shapes = observation.slides.flatMap(slide => slide.shapes);
    const nativeObjects = {tables: shapes.filter(shape => shape.table).length, charts: shapes.filter(shape => shape.chart).length, pictures: shapes.filter(shape => shape.type === 13).length, editableTextShapes: shapes.filter(shape => shape.text).length};
    assert.equal(nativeObjects.tables, {'table-cell-types': 2, 'table-and-code': 1}[id] ?? 0, 'Expected native tables');
    assert.equal(nativeObjects.charts, id === 'rows-chart' ? 1 : 0, 'Expected editable Office chart');
    assert.equal(nativeObjects.pictures, id === 'embedded-raster' ? 1 : 0, 'Expected native picture');
    const comparisons = [], imports = [];
    for (let index = 1; index <= record.slides; index++) {
      const rendererPath = path.join(output, `${id}-renderer-${index}.png`), nativePath = path.join(output, `${id}-native-${index}.png`);
      assert.equal(hash(await readFile(nativePath)), observation.slides[index - 1].rasterSha256);
      const expected = await sharp(rendererPath).removeAlpha().raw().toBuffer({resolveWithObject: true});
      const actual = await sharp(nativePath).removeAlpha().raw().toBuffer({resolveWithObject: true});
      assert.deepEqual(actual.info, expected.info);
      const diff = Buffer.alloc(expected.data.length);
      let total = 0, over10 = 0;
      for (let channel = 0; channel < diff.length; channel++) {const delta = Math.abs(expected.data[channel] - actual.data[channel]); diff[channel] = delta; total += delta; if (delta > 10) over10++;}
      await sharp(diff, {raw: expected.info}).png().toFile(path.join(output, `${id}-difference-${index}.png`));
      comparisons.push({slide: index, meanAbsoluteChannelDifference: total / diff.length, channelFractionOver10: over10 / diff.length});
      contacts.push({id, slide: index, rendererPath, nativePath});
    }
    for (const suffix of ['', '-native-saved', '-native-edited']) {
      const diagnostics = [];
      const imported = await fromPptx(await readFile(path.join(output, id + suffix + '.pptx')), {onDiagnostic: issue => diagnostics.push(issue)});
      assert.equal(validatePresentation(imported).valid, true, id + suffix);
      assert.equal(imported.slides.length, record.slides);
      if (suffix === '-native-edited') for (let index = 1; index <= record.slides; index++) assert.ok(JSON.stringify(imported.slides[index - 1]).includes(`Native edit ${id} slide ${index}`), 'Native text edit missing from reimport');
      await writeJson(id + suffix + '.reimport.json', imported);
      imports.push({file: id + suffix + '.pptx', valid: true, slides: imported.slides.length, editsPreserved: suffix === '-native-edited', diagnostics});
    }
    decks.push({...record, native: observation, nativeObjects, comparisons, imports});
  }
  for (let offset = 0; offset < contacts.length; offset += 6) {
    const rows = contacts.slice(offset, offset + 6), composite = [];
    for (const [row, item] of rows.entries()) for (const [column, file] of [item.rendererPath, item.nativePath].entries()) composite.push({input: await sharp(file).resize(480, 270).png().toBuffer(), left: column * 480, top: row * 270});
    const file = `contact-${offset / 6 + 1}.png`;
    await sharp({create: {width: 960, height: rows.length * 270, channels: 3, background: '#ffffff'}}).composite(composite).png().toFile(path.join(output, file));
    contactSheets.push({file, sha256: hash(await readFile(path.join(output, file))), rows: rows.map(({id, slide}) => ({id, slide}))});
  }
  const report = {packages, powerPointVersion: native.powerPointVersion, fontPolicy: generation.scope, slides: contacts.length, decks, scope: 'Native open/raster/edit/save/reopen and schema-valid reimport, measured RGB raster differences. Left contact column is renderer; right is PowerPoint. Differences are observations, not an equivalence pass threshold. Chart shape counts distinguish native Office charts from editable primitive renderings. This is a controlled feature sample, not arbitrary Office/media/language fidelity.'};
  report.fontSubstitutions = generation.fontSubstitutions;
  report.candidate = candidate;
  report.fontHashes = generation.fontHashes;
  report.contactSheets = contactSheets;
  await writeJson('comparison.json', report);
  console.log(JSON.stringify({slides: report.slides, decks: decks.map(item => ({id: item.id, comparisons: item.comparisons, diagnostics: item.diagnostics.length, importDiagnostics: item.imports.map(value => value.diagnostics.length)}))}, null, 2));
}
