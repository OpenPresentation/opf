import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, copyFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const runner = fileURLToPath(new URL('./golden.mjs', import.meta.url));
const temp = mkdtempSync(path.join(tmpdir(), 'opf-golden-gate-'));
const corpus = path.join(temp, 'corpus'), output = path.join(temp, 'output'), baseline = path.join(temp, 'baseline.json');
mkdirSync(corpus);
const file = path.join(corpus, 'fixture.opf.json');
const writeDeck = title => writeFileSync(file, JSON.stringify({ slides: [{ title }] }));
const run = (...args) => spawnSync(process.execPath, [runner, ...args], {
  encoding: 'utf8', timeout: 30000,
  env: { ...process.env, OPF_EXAMPLES_DIR: corpus, OPF_GOLDEN_OUT: output, OPF_GOLDEN_BASELINE: baseline },
});
function succeeds(result) { assert.equal(result.status, 0, result.stderr || result.stdout); }
function fails(result, reason) { assert.notEqual(result.status, 0); assert.match(result.stderr, reason); }
try {
  writeDeck('First baseline');
  succeeds(run('--update'));
  fails(run(), /ENOENT/); // Candidate creation cannot silently approve a baseline.
  copyFileSync(path.join(output, 'candidate.json'), baseline);
  succeeds(run());
  const approved = readFileSync(baseline, 'utf8');
  const corrupt = JSON.parse(approved);
  corrupt.entries['fixture.opf.json#0'].sha256 = '0'.repeat(64);
  writeFileSync(baseline, JSON.stringify(corrupt));
  fails(run(), /raster baselines changed/);
  writeFileSync(baseline, approved);
  writeDeck('Changed source');
  fails(run(), /Golden corpus changed/);
  succeeds(run('--update'));
  assert.equal(readFileSync(baseline, 'utf8'), approved, 'Updates must leave the approved baseline intact');
  rmSync(file);
  fails(run(), /Golden corpus must not be empty/);
  console.log('Golden gate passed: missing baseline, pixel drift, source drift, non-mutating candidate generation and empty-corpus rejection.');
} finally { rmSync(temp, { recursive: true, force: true }); }
