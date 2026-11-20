import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
const bin = process.env.OPF_TEST_BIN ?? fileURLToPath(new URL('../dist/index.js', import.meta.url));
const source = fileURLToPath(new URL('../../javascript/test/fixtures/chart-report-boundaries.opf.json', import.meta.url));
const expected = [
  ['opf/chart-series-dropped', '/slides/0/blocks/1/chart/type'],
  ['opf/chart-series-dropped', '/slides/1/blocks/0/chart/type'],
  ['opf/chart-mapping-adapted', '/slides/2/blocks/0/chart/type'],
];
test('CLI retains chart drawing advisories added after its located input check', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'opf-chart-report-'));
  try {
    const run = (file, extra = []) => spawnSync(process.execPath, [bin, 'convert', source, path.join(dir, file), '--keep-slides', '--date', '2026-11-08', ...extra], { encoding: 'utf8', timeout: 120000, windowsHide: true });
    const result = run('slide-{n}.svg');
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    const semantic = report.findings.filter(f => /^opf\/chart-(mapping-adapted|series-dropped)$/.test(f.ruleId));
    assert.deepEqual(semantic.map(f => [f.ruleId, f.path]), expected);
    assert.ok(semantic.every(f => f.severity === 'warning'));
    assert.equal(report.outputs.length, 3);
    assert.ok((await readFile(path.join(dir, 'slide-1.svg'), 'utf8')).includes('<svg'));
    const blocked = run('blocked-{n}.svg', ['--fail-on', 'warning']);
    assert.equal(blocked.status, 1, blocked.stderr);
    assert.deepEqual(JSON.parse(blocked.stderr).findings.filter(f => /^opf\/chart-(mapping-adapted|series-dropped)$/.test(f.ruleId)).map(f => [f.ruleId, f.path]), expected);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
