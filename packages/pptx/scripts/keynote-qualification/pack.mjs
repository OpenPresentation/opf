import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {lstat, mkdir, readFile, readdir, realpath, writeFile, copyFile, constants} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {sourceDeck, bodyDeck, routes, qualificationRoutes, outcomeTemplate, fixtureFontPolicy} from './fixtures.mjs';
import {verifyRegistryRuntime} from './registry-runtime.mjs';

const repository = fileURLToPath(new URL('../../', import.meta.url));
const json = value => Buffer.from(JSON.stringify(value, null, 2) + '\n');
export const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const array = value => value === undefined ? [] : Array.isArray(value) ? value : [value];
const inside = (root, file) => {const relative = path.relative(root, file); return relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);};
const safe = value => typeof value === 'string' && !path.isAbsolute(value) && value.split(/[/\\]/).every(part => part && part !== '.' && part !== '..');

async function fresh(output, excluded = []) {
  const target = path.resolve(output), parent = await realpath(path.dirname(target));
  assert.equal(parent, path.dirname(target), 'Output parent must be canonical');
  for (const root of [await realpath(repository), ...excluded]) assert.ok(!inside(root, target), 'Output must be outside source and installed consumer');
  await mkdir(target); // Existing attempts, including failures, are immutable.
  return target;
}

async function tree(directory, relative = '') {
  const result = [];
  for (const entry of await readdir(path.join(directory, relative), {withFileTypes: true})) {
    const name = path.posix.join(relative, entry.name);
    assert.ok(!entry.isSymbolicLink(), `Sealed files cannot be symlinks: ${name}`);
    if (entry.isDirectory()) result.push(...await tree(directory, name));
    else if (entry.isFile()) {const bytes = await readFile(path.join(directory, name)); result.push({path: name, bytes: bytes.length, sha256: hash(bytes)});}
  }
  return result.sort((a, b) => a.path.localeCompare(b.path, 'en'));
}

async function verifyFileSeal(suiteDirectory, kind) {
  const root = await realpath(suiteDirectory), suite = JSON.parse(await readFile(path.join(root, 'suite.json')));
  assert.equal(suite.schemaVersion, 1); assert.equal(suite.kind, kind);
  for (const file of suite.files) {
    assert.ok(safe(file.path), 'Unsafe sealed file path');
    const absolute = path.join(root, file.path);
    assert.ok((await lstat(absolute)).isFile() && !(await lstat(absolute)).isSymbolicLink(), 'Sealed input must be a regular file');
    assert.ok(inside(root, await realpath(absolute)), 'Sealed input escapes suite');
    const bytes = await readFile(absolute);
    assert.equal(bytes.length, file.bytes, `${file.path}: bytes`); assert.equal(hash(bytes), file.sha256, `${file.path}: sha256`);
  }
  assert.equal(new Set(suite.files.map(file => file.path)).size, suite.files.length, 'Duplicate sealed file');
  const actual = (await tree(root)).filter(file => file.path !== 'suite.json');
  assert.deepEqual(actual, suite.files, 'Suite has missing, extra or changed files');
  return {root, suite};
}
export const verifySeal = directory => verifyFileSeal(directory, 'keynote-qualification');
export const verifyFooterControls = directory => verifyFileSeal(directory, 'keynote-footer-binding-controls');

export async function installed(consumerDirectory) {
  const consumer = await realpath(consumerDirectory), require = createRequire(path.join(consumer, 'package.json'));
  const packages = [];
  for (const name of ['opf', 'opf-render', 'opf-pptx', 'gallery'].map(value => '@openpresentation/' + value)) {
    const manifest = await realpath(require.resolve(name + '/package.json')), directory = path.dirname(manifest);
    assert.ok(inside(path.join(consumer, 'node_modules'), directory), `${name} must be inside the selected installed consumer`);
    const pkg = JSON.parse(await readFile(manifest)); assert.equal(pkg.name, name);
    const files = name.endsWith('/gallery') ? [] : [{path: 'package.json', bytes: (await readFile(manifest)).length, sha256: hash(await readFile(manifest))}];
    // Gallery ships catalog source rather than dist. Bind its complete package payload too.
    files.push(...await tree(directory, name.endsWith('/gallery') ? '' : 'dist'));
    if (name.endsWith('/opf-pptx')) files.push(...await tree(directory, 'vendor'));
    packages.push({name, version: pkg.version, directory, files, sha256: hash(json(files))});
  }
  for (const pkg of packages.filter(pkg => !pkg.name.endsWith('/gallery'))) {
    const local = createRequire(path.join(pkg.directory, 'package.json'));
    for (const name of ['@openpresentation/opf', '@openpresentation/gallery']) {
      if (name === pkg.name) continue;
      assert.equal(await realpath(path.dirname(local.resolve(name + '/package.json'))), packages.find(pkg => pkg.name === name).directory, `${pkg.name} resolves another ${name}`);
    }
  }
  const load = name => import(pathToFileURL(require.resolve(name)).href);
  const [core, pptx, render, fonts, gallery] = await Promise.all(['@openpresentation/opf', '@openpresentation/opf-pptx', '@openpresentation/opf-render', '@openpresentation/opf-render/fonts-node', '@openpresentation/gallery'].map(load));
  const pptxRequire = createRequire(require.resolve('@openpresentation/opf-pptx/package.json'));
  return {consumer, packages, core, pptx, render, fonts, gallery: gallery.gallery, fflate: pptxRequire('fflate'), xml: pptxRequire('fast-xml-parser')};
}

const candidatePins = {'@openpresentation/opf': '0.20.3', '@openpresentation/opf-render': '0.20.2', '@openpresentation/gallery': '3.0.0'};
const packageIdentity = packages => packages.map(({name, version, files, sha256}) => ({name, version, files, sha256}));
const sha512 = bytes => 'sha512-' + createHash('sha512').update(bytes).digest('base64');

