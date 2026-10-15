import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { examplesDigest, readPublishedCoreGolden, RETAINED_CORE_GOLDENS, reviewedCoreGolden } from './registry-golden.mjs';

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

test('the lock\'s core golden is selected only for the corpus it records', () => {
  const directory = checkout('a'.repeat(64));
  const lock = { golden: { repository: 'opf', path: 'scripts/fixtures/golden.json' } };
  assert.equal(reviewedCoreGolden({ root: directory, lock, digest: 'a'.repeat(64) }), path.join(directory, 'scripts/fixtures/golden.json'));
  assert.equal(reviewedCoreGolden({ root: directory, lock, digest: 'b'.repeat(64), retained: [] }), undefined);
});

test('a retained reviewed golden is selected for the older corpus a published core still ships, the lock golden first', () => {
  const directory = checkout('a'.repeat(64), { 'older.json': 'b'.repeat(64) });
  const lock = { golden: { repository: 'opf', path: 'scripts/fixtures/golden.json' } };
  const retained = ['scripts/fixtures/older.json'];
  assert.equal(reviewedCoreGolden({ root: directory, lock, digest: 'a'.repeat(64), retained }), path.join(directory, 'scripts/fixtures/golden.json'));
  assert.equal(reviewedCoreGolden({ root: directory, lock, digest: 'b'.repeat(64), retained }), path.join(directory, 'scripts/fixtures/older.json'));
  assert.equal(reviewedCoreGolden({ root: directory, lock, digest: 'c'.repeat(64), retained }), undefined);
  assert.throws(() => reviewedCoreGolden({ root: directory, lock, digest: 'c'.repeat(64), retained: ['../elsewhere.json'] }), /leaves the checkout/);
});

test('every retained golden exists, is a core fixture and records a corpus other than the lock golden', () => {
  const lock = JSON.parse(readFileSync(path.join(root, 'ecosystem.lock.json'), 'utf8'));
  const current = lock.golden.repository === 'opf' ? JSON.parse(readFileSync(path.join(root, lock.golden.path), 'utf8')).source.sha256 : undefined;
  for (const relative of RETAINED_CORE_GOLDENS) {
    assert.match(relative, /^scripts\/fixtures\/opf-examples-png\.[a-z0-9-]+\.sha256\.json$/);
    const baseline = JSON.parse(readFileSync(path.join(root, relative), 'utf8'));
    assert.match(baseline.source.sha256, /^[0-9a-f]{64}$/);
    assert.notEqual(baseline.source.sha256, current, `${relative} records the lock golden's corpus; drop it from RETAINED_CORE_GOLDENS`);
  }
});

test('a golden owned by another repository, or one that leaves the checkout, is never selected', () => {
  const directory = checkout('a'.repeat(64));
  assert.equal(reviewedCoreGolden({ root: directory, lock: { golden: { repository: 'opf-render', path: 'test/golden/x.json' } }, digest: 'a'.repeat(64) }), undefined);
  assert.throws(() => reviewedCoreGolden({ root: directory, lock: { golden: { repository: 'opf', path: '../elsewhere.json' } }, digest: 'a'.repeat(64) }), /leaves the checkout/);
});

function readCorpus(directory, prefix = '') {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) return readCorpus(path.join(directory, entry.name), file);
    return entry.isFile() && entry.name.endsWith('.opf.json') ? [{ file, deck: JSON.parse(readFileSync(path.join(directory, entry.name), 'utf8')) }] : [];
  });
}

test('the checked-in lock golden records the digest of this checkout\'s examples (it is what the published core ships)', () => {
  const lock = JSON.parse(readFileSync(path.join(root, 'ecosystem.lock.json'), 'utf8'));
  if (lock.golden.repository !== 'opf') return;
  const baseline = JSON.parse(readFileSync(path.join(root, lock.golden.path), 'utf8'));
  const corpus = readCorpus(path.join(root, 'examples'));
  assert.equal(baseline.source.decks, corpus.length);
  assert.equal(baseline.source.sha256, examplesDigest(corpus));
});
