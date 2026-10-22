// Offline guard controls only. Synthetic evidence is never registry/native acceptance.
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, writeFile, realpath, symlink, unlink, rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {spawnSync} from 'node:child_process';
import {inventoryRegistryConsumer, regularTarPayload, compareRegistryPayload, registryTarballUrl, checkRegistryEntry, checkVerifierSource, reviewedVerifier, requireVerifierClosure, requireVerification, verifyRegistryRuntime, sealRegistryRuntime} from '../scripts/keynote-qualification/registry-runtime.mjs';
import {generate, bodyCapability} from '../scripts/keynote-qualification/pack.mjs';
import {bodyDeck} from '../scripts/keynote-qualification/fixtures.mjs';

const json = value => Buffer.from(JSON.stringify(value, null, 2) + '\n');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sri = bytes => 'sha512-' + createHash('sha512').update(bytes).digest('base64');
const root = await realpath(await mkdtemp(path.join(tmpdir(), 'registry-runtime-'))), consumer = path.join(root, 'consumer'); await mkdir(consumer);
const tar = members => {
  const chunks = [];
  for (const {name, bytes = Buffer.from('x'), type = '0', link = ''} of members) {
    const h = Buffer.alloc(512); h.write(name, 0, 100); h.write('0000644\0', 100); h.write('0000000\0', 108); h.write('0000000\0', 116); h.write(bytes.length.toString(8).padStart(11, '0') + '\0', 124); h.write('00000000000\0', 136); h.fill(32, 148, 156); h.write(type, 156); h.write(link, 157, 100); h.write('ustar\0', 257); h.write('00', 263);
    h.write([...h].reduce((sum, value) => sum + value, 0).toString(8).padStart(6, '0') + '\0 ', 148);
    chunks.push(h, bytes, Buffer.alloc((512 - bytes.length % 512) % 512));
  }
  return gzipSync(Buffer.concat([...chunks, Buffer.alloc(1024)]));
};
assert.equal(regularTarPayload(tar([{name: 'package/a.txt'}])).get('a.txt').toString(), 'x');
for (const name of ['../outside', '/absolute', 'package/../outside', 'package/a\\b', 'package/C:/x', 'package//x', 'package/a/./b']) assert.throws(() => regularTarPayload(tar([{name}])), /Unsafe/);
for (const type of ['1', '2', '3', '4', '5', '6', 'x', 'g', 'L', 'K']) assert.throws(() => regularTarPayload(tar([{name: 'package/a', type}])), /regular tar/);
assert.throws(() => regularTarPayload(tar([{name: 'package/a', link: 'outside'}])), /link target/);
assert.throws(() => regularTarPayload(tar([{name: 'package/a'}, {name: 'package/a'}])), /Duplicate/);
assert.throws(() => regularTarPayload(tar([{name: 'package/a'}, {name: 'package/a/b'}])), /collision/);
assert.throws(() => regularTarPayload(gzipSync(Buffer.alloc(512))), /end blocks/);
const damaged = Buffer.from(tar([{name: 'package/a'}])); damaged[damaged.length - 5] ^= 1; assert.throws(() => regularTarPayload(damaged));
requireVerifierClosure({...reviewedVerifier.files});
for (const file of Object.keys(reviewedVerifier.files)) assert.throws(() => requireVerifierClosure({...reviewedVerifier.files, [file]: '0'.repeat(64)}), /Verifier closure/);
assert.throws(() => requireVerifierClosure({...reviewedVerifier.files, 'scripts/injected.mjs': '0'.repeat(64)}), /Verifier closure/);
await assert.rejects(checkVerifierSource(root, 'b'.repeat(40)), /independently reviewed revision/);
await assert.rejects(sealRegistryRuntime({consumer: root, 'verifier-source': root, 'verifier-revision': 'b'.repeat(40), publisher: 'a'.repeat(40), output: path.join(root, 'never-sealed')}),
  process.versions.node.split('.')[0] === '24' ? /independently reviewed revision/ : /Qualification requires Node24/);