/** Bind an ordinary npm-packed, normally installed candidate to a clean Git revision. */
export async function sealCandidate({source, revision, tarball, consumer, output}) {
  assert.match(revision, /^[0-9a-f]{40}$/, 'Candidate revision must be an exact Git commit');
  const checkout = await realpath(source), git = args => execFileSync('git', args, {cwd: checkout, stdio: 'pipe', maxBuffer: 16 * 1024 * 1024});
  assert.equal(git(['rev-parse', 'HEAD']).toString().trim(), revision);
  assert.equal(git(['status', '--porcelain']).toString().trim(), '', 'Candidate source must be clean');
  const engine = await installed(consumer), pkg = engine.packages.find(pkg => pkg.name === '@openpresentation/opf-pptx');
  for (const installedPackage of engine.packages) {
    const directory = path.join(engine.consumer, 'node_modules', installedPackage.name);
    assert.ok((await lstat(directory)).isDirectory() && !(await lstat(directory)).isSymbolicLink(), 'Candidate packages must be normal installs, never links');
    assert.equal(await realpath(directory), installedPackage.directory);
  }
  for (const file of pkg.files) assert.deepEqual(await readFile(path.join(pkg.directory, file.path)), git(['show', `${revision}:${file.path}`]), `Installed candidate differs from Git: ${file.path}`);
  for (const [name, version] of Object.entries(candidatePins)) assert.equal(engine.packages.find(pkg => pkg.name === name).version, version, `${name}: controlled registry version`);
  const manifest = JSON.parse(await readFile(path.join(engine.consumer, 'package.json'))), lockBytes = await readFile(path.join(engine.consumer, 'package-lock.json')), lock = JSON.parse(lockBytes);
  for (const [name, version] of Object.entries(candidatePins)) assert.equal(manifest.dependencies[name], version, `${name}: exact consumer pin`);
  const renderPackage = engine.packages.find(pkg => pkg.name === '@openpresentation/opf-render');
  const renderer = JSON.parse(await readFile(path.join(renderPackage.directory, 'package.json'))), require = createRequire(path.join(engine.consumer, 'package.json'));
  const fontPeers = Object.fromEntries(Object.entries(renderer.peerDependencies).filter(([name]) => name.startsWith('@expo-google-fonts/')));
  for (const [name, version] of Object.entries(fontPeers)) {
    assert.equal(manifest.dependencies[name], version, `${name}: pin the renderer's declared font peer`);
    const peer = await realpath(require.resolve(name + '/package.json'));
    assert.ok(inside(path.join(engine.consumer, 'node_modules'), peer), `${name}: font peer must be normally installed`);
    assert.equal(JSON.parse(await readFile(peer)).version, version);
  }
  const packed = await readFile(tarball), integrity = sha512(packed), lockPackage = lock.packages['node_modules/@openpresentation/opf-pptx'];
  assert.equal(lockPackage.integrity, integrity, 'Lockfile does not identify this npm tarball');
  assert.ok(lockPackage.resolved?.startsWith('file:') && !lockPackage.link, 'Candidate must be a normal file-tarball install, never a link');
  const receipt = {schemaVersion: 1, kind: 'local-pptx-source-candidate', registryAcceptance: false, nativeAcceptance: false,
    source: {directory: checkout, revision, clean: true}, tarball: {file: await realpath(tarball), bytes: packed.length, sha256: hash(packed), integrity},
    consumer: {directory: engine.consumer, manifestSha256: hash(json(manifest)), lockSha256: hash(lockBytes)}, fontPeers, packages: packageIdentity(engine.packages)};
  const target = path.resolve(output); assert.equal(await realpath(path.dirname(target)), path.dirname(target), 'Receipt parent must be canonical');
  assert.ok(!inside(checkout, target) && !inside(engine.consumer, target), 'Receipt must be outside candidate source and consumer');
  await writeFile(target, json(receipt), {flag: 'wx'}); return receipt;
}

export async function verifyCandidate(file, engine) {
  assert.ok(file, 'Native mode requires --candidate receipt; a public exporter may silently ignore bodyText');
  const receipt = JSON.parse(await readFile(file));
  assert.equal(receipt.schemaVersion, 1); assert.equal(receipt.kind, 'local-pptx-source-candidate');
  assert.equal(receipt.registryAcceptance, false); assert.equal(receipt.nativeAcceptance, false); assert.equal(receipt.source.clean, true); assert.match(receipt.source.revision, /^[0-9a-f]{40}$/);
  const packed = await readFile(receipt.tarball.file);
  assert.equal(packed.length, receipt.tarball.bytes); assert.equal(hash(packed), receipt.tarball.sha256); assert.equal(sha512(packed), receipt.tarball.integrity);
  assert.equal(engine.consumer, receipt.consumer.directory, 'Candidate receipt belongs to another consumer');
  assert.equal(hash(await readFile(path.join(engine.consumer, 'package-lock.json'))), receipt.consumer.lockSha256, 'Candidate lockfile changed');
  assert.equal(hash(json(JSON.parse(await readFile(path.join(engine.consumer, 'package.json'))))), receipt.consumer.manifestSha256, 'Candidate consumer pins changed');
  assert.deepEqual(packageIdentity(engine.packages), receipt.packages, 'Installed runtime differs from the sealed source candidate');
  return receipt;
}

/** Actual bodies, not option echoes or metadata, establish prototype capability. */
export function bodyCapability(inspection, source, diagnostics, mode) {
  assert.ok(['measured', 'native'].includes(mode), 'Unknown body mode');
  const required = ['K02', 'K03', 'K05', 'K07', 'K17'], result = [];
  for (const marker of required) {
    const slide = inspection.slides.find(slide => slide.marker === marker), authored = source.slides.find(slide => slide.title.startsWith(marker));
    assert.ok(slide && authored, `${marker}: body control missing`);
    const bodies = slide.shapes.filter(shape => shape.placeholder?.type === 'body');
    if (mode === 'measured') { assert.equal(bodies.length, 0, `${marker}: measured mode must retain measured shapes`); continue; }
    assert.equal(bodies.length, 1, `${marker}: native mode requires one actual Body placeholder; exporter may have ignored bodyText`);
    const [body] = bodies;
    assert.match(body.name, /^OPF native body /, `${marker}: whole-body object identity`);
    assert.equal(body.bodyProperties.wrap, 'square'); assert.ok(Object.hasOwn(body.bodyProperties, 'a:noAutofit'));
    const value = marker === 'K07' ? authored.blocks[0].text : authored.text ?? authored.items;
    const expected = Array.isArray(value) && marker === 'K17' ? value.map(inlineText).join('') : inlineText(value).replace(/\r\n|\r|\n/g, '');
    assert.equal(body.text.join(''), expected, `${marker}: body must hold all current source characters`);
    const paragraphs = marker === 'K17' ? authored.items.length : inlineText(value).split(/\r\n|\r|\n/).length;
    assert.equal(body.paragraphs, paragraphs, `${marker}: authored paragraphs only, no per-line bodies`);
    if (marker === 'K17') assert.ok(body.paragraphProperties?.length === paragraphs && body.paragraphProperties.every(properties => properties?.['a:buChar']?.char && Number(properties.lvl ?? 0) === 0 && !properties['a:buNone'] && !properties['a:buAutoNum']), 'K17: every authored item must be a real flat character bullet');
    result.push({marker, placeholder: body.placeholder, paragraphs: body.paragraphs, wholeSourceText: true});
  }
  for (const [marker, reason] of [['K04', 'unsupported-list'], ['K06', 'multi-column']]) {
    const index = source.slides.findIndex(slide => slide.title.startsWith(marker));
    assert.ok(!inspection.slides[index].shapes.some(shape => shape.placeholder?.type === 'body'), `${marker}: complex case must retain measured shapes`);
    if (mode === 'native') assert.ok(diagnostics.some(diagnostic => diagnostic.code === 'native-body-fallback' && diagnostic.reason === reason && diagnostic.path.startsWith(`slides.${index}.`)), `${marker}: missing ${reason} fallback`);
  }
  return {mode, controls: result, expectedMeasuredFallbacks: ['K04', 'K06'], nativeAcceptance: false};
}

