import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {unzipSync, zipSync} from 'fflate';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
if (!process.argv[2]) throw new Error('Usage: node test/openxml/generate.mjs NEW_OUTPUT_DIRECTORY [INSTALLED_CONSUMER_DIRECTORY]');
const consumer = process.argv[3] ? createRequire(path.join(path.resolve(process.argv[3]), 'package.json')) : undefined;
const converterModule = consumer ? pathToFileURL(consumer.resolve('@openpresentation/opf-pptx')).href : new URL('../../dist/index.js', import.meta.url).href;
const fontModule = consumer ? pathToFileURL(consumer.resolve('@openpresentation/opf-render/fonts-node')).href : '@openpresentation/opf-render/fonts-node';
const {toPptx, fromPptx} = await import(converterModule);
const {prepareNodeFonts} = await import(fontModule);
const root = path.resolve(process.argv[2]);
await mkdir(root, {recursive: false});
for (const variant of ['original', 'repacked', 'reordered']) await mkdir(path.join(root, variant));
const {options: fontOptions} = await prepareNodeFonts();
const imageBytes = await readFile(new URL('../fixtures/images/wide.png', import.meta.url));
const image = {src: `data:image/png;base64,${imageBytes.toString('base64')}`, alt: 'Header image with text'};
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
// Match the exporter's ordinal ZIP order, not locale-dependent collation.
const repack = entries => zipSync(Object.fromEntries(Object.keys(entries).sort().map(name => [name, [entries[name], {mtime: new Date(1980, 0, 1)}]])), {level: 6});
const cases = [];
for (const measured of [false, true]) for (const [width, height] of [[1280, 720], [720, 1280]]) for (const floor of [16, 32]) for (const local of [false, true]) {
  const source = {organization: {id: 'primary', name: 'Organization'}, design: {fontScheme: 'roboto', dimensions: {widthInches: width / 96, heightInches: height / 96}, header: {left: {text: ' Authored\twords \r\n\r\nlast  \r'}, center: {organization: true}, right: {section: true}}, footer: {left: {date: ' 2026-09-10 '}, right: {slideNumber: true}}}, slides: [{title: 'Furniture', section: 'Section', text: 'Keep body words.', composition: {minFontSize: floor, overflow: 'error'}, ...(local ? {design: {header: {left: {image, text: ''}, right: {text: 'Local'}}}} : {})}]};
  cases.push({id: `furniture-${measured ? 'measured' : 'estimated'}-${width}-${floor}-${local ? 'local' : 'inherited'}`, source, options: measured ? fontOptions : {}});
}
cases.push(
  {id: 'notes-control', source: {slides: [{title: 'Speaker notes', text: 'First slide', notes: 'Keep these speaker notes.\nSecond line.'}, {title: 'Second slide', image, notes: 'Second slide speaker notes.'}]}},
  {id: 'plain-control', source: {slides: [{title: 'Plain control', text: 'Current content'}]}},
  {id: 'image-control', source: {slides: [{title: 'Image control', image}]}},
  {id: 'empty-furniture', source: {design: {header: {left: {text: ''}}}, slides: [{text: 'Body'}]}},
  {id: 'disabled-furniture', source: {design: {header: {left: {text: 'Disabled'}}}, slides: [{text: 'Body', design: {header: false, footer: false}}]}},
);
const manifest = [];
for (const {id, source, options = {}} of cases) {
  const before = JSON.stringify(source);
  const bytes = await toPptx(source, {...options, strictAssets: true});
  if (before !== JSON.stringify(source)) throw new Error(`Changed source: ${id}`);
  // This is an isolated diagnostic variant, never a production postprocessor.
  const entries = unzipSync(bytes);
  const unchanged = repack(entries);
  assert.equal(hash(unchanged), hash(bytes), 'An unmodified repack must reproduce production bytes before comparing XML ordering.');
  const originalXml = new TextDecoder().decode(entries['ppt/presentation.xml']);
  const match = /(<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>)(<p:notesMasterIdLst>[\s\S]*?<\/p:notesMasterIdLst>)/;
  assert.ok(match.test(originalXml), 'Record an upstream ordering change instead of silently rewriting another structure.');
  const changedXml = originalXml.replace(match, '$2$1');
  entries['ppt/presentation.xml'] = new TextEncoder().encode(changedXml);
  const reordered = repack(entries);
  const originalParts = unzipSync(bytes), changedParts = unzipSync(reordered);
  assert.deepEqual(Object.keys(originalParts), Object.keys(changedParts), 'ZIP entry order must remain unchanged.');
  assert.deepEqual(Object.keys(originalParts).sort(), Object.keys(changedParts).sort());
  const differences = Object.keys(originalParts).filter(name => hash(originalParts[name]) !== hash(changedParts[name]));
  assert.deepEqual(differences, ['ppt/presentation.xml']);
  assert.equal(changedXml.replace(match, '$2$1'), changedXml, 'The candidate no longer contains the production pair.');
  const originalImport = await fromPptx(bytes), reorderedImport = await fromPptx(reordered);
  assert.deepEqual(reorderedImport, originalImport, 'Reordering must not change current semantic reimport.');
  await writeFile(path.join(root, 'original', `${id}.pptx`), bytes);
  await writeFile(path.join(root, 'repacked', `${id}.pptx`), unchanged);
  await writeFile(path.join(root, 'reordered', `${id}.pptx`), reordered);
  await writeFile(path.join(root, `${id}.opf.json`), JSON.stringify(source, null, 2) + '\n');
  manifest.push({id, originalSha256: hash(bytes), repackedSha256: hash(unchanged), reorderedSha256: hash(reordered), zipEntryOrderUnchanged: true, changedParts: differences, semanticImportSha256: hash(JSON.stringify(originalImport))});
}
await writeFile(path.join(root, 'manifest.json'), JSON.stringify({node: process.version, mode: consumer ? 'installed' : 'source', converterModule, fontModule, verifierSha256: hash(await readFile(new URL(import.meta.url))), cases: manifest}, null, 2) + '\n');
console.log(`Generated ${cases.length} original/repacked/reordered controls. Unmodified repacks match production bytes; reordered ZIP entry order is unchanged, only presentation.xml differs, and semantic imports match. No native acceptance is claimed.`);