await assert.rejects(readFile(path.join(root, 'never-sealed/receipt.json')), /ENOENT/);
const beforeOptions = process.env.NODE_OPTIONS; process.env.NODE_OPTIONS = '--import=injected.mjs';
await assert.rejects(checkVerifierSource(root, reviewedVerifier.revision), /Injected Node/);
if (beforeOptions === undefined) delete process.env.NODE_OPTIONS; else process.env.NODE_OPTIONS = beforeOptions;
const alias = path.join(root, 'verifier-alias'); await symlink(root, alias); await assert.rejects(checkVerifierSource(alias, reviewedVerifier.revision), /aliased/); await unlink(alias);
const checkNames = ['npm version', 'tag', 'gitHead', 'tag on main', 'version at tag', 'dist.attestations', 'SLSA provenance', 'npm audit signatures', 'GitHub release'];
const checks = checkNames.map(name => ({name, ok: true, detail: 'Synthetic guard fixture only'}));
requireVerification({ok: true, checks});
assert.throws(() => requireVerification({status: 'verified', ok: true}), /verification failed/);
for (const name of checkNames) assert.throws(() => requireVerification({ok: true, checks: checks.map(check => ({...check, ok: check.name !== name}))}), /verification failed/);
assert.throws(() => requireVerification({ok: true, checks: [...checks, checks[0]]}), /verification failed/);

