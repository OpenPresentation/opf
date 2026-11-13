// Office-free, externally pinned execution profile for the dedicated table-v2 control.
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir, lstat, realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {digest, installedIdentity, repositoryIdentity, fileIdentity} from './identity.mjs';
import {tableColorDocument} from './table-colors.mjs';

import {OWNED_SHARED_FILES, ownedControllerFiles, makeOwnedRequest, bindOwnedRequest, writeOwnedRequest, writeOwnedAdmission, readOwnedJson, REQUEST_HASH_TOKEN} from './owned-postflight.mjs';
import {TABLE_POSTFLIGHT_POLICY, verifyTablePostflightBinding} from './table-postflight.mjs';

export const TABLE_PROFILE_FILES = ownedControllerFiles(fileURLToPath(new URL('../../', import.meta.url)), [
  'scripts/native-acceptance/table-profile.mjs',
  'scripts/native-acceptance/run-table-profile.ps1',
  'scripts/native-acceptance/compare-table-profile.mjs',
  'scripts/native-acceptance/compare-table-colors.mjs',
  'scripts/native-acceptance/identity.mjs',
  'scripts/native-acceptance/table-colors.mjs',
  'scripts/native-acceptance/generate.mjs',
  'scripts/native-acceptance/table-postflight.mjs',
  'scripts/native-acceptance/table-postflight.ps1',
  ...OWNED_SHARED_FILES,
  'packages/pptx/test/native-table-colors-v3.ps1',
]);
export const TABLE_INPUTS = ['table-colors/table-colors.pptx', 'table-colors/generation.json', 'sources/table-colors.opf.json'];
const json = value => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
export async function tableRegular(file) {
  const full = path.resolve(file);
  assert.equal(await realpath(full), full, `Aliased path: ${file}`);
  const stat = await lstat(full);
  assert.ok(stat.isFile() && !stat.isSymbolicLink(), `Not a regular file: ${file}`);
  return readFile(full);
}
export function tableRelative(relative) {
  assert.equal(typeof relative, 'string');
  assert.ok(relative && !path.isAbsolute(relative) && !relative.includes('\\') && relative.split('/').every(part => part && part !== '.' && part !== '..' && !/[. ]$/u.test(part) && ![...part].some(char => char.charCodeAt(0) < 32 || '<>:"|?*'.includes(char))), 'Unsafe relative path');
  return relative;
}
export async function tableAsset(root, relative) { return tableRegular(path.join(root, tableRelative(relative))); }
function unique(records, key, label) {
  assert.ok(Array.isArray(records) && records.length > 0 && records.length <= 1000, `Invalid ${label} list`);
  const ids = records.map(record => { assert.equal(typeof record[key], 'string'); return record[key].toLowerCase(); });
  assert.equal(new Set(ids).size, ids.length, `Duplicate ${label}`);
}
export async function tableFileRecords(root, records) {
  unique(records, 'path', 'file paths');
  for (const file of records) {
    assert.match(file.sha256, /^[a-f0-9]{64}$/u);
    assert.ok(Number.isSafeInteger(file.bytes) && file.bytes >= 0);
    const bytes = await tableAsset(root, file.path);
    assert.equal(bytes.length, file.bytes, `Byte count differs: ${file.path}`);
    assert.equal(digest(bytes), file.sha256, `Hash differs: ${file.path}`);
  }
}
export function validateTableGeneration(suite, generation, source, input) {
  assert.equal(suite.schemaVersion, 1);
  unique(suite.cases, 'id', 'case IDs');
  const selected = suite.cases.find(item => item.id === 'table-colors');
  assert.ok(selected, 'Missing table-colors');
  assert.equal(selected.worker, 'table-colors');
  assert.equal(selected.dedicatedWorker, 'native-table-colors.ps1');
  assert.equal(selected.automaticControlEligible, false);
  assert.equal(selected.slideCount, 6);
  assert.equal(selected.expectedCells, 24);
  assert.equal(selected.input, TABLE_INPUTS[0]);
  assert.equal(selected.archiveSha256, digest(input));
  assert.equal(generation.pptxSha256, selected.archiveSha256);
  assert.deepEqual(generation.runtime, suite.provenance, 'Generation/runtime identity differs');
  assert.equal(generation.node, suite.provenance.node);
  const expected = tableColorDocument();
  assert.deepEqual(source, expected.document, 'Not the complete authored table source');
  assert.equal(generation.sourceSha256, digest(JSON.stringify(source)));
  assert.deepEqual(generation.expected, expected.expected, 'Table text/color contract differs');
  return selected;
}
export async function tableRepository(root, expected) {
  assert.match(expected.revision, /^[a-f0-9]{40}$/u);
  assert.equal(expected.dirty, false, 'Recorded repository must be clean');
  const actual = repositoryIdentity(root, expected.files.map(file => tableRelative(file.path)));
  assert.deepEqual(actual, expected, 'Repository identity changed');
  return actual;
}
export async function loadTableSource({suiteDirectory, producerRepository, legacyWorkerRepository, consumer}) {
  const suiteBytes = await tableRegular(path.join(suiteDirectory, 'suite.json'));
  const suite = JSON.parse(suiteBytes.toString('utf8'));
  await tableFileRecords(suiteDirectory, suite.files);
  for (const relative of TABLE_INPUTS) assert.equal(suite.files.filter(file => file.path === relative).length, 1, `Unsealed table input: ${relative}`);
  const [input, generationBytes, sourceBytes] = await Promise.all(TABLE_INPUTS.map(relative => tableAsset(suiteDirectory, relative)));
  const generation = JSON.parse(generationBytes.toString()), source = JSON.parse(sourceBytes.toString());
  const selected = validateTableGeneration(suite, generation, source, input);
  await tableRepository(producerRepository, suite.provenance.suiteRepository);
  await tableRepository(legacyWorkerRepository, suite.provenance.workerRepository);
  assert.deepEqual(installedIdentity(consumer), suite.provenance.packages, 'Installed generation runtime changed');
  assert.equal(process.version, suite.provenance.node, 'Node differs from generator');
  return {suite, suiteBytes, generation, input, generationBytes, sourceBytes, selected};
}
const ownRepository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export function assertTableOutputSeparate(output, roots) {
  const key = value => {
    assert.ok(path.isAbsolute(value), 'Table output and protected paths must be absolute');
    const full = path.resolve(value);
    return process.platform === 'win32' ? full.toLowerCase() : full;
  };
  const candidate = key(output);
  for (const root of roots) {
    const protectedPath = key(root);
    assert.ok(candidate !== protectedPath && !candidate.startsWith(protectedPath + path.sep) && !protectedPath.startsWith(candidate + path.sep), 'Table output overlaps an immutable source/runtime root');
  }
}
export async function prepareTableProfile(options, {root = ownRepository} = {}) {
  const keys = ['suiteDirectory', 'producerRepository', 'legacyWorkerRepository', 'consumer', 'output'];
  for (const key of keys) options[key] = path.resolve(options[key]);
  const controllerRepository = path.resolve(root);
  const controller = repositoryIdentity(controllerRepository, TABLE_PROFILE_FILES);
  assert.equal(controller.dirty, false, 'Freeze the new controller before preparing a profile');
  assertTableOutputSeparate(options.output, [...keys.filter(key => key !== 'output').map(key => options[key]), controllerRepository]);
  assert.equal(await realpath(path.dirname(options.output)), path.dirname(options.output));
  const source = await loadTableSource(options);
  await mkdir(options.output); // Exclusive; a failed preparation remains intact.
  await mkdir(path.join(options.output, 'inputs'));
  await mkdir(path.join(options.output, 'table-colors'));
  const snapshots = [];
  async function copy(relative, bytes) {
    await writeFile(path.join(options.output, relative), bytes, {flag: 'wx'});
    snapshots.push({path: relative, bytes: bytes.length, sha256: digest(bytes)});
  }
  await copy(TABLE_INPUTS[0], source.input);
  await copy(TABLE_INPUTS[1], source.generationBytes);
  await copy('inputs/table-colors.opf.json', source.sourceBytes);
  await copy('inputs/suite.json', source.suiteBytes);
  await copy('inputs/native-table-colors-v3.ps1', await tableRegular(path.join(controllerRepository, 'packages/pptx/test/native-table-colors-v3.ps1')));
  await copy('inputs/native-process.ps1', await tableRegular(path.join(options.legacyWorkerRepository, 'test/native-process.ps1')));
  const envelope = {schemaVersion: 2, profile: 'table-colors-v3', postflightPolicy: TABLE_POSTFLIGHT_POLICY, ...options,
    suiteSha256: digest(source.suiteBytes), selectedCase: source.selected, generationIdentity: source.suite.provenance,
    controllerRepository, controller, node: {path: process.execPath, version: process.version, identity: fileIdentity(process.execPath)}, snapshots, limits: {slides: 6, tables: 6, cells: 24, phases: 3, nativeCells: 72, pngs: 18, imports: 9, timeoutSecondsMax: 60},
    nativeAcceptance: false, registryAcceptance: false};
  const bytes = json(envelope), file = path.join(options.output, 'table-profile.json');
  await writeFile(file, bytes, {flag: 'wx'});
  return {envelope: file, sha256: digest(bytes), controllerRevision: controller.revision, nativeAcceptance: false};
}
export async function assertTableFreshOutput(output) {
  for (const relative of ['runner.json', 'execution-request.json', 'postflight-admission.json', 'postflight.jsonl', 'table-colors/worker.json', 'table-colors/worker.stdout.log', 'table-colors/worker.stderr.log', 'table-colors/supervisor.json', 'table-colors/native.json', 'table-colors/failure.json', 'table-colors/progress.json', 'table-colors/stages.jsonl', 'table-colors/character-probes.jsonl', 'table-colors/table-colors-saved.pptx', 'table-colors/table-colors-edited.pptx', ...['original', 'reopened', 'edited'].flatMap(phase => Array.from({length: 6}, (_, index) => `table-colors/${phase}-${index + 1}.png`))])
    await assert.rejects(() => lstat(path.join(output, relative)), {code: 'ENOENT'}, `Preserve prior attempt: ${relative}`);
}
export async function bindTableProfile({envelopeFile, envelopeSha256, fresh = false, root = ownRepository}) {
  assert.match(envelopeSha256, /^[a-f0-9]{64}$/u, 'External profile SHA-256 required');
  const bytes = await tableRegular(envelopeFile);
  assert.ok(bytes.length <= 4 * 1024 * 1024, 'Profile exceeds 4 MiB');
  assert.equal(digest(bytes), envelopeSha256, 'External profile hash differs');
  const envelope = JSON.parse(bytes.toString());
  assert.equal(envelope.schemaVersion, 2); assert.equal(envelope.profile, 'table-colors-v3');
  assert.deepEqual(envelope.postflightPolicy, TABLE_POSTFLIGHT_POLICY);
  assert.equal(envelope.nativeAcceptance, false); assert.equal(envelope.registryAcceptance, false);
  assert.equal(path.resolve(envelopeFile), path.join(envelope.output, 'table-profile.json'));
  assertTableOutputSeparate(envelope.output, [envelope.suiteDirectory, envelope.producerRepository, envelope.legacyWorkerRepository, envelope.consumer, envelope.controllerRepository]);
  assert.deepEqual(envelope.limits, {slides: 6, tables: 6, cells: 24, phases: 3, nativeCells: 72, pngs: 18, imports: 9, timeoutSecondsMax: 60});
  assert.equal(envelope.node.path, process.execPath); assert.equal(envelope.node.version, process.version);
  assert.match(process.version, /^v24\./u, 'Table controller requires Node24');
  assert.deepEqual(fileIdentity(envelope.node.path), envelope.node.identity, 'Node executable changed');
  assert.equal(path.resolve(envelope.controllerRepository), path.resolve(root), 'Executing controller directory differs');
  await tableRepository(envelope.controllerRepository, envelope.controller);
  assert.deepEqual(envelope.controller.files.map(file => file.path), TABLE_PROFILE_FILES);
  const source = await loadTableSource(envelope);
  assert.equal(digest(source.suiteBytes), envelope.suiteSha256);
  assert.deepEqual(envelope.selectedCase, source.selected);
  assert.deepEqual(envelope.generationIdentity, source.suite.provenance);
  await tableFileRecords(envelope.output, envelope.snapshots);
  const required = ['table-colors/table-colors.pptx', 'table-colors/generation.json', 'inputs/table-colors.opf.json', 'inputs/suite.json', 'inputs/native-table-colors-v3.ps1', 'inputs/native-process.ps1'];
  assert.deepEqual(envelope.snapshots.map(record => record.path), required);
  for (const [relative, original] of [[required[0], source.input], [required[1], source.generationBytes], [required[2], source.sourceBytes], [required[3], source.suiteBytes]])
    assert.equal(digest(await tableAsset(envelope.output, relative)), digest(original), `Snapshot/source mismatch: ${relative}`);
  for (const [relative, identity, name] of [[required[4], envelope.controller, 'packages/pptx/test/native-table-colors-v3.ps1'], [required[5], source.suite.provenance.workerRepository, 'test/native-process.ps1']]) {
    assert.equal(digest(await tableAsset(envelope.output, relative)), identity.files.find(file => file.path === name)?.sha256, `Unbound code snapshot: ${relative}`);
  }
  if (fresh) await assertTableFreshOutput(envelope.output);
  return {envelope, source, envelopeSha256};
}
export function expectedTableRequest(binding, runner) {
  const {envelope} = binding, output = envelope.output, nativeRoot = path.join(output, 'table-colors');
  assert.equal(runner.schemaVersion, 3); assert.equal(runner.profile, 'table-colors-v3');
  assert.equal(runner.envelopeSha256, binding.envelopeSha256); assert.equal(runner.sourceSuiteSha256, envelope.suiteSha256);
  assert.deepEqual(runner.generationIdentity, envelope.generationIdentity); assert.deepEqual(runner.executionIdentity, envelope.controller);
  assert.equal(runner.runOfficeRequested, true); assert.equal(runner.nativeAcceptance, false); assert.equal(runner.registryAcceptance, false);
  assert.ok(['native-worker-pending', 'native-observation-completed; comparison-and-coordinator-review-required'].includes(runner.status));
  return makeOwnedRequest({profile: 'table-colors-v3', policy: TABLE_POSTFLIGHT_POLICY, envelopeSha256: binding.envelopeSha256,
    output, node: envelope.node, controller: envelope.controller, generation: envelope.generationIdentity,
    snapshots: envelope.snapshots, timeoutSeconds: runner.timeoutSeconds, runOfficeRequested: true, selectedCase: 'table-colors',
    nativeRoot, workerPath: path.join(output, 'inputs/native-table-colors-v3.ps1'),
    workerArguments: ['-Envelope', path.join(output, 'table-profile.json'), '-EnvelopeSha256', binding.envelopeSha256,
      '-OutputDirectory', nativeRoot, '-NodeExecutable', envelope.node.path, '-TimeoutSeconds', String(runner.timeoutSeconds),
      '-ExpectedRequestSha256', REQUEST_HASH_TOKEN, '-Worker']});
}
export function bindTableRequest(binding, expectedSha256) {
  const runner = readOwnedJson(path.join(binding.envelope.output, 'runner.json'));
  const request = bindOwnedRequest(path.join(binding.envelope.output, 'execution-request.json'), expectedTableRequest(binding, runner), expectedSha256);
  assert.deepEqual(runner.request, request.identity);
  return request;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [mode, ...args] = process.argv.slice(2), parsed = {};
  for (let index = 0; index < args.length; index += 2) { assert.ok(args[index].startsWith('--') && args[index + 1] && !Object.hasOwn(parsed, args[index])); parsed[args[index]] = args[index + 1]; }
  if (mode === 'prepare') {
    assert.deepEqual(Object.keys(parsed).sort(), ['--consumer', '--legacy-worker', '--output', '--producer', '--suite']);
    console.log(JSON.stringify(await prepareTableProfile({consumer: parsed['--consumer'], legacyWorkerRepository: parsed['--legacy-worker'], output: parsed['--output'], producerRepository: parsed['--producer'], suiteDirectory: parsed['--suite']})));
  } else if (mode === 'create-request' || mode === 'verify-execution' || mode === 'verify-postflight') {
    assert.deepEqual(Object.keys(parsed).sort(), ['--envelope', '--sha256']);
    const binding = await bindTableProfile({envelopeFile: path.resolve(parsed['--envelope']), envelopeSha256: parsed['--sha256']});
    const output = binding.envelope.output;
    if (mode === 'create-request') {
      const runner = readOwnedJson(path.join(output, 'runner.json'));
      console.log(JSON.stringify(writeOwnedRequest(path.join(output, 'execution-request.json'), expectedTableRequest(binding, runner))));
    } else {
      const request = bindTableRequest(binding);
      if (mode === 'verify-postflight') {
        const admission = verifyTablePostflightBinding(binding, request);
        await bindTableProfile({envelopeFile: path.resolve(parsed['--envelope']), envelopeSha256: parsed['--sha256']});
        console.log(JSON.stringify(writeOwnedAdmission(path.join(output, 'postflight-admission.json'), admission)));
      } else console.log(JSON.stringify({requestSha256: request.identity.sha256, profile: binding.envelope.profile}));
    }
  } else {
    assert.ok(['validate', 'validate-fresh'].includes(mode));
    assert.deepEqual(Object.keys(parsed).sort(), ['--envelope', '--sha256']);
    const {envelope} = await bindTableProfile({envelopeFile: path.resolve(parsed['--envelope']), envelopeSha256: parsed['--sha256'], fresh: mode === 'validate-fresh'});
    console.log(JSON.stringify({profile: envelope.profile, controllerRevision: envelope.controller.revision, sourceSuiteSha256: envelope.suiteSha256, nativeAcceptance: false}));
  }
}
