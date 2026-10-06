import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { examplesDigest, RETAINED_CORE_GOLDENS, reviewedCoreGolden } from './registry-golden.mjs';

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
