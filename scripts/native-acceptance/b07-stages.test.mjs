import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {readB07SuccessfulStages} from './b07-stages.mjs';
import {windowsPowerShellEnvironment} from './windows-powershell-env.mjs';

// Synthetic admission controls only; no Office, process discovery or lifecycle.
const rows = () => [
  ['worker.initialize', 'success'],
  ['synthetic.parent', 'begin'],
  ['synthetic.child', 'begin'],
  ['synthetic.child', 'success'],
  ['synthetic.parent', 'success'],
  ['worker.complete', 'success'],
].map(([stage, status], index) => ({sequence: index + 1, stage, status, error: null, officeOperationsStopped: false}));
const wire = value => Buffer.from('\uFEFF' + value.map(row => JSON.stringify(row)).join('\r\n') + '\r\n');

test('B07 stage reader admits only null or exact empty errors and preserves raw bytes/records', () => {
  for (const kind of ['null', 'empty', 'mixed']) {
    const expected = rows();
    for (const [index, row] of expected.entries()) if (kind === 'empty' || kind === 'mixed' && index % 2) row.error = '';
    const bytes = wire(expected), original = Buffer.from(bytes);
    assert.deepEqual(readB07SuccessfulStages(bytes), expected);
    assert.deepEqual(bytes, original);
  }
});

test('B07 stage reader refuses meaningful/malformed errors, failures, sequence gaps and lost completion', () => {
  const mutations = [
    ...['COM failed', ' ', '\r\n', 'null', false, 0, {}, [], undefined].map(value => stages => { stages[1].error = value; }),
    stages => { delete stages[1].error; },
    ...['error', 'failure', '', 'Success', undefined, null, false, 0].map(value => stages => { stages[1].status = value; }),
    stages => { delete stages[1].status; },
    stages => { stages[1].officeOperationsStopped = true; },
    stages => { stages[1].officeOperationsStopped = 0; },
    stages => { delete stages[1].officeOperationsStopped; },
    stages => { stages[1].sequence++; },
    stages => { stages[1].sequence = '2'; },
    stages => { stages.pop(); },
    stages => { stages.at(-1).stage = 'worker.failure'; },
    stages => { stages.at(-1).status = 'begin'; },
  ];
  for (const mutate of mutations) {
    const changed = rows(); mutate(changed);
    const bytes = wire(changed), original = Buffer.from(bytes);
    assert.throws(() => readB07SuccessfulStages(bytes));
    assert.deepEqual(bytes, original);
  }
  assert.throws(() => readB07SuccessfulStages(Buffer.alloc(0)));
  assert.throws(() => readB07SuccessfulStages(Buffer.from('not JSON')));
  assert.throws(() => readB07SuccessfulStages('not raw bytes'));
});

test('actual Windows PowerShell serializes the unchanged real stage writer without starting Office', {skip: process.platform !== 'win32'}, () => {
  const script = fileURLToPath(new URL('./b07-stages-serialization.ps1', import.meta.url));
  const child = spawnSync('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe', ['-NoProfile', '-NonInteractive', '-File', script], {env: windowsPowerShellEnvironment(process.env), windowsHide: true, encoding: 'utf8', timeout: 15000});
  assert.equal(child.status, 0, child.stdout + child.stderr);
  const result = JSON.parse(child.stdout.replace(/^\uFEFF/u, '').trim());
  assert.equal(result.nativeAcceptance, false);
  assert.equal(result.hostMajor, 5);
  const bytes = Buffer.from(result.stagesBase64, 'base64'), original = Buffer.from(bytes);
  const stages = readB07SuccessfulStages(bytes);
  assert.deepEqual(stages.map(stage => stage.error), Array(7).fill(''));
  assert.deepEqual(stages.map(stage => stage.stage), ['synthetic.default', 'synthetic.default', 'synthetic.explicit-null', 'synthetic.explicit-null', 'synthetic.explicit-empty', 'synthetic.explicit-empty', 'worker.complete']);
  assert.deepEqual(bytes, original);
  const faultBytes = Buffer.from(result.faultStagesBase64, 'base64');
  assert.throws(() => readB07SuccessfulStages(faultBytes));
  assert.equal(JSON.parse(faultBytes.toString('utf8').replace(/^\uFEFF/u, '').trim()).error, 'synthetic COM failure');
  const workerSource = readFileSync(new URL('../../packages/pptx/test/native-furniture-control.ps1', import.meta.url));
  assert.equal(result.writerSourceSha256, createHash('sha256').update(workerSource).digest('hex'));
  assert.ok(readFileSync(new URL('./b07-current-profile.mjs', import.meta.url), 'utf8').includes("readB07SuccessfulStages(await read('native/stages.jsonl'))"));
});
