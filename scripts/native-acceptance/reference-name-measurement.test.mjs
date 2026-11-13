// The recorded PowerPoint run of the sealed reference Name input. Real retained PowerPoint outputs; no Office here.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {digest} from './identity.mjs';
import {readReferenceSources} from './reference-chart-fixtures.mjs';
import {REFERENCE_NAME_INPUT, REFERENCE_NAME_ACTION} from './reference-name-contract.mjs';
import {assertReferenceNameSnapshotNative, compareReferenceNameSnapshots} from './reference-name-snapshot-contract.mjs';
import {ROOT, RESEAL_FILES, currentPins} from './reference-name-reseal.mjs';

// The archive the single-copy route ran on (2026-11-11, setter and lifecycle completed, archive admission failed). No run of
// the three-archive route on it was recorded, so it is the one input this test admits without a measurement.
const LEGACY_UNRECORDED_INPUT = Object.freeze({bytes: 129025, sha256: '06c82deb1dbe067d4f097aebe760b8f1dbdcc0e2a74e95b8d1f99eeea2302a83'});
const folder = path.join(ROOT, RESEAL_FILES.measurement),
  recorded = fs.existsSync(path.join(folder, 'measurement.json'));
const identity = (bytes) => ({bytes: bytes.length, sha256: digest(bytes)});
const retained = (name) => fs.readFileSync(path.join(folder, name));

test('a re-sealed input has a recorded PowerPoint measurement', () => {
  assert.deepEqual(identity(fs.readFileSync(path.join(ROOT, RESEAL_FILES.fixture))), REFERENCE_NAME_INPUT, 'The retained archive is the sealed input');
  if (!recorded) assert.deepEqual(REFERENCE_NAME_INPUT, LEGACY_UNRECORDED_INPUT, 'Record the PowerPoint run of the new input: reference-name-reseal.mjs record-run --write');
});

test('the recorded run measured the sealed input and every retained file is the recorded one', {skip: !recorded && 'no measurement recorded for the legacy input'}, () => {
  const m = JSON.parse(retained('measurement.json'));
  assert.deepEqual(m.input, REFERENCE_NAME_INPUT);
  assert.equal(m.profile, 'reference-line-one-name-three-native-archives-v1');
  assert.deepEqual(Object.keys(m.retained).sort(), fs.readdirSync(folder).filter((name) => name !== 'measurement.json').sort());
  for (const [name, expected] of Object.entries(m.retained)) assert.deepEqual(identity(retained(name)), expected, name);
  assert.deepEqual(m.names, {original: REFERENCE_NAME_ACTION.expectedName, edited: REFERENCE_NAME_ACTION.newName, reopened: REFERENCE_NAME_ACTION.newName});
  assert.deepEqual(
    m.otherNames,
    currentPins().helperNames.map((name, i) => ({index: i + 2, name})),
  );
  assert.equal(m.postflight.observedZero, true);
});

test('the real PowerPoint report, stages and three archives pass the route contract again', {skip: !recorded && 'no measurement recorded for the legacy input'}, async () => {
  const m = JSON.parse(retained('measurement.json')),
    // Windows PowerShell 5.1 writes the worker's report with a byte order mark; the retained bytes are the run's own.
    report = JSON.parse(retained('report.json').toString('utf8').replace(/^﻿/u, '')),
    stages = retained('stages.jsonl');
  assert.deepEqual(assertReferenceNameSnapshotNative(report, stages), m.native);
  if (!m.retained['native-furniture-control.pptx']) return;
  const source = readReferenceSources().find((row) => row.id === 'reference-native-lines').document,
    input = fs.readFileSync(path.join(ROOT, RESEAL_FILES.fixture)),
    archives = {source: input, before: retained('reference-name-before.pptx'), edited: retained('native-furniture-control.pptx'), reopened: retained('reference-name-reopened.pptx')};
  for (const phase of ['before', 'edited', 'reopened']) assert.deepEqual(identity(archives[phase]), m.archives[phase], phase);
  const result = await compareReferenceNameSnapshots({input, reference: {source: {deck: source}}, envelope: {generation: {consumer: ROOT}}}, report, stages, archives);
  assert.equal(result.sourceBefore.qualification, 'OPEN');
  assert.deepEqual(result.sourceBefore.rawFindings.map((row) => row.part), m.firstSaveOpenParts, 'The same first-Save parts stay OPEN');
  assert.equal(result.nativeAcceptance, false);
});
