// Bind genuine table-v2 execution separately from immutable generation, then use
// the existing strict native text/color/raster/nine-import comparison unchanged.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {digest} from './identity.mjs';
import {bindTableProfile, tableRegular, tableAsset} from './table-profile.mjs';
import {compareNativeTableColors} from './compare-table-colors.mjs';
const parse = bytes => JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/u, ''));
export function assertTableLifecycle({runner, terminal, report, stages, profile, envelopeSha256}) {
  for (const record of [runner, report]) {
    assert.equal(record.schemaVersion, 2); assert.equal(record.profile, 'table-colors-v2');
    assert.equal(record.envelopeSha256, envelopeSha256);
    assert.deepEqual(record.generationIdentity, profile.generationIdentity);
    assert.deepEqual(record.executionIdentity, profile.controller);
    assert.equal(record.nativeAcceptance, false); assert.equal(record.registryAcceptance, false);
  }
  assert.equal(runner.runOfficeRequested, true, 'Explicit Office execution was not requested');
  assert.equal(runner.sourceSuiteSha256, profile.suiteSha256);
  assert.ok(Number.isInteger(runner.timeoutSeconds) && runner.timeoutSeconds >= 5 && runner.timeoutSeconds <= 60);
  assert.equal(runner.status, 'native-observation-completed; comparison-and-coordinator-review-required');
  assert.equal(terminal.envelopeSha256, envelopeSha256);
  assert.equal(terminal.timedOut, false); assert.equal(terminal.exitCode, 0); assert.equal(terminal.cleanupConfirmed, true);
  assert.equal(terminal.lastDurableStage, 'worker.complete');
  assert.equal(report.cleanupConfirmed, true); assert.equal(report.officeOperationsStopped, false);
  const environment = report.environment;
  assert.ok(environment && typeof environment.hostVersion === 'string' && environment.hostVersion.length > 0);
  assert.ok(typeof environment.powerPointVersion === 'string' && environment.powerPointVersion.length > 0);
  assert.ok(typeof environment.executablePath === 'string' && path.isAbsolute(environment.executablePath));
  assert.match(environment.executableSha256, /^[a-f0-9]{64}$/u);
  for (const key of ['executableVersion', 'windowsBuild']) assert.ok(environment[key] === null || (typeof environment[key] === 'string' && environment[key].length > 0));
  assert.deepEqual(environment.metadataUnavailable, ['executableVersion', 'windowsBuild'].filter(key => environment[key] === null), 'Unavailable environment metadata must be explicit');
  assert.equal(report.edits.length, 6);
  assert.deepEqual(report.edits, Array.from({length: 6}, (_, index) => ({slide: index + 1, row: 2, column: 1, before: 'Body', after: 'Native Body', prefix: 'Native '})));
  assert.ok(Array.isArray(stages) && stages.length > 0);
  const successes = [];
  for (const [index, stage] of stages.entries()) {
    assert.equal(stage.sequence, index + 1); assert.equal(stage.officeOperationsStopped, false);
    assert.ok(['begin', 'success'].includes(stage.status), 'Failed stage cannot qualify');
    assert.ok(Number.isFinite(Date.parse(stage.timestamp)));
    if (index) assert.ok(Date.parse(stage.timestamp) >= Date.parse(stages[index - 1].timestamp));
    if (stage.stage.startsWith('worker.')) { assert.equal(stage.status, 'success'); successes.push(stage.stage); continue; }
    if (stage.status === 'begin') {
      const next = stages[index + 1]; assert.ok(next && next.stage === stage.stage && next.status === 'success', 'Unpaired Office stage');
    } else {
      const previous = stages[index - 1]; assert.ok(previous && previous.stage === stage.stage && previous.status === 'begin', 'Success without Office begin');
      successes.push(stage.stage);
    }
  }
  assert.equal(successes[0], 'worker.initialize'); assert.equal(successes.at(-1), 'worker.complete');
  assert.equal(new Set(successes).size, successes.length, 'Duplicate Office operation');
  const lifecycle = ['application.create', 'application.initial.count', 'original.preflight.count', 'original.open', 'original.fullName', 'original.readOnly',
    ...Array.from({length: 6}, (_, i) => `original.slide.${i + 1}.capture`), 'original.saveCopyAs', 'original.close',
    'reopened.preflight.count', 'reopened.open', 'reopened.fullName', 'reopened.readOnly', ...Array.from({length: 6}, (_, i) => `reopened.slide.${i + 1}.capture`),
    ...Array.from({length: 6}, (_, i) => `edit.slide.${i + 1}.prefix`), 'edited.saveCopyAs', 'reopened.close',
    'edited.preflight.count', 'edited.open', 'edited.fullName', 'edited.readOnly', ...Array.from({length: 6}, (_, i) => `edited.slide.${i + 1}.capture`), 'edited.close', 'application.final.count', 'application.quit'];
  assert.deepEqual(successes.filter(name => lifecycle.includes(name)), lifecycle, 'Three-phase native lifecycle differs');
  const expectedPaths = {original: path.join(profile.output, 'table-colors/table-colors.pptx'), reopened: path.join(profile.output, 'table-colors/table-colors-saved.pptx'), edited: path.join(profile.output, 'table-colors/table-colors-edited.pptx')};
  assert.deepEqual(report.opens.map(open => ({phase: open.phase, path: path.resolve(open.path), readOnly: open.readOnly})), ['original', 'reopened', 'edited'].map(phase => ({phase, path: expectedPaths[phase], readOnly: -1})), 'Actual owned read-only opens differ');
  for (const phase of ['original', 'reopened', 'edited']) {
    assert.equal(report[phase].length, 6);
    for (const [index, slide] of report[phase].entries()) assert.equal(slide.png, `${phase}-${index + 1}.png`, 'Noncanonical capture path');
    for (const stage of stages.filter(stage => stage.stage === `${phase}.fullName` || stage.stage === `${phase}.readOnly` || stage.stage === `${phase}.close`))
      assert.equal(path.resolve(stage.ownedPresentationPath), expectedPaths[phase], 'Wrong owned phase path');
  }
}
export async function compareTableProfile({envelopeFile, envelopeSha256}) {
  const {envelope} = await bindTableProfile({envelopeFile, envelopeSha256});
  const nativeRoot = path.join(envelope.output, 'table-colors');
  const [runnerBytes, terminalBytes, reportBytes, stageBytes] = await Promise.all([
    tableRegular(path.join(envelope.output, 'runner.json')), tableRegular(path.join(nativeRoot, 'supervisor.json')),
    tableRegular(path.join(nativeRoot, 'native.json')), tableRegular(path.join(nativeRoot, 'stages.jsonl')),
  ]);
  const runner = parse(runnerBytes), terminal = parse(terminalBytes), report = parse(reportBytes);
  const stages = stageBytes.toString('utf8').replace(/^\uFEFF/u, '').trim().split(/\r?\n/u).map(line => JSON.parse(line.replace(/^\uFEFF/u, '')));
  assertTableLifecycle({runner, terminal, report, stages, profile: envelope, envelopeSha256});
  // The old comparator receives the actual unchanged generator identity; it is
  // not recomputed from, or rewritten to impersonate, the new controller.
  const expectedInput = path.join(nativeRoot, 'table-colors.pptx');
  assert.equal(path.resolve(report.inputs.sourcePath), expectedInput); assert.equal(report.inputs.sourceSha256, envelope.selectedCase.archiveSha256);
  assert.equal(path.resolve(report.inputs.generationPath), path.join(nativeRoot, 'generation.json'));
  assert.equal(path.resolve(report.inputs.workerPath), path.join(envelope.output, 'inputs/native-table-colors-v2.ps1'));
  assert.equal(report.inputs.workerSha256, envelope.snapshots.find(item => item.path === 'inputs/native-table-colors-v2.ps1').sha256);
  assert.equal(path.resolve(report.inputs.envelopePath), path.resolve(envelopeFile));
  for (const [phase, expected] of [['original', envelope.selectedCase.archiveSha256], ['reopened', report.savedSha256], ['edited', report.editedSha256]]) assert.equal(report.opens.find(open => open.phase === phase).archiveSha256, expected, 'Open used another archive');
  for (const phase of ['original', 'reopened', 'edited']) for (const slide of report[phase]) {
    const png = await tableAsset(nativeRoot, slide.png);
    assert.ok(png.length >= 33 && png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), 'Capture is not a PNG');
    assert.equal(png.readUInt32BE(16), 1280); assert.equal(png.readUInt32BE(20), 720);
  }
  const comparison = await compareNativeTableColors({consumer: envelope.consumer, output: envelope.output, sourceIdentity: envelope.generationIdentity});
  const archives = {};
  for (const file of ['table-colors.pptx', 'table-colors-saved.pptx', 'table-colors-edited.pptx']) archives[file] = digest(await tableAsset(nativeRoot, file));
  const result = {...comparison, profile: 'table-colors-v2', envelopeSha256, sourceSuiteSha256: envelope.suiteSha256,
    generationIdentity: envelope.generationIdentity, executionIdentity: envelope.controller, archives,
    runnerSha256: digest(runnerBytes), nativeSha256: digest(reportBytes), terminalSha256: digest(terminalBytes), stagesSha256: digest(stageBytes), nativeAcceptance: false, registryAcceptance: false};
  await writeFile(path.join(envelope.output, 'table-profile-comparison.json'), `${JSON.stringify(result, null, 2)}\n`, {flag: 'wx'});
  return result;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  assert.equal(args.length, 4); assert.equal(args[0], '--envelope'); assert.equal(args[2], '--sha256');
  console.log(JSON.stringify(await compareTableProfile({envelopeFile: path.resolve(args[1]), envelopeSha256: args[3]})));
}
