// Shared wire/identity plumbing only. Admission remains separately typed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {digest, fileIdentity} from './identity.mjs';
import {assertReferenceWitnessPostflight} from './reference-chart-profile.mjs';

export const OWNED_POSTFLIGHT_POLICY = Object.freeze({
  observationPolicy: 'global-zero-after-completed-owned-quit-v1',
  budgetMilliseconds: 5000, intervalMilliseconds: 100, maximumQueries: 51,
  observerSource: 'scripts/native-acceptance/run-reference-chart-profile.ps1',
  observerSourceSha256: '8902c341911dd9711872b4745d8ac3fe6524b9f5dcaa6d7ccd17b7f1f1116ee3',
});
export const REQUEST_HASH_TOKEN = '@request-sha256';
export const OWNED_SHARED_FILES = [
  'scripts/native-acceptance/owned-postflight.mjs',
  'scripts/native-acceptance/owned-postflight.ps1',
  OWNED_POSTFLIGHT_POLICY.observerSource,
];

// Static relative ESM dependencies are code authority too, including re-exports.
// This only reads source; it never imports a prospective launcher or worker.
export function ownedControllerFiles(root, entries) {
  const found = new Set();
  function visit(relative) {
    assert.ok(/^[a-zA-Z0-9_./-]+$/u.test(relative) && !relative.split('/').includes('..'));
    if (found.has(relative)) return;
    assert.ok(found.size < 256, 'Bounded controller dependency closure');
    found.add(relative);
    const source = readOwnedFile(path.join(root, relative), 4 * 1024 * 1024).toString('utf8');
    if (!relative.endsWith('.mjs')) return;
    for (const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*)['"](\.[^'"]+)['"]/gu)) {
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(relative), match[1]));
      assert.ok(target.endsWith('.mjs'), 'Unexpected controller module dependency');
      visit(target);
    }
  }
  for (const entry of entries) visit(entry);
  return [...found].sort();
}

