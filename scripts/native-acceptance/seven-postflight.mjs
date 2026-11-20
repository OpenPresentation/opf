import assert from 'node:assert/strict';
import path from 'node:path';
import {fileIdentity} from './identity.mjs';
import {bindSevenPhase, inspectSevenArchive} from './seven-chart-archive.mjs';
import {OWNED_POSTFLIGHT_POLICY, assertOwnedStageWire, assertOwnedOperations, ownedSuccess, assertOwnedKernel, readOwnedFile, readOwnedJson, makeOwnedAdmission, sourceIdentityFiles} from './owned-postflight.mjs';

export const SEVEN_POSTFLIGHT_POLICY = Object.freeze({policy: 'seven-bounded-global-zero-after-completed-owned-quit-v1', ...OWNED_POSTFLIGHT_POLICY});
export function sevenExpectedOperations(report) {
  const names = ['worker.initialize', 'application.create', 'application.initial.presentations', 'application.initial.count', 'application.version', 'application.path'];
  for (const phase of ['original', 'saved-reopened']) {
    names.push(...['preflight.presentations', 'preflight.count', 'open', 'fullName', 'readOnly', 'slides', 'slides.count'].map(suffix => phase + '.' + suffix));
    assert.equal(report.phases[phase].slides.length, 7);
    for (let index = 1; index <= 7; index++) {
      const base = phase + '.slide.' + index, slide = report.phases[phase].slides[index - 1];
      assert.equal(slide.shapeCount, 2); assert.equal(slide.shapes.length, 2);
      names.push(...['get', 'id', 'name', 'shapes', 'shapes.count'].map(suffix => base + '.' + suffix));
      for (let position = 1; position <= 2; position++) {
        const shape = base + '.shape.' + position;
        names.push(shape + '.get', ...['id', 'name', 'type', 'left', 'top', 'width', 'height', 'rotation', 'hasTextFrame', 'alternativeText'].map(suffix => shape + '.' + suffix));
        assert.ok([-1, 0].includes(slide.shapes[position - 1].hasTextFrame));
        if (slide.shapes[position - 1].hasTextFrame === -1) names.push(...['textFrame', 'textRange', 'text'].map(suffix => shape + '.' + suffix));
      }
      names.push(base + '.export');
    }
    if (phase === 'original') names.push('copy.fullName', 'copy.saveCopyAs', 'copy.afterName');
    names.push(...['close.fullName', 'close.discard', 'close'].map(suffix => phase + '.' + suffix));
  }
  names.push('application.final.presentations', 'application.final.count', 'application.quit', 'worker.complete');
  return names;
}
export function assertSevenPostflightReady({terminal, report, request, stages, envelope, inputSha256, sourcePath, savedPath, workerPath, savedArchive, originalArchive}) {
  assertOwnedKernel(terminal, request.timeoutSeconds);
  assert.equal(request.runOfficeRequested, true);
  assert.equal(request.profile, 'seven-chart-original-readonly-v2');
  assert.deepEqual(request.policy, SEVEN_POSTFLIGHT_POLICY);
  assert.equal(report.profile, request.profile); assert.equal(report.schemaVersion, 2);
  assert.equal(report.envelopeSha256, request.envelopeSha256);
  assert.equal(report.cleanupConfirmed, true); assert.equal(report.officeOperationsStopped, false);
  assert.ok(Object.hasOwn(report, 'error')); assert.equal(report.error, null);
  assert.equal(report.lastStage, 'worker.complete'); assert.equal(report.lastStatus, 'success');
  assert.equal(report.sourceSha256, inputSha256);
  assert.equal(report.sourcePath, sourcePath); assert.equal(report.savedPath, savedPath); assert.equal(report.workerPath, workerPath);
  assert.deepEqual(report.generation, envelope.generation); assert.deepEqual(report.controllerRepository, envelope.controllerRepository);
  assert.deepEqual(report.node, envelope.node); assert.deepEqual(report.limits, envelope.limits);
  assert.deepEqual(report.actions, []);
  assert.equal(report.closes, 2); assert.equal(report.saveCopies, 1); assert.equal(report.quits, 1);
  assert.deepEqual(report.opens.map(open => [open.phase, open.path, open.readOnly, open.sha256]), [
    ['original', sourcePath, -1, inputSha256], ['saved-reopened', savedPath, -1, report.savedSha256],
  ]);
  assert.deepEqual(Object.keys(report.phases), ['original', 'saved-reopened']);
  bindSevenPhase(originalArchive, report.phases.original); bindSevenPhase(savedArchive, report.phases['saved-reopened']);
  assert.ok(Array.isArray(report.probes) && report.probes.length > 0);
  for (const probe of report.probes) assert.equal(probe.matched, true);
  const successes = assertOwnedOperations(stages, sevenExpectedOperations(report));
  const value = name => ownedSuccess(stages, name).value;
  for (const name of ['application.initial.count', 'original.preflight.count', 'saved-reopened.preflight.count', 'application.final.count']) assert.equal(value(name), 0);
  for (const [phase, expected] of [['original', sourcePath], ['saved-reopened', savedPath]]) {
    assert.equal(value(phase + '.fullName'), expected); assert.equal(value(phase + '.readOnly'), -1);
    assert.equal(value(phase + '.close.fullName'), expected);
    assert.equal(value(phase + '.slides.count'), 7);
    for (let i = 1; i <= 7; i++) for (let j = 1; j <= 2; j++) {
      const shape = report.phases[phase].slides[i - 1].shapes[j - 1];
      if (shape.hasTextFrame === 0) assert.equal(shape.text, null);
      const base = phase + '.slide.' + i + '.shape.' + j;
      for (const property of ['id', 'name', 'type', 'left', 'top', 'width', 'height', 'rotation', 'hasTextFrame', 'alternativeText']) assert.equal(value(base + '.' + property), shape[property]);
      if (shape.hasTextFrame === -1) assert.equal(value(base + '.text'), shape.text);
    }
  }
  assert.equal(value('copy.fullName'), sourcePath); assert.equal(value('copy.afterName'), sourcePath);
  assert.equal(successes.at(-1).cleanupConfirmed, true);
  return {workerCleanupConfirmed: true, stageCount: stages.length, lifecycle: successes.map(({stage, sequence}) => ({stage, sequence})), opens: 2, saves: 1, closes: 2, edits: 0, quits: 1};
}
export function verifySevenPostflightBinding(binding, requestBinding) {
  const {directory, envelope} = binding, at = relative => path.join(directory, relative);
  const report = readOwnedJson(at('native/report.json')), terminal = readOwnedJson(at('native/worker.json'));
  const stages = assertOwnedStageWire(readOwnedFile(at('native/stages.jsonl'), 4 * 1024 * 1024));
  const saved = readOwnedFile(at('native/saved.pptx'));
  assert.equal(fileIdentity(at('native/saved.pptx')).sha256, report.savedSha256);
  assert.equal(report.requestSha256, requestBinding.identity.sha256);
  const ready = assertSevenPostflightReady({terminal, report, request: requestBinding.request, stages, envelope,
    inputSha256: fileIdentity(at('inputs/case.pptx')).sha256, sourcePath: at('inputs/case.pptx'), savedPath: at('native/saved.pptx'),
    workerPath: at('inputs/seven-chart-worker.ps1'), originalArchive: binding.archive, savedArchive: inspectSevenArchive(saved)});
  const files = ['execution-envelope.json', 'execution-request.json', 'native/report.json', 'native/worker.json', 'native/stages.jsonl', 'native/saved.pptx', ...binding.snapshots.map(item => item.path)].map(at);
  for (const phase of ['original', 'saved-reopened']) for (const [i, raster] of report.phases[phase].rasters.entries()) {
    const expected = at('native/' + phase + '-' + String(i + 1).padStart(2, '0') + '.png');
    assert.equal(raster.path, expected); assert.equal(fileIdentity(expected).sha256, raster.sha256); files.push(expected);
  }
  assert.equal(report.workerSha256, fileIdentity(at('inputs/seven-chart-worker.ps1')).sha256);
  files.push(envelope.node.path, ...sourceIdentityFiles(envelope.controllerRepository, envelope.generation.provenance));
  return makeOwnedAdmission({profile: report.profile, policy: SEVEN_POSTFLIGHT_POLICY, requestSha256: requestBinding.identity.sha256, files, ready});
}

