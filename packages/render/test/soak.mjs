// render#171: the soak benchmark (scripts/soak.mjs) is manual, but its statistics and a short smoke run stay under test, so the
// script cannot rot. The smoke run uses two worker processes, three example decks and SVG/PNG only (opf-pptx is not a dependency).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { growthTest, mannKendallZ, parseArgs, theilSen } from '../scripts/soak.mjs';

const MIB = 1024 * 1024;
// A deterministic pseudo-random noise source (no Math.random: the test must be repeatable).
let state = 12345;
const noise = () => { state = (state * 1664525 + 1013904223) % 4294967296; return state / 4294967296 - 0.5; };
const series = (n, f) => Array.from({ length: n }, (_, x) => ({ x, y: Math.round(f(x)) }));

// A plateau with noise is not growth; a ramp is; a tiny ramp is below the floor.
assert.equal(growthTest(series(300, () => 500 * MIB + noise() * 60 * MIB)).grows, false, 'noisy plateau');
const ramp = growthTest(series(300, x => 500 * MIB + x * 0.5 * MIB + noise() * 20 * MIB));
assert.equal(ramp.grows, true, 'ramp of 0.5 MiB per job');
assert.ok(Math.abs(ramp.theilSenMiBPer100Jobs - 50) < 3, `Theil-Sen slope ${ramp.theilSenMiBPer100Jobs} MiB per 100 jobs`);
assert.equal(growthTest(series(300, x => 500 * MIB + x * 20000 + noise() * 2 * MIB)).grows, false, 'ramp below the rise floor');
assert.ok(mannKendallZ([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) > 3.29 && mannKendallZ([5, 5, 5, 5, 5, 5, 5, 5, 5]) === 0);
assert.equal(theilSen([0, 1, 2, 3], [0, 2, 4, 100]), 2, 'Theil-Sen ignores an outlier');
assert.deepEqual(parseArgs(['--concurrency', '1,4', '--iterations', '20']).concurrency, [1, 4]);
assert.throws(() => parseArgs(['--iterations', '0']), /needs an integer/);

const out = mkdtempSync(path.join(os.tmpdir(), 'opf-soak-'));
try {
  const script = fileURLToPath(new URL('../scripts/soak.mjs', import.meta.url));
  const started = Date.now();
  const result = spawnSync(process.execPath, [script, '--iterations', '4', '--concurrency', '2', '--decks', '3', '--script-every', '0', '--ops', 'svg,png', '--warmup', '1', '--out', out], { encoding: 'utf8', timeout: 120000 });
  assert.equal(result.status, 0, `soak smoke run failed:\n${result.stdout}\n${result.stderr}`);
  const files = readdirSync(out);
  assert.equal(files.filter(name => name.endsWith('.md')).length, 1);
  const report = JSON.parse(readFileSync(path.join(out, files.find(name => name.endsWith('.json'))), 'utf8'));
  const [run] = report.runs;
  assert.equal(run.jobs, 8);
  assert.equal(run.determinism.drift.length, 0);
  assert.ok(run.determinism.comparisons >= 6, 'decks repeat across the two workers');
  assert.deepEqual(run.networkAttempts, []);
  assert.deepEqual(run.failures, []);
  assert.ok(run.workers.every(worker => worker.samples === 4 && worker.rss.samples === 3), 'a memory sample after every job, the steady-state window after the warm-up');
  console.log(`soak: statistics and a smoke run of 8 jobs (3 decks, 2 workers) pass in ${((Date.now() - started) / 1000).toFixed(1)} s`);
} finally {
  rmSync(out, { recursive: true, force: true });
}