const deep = (node, key) => {
  if (!node || typeof node !== 'object') return [];
  return Object.entries(node).flatMap(([name, value]) => name === key ? array(value) : array(value).flatMap(child => deep(child, key)));
};
const texts = node => deep(node, 'a:t').map(value => typeof value === 'object' ? value['#text'] ?? '' : String(value));

// Keep XML paragraph/run order. Field caches are display values, not authored words.
const orderedNodes = (entries, tag) => array(entries).flatMap(entry => !entry || typeof entry !== 'object' ? [] : Object.entries(entry).flatMap(([name, children]) => name === tag ? [entry] : name === ':@' ? [] : orderedNodes(children, tag)));
const orderedWords = entries => array(entries).map(entry => {
  if (!entry || typeof entry !== 'object') return '';
  if (Object.hasOwn(entry, 'a:fld')) return '';
  if (Object.hasOwn(entry, '#text')) return String(entry['#text']);
  if (Object.hasOwn(entry, 'a:br')) return '\n';
  return Object.entries(entry).filter(([name]) => name !== ':@').map(([, children]) => orderedWords(children)).join('');
}).join('');
const fieldCounts = entries => {
  const result = {};
  for (const entry of orderedNodes(entries, 'a:fld')) {const type = entry[':@']?.type ?? '(missing type)'; result[type] = (result[type] ?? 0) + 1;}
  return result;
};
export function textSemantics(entries) {
  const objects = [];
  const visit = entries => {
    for (const entry of array(entries)) {
      if (!entry || typeof entry !== 'object') continue;
      const tag = ['p:sp', 'p:graphicFrame', 'p:pic'].find(tag => Object.hasOwn(entry, tag));
      if (tag) {
        const children = entry[tag];
        objects.push({kind: tag, name: orderedNodes(children, 'p:cNvPr')[0]?.[':@']?.name ?? null,
          placeholderRole: orderedNodes(children, 'p:ph')[0]?.[':@']?.type ?? null,
          paragraphs: orderedNodes(children, 'a:p').map(paragraph => orderedWords(paragraph['a:p'])), fields: fieldCounts(children)});
      } else if (Object.hasOwn(entry, 'a:p')) objects.push({kind: 'a:p', name: null, placeholderRole: null, paragraphs: [orderedWords(entry['a:p'])], fields: fieldCounts(entry['a:p'])});
      else for (const [name, children] of Object.entries(entry)) if (name !== ':@') visit(children);
    }
  };
  visit(entries); return {objects, fields: fieldCounts(entries)};
}

const furnitureRoles = new Set(['ftr', 'hdr', 'dt', 'sldNum']);
const normalizedWords = paragraphs => paragraphs.join('\n').replace(/\s+/g, ' ').trim();
const furnitureKey = object => object.name ?? `placeholder:${object.placeholderRole}`;
export function compareNoopText(actual, baseline, label) {
  assert.ok(actual && baseline, 'No-op comparison requires semantic XML inventories');
  const knownFurniture = new Set(baseline.objects.filter(object => furnitureRoles.has(object.placeholderRole)).map(furnitureKey));
  const isFurniture = object => furnitureRoles.has(object.placeholderRole) || knownFurniture.has(furnitureKey(object));
  const body = inventory => normalizedWords(inventory.objects.filter(object => !isFurniture(object)).flatMap(object => object.paragraphs));
  const literal = inventory => inventory.objects.filter(isFurniture).map(object => ({identity: furnitureKey(object), text: normalizedWords(object.paragraphs)})).filter(object => object.text);
  const failures = [];
  if (body(actual) !== body(baseline)) failures.push(`${label}: no-op ordered authored text changed`);
  const before = literal(baseline), after = literal(actual);
  // Furniture paint order may change; object identity, multiplicity and literal words must not.
  const identities = new Set([...before, ...after].map(object => object.identity));
  for (const identity of identities) if (!isDeepStrictEqual(after.filter(object => object.identity === identity), before.filter(object => object.identity === identity))) failures.push(`${label}: no-op literal furniture changed (${identity})`);
  if (!isDeepStrictEqual(actual.fields, baseline.fields)) failures.push(`${label}: no-op dynamic field types/counts changed`);
  return failures;
}

