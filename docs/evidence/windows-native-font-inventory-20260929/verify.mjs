import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, readdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Read-only portable receipt verification. This does not replay Office or the
// full native auditor, whose original-path/font inputs are intentionally absent.
const root = path.dirname(fileURLToPath(import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const bytes = name => readFileSync(path.join(root, name));
const json = name => JSON.parse(bytes(name).toString('utf8').replace(/^\uFEFF/, ''));
const files = (directory = root) => readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
  assert(!entry.isSymbolicLink(), 'Evidence must contain ordinary files/directories');
  const full = path.join(directory, entry.name);
  return entry.isDirectory() ? files(full) : [path.relative(root, full).split(path.sep).join('/')];
}).sort();
const safe = name => typeof name === 'string' && name.length > 0 && !name.includes('\\') &&
  !name.includes(':') && !name.startsWith('/') && name.split('/').every(part => part && part !== '.' && part !== '..');
const canonical = {
  'Carlito-400-normal.ttf': 'ca019755404c45627a8566915df99068949dc32ee2bce48d6aeee7542d2a0a89',
  'Carlito-400-italic.ttf': '074cd1b89d53765d90d0ed3b4bfe49523efaaf4f3f430c006bc3233778b0ebb5',
  'Carlito-700-normal.ttf': '51edbfa32d8af939913ae1f4ad0a5173e32083499218c133384638090295f0b0',
  'Carlito-700-italic.ttf': '25f5672c1985d168d6bc2973864fc5a7e374bb95fe8d0f91cff47ae17fa67691'
};
const all = files();
const manifest = json('manifest.json');
assert.equal(manifest.schemaVersion, 1);
assert(manifest.files.every(file => safe(file.path)), 'Unsafe manifest path');
assert.deepEqual(manifest.files.map(file => file.path).sort(), all.filter(file => file !== 'manifest.json'));
for (const file of manifest.files) {
  assert.equal(bytes(file.path).length, file.bytes, file.path);
  assert.equal(hash(bytes(file.path)), file.sha256, file.path);
}
const ledger = json('source-copy-ledger.json');
const copied = all.filter(file => /^(attempts|controls|fixture|environment)\//.test(file));
assert.deepEqual(ledger.files.map(file => file.bundlePath).sort(), copied, 'Every copied file needs provenance');
for (const file of ledger.files) {
  assert(safe(file.sourceArtifactPath) && safe(file.bundlePath));
  assert.equal(hash(bytes(file.bundlePath)), file.bundleSha256, file.bundlePath);
  assert.equal(bytes(file.bundlePath).length, file.bytes);
  assert.match(file.sourceSha256, /^[0-9a-f]{64}$/);
  if (file.kind === 'byte-copy') assert.equal(file.sourceSha256, file.bundleSha256);
  else {
    assert.equal(file.kind, 'redacted-copy');
    assert.equal(json(file.bundlePath).sourceSha256, file.sourceSha256);
  }
}
const omissions = json('omissions.json').files;
assert.deepEqual(omissions.map(file => file.name).sort(), Object.keys(canonical).sort());
const omitted = new Map();
for (const file of omissions) {
  assert.equal(file.sha256, canonical[file.name]);
  assert(Number.isSafeInteger(file.size) && file.size > 0);
  const expected = ['attempts/unedited-fixture-no-temp/', 'attempts/unedited-fixture-with-temp/']
    .map(prefix => prefix + 'inputs/fonts/' + file.name);
  assert.deepEqual(file.omittedFrom.sort(), expected.sort());
  for (const name of expected) { assert(!all.includes(name)); omitted.set(name, file.sha256); }
}
const fixtureHash = 'f505236ecef4fad838a198449adede1f4afa39d7bac74613626eee2f2a419aeb';
const controlHash = '14229e8ce663511fadf7c1aa035bd18e33a513d97a1825174c6171c7c605c0d2';
assert.equal(hash(bytes('fixture/source.pptx')), fixtureHash);
assert.equal(hash(bytes('fixture/exporter-output.pptx')), controlHash);

for (const [base, mode, registration, expectedSource, historical] of [
  ['attempts/unedited-fixture-no-temp', 'carlito-fixture', 'none', fixtureHash, false],
  ['attempts/unedited-fixture-with-temp', 'carlito-fixture', 'temporary-session', fixtureHash, true],
  ['controls/exporter-output-no-temp', 'control-deck', 'none', controlHash, true]
]) {
  const read = name => json(base + '/' + name);
  const request = read('request.json'), report = read('report.json');
  const supervisor = read('supervisor.json'), worker = read('worker.json'), progress = read('progress.json');
  for (const record of [request, report]) {
    assert.equal(record.inputMode, mode);
    assert.equal(record.fontRegistration.mode, registration);
    assert.equal(record.source.sha256, expectedSource);
    assert.equal(record.source.snapshotSha256, expectedSource);
  }
  assert.equal(hash(bytes(base + '/inputs/source.pptx')), expectedSource);
  assert.equal(report.source.readOnly, -1);
  assert.equal(report.source.openedPathMatches, true);
  assert.equal(report.source.fullName, request.source.snapshotPath);
  assert.equal(report.source.snapshotUnchangedAfterClose, true);
  assert.equal(report.ownedOpenCount, 1);
  assert.equal(report.ownedCloseCount, 1);
  assert.equal(report.cleanupConfirmed, true);
  assert.equal(report.officeOperationsStopped, false);
  assert.equal(report.error, null);
  assert.deepEqual(report.semanticFailures, []);
  assert.deepEqual(report.boundsExceeded, []);
  assert.deepEqual(report.presentationFonts.entries.map(({name, embedded, embeddable}) => ({name, embedded, embeddable})),
    [{name: '', embedded: 0, embeddable: 0}, {name: 'Aptos', embedded: 0, embeddable: -1}]);
  assert.equal(supervisor.passed, true);
  assert.equal(supervisor.officeLifecycleComplete, true);
  assert.equal(supervisor.readOnlyConfirmed, true);
  assert.equal(supervisor.inventoryComplete, true);
  assert.equal(supervisor.inputsUnchanged, true);
  assert.equal(supervisor.ownedOpenCount, 1);
  assert.equal(supervisor.ownedCloseCount, 1);
  assert.equal(supervisor.parentError, null);
  assert.equal(supervisor.exitCode, 0);
  assert.equal(supervisor.timedOut, false);
  assert.equal(worker.exitCode, 0);
  assert.equal(worker.timedOut, false);
  assert.equal(worker.timeoutSeconds, 45);
  assert(Date.parse(worker.finishedAt) >= Date.parse(worker.startedAt));
  assert(Date.parse(worker.finishedAt) - Date.parse(worker.startedAt) <= 45000);
  assert.equal(progress.stage, 'worker.complete');
  assert.equal(progress.status, 'success');
  assert.equal(progress.cleanupConfirmed, true);
  assert.equal(progress.ownedPresentationPath, null);

  const bindings = [
    ['source.pptx', request.source], ['native-font-inventory.ps1', request.verifier],
    ['native-process.ps1', request.processHelper], ['native-text-fonts.ps1', request.fontHelper],
    ...(request.fixture ? [['generation.json', request.fixture.generation], ['LICENSE_FONT', request.fixture.license]] : [])
  ];
  for (const [name, binding] of bindings) {
    assert.equal(binding.sha256, binding.snapshotSha256);
    assert.equal(hash(bytes(base + '/inputs/' + name)), binding.sha256);
  }
  for (const font of request.fixture?.fonts ?? []) {
    assert.equal(font.sha256, canonical[path.posix.basename(font.file)]);
    assert.equal(font.snapshotSha256, font.sha256);
    assert.equal(omitted.get(base + '/inputs/' + font.file), font.sha256);
  }
  if (request.fixture) assert.equal(request.fixture.fonts.length, 4);
  assert(supervisor.inputChecks.length >= 8);
  assert(supervisor.inputChecks.every(check => check.matched === true && check.expected === check.actual));
  if (registration === 'temporary-session') {
    assert.equal(request.fontRegistration.flags, 0);
    assert.equal(report.fontRegistration.flags, 0);
    assert.equal(supervisor.registrationFilePresent, true);
    assert.equal(supervisor.fontCleanupConfirmed, true);
    const registrations = read('font-registration.json');
    assert.equal(registrations.length, 4);
    for (const font of registrations) {
      assert.equal(font.sha256, canonical[path.posix.basename(font.file)]);
      assert(font.added > 0 && font.removed === true);
    }
  } else {
    assert.equal(supervisor.registrationFilePresent, false);
    assert(!all.includes(base + '/font-registration.json'));
  }

  const stages = bytes(base + '/stages.jsonl').toString('utf8').trim().split(/\r?\n/).map(line => JSON.parse(line));
  let pending = null;
  stages.forEach((stage, index) => {
    assert.equal(stage.sequence, index + 1);
    assert.equal(stage.error, null);
    assert.equal(stage.officeOperationsStopped, false);
    assert(['begin', 'success'].includes(stage.status));
    if (stage.status === 'begin') { assert.equal(pending, null); pending = stage.stage; }
    else if (pending !== null) { assert.equal(stage.stage, pending); pending = null; }
  });
  assert.equal(pending, null);
  const successes = stages.filter(stage => stage.status === 'success');
  for (const name of ['input.presentation.open-readonly', 'owned.presentation.close']) {
    assert.equal(successes.filter(stage => stage.stage === name).length, 1);
  }
  assert.deepEqual(stages.at(-1), progress);
  const fontIndex = stages.findIndex(stage => stage.stage === 'owned.presentation.fonts.get');
  const themeIndex = stages.findIndex(stage => /theme.*get/.test(stage.stage));
  assert(fontIndex > 0 && themeIndex > fontIndex, 'Fonts must be recorded before content/theme reads');
  const audit = read(historical ? 'audit-reaudit-v2.json' : 'audit.json');
  assert.equal(audit.schemaVersion, 2);
  assert.equal(audit.passed, true);
  assert.deepEqual(audit.failures, []);
  for (const [name, expected] of Object.entries(audit.rawHashes)) {
    if (name.startsWith('original:') || name.startsWith('reviewed/')) continue;
    const included = base + '/' + name;
    assert.equal(all.includes(included) ? hash(bytes(included)) : omitted.get(included), expected, included);
  }
  for (const name of ['request.json', 'report.json', 'supervisor.json', 'worker.json', 'progress.json', 'stages.jsonl']) {
    assert.equal(audit.rawHashes[name], hash(bytes(base + '/' + name)), 'Audit must bind ' + name);
  }
  if (historical) {
    const original = read('audit-original.json');
    assert.equal(original.passed, false);
    assert.deepEqual(original.failures.map(failure => failure.code), ['observation-font-entry']);
  }
}

// Read central-directory names, not a regex over compressed file contents.
function zipNames(buffer) {
  let end = -1;
  for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 65557); offset--) {
    if (buffer.readUInt32LE(offset) === 0x06054b50 && offset + 22 + buffer.readUInt16LE(offset + 20) === buffer.length) { end = offset; break; }
  }
  assert(end >= 0, 'ZIP end record missing');
  assert.equal(buffer.readUInt16LE(end + 4), 0);
  assert.equal(buffer.readUInt16LE(end + 6), 0);
  const count = buffer.readUInt16LE(end + 10), names = [];
  assert.equal(buffer.readUInt16LE(end + 8), count);
  assert(count < 65535, 'ZIP64 is outside this finite bundle');
  let offset = buffer.readUInt32LE(end + 16);
  const limit = offset + buffer.readUInt32LE(end + 12);
  assert.equal(limit, end);
  for (let index = 0; index < count; index++) {
    assert(offset + 46 <= limit);
    assert.equal(buffer.readUInt32LE(offset), 0x02014b50);
    const nameLength = buffer.readUInt16LE(offset + 28);
    names.push(buffer.subarray(offset + 46, offset + 46 + nameLength).toString('utf8'));
    offset += 46 + nameLength + buffer.readUInt16LE(offset + 30) + buffer.readUInt16LE(offset + 32);
  }
  assert.equal(offset, limit);
  return names;
}
const isFont = name => /(^|\/)ppt\/fonts\/|\.(ttf|otf|ttc|odttf|woff2?|fntdata)$/i.test(name);
assert(!all.some(isFont), 'Font binary included');
for (const name of all.filter(name => name.endsWith('.pptx'))) assert(!zipNames(bytes(name)).some(isFont), 'Embedded font in ' + name);
console.log(JSON.stringify({passed: true, files: manifest.files.length, provenanceRecords: ledger.files.length, inventories: 3,
  scope: 'Portable recorded-evidence checks; no Office replay, glyph identity, font allowlist or embedding claim.'}));
