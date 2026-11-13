import assert from 'node:assert/strict';

// Read, never rewrite, the durable PowerShell stage bytes. A [string] parameter
// with a $null default serializes an omitted error as "" in Windows PowerShell.
export function readB07SuccessfulStages(bytes) { return readSuccessfulStages(bytes,5000); }
// Closed exact50 dense profile only; ordinary/B07 bounds are unchanged.
export function readDenseFurnitureSuccessfulStages(bytes) { return readSuccessfulStages(bytes,8193); }
function readSuccessfulStages(bytes,exclusiveLimit) {
  assert.ok(Buffer.isBuffer(bytes), 'Raw B07 stage bytes required');
  const stages = bytes.toString('utf8').replace(/^\uFEFF/u, '').trim().split(/\r?\n/u).map(line => JSON.parse(line));
  assert.ok(stages.length > 0 && stages.length < exclusiveLimit);
  for (const [index, stage] of stages.entries()) {
    assert.equal(stage.sequence, index + 1);
    assert.ok(stage.status === 'begin' || stage.status === 'success', 'B07 stage must be begin or success');
    assert.ok(stage.error === null || stage.error === '', 'B07 stage contains an error');
    assert.equal(stage.officeOperationsStopped, false);
  }
  assert.equal(stages.at(-1).stage, 'worker.complete');
  assert.equal(stages.at(-1).status, 'success');
  return stages;
}
