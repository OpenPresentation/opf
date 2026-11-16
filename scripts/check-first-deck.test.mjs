// RR-95: docs/first-deck must stay runnable. The deck validates with no findings, its local image exists, and the workspace
// CLI draws six PNGs and a PPTX from it with no warnings, as its README says. Needs the built CLI (pnpm build).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const folder = path.join(root, 'docs', 'first-deck');
const cli = path.join(root, 'packages', 'cli', 'dist', 'index.js');
const skip = !existsSync(cli) && 'packages/cli/dist is not built';

const run = (args, cwd) => {
  const result = spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8', timeout: 120_000 });
  return { status: result.status, report: result.stdout ? JSON.parse(result.stdout) : undefined, stderr: result.stderr };
};

test('the first deck has six slides and its local image', () => {
  const deck = JSON.parse(readFileSync(path.join(folder, 'deck.opf.json'), 'utf8'));
  assert.equal(deck.slides.length, 6);
  const kinds = JSON.stringify(deck.slides);
  for (const kind of ['"bullets"', '"metric"', '"chart"', '"table"', '"image"']) assert.ok(kinds.includes(kind), `${kind} is on a slide`);
  assert.ok(statSync(path.join(folder, 'assets', 'roastery.svg')).size > 0);
  assert.ok(readdirSync(folder).includes('README.md'));
});

test('the first deck validates, and converts to PNG and PPTX with no warnings', { skip }, () => {
  const validation = run(['validate', 'deck.opf.json'], folder);
  assert.equal(validation.status, 0, JSON.stringify(validation.report?.findings));
  assert.deepEqual(validation.report.findings, []);
  const out = mkdtempSync(path.join(tmpdir(), 'opf-first-deck-'));
  try {
    const png = run(['convert', 'deck.opf.json', path.join(out, 'slides', 'deck.png'), '--fail-on', 'warning'], folder);
    assert.equal(png.status, 0, png.stderr);
    assert.deepEqual(readdirSync(path.join(out, 'slides')).sort(), [1, 2, 3, 4, 5, 6].map((n) => `deck-${n}.png`));
    const pptx = run(['convert', 'deck.opf.json', path.join(out, 'deck.pptx'), '--fail-on', 'warning'], folder);
    assert.equal(pptx.status, 0, pptx.stderr);
    assert.ok(statSync(path.join(out, 'deck.pptx')).size > 10_000);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
