import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {copyFile, mkdir, readFile, readdir, realpath, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const parseJson = bytes => JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const node = path.join(root, 'toolchain', 'node_modules', 'node', 'bin', 'node.exe');
const comparator = path.join(root, 'sources', 'opf-pptx', 'test', 'compare-native-picture.mjs');
const registryRun = path.join(root, 'registry-native-01');
const pictureRun = path.join(root, 'registry-picture-01');
const packageRoot = path.join(root, 'sources', 'opf-pptx');
const baseReportPath = path.join(registryRun, 'report.json');
const baseWorkerPath = path.join(registryRun, 'worker.json');
const baseGenerationPath = path.join(pictureRun, 'generation.json');
const originalInputs = {
  source: path.join(pictureRun, 'image-only.pptx'),
  saved: path.join(registryRun, 'input-picture-control.pptx'),
  originalRaster: path.join(registryRun, 'original.png'),
  reopenedRaster: path.join(registryRun, 'reopened.png'),
  inputSnapshot: path.join(registryRun, 'inputs', 'input.pptx'),
  verifierSnapshot: path.join(registryRun, 'inputs', 'native-picture-control.ps1'),
  helperSnapshot: path.join(registryRun, 'inputs', 'native-process.ps1'),
};

assert.equal(await realpath(process.execPath), await realpath(node), 'Run this suite with the pinned Node executable.');
assert.deepEqual((await readdir(here)).sort(), ['run-controls.mjs'], 'Use a fresh comparator-controls-01 directory.');

const [baseReport, baseWorker, baseGeneration, comparatorBytes, scriptBytes] = await Promise.all([
  readFile(baseReportPath).then(parseJson),
  readFile(baseWorkerPath).then(parseJson),
  readFile(baseGenerationPath).then(parseJson),
  readFile(comparator),
  readFile(fileURLToPath(import.meta.url)),
]);
assert.equal(baseReport.mode, 'supplied-presentation');
assert.equal(baseReport.lastStage, 'worker.complete');
assert.equal(baseWorker.exitCode, 0);
assert.equal(baseWorker.timedOut, false);

const sourceHashes = {};
for (const [name, source] of Object.entries({
  report: baseReportPath,
  worker: baseWorkerPath,
  generation: baseGenerationPath,
  comparator,
  sourcePresentation: originalInputs.source,
  savedPresentation: originalInputs.saved,
  originalRaster: originalInputs.originalRaster,
  reopenedRaster: originalInputs.reopenedRaster,
  inputSnapshot: originalInputs.inputSnapshot,
  verifierSnapshot: originalInputs.verifierSnapshot,
  processHelperSnapshot: originalInputs.helperSnapshot,
})) sourceHashes[name] = sha(await readFile(source));

const fixtureHashes = new Map();
const caseResults = [];
const controlOutcomes = [];

async function hashFixtureDirectory(directory) {
  const hashes = {};
  async function visit(current, prefix = '') {
    for (const entry of await readdir(current, {withFileTypes: true})) {
      const relative = path.posix.join(prefix, entry.name);
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(absolute, relative);
      else if (entry.isFile()) hashes[relative] = sha(await readFile(absolute));
    }
  }
  await visit(directory);
  return hashes;
}

async function createFixture(name, {generation = true, worker = true} = {}) {
  const dir = path.join(here, name);
  const inputsDir = path.join(dir, 'inputs');
  await mkdir(inputsDir, {recursive: true});
  for (const [source, target] of [
    [originalInputs.source, path.join(dir, 'source.pptx')],
    [originalInputs.saved, path.join(dir, 'saved.pptx')],
    [originalInputs.originalRaster, path.join(dir, 'original.png')],
    [originalInputs.reopenedRaster, path.join(dir, 'reopened.png')],
    [originalInputs.inputSnapshot, path.join(inputsDir, 'input.pptx')],
    [originalInputs.verifierSnapshot, path.join(inputsDir, 'native-picture-control.ps1')],
    [originalInputs.helperSnapshot, path.join(inputsDir, 'native-process.ps1')],
  ]) await copyFile(source, target);

  const report = structuredClone(baseReport);
  report.source.path = path.join(dir, 'source.pptx');
  report.source.openedPath = path.join(inputsDir, 'input.pptx');
  report.saved.path = path.join(dir, 'saved.pptx');
  report.reopened.path = path.join(dir, 'saved.pptx');
  report.original.raster.path = path.join(dir, 'original.png');
  report.reopened.raster.path = path.join(dir, 'reopened.png');
  report.inputs.verifier.path = path.join(inputsDir, 'native-picture-control.ps1');
  report.inputs.verifier.snapshotPath = report.inputs.verifier.path;
  report.inputs.processHelper.path = path.join(inputsDir, 'native-process.ps1');
  report.inputs.processHelper.snapshotPath = report.inputs.processHelper.path;
  report.inputs.presentation.path = report.source.path;
  report.inputs.presentation.snapshotPath = report.source.openedPath;
  await writeFile(path.join(dir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  if (worker) await writeFile(path.join(dir, 'worker.json'), JSON.stringify(structuredClone(baseWorker), null, 2) + '\n');
  if (generation) {
    const generationDir = path.join(dir, 'generation');
    await mkdir(generationDir);
    await writeFile(path.join(generationDir, 'generation.json'), JSON.stringify(baseGeneration, null, 2) + '\n');
  }
  await writeFile(path.join(dir, 'fixture.json'), JSON.stringify({
    syntheticControl: true,
    sourceRun: 'registry-native-01',
    sourceGeneration: 'registry-picture-01/generation.json',
    officeExecution: false,
    inputFilesRemappedIntoControlDirectory: true,
    control: name,
  }, null, 2) + '\n');
  const fixtureHash = {};
  for (const file of [
    'report.json', ...(worker ? ['worker.json'] : []), 'source.pptx', 'saved.pptx', 'original.png', 'reopened.png',
    'inputs/input.pptx', 'inputs/native-picture-control.ps1', 'inputs/native-process.ps1',
    ...(generation ? ['generation/generation.json'] : []), 'fixture.json',
  ]) fixtureHash[file] = sha(await readFile(path.join(dir, file)));
  fixtureHashes.set(name, fixtureHash);
  return {dir, report};
}

async function runComparator(name, fixture, {passArg = true, label = 'run'} = {}) {
  const args = [path.join(here, 'comparator-snapshot.mjs'), fixture.dir];
  if (passArg) args.push(path.join(fixture.dir, 'generation'));
  const child = spawnSync(node, args, {cwd: packageRoot, encoding: 'utf8', windowsHide: true, maxBuffer: 1024 * 1024});
  const stem = `${label}`;
  await writeFile(path.join(fixture.dir, `${stem}.stdout.log`), child.stdout ?? '');
  await writeFile(path.join(fixture.dir, `${stem}.stderr.log`), child.stderr ?? '');
  let stdoutSummary = null;
  try {
    const lastLine = (child.stdout ?? '').trim().split(/\r?\n/).at(-1);
    stdoutSummary = JSON.parse(lastLine);
  } catch { /* preserve the raw streams and missing report evidence below */ }
  const outputPath = stdoutSummary?.outputPath;
  let reportBytes = null;
  let comparison = null;
  if (outputPath) {
    try {
      reportBytes = await readFile(outputPath);
      comparison = JSON.parse(reportBytes.toString('utf8'));
    } catch { /* the result records missing or unreadable durable evidence */ }
  }
  const record = {
    name,
    label,
    exitCode: child.status,
    signal: child.signal,
    spawnError: child.error?.message ?? null,
    stdout: child.stdout ?? '',
    stderr: child.stderr ?? '',
    stdoutSha256: sha(Buffer.from(child.stdout ?? '')),
    stderrSha256: sha(Buffer.from(child.stderr ?? '')),
    stdoutLog: path.join(fixture.dir, `${stem}.stdout.log`),
    stderrLog: path.join(fixture.dir, `${stem}.stderr.log`),
    comparisonPath: outputPath ?? null,
    comparisonSha256: reportBytes ? sha(reportBytes) : null,
    comparison: comparison ?? null,
    stdoutSummary,
  };
  caseResults.push(record);
  return {record, comparison};
}

await copyFile(comparator, path.join(here, 'comparator-snapshot.mjs'));

async function negative(name, mutate, {generation = true, worker = true, passArg = true, expectedFailure} = {}) {
  const fixture = await createFixture(name, {generation, worker});
  await mutate?.(fixture);
  const fixtureSha256 = await hashFixtureDirectory(fixture.dir);
  const {record, comparison} = await runComparator(name, fixture, {passArg});
  assert.notEqual(record.exitCode, 0, `${name} unexpectedly passed.`);
  assert.ok(comparison, `${name} did not write durable comparison evidence.`);
  assert.equal(comparison.passed, false, `${name} comparison unexpectedly passed.`);
  assert.ok(comparison.failures.some(item => expectedFailure(item)), `${name} failed for an unexpected reason.`);
  record.fixtureSha256 = fixtureSha256;
  controlOutcomes.push({name, passed: true, exitCode: record.exitCode, comparisonSha256: record.comparisonSha256});
  return {fixture, record, comparison};
}

await negative('missing-generation-argument', null, {
  passArg: false,
  expectedFailure: item => item.name === 'supplied-presentation mode requires generation argument',
});

await negative('missing-raster-file', async ({dir}) => {
  const {unlink} = await import('node:fs/promises');
  await unlink(path.join(dir, 'reopened.png'));
}, {expectedFailure: item => item.name === 'reopened raster file identity'});

await negative('tampered-source-snapshot', async ({dir}) => {
  const file = path.join(dir, 'inputs', 'input.pptx');
  const bytes = await readFile(file);
  await writeFile(file, Buffer.concat([bytes, Buffer.from('tampered') ]));
}, {expectedFailure: item => item.name === 'presentation source matches owned input snapshot'});

await negative('out-of-run-raster-path', async ({dir, report}) => {
  report.reopened.raster.path = path.join(registryRun, 'reopened.png');
  await writeFile(path.join(dir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
}, {expectedFailure: item => item.name === 'reopened raster file identity' && /outside its allowed directory/.test(item.message)});

await negative('geometry-beyond-tolerance', async ({dir, report}) => {
  report.original.observation.pictures[0].width += 0.021;
  await writeFile(path.join(dir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
}, {expectedFailure: item => item.name === 'original width within unchanged 0.02pt gate'});

await negative('bad-worker-result', async ({dir}) => {
  const badWorker = JSON.parse(await readFile(path.join(dir, 'worker.json'), 'utf8'));
  badWorker.exitCode = 1;
  await writeFile(path.join(dir, 'worker.json'), JSON.stringify(badWorker, null, 2) + '\n');
}, {expectedFailure: item => item.name === 'worker completed within its deadline'});

await negative('missing-worker-result', async ({dir}) => {
  const {unlink} = await import('node:fs/promises');
  await unlink(path.join(dir, 'worker.json'));
}, {expectedFailure: item => item.name === 'worker report readable' || item.name === 'worker completed within its deadline'});

const preserved = await createFixture('existing-comparison-preserved');
const first = await runComparator('existing-comparison-preserved', preserved, {label: 'first'});
assert.equal(first.record.exitCode, 0, 'The valid synthetic control did not pass before preservation check.');
assert.ok(first.comparison?.passed, 'The first synthetic comparison did not pass.');
first.record.fixtureSha256 = await hashFixtureDirectory(preserved.dir);
const primaryPath = path.join(preserved.dir, 'comparison.json');
const originalComparisonBytes = await readFile(primaryPath);
const originalComparisonHash = sha(originalComparisonBytes);
const second = await runComparator('existing-comparison-preserved', preserved, {label: 'repeat'});
assert.notEqual(second.record.exitCode, 0, 'Repeat should report the saved-import wx collision.');
assert.ok(second.comparison, 'Repeat did not write alternate durable comparison evidence.');
assert.equal(second.comparison.passed, false);
assert.ok(second.comparison.failures.some(item => item.name === 'write imported OPF evidence without overwriting'));
assert.notEqual(second.record.comparisonPath, primaryPath, 'Repeat overwrote the primary comparison path.');
assert.equal(sha(await readFile(primaryPath)), originalComparisonHash, 'Existing comparison.json changed.');
assert.equal(second.comparison.outputNote?.includes('comparison.json already existed and was preserved'), true);
second.record.fixtureSha256 = await hashFixtureDirectory(preserved.dir);
controlOutcomes.push({
  name: 'existing-comparison-preserved',
  passed: true,
  firstRunExitCode: first.record.exitCode,
  primaryComparisonPath: primaryPath,
  primaryComparisonSha256: originalComparisonHash,
  primaryComparisonPreserved: true,
  repeatExitCode: second.record.exitCode,
  repeatComparisonSha256: second.record.comparisonSha256,
  repeat: second.record,
  repeatComparisonPassed: second.comparison.passed,
  repeatFailedOnlyForSavedImportCollision: second.comparison.failures.every(item => item.name === 'write imported OPF evidence without overwriting'),
});
assert.equal(second.comparison.failures.every(item => item.name === 'write imported OPF evidence without overwriting'), true);

const checks = controlOutcomes.map(({name, passed, ...details}) => ({name, passed, ...details}));
const suite = {
  schemaVersion: 1,
  scope: 'Offline comparator negative controls over synthetic copies of completed registry-native evidence. No Office or UI execution occurred.',
  createdAt: new Date().toISOString(),
  root,
  nodeExecutable: await realpath(node),
  nodeVersion: process.version,
  comparatorSource: comparator,
  comparatorSourceSha256: sha(comparatorBytes),
  comparatorSnapshot: path.join(here, 'comparator-snapshot.mjs'),
  comparatorSnapshotSha256: sha(await readFile(path.join(here, 'comparator-snapshot.mjs'))),
  harness: fileURLToPath(import.meta.url),
  harnessSha256: sha(scriptBytes),
  sourceEvidenceSha256: sourceHashes,
  syntheticFixtureHashes: Object.fromEntries(fixtureHashes),
  checks,
  passed: checks.every(item => item.passed),
  runs: caseResults,
};
await writeFile(path.join(here, 'suite-report.json'), JSON.stringify(suite, null, 2) + '\n');
console.log(JSON.stringify({passed: suite.passed, checks: checks.length, suiteReport: path.join(here, 'suite-report.json')}));
if (!suite.passed) process.exitCode = 1;
