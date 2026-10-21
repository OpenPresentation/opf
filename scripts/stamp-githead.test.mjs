// MR-10: stamp-githead adds gitHead to a packed tarball and changes nothing else.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { tar } from './archive-tar.mjs';
import { stampGitHead } from './stamp-githead.mjs';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'stamp-githead.mjs');
const temp = mkdtempSync(path.join(tmpdir(), 'opf-stamp-test-'));
const COMMIT = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
after(() => rmSync(temp, { recursive: true, force: true }));

function pack(name) {
  const dir = path.join(temp, name.replace(/\W/g, '-'));
  mkdirSync(path.join(dir, 'package/dist'), { recursive: true });
  writeFileSync(path.join(dir, 'package/package.json'), `${JSON.stringify({ name, version: '0.26.0', repository: { url: 'git+https://github.com/OpenPresentation/opf.git' } }, null, 2)}\n`);
  writeFileSync(path.join(dir, 'package/dist/index.js'), 'export default 1;\n');
  writeFileSync(path.join(dir, 'package/README.md'), '# readme\n');
  const tarball = path.join(dir, 'out.tgz');
  tar(tarball, '-czf', ['-C', dir, 'package']);
  return { dir, tarball };
}
const list = (tarball) => tar(tarball, '-tzf').split('\n').filter(Boolean).sort();
function read(tarball, file) {
  const out = path.join(temp, `read-${path.basename(path.dirname(tarball))}`);
  mkdirSync(out, { recursive: true });
  tar(tarball, '-xzf', ['-C', out]);
  return spawnSync(process.execPath, ['-e', `process.stdout.write(require('fs').readFileSync(${JSON.stringify(path.join(out, file))}, 'utf8'))`], { encoding: 'utf8' }).stdout;
}

test('gitHead is added to package/package.json; the other fields and files are unchanged', () => {
  const { tarball } = pack('@openpresentation/cli');
  const files = list(tarball);
  assert.deepEqual(stampGitHead(tarball, COMMIT), { name: '@openpresentation/cli', version: '0.26.0' });
  const manifest = JSON.parse(read(tarball, 'package/package.json'));
  assert.equal(manifest.gitHead, COMMIT);
  assert.deepEqual({ ...manifest, gitHead: undefined }, { name: '@openpresentation/cli', version: '0.26.0', repository: { url: 'git+https://github.com/OpenPresentation/opf.git' }, gitHead: undefined });
  assert.deepEqual(list(tarball), files);
  assert.equal(read(tarball, 'package/dist/index.js'), 'export default 1;\n');
});

test('stamping twice replaces the value', () => {
  const { tarball } = pack('@openpresentation/gallery');
  stampGitHead(tarball, COMMIT);
  stampGitHead(tarball, 'f'.repeat(40));
  assert.equal(JSON.parse(read(tarball, 'package/package.json')).gitHead, 'f'.repeat(40));
});

test('a value that is not a full commit SHA is refused and the tarball is left alone', () => {
  const { tarball } = pack('@openpresentation/opf');
  assert.throws(() => stampGitHead(tarball, 'main'), /40-character commit SHA/);
  assert.equal(JSON.parse(read(tarball, 'package/package.json')).gitHead, undefined);
});

test('the command line stamps every tarball and prints one line each; no arguments is a usage error', () => {
  const first = pack('@openpresentation/opf-render');
  const second = pack('@openpresentation/opf-pptx');
  const result = spawnSync(process.execPath, [script, COMMIT, first.tarball, second.tarball], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim().split('\n').length, 2);
  assert.match(result.stdout, /stamped @openpresentation\/opf-render@0\.26\.0 /);
  assert.equal(spawnSync(process.execPath, [script], { encoding: 'utf8' }).status, 64);
});
