import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {unzipSync} from 'fflate';
import {toPptx, fromPptx, OPFPptxError} from '../dist/index.js';

// No source-only helpers: this exact fixture also runs against a fresh package.
const input = {name: 'ZIP timezone control', slides: [{title: 'Stable chart', chart: {
  type: 'column', data: {columns: ['Category', 'Value'], rows: [['A', 1], ['B', 2]]}
}, notes: 'Fixed source; no host time.'}]};
const fixed = {seed: 7, timestamp: '2026-01-01T00:00:00Z'};
const cases = [
  ['default', {}, '1980-01-01T00:00:00Z'],
  ['undefined', {zipDate: undefined}, '1980-01-01T00:00:00Z'],
  ['utc-string', {zipDate: '2026-01-01T00:00:00Z'}, '2026-01-01T00:00:00Z'],
  ['utc-date', {zipDate: new Date('2026-01-01T00:00:00Z')}, '2026-01-01T00:00:00Z'],
  ['utc-number', {zipDate: Date.parse('2026-01-01T00:00:00Z')}, '2026-01-01T00:00:00Z'],
  ['offset', {zipDate: '2025-12-31T16:00:00-08:00'}, '2026-01-01T00:00:00Z'],
  ['date-only', {zipDate: '2026-01-01'}, '2026-01-01T00:00:00Z'],
  ['utc-1980', {zipDate: '1980-01-01T00:00:00Z'}, '1980-01-01T00:00:00Z'],
  ['dst-gap', {zipDate: '2026-03-08T02:30:00Z'}, '2026-03-08T02:30:00Z'],
  ['skipped-day', {zipDate: '2011-12-30T12:00:00Z'}, '2011-12-30T12:00:00Z'],
  ['upper', {zipDate: '2099-12-31T23:59:59.999Z'}, '2099-12-31T23:59:58Z'],
  ['leap-fraction', {zipDate: '2024-02-29T09:17:03.123456Z'}, '2024-02-29T09:17:02Z'],
  ['minute-offset', {zipDate: '2026-01-01T05:30+05:30'}, '2026-01-01T00:00:00Z']
];
const invalid = [null, '', 0, false, true, {}, [], {valueOf: () => Date.parse('2026-01-01')}, NaN, Infinity, -Infinity,
  new Date(NaN), 'garbage', '2026-01-01T00:00:00', 'January 1, 2026', '2026-02-30', '2025-02-29T00:00:00Z',
  '2026-00-01', '2026-13-01', '2026-01-00', '2026-01-32', '2026-01-01T24:00:00Z',
  '2026-01-01T00:60:00Z', '2026-01-01T00:00:60Z', '2026-01-01T00:00:00+24:00',
  '2026-01-01T00:00:00+00:60', '1979-12-31T23:59:59Z', '2100-01-01',
  '1980-01-01T00:00:00+00:01', '2099-12-31T23:59:59-00:01',
  new Date('1979-12-31T23:59:59Z'), Date.parse('2100-01-01T00:00:00Z')];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function freeze(value) {
  if (value && typeof value === 'object') { Object.freeze(value); for (const child of Object.values(value)) freeze(child); }
  return value;
}
freeze(input);
function inspect(bytes, expected, prefix = '', leaves = {}) {
  // Independent reader: decode each central and local timestamp into calendar
  // tuples, and compare to authored expectations (not exporter arithmetic).
  const b = Buffer.from(bytes), end = b.length - 22;
  assert.equal(b.readUInt32LE(end), 0x06054b50);
  const count = b.readUInt16LE(end + 10), entries = unzipSync(bytes);
  assert.equal(count, Object.keys(entries).length);
  let p = b.readUInt32LE(end + 16), nested = 0;
  const wanted = expected.slice(0, 19).split(/[-T:]/).map(Number);
  for (let i = 0; i < count; i++) {
    assert.equal(b.readUInt32LE(p), 0x02014b50);
    const local = b.readUInt32LE(p + 42), n = b.readUInt16LE(p + 28);
    const name = b.subarray(p + 46, p + 46 + n).toString();
    assert.equal(b.readUInt32LE(local), 0x04034b50);
    for (const offset of [p + 12, local + 10]) {
      const time = b.readUInt16LE(offset), date = b.readUInt16LE(offset + 2);
      assert.deepEqual([1980 + (date >> 9), (date >> 5) & 15, date & 31, time >> 11, (time >> 5) & 63, (time & 31) * 2], wanted, prefix + name);
    }
    if (name.endsWith('.xlsx')) { const child = inspect(entries[name], expected, prefix + name + '/', leaves); nested += 1 + child.nested; }
    else leaves[prefix + name] = sha(entries[name]);
    p += 46 + n + b.readUInt16LE(p + 30) + b.readUInt16LE(p + 32);
  }
  assert.equal(p, end);
  return {leaves, count, nested};
}
const hostTimezoneChange = process.argv[2] === '--host-tz-worker';
if (process.argv[2] === '--worker' || hostTimezoneChange) {
  // Test-only host mutation after the module imported under UTC. The exporter
  // must not mutate TZ; the unchanged default under host mutation is excluded.
  if (hostTimezoneChange) process.env.TZ = 'America/Los_Angeles';
  const directory = process.argv[3], before = JSON.stringify(input), records = [];
  await mkdir(directory, {recursive: true});
  for (const [name, extra, expected] of cases.filter(([name]) => !hostTimezoneChange || !['default', 'undefined'].includes(name))) {
    const options = Object.freeze({...fixed, ...extra}), optionBefore = JSON.stringify(options);
    const bytes = await toPptx(input, options);
    // Retain the generated package before any assertion can reject its bytes.
    await writeFile(path.join(directory, name + '.pptx'), bytes);
    const checked = inspect(bytes, expected);
    assert.equal(checked.nested, 1, 'The ordinary chart must create a real embedded workbook');
    const restored = await fromPptx(bytes);
    assert.equal(restored.slides[0].title, input.slides[0].title);
    assert.equal(restored.slides[0].notes, input.slides[0].notes);
    const chart = restored.slides[0].chart ?? restored.slides[0].blocks?.find(block => block.chart)?.chart;
    assert.deepEqual(chart?.data, input.slides[0].chart.data);
    assert.equal(JSON.stringify(input), before);
    assert.equal(JSON.stringify(options), optionBefore);
    records.push({name, expected, sha256: sha(bytes), ...checked});
  }
  const repeat = await toPptx(input, {...fixed, zipDate: '2026-01-01T00:00:00Z'});
  assert.equal(sha(repeat), records.find(r => r.name === 'utc-string').sha256);
  for (const value of invalid) {
    await assert.rejects(toPptx(input, {...fixed, zipDate: value}), error => {
      assert.ok(error instanceof OPFPptxError);
      assert.equal(error.code, 'invalid-zip-date');
      assert.equal(error.path, 'options.zipDate');
      assert.equal(error.details.path, 'options.zipDate');
      return true;
    });
    assert.equal(JSON.stringify(input), before);
  }
  const result = {timezone: process.env.TZ, node: process.version, entrypoint: import.meta.resolve('../dist/index.js'), records, invalidCases: invalid.length};
  await writeFile(path.join(directory, 'result.json'), JSON.stringify(result, null, 2) + '\n');
} else {
  const retained = process.env.OPF_ZIP_DATE_ARTIFACTS ?? (process.env.CI ? path.resolve('artifacts/zip-date/source') : undefined);
  if (retained) await mkdir(path.resolve(retained), {recursive: true});
  const directory = await mkdtemp(retained ? path.join(path.resolve(retained), 'run-') : path.join(tmpdir(), 'opf-zip-date-'));
  let passed = false;
  try {
    const outputs = [];
    for (const zone of ['UTC', 'America/Los_Angeles', 'Pacific/Apia']) {
      const out = path.join(directory, zone.replaceAll('/', '_'));
      const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--worker', out], {
        env: {...process.env, TZ: zone}, encoding: 'utf8', timeout: 60000, maxBuffer: 5 * 1024 * 1024
      });
      await writeFile(path.join(directory, zone.replaceAll('/', '_') + '.stderr.txt'), child.stderr ?? '');
      assert.equal(child.error, undefined, zone);
      assert.equal(child.status, 0, zone + ': ' + child.stderr);
      outputs.push(JSON.parse(await readFile(path.join(out, 'result.json'), 'utf8')));
    }
    const reference = outputs[0].records;
    for (const output of outputs) {
      assert.deepEqual(output.records, reference, 'Whole ZIP bytes, recursive content and calendar timestamps must agree across TZ');
      const byName = Object.fromEntries(output.records.map(r => [r.name, r]));
      for (const name of ['undefined', 'utc-1980']) assert.equal(byName[name].sha256, byName.default.sha256);
      for (const name of ['utc-date', 'utc-number', 'offset', 'date-only', 'minute-offset']) assert.equal(byName[name].sha256, byName['utc-string'].sha256);
      for (const record of output.records) assert.deepEqual(record.leaves, byName.default.leaves, 'Changing ZIP metadata must preserve all recursive content parts');
    }
    const hostDirectory = path.join(directory, 'host-tz-change');
    const hostChild = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--host-tz-worker', hostDirectory], {env: {...process.env, TZ: 'UTC'}, encoding: 'utf8', timeout: 60000});
    await writeFile(path.join(directory, 'host-tz-change.stderr.txt'), hostChild.stderr ?? '');
    assert.equal(hostChild.error, undefined);
    assert.equal(hostChild.status, 0, hostChild.stderr);
    const hostResult = JSON.parse(await readFile(path.join(hostDirectory, 'result.json'), 'utf8'));
    assert.deepEqual(hostResult.records, reference.filter(r => !['default', 'undefined'].includes(r.name)));
    const receipt = {node: process.version, zones: outputs.map(r => r.timezone), validCasesPerZone: cases.length, invalidCasesPerZone: invalid.length,
      exports: cases.length * outputs.length + hostResult.records.length, explicitPostImportTimezoneChange: true, recursiveLeafParts: Object.keys(reference[0].leaves).length,
      preservedDefaultAndUndefined: true, equalAbsoluteRepresentations: true, wholeFileTimezoneEquality: true, nestedWorkbooks: true,
      sourceOptionsPreserved: true, reimport: true, deterministicRepeat: true};
    await writeFile(path.join(directory, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
    passed = true;
    console.log('ZIP date public fixture: ' + JSON.stringify(receipt));
  } finally {
    if (!retained && passed) await rm(directory, {recursive: true, force: true});
    else console.log('ZIP date artifacts: ' + directory);
  }
}
