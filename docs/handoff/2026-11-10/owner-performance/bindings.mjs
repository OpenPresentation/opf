import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const folder = path.dirname(fileURLToPath(import.meta.url));
export const currentDrivers = ['bindings.mjs', 'font-cache-diagnostics.mjs', 'build-current.mjs', 'current-browser-entry.mjs', 'run-current.mjs', 'prepare-assets.mjs', 'trace-asset-inputs.mjs', 'propose-projection.mjs', 'validate-source-inputs.mjs', 'input-manifest.json'];
const git = (root, ...args) => execFileSync('git', args, {cwd: root, maxBuffer: 32 * 1024 * 1024});
const slash = value => value.split(path.sep).join('/');
export function fileRecord(root, file) {
  const absolute = path.resolve(root, file), bytes = fs.readFileSync(absolute);
  return {path: slash(path.relative(root, absolute)), bytes: bytes.length, sha256: sha256(bytes)};
}
export function verifyFiles(root, records) {
  for (const record of records) assert.deepEqual(fileRecord(root, record.path), record, 'Bound file changed: ' + record.path);
}
export function compilerRecords(root) {
  const require = createRequire(path.join(root, 'packages/editor/package.json'));
  const manifest = require.resolve('esbuild/package.json'), compilerRequire = createRequire(manifest);
  const native = process.env.ESBUILD_BINARY_PATH || compilerRequire.resolve(`@esbuild/${process.platform}-${process.arch}/${process.platform === 'win32' ? 'esbuild.exe' : 'bin/esbuild'}`);
  return [manifest, require.resolve('esbuild'), path.join(path.dirname(manifest), 'bin/esbuild'), native].map(file => fileRecord(root, file));
}
export function inventory(root, directory) {
  const files = [];
  const walk = dir => {for (const entry of fs.readdirSync(dir, {withFileTypes: true}).sort((a, b) => a.name.localeCompare(b.name))) {const file = path.join(dir, entry.name); if (entry.isDirectory()) walk(file); else if (entry.isFile()) files.push(fileRecord(root, file)); else throw Error('Unexpected non-file asset: ' + file);}};
  walk(directory); return files;
}
function nearestManifest(file) {
  let directory = path.dirname(file);
  while (true) {const candidate = path.join(directory, 'package.json'); if (fs.existsSync(candidate)) return candidate; const parent = path.dirname(directory); if (parent === directory) return undefined; directory = parent;}
}
const sourcePaths = ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'spec', 'packages', 'scripts'];
function sourceManifest(root) {
  const bytes = git(root, 'ls-tree', '-r', 'HEAD', '--', ...sourcePaths);
  return {paths: sourcePaths, bytes: bytes.length, sha256: sha256(bytes)};
}
export function captureBinding(root, actualInputs = []) {
  // Workspace manifests plus every actual bundle/asset input's nearest package
  // manifest; historical evidence packages are not current dependency inputs.
  const manifestNames = git(root, 'ls-files', '-z', '--', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', ':(glob)packages/*/package.json').toString().split('\0').filter(Boolean);
  const files = new Set([...manifestNames, ...currentDrivers.map(name => path.join(folder, name))]);
  for (const input of actualInputs) {const manifest = nearestManifest(path.resolve(root, input.path ?? input)); if (manifest) files.add(manifest);}
  return {
    source: git(root, 'rev-parse', 'HEAD').toString().trim(), tree: git(root, 'rev-parse', 'HEAD^{tree}').toString().trim(), sourceManifest: sourceManifest(root),
    manifestsAndDrivers: [...files].map(file => fileRecord(root, file)).sort((a, b) => a.path.localeCompare(b.path)),
    runtime: {node: process.version, executable: fileRecord(root, process.execPath)},
  };
}
export function verifyBinding(root, binding) {
  assert.equal(git(root, 'rev-parse', 'HEAD').toString().trim(), binding.source, 'Source revision changed');
  assert.equal(git(root, 'rev-parse', 'HEAD^{tree}').toString().trim(), binding.tree, 'Source tree changed');
  assert.deepEqual(sourceManifest(root), binding.sourceManifest, 'Source manifest identity changed');
  verifyFiles(root, binding.manifestsAndDrivers);
  assert.equal(process.version, binding.runtime.node, 'Node version changed');
  verifyFiles(root, [binding.runtime.executable]);
}
export function assetAdmission(root, directory) {
  const file = path.join(directory, 'asset-receipt.json'), receipt = JSON.parse(fs.readFileSync(file));
  assert.equal(receipt.scope, 'MAINTAINED_ASSET_PREPARATION_NOT_BROWSER_QUALIFICATION');
  verifyBinding(root, receipt.binding); verifyFiles(root, receipt.inputs); verifyFiles(root, receipt.outputs);
  verifyFiles(root, [receipt.tracer, receipt.maintainedBuilder, receipt.trace, ...receipt.compiler]);
  assert.deepEqual(inventory(root, directory).filter(record => record.path !== fileRecord(root, file).path), receipt.outputs, 'Prepared asset inventory changed');
  return {receipt, record: fileRecord(root, file)};
}

const approved = {
  16: {name: 'original-16', projectedSha256: '6309daf437296c2bc1161334dbea93d3b8b291105e3d6b30d436684ff3a55d2f', changes: 31},
  36: {name: 'extended-36', projectedSha256: 'a4a786065f187a556fb14f540ada02f6624f49fbf531685e79b3aad845e45e55', changes: 59},
};
function inverse(document, changes) {
  const result = structuredClone(document);
  for (const change of changes.toReversed()) {
    const object = change.parts.reduce((value, key) => {assert.ok(Object.hasOwn(value, key)); return value[key];}, result);
    if (change.kind === 'rename-property') {
      assert.ok(['left', 'right', 'top+middle:left+center+right', 'bottom:left+center+right'].includes(change.before));
      assert.ok(Object.hasOwn(object, change.after) && !Object.hasOwn(object, change.before));
      object[change.before] = object[change.after]; delete object[change.after];
    } else {
      assert.equal(change.kind, 'alignment-enum'); assert.ok(['align', 'titleAlignment'].includes(change.property));
      assert.equal(object[change.property], change.after); object[change.property] = change.before;
    }
  }
  return result;
}
export function measuredInputs(root, rawDirectory, projectionFile) {
  const manifest = JSON.parse(fs.readFileSync(path.join(folder, 'input-manifest.json')));
  const projection = projectionFile ? JSON.parse(fs.readFileSync(projectionFile)) : undefined;
  const inputFiles = [], inputs = {};
  if (projection) {
    assert.equal(projection.scope, 'PROPOSED_TYPED_PROJECTION_NOT_ADOPTED_OR_BENCHMARKED');
    assert.equal(projection.schemaSource, 'ed51a7e8a6636bb2e08c9a446a7d22c21ad81066');
    assert.equal(projection.literalAndDatasetRewrite, false);
    verifyFiles(root, [projection.recipe]); inputFiles.push(fileRecord(root, projectionFile), projection.recipe);
  }
  for (const [size, key] of [[16, 'original'], [36, 'extended']]) {
    const pin = approved[size], file = path.join(rawDirectory, pin.name + '.opf.json'), bytes = fs.readFileSync(file), raw = JSON.parse(bytes);
    assert.equal(bytes.length, manifest[key].bytes); assert.equal(sha256(bytes), manifest[key].sha256); assert.equal(raw.slides.length, size);
    inputFiles.push(fileRecord(root, file)); let document = raw, measuredFile = file, measuredBytes = bytes;
    if (projection) {
      const record = projection.inputs.find(item => item.name === pin.name); assert.ok(record);
      assert.equal(record.rawSha256, sha256(bytes)); assert.equal(record.changes.length, pin.changes); assert.equal(record.projectedSha256, pin.projectedSha256);
      measuredFile = path.join(path.dirname(projectionFile), pin.name + '.proposed.opf.json'); measuredBytes = fs.readFileSync(measuredFile); document = JSON.parse(measuredBytes);
      assert.equal(sha256(measuredBytes), pin.projectedSha256); assert.equal(measuredBytes.length, record.projectedBytes);
      assert.deepEqual(inverse(document, record.changes), raw, 'Whole typed inverse must restore the raw document');
      assert.deepEqual(document.datasets, raw.datasets); inputFiles.push(fileRecord(root, measuredFile));
    }
    inputs[size] = {file, bytes, sha256: sha256(bytes), measuredFile, measuredBytes, measuredSha256: sha256(measuredBytes), deck: document};
  }
  assert.deepEqual(inputs[36].deck.slides.slice(0, 16), inputs[16].deck.slides);
  return {inputs, inputFiles, admission: projection ? {scope: 'ROOT_REVIEWED_TYPED_PROJECTION', schemaSource: projection.schemaSource, recipe: projection.recipe, receipt: fileRecord(root, projectionFile), changes: projection.inputs.map(({name, changes, rawSha256, projectedSha256}) => ({name, changes, rawSha256, projectedSha256})), inverseDeepEqual: true} : {scope: 'RAW_DOCUMENTS_ONLY_NO_PROJECTION'}};
}
