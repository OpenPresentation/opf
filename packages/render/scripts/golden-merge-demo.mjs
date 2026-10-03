// RR-52 acceptance demo: two golden-moving branches that move different decks merge without a textual conflict
// under the new layout (per-deck files and a notes file per PR) and conflict under the old way of working (one
// manifest and a review note prepended to test/golden/README.md). A throwaway local git repository in the OS temp
// directory; nothing touches GitHub. Finding recorded here: git already merges disjoint decks of the single manifest
// cleanly (0 of 400 random trials conflicted), so what conflicted in practice was the README prepend and same-deck moves.
//
//   node scripts/golden-merge-demo.mjs [--old-ref <git ref of the single-file layout>]   (default: the last commit before RR-52)
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assembleBaseline, deckOfKey, serialize, writeBaseline } from '../test/golden-store.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const oldRef = args.includes('--old-ref') ? args[args.indexOf('--old-ref') + 1] : '9e00ed724010444477c1be9c629c67aae1b9f53b'; // renderer main before RR-52
const name = 'opf-examples-png.cover-centering';
const oldText = execFileSync('git', ['show', `${oldRef}:test/golden/${name}.sha256.json`], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const manifest = JSON.parse(oldText);
assert.equal(serialize(assembleBaseline(path.join(root, 'test/golden', name))), oldText, 'The per-deck baseline must equal the old manifest');
const decks = [...new Set(Object.keys(manifest.entries).map(deckOfKey))];

// What a regenerated golden looks like: the moved decks get new hashes and sizes.
const move = (base, moved, tag) => {
  const next = structuredClone(base);
  for (const key of Object.keys(next.entries)) {
    if (!moved.includes(deckOfKey(key))) continue;
    next.entries[key] = { sha256: createHash('sha256').update(base.entries[key].sha256 + tag).digest('hex'), bytes: base.entries[key].bytes + 7 };
  }
  return next;
};
const oldReadme = execFileSync('git', ['show', `${oldRef}:test/golden/README.md`], { cwd: root, encoding: 'utf8' });
const newReadme = readFileSync(path.join(root, 'test/golden/README.md'), 'utf8');
// Old way of working: every golden-moving PR prepended its review note to test/golden/README.md.
// New way: it adds test/golden/notes/<id>.md and leaves the README alone.
const note = id => `## ${id}: golden review note\n\nMoved decks and how they were reviewed.\n`;
const scenarios = [
  { label: 'different decks (30 interleaved decks each), with a review note', a: decks.filter((_, i) => i % 4 === 0).slice(0, 30), b: decks.filter((_, i) => i % 4 === 2).slice(0, 30), notes: true },
  { label: 'different decks, no review note (the control: the manifest alone)', a: decks.filter((_, i) => i % 4 === 0).slice(0, 30), b: decks.filter((_, i) => i % 4 === 2).slice(0, 30), notes: false },
  { label: 'the same deck moved by both, no review note', a: [decks[60]], b: [decks[60]], notes: false },
];

const results = [];
for (const layout of ['single-file (old)', 'per-deck (new)']) {
  const old = layout.startsWith('single');
  for (const scenario of scenarios) {
    const dir = mkdtempSync(path.join(tmpdir(), 'opf-golden-merge-demo-'));
    const git = (...a) => execFileSync('git', ['-c', 'user.name=demo', '-c', 'user.email=demo@example.invalid', '-c', 'commit.gpgsign=false', ...a], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const writeGolden = state => { if (old) writeFileSync(path.join(dir, `${name}.sha256.json`), serialize(state)); else writeBaseline(path.join(dir, name), state); };
    const writeNote = id => {
      if (!scenario.notes) return;
      if (old) writeFileSync(path.join(dir, 'README.md'), note(id) + '\n' + readFileSync(path.join(dir, 'README.md'), 'utf8'));
      else { mkdirSync(path.join(dir, 'notes'), { recursive: true }); writeFileSync(path.join(dir, 'notes', `${id}.md`), note(id)); }
    };
    try {
      git('init', '-q', '-b', 'main');
      writeGolden(manifest); writeFileSync(path.join(dir, 'README.md'), old ? oldReadme : newReadme); git('add', '-A'); git('commit', '-q', '-m', 'baseline');
      git('checkout', '-q', '-b', 'pr-a'); writeGolden(move(manifest, scenario.a, 'a')); writeNote('RR-A'); git('add', '-A'); git('commit', '-q', '-m', 'A moves goldens');
      git('checkout', '-q', 'main'); git('checkout', '-q', '-b', 'pr-b'); writeGolden(move(manifest, scenario.b, 'b')); writeNote('RR-B'); git('add', '-A'); git('commit', '-q', '-m', 'B moves goldens');
      let outcome;
      try { git('merge', '--no-edit', 'pr-a'); outcome = 'clean merge'; } catch (error) {
        const unmerged = git('diff', '--name-only', '--diff-filter=U').trim().split('\n');
        outcome = `TEXTUAL CONFLICT in ${unmerged.length === 1 ? unmerged[0] : `${unmerged.length} files`}`;
      }
      if (outcome === 'clean merge') {
        const merged = old ? JSON.parse(readFileSync(path.join(dir, `${name}.sha256.json`), 'utf8')) : assembleBaseline(path.join(dir, name));
        assert.equal(serialize(merged), serialize(move(move(manifest, scenario.a, 'a'), scenario.b.filter(deck => !scenario.a.includes(deck)), 'b')), 'merged baseline holds both pull requests');
      }
      results.push({ layout, label: scenario.label, outcome });
      console.log(`${layout.padEnd(18)} | ${scenario.label}: ${outcome}`);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }
}
// Control: random disjoint deck sets against the single manifest, with git's own three-way file merge.
{
  const dir = mkdtempSync(path.join(tmpdir(), 'opf-golden-merge-random-'));
  let seed = 12345; const random = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const merge = (ours, base, theirs) => {
    for (const [file, text] of [['o', ours], ['b', base], ['t', theirs]]) writeFileSync(path.join(dir, file), text);
    return spawnSync('git', ['merge-file', '-p', path.join(dir, 'o'), path.join(dir, 'b'), path.join(dir, 't')], { encoding: 'utf8', maxBuffer: 1 << 28 }).status;
  };
  let conflicts = 0; const trials = 200;
  for (let trial = 0; trial < trials; trial++) {
    const order = decks.map(deck => [random(), deck]).sort((x, y) => x[0] - y[0]).map(entry => entry[1]);
    const split = 1 + Math.floor(random() * 60);
    if (merge(serialize(move(manifest, order.slice(0, split), 'a')), oldText, serialize(move(manifest, order.slice(split, split + 1 + Math.floor(random() * 60)), 'b'))) > 0) conflicts++;
  }
  console.log(`single-file (old)  | ${trials} random pairs of disjoint deck sets: ${conflicts} textual conflicts in the manifest`);
  assert.equal(conflicts, 0);
  rmSync(dir, { recursive: true, force: true });
}
const outcome = (layout, index) => results.find(r => r.layout === layout && r.label === scenarios[index].label).outcome;
assert.equal(outcome('per-deck (new)', 0), 'clean merge');
assert.equal(outcome('per-deck (new)', 1), 'clean merge');
assert.equal(outcome('single-file (old)', 0), 'TEXTUAL CONFLICT in README.md');
assert.equal(outcome('single-file (old)', 1), 'clean merge', 'git already merges disjoint decks of one manifest when their lines do not touch');
assert.match(outcome('single-file (old)', 2), /^TEXTUAL CONFLICT in /);
assert.match(outcome('per-deck (new)', 2), /^TEXTUAL CONFLICT in .*sha256\.json$/, 'the same deck moved twice is a real conflict, now limited to that deck file');
console.log('Shown: two golden-moving PRs that move different decks merge cleanly under the new layout and conflict under the old way of working (the README note); a manifest alone already merged cleanly; the same deck moved twice conflicts in both and is resolved by regenerating.');