export function inspectArchive(bytes, engine) {
  const parts = engine.fflate.unzipSync(bytes), {XMLParser, XMLValidator} = engine.xml;
  const parser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: false, trimValues: false});
  const orderedParser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: false, trimValues: false, preserveOrder: true});
  const xml = name => {assert.ok(parts[name], `Missing part: ${name}`); const value = engine.fflate.strFromU8(parts[name]); assert.equal(XMLValidator.validate(value), true, `Invalid XML: ${name}`); return parser.parse(value);};
  const semantics = name => textSemantics(orderedParser.parse(engine.fflate.strFromU8(parts[name])));
  const relations = source => {
    const file = path.posix.join(path.posix.dirname(source), '_rels', path.posix.basename(source) + '.rels');
    if (!parts[file]) return [];
    return array(xml(file).Relationships?.Relationship).map(rel => {
      const target = decodeURIComponent(rel.Target.split('#')[0]);
      return {...rel, part: rel.TargetMode === 'External' ? null : path.posix.normalize(target.startsWith('/') ? target.slice(1) : path.posix.join(path.posix.dirname(source), target))};
    });
  };
  for (const name of Object.keys(parts).filter(name => /\.(xml|rels)$/.test(name))) xml(name);
  for (const name of Object.keys(parts).filter(name => name.endsWith('.rels'))) {
    const source = name === '_rels/.rels' ? '' : path.posix.join(path.posix.dirname(path.posix.dirname(name)), path.posix.basename(name, '.rels'));
    const ids = new Set();
    for (const rel of relations(source)) {assert.ok(!ids.has(rel.Id), `Duplicate relationship: ${name}/${rel.Id}`); ids.add(rel.Id); if (rel.part) assert.ok(parts[rel.part], `Missing relationship target: ${rel.part}`);}
  }
  const presentation = xml('ppt/presentation.xml')['p:presentation'], rels = relations('ppt/presentation.xml');
  const slides = array(presentation['p:sldIdLst']?.['p:sldId']).map((entry, index) => {
    const file = rels.find(rel => rel.Id === entry['r:id'])?.part; assert.ok(file);
    const content = xml(file), links = relations(file), text = texts(content);
    const shapes = deep(content, 'p:sp').map(shape => ({name: shape['p:nvSpPr']?.['p:cNvPr']?.name, placeholder: shape['p:nvSpPr']?.['p:nvPr']?.['p:ph'] ?? null, text: texts(shape), paragraphs: array(shape['p:txBody']?.['a:p']).length, paragraphProperties: array(shape['p:txBody']?.['a:p']).map(paragraph => paragraph['a:pPr'] ?? null), bodyProperties: shape['p:txBody']?.['a:bodyPr'] ?? null, geometryEmu: shape['p:spPr']?.['a:xfrm'] ?? null, explicitLatinTypefaces: [...new Set(deep(shape, 'a:latin').map(value => value.typeface))], explicitSizesHundredthsPt: [...new Set([...deep(shape, 'a:rPr'), ...deep(shape, 'a:defRPr')].map(value => value.sz).filter(value => value !== undefined).map(Number))]}));
    const points = cache => array(cache?.['c:pt']).toSorted((a, b) => Number(a.idx) - Number(b.idx)).map(point => String(point['c:v']));
    const charts = deep(content, 'c:chart').map(chart => {
      const part = links.find(rel => rel.Id === chart['r:id'])?.part; assert.ok(part); const cache = xml(part);
      const series = deep(cache, 'c:ser').map(item => {
        const tx = item['c:tx'], cat = item['c:cat'], val = item['c:val'];
        const categories = points(cat?.['c:strRef']?.['c:strCache'] ?? cat?.['c:strLit'] ?? cat?.['c:numRef']?.['c:numCache'] ?? array(cat?.['c:multiLvlStrRef']?.['c:multiLvlStrCache']?.['c:lvl'])[0]);
        return {name: String(tx?.['c:v'] ?? points(tx?.['c:strRef']?.['c:strCache'])[0] ?? ''), categories, values: points(val?.['c:numRef']?.['c:numCache'] ?? val?.['c:numLit']).map(Number)};
      });
      return {part, series, values: deep(cache, 'c:numCache').flatMap(node => points(node).map(Number)), explicitColors: deep(cache, 'a:srgbClr').map(value => value.val)};
    });
    const notes = links.find(rel => rel.Type.endsWith('/notesSlide'))?.part;
    const pictures = deep(content, 'p:pic').map(picture => {const blip = deep(picture, 'a:blip')[0], part = links.find(rel => rel.Id === blip?.['r:embed'])?.part; return {part, sha256: part ? hash(parts[part]) : null, crop: deep(picture, 'a:srcRect')};});
    return {number: index + 1, part: file, text, marker: text.join(' ').match(/\bK\d{2}\b/)?.[0] ?? null, shapes, pictures, charts, tables: deep(content, 'a:tbl').map(table => ({rows: array(table['a:tr']).map(row => array(row['a:tc']).map(texts))})), notes: notes ? texts(xml(notes)) : [], textSemantics: semantics(file), notesSemantics: notes ? semantics(notes) : {objects: [], fields: {}}};
  });
  const layouts = Object.keys(parts).filter(name => /^ppt\/(?:slideLayouts|slideMasters)\/[^/]+\.xml$/.test(name)).sort().map(part => ({part, placeholders: deep(xml(part), 'p:ph')}));
  return {slides, layouts, nativeChartCount: slides.reduce((count, slide) => count + slide.charts.length, 0), nativeTableCount: slides.reduce((count, slide) => count + slide.tables.length, 0), archiveParts: Object.keys(parts).length};
}

export async function generate({consumer, output, mode, candidate, registry, 'registry-sha256': registrySha256}) {
  assert.equal(process.versions.node.split('.')[0], '24', 'Qualification requires Node 24');
  assert.ok(mode === undefined || ['measured', 'native'].includes(mode), 'Mode must be measured or native');
  assert.ok(!candidate || mode, 'A candidate receipt requires an explicit measured/native mode');
  assert.ok(!(candidate && registry), 'Candidate and registry identities are mutually exclusive');
  assert.equal(Boolean(registry), Boolean(registrySha256), 'Registry identity requires its independently accepted digest');
  const registryRuntime = registry ? await verifyRegistryRuntime({registry, 'registry-sha256': registrySha256, consumer}) : undefined;
  const bodyFixture = mode !== undefined, definitions = qualificationRoutes(bodyFixture);
  const engine = await installed(consumer), receipt = candidate || (mode === 'native' && !registryRuntime) ? await verifyCandidate(candidate, engine) : undefined;
  const root = await fresh(output, [engine.consumer]);
  const put = async (name, bytes) => {assert.ok(safe(name)); await mkdir(path.dirname(path.join(root, name)), {recursive: true}); await writeFile(path.join(root, name), bytes, {flag: 'wx'});};
  const image = await readFile(new URL('../../test/fixtures/images/wide.png', import.meta.url)), replacement = await readFile(new URL('../../test/fixtures/images/square.png', import.meta.url));
  const source = (bodyFixture ? bodyDeck : sourceDeck)('data:image/png;base64,' + image.toString('base64')), before = structuredClone(source);
  const validation = engine.core.validate(source, {catalogs: [engine.gallery], only: ['format', 'references']}); assert.ok(validation.valid, JSON.stringify(validation.findings));
  const diagnostics = [], fonts = await engine.fonts.loadFonts({pack: 'office'});
  await fonts.ensure(source, {renderOptions: {catalogs: [engine.gallery]}, onDiagnostic: value => diagnostics.push(value)});
  const previewFaces = [400, 700].flatMap(fontWeight => [false, true].map(italic => fonts.registry.resolveFont({fontFamily: fixtureFontPolicy.selected, fontWeight, italic})));
  assert.ok(previewFaces.every(face => face.requestedFamily === 'Arial' && face.resolvedFamily === 'Arimo'), 'Selected Arial must use the normal licensed Arimo preview alias for all four styles');
  const options = {catalogs: [engine.gallery], fonts, seed: 86, timestamp: '2026-10-15T00:00:00Z', zipDate: '2026-10-15T00:00:00Z', date: '2026-10-15', provenance: 'full', strictAssets: true, ...(mode ? {bodyText: mode} : {})};
  const bytes = await engine.pptx.toPptx(source, {...options, onDiagnostic: value => diagnostics.push(value)});
  assert.deepEqual(source, before); assert.deepEqual(bytes, await engine.pptx.toPptx(source, options), 'Nondeterministic export');
  const inspection = inspectArchive(bytes, engine); assert.equal(inspection.slides.length, bodyFixture ? 17 : 16); assert.equal(inspection.nativeChartCount, 2); assert.equal(inspection.nativeTableCount, 2);
  const capability = bodyFixture ? bodyCapability(inspection, source, diagnostics, mode) : undefined;
  const nativeLatinTypefaces = [...new Set(inspection.slides.flatMap(slide => slide.shapes.flatMap(shape => shape.explicitLatinTypefaces)))].sort();
  assert.ok(nativeLatinTypefaces.includes('Arial'), 'Native XML must retain selected Arial');
  assert.ok(!nativeLatinTypefaces.includes('Arimo'), 'Preview alias must not replace selected Arial in native XML');
  const importDiagnostics = [], imported = await engine.pptx.fromPptx(bytes, {catalogs: [engine.gallery], onDiagnostic: value => importDiagnostics.push(value)});
  await put('sources/deck.opf.json', json(source)); await put('inputs/deck.pptx', bytes);
  await put('assets/replacement.png', replacement); await put('assets/original.png', image);
  await put('inspection/source-archive.json', json(inspection));
  await put('inspection/source-import.json', json({document: imported, diagnostics: importDiagnostics, roundTripEqual: isDeepStrictEqual(source, imported), nativeAcceptance: false}));
  await put('inspection/validation.json', json({validation, diagnostics})); await put('actions/routes.json', json(definitions));
  if (capability) await put('inspection/body-capability.json', json(capability));
  if (receipt) await put('inspection/candidate.json', json(receipt));
  if (registryRuntime) await put('inspection/registry-runtime.json', json(registryRuntime));
  for (const route of Object.keys(definitions)) await put(`actions/${route}.result-template.json`, json(outcomeTemplate(route, bodyFixture)));
  for (let index = 0; index < source.slides.length; index++) await put(`previews/slide-${String(index + 1).padStart(2, '0')}.svg`, engine.render.toSvg(source, index + 1, options));
  const fontFiles = await Promise.all(fonts.fontFiles.map(async file => {const data = await readFile(file); return {file, bytes: data.length, sha256: hash(data)};}));
  const git = args => execFileSync('git', args, {cwd: repository, encoding: 'utf8', stdio: 'pipe'}).trim();
  const sourceFiles = ['scripts/keynote-qualification/fixtures.mjs', 'scripts/keynote-qualification/pack.mjs', 'scripts/keynote-qualification/cli.mjs', 'scripts/keynote-qualification/candidate-consumer.json', 'docs/keynote-qualification.md', 'test/keynote-qualification.mjs', 'test/fixtures/images/README.md', 'test/fixtures/images/wide.png', 'test/fixtures/images/square.png'];
  sourceFiles.push('scripts/keynote-qualification/registry-runtime.mjs');
  const suite = {schemaVersion: 1, kind: 'keynote-qualification', fixture: bodyFixture ? 'body-17' : 'baseline-16', mode: mode ?? 'baseline', nativeAcceptance: false, registryAcceptance: false, ...(registryRuntime ? {registryRuntime: {receiptSha256: registryRuntime.receiptSha256, scope: registryRuntime.claim}} : {}), runtime: {node: process.version, consumer: engine.consumer, packages: engine.packages}, source: {revision: git(['rev-parse', 'HEAD']), dirty: git(['status', '--porcelain']) !== '', files: await Promise.all(sourceFiles.map(async file => ({path: file, sha256: hash(await readFile(path.join(repository, file)))})))}, exportOptions: {...options, fonts: 'one prepared office handle', catalogs: ['installed @openpresentation/gallery']}, fonts: {manifestSha256: hash(json(fonts.manifest)), files: fontFiles, policy: fixtureFontPolicy, previewFaces, nativeLatinTypefaces, nativePhysicalFace: 'unobserved; supervisor verifies in Keynote', installedByGenerator: false}, directions: Object.keys(outcomeTemplate('no-op').directions), files: await tree(root)};
  await put('suite.json', json(suite)); await verifySeal(root); return suite;
}

