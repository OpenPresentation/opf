import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const root = process.cwd(), own = path.join(root, 'docs/handoff/2026-11-09/svg-performance');
const out = path.join(own, 'results/lean-font-01');
fs.mkdirSync(out, {recursive: false});
const archived = JSON.parse(gunzipSync(fs.readFileSync(path.join(own, 'server-baseline-01.raw.json.gz')))).files;
const baseline = JSON.parse(Buffer.from(archived.find(f => f.file === 'results/server-baseline-01/36-batch-fonts.json').data, 'base64'));
const expected = baseline.storage.perSlide.map(s => s.sha256);
const order = ['batch-fonts', 'batch-no-open', 'batch-office-only', 'batch-office-only', 'batch-no-open', 'batch-fonts'];
const receipt = {schema: 1, started: new Date().toISOString(), runtimeSource: '58e0d7939fc318119f5f81a8ba1455bbfab7f1cd', protocol: 'Explicit team quiet window; serial fresh Node24 children; fixed mirrored order; first render plus two warm runs per child; same deck and pinned fonts; exact accepted SVG hashes required. Existing loader knobs only. No production code change.', rows: [], status: 'RUNNING'};
const save = () => fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(receipt, null, 2) + '\n');
save();
for (const [i, mode] of order.entries()) {
  const name = String(i + 1).padStart(2, '0') + '-' + mode, json = path.join(out, name + '.json');
  const start = new Date().toISOString();
  const run = spawnSync(process.execPath, ['--expose-gc', path.join(own, 'lean-font-case.mjs'), '36', mode, '2', json], {cwd: root, encoding: 'utf8', timeout: 45000, maxBuffer: 1024 * 1024});
  fs.writeFileSync(path.join(out, name + '.stdout'), run.stdout || '');
  fs.writeFileSync(path.join(out, name + '.stderr'), run.stderr || '');
  const row = {order: i + 1, mode, started: start, finished: new Date().toISOString(), exitCode: run.status, signal: run.signal, error: run.error?.message};
  receipt.rows.push(row);
  try {
    assert.equal(run.status, 0, name + ' failed');
    const result = JSON.parse(fs.readFileSync(json));
    assert.deepEqual(result.storage.perSlide.map(s => s.sha256), expected, name + ': SVG must remain byte-identical');
    Object.assign(row, {outputEquivalent: true, faces: result.fontFaces.length, fontInputBytes: result.fontInputBytes, fontLoadMs: result.fontMs, beforeFontMemory: result.beforeFontMemory, setupMemory: result.setupMemory, renderPeakRssBytes: Math.max(...result.samples.map(s => s.afterRender.peakRssBytes)), postGc: result.finalMemory, warmMedianMs: result.warmMedianMs, firstRenderMs: result.samples[0].elapsedMs});
  } catch (error) {
    receipt.status = 'FAIL'; receipt.failure = error.message; receipt.finished = new Date().toISOString(); save(); throw error;
  }
  save(); console.log(JSON.stringify(row));
}
receipt.status = 'PASS'; receipt.finished = new Date().toISOString();
receipt.harnessSha256 = createHash('sha256').update(fs.readFileSync(path.join(own, 'lean-font-case.mjs'))).digest('hex');
save(); console.log(JSON.stringify({status: receipt.status, cases: receipt.rows.length, allSvgEquivalent: true}));
