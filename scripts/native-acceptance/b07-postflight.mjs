import assert from 'node:assert/strict';
import {digest} from './identity.mjs';
import {assertReferenceWitnessPostflight} from './reference-chart-profile.mjs';
import {readB07SuccessfulStages} from './b07-stages.mjs';

export const B07_POSTFLIGHT_POLICY = Object.freeze({
  policy: 'b07-bounded-global-zero-after-completed-owned-quit-v1',
  observationPolicy: 'global-zero-after-completed-owned-quit-v1',
  budgetMilliseconds: 5000,
  intervalMilliseconds: 100,
  maximumQueries: 51,
  observerSource: 'scripts/native-acceptance/run-reference-chart-profile.ps1',
  observerSourceSha256: '8902c341911dd9711872b4745d8ac3fe6524b9f5dcaa6d7ccd17b7f1f1116ee3',
});

// These are actual successful stage names in the frozen furniture worker. Only
// these lifecycle facts have an ordered contract; arbitrary/nested COM records
// between them need not be adjacent or paired by this admission check.
export const B07_COMPLETED_LIFECYCLE = Object.freeze([
  'worker.initialize',
  'application.ownership.presentations.count.get',
  'input.presentation.open',
  'input.presentation.fullName.get',
  'input.presentation.readOnly.get',
  'edited.presentation.saveCopyAs',
  'edited.presentation.close',
  'edited.presentation.cleanup',
  'reopen.presentation.open',
  'reopen.presentation.fullName.get',
  'reopen.presentation.readOnly.get',
  'reopened.presentation.close',
  'reopened.presentation.cleanup',
  'application.cleanup.presentations.count.get',
  'application.cleanup.quit',
  'worker.complete',
]);

export function assertB07PostflightReady(terminal, report, request, stageBytes) {
  assert.equal(terminal.timedOut, false);
  assert.equal(terminal.exitCode, 0);
  assert.equal(terminal.cleanupConfirmed, true);
  assert.equal(terminal.lastDurableStage, 'worker.complete');
  assert.equal(terminal.lastDurableStatus, 'success');
  assert.equal(report.cleanupConfirmed, true);
  assert.equal(report.officeOperationsStopped, false);
  assert.equal(report.error, null);
  assert.equal(report.lastStage, 'worker.complete');
  assert.equal(report.lastStatus, 'success');
  assert.equal(report.captureTextFonts, true);
  assert.equal(report.readOnlySurvey, false);
  assert.equal(request.captureTextFonts, true);
  assert.equal(request.readOnlySurvey, false);
  assert.equal(request.actionPlan.count, 0);
  assert.deepEqual(report.actionPlan.actions, []);
  assert.deepEqual(report.actionPlan.completed, []);
  for (const phase of ['original', 'edited', 'reopened']) {
    assert.ok(report.phases[phase] && typeof report.phases[phase] === 'object');
  }
  const stages = readB07SuccessfulStages(stageBytes);
  let previous = 0;
  const lifecycle = B07_COMPLETED_LIFECYCLE.map(name => {
    const matches = stages.filter(stage => stage.stage === name && stage.status === 'success');
    assert.equal(matches.length, 1, `Missing/duplicate B07 completed stage: ${name}`);
    const stage = matches[0];
    assert.ok(stage.sequence > previous, 'B07 completed lifecycle is out of order');
    previous = stage.sequence;
    if (name.endsWith('.cleanup') || name === 'application.cleanup.quit' || name === 'worker.complete') {
      assert.equal(stage.cleanupConfirmed, true);
      assert.equal(stage.ownedPresentationPath, null);
    }
    return {stage: name, sequence: stage.sequence};
  });
  return {workerCleanupConfirmed: true, stageCount: stages.length, lifecycle};
}

export function assertB07BoundedPostflight(postflight, bytes) {
  assert.deepEqual(postflight.policy, B07_POSTFLIGHT_POLICY);
  assert.equal(postflight.identity.path, 'native/postflight.jsonl');
  assert.ok(Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= 65536);
  assert.equal(postflight.identity.bytes, bytes.length);
  assert.equal(postflight.identity.sha256, digest(bytes));
  const samples = bytes.toString('utf8').trim().split(/\r?\n/u).map(line => JSON.parse(line));
  assertReferenceWitnessPostflight({
    workerCleanupConfirmed: postflight.workerCleanupConfirmed,
    postflightError: postflight.error,
    postflight: postflight.result,
    powerPointPostflightInitialCount: postflight.initialCount,
    powerPointPostflightCount: postflight.finalCount,
  }, samples);
  return samples;
}
