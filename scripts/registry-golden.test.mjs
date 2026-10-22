import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { VARIANTS_EXAMPLE_BASELINE } from '../packages/render/scripts/example-baseline.mjs';
import { examplesDigest, readPublishedCoreGolden } from './registry-golden.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha = (value) => createHash('sha256').update(value).digest('hex');

test('the digest sorts files, ignores key order and strips the examples/ prefix, like the renderer golden test', () => {
  const a = [{ file: 'examples/b.opf.json', deck: { z: 1, a: [{ y: 2, x: 1 }] } }, { file: 'examples/a.opf.json', deck: { k: 'v' } }];
  const b = [{ file: 'a.opf.json', deck: { k: 'v' } }, { file: 'b.opf.json', deck: { a: [{ x: 1, y: 2 }], z: 1 } }];
  assert.equal(examplesDigest(a), examplesDigest(b));
  assert.equal(examplesDigest(a), sha(JSON.stringify([['a.opf.json', { k: 'v' }], ['b.opf.json', { a: [{ x: 1, y: 2 }], z: 1 }]])));
  assert.notEqual(examplesDigest(a), examplesDigest([{ file: 'a.opf.json', deck: { k: 'w' } }, b[1]]));
});

function checkout(digest, extra = {}) {
  const directory = mkdtempSync(path.join(tmpdir(), 'registry-golden-'));
  mkdirSync(path.join(directory, 'scripts/fixtures'), { recursive: true });
  writeFileSync(path.join(directory, 'scripts/fixtures/golden.json'), JSON.stringify({ version: 2, source: { sha256: digest }, entries: {} }));
  for (const [name, other] of Object.entries(extra)) writeFileSync(path.join(directory, 'scripts/fixtures', name), JSON.stringify({ version: 2, source: { sha256: other }, entries: {} }));
  return directory;
}

function publishedCheckout() {
  const digest = 'a'.repeat(64);
  const directory = checkout(digest);
  mkdirSync(path.join(directory, 'packages/javascript'), { recursive: true });
  writeFileSync(path.join(directory, 'packages/javascript/package.json'), JSON.stringify({ version: '0.20.1' }));
  writeFileSync(path.join(directory, 'ecosystem.lock.json'), JSON.stringify({ golden: { repository: 'opf', path: 'scripts/fixtures/golden.json' } }));
  const git = (...args) => execFileSync('git', args, { cwd: directory, encoding: 'utf8', stdio: 'pipe' }).trim();
  git('init', '--quiet');
  const commit = () => {
    git('add', '.');
    git('-c', 'user.name=Registry golden test', '-c', 'user.email=registry-test@example.invalid', 'commit', '--quiet', '-m', 'fixture');
    return git('rev-parse', 'HEAD');
  };
  return { directory, digest, git, commit };
}

test('registry golden preserves exact release bytes when current source moves pixels for the same examples', () => {
  const { directory, digest, commit } = publishedCheckout();
  const file = path.join(directory, 'scripts/fixtures/golden.json');
  const released = Buffer.from(JSON.stringify({ version: 2, source: { sha256: digest }, entries: { metric: { sha256: 'b'.repeat(64), bytes: 42 } } }, null, 3) + '\n');
  writeFileSync(file, released);
  const ref = commit();
  writeFileSync(file, JSON.stringify({ version: 2, source: { sha256: digest }, entries: { metric: { sha256: 'c'.repeat(64), bytes: 43 } } }));
  commit();
  const result = readPublishedCoreGolden({ root: directory, ref, version: '0.20.1', digest });
  assert.equal(result.path, 'scripts/fixtures/golden.json');
  assert.equal(result.ref, ref);
  assert.deepEqual(result.bytes, released);
  assert.notDeepEqual(result.bytes, readFileSync(file));
});

test('registry golden rejects invalid, unavailable or wrong-version source refs and a different installed corpus', () => {
  const { directory, digest, commit } = publishedCheckout();
  const ref = commit();
  const options = { root: directory, ref, version: '0.20.1', digest };
  for (const invalid of [undefined, 'main', '../outside', 'a'.repeat(39)]) {
    assert.throws(() => readPublishedCoreGolden({ ...options, ref: invalid }), /immutable registry verification ref/);
  }
  assert.throws(() => readPublishedCoreGolden({ ...options, ref: '0'.repeat(40) }), /git show/);
  assert.throws(() => readPublishedCoreGolden({ ...options, version: '0.20.2' }), /does not match installed/);
  assert.throws(() => readPublishedCoreGolden({ ...options, digest: 'd'.repeat(64) }), /installed examples digest/);
  writeFileSync(path.join(directory, 'packages/javascript/package.json'), JSON.stringify({ version: '0.20.2' }));
  const differentRelease = commit();
  assert.throws(() => readPublishedCoreGolden({ ...options, ref: differentRelease }), /does not match installed/);
});

test('registry golden refuses escaped paths and missing release fixtures', () => {
  const { directory, digest, commit } = publishedCheckout();
  const options = { root: directory, version: '0.20.1', digest };
  for (const fixture of ['../golden.json', 'scripts/fixtures/../../../golden.json', 'scripts/fixtures\\golden.json']) {
    writeFileSync(path.join(directory, 'ecosystem.lock.json'), JSON.stringify({ golden: { repository: 'opf', path: fixture } }));
    assert.throws(() => readPublishedCoreGolden({ ...options, ref: commit() }), /leaves the fixture directory/);
  }
  writeFileSync(path.join(directory, 'ecosystem.lock.json'), JSON.stringify({ golden: { repository: 'opf', path: 'scripts/fixtures/missing.json' } }));
  assert.throws(() => readPublishedCoreGolden({ ...options, ref: commit() }), /git show/);
});

function readCorpus(directory, prefix = '') {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) return readCorpus(path.join(directory, entry.name), file);
    return entry.isFile() && entry.name.endsWith('.opf.json') ? [{ file, deck: JSON.parse(readFileSync(path.join(directory, entry.name), 'utf8')) }] : [];
  });
}

test('the default renderer baseline records the digest of this checkout\'s examples', () => {
  // MR-31: the examples corpus is the input of packages/render/test/golden/. When examples/ or core's conversion moves, the
  // baseline's source digest moves with it (`pnpm golden:update` in the pinned image, or the golden workflow).
  const selected = path.join(root, 'packages/render', VARIANTS_EXAMPLE_BASELINE.replace(/\.sha256\.json$/, ''), '_baseline.json');
  const baseline = JSON.parse(readFileSync(selected, 'utf8'));
  const corpus = readCorpus(path.join(root, 'examples'));
  assert.equal(baseline.source.decks, corpus.length);
  assert.equal(baseline.source.sha256, examplesDigest(corpus));
});
