import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Office-free: validates preserved inputs, then optionally reproduces one CLI export.
const root = path.dirname(fileURLToPath(import.meta.url));
const sealed = path.join(root, 'sealed-cli');
const expectedSuite = '92ba749bd37f156e3b197567c5adcb85e9a00af8adeb41937ca21cda01c70f17';
const expectedRevision = 'df24cd2a480e580d9f987ad1ce4772c03453773f';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const args = process.argv.slice(2);
const options = {};
for (let index = 0; index < args.length; index += 1) {
  const key = args[index];
  assert.ok(['--verify-only', '--repository', '--case', '--output'].includes(key), 'unknown option: ' + key);
  assert.ok(!(key in options), 'duplicate option: ' + key);
  if (key === '--verify-only') options[key] = true;
  else {
    const value = args[++index];
    assert.ok(value && !value.startsWith('--'), 'missing value: ' + key);
    options[key] = value;
  }
}
assert.equal(Number(process.versions.node.split('.')[0]), 24, 'use Node 24');
function localFile(base, relative) {
  assert.match(relative, /^[a-zA-Z0-9_./-]+$/);
  assert.ok(!relative.split('/').some(part => part === '..' || part === ''));
  const target = path.resolve(base, relative);
  assert.ok(target.startsWith(path.resolve(base) + path.sep), 'path escaped root');
  assert.ok(fs.lstatSync(target).isFile(), 'expected regular file: ' + relative);
  return target;
}
function verify(base, record) {
  const bytes = fs.readFileSync(localFile(base, record.path));
  assert.equal(bytes.length, record.bytes, 'byte length: ' + record.path);
  assert.equal(digest(bytes), record.sha256, 'SHA-256: ' + record.path);
}
const suiteBytes = fs.readFileSync(path.join(sealed, 'suite.json'));
assert.equal(digest(suiteBytes), expectedSuite, 'unchanged sealed suite');
const suite = JSON.parse(suiteBytes);
assert.equal(suite.files.length, 212);
for (const record of suite.files) verify(sealed, record);
assert.equal(suite.cases.length, 32);
const buildBytes = fs.readFileSync(path.join(sealed, 'build.json'));
assert.equal(digest(buildBytes), suite.provenance.sourceCliManifest.sha256);
const build = JSON.parse(buildBytes);
assert.equal(build.sourceRevision, expectedRevision);
assert.equal(build.sourceDirty, false);
if (options['--verify-only']) {
  assert.equal(args.length, 1, '--verify-only takes no other options');
  console.log(JSON.stringify({ ok: true, suiteSha256: expectedSuite, files: suite.files.length, cases: suite.cases.length, officeCalls: 0 }));
  process.exit(0);
}
assert.ok(options['--repository'] && options['--case'] && options['--output'], 'use --verify-only, or --repository <clean checkout> --case <id> --output <fresh directory>');
const repository = fs.realpathSync(options['--repository']);
const git = argv => execFileSync('git', argv, { cwd: repository, encoding: 'utf8', windowsHide: true }).trim();
assert.equal(git(['rev-parse', 'HEAD']), expectedRevision, 'exact source revision');
assert.equal(git(['status', '--porcelain']), '', 'source checkout must be clean');
for (const record of suite.provenance.suiteRepository.files) verify(repository, record);
for (const record of suite.provenance.workerRepository.files) verify(path.join(repository, 'packages/pptx'), record);
for (const record of build.cli.distFiles) verify(repository, record);
const selected = build.cases.find(item => item.id === options['--case']);
assert.ok(selected, 'unknown exact case ID');
const output = path.resolve(options['--output']);
const overlaps = (left, right) => left === right || left.startsWith(right + path.sep) || right.startsWith(left + path.sep);
for (const protectedRoot of [repository, fs.realpathSync(root)]) {
  assert.ok(!overlaps(output, protectedRoot), 'output must be outside source and evidence roots');
}
assert.ok(!fs.existsSync(output), 'output must not already exist');
assert.ok(fs.statSync(path.dirname(output)).isDirectory(), 'output parent must already exist');
fs.mkdirSync(output); // Exclusive creation, no overwrite or recursive deletion.
const input = path.join(output, 'source.opf.json');
fs.copyFileSync(localFile(sealed, selected.source.path), input, fs.constants.COPYFILE_EXCL);
const cli = path.join(repository, 'packages/cli/dist/index.js');
const outputs = [];
let failure;
try {
  for (const [name, extra, expected] of [
    ['input.pptx', [], selected.archiveSha256],
    ['preview.png', ['--slides', '1'], selected.previewSha256],
  ]) {
    const target = path.join(output, name);
    const stdout = execFileSync(process.execPath, [cli, 'convert', input, target, ...extra], {
      cwd: repository, encoding: 'utf8', windowsHide: true, timeout: 60000, maxBuffer: 4e6,
    });
    const report = JSON.parse(stdout.replace(/^\uFEFF/, ''));
    fs.writeFileSync(path.join(output, name + '-report.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    assert.equal(report.ok, true, 'CLI conversion success');
    const bytes = fs.readFileSync(target);
    outputs.push({ name, bytes: bytes.length, sha256: digest(bytes), expectedSha256: expected, matches: digest(bytes) === expected });
  }
  assert.ok(outputs.every(item => item.matches), 'fresh export differs; inspect preserved outputs and reports');
  assert.equal(git(['status', '--porcelain']), '', 'CLI must not change source checkout');
} catch (error) {
  failure = String(error?.stack ?? error);
} finally {
  fs.writeFileSync(path.join(output, 'reproduction.json'), JSON.stringify({
    ok: !failure, sourceRevision: expectedRevision, suiteSha256: expectedSuite, case: selected.id,
    node: process.version, officeCalls: 0, outputs, ...(failure ? { failure } : {}),
  }, null, 2) + '\n', { flag: 'wx' });
}
if (failure) throw new Error(failure);
console.log(JSON.stringify({ ok: true, case: selected.id, matchingExports: outputs.length, officeCalls: 0, output }));