export async function prepareCopy({suite: directory, route, output}) {
  const {root, suite} = await verifySeal(directory), bodyFixture = suite.fixture === 'body-17', definitions = qualificationRoutes(bodyFixture); assert.ok(Object.hasOwn(definitions, route), 'Unknown route');
  const target = await fresh(output, [root]);
  await copyFile(path.join(root, 'inputs/deck.pptx'), path.join(target, 'editable.pptx'), constants.COPYFILE_EXCL);
  await writeFile(path.join(target, 'result.json'), json(outcomeTemplate(route, bodyFixture)), {flag: 'wx'});
  await writeFile(path.join(target, 'attempt.json'), json({route, mode: suite.mode ?? 'baseline', fixture: suite.fixture ?? 'baseline-16', suite: root, suiteSha256: hash(await readFile(path.join(root, 'suite.json'))), originalSha256: hash(await readFile(path.join(root, 'inputs/deck.pptx'))), inputSha256: hash(await readFile(path.join(target, 'editable.pptx'))), instructions: definitions[route], nativeAcceptance: false}), {flag: 'wx'});
  return target;
}

/** Prove the one-variable change at uncompressed part bytes, independently of ZIP recompression. */
export function verifyFooterPartChanges(before, after, removals) {
  assert.deepEqual(Object.keys(after).sort(), Object.keys(before).sort(), 'Footer control part inventory changed');
  assert.equal(removals.length, 16, 'Footer control requires exactly sixteen token removals');
  assert.equal(new Set(removals.map(item => item.part)).size, 16, 'Exactly one literal footer binding per slide is required');
  const proof = [];
  for (const part of Object.keys(before).sort()) {
    const removal = removals.find(item => item.part === part);
    if (removal) {
      assert.match(part, /^ppt\/slides\/slide\d+\.xml$/);
      assert.match(removal.shapeName, /^OPF furniture \d+ part 0 line 0$/);
      assert.match(removal.token, /^<p:ph\b[^>]*\btype="ftr"[^>]*\/>$/);
      const original = new TextDecoder('utf-8', {fatal: true}).decode(before[part]);
      assert.ok([...original.matchAll(/<p:sp\b[^>]*>[\s\S]*?<\/p:sp>/g)].some(match => match[0].includes(`name="${removal.shapeName}"`) && match[0].includes(removal.token)), `${part}: token is not attached to the exact footer object`);
      assert.equal(original.split(removal.token).length - 1, 1, `${part}: target token must be unique`);
      assert.deepEqual(Buffer.from(after[part]), Buffer.from(original.replace(removal.token, '')), `${part}: bytes beyond the one footer token changed`);
    } else assert.deepEqual(Buffer.from(after[part]), Buffer.from(before[part]), `${part}: non-target part changed`);
    proof.push({part, changed: Boolean(removal), before: {bytes: before[part].length, sha256: hash(before[part])}, after: {bytes: after[part].length, sha256: hash(after[part])}, ...(removal ? {removed: removal} : {})});
  }
  assert.equal(proof.filter(item => item.changed).length, 16);
  return proof;
}

