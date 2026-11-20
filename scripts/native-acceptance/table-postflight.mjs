import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import {fileIdentity} from './identity.mjs';
import {OWNED_POSTFLIGHT_POLICY, assertOwnedStageWire, assertOwnedOperations, ownedSuccess, assertOwnedKernel, readOwnedFile, readOwnedJson, makeOwnedAdmission, sourceIdentityFiles} from './owned-postflight.mjs';

export const TABLE_POSTFLIGHT_POLICY = Object.freeze({policy: 'table-bounded-global-zero-after-completed-owned-quit-v1', ...OWNED_POSTFLIGHT_POLICY});
export function tableExpectedOperations(generation) {
  assert.equal(generation.expected.length, 6);
  const names = ['worker.initialize', 'application.create', 'application.initial.count', 'application.version', 'application.path'];
  const object = (phase, i) => names.push(...['get', 'shapes', 'shape', 'hasTable', 'table', 'rows', 'columns'].map(suffix => phase + '.slide.' + i + '.' + suffix));
  const open = phase => names.push(...['preflight.count', 'open', 'fullName', 'readOnly'].map(suffix => phase + '.' + suffix));
  const close = phase => names.push(...['close.fullName', 'close.discard', 'close'].map(suffix => phase + '.' + suffix));
  const save = phase => names.push(...['save.fullName', 'saveCopyAs', 'save.afterName'].map(suffix => phase + '.' + suffix));
  const read = phase => {
    names.push(phase + '.slides.count');
    for (let i = 1; i <= 6; i++) {
      object(phase, i); assert.equal(generation.expected[i - 1].cells.length, 4);
      const expectedTextRuns = [['Header'], ['Inherited', 'Explicit'], ['Body'], ['BodyInherited', 'BodyExplicit']];
      for (const [position, cell] of generation.expected[i - 1].cells.entries()) {
        assert.deepEqual([cell.row, cell.column], [[1, 1], [1, 2], [2, 1], [2, 2]][position]);
        assert.deepEqual(cell.runs.map(run => run.text), expectedTextRuns[position]);
        const prefix = phase + '.slide.' + i + '.cell.' + cell.row + '.' + cell.column;
        const text = (phase === 'edited' && cell.row === 2 && cell.column === 1 ? 'Native ' : '') + cell.runs.map(run => run.text).join('');
        names.push(prefix + '.range', prefix + '.text');
        for (let k = 1; k <= text.length; k++) names.push(prefix + '.character.' + k + '.color');
      }
      names.push(phase + '.slide.' + i + '.capture');
    }
  };
  open('original'); read('original'); save('original'); close('original');
  open('reopened'); read('reopened');
  for (let i = 1; i <= 6; i++) { object('edit', i); names.push(...['range', 'before', 'prefix', 'after'].map(suffix => 'edit.slide.' + i + '.' + suffix)); }
  save('edited'); close('reopened'); open('edited'); read('edited'); close('edited');
  names.push('application.final.count', 'application.quit', 'worker.complete');
  return names;
}
export function assertTablePostflightReady({terminal, report, request, stages, profile, generation, progress}) {
  assertOwnedKernel(terminal, request.timeoutSeconds);
  assert.equal(request.profile, 'table-colors-v3'); assert.deepEqual(request.policy, TABLE_POSTFLIGHT_POLICY); assert.equal(request.runOfficeRequested, true);
  assert.equal(report.schemaVersion, 3); assert.equal(report.profile, request.profile); assert.equal(report.envelopeSha256, request.envelopeSha256);
  assert.equal(report.cleanupConfirmed, true); assert.equal(report.officeOperationsStopped, false);
  assert.ok(Object.hasOwn(report, 'error')); assert.equal(report.error, null);
  assert.equal(report.lastStage, 'worker.complete'); assert.equal(report.lastStatus, 'success');
  assert.deepEqual(report.generationIdentity, profile.generationIdentity); assert.deepEqual(report.executionIdentity, profile.controller);
  assert.equal(report.nativeAcceptance, false); assert.equal(report.registryAcceptance, false);
  const successes = assertOwnedOperations(stages, tableExpectedOperations(generation)), value = name => ownedSuccess(stages, name).value;
  assert.deepEqual(progress, stages.at(-1)); assert.equal(progress.cleanupConfirmed, true); assert.equal(progress.ownedPresentationPath, null);
  for (const name of ['application.initial.count', 'original.preflight.count', 'reopened.preflight.count', 'edited.preflight.count', 'application.final.count']) assert.equal(value(name), 0);
  const ownedPaths = {original: path.join(profile.output, 'table-colors/table-colors.pptx'), reopened: path.join(profile.output, 'table-colors/table-colors-saved.pptx'), edited: path.join(profile.output, 'table-colors/table-colors-edited.pptx')};
  let owned = null;
  for (const stage of stages) {
    for (const phase of Object.keys(ownedPaths)) if (stage.stage === phase + '.open' && stage.status === 'begin') owned = ownedPaths[phase];
    assert.ok(Object.hasOwn(stage, 'ownedPresentationPath'));
    assert.equal(stage.ownedPresentationPath, owned, 'Actual owned stage path differs');
    if (Object.keys(ownedPaths).some(phase => stage.stage === phase + '.close' && stage.status === 'success')) owned = null;
  }
  const expectedPaths = {original: path.join(profile.output, 'table-colors/table-colors.pptx'), reopened: path.join(profile.output, 'table-colors/table-colors-saved.pptx'), edited: path.join(profile.output, 'table-colors/table-colors-edited.pptx')};
  assert.deepEqual(report.opens.map(open => [open.phase, open.path, open.readOnly]), Object.entries(expectedPaths).map(([phase, file]) => [phase, file, -1]));
  const expectedEdits = [];
  for (let i = 1; i <= 6; i++) {
    const cell = generation.expected[i - 1].cells.find(item => item.row === 2 && item.column === 1);
    const before = cell.runs.map(run => run.text).join('');
    expectedEdits.push({slide: i, row: 2, column: 1, before, after: 'Native ' + before, prefix: 'Native '});
    assert.equal(value('edit.slide.' + i + '.before'), before); assert.equal(value('edit.slide.' + i + '.after'), 'Native ' + before);
  }
  assert.deepEqual(report.edits, expectedEdits);
  for (let i = 1; i <= 6; i++) for (const [suffix, expected] of [['shapes', 1], ['hasTable', -1], ['rows', 2], ['columns', 2]]) assert.equal(value('edit.slide.' + i + '.' + suffix), expected);
  for (const [phase, file] of Object.entries(expectedPaths)) {
    assert.equal(value(phase + '.fullName'), file); assert.equal(value(phase + '.readOnly'), -1); assert.equal(value(phase + '.close.fullName'), file);
    assert.equal(value(phase + '.slides.count'), 6); assert.equal(report[phase].length, 6);
    for (let i = 1; i <= 6; i++) {
      for (const [suffix, expected] of [['shapes', 1], ['hasTable', -1], ['rows', 2], ['columns', 2]]) assert.equal(value(phase + '.slide.' + i + '.' + suffix), expected);
      const observed = report[phase][i - 1]; assert.equal(observed.slide, i); assert.equal(observed.cells.length, 4);
      for (const [index, cell] of generation.expected[i - 1].cells.entries()) {
        const prefix = phase === 'edited' && cell.row === 2 && cell.column === 1 ? 'Native ' : '';
        const expectedText = prefix + cell.runs.map(run => run.text).join('');
        const colors = [...prefix].map(() => cell.runs[0].color).concat(cell.runs.flatMap(run => Array.from({length: run.text.length}, () => run.color)));
        const actual = observed.cells[index], base = phase + '.slide.' + i + '.cell.' + cell.row + '.' + cell.column;
        assert.equal(actual.row, cell.row); assert.equal(actual.column, cell.column); assert.equal(actual.text, expectedText); assert.equal(value(base + '.text'), expectedText);
        assert.equal(actual.characters.length, expectedText.length);
        for (let k = 0; k < expectedText.length; k++) {
          assert.deepEqual(actual.characters[k], {character: expectedText[k], color: colors[k]});
          const rgb = value(base + '.character.' + (k + 1) + '.color');
          assert.ok(Number.isInteger(rgb) && rgb >= 0 && rgb <= 16777215);
          const hex = '#' + [rgb & 255, (rgb >> 8) & 255, (rgb >> 16) & 255].map(part => part.toString(16).padStart(2, '0')).join('').toUpperCase();
          assert.equal(hex, colors[k]);
        }
      }
    }
  }
  assert.equal(value('original.save.fullName'), expectedPaths.original); assert.equal(value('original.save.afterName'), expectedPaths.original);
  assert.equal(value('edited.save.fullName'), expectedPaths.reopened); assert.equal(value('edited.save.afterName'), expectedPaths.reopened);
  return {workerCleanupConfirmed: true, stageCount: stages.length, lifecycle: successes.map(({stage, sequence}) => ({stage, sequence})), opens: 3, saves: 2, closes: 3, edits: 6, quits: 1};
}
export function verifyTablePostflightBinding(binding, requestBinding) {
  const {envelope: profile, source} = binding, root = path.join(profile.output, 'table-colors'), at = relative => path.join(root, relative);
  assert.equal(fs.existsSync(at('failure.json')), false);
  const report = readOwnedJson(at('native.json')), terminal = readOwnedJson(at('worker.json')), progress = readOwnedJson(at('progress.json'));
  const stages = assertOwnedStageWire(readOwnedFile(at('stages.jsonl'), 4 * 1024 * 1024));
  assert.equal(report.requestSha256, requestBinding.identity.sha256);
  const ready = assertTablePostflightReady({terminal, report, request: requestBinding.request, stages, profile, generation: source.generation, progress});
  assert.equal(report.generationSha256, fileIdentity(at('generation.json')).sha256);
  const probeBytes = readOwnedFile(at('character-probes.jsonl'), 4 * 1024 * 1024);
  const probes = probeBytes.toString('utf8').replace(/^\uFEFF/u, '').trim().split(/\r?\n/u).map(line => JSON.parse(line.replace(/^\uFEFF/u, '')));
  const expectedProbes = [];
  for (const phase of ['original', 'reopened', 'edited']) for (const slide of report[phase]) for (const cell of slide.cells) for (const [index, character] of cell.characters.entries()) {
    const name = phase + '.slide.' + slide.slide + '.cell.' + cell.row + '.' + cell.column + '.character.' + (index + 1) + '.color';
    const rgb = ownedSuccess(stages, name).value;
    const actual = probes[expectedProbes.length];
    assert.ok(actual && ['System.Int32', 'System.Int64'].includes(actual.actualType));
    expectedProbes.push({phase, slide: slide.slide, row: cell.row, column: cell.column, characterIndex: index + 1,
      character: character.character, expectedColor: character.color, actualRgb: rgb, actualType: actual.actualType, actualHex: character.color, rgbValid: true});
  }
  assert.deepEqual(probes, expectedProbes, 'Complete exact character probe journal required');
  const files = ['native.json', 'worker.json', 'progress.json', 'stages.jsonl', 'character-probes.jsonl'].map(at);
  for (const [phase, name, expected] of [['original', 'table-colors.pptx', profile.selectedCase.archiveSha256], ['reopened', 'table-colors-saved.pptx', report.savedSha256], ['edited', 'table-colors-edited.pptx', report.editedSha256]]) {
    assert.equal(fileIdentity(at(name)).sha256, expected);
    assert.equal(report.opens.find(open => open.phase === phase).archiveSha256, expected); files.push(at(name));
    for (const [index, slide] of report[phase].entries()) {
      assert.equal(slide.png, phase + '-' + (index + 1) + '.png'); assert.equal(fileIdentity(at(slide.png)).sha256, slide.pngSha256); files.push(at(slide.png));
    }
  }
  assert.equal(report.inputs.sourcePath, at('table-colors.pptx')); assert.equal(report.inputs.sourceSha256, profile.selectedCase.archiveSha256);
  assert.equal(report.inputs.generationPath, at('generation.json')); assert.equal(report.inputs.envelopePath, path.join(profile.output, 'table-profile.json'));
  const worker = path.join(profile.output, 'inputs/native-table-colors-v3.ps1');
  assert.equal(report.inputs.workerPath, worker); assert.equal(report.inputs.workerSha256, fileIdentity(worker).sha256);
  files.push(path.join(profile.output, 'table-profile.json'), path.join(profile.output, 'execution-request.json'), ...profile.snapshots.map(item => path.join(profile.output, item.path)), profile.node.path, ...sourceIdentityFiles(profile.controller, profile.generationIdentity));
  return makeOwnedAdmission({profile: report.profile, policy: TABLE_POSTFLIGHT_POLICY, requestSha256: requestBinding.identity.sha256, files, ready});
}

