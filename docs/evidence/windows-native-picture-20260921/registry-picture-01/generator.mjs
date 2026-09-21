import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {readFile, writeFile, mkdir, readdir, realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = async file => JSON.parse((await readFile(file, 'utf8')).replace(/^\uFEFF/, ''));
const writeJson = (file, value) => writeFile(file, JSON.stringify(value, null, 2) + '\n');
const inside = (root, file) => {
  const relative = path.relative(root, file);
  return relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
};
assert.equal(process.versions.node.split('.')[0], '24', 'New native evidence requires Node 24.');
const [command, directory, consumerDirectory] = process.argv.slice(2);
assert.equal(command, 'generate', 'Usage: node test/native-picture.mjs generate NEW_DIRECTORY REGISTRY_CONSUMER');
assert.ok(directory && consumerDirectory);
const output = path.resolve(directory), consumer = await realpath(consumerDirectory);
const resolve = createRequire(path.join(consumer, 'package.json'));
const packageNames = ['@openpresentation/opf', '@openpresentation/opf-render', '@openpresentation/opf-pptx', '@openpresentation/opf-editor'];
const esmProbe = spawnSync(process.execPath, ['--input-type=module', '--eval',
  `console.log(JSON.stringify(Object.fromEntries(${JSON.stringify(packageNames)}.map(name => [name, import.meta.resolve(name)]))))`],
{cwd: consumer, encoding: 'utf8', timeout: 10000, windowsHide: true});
assert.equal(esmProbe.status, 0, esmProbe.error?.message ?? esmProbe.stderr);
const publicEntries = JSON.parse(esmProbe.stdout);
const lockFile = path.join(consumer, 'package-lock.json'), lock = await json(lockFile);
const bindings = {};
for (const name of packageNames) {
  const packageFile = await realpath(resolve.resolve(name + '/package.json'));
  assert.ok(inside(path.join(consumer, 'node_modules'), packageFile), `${name} must resolve inside the registry consumer.`);
  const root = path.dirname(packageFile), pkg = await json(packageFile);
  const locked = lock.packages['node_modules/' + name];
  assert.equal(locked.version, pkg.version);
  assert.match(locked.resolved, /^https:\/\/registry\.npmjs\.org\//);
  assert.ok(locked.integrity && !locked.link);
  const files = {'package.json': sha(await readFile(packageFile))};
  for (const subdirectory of ['dist', ...(name.endsWith('/opf-pptx') ? ['vendor'] : [])]) {
    for (const entry of await readdir(path.join(root, subdirectory), {recursive: true, withFileTypes: true})) {
      if (!entry.isFile()) continue;
      const file = path.join(entry.parentPath, entry.name);
      files[path.relative(root, file).split(path.sep).join('/')] = sha(await readFile(file));
    }
  }
  assert.ok(inside(root, await realpath(fileURLToPath(publicEntries[name]))));
  bindings[name] = {version: pkg.version, packageFile, publicEntry: publicEntries[name], resolved: locked.resolved, integrity: locked.integrity, files};
}
const {validatePresentation} = await import(publicEntries['@openpresentation/opf']);
const {toPptx, fromPptx} = await import(publicEntries['@openpresentation/opf-pptx']);
const {renderSvg, svgToPng} = await import(publicEntries['@openpresentation/opf-render']);
const {unzipSync} = resolve('fflate');
const {XMLParser, XMLValidator} = resolve('fast-xml-parser');
const parser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: false, trimValues: false});
const array = value => value === undefined ? [] : Array.isArray(value) ? value : [value];
const imageFile = fileURLToPath(new URL('fixtures/images/wide.png', import.meta.url));
const image = await readFile(imageFile);
const source = {design: {dimensions: {widthInches: 40 / 3, heightInches: 7.5}, imageFill: 'fit'}, slides: [{image: {src: 'data:image/png;base64,' + image.toString('base64'), alt: 'Four quadrants and a circle'}}]};
const before = structuredClone(source);
assert.equal(validatePresentation(source).valid, true);
const bytes = await toPptx(source, {strictAssets: true});
assert.deepEqual(source, before);
const entries = unzipSync(bytes), archive = {xmlParts: 0, internalRelationships: 0, contentTypeOverrides: 0};
for (const name of Object.keys(entries).filter(name => /\.(?:xml|rels)$/.test(name))) {
  const xml = new TextDecoder().decode(entries[name]);
  assert.equal(XMLValidator.validate(xml), true, name);
  archive.xmlParts++;
  if (!name.endsWith('.rels')) continue;
  const base = name === '_rels/.rels' ? '' : path.posix.dirname(path.posix.dirname(name));
  const ids = new Set();
  for (const rel of array(parser.parse(xml).Relationships?.Relationship)) {
    assert.ok(!ids.has(rel.Id), `${name}: duplicate relationship ${rel.Id}`);
    ids.add(rel.Id);
    if (rel.TargetMode === 'External') continue;
    const target = decodeURIComponent(rel.Target.split('#')[0]);
    const normalized = path.posix.normalize(target.startsWith('/') ? target.slice(1) : path.posix.join(base, target));
    assert.ok(Object.hasOwn(entries, normalized), `${name}: missing target ${normalized}`);
    archive.internalRelationships++;
  }
}
for (const override of array(parser.parse(new TextDecoder().decode(entries['[Content_Types].xml'])).Types.Override)) {
  assert.ok(Object.hasOwn(entries, decodeURIComponent(override.PartName.slice(1))));
  archive.contentTypeOverrides++;
}
const slide = parser.parse(new TextDecoder().decode(entries['ppt/slides/slide1.xml']))['p:sld'];
const pictures = array(slide['p:cSld']['p:spTree']['p:pic']);
assert.equal(pictures.length, 1);
const picture = pictures[0], transform = picture['p:spPr']['a:xfrm'];
const geometryPt = {left: Number(transform['a:off'].x) / 12700, top: Number(transform['a:off'].y) / 12700, width: Number(transform['a:ext'].cx) / 12700, height: Number(transform['a:ext'].cy) / 12700};
const media = Object.entries(entries).filter(([name]) => name.startsWith('ppt/media/') && !name.endsWith('/'));
assert.equal(media.length, 1);
assert.equal(sha(media[0][1]), sha(image));
const diagnostics = [], imported = await fromPptx(bytes, {onDiagnostic: item => diagnostics.push(item)});
const importedPictures = imported.slides[0].blocks.filter(block => block.image).map(block => block.image);
assert.equal(importedPictures.length, 1);
assert.equal(importedPictures[0].alt, source.slides[0].image.alt);
assert.equal(sha(Buffer.from(importedPictures[0].src.split(',')[1], 'base64')), sha(image));
assert.equal(diagnostics.length, 0);
const svg = renderSvg(source), png = await svgToPng(svg, {loadSystemFonts: false, useBundledFonts: false});
await mkdir(output, {recursive: false});
await writeFile(path.join(output, 'source.png'), image);
await writeJson(path.join(output, 'source.opf.json'), source);
await writeFile(path.join(output, 'image-only.pptx'), bytes);
await writeFile(path.join(output, 'preview.svg'), svg);
await writeFile(path.join(output, 'preview.png'), png);
await writeJson(path.join(output, 'portable-import.json'), imported);
await writeJson(path.join(output, 'generation.json'), {
  scope: 'One PNG exported by public APIs from a separate registry consumer. Archive/XML and controlled semantic checks only; no native Office acceptance.',
  node: process.version, executable: process.execPath, consumer, bindings,
  lockSha256: sha(await readFile(lockFile)), verifierSha256: sha(await readFile(fileURLToPath(import.meta.url))),
  inputImage: {path: imageFile, sha256: sha(image)}, sourceSha256: sha(JSON.stringify(source)),
  pptxSha256: sha(bytes), previewSha256: sha(png), geometryPt, expectedAlt: source.slides[0].image.alt, archive,
});
console.log(`Registry picture fixture generated: ${output}. No native Office claim.`);