export function footerControlVariant(bytes, engine, {literal}) {
  assert.ok(typeof literal === 'string' && literal.trim() && !/[\r\n]|\{\{/.test(literal), 'The control requires one literal footer line');
  const original = inspectArchive(bytes, engine), before = engine.fflate.unzipSync(bytes), after = {...before}, removals = [];
  assert.equal(original.slides.length, 16, 'Footer controls require the original sixteen-case baseline');
  const parser = new engine.xml.XMLParser({ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: false, trimValues: false});
  for (const [index, slide] of original.slides.entries()) {
    assert.equal(slide.marker, `K${String(index + 1).padStart(2, '0')}`, 'Footer controls require the original presentation order');
    const shapeName = `OPF furniture ${index} part 0 line 0`, xml = new TextDecoder('utf-8', {fatal: true}).decode(before[slide.part]);
    assert.deepEqual(Buffer.from(xml), Buffer.from(before[slide.part]), 'Source XML must round-trip byte-exact UTF-8');
    const shapes = [...xml.matchAll(/<p:sp\b[^>]*>[\s\S]*?<\/p:sp>/g)].map(match => match[0]);
    const matches = shapes.filter(shape => parser.parse(shape)['p:sp']?.['p:nvSpPr']?.['p:cNvPr']?.name === shapeName);
    assert.equal(matches.length, 1, `${slide.marker}: expected unique exact literal footer object name`);
    const [shape] = matches, parsed = parser.parse(shape)['p:sp'], tokens = [...shape.matchAll(/<p:ph\b[^>]*\/>/g)].map(match => match[0]);
    assert.equal(tokens.length, 1, `${slide.marker}: expected exactly one actual placeholder token`);
    assert.equal(parsed['p:nvSpPr']?.['p:nvPr']?.['p:ph']?.type, 'ftr', `${slide.marker}: target must be an actual ftr placeholder`);
    assert.equal(deep(parser.parse(xml), 'p:ph').filter(ph => ph.type === 'ftr').length, 1, `${slide.marker}: unexpected extra footer binding`);
    assert.equal(deep(parsed, 'a:fld').length, 0, `${slide.marker}: literal footer must not hold a live field`);
    assert.equal(array(parsed['p:txBody']?.['a:p']).length, 1, `${slide.marker}: literal footer must be one paragraph`);
    assert.equal(texts(parsed).join(''), literal, `${slide.marker}: current literal footer differs from source`);
    const token = tokens[0];
    after[slide.part] = Buffer.from(xml.replace(shape, shape.replace(token, '')));
    removals.push({part: slide.part, shapeName, token});
  }
  const parts = verifyFooterPartChanges(before, after, removals);
  // Only B is recompressed. Part bytes, rather than ZIP container metadata, establish the causal invariant.
  const variant = engine.fflate.zipSync(after, {level: 6, mtime: new Date('2026-10-15T00:00:00Z')});
  verifyFooterPartChanges(before, engine.fflate.unzipSync(variant), removals);
  const observed = inspectArchive(variant, engine);
  assert.equal(observed.slides.length, original.slides.length); assert.equal(observed.nativeChartCount, original.nativeChartCount); assert.equal(observed.nativeTableCount, original.nativeTableCount);
  assert.deepEqual(observed.slides.map(slide => slide.textSemantics.fields), original.slides.map(slide => slide.textSemantics.fields), 'Live slide fields changed');
  assert.deepEqual(observed.slides.map(slide => slide.notesSemantics), original.slides.map(slide => slide.notesSemantics), 'Speaker notes or generated notes fields changed');
  return {bytes: variant, proof: {scope: 'Uncompressed package part bytes; B ZIP metadata/compression may differ.', expectedRemovals: 16, actualRemovals: removals.length, changedParts: 16, unchangedParts: parts.length - 16, parts}};
}

export async function prepareFooterControls({suite: directory, consumer, output}) {
  assert.equal(process.versions.node.split('.')[0], '24', 'Qualification requires Node 24');
  const {root: baseline, suite} = await verifySeal(directory);
  assert.ok(!suite.fixture || suite.fixture === 'baseline-16', 'Footer controls require the original sixteen-case baseline');
  assert.ok(!suite.mode || suite.mode === 'baseline', 'Footer controls do not modify measured/native body comparison suites');
  const engine = await installed(consumer);
  assert.deepEqual(packageIdentity(engine.packages), packageIdentity(suite.runtime.packages), 'Footer controls require the sealed baseline installed runtime');
  const source = JSON.parse(await readFile(path.join(baseline, 'sources/deck.opf.json')));
  assert.equal(source.slides.length, 16); assert.ok(source.slides.every(slide => slide.design?.footer === undefined), 'Per-slide footer overrides are outside this causal fixture');
  const input = await readFile(path.join(baseline, 'inputs/deck.pptx')), variant = footerControlVariant(input, engine, {literal: source.design?.footer?.left?.text});
  const target = await fresh(output, [baseline, engine.consumer]);
  await mkdir(path.join(target, 'variants'));
  await writeFile(path.join(target, 'variants/native-footer.pptx'), input, {flag: 'wx'});
  await writeFile(path.join(target, 'variants/ordinary-footer.pptx'), variant.bytes, {flag: 'wx'});
  assert.deepEqual(await readFile(path.join(target, 'variants/native-footer.pptx')), input, 'A must be an exact archive byte copy');
  await writeFile(path.join(target, 'part-differences.json'), json(variant.proof), {flag: 'wx'});
  const git = args => execFileSync('git', args, {cwd: repository, encoding: 'utf8', stdio: 'pipe'}).trim();
  const result = {schemaVersion: 1, kind: 'keynote-footer-binding-controls', nativeAcceptance: false, registryAcceptance: false,
    baseline: {directory: baseline, suiteSha256: hash(await readFile(path.join(baseline, 'suite.json'))), inputSha256: hash(input)},
    source: {revision: git(['rev-parse', 'HEAD']), dirty: git(['status', '--porcelain']) !== '', files: await Promise.all(['scripts/keynote-qualification/pack.mjs', 'scripts/keynote-qualification/cli.mjs', 'test/keynote-footer-controls.mjs', 'docs/keynote-qualification.md'].map(async file => ({path: file, sha256: hash(await readFile(path.join(repository, file)))})))},
    runtime: {node: process.version, consumer: engine.consumer, packages: engine.packages},
    variants: {'native-footer': {file: 'variants/native-footer.pptx', bytes: input.length, sha256: hash(input), exactInputArchive: true}, 'ordinary-footer': {file: 'variants/ordinary-footer.pptx', bytes: variant.bytes.length, sha256: hash(variant.bytes), zipRecompressed: true, onlyUncompressedPartChange: 'Remove exactly sixteen slide-local literal ftr placeholder tokens'}}, files: await tree(target)};
  await writeFile(path.join(target, 'suite.json'), json(result), {flag: 'wx'});
  await verifySeal(baseline); await verifyFooterControls(target); return result;
}

export async function prepareFooterCopy({suite: directory, variant, output}) {
  const {root, suite} = await verifyFooterControls(directory);
  assert.ok(['native-footer', 'ordinary-footer'].includes(variant), 'Unknown footer variant');
  const selected = suite.variants[variant], target = await fresh(output, [root]);
  assert.equal(selected.file, `variants/${variant}.pptx`);
  assert.equal(hash(await readFile(path.join(root, selected.file))), selected.sha256, 'Selected footer variant hash differs');
  await copyFile(path.join(root, selected.file), path.join(target, 'editable.pptx'), constants.COPYFILE_EXCL);
  const actions = ['Observe literal footer visibility and object order on K08 and K02; capture screenshots.', 'Observe live slide numbers 8 and 2 separately from literal footer text.', 'Save a fresh working.key, export a fresh native-export.pptx, reopen both, and retain every failure.'];
  await writeFile(path.join(target, 'attempt.json'), json({variant, suite: root, suiteSha256: hash(await readFile(path.join(root, 'suite.json'))), inputSha256: selected.sha256, actions, nativeAcceptance: false}), {flag: 'wx'});
  await writeFile(path.join(target, 'result.json'), json({...outcomeTemplate('no-op'), variant, actions: actions.map((operation, index) => ({id: index + 1, operation, status: 'not-run', evidence: [], observations: []}))}), {flag: 'wx'});
  await verifyFooterControls(root); return target;
}

export function nativeFindings(inspection, route, baseline, bodyFixture = false) {
  const definitions = qualificationRoutes(bodyFixture);
  assert.ok(Object.hasOwn(definitions, route), 'Unknown route');
  const failures = [], check = (condition, message) => {if (!condition) failures.push(message);};
  check(inspection.slides.length === definitions[route].expectedSlides, 'Unexpected exported slide count');
  check(inspection.nativeChartCount === 2, 'Two native chart objects must remain');
  check(inspection.nativeTableCount === 2, 'Two native table objects must remain');
  for (let index = 1; index <= (bodyFixture ? 17 : 16); index++) {
    const marker = `K${String(index).padStart(2, '0')}`;
    check(inspection.slides.filter(slide => slide.marker === marker).length === 1, `${marker}: original slide marker missing or duplicated`);
  }
  for (const action of definitions[route].actions) {
    const slide = action.id === 'new-slide' ? inspection.slides.find(slide => slide.text.join(' ').includes(action.marker)) : inspection.slides.find(slide => slide.marker === action.slide), text = slide?.text.join(' ') ?? '';
    if (action.marker) check(text.includes(action.marker), `${action.id}: expected edited text missing`);
    if (action.secondMarker) check(text.includes(action.secondMarker), `${action.id}: expected new body missing`);
    if (action.oldMarker) check(!text.includes(action.oldMarker), `${action.id}: replaced old text remains`);
    if (action.notesMarker) check(slide?.notes.join(' ').includes(action.notesMarker), `${action.id}: edited notes missing`);
    if (action.chartSeries) check(slide?.charts.some(chart => chart.series?.some(series => isDeepStrictEqual(series, action.chartSeries))), `${action.id}: edited native chart series/category/value cache missing or unrelated points changed`);
    if (Object.hasOwn(editedTableCells, action.id)) {
      const [row, column] = editedTableCells[action.id];
      check(slide?.tables?.length === 1 && inlineText(slide.tables[0].rows?.[row + 1]?.[column]).includes(action.marker), `${action.id}: edited marker missing from expected current native table body cell (${row},${column})`);
    }
  }
  if (route === 'layout-structure') check(inspection.slides.findIndex(slide => slide.marker === 'K14') === inspection.slides.findIndex(slide => slide.marker === 'K15') + 1, 'K14 must immediately follow K15');
  if (route === 'no-op' && baseline) {
    for (const source of baseline.slides) {
      const actual = inspection.slides.find(slide => slide.marker === source.marker);
      if (actual) {
        failures.push(...compareNoopText(actual.textSemantics, source.textSemantics, source.marker));
        failures.push(...compareNoopText(actual.notesSemantics, source.notesSemantics, `${source.marker} notes`));
      }
    }
  }
  return failures;
}

const inlineText = value => typeof value === 'string' || typeof value === 'number' ? String(value) : Array.isArray(value) ? value.map(inlineText).join('') : value && typeof value === 'object' ? inlineText(value.text) : '';
// Read only the current cell's display payload. Style, source/evidence and extension values are not cell words.
const tableCellText = cell => {
  const value = cell && typeof cell === 'object' && !Array.isArray(cell) && Object.hasOwn(cell, 'value') ? cell.value : cell;
  return typeof value === 'boolean' ? String(value) : inlineText(value);
};
// Existing maintained actions identify these exact body cells; native XML also includes the header row.
const editedTableCells = {'table-cell': [0, 0], 'table-style': [0, 1]};
const currentTables = node => node ? [...(node.table ? [node.table] : []), ...array(node.blocks).flatMap(currentTables)] : [];
// Only current authored slide fields count. Never search serialized provenance, catalogs, extensions or other slides.
export function currentSlideText(slide) {
  if (!slide || typeof slide !== 'object') return '';
  const values = ['title', 'subtitle', 'tag', 'text'].map(field => inlineText(slide[field]));
  values.push(...array(slide.items).map(item => typeof item === 'object' && !Array.isArray(item) ? `${inlineText(item.text)} ${inlineText(item.description)}` : inlineText(item)));
  if (slide.metric !== undefined) values.push(typeof slide.metric === 'object' ? ['value', 'unit', 'label', 'description', 'delta', 'trend'].map(field => inlineText(slide.metric[field])).join(' ') : inlineText(slide.metric));
  if (slide.table) values.push(...[slide.table.columns, ...array(slide.table.rows)].flatMap(row => array(row).map(tableCellText)));
  values.push(...array(slide.blocks).map(currentSlideText));
  return values.filter(Boolean).join(' ');
}

export function importedFindings(imported, route, bodyFixture = false) {
  const definitions = qualificationRoutes(bodyFixture);
  assert.ok(Object.hasOwn(definitions, route), 'Unknown route');
  const failures = [];
  for (const action of definitions[route].actions) {
    const slide = imported.slides?.find(slide => action.id === 'new-slide' ? currentSlideText(slide).includes(action.marker) : currentSlideText(slide).match(/\bK\d{2}\b/)?.[0] === action.slide);
    const text = currentSlideText(slide);
    if (action.marker && !text.includes(action.marker)) failures.push(`${action.id}: edited marker missing from current imported slide payload`);
    if (action.secondMarker && !text.includes(action.secondMarker)) failures.push(`${action.id}: new body missing from the same current imported slide`);
    if (action.oldMarker && text.includes(action.oldMarker)) failures.push(`${action.id}: replaced old text resurrected in current imported slide`);
    if (action.notesMarker && !inlineText(slide?.notes).includes(action.notesMarker)) failures.push(`${action.id}: edited marker missing from current imported notes`);
    if (Object.hasOwn(editedTableCells, action.id)) {
      const tables = currentTables(slide), [row, column] = editedTableCells[action.id];
      if (tables.length !== 1 || !tableCellText(tables[0].rows?.[row]?.[column]).includes(action.marker)) failures.push(`${action.id}: edited marker missing from expected current imported table body cell (${row},${column})`);
    }
    if (action.chartSeries) {
      const charts = node => node ? [...(node.chart ? [node.chart] : []), ...array(node.blocks).flatMap(charts)] : [];
      const expected = action.chartSeries;
      const found = charts(slide).some(chart => {
        const column = chart.data?.columns?.findIndex(value => inlineText(value) === expected.name);
        return column > 0 && isDeepStrictEqual(chart.data.rows.map(row => inlineText(row[0])), expected.categories) && isDeepStrictEqual(chart.data.rows.map(row => row[column]), expected.values);
      });
      if (!found) failures.push(`${action.id}: current imported chart series/category/values differ`);
    }
  }
  return failures;
}

export function importedFurnitureFindings(imported, source, baseline) {
  const failures = [];
  for (const original of baseline.slides) {
    const authored = source.slides.find(slide => slide.title?.startsWith(original.marker));
    const current = imported.slides?.find(slide => currentSlideText(slide).match(/\bK\d{2}\b/)?.[0] === original.marker);
    for (const object of original.textSemantics.objects.filter(object => furnitureRoles.has(object.placeholderRole))) {
      const literal = normalizedWords(object.paragraphs);
      // Only diagnose unambiguous fixture furniture. Never delete or classify imported words by matching text.
      if (literal && !currentSlideText(authored).includes(literal) && currentSlideText(current).includes(literal)) failures.push(`${original.marker}: literal furniture appears in current imported slide content (${furnitureKey(object)})`);
    }
  }
  return failures;
}

/** Words alone do not prove the opted-in native bullet body survived as a list. */
export function nativeBodyNoopListFindings(imported, source, {fixture, mode, route} = {}) {
  if (fixture !== 'body-17' || mode !== 'native' || route !== 'no-op') return [];
  const entryText = item => {
    if (typeof item === 'string') return item;
    if (Array.isArray(item)) return item.every(run => typeof run === 'string' || run && typeof run.text === 'string') ? inlineText(item) : undefined;
    if (item && typeof item === 'object' && item.text !== undefined && item.description === undefined && item.start === undefined && (item.level === undefined || item.level === 0)) return entryText(item.text);
    return undefined;
  };
  const authored = source.slides.find(slide => slide.title?.startsWith('K17'));
  const expected = authored?.items?.map(entryText);
  assert.ok(expected?.length === 3 && expected.every(value => typeof value === 'string'), 'K17 source must remain exactly three flat authored entries');
  const slide = imported.slides?.find(slide => currentSlideText(slide).match(/\bK\d{2}\b/)?.[0] === 'K17');
  const lists = slide ? [...(Array.isArray(slide.items) && (slide.type === undefined || slide.type === 'list') ? [slide] : []), ...array(slide.blocks).filter(block => block?.type === 'list' && Array.isArray(block.items))] : [];
  if (lists.length !== 1) return ['K17: native body no-op requires one semantic flat list with three current entries; words in a text block are insufficient'];
  const [list] = lists, actual = list.items.map(entryText);
  if (list.numbering !== undefined || actual.some(value => typeof value !== 'string') || !isDeepStrictEqual(actual, expected)) return ['K17: native body no-op semantic flat list must retain exactly three flat current entries in source order and words'];
  return [];
}

export async function inspectNative({suite: directory, consumer, input, route, output}) {
  const {root, suite} = await verifySeal(directory); assert.ok(Object.hasOwn(routes, route), 'Unknown route');
  const engine = await installed(consumer), target = await fresh(output, [root, engine.consumer]);
  assert.deepEqual(engine.packages.map(({name, version, sha256}) => ({name, version, sha256})), suite.runtime.packages.map(({name, version, sha256}) => ({name, version, sha256})), 'Inspection consumer differs from the sealed installed runtime');
  const bytes = await readFile(input), inspection = inspectArchive(bytes, engine), baseline = inspectArchive(await readFile(path.join(root, 'inputs/deck.pptx')), engine);
  const bodyFixture = suite.fixture === 'body-17';
  const failures = nativeFindings(inspection, route, baseline, bodyFixture);
  const diagnostics = [], imported = await engine.pptx.fromPptx(bytes, {catalogs: [engine.gallery], onDiagnostic: value => diagnostics.push(value)});
  failures.push(...importedFindings(imported, route, bodyFixture));
  if (route === 'no-op') {
    const source = JSON.parse(await readFile(path.join(root, 'sources/deck.opf.json')));
    failures.push(...importedFurnitureFindings(imported, source, baseline));
    failures.push(...nativeBodyNoopListFindings(imported, source, {fixture: suite.fixture, mode: suite.mode, route}));
  }
  if (route === 'content-edits') {
    const replacement = hash(await readFile(path.join(root, 'assets/replacement.png'))), actual = inspection.slides.find(slide => slide.marker === 'K08');
    if (!actual?.pictures.some(picture => picture.sha256 === replacement)) failures.push('replace-image: replacement media bytes missing from current slide');
  }
  const noOpTopology = route === 'no-op' ? baseline.slides.map(before => {
    const after = inspection.slides.find(slide => slide.marker === before.marker);
    const furniture = inventory => inventory.objects.filter(object => before.textSemantics.objects.some(original => furnitureRoles.has(original.placeholderRole) && furnitureKey(original) === furnitureKey(object))).map(({name, placeholderRole}) => ({name, placeholderRole}));
    const paintOrder = inventory => inventory.objects.map(({kind, name}) => ({kind, name}));
    return {marker: before.marker, slideFields: {before: before.textSemantics.fields, after: after?.textSemantics.fields ?? null}, notesFields: {before: before.notesSemantics.fields, after: after?.notesSemantics.fields ?? null}, furnitureRoles: {before: furniture(before.textSemantics), after: after ? furniture(after.textSemantics) : []}, objectPaintOrder: {before: paintOrder(before.textSemantics), after: after ? paintOrder(after.textSemantics) : []}};
  }) : undefined;
  const report = {scope: 'Offline inspection of the actual native-exported PPTX; no UI, font, raster or native acceptance claim.', route, input: {file: path.resolve(input), bytes: bytes.length, sha256: hash(bytes)}, packages: engine.packages, inspection, ...(noOpTopology ? {noOpTopology} : {}), failures, staticAssertionsPassed: failures.length === 0, nativeAcceptance: false};
  await writeFile(path.join(target, 'inspection.json'), json(report), {flag: 'wx'});
  await writeFile(path.join(target, 'imported.opf.json'), json(imported), {flag: 'wx'});
  await writeFile(path.join(target, 'import-diagnostics.json'), json(diagnostics), {flag: 'wx'});
  await verifySeal(root); return report;
}