// Qualification is Node 24 only: every production entrypoint (sealRegistryRuntime, generate) asserts it before anything else. The CI
// engine-range legs (Node 22 and 26) run this file too, so there the entrypoints are checked to refuse the runtime, and the
// archive/registry guard controls that follow, which run those entrypoints, are Node 24 controls.
if (process.versions.node.split('.')[0] !== '24') {
  await assert.rejects(sealRegistryRuntime({consumer: root, 'verifier-source': root, 'verifier-revision': 'b'.repeat(40), publisher: 'a'.repeat(40), output: path.join(root, 'never-sealed')}), /Qualification requires Node24/);
  await assert.rejects(generate({consumer, mode: 'native', output: path.join(root, 'never-generated')}), /Qualification requires Node 24/);
  await assert.rejects(readFile(path.join(root, 'never-sealed/receipt.json')), /ENOENT/);
  console.log(`Keynote registry identity: pure guards pass on Node ${process.versions.node}; the entrypoint controls are Node 24 only and the entrypoints refuse this runtime.`);
  await rm(root, {recursive: true, force: true});
  process.exit(0);
}
const versions = {'@openpresentation/opf': '0.20.3', '@openpresentation/opf-render': '0.20.2', '@openpresentation/opf-pptx': '0.20.3', '@openpresentation/gallery': '3.0.0'};
const peers = Object.fromEntries(Array.from({length: 44}, (_, index) => [`@expo-google-fonts/control-${index}`, '0.4.0']));
const manifest = {name: 'offline-registry-guard', private: true, dependencies: {...versions, ...peers}}, lock = {lockfileVersion: 3, packages: {'': {dependencies: manifest.dependencies}}};
const archives = new Map();
for (const [name, value] of Object.entries(manifest.dependencies)) {
  const directory = path.join(consumer, 'node_modules', name); await mkdir(directory, {recursive: true});
  const pkg = {name, version: value, type: 'module', exports: {'.': './dist/index.js', './package.json': './package.json'}, ...(name.endsWith('/opf-render') ? {peerDependencies: peers} : {})};
  const payload = {'package.json': json(pkg), 'dist/index.js': Buffer.from(`import{writeFileSync}from'node:fs';writeFileSync(${JSON.stringify(path.join(root, 'EXECUTED'))},'must not import before verifying');export const control=true;\n`)};
  if (name.endsWith('/opf-pptx')) payload['vendor/control.txt'] = Buffer.from('vendor fixture');
  for (const [file, bytes] of Object.entries(payload)) {await mkdir(path.dirname(path.join(directory, file)), {recursive: true}); await writeFile(path.join(directory, file), bytes);}
  const archive = tar(Object.entries(payload).map(([file, bytes]) => ({name: 'package/' + file, bytes}))); archives.set(name, archive);
  lock.packages['node_modules/' + name] = {version: value, resolved: registryTarballUrl(name, value), integrity: sri(archive)};
}
await writeFile(path.join(consumer, 'package.json'), json(manifest)); await writeFile(path.join(consumer, 'package-lock.json'), json(lock));
const initial = await inventoryRegistryConsumer(consumer); assert.equal(initial.packages.length, 4); assert.equal(initial.fonts.length, 44);
await assert.rejects(readFile(path.join(root, 'EXECUTED')), /ENOENT/, 'Inventory never executes package entrypoints');
for (const pkg of initial.packages) compareRegistryPayload(pkg, archives.get(pkg.name), lock.packages['node_modules/' + pkg.name], {name: pkg.name, version: pkg.version, dist: {tarball: registryTarballUrl(pkg.name, pkg.version), integrity: sri(archives.get(pkg.name))}});
const entry = lock.packages['node_modules/@openpresentation/opf'];
const changedArchive = tar([{name: 'package/package.json', bytes: json({name: '@openpresentation/opf', version: '0.20.3'})}]);
assert.throws(() => compareRegistryPayload(initial.packages[0], changedArchive, {...entry, integrity: sri(changedArchive)}, {name: '@openpresentation/opf', version: '0.20.3', dist: {tarball: entry.resolved, integrity: sri(changedArchive)}}), /installed payload differs/);
assert.throws(() => compareRegistryPayload(initial.packages[0], changedArchive, entry, {name: '@openpresentation/opf', version: '0.20.3', dist: {tarball: entry.resolved, integrity: entry.integrity}}), /archive integrity/);
for (const resolved of ['file:../a.tgz', 'git+https://github.com/x/y', 'workspace:*', 'npm:other@0.20.3', 'https://evil.test/opf.tgz']) assert.throws(() => checkRegistryEntry('@openpresentation/opf', '0.20.3', {...entry, resolved}), /official registry/);
assert.throws(() => checkRegistryEntry('@openpresentation/opf', '0.20.3', {...entry, link: true}), /version\/link/);
assert.throws(() => checkRegistryEntry('@openpresentation/opf', '^0.20.3', entry), /Exact stable/);
const refused = async (change, pattern) => {
  const beforeManifest = json(manifest), beforeLock = json(lock); await change();
  await assert.rejects(inventoryRegistryConsumer(consumer), pattern);
  await writeFile(path.join(consumer, 'package.json'), beforeManifest); await writeFile(path.join(consumer, 'package-lock.json'), beforeLock);
};
await refused(() => writeFile(path.join(consumer, 'package.json'), json({...manifest, overrides: {'@openpresentation/opf': 'file:../x'}})), /override/);
await refused(() => writeFile(path.join(consumer, 'package-lock.json'), json({...lock, packages: {...lock.packages, 'node_modules/foreign/node_modules/@openpresentation/opf': entry}})), /Nested/);
await refused(() => writeFile(path.join(consumer, 'package.json'), json({...manifest, dependencies: {...manifest.dependencies, '@expo-google-fonts/control-0': '9.9.9'}})), /font peer/);
await refused(() => writeFile(path.join(consumer, 'package-lock.json'), json({...lock, packages: {...lock.packages, '': {dependencies: {...manifest.dependencies, '@expo-google-fonts/control-0': '^0.4.0'}}}})), /root lock font pin mismatch/);
const rendererFile = path.join(consumer, 'node_modules/@openpresentation/opf-render/package.json'), originalRenderer = await readFile(rendererFile), shortRenderer = JSON.parse(originalRenderer); delete shortRenderer.peerDependencies['@expo-google-fonts/control-0'];
await writeFile(rendererFile, json(shortRenderer)); await assert.rejects(inventoryRegistryConsumer(consumer), /all44 font/); await writeFile(rendererFile, originalRenderer);
const fontFile = path.join(consumer, 'node_modules/@expo-google-fonts/control-0/package.json'), originalFont = await readFile(fontFile);
await writeFile(fontFile, json({name: '@expo-google-fonts/control-0', version: '9.9.9'})); await assert.rejects(inventoryRegistryConsumer(consumer)); await writeFile(fontFile, originalFont);
const gallery = path.join(consumer, 'node_modules/@openpresentation/gallery'), moved = gallery + '-retained';
await import('node:fs/promises').then(fs => fs.rename(gallery, moved)); await symlink(moved, gallery); await assert.rejects(inventoryRegistryConsumer(consumer), /normal directory/); await unlink(gallery); await import('node:fs/promises').then(fs => fs.rename(moved, gallery));