export function canonicalOwnedPath(file) {
  assert.equal(typeof file, 'string');
  assert.ok(path.isAbsolute(file) && !/[\u0000-\u001f]/u.test(file) && !file.startsWith('\\\\'), 'Absolute local path required');
  assert.equal(path.resolve(file), file, 'Canonical path required');
  let cursor = file;
  while (true) {
    if (fs.existsSync(cursor)) assert.equal(fs.lstatSync(cursor).isSymbolicLink(), false, 'Aliased path');
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  if (fs.existsSync(file)) assert.equal(fs.realpathSync(file), file, 'Noncanonical real path');
  return file;
}
export function readOwnedFile(file, maximum = 64 * 1024 * 1024) {
  canonicalOwnedPath(file);
  const stat = fs.lstatSync(file);
  assert.ok(stat.isFile() && stat.size >= 0 && stat.size <= maximum, 'Bounded regular file required');
  return fs.readFileSync(file);
}
export function parseOwnedJson(bytes) {
  return JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/u, ''));
}
export function readOwnedJson(file) { return parseOwnedJson(readOwnedFile(file, 4 * 1024 * 1024)); }
export function assertOwnedKeys(record, keys) {
  assert.ok(record && typeof record === 'object' && !Array.isArray(record));
  assert.deepEqual(Object.keys(record).sort(), [...keys].sort(), 'Unsupported/missing record field');
}
export function assertOwnedStagePrimitive(value) {
  assert.ok(value === null || typeof value === 'string' || typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value)), 'Stage value must be an exact finite primitive');
}
export function assertOwnedStageWire(bytes) {
  assert.ok(Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= 4 * 1024 * 1024);
  const text = bytes.toString('utf8').replace(/^\uFEFF/u, '');
  const lines = text.trimEnd().split(/\r?\n/u);
  assert.ok(lines.length > 0 && lines.length <= 5000, 'Bounded stage journal');
  let previous = -Infinity;
  return lines.map((line, index) => {
    const stage = JSON.parse(line.replace(/^\uFEFF/u, ''));
    const fields = ['sequence', 'timestamp', 'stage', 'status', 'value', 'error', 'officeOperationsStopped', 'cleanupConfirmed'];
    assertOwnedKeys(stage, Object.hasOwn(stage, 'ownedPresentationPath') ? [...fields, 'ownedPresentationPath'] : fields);
    assert.ok(Object.hasOwn(stage, 'value'), 'Actual stage value field required');
    assertOwnedStagePrimitive(stage.value);
    assert.ok(Object.hasOwn(stage, 'error') && (stage.error === null || stage.error === ''), 'Actual successful error wire required');
    assert.equal(stage.sequence, index + 1);
    assert.ok(Number.isSafeInteger(stage.sequence));
    assert.ok(['begin', 'success'].includes(stage.status));
    assert.equal(stage.officeOperationsStopped, false);
    assert.equal(typeof stage.cleanupConfirmed, 'boolean');
    assert.ok(typeof stage.timestamp === 'string' && /Z$/u.test(stage.timestamp));
    const stamp = Date.parse(stage.timestamp);
    assert.ok(Number.isFinite(stamp) && stamp >= previous);
    previous = stamp;
    return stage;
  });
}
export function assertOwnedOperations(stages, names) {
  const expected = names.flatMap(stage => stage.startsWith('worker.')
    ? [{stage, status: 'success'}]
    : [{stage, status: 'begin'}, {stage, status: 'success'}]);
  assert.equal(stages.length, expected.length, 'Missing or extra operation');
  for (const [index, stage] of stages.entries()) {
    assert.ok(Object.hasOwn(stage, 'value'), 'Actual stage value field required');
    assertOwnedStagePrimitive(stage.value);
    assert.equal(stage.sequence, index + 1);
    assert.equal(stage.stage, expected[index].stage);
    assert.equal(stage.status, expected[index].status);
    assert.ok(Object.hasOwn(stage, 'error') && (stage.error === null || stage.error === ''));
    assert.equal(stage.officeOperationsStopped, false);
  }
  return stages.filter(stage => stage.status === 'success');
}
export function ownedSuccess(stages, name) {
  const matches = stages.filter(stage => stage.stage === name && stage.status === 'success');
  assert.equal(matches.length, 1, 'Missing/duplicate actual operation ' + name);
  return matches[0];
}
export function assertOwnedKernel(terminal, timeout) {
  assert.equal(terminal.timedOut, false);
  assert.equal(terminal.exitCode, 0);
  assert.ok(Number.isInteger(terminal.exitCode));
  assert.equal(terminal.timeoutSeconds, timeout);
  assert.ok(Number.isInteger(timeout) && timeout >= 5 && timeout <= 60);
  for (const field of ['startedAt', 'finishedAt']) assert.ok(typeof terminal[field] === 'string' && /Z$/u.test(terminal[field]) && Number.isFinite(Date.parse(terminal[field])));
  assert.ok(Date.parse(terminal.finishedAt) >= Date.parse(terminal.startedAt));
}

