import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const manifest = JSON.parse(readFileSync(new URL('./manifest.json', import.meta.url)));
const archive = readFileSync(new URL(manifest.archive, import.meta.url));
assert.ok(archive.length < 50 * 1024 * 1024);
assert.equal(archive.length, manifest.bytes);
assert.equal(sha(archive), manifest.sha256);
const envelope = JSON.parse(gunzipSync(archive, { maxOutputLength: 96 * 1024 * 1024 }));
assert.equal(envelope.schema, 'opf-lossless-evidence-v1');
assert.equal(envelope.files.length, manifest.files.length);
const members = new Map();
let total = 0;
for (const [index, file] of envelope.files.entries()) {
  assert.ok(/^(artifacts\/browser\/|licenses\/intos\/|inputs\/|server\/)/.test(file.file));
  assert.ok(!file.file.includes('\\') && !file.file.split('/').includes('..'));
  assert.ok(!members.has(file.file));
  const bytes = Buffer.from(file.data, 'base64');
  assert.equal(bytes.toString('base64'), file.data);
  assert.deepEqual({ file: file.file, bytes: bytes.length, sha256: sha(bytes) }, manifest.files[index]);
  members.set(file.file, bytes);
  total += bytes.length;
}
assert.equal(total, manifest.totalMemberBytes);
const json = (file) => JSON.parse(members.get(file));
const measured = 'artifacts/browser/measured-01/';
const receipt = json(`${measured}receipt.json`);
assert.equal(receipt.status, 'PASS');
assert.equal(receipt.runtimeSource, '58e0d7939fc318119f5f81a8ba1455bbfab7f1cd');
assert.equal(receipt.source, '6b522ccf547f60dafd3621910e7c032de7764e64');
assert.equal(receipt.serverBaseline, 'af109139550d72d75d9f886ffef01dd553d592db');
assert.equal(receipt.requests.length, 60);
assert.deepEqual(receipt.blocked, []);
assert.deepEqual(receipt.errors, []);
for (const request of receipt.requests) {
  assert.equal(request.method, 'GET');
  assert.equal(request.hasCookie, false);
  assert.equal(request.hasAuthorization, false);
  assert.ok(request.path.startsWith('/') && !request.path.includes('?'));
  const served = members.get(`artifacts/browser/site${request.path}`);
  assert.ok(served);
  assert.equal(served.length, request.bytes);
  assert.equal(sha(served), request.sha256);
}
const cases = ['desktop-normal-16', 'desktop-normal-36', 'desktop-cpu4-16', 'desktop-cpu4-36', 'mobile-cpu4-16', 'mobile-cpu4-36'];
assert.deepEqual(receipt.cases.map((entry) => entry.case), cases);
let operations = 0;
let comparisonCount = 0;
let marks = 0;
const traceOrigins = new Set();
for (const name of cases) {
  const record = json(`${measured}${name}.json`);
  assert.equal(record.kind, 'MEASURED');
  const timed = record.rows.filter((row) => row.elapsedMs !== undefined);
  const phases = ['mount', 'next', 'last', 'back', 'sorter', 'slide', 'local-title', 'chart-select', 'chart-value', 'metadata', ...(record.size === 16 ? ['reset-original', 'append20'] : [])];
  assert.deepEqual(timed.map((row) => row.name), ['setup-warm', 'round-1', 'round-2', 'round-3'].flatMap((round) => phases.map((phase) => `${round}:${phase}`)));
  for (const row of timed) {
    assert.ok(Number.isFinite(row.elapsedMs) && row.elapsedMs < 30000);
    assert.deepEqual(row.errors, []);
    assert.ok(row.canvasSvg > 0 || row.name.endsWith(':sorter'));
    if (row.name.endsWith(':sorter')) {
      assert.equal(row.sorterSvg, record.size);
      const expected = json(`server/${record.size}-batch-system.json`).storage.perSlide;
      assert.equal(row.hashes.length, expected.length);
      for (const actual of row.hashes) {
        const slide = Number(actual.key.split(':')[1]);
        const target = expected.find((entry) => entry.slide === slide);
        assert.deepEqual({ bytes: actual.bytes, sha256: actual.sha256 }, { bytes: target.bytes, sha256: target.sha256 });
        comparisonCount++;
      }
    }
  }
  operations += timed.length;
  const controls = record.rows.filter((row) => row.cell);
  assert.equal(controls.length, 4);
  for (const control of controls) {
    assert.equal(control.cell.path, 'datasets.video-playback.rows.0.1');
    assert.equal(control.cell.previousValue, 33);
    assert.equal(control.cell.value, 34);
    assert.equal(control.cell.dependentChartIndices.length, record.size === 36 ? 2 : 1);
  }
  const trace = JSON.parse(gunzipSync(members.get(`${measured}${name}-trace.json.gz`), { maxOutputLength: 128 * 1024 * 1024 }));
  const starts = trace.traceEvents.filter((event) => event.name.startsWith('opf-start:'));
  assert.equal(starts.length, timed.length);
  for (const start of starts) assert.ok(trace.traceEvents.some((event) => event.name === start.name.replace('opf-start:', 'opf-end:') && event.ts >= start.ts));
  marks += starts.length;
  for (const event of trace.traceEvents) {
    const url = event.args?.data?.url;
    if (url?.startsWith('http:') || url?.startsWith('https:')) {
      const parsed = new URL(url);
      assert.equal(parsed.hostname, '127.0.0.1');
      traceOrigins.add(parsed.origin);
    }
  }
  for (const suffix of ['sorter', 'edited']) assert.equal(members.get(`${measured}${name}-${suffix}.png`).subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
}
assert.equal(operations, 264);
assert.equal(comparisonCount, 624);
const original = members.get('inputs/original-16.opf.json');
const extended = members.get('inputs/extended-36.opf.json');
assert.equal(sha(original), receipt.inputFiles['16'].sha256);
assert.equal(sha(extended), receipt.inputFiles['36'].sha256);
assert.deepEqual(JSON.parse(extended).slides.slice(0, 16), JSON.parse(original).slides);
const first = json('artifacts/browser/smoke-01/functional-desktop-16-failure.json');
assert.equal(first.status, 'FAILED');
assert.deepEqual(first.rows, []);
assert.match(first.message, /owned input has one numeric chart cell/);
assert.equal(json('artifacts/browser/smoke-02/receipt.json').status, 'PASS');
const bundle = json('artifacts/browser/bundle-receipt.json');
assert.equal(bundle.inputs.length, 572);
assert.equal(sha(members.get('artifacts/browser/site/browser-perf.js')), bundle.bundleSha256);
const fontProvenance = json('licenses/intos/PROVENANCE.json');
assert.equal(fontProvenance.license, 'OFL-1.1');
for (const file of ['Intos-Regular.ttf', 'Intos-Bold.ttf', 'IntosDisplay-Bold.ttf']) {
  const face = fontProvenance.faces.find((item) => item.file === file);
  assert.equal(sha(members.get(`artifacts/browser/site/fonts/intos/${file}`)), face.sha256);
}
const startup = json('artifacts/browser/site/fonts.json');
assert.equal(startup.length, 1);
assert.equal(startup[0].family, 'Roboto');
assert.match(startup[0].license, /SIL Open Font License, Version 1.1/);
const summary = JSON.parse(readFileSync(new URL('./summary.json', import.meta.url)));
assert.equal(summary.nativeAcceptance, false);
assert.equal(summary.totalOperations, operations);
assert.equal(summary.exactBrowserServerSystemSvgComparisons, comparisonCount);
console.log(JSON.stringify({ status: 'PASS', files: members.size, bytes: total, formalCases: cases.length, operations, timedMarks: marks, browserServerExactComparisons: comparisonCount, screenshotCount: 12, localhostOrigins: [...traceOrigins], earlierSetupFailurePreserved: true, nativeAcceptance: false }));
