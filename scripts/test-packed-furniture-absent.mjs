// Candidate-only public furniture checks in a fresh consumer with no renderer.
import assert from 'node:assert/strict';
import {mkdir, mkdtemp, readFile, writeFile, realpath, lstat, readdir, cp} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync, execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {tar} from './archive-tar.mjs';
import {packageManagerInvocation} from './package-manager.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const artifacts = path.resolve(process.argv[2] ?? path.join(root, 'artifacts/npm'));
const reportBase = path.resolve(process.argv[3] ?? path.join(root, 'artifacts/npm/renderer-absent-furniture'));
await mkdir(reportBase, {recursive: true});
const report = await mkdtemp(path.join(reportBase, 'run-'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const within = (parent, file) => {
  const relative = path.relative(parent, file);
  return relative !== '' && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
};
const json = (file, value) => writeFile(file, JSON.stringify(value, null, 2) + '\n');
const receipt = {node: process.version, execPath: process.execPath, platform: process.platform,
  artifacts, report, candidateOnly: true, retries: 0, commands: [], packages: [], stage: 'setup', passed: false,
  orchestratorSha256: hash(await readFile(new URL(import.meta.url)))};
let isolated, consumer, failure;
const run = async (command, args, log) => {
  const result = spawnSync(command, args, {cwd: consumer, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024});
  await writeFile(path.join(report, log), (result.stdout ?? '') + (result.stderr ?? ''));
  receipt.commands.push({command, args, cwd: consumer, log, status: result.status, signal: result.signal});
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${command} failed; see ${path.join(report, log)}`);
};
try {
  assert.ok(process.argv.length <= 4 && !process.argv.slice(2).some(arg => arg.startsWith('--')), 'This runner accepts candidate artifact/report directories, not registry flags.');
  const injectionOption = /(?:^|[\s"'])(?:--(?:import|loader|experimental-loader|require)(?:=|[\s"']|$)|-r)/;
  assert.ok(!injectionOption.test(process.env.NODE_OPTIONS ?? '') && !process.env.NODE_PATH && !process.execArgv.some(arg => injectionOption.test(arg)), 'Installed verification must not alias packages through import/require/loaders or NODE_PATH.');
  isolated = await realpath(await mkdtemp(path.join(tmpdir(), 'opf-furniture-absent-')));
  assert.ok(!within(await realpath(root), isolated), 'The absent consumer must not inherit checkout dependencies.');
  consumer = path.join(isolated, 'consumer');
  const copies = path.join(isolated, 'artifacts');
  await mkdir(consumer); await mkdir(copies);
  receipt.isolated = isolated;
  receipt.stage = 'verify-tarballs';
  const manifestBytes = await readFile(path.join(artifacts, 'manifest.json'));
  const manifest = JSON.parse(manifestBytes);
  await writeFile(path.join(copies, 'manifest.json'), manifestBytes);
  receipt.manifestSha256 = hash(manifestBytes);
  assert.equal(manifest.published, false, 'Require unpublished candidate archives, not a registry plan.');
  // RR-78: core depends on @openpresentation/gallery, which the fixture also registers.
  const names = ['@openpresentation/gallery', '@openpresentation/opf', '@openpresentation/opf-pptx'];
  const selected = names.map(name => {
    const matches = manifest.artifacts.filter(item => item.name === name);
    assert.equal(matches.length, 1, `Exactly one candidate artifact is required for ${name}`);
    return matches[0];
  });
  for (const item of selected) {
    assert.equal(path.basename(item.file), item.file); assert.match(item.file, /\.tgz$/);
    const bytes = await readFile(path.join(artifacts, item.file));
    assert.equal(hash(bytes), item.sha256, `Candidate tarball changed: ${item.name}`);
    assert.equal(bytes.length, item.bytes, `Candidate tarball size changed: ${item.name}`);
    await writeFile(path.join(copies, item.file), bytes);
  }
  await json(path.join(consumer, 'package.json'), {name: 'opf-renderer-absent-furniture-check', private: true, type: 'module',
    dependencies: Object.fromEntries(selected.map(item => [item.name, `file:../artifacts/${item.file}`]))});
  const fixture = await readFile(new URL('./fixtures/renderer-absent-furniture.mjs', import.meta.url));
  await writeFile(path.join(consumer, 'probe.mjs'), fixture);
  receipt.fixtureSha256 = hash(fixture);
  receipt.stage = 'install';
  // RR-62: core declares opf-render as an optional peer. The candidate opf-pptx lists the renderer as an optional dependency at a
  // preview version no registry has, and npm checks core's peer against that unresolvable placeholder (ERESOLVE). The renderer is
  // absent on purpose here, so peers are not resolved; the probe below still proves no renderer is installed.
  const npm =packageManagerInvocation('npm', ['install', '--ignore-scripts', '--no-fund', '--no-audit', '--legacy-peer-deps', '--cache', path.join(isolated, 'npm-cache')]);
  await run(npm.command, npm.args, 'install.log');
  receipt.stage = 'bind-installed-files';
  const lockBytes = await readFile(path.join(consumer, 'package-lock.json'));
  const lock = JSON.parse(lockBytes), modules = await realpath(path.join(consumer, 'node_modules'));
  receipt.lockSha256 = hash(lockBytes);
  assert.ok(within(consumer, modules));
  assert.ok(!Object.keys(lock.packages).some(file => /@openpresentation\/(opf-render|opf-editor)(?:\/|$)/.test(file)), 'Renderer/editor must remain absent from the complete lock.');
  for (const item of selected) {
    const location = path.join(modules, item.name), installed = await realpath(location);
    assert.ok(within(modules, installed)); assert.equal((await lstat(location)).isSymbolicLink(), false);
    const pkg = JSON.parse(await readFile(path.join(installed, 'package.json')));
    const locked = lock.packages['node_modules/' + item.name];
    assert.equal(pkg.version, item.version); assert.equal(locked.version, item.version);
    assert.ok(!locked.link && locked.resolved?.startsWith('file:'));
    const archive = path.join(copies, item.file), bytes = await readFile(archive);
    assert.equal(hash(bytes), item.sha256);
    assert.equal(locked.integrity, 'sha512-' + createHash('sha512').update(bytes).digest('base64'));
    // Same archive comparison mechanism as test-installed-code; only our verified local tarballs are extracted.
    const entries = tar(archive, '-tzf').trim().split(/\r?\n/);
    assert.ok(entries.every(file => file.startsWith('package/') && !file.split(/[\\/]/).includes('..')));
    const extracted = await mkdtemp(path.join(isolated, 'archive-'));
    tar(archive, '-xzf', ['-C', extracted]);
    const expectedRoot = path.join(extracted, 'package'), files = [];
    for (const file of entries.map(name => name.slice('package/'.length)).filter(name => name && !name.endsWith('/')).sort()) {
      const actual = await realpath(path.join(installed, file)), expected = await realpath(path.join(expectedRoot, file));
      assert.ok(within(installed, actual) && within(expectedRoot, expected));
      assert.equal((await lstat(path.join(installed, file))).isFile(), true);
      const actualBytes = await readFile(actual), expectedBytes = await readFile(expected);
      assert.deepEqual(actualBytes, expectedBytes, `Installed archive mismatch: ${item.name}/${file}`);
      files.push({path: file, bytes: actualBytes.length, sha256: hash(actualBytes)});
    }
    receipt.packages.push({name: item.name, version: item.version, archiveSha256: item.sha256, integrity: locked.integrity, realpath: installed, files});
  }
  receipt.stage = 'six-groups';
  await run(process.execPath, ['probe.mjs'], 'probe-first.log');
  const outcomes = JSON.parse(await readFile(path.join(isolated, 'outcomes.json')));
  assert.equal(outcomes.total, 6); assert.equal(outcomes.passed, 6); assert.equal(outcomes.retries, 0);
  // Recheck accepted inputs after execution; neither package cache nor the source stage may replace them.
  for (const item of selected) {
    assert.equal(hash(await readFile(path.join(artifacts, item.file))), item.sha256);
    assert.equal(hash(await readFile(path.join(copies, item.file))), item.sha256);
    for (const file of receipt.packages.find(record => record.name === item.name).files)
      assert.equal(hash(await readFile(path.join(modules, item.name, file.path))), file.sha256);
  }
  assert.equal(hash(await readFile(path.join(consumer, 'package-lock.json'))), receipt.lockSha256);
  receipt.passed = true; receipt.stage = 'complete';
} catch (error) {
  failure = error;
  receipt.error = {name: error.name, message: error.message, stack: error.stack};
}
// Preserve first failures as well as successes. Keep the temporary consumer for local diagnosis;
// CI uploads only these bounded originals, not node_modules, unpacked archives or npm caches.
if (isolated) {
  for (const name of ['artifacts', 'outputs', 'runtime.json', 'outcomes.json']) {
    try {await cp(path.join(isolated, name), path.join(report, name), {recursive: true});}
    catch (error) {if (error.code !== 'ENOENT') throw error;}
  }
  await mkdir(path.join(report, 'consumer'), {recursive: true});
  for (const name of ['package.json', 'package-lock.json', 'probe.mjs']) {
    try {await cp(path.join(consumer, name), path.join(report, 'consumer', name));}
    catch (error) {if (error.code !== 'ENOENT') throw error;}
  }
}
receipt.scope = 'Unpublished candidate preview archives with rewritten versions/ranges, installed without a renderer. Estimated public export/import only; no release-manifest, published-registry, native/font, visual or broad fidelity acceptance.';
await json(path.join(report, 'receipt.json'), receipt);
const files = [];
for (const file of (await readdir(report, {recursive: true})).sort()) {
  const absolute = path.join(report, file);
  if (!(await lstat(absolute)).isFile()) continue;
  const bytes = await readFile(absolute);
  files.push({path: file.split(path.sep).join('/'), bytes: bytes.length, sha256: hash(bytes)});
}
await json(path.join(report, 'SHA256SUMS.json'), {files});
console.log(`Renderer-absent furniture ${receipt.passed ? 'passed 6/6' : 'FAILED'}; evidence: ${report}`);
if (failure) throw failure;
