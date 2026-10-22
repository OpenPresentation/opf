import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {copyFile, mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const parse = bytes => JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
const root = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(root, '..');
const comparator = path.join(root, 'compare-native-picture-edit.mjs');
const widePng = path.join(root, 'fixtures/images/wide.png');
const verifierSnapshot = path.join(root, 'native-picture-edit.ps1');
const helperSnapshot = path.join(root, 'native-process.ps1');

assert.equal(process.versions.node.split('.')[0], '24', 'Native picture edit controls require Node 24.');

const originalPicture = {
  index: 1,
  name: 'OPF image 1',
  alternativeText: 'Four quadrants and a circle',
  type: 13,
  left: 43.2,
  top: 51.6,
  width: 873.6,
  height: 436.8,
  rotation: 0,
  lockAspectRatio: -1,
  cropLeft: 0,
  cropTop: 0,
  cropRight: 0,
  cropBottom: 0,
};
const editedPicture = {
  ...originalPicture,
  alternativeText: '',
  left: 216,
  top: 132,
  width: 504,
  height: 252,
  lockAspectRatio: 0,
  cropLeft: 18,
  cropTop: 12,
};
const observation = pictures => ({
  slideCount: 1,
  slideWidth: 960,
  slideHeight: 540,
  shapeCount: pictures.length ? 1 : 0,
  pictureCount: pictures.length,
  linkedPictureCount: 0,
  embeddedPictureCount: pictures.length,
  pictures,
});
const alterStages = [
  'edit.alter.alternativeText.set',
  'edit.alter.cropLeft.set',
  'edit.alter.cropTop.set',
  'worker.complete',
].flatMap(stage => [
  {stage, status: 'success', error: ''},
]);

const workspace = await mkdtemp(path.join(os.tmpdir(), 'opf-picture-edit-controls-'));
const outcomes = [];
const runs = [];

async function runComparator(name, fixtureDir, {generationDir = path.join(fixtureDir, 'generation')} = {}) {
  const args = [comparator, fixtureDir];
  if (generationDir !== null) args.push(generationDir);
  const child = spawnSync(process.execPath, args, {cwd: packageRoot, encoding: 'utf8', maxBuffer: 1024 * 1024});
  let summary = null;
  try {
    summary = JSON.parse((child.stdout ?? '').trim().split(/\r?\n/).at(-1) ?? '');
  } catch { /* preserve raw stdout in the run record */ }
  const record = {
    name,
    exitCode: child.status,
    signal: child.signal,
    spawnError: child.error?.message ?? null,
    stdout: child.stdout ?? '',
    stderr: child.stderr ?? '',
    summary,
  };
  runs.push(record);
  return record;
}

async function writeAlterFixture(dir, {worker = true, stages = true} = {}) {
  const inputsDir = path.join(dir, 'inputs');
  await mkdir(inputsDir, {recursive: true});
  const sourcePptx = path.join(dir, 'source.pptx');
  const savedPptx = path.join(dir, 'native-picture-edit.pptx');
  const inputSnapshot = path.join(inputsDir, 'input.pptx');
  const originalRaster = path.join(dir, 'original.png');
  const editedRaster = path.join(dir, 'edited.png');
  const reopenedRaster = path.join(dir, 'reopened.png');
  for (const [source, target] of [
    [widePng, originalRaster],
    [widePng, sourcePptx],
    [widePng, inputSnapshot],
    [widePng, savedPptx],
    [verifierSnapshot, path.join(inputsDir, 'native-picture-edit.ps1')],
    [helperSnapshot, path.join(inputsDir, 'native-process.ps1')],
  ]) await copyFile(source, target);
  const editedBytes = Buffer.concat([await readFile(widePng), Buffer.from('\nedited')]);
  await writeFile(editedRaster, editedBytes);
  await writeFile(reopenedRaster, editedBytes);

  const sourceSha = sha(await readFile(sourcePptx));
  const savedSha = sha(await readFile(savedPptx));
  const originalRasterSha = sha(await readFile(originalRaster));
  const editedRasterSha = sha(await readFile(editedRaster));
  const verifierSha = sha(await readFile(verifierSnapshot));
  const helperSha = sha(await readFile(helperSnapshot));

  const report = {
    schemaVersion: 1,
    editMode: 'alter',
    source: {
      path: sourcePptx,
      sha256: sourceSha,
      openedPath: inputSnapshot,
      openedSha256: sourceSha,
      unchanged: true,
      snapshotUnchanged: true,
    },
    saved: {path: savedPptx, sha256: savedSha},
    original: {
      observation: observation([originalPicture]),
      raster: {path: originalRaster, sha256: originalRasterSha},
    },
    edited: {
      expectation: {
        left: 216,
        top: 132,
        width: 504,
        height: 252,
        cropLeft: 18,
        cropTop: 12,
        cropRight: 0,
        cropBottom: 0,
        alternativeText: '',
      },
      observation: observation([editedPicture]),
      raster: {path: editedRaster, sha256: editedRasterSha},
    },
    reopened: {
      path: savedPptx,
      sha256: savedSha,
      observation: observation([editedPicture]),
      raster: {path: reopenedRaster, sha256: editedRasterSha},
    },
    inputs: {
      verifier: {
        path: verifierSnapshot,
        sha256: verifierSha,
        snapshotPath: path.join(inputsDir, 'native-picture-edit.ps1'),
        snapshotSha256: verifierSha,
      },
      processHelper: {
        path: helperSnapshot,
        sha256: helperSha,
        snapshotPath: path.join(inputsDir, 'native-process.ps1'),
        snapshotSha256: helperSha,
      },
      presentation: {
        path: sourcePptx,
        sha256: sourceSha,
        snapshotPath: inputSnapshot,
        snapshotSha256: sourceSha,
      },
      replacementImage: null,
    },
    cleanupConfirmed: true,
    officeOperationsStopped: false,
    lastStage: 'worker.complete',
    lastStatus: 'success',
    error: null,
  };
  await writeFile(path.join(dir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  if (worker) {
    await writeFile(path.join(dir, 'worker.json'), JSON.stringify({
      exitCode: 0,
      timedOut: false,
      timeoutSeconds: 45,
    }, null, 2) + '\n');
  }
  if (stages) {
    const lines = alterStages.map((stage, index) => JSON.stringify({
      sequence: index + 1,
      ...stage,
      cleanupConfirmed: true,
      officeOperationsStopped: false,
    }));
    await writeFile(path.join(dir, 'stages.jsonl'), lines.join('\n') + '\n');
  }
  const generationDir = path.join(dir, 'generation');
  await mkdir(generationDir, {recursive: true});
  await writeFile(path.join(generationDir, 'generation.json'), JSON.stringify({
    node: process.version,
    executable: process.execPath,
    consumer: packageRoot,
    lockSha256: sha(await readFile(path.join(packageRoot, 'package-lock.json'))),
    pptxSha256: sourceSha,
    expectedAlt: originalPicture.alternativeText,
    geometryPt: {
      left: originalPicture.left,
      top: originalPicture.top,
      width: originalPicture.width,
      height: originalPicture.height,
    },
    inputImage: {sha256: sha(await readFile(widePng))},
    bindings: {},
  }, null, 2) + '\n');
  return {dir, report};
}

async function expectFailure(name, mutate, predicate, options = {}) {
  const fixture = await writeAlterFixture(path.join(workspace, name));
  await mutate?.(fixture);
  const record = await runComparator(name, fixture.dir, options);
  assert.notEqual(record.exitCode, 0, `${name} unexpectedly passed.`);
  assert.ok(record.summary, `${name} did not emit comparator summary JSON.`);
  assert.equal(record.summary.passed, false, `${name} comparator unexpectedly passed.`);
  assert.ok(predicate(record.summary.failures ?? []), `${name} failed for an unexpected reason: ${JSON.stringify(record.summary.failures)}`);
  outcomes.push({name, passed: true});
}

await expectFailure('missing-generation-directory', null, failures =>
  failures.some(item => item.name === 'load exact evidence and generation'), {generationDir: null});

await expectFailure('missing-worker-result', async ({dir}) => {
  const {unlink} = await import('node:fs/promises');
  await unlink(path.join(dir, 'worker.json'));
}, failures => failures.some(item => item.name === 'native worker completed and owned presentations closed'));

await expectFailure('failed-worker-exit', async ({dir}) => {
  await writeFile(path.join(dir, 'worker.json'), JSON.stringify({exitCode: 17, timedOut: false}, null, 2) + '\n');
}, failures => failures.some(item => item.name === 'native worker completed and owned presentations closed'));

await expectFailure('cleanup-not-confirmed', async ({report, dir}) => {
  report.cleanupConfirmed = false;
  await writeFile(path.join(dir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
}, failures => failures.some(item => item.name === 'native worker completed and owned presentations closed'));

await expectFailure('missing-edited-raster', async ({dir}) => {
  const {unlink} = await import('node:fs/promises');
  await unlink(path.join(dir, 'edited.png'));
}, failures => failures.some(item => item.name === 'edited raster bytes match recorded hash'));

await expectFailure('geometry-beyond-tolerance', async ({report, dir}) => {
  report.edited.observation.pictures[0].width = 504.021;
  report.reopened.observation.pictures[0].width = 504.021;
  await writeFile(path.join(dir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
}, failures => failures.some(item => /504\.021 vs 504 pt/.test(item.message ?? '')));

await expectFailure('unchanged-edited-raster', async ({report, dir}) => {
  report.edited.raster.sha256 = report.original.raster.sha256;
  report.reopened.raster.sha256 = report.original.raster.sha256;
  await writeFile(path.join(dir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
}, failures => failures.some(item => item.name === 'edited native raster is stable after save/reopen'));

await expectFailure('missing-edit-stage', async ({dir}) => {
  await writeFile(path.join(dir, 'stages.jsonl'), JSON.stringify({
    stage: 'worker.complete',
    status: 'success',
    error: '',
  }) + '\n');
}, failures => failures.some(item => item.name === 'successful native edit calls recorded before completion'));

const comparatorSource = await readFile(comparator, 'utf8');
assert.match(comparatorSource, /<= 0\.02/, 'compare-native-picture-edit must keep the unchanged 0.02pt geometry gate.');
outcomes.push({name: 'geometry-gate-source-present', passed: true});

const suite = {
  passed: outcomes.every(item => item.passed),
  scope: 'Offline negative controls for compare-native-picture-edit.mjs. No Office object was constructed.',
  node: process.version,
  comparator,
  comparatorSha256: sha(comparatorSource),
  harness: fileURLToPath(import.meta.url),
  checks: outcomes,
  runs,
};
const reportPath = path.join(packageRoot, 'artifacts/native-picture-edit-comparator-controls.json');
await mkdir(path.dirname(reportPath), {recursive: true});
await writeFile(reportPath, JSON.stringify(suite, null, 2) + '\n');
await rm(workspace, {recursive: true, force: true});
console.log(JSON.stringify({passed: suite.passed, checks: outcomes.length, reportPath}));
process.exitCode = suite.passed ? 0 : 1;