// Self-consistent synthetic evidence below is accepted only as an explicit test digest, never as real publication proof.
const registry = path.join(root, 'identity'); await mkdir(path.join(registry, 'archives'), {recursive: true}); await mkdir(path.join(registry, 'evidence'));
const evidence = [], put = async (file, data) => {await writeFile(path.join(registry, file), data); evidence.push({path: file, bytes: data.length, sha256: hash(data)});};
const verified = [];
for (const pkg of initial.packages) {
  const archive = archives.get(pkg.name), file = `archives/${pkg.name.split('/')[1]}.tgz`; await put(file, archive);
  verified.push({name: pkg.name, version: pkg.version, publisher: 'a'.repeat(40), registryManifest: {name: pkg.name, version: pkg.version, gitHead: 'a'.repeat(40), dist: {tarball: registryTarballUrl(pkg.name, pkg.version), integrity: sri(archive)}}, checks, archive: file, sha256: hash(archive), integrity: sri(archive)});
}
await put('evidence/control.json', json({synthetic: true})); evidence.sort((a, b) => a.path.localeCompare(b.path, 'en'));
const receipt = {schemaVersion: 1, kind: 'registry-pptx-runtime', registryArtifactVerified: true, nativeAcceptance: false, verifier: reviewedVerifier, publisher: 'a'.repeat(40), inventory: initial, verified, evidence};
const receiptBytes = json(receipt); await writeFile(path.join(registry, 'receipt.json'), receiptBytes);
const opts = {registry, 'registry-sha256': hash(receiptBytes), consumer};
assert.equal((await verifyRegistryRuntime(opts)).receiptSha256, hash(receiptBytes));
await assert.rejects(verifyRegistryRuntime({...opts, 'registry-sha256': '0'.repeat(64)}), /accepted digest/);
await assert.rejects(verifyRegistryRuntime({...opts, 'registry-sha256': undefined}), /independently accepted/i);
await writeFile(path.join(registry, 'receipt.json'), json({...receipt, registryArtifactVerified: false})); await assert.rejects(verifyRegistryRuntime(opts), /accepted digest/); await writeFile(path.join(registry, 'receipt.json'), receiptBytes);
await writeFile(path.join(registry, 'evidence/control.json'), 'changed'); await assert.rejects(verifyRegistryRuntime(opts), /evidence changed|strictly equal/); await writeFile(path.join(registry, 'evidence/control.json'), json({synthetic: true}));
await writeFile(path.join(registry, 'evidence/extra.json'), 'extra'); await assert.rejects(verifyRegistryRuntime(opts), /extra registry evidence/); await unlink(path.join(registry, 'evidence/extra.json'));
const archiveFile = path.join(registry, verified[0].archive), archiveBytes = await readFile(archiveFile); await writeFile(archiveFile, 'changed'); await assert.rejects(verifyRegistryRuntime(opts)); await writeFile(archiveFile, archiveBytes);
const altered = path.join(consumer, 'node_modules/@openpresentation/opf-pptx/dist/index.js'), original = await readFile(altered);
await writeFile(altered, Buffer.concat([original, Buffer.from('// altered runtime\n')]));
await assert.rejects(generate({...opts, mode: 'native', output: path.join(root, 'never-generated')}), /runtime or consumer changed/);
await assert.rejects(readFile(path.join(root, 'EXECUTED')), /ENOENT/, 'Altered consumer entrypoint refused before any import'); await writeFile(altered, original);
const extraVendor = path.join(consumer, 'node_modules/@openpresentation/opf-pptx/vendor/extra.js'); await writeFile(extraVendor, 'x'); await assert.rejects(verifyRegistryRuntime(opts), /runtime or consumer changed/); await unlink(extraVendor);
await assert.rejects(verifyRegistryRuntime({...opts, consumer: root}));
await assert.rejects(generate({...opts, candidate: 'anything', mode: 'native'}), /mutually exclusive/);
const source17 = bodyDeck('data:image/png;base64,AA==');
const ignoredOption = {slides: source17.slides.map(slide => ({marker: slide.title.slice(0, 3), shapes: []}))};
assert.throws(() => bodyCapability(ignoredOption, source17, [], 'native'), /one actual Body placeholder/, 'Full17-case ignored-option synthetic control never bypasses actual Body capability; actual published P3 execution is separate');
for (const args of [['registry', '--verified-report', 'forged'], ['registry', '--status', 'verified'], ['generate', '--registry', registry]]) {
  const result = spawnSync(process.execPath, ['scripts/keynote-qualification/cli.mjs', ...args], {encoding: 'utf8'}); assert.notEqual(result.status, 0);
}
await assert.rejects(readFile(path.join(root, 'EXECUTED')), /ENOENT/);
console.log('Keynote registry identity: offline archive/graph/verifier/evidence/no-import guard controls pass; no real registry or native acceptance.');
await rm(root, {recursive: true, force: true});
