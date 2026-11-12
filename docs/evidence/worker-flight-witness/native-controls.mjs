// NEVERMERGE diagnostic adjunct. Original tests/helpers and their internal deadlines stay unchanged.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync, spawnSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';

const BASE = '79cdb85d6ab8a58dde5d474e254cffa027735c51';
const TARGET = 'scripts/native-acceptance/reference-name-snapshot.test.mjs';
const PREFIX = 'opf-name-snapshots-';
const ROOT = fs.realpathSync.native(fileURLToPath(new URL('../../../', import.meta.url)));
const OPERATIVE = ['packages', 'spec', 'scripts', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'];
const REQUIRED = [TARGET, 'scripts/native-acceptance/reference-name-snapshot-check.ps1', 'packages/pptx/test/native-furniture-control.ps1', 'scripts/native-acceptance/furniture-postflight.ps1', 'scripts/native-acceptance/owned-postflight.ps1', 'scripts/native-acceptance/owned-postflight.mjs', 'scripts/native-acceptance/run-reference-chart-profile.ps1', 'scripts/native-acceptance/windows-powershell-env.mjs', 'scripts/native-acceptance/test-fixtures/reference-chart/native-process.ps1'];
const PACKAGES = [['javascript', '@openpresentation/opf'], ['gallery', '@openpresentation/gallery'], ['render', '@openpresentation/opf-render/fonts-node'], ['pptx', '@openpresentation/opf-pptx']];
const git = (...args) => execFileSync('git', args, {cwd: ROOT, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024}).trim();
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const record = file => {const bytes = fs.readFileSync(file); return {bytes: bytes.length, sha256: hash(bytes)};};
const relative = file => path.relative(ROOT, file).split(path.sep).join('/');
const inside = (parent, child) => {const value = path.relative(parent, child); return value !== '' && !value.startsWith(`..${path.sep}`) && value !== '..' && !path.isAbsolute(value);};
const json = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, {flag: 'wx'});
const failure = error => ({name: error.name, message: error.message, code: error.code ?? null, stack: error.stack ?? null});
function filesIn(directory, prefix = '') {
  const rows = [];
  for (const entry of fs.readdirSync(directory, {withFileTypes: true}).sort((a, b) => a.name.localeCompare(b.name))) {
    const file = path.join(directory, entry.name), name = prefix ? `${prefix}/${entry.name}` : entry.name, stat = fs.lstatSync(file);
    assert.ok(!stat.isSymbolicLink(), `No linked evidence/runtime entry: ${name}`);
    if (stat.isDirectory()) rows.push(...filesIn(file, name));
    else {assert.ok(stat.isFile(), `One regular file required: ${name}`); rows.push({file: name, ...record(file)});}
  }
  return rows;
}
function sourceBinding(expectedHead) {
  const head = git('rev-parse', 'HEAD'); assert.equal(head, expectedHead); assert.notEqual(head, BASE, 'Diagnostic source is a distinct evidence commit, not product79');
  assert.equal(git('rev-parse', 'HEAD^'), BASE, 'One reviewed diagnostic commit directly on79; depth2 is sufficient');
  assert.equal(git('status', '--porcelain', '--untracked-files=no'), '', 'Actual diagnostic tracked source is clean');
  const self = relative(fileURLToPath(import.meta.url)), committedSelf = execFileSync('git', ['show', `HEAD:${self}`], {cwd: ROOT});
  assert.deepEqual(record(path.join(ROOT, self)), {bytes: committedSelf.length, sha256: hash(committedSelf)}, 'This actual adjunct is the diagnostic commit file');
  assert.equal(git('diff', '--no-ext-diff', '--name-only', BASE, '--', ...OPERATIVE), '', 'Actual operative tracked source must equal base79');
  assert.equal(git('ls-files', '--others', '--exclude-standard', '--', ...OPERATIVE), '', 'No extra operative source files');
  const files = REQUIRED.map(file => {const expected = execFileSync('git', ['show', `${BASE}:${file}`], {cwd: ROOT}), actual = record(path.join(ROOT, file)); assert.deepEqual(actual, {bytes: expected.length, sha256: hash(expected)}, `Actual operative bytes equal79: ${file}`); return {file, ...actual};});
  return {diagnosticHead: head, diagnosticTree: git('rev-parse', 'HEAD^{tree}'), operativeBase: BASE, sameProductHEAD: false, operativeRoots: OPERATIVE, files};
}
function runtimeBinding() {
  const require = createRequire(path.join(ROOT, 'package.json'));
  return PACKAGES.map(([folder, specifier]) => {
    const directory = fs.realpathSync.native(path.join(ROOT, 'packages', folder)), dist = path.join(directory, 'dist'), entry = fs.realpathSync.native(require.resolve(specifier));
    assert.ok(inside(ROOT, directory) && !fs.lstatSync(path.join(ROOT, 'packages', folder)).isSymbolicLink(), 'Owned package directory only');
    const manifest = fs.realpathSync.native(require.resolve(`${specifier.split('/').slice(0, 2).join('/')}/package.json`)); assert.equal(manifest, path.join(directory, 'package.json'), 'Public package manifest belongs to this workspace');
    assert.ok(inside(dist, entry), `${specifier} must resolve into this built workspace, not another consumer`);
    const files = filesIn(dist); assert.ok(files.length > 0);
    return {package: folder, specifier, entry: relative(entry), manifest: record(manifest), files};
  });
}
function namespace(tmp) {
  // Inventory only this known test prefix; never open any pre-existing or unrelated temp directory.
  return fs.readdirSync(tmp, {withFileTypes: true}).filter(entry => entry.name.startsWith(PREFIX)).map(entry => entry.name).sort();
}
function retainTemps(tmp, before, output) {
  const after = namespace(tmp), created = after.filter(name => !before.includes(name)), retained = [];
  json(path.join(output, 'temp-after.json'), {prefix: PREFIX, names: after, created});
  for (const name of created) {
    const directory = path.join(tmp, name), stat = fs.lstatSync(directory); assert.ok(stat.isDirectory() && !stat.isSymbolicLink());
    const canonical = fs.realpathSync.native(directory); assert.ok(inside(fs.realpathSync.native(tmp), canonical));
    const rows = filesIn(directory), destination = path.join(output, 'owned-temp', name);
    fs.mkdirSync(destination, {recursive: true});
    for (const row of rows) {const target = path.join(destination, ...row.file.split('/')); fs.mkdirSync(path.dirname(target), {recursive: true}); fs.copyFileSync(path.join(directory, ...row.file.split('/')), target, fs.constants.COPYFILE_EXCL); assert.deepEqual(record(target), {bytes: row.bytes, sha256: row.sha256});}
    const resultFile = path.join(directory, 'managed', 'result.json');
    const result = fs.existsSync(resultFile) ? JSON.parse(fs.readFileSync(resultFile, 'utf8').replace(/^\uFEFF/u, '')) : null;
    retained.push({name, canonical, files: rows, managedResult: result});
  }
  json(path.join(output, 'owned-temp-inventory.json'), {prefix: PREFIX, before, after, created, retained});
  return retained;
}
function tapSummary(text) {
  const result = {};
  for (const line of text.split(/\r?\n/u)) {const match = /^# (tests|pass|fail|cancelled|skipped|todo) ([0-9]+)$/u.exec(line); if (match) {assert.ok(!Object.hasOwn(result, match[1]), 'One anchored TAP summary value per field'); result[match[1]] = Number(match[2]);}}
  return result;
}
function invoke(command, args, output, stem, options = {}) {
  const stdout = path.join(output, `${stem}.stdout.log`), stderr = path.join(output, `${stem}.stderr.log`), out = fs.openSync(stdout, 'wx'), err = fs.openSync(stderr, 'wx'), startedAt = new Date().toISOString(), start = performance.now();
  let result;
  try {result = spawnSync(command, args, {cwd: ROOT, stdio: ['ignore', out, err], ...options});} finally {fs.closeSync(out); fs.closeSync(err);}
  return {command: [command, ...args], startedAt, seconds: (performance.now() - start) / 1000, exitCode: result.status, signal: result.signal, error: result.error ? failure(result.error) : null, stdout: {file: path.basename(stdout), ...record(stdout)}, stderr: {file: path.basename(stderr), ...record(stderr)}};
}

const argv = process.argv.slice(2), options = {};
assert.equal(argv.length, 4, 'Use --expect-head <diagnostic SHA> --output <fresh artifact directory>');
for (let index = 0; index < argv.length; index += 2) {assert.ok(['--expect-head', '--output'].includes(argv[index]) && !Object.hasOwn(options, argv[index])); options[argv[index]] = argv[index + 1];}
assert.match(options['--expect-head'] ?? '', /^[a-f0-9]{40}$/u);
const output = path.resolve(options['--output']); assert.ok(inside(path.join(ROOT, 'artifacts'), output), 'Output is a fresh owned artifacts child'); assert.ok(!fs.existsSync(output), 'Keep the first diagnostic output; no retry/overwrite');
for (let parent = path.dirname(output); inside(ROOT, parent); parent = path.dirname(parent)) if (fs.existsSync(parent)) assert.ok(fs.lstatSync(parent).isDirectory() && !fs.lstatSync(parent).isSymbolicLink(), 'No linked output ancestor');
fs.mkdirSync(output, {recursive: true});
const receipt = {schemaVersion: 1, scope: 'OFFICE_FREE_MAINTAINED_REFERENCE_SNAPSHOT_CONTROLS_NOT_NATIVE_ACCEPTANCE', status: 'STARTED', node: process.version, platform: process.platform, architecture: process.arch, nodeExecutable: process.execPath, source: null, runtimeBefore: null, versionProbe: null, test: null, ownedTemps: null, failure: null, officeInvokedByRunner: false, processQueriesByRunner: false, registryAcceptance: false, nativeAcceptance: false};
let tmp, before;
try {
  assert.equal(process.platform, 'win32', 'Actual Windows required; a Mac skip is not PS32 qualification');
  assert.ok(!Object.keys(process.env).some(key => ['node_options', 'node_path'].includes(key.toLowerCase()) && process.env[key]), 'No NODE_OPTIONS or NODE_PATH injection'); assert.equal(process.execArgv.length, 0, 'No Node loader/preload flags');
  receipt.source = sourceBinding(options['--expect-head']); receipt.runtimeBefore = runtimeBinding();
  json(path.join(output, 'admission.json'), {source: receipt.source, node: receipt.node, runtime: receipt.runtimeBefore, helper: record(fileURLToPath(import.meta.url))});
  const {windowsPowerShellEnvironment} = await import(pathToFileURL(path.join(ROOT, 'scripts/native-acceptance/windows-powershell-env.mjs')).href);
  const ps = path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'); assert.ok(fs.statSync(ps).isFile()); receipt.powerShellExecutable = {path: ps, ...record(ps)};
  receipt.versionProbe = invoke(ps, ['-NoProfile', '-NonInteractive', '-Command', "$ErrorActionPreference='Stop';if($PSVersionTable.PSEdition -cne 'Desktop' -or $PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -ne 1){throw 'Actual Windows PowerShell5.1 Desktop required'};[ordered]@{edition=$PSVersionTable.PSEdition;version=$PSVersionTable.PSVersion.ToString()}|ConvertTo-Json -Compress"], output, 'powershell-version', {env: windowsPowerShellEnvironment(process.env)});
  assert.equal(receipt.versionProbe.exitCode, 0, 'Read-only actual PS5.1 Desktop version probe must pass');
  receipt.powerShell = JSON.parse(fs.readFileSync(path.join(output, receipt.versionProbe.stdout.file), 'utf8').replace(/^\uFEFF/u, '')); assert.equal(receipt.powerShell.edition, 'Desktop'); assert.match(receipt.powerShell.version, /^5\.1\./u);
  tmp = os.tmpdir(); before = namespace(tmp); json(path.join(output, 'temp-before.json'), {prefix: PREFIX, names: before});
  // Exactly one maintained file; the embedded new8 handshake +13 Save +11 private-adapter cases are its PS32.
  // The separate historical native-reference-startup eight-case test is never invoked here.
  receipt.test = invoke(process.execPath, ['--test', '--test-reporter=tap', TARGET], output, 'maintained-test', {env: process.env});
  if (receipt.test.exitCode !== 0 || receipt.test.signal || receipt.test.error) receipt.failure = {name: 'MaintainedTestFailure', message: 'Original test did not exit0; retained stdout/stderr is authoritative', code: receipt.test.exitCode};
  receipt.tapSummary = tapSummary(fs.readFileSync(path.join(output, receipt.test.stdout.file), 'utf8'));
} catch (error) {receipt.failure ??= failure(error);}
try {
  if (before) receipt.ownedTemps = retainTemps(tmp, before, output);
  if (receipt.test) {
    receipt.sourceAfter = sourceBinding(options['--expect-head']); receipt.runtimeAfter = runtimeBinding(); assert.deepEqual(receipt.sourceAfter, receipt.source); assert.deepEqual(receipt.runtimeAfter, receipt.runtimeBefore);
    assert.equal(receipt.test.exitCode, 0, 'Original maintained test file failed; inspect retained stdout/stderr and owned temp'); assert.equal(receipt.test.signal, null); assert.equal(receipt.test.error, null);
    assert.deepEqual(receipt.tapSummary, {tests: 9, pass: 9, fail: 0, cancelled: 0, skipped: 0, todo: 0}, 'All eight portable tests and the actual managed-PS test pass without skips');
    assert.equal(receipt.ownedTemps.length, 1, 'The exact file creates one new owned PS-controls temp directory');
    const result = receipt.ownedTemps[0].managedResult; assert.ok(result); assert.equal(result.officeInvoked, false); assert.equal(result.realProcessQueries, 0); assert.equal(result.genuineStartupArchive, false); assert.equal(result.earlierSourceBootstrapExercised, false);
    for (const [key, count] of [['startup', 8], ['saves', 13], ['adapter', 11]]) {assert.equal(result[key].length, count); assert.ok(result[key].every(row => row.passed === true));}
    receipt.actualManagedScenarios = {startup: 8, saves: 13, privateAdapter: 11, total: 32};
  }
} catch (error) {receipt.postcheckFailure = failure(error); receipt.failure ??= receipt.postcheckFailure;}
if (!receipt.failure && (!receipt.test || receipt.actualManagedScenarios?.total !== 32)) receipt.failure = {name: 'IncompleteControls', message: 'No complete actual32 result', code: null};
receipt.status = receipt.failure ? 'FAILED' : 'PASS';
json(path.join(output, 'receipt.json'), receipt);
console.log(JSON.stringify({scope: receipt.scope, status: receipt.status, diagnosticHead: receipt.source?.diagnosticHead ?? null, operativeBase: BASE, node: receipt.node, managed: receipt.actualManagedScenarios ?? null, testExitCode: receipt.test?.exitCode ?? null, output}));
if (receipt.failure) process.exitCode = 1;
