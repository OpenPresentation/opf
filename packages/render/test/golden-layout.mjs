// RR-52: the per-deck golden layout, its legacy-selection compatibility and the promotion script.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assembleBaseline, deckFileName, diffManifests, listDeckFiles, readBaseline, resolveBaseline, serialize, splitManifest, writeBaseline } from './golden-store.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temp = mkdtempSync(path.join(tmpdir(), 'opf-golden-layout-'));
const manifest = {
  version: 2, source: { repository: 'OpenPresentation/opf', path: 'examples', sha256: 'a'.repeat(64), decks: 3 },
  format: 'png-sha256', scale: 0.25, systemFonts: false,
  entries: Object.fromEntries(['a/one.opf.json', 'a/two.opf.json', 'three.opf.json'].flatMap((deck, d) => [0, 1].map(i => [`${deck}#${i}`, { sha256: String(d * 2 + i).repeat(64).slice(0, 64), bytes: 100 + d * 2 + i }]))),
};
try {
  // Split and reassemble is lossless, byte for byte, and one file holds one deck.
  const { meta, files } = splitManifest(manifest);
  assert.deepEqual([...files.keys()], ['a/one.sha256.json', 'a/two.sha256.json', 'three.sha256.json']);
  assert.equal(deckFileName('x/y.opf.json'), 'x/y.sha256.json');
  assert.equal(meta.entries, undefined);
  const baseline = path.join(temp, 'baseline');
  const first = writeBaseline(baseline, manifest);
  assert.equal(first.written.length, 4);
  assert.equal(serialize(assembleBaseline(baseline)), serialize(manifest));
  assert.deepEqual(listDeckFiles(baseline), ['a/one.sha256.json', 'a/two.sha256.json', 'three.sha256.json']);

  // Rewriting touches exactly the decks that moved and removes decks that left the corpus.
  const moved = structuredClone(manifest);
  moved.entries['a/two.opf.json#1'].sha256 = 'f'.repeat(64);
  delete moved.entries['three.opf.json#0']; delete moved.entries['three.opf.json#1'];
  const second = writeBaseline(baseline, moved);
  assert.deepEqual(second.written, ['a/two.sha256.json']);
  assert.deepEqual(second.removed, ['three.sha256.json']);
  assert.equal(second.unchanged, 2);
  assert.deepEqual(diffManifests(manifest, moved), { changedSlides: ['a/two.opf.json#1', 'three.opf.json#0', 'three.opf.json#1'], changedDecks: ['a/two.opf.json', 'three.opf.json'] });

  // Selections: a directory, a legacy `.sha256.json` path that names a directory, a legacy single file, a missing path.
  assert.equal(resolveBaseline(baseline).kind, 'directory');
  assert.equal(resolveBaseline(baseline + '.sha256.json').kind, 'directory');
  assert.equal(readBaseline(baseline + '.sha256.json').entries['a/two.opf.json#1'].sha256, 'f'.repeat(64));
  const legacy = path.join(temp, 'legacy.sha256.json');
  writeFileSync(legacy, serialize(manifest));
  assert.equal(resolveBaseline(legacy).kind, 'file');
  assert.equal(readBaseline(legacy).entries['three.opf.json#0'].bytes, 104);
  assert.throws(() => readBaseline(path.join(temp, 'missing.sha256.json')), /ENOENT/);

  // A deck file that names another deck, or holds a foreign entry, is rejected.
  const broken = path.join(temp, 'broken');
  writeBaseline(broken, manifest);
  const wrong = JSON.parse(readFileSync(path.join(broken, 'a/one.sha256.json'), 'utf8'));
  wrong.entries['a/two.opf.json#9'] = { sha256: '0'.repeat(64), bytes: 1 };
  writeFileSync(path.join(broken, 'a/one.sha256.json'), serialize(wrong));
  assert.throws(() => assembleBaseline(broken), /belongs to another deck/);

  // End to end through golden.mjs and golden-promote.mjs with a two-deck corpus.
  const corpus = path.join(temp, 'corpus'), output = path.join(temp, 'output'), selected = path.join(temp, 'selected');
  mkdirSync(corpus);
  const writeDeck = (name, title) => writeFileSync(path.join(corpus, name), JSON.stringify({ slides: [{ title }] }));
  writeDeck('alpha.opf.json', 'Alpha'); writeDeck('beta.opf.json', 'Beta');
  const env = (extra = {}) => ({ ...process.env, OPF_EXAMPLES_DIR: corpus, OPF_GOLDEN_OUT: output, OPF_GOLDEN_BASELINE: selected, ...extra });
  const run = (script, args = [], extra = {}) => spawnSync(process.execPath, [path.join(root, script), ...args], { encoding: 'utf8', timeout: 60000, env: env(extra) });
  const ok = result => { assert.equal(result.status, 0, result.stderr || result.stdout); return result; };
  ok(run('test/golden.mjs', ['--update']));
  writeBaseline(selected, JSON.parse(readFileSync(path.join(output, 'candidate.json'), 'utf8')));
  ok(run('test/golden.mjs'));
  // The legacy selection (a `.sha256.json` name for the directory) keeps working.
  ok(run('test/golden.mjs', [], { OPF_GOLDEN_BASELINE: selected + '.sha256.json' }));
  // One deck changes: the gate names exactly that deck, and promotion rewrites exactly that file.
  const untouched = readFileSync(path.join(selected, 'alpha.sha256.json'), 'utf8');
  writeDeck('beta.opf.json', 'Beta, changed');
  const failure = run('test/golden.mjs');
  assert.notEqual(failure.status, 0);
  assert.match(failure.stderr, /Golden corpus changed/);
  ok(run('test/golden.mjs', ['--update']));
  const before = readFileSync(path.join(selected, '_baseline.json'), 'utf8');
  const promoted = ok(run('scripts/golden-promote.mjs'));
  assert.match(promoted.stdout, /1 slides in 1 decks changed; 2 files written/); // beta's file and the metadata (the corpus digest moved)
  assert.deepEqual(JSON.parse(readFileSync(path.join(output, 'diff.json'), 'utf8')).changedDecks, ['beta.opf.json']);
  assert.equal(readFileSync(path.join(selected, 'alpha.sha256.json'), 'utf8'), untouched, 'An unchanged deck file must stay byte-identical');
  assert.notEqual(readFileSync(path.join(selected, '_baseline.json'), 'utf8'), before);
  ok(run('test/golden.mjs'));
  // OPF_GOLDEN_ARTIFACTS=changed keeps only the changed slides for the review sheets.
  writeDeck('alpha.opf.json', 'Alpha, changed again');
  const changedOnly = path.join(temp, 'changed-only');
  ok(run('test/golden.mjs', ['--update'], { OPF_GOLDEN_ARTIFACTS: 'changed', OPF_GOLDEN_OUT: changedOnly }));
  assert.ok(existsSync(path.join(changedOnly, '0000.png')) && !existsSync(path.join(changedOnly, '0001.png')), 'Only the changed slide is kept');
  assert.match(readFileSync(path.join(changedOnly, 'index.html'), 'utf8'), /alpha\.opf\.json#0/);
  assert.ok(statSync(path.join(changedOnly, 'sheet-0.png')).size > 0);
  // Promotion never changes how goldens are compared: a different scale is refused.
  ok(run('test/golden.mjs', ['--update'], { OPF_GOLDEN_SCALE: '0.5' }));
  const refused = run('scripts/golden-promote.mjs');
  assert.notEqual(refused.status, 0);
  assert.match(refused.stderr, /scale differs from the baseline/);
  // ... and so is a single-file manifest.
  const single = run('scripts/golden-promote.mjs', [], { OPF_GOLDEN_BASELINE: legacy });
  assert.notEqual(single.status, 0);
  assert.match(single.stderr, /needs a per-deck baseline directory/);
  console.log('Golden layout passed: lossless split, per-deck rewrite, legacy selections, changed-only artifacts, promotion that never changes the comparison.');
} finally { rmSync(temp, { recursive: true, force: true }); }
