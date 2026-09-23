import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {mkdir, readFile, realpath, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {applyMasterBulletFontTransform, carlitoOnlySource, carlitoOnlyTypefaceFailures, declaredFontsUsed, MASTER_BULLET_FONT_TRANSFORM, themeFontSlots, typefaceInventory} from './native-font-embed-fixture-source.mjs';

assert.equal(process.versions.node.split('.')[0], '24', 'Use Node 24 for new evidence.');
const cliFlags = new Set(['--carlito-only', '--harness-master-bullet-font']);
const flags = process.argv.slice(2).filter(value => value.startsWith('--'));
const [outputArgument, consumerArgument, ...extraArguments] = process.argv.slice(2).filter(value => !value.startsWith('--'));
assert.ok(outputArgument && consumerArgument && extraArguments.length === 0 && flags.every(flag => cliFlags.has(flag)), 'Usage: node test/native-font-edit-fixture.mjs NEW_OUTPUT_DIRECTORY REGISTRY_CONSUMER [--carlito-only [--harness-master-bullet-font]]');
const carlitoOnly = flags.includes('--carlito-only'), harnessBulletFont = flags.includes('--harness-master-bullet-font');
assert.ok(!harnessBulletFont || carlitoOnly, '--harness-master-bullet-font requires --carlito-only');
const output = path.resolve(outputArgument), consumer = await realpath(consumerArgument);
const requireConsumer = createRequire(path.join(consumer, 'package.json'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
// Source-file provenance independent of core.autocrlf: hash the text with CRLF normalized to LF.
const lfSha = bytes => sha(Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n')));
const json = bytes => JSON.parse(bytes.toString('utf8'));
const withinConsumer = async file => {
  const resolved = await realpath(file), relative = path.relative(consumer, resolved);
  assert.ok(relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative), `Resolved outside registry consumer: ${file}`);
  return resolved;
};
const lockPath = path.join(consumer, 'package-lock.json'), lock = await readFile(lockPath);
const lockedPackages = json(lock).packages;
const registryPackage = (name, version) => {
  const locked = lockedPackages?.['node_modules/' + name];
  assert.equal(locked?.version, version);
  assert.ok(typeof locked.integrity === 'string' && locked.integrity.length > 0 && !locked.link);
  assert.match(locked.resolved, /^https:\/\/registry\.npmjs\.org\//);
  return locked;
};
const withinPackage = (entry, manifestPath) => {
  const relative = path.relative(path.dirname(manifestPath), entry);
  assert.ok(relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative), `Resolved outside package root: ${entry}`);
};
const packageNames = ['@openpresentation/opf', '@openpresentation/opf-render', '@openpresentation/opf-pptx'];
const probe = spawnSync(process.execPath, ['--input-type=module', '-e', `console.log(JSON.stringify(Object.fromEntries(${JSON.stringify(packageNames)}.map(name => [name, import.meta.resolve(name)]))))`], {cwd: consumer, encoding: 'utf8', timeout: 10000, windowsHide: true});
assert.equal(probe.status, 0, probe.error?.message ?? probe.stderr);
const entries = JSON.parse(probe.stdout);
const bindings = {};
for (const [name, version] of [['@openpresentation/opf', '0.11.0'], ['@openpresentation/opf-render', '0.9.0'], ['@openpresentation/opf-pptx', '0.9.1']]) {
  const manifestPath = await withinConsumer(requireConsumer.resolve(name + '/package.json'));
  const manifestBytes = await readFile(manifestPath), manifest = json(manifestBytes);
  assert.equal(manifest.name, name);
  assert.equal(manifest.version, version, `Review a newer accepted train before changing ${name}.`);
  const entry = await withinConsumer(fileURLToPath(entries[name]));
  withinPackage(entry, manifestPath);
  const locked = registryPackage(name, version);
  bindings[name] = {version, manifestPath, manifestSha256: sha(manifestBytes), entry, entrySha256: sha(await readFile(entry)), resolved: locked.resolved, integrity: locked.integrity};
}
const fontRoot = path.dirname(await withinConsumer(requireConsumer.resolve('@expo-google-fonts/carlito/package.json')));
const fontManifestBytes = await readFile(path.join(fontRoot, 'package.json'));
assert.equal(json(fontManifestBytes).name, '@expo-google-fonts/carlito');
assert.equal(json(fontManifestBytes).version, '0.4.1');
const fontLock = registryPackage('@expo-google-fonts/carlito', '0.4.1');
const license = await readFile(path.join(fontRoot, 'LICENSE_FONT'));
assert.equal(sha(license), '58402f82a7c332a700294988fe7554fbb0a63a8d27ccc1ee3bbc640311990a00');
const faces = [
  ['400Regular/Carlito_400Regular.ttf', 'fonts/Carlito-400-normal.ttf', 'ca019755404c45627a8566915df99068949dc32ee2bce48d6aeee7542d2a0a89'],
  ['400Regular_Italic/Carlito_400Regular_Italic.ttf', 'fonts/Carlito-400-italic.ttf', '074cd1b89d53765d90d0ed3b4bfe49523efaaf4f3f430c006bc3233778b0ebb5'],
  ['700Bold/Carlito_700Bold.ttf', 'fonts/Carlito-700-normal.ttf', '51edbfa32d8af939913ae1f4ad0a5173e32083499218c133384638090295f0b0'],
  ['700Bold_Italic/Carlito_700Bold_Italic.ttf', 'fonts/Carlito-700-italic.ttf', '25f5672c1985d168d6bc2973864fc5a7e374bb95fe8d0f91cff47ae17fa67691'],
];
const fonts = [];
for (const [relative, file, expected] of faces) {
  const filePath = await withinConsumer(path.join(fontRoot, relative));
  withinPackage(filePath, path.join(fontRoot, 'package.json'));
  const bytes = await readFile(filePath);
  assert.equal(sha(bytes), expected, file); fonts.push({file, sha256: expected, bytes});
}
const {toPptx} = await import(pathToFileURL(bindings['@openpresentation/opf-pptx'].entry).href);
const {validatePresentation} = await import(pathToFileURL(bindings['@openpresentation/opf'].entry).href);
const source = carlitoOnly ? carlitoOnlySource() : {slides: [{title: 'Plain control', text: 'Current content'}]};
assert.equal(validatePresentation(source).valid, true);
const before = JSON.stringify(source), exported = await toPptx(source, {strictAssets: true});
assert.equal(JSON.stringify(source), before);
let presentation = exported, carlitoFixture = null;
if (carlitoOnly) {
  const transforms = [];
  if (harnessBulletFont) {
    const transformed = applyMasterBulletFontTransform(exported);
    presentation = transformed.bytes;
    transforms.push({...MASTER_BULLET_FONT_TRANSFORM, replacements: transformed.replacements, inputSha256: sha(exported), outputSha256: sha(presentation)});
  }
  const typefaces = typefaceInventory(presentation), themeSlots = themeFontSlots(presentation);
  const {failures, residual} = carlitoOnlyTypefaceFailures(typefaces, themeSlots, {requireCarlitoBullets: harnessBulletFont});
  assert.deepEqual(failures, [], 'Carlito-only fixture contains a non-Carlito text typeface');
  carlitoFixture = {
    variant: harnessBulletFont ? 'carlito-only+harness-master-bullet-font' : 'carlito-only',
    helper: {file: 'test/native-font-embed-fixture-source.mjs', sha256Lf: lfSha(await readFile(fileURLToPath(new URL('./native-font-embed-fixture-source.mjs', import.meta.url))))},
    exporterOutput: {file: harnessBulletFont ? 'exporter-output.pptx' : 'source.pptx', sha256: sha(exported)},
    harnessTransforms: transforms, themeFontSlots: themeSlots, typefaceInventory: typefaces,
    residualNonCarlito: residual.map(({code, row}) => ({code, element: row.element, script: row.script, typeface: row.typeface, parts: row.parts})),
    docPropsFontsUsed: {values: declaredFontsUsed(presentation), note: 'Static PptxGenJS docProps/app.xml metadata; not a text/theme slot and not transformed. PowerPoint rewrites it on save.'},
    scope: 'Static XML inventory of source.pptx. PowerPoint Presentation.Fonts is decided natively and may still report names this inventory cannot predict.',
  };
}
await mkdir(output); await mkdir(path.join(output, 'fonts'));
await writeFile(path.join(output, 'source.pptx'), presentation);
if (harnessBulletFont) await writeFile(path.join(output, 'exporter-output.pptx'), exported);
await writeFile(path.join(output, 'source.opf.json'), JSON.stringify(source, null, 2) + '\n');
await writeFile(path.join(output, 'LICENSE_FONT'), license);
for (const font of fonts) await writeFile(path.join(output, font.file), font.bytes);
const spans = [[1, 10, 18, false, false], [14, 7, 20, true, false], [24, 9, 22, false, true], [36, 13, 24, true, true]].map(([start, length, size, bold, italic]) => ({start, length, size, bold, italic}));
const generation = {
  schemaVersion: 1, kind: 'native-font-edit-fixture', node: process.version,
  generatorSha256: sha(await readFile(fileURLToPath(import.meta.url))), generatorSha256Lf: lfSha(await readFile(fileURLToPath(import.meta.url))), registryLockSha256: sha(lock), bindings,
  bindingScope: 'Manifest and resolved public entry hashes plus registry lock. This does not bind every transitive installed byte.',
  source: {file: 'source.pptx', sha256: sha(presentation)},
  package: {name: '@expo-google-fonts/carlito', version: '0.4.1', manifestSha256: sha(fontManifestBytes), resolved: fontLock.resolved, integrity: fontLock.integrity, link: false},
  license: {file: 'LICENSE_FONT', spdx: 'OFL-1.1', sha256: sha(license)},
  registration: {flags: 0, ownership: 'Surviving parent removes only its successful session additions in finally.'},
  fonts: fonts.map(({file, sha256}) => ({file, sha256})),
  edit: {title: 'Gate E - Carlito', titleFont: 'Carlito', titleSizePoints: 30, titleBold: true, body: 'Regular 18 | Bold 20 | Italic 22 | BoldItalic 24', spans},
  scope: 'Fixture generation only; no font registration, Office call, PDF, embedding or native acceptance.',
  ...(carlitoFixture ? {carlitoOnly: carlitoFixture} : {}),
};
await writeFile(path.join(output, 'generation.json'), JSON.stringify(generation, null, 2) + '\n');
console.log(`Created one registry fixture and four exact licensed Carlito faces in ${output}. No Office or font registration calls.`);