export function makeOwnedRequest({profile, policy, envelopeSha256, output, node, controller, generation, snapshots, timeoutSeconds, runOfficeRequested, selectedCase, workerArguments, workerPath, nativeRoot}) {
  assert.ok(['seven-chart-original-readonly-v2', 'table-colors-v3'].includes(profile));
  assert.equal(typeof runOfficeRequested, 'boolean');
  assert.ok(Number.isInteger(timeoutSeconds) && timeoutSeconds >= 5 && timeoutSeconds <= 60);
  for (const file of [output, node.path, workerPath, nativeRoot]) canonicalOwnedPath(file);
  assert.equal(workerArguments.filter(item => item === REQUEST_HASH_TOKEN).length, 1);
  assert.ok(workerArguments.every(item => typeof item === 'string'));
  return {schemaVersion: 1, profile, policy, envelopeSha256, output, node, controller, generation, snapshots,
    timeoutSeconds, runOfficeRequested, selectedCase, workerPath, nativeRoot, workerArguments,
    nativeAcceptance: false, registryAcceptance: false};
}
export function writeOwnedRequest(file, expected) {
  const bytes = Buffer.from(JSON.stringify(expected, null, 2) + '\n');
  fs.writeFileSync(canonicalOwnedPath(file), bytes, {flag: 'wx'});
  const identity = {path: 'execution-request.json', bytes: bytes.length, sha256: digest(bytes)};
  return {identity, workerArguments: expected.workerArguments.map(item => item === REQUEST_HASH_TOKEN ? identity.sha256 : item)};
}
export function bindOwnedRequest(file, expected, expectedSha256) {
  const bytes = readOwnedFile(file, 4 * 1024 * 1024), request = parseOwnedJson(bytes);
  assert.deepEqual(request, expected, 'Immutable request differs from exact current source authorization');
  if (expectedSha256 !== undefined) assert.equal(digest(bytes), expectedSha256);
  return {request, identity: {path: 'execution-request.json', bytes: bytes.length, sha256: digest(bytes)}};
}
export function sourceIdentityFiles(...identities) {
  const files = [];
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    if (typeof value.directory === 'string' && Array.isArray(value.files)) {
      for (const record of value.files) files.push(path.join(value.directory, record.path));
    }
    if (typeof value.directory === 'string' && Array.isArray(value.runtime?.files)) {
      for (const record of value.runtime.files) files.push(path.join(value.directory, record.path));
    }
    for (const child of Object.values(value)) if (typeof child === 'object') visit(child);
  }
  for (const identity of identities) visit(identity);
  return [...new Set(files)];
}
export function makeOwnedAdmission({profile, policy, requestSha256, files, ready}) {
  const records = [...new Set(files.map(canonicalOwnedPath))].sort().map(file => ({file, ...fileIdentity(file)}));
  assert.ok(records.length > 0 && records.length <= 2000);
  return {schemaVersion: 1, profile, policy, requestSha256, ready, files: records, nativeAcceptance: false, registryAcceptance: false};
}
export function writeOwnedAdmission(file, admission) {
  const bytes = Buffer.from(JSON.stringify(admission, null, 2) + '\n');
  fs.writeFileSync(canonicalOwnedPath(file), bytes, {flag: 'wx'});
  return {path: file, bytes: bytes.length, sha256: digest(bytes)};
}
export function assertOwnedAdmissionFiles(admission) {
  assertOwnedKeys(admission, ['schemaVersion', 'profile', 'policy', 'requestSha256', 'ready', 'files', 'nativeAcceptance', 'registryAcceptance']);
  assert.equal(admission.schemaVersion, 1);
  assert.equal(admission.nativeAcceptance, false);
  assert.equal(admission.registryAcceptance, false);
  assert.ok(Array.isArray(admission.files) && admission.files.length > 0 && admission.files.length <= 2000);
  const names = new Set();
  for (const record of admission.files) {
    assertOwnedKeys(record, ['file', 'bytes', 'sha256']);
    canonicalOwnedPath(record.file);
    assert.ok(!names.has(record.file.toLowerCase()));
    names.add(record.file.toLowerCase());
    assert.deepEqual(fileIdentity(record.file), {bytes: record.bytes, sha256: record.sha256});
  }
}
export function assertOwnedPostflightArtifacts(postflight, bytes, policy, admission) {
  assert.equal(postflight.schemaVersion, 1);
  assert.deepEqual(postflight.policy, policy);
  const admissionBytes = Buffer.from(JSON.stringify(admission, null, 2) + '\n');
  const requestFiles = admission.files.filter(record => path.basename(record.file) === 'execution-request.json');
  assert.equal(requestFiles.length, 1);
  assert.equal(postflight.admission.path, path.join(path.dirname(requestFiles[0].file), 'postflight-admission.json'));
  assert.equal(postflight.admission.bytes, admissionBytes.length);
  assert.equal(postflight.admission.sha256, digest(admissionBytes));
  assert.equal(postflight.identity.path, 'postflight.jsonl');
  assert.equal(postflight.identity.bytes, bytes.length);
  assert.equal(postflight.identity.sha256, digest(bytes));
  assert.ok(bytes.length > 0 && bytes.length <= 65536);
  const rows = bytes.toString('utf8').trim().split(/\r?\n/u).map(line => JSON.parse(line));
  assertReferenceWitnessPostflight({
    workerCleanupConfirmed: postflight.workerCleanupConfirmed,
    postflightError: postflight.error, postflight: postflight.result,
    powerPointPostflightInitialCount: postflight.initialCount, powerPointPostflightCount: postflight.finalCount,
  }, rows);
  return rows;
}

