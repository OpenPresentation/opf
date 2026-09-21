import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {access, readFile, readdir, realpath, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const parse = bytes => JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
const inside = (root, file) => {
  const relative = path.relative(root, file);
  return relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
};
const [directory, generationDirectory] = process.argv.slice(2);
assert.ok(directory, 'Usage: node test/compare-native-picture-edit.mjs RUN_DIRECTORY GENERATION_DIRECTORY');
const root = await realpath(directory), checks = [], failures = [], limitations = [];
const check = async (name, run) => {
  try { await run(); checks.push({name, passed: true}); return true; }
  catch (error) { checks.push({name, passed: false}); failures.push({name, message: error.message}); return false; }
};
const owned = async file => {
  assert.equal(typeof file, 'string');
  const canonical = await realpath(file);
  assert.ok(inside(root, canonical), 'Evidence must remain inside its owned run directory.');
  return canonical;
};
const near = (actual, expected) => {
  assert.ok(Number.isFinite(actual) && Number.isFinite(expected));
  assert.ok(Math.abs(actual - expected) <= 0.02, `${actual} vs ${expected} pt`);
};
const filesIn = async folder => {
  const files = [];
  for (const entry of await readdir(folder, {withFileTypes: true})) {
    assert.ok(!entry.isSymbolicLink(), 'Package file trees must not contain links.');
    const file = path.join(folder, entry.name);
    if (entry.isDirectory()) files.push(...await filesIn(file));
    else if (entry.isFile()) files.push(file);
  }
  return files;
};
let report, generation, imported, diagnostics = [], reportBytes, generationBytes;
await check('load exact evidence and generation', async () => {
  reportBytes = await readFile(path.join(root, 'report.json'));
  assert.ok(generationDirectory, 'The matching registry generation directory is required.');
  generationBytes = await readFile(path.join(generationDirectory, 'generation.json'));
  report = parse(reportBytes); generation = parse(generationBytes);
});
if (report && generation) {
  await check('native worker completed and owned presentations closed', async () => {
    const worker = parse(await readFile(path.join(root, 'worker.json')));
    assert.equal(worker.timedOut, false); assert.equal(worker.exitCode, 0);
    assert.equal(report.cleanupConfirmed, true); assert.equal(report.officeOperationsStopped, false);
    assert.equal(report.lastStage, 'worker.complete'); assert.equal(report.error, null);
  });
  const bindingsVerified = await check('generation runtime binding unchanged', async () => {
    assert.equal(process.versions.node.split('.')[0], '24');
    assert.equal(process.version, generation.node);
    assert.equal(await realpath(process.execPath), await realpath(generation.executable));
    const consumer = await realpath(generation.consumer);
    assert.equal(sha(await readFile(path.join(consumer, 'package-lock.json'))), generation.lockSha256);
    assert.deepEqual(Object.keys(generation.bindings).sort(), ['opf', 'opf-editor', 'opf-pptx', 'opf-render'].map(x => '@openpresentation/' + x).sort());
    for (const [name, binding] of Object.entries(generation.bindings)) {
      const packageFile = await realpath(binding.packageFile), packageRoot = path.dirname(packageFile);
      assert.ok(inside(path.join(consumer, 'node_modules'), packageRoot));
      const manifest = parse(await readFile(packageFile));
      assert.equal(manifest.name, name); assert.equal(manifest.version, binding.version);
      const currentFiles = [packageFile];
      for (const folder of ['dist', ...(name === '@openpresentation/opf-pptx' ? ['vendor'] : [])]) currentFiles.push(...await filesIn(path.join(packageRoot, folder)));
      assert.deepEqual(currentFiles.map(file => path.relative(packageRoot, file).split(path.sep).join('/')).sort(), Object.keys(binding.files).sort());
      for (const [relative, hash] of Object.entries(binding.files)) {
        const file = await realpath(path.resolve(packageRoot, relative));
        assert.ok(!path.isAbsolute(relative) && inside(packageRoot, file));
        assert.equal(sha(await readFile(file)), hash, `${name}/${relative} changed`);
      }
      const entry = await realpath(fileURLToPath(binding.publicEntry));
      assert.ok(inside(packageRoot, entry));
      assert.ok(Object.hasOwn(binding.files, path.relative(packageRoot, entry).split(path.sep).join('/')));
    }
  });
  await check('original registry PPTX opened from unchanged owned snapshot', async () => {
    assert.equal(report.source.sha256, generation.pptxSha256);
    assert.equal(report.source.openedSha256, generation.pptxSha256);
    assert.equal(sha(await readFile(await owned(report.source.openedPath))), generation.pptxSha256);
    assert.equal(report.source.unchanged, true); assert.equal(report.source.snapshotUnchanged, true);
    assert.equal(sha(await readFile(report.source.path)), generation.pptxSha256);
  });
  for (const [name, input] of Object.entries(report.inputs ?? {})) if (input) await check(`${name} input snapshot unchanged`, async () => {
    assert.equal(input.sha256, input.snapshotSha256);
    assert.equal(sha(await readFile(await owned(input.snapshotPath))), input.sha256);
  });
  for (const [name, item] of [['saved presentation', report.saved], ['reopened presentation', report.reopened],
    ...['original', 'edited', 'reopened'].map(phase => [phase + ' raster', report[phase]?.raster])]) {
    await check(`${name} bytes match recorded hash`, async () => assert.equal(sha(await readFile(await owned(item.path))), item.sha256));
  }
  await check('edited native raster is stable after save/reopen', async () => {
    assert.equal(report.edited.raster.sha256, report.reopened.raster.sha256);
    assert.notEqual(report.original.raster.sha256, report.edited.raster.sha256, 'The selected edit should visibly change the picture.');
    assert.equal(report.saved.sha256, report.reopened.sha256);
  });
  const mode = report.editMode;
  await check('known actual native edit mode', async () => assert.ok(['alter', 'replace', 'delete'].includes(mode)));
  await check('successful native edit calls recorded before completion', async () => {
    const stages = (await readFile(path.join(root, 'stages.jsonl'), 'utf8')).replace(/^\uFEFF/, '').trim().split(/\r?\n/).map(line => JSON.parse(line.replace(/^\uFEFF/, '')));
    assert.ok(stages.every(stage => stage.status !== 'error'));
    const expected = mode === 'replace' ? ['edit.replace.original.delete', 'edit.replace.picture.add'] : mode === 'delete' ? ['edit.delete.original.delete'] : ['edit.alter.alternativeText.set', 'edit.alter.cropLeft.set', 'edit.alter.cropTop.set'];
    let previous = -1;
    for (const name of expected) {
      const index = stages.findIndex(stage => stage.stage === name && stage.status === 'success');
      assert.ok(index > previous, `Missing or unordered successful native edit: ${name}`);
      previous = index;
    }
    assert.ok(stages.findIndex(stage => stage.stage === 'worker.complete' && stage.status === 'success') > previous);
  });
  if (mode === 'replace') await check('replacement PNG source and snapshot preserved', async () => {
    const replacement = report.inputs.replacementImage;
    assert.equal(replacement.unchanged, true); assert.equal(replacement.snapshotUnchanged, true);
    assert.equal(sha(await readFile(replacement.path)), replacement.sha256);
  });
  await check('native source still matches one expected registry picture', async () => {
    const observation = report.original.observation;
    assert.equal(observation.slideCount, 1); assert.equal(observation.shapeCount, 1); assert.equal(observation.pictureCount, 1);
    const picture = observation.pictures[0];
    assert.equal(picture.type, 13); assert.equal(picture.alternativeText, generation.expectedAlt);
    for (const key of ['left', 'top', 'width', 'height']) near(picture[key], generation.geometryPt[key]);
  });
  for (const phase of ['edited', 'reopened']) await check(`${phase} native content and edit`, async () => {
    const observation = report[phase].observation;
    assert.equal(observation.slideCount, 1); assert.equal(observation.linkedPictureCount, 0);
    assert.equal(observation.pictureCount, mode === 'delete' ? 0 : 1);
    assert.equal(observation.shapeCount, mode === 'delete' ? 0 : 1);
    if (mode === 'delete') return;
    const picture = observation.pictures[0]; assert.equal(picture.type, 13);
    if (mode === 'alter') {
      assert.equal(picture.alternativeText, '');
      for (const [key, value] of Object.entries({left:216, top:132, width:504, height:252, cropLeft:18, cropTop:12, cropRight:0, cropBottom:0})) near(picture[key], value);
    } else {
      assert.equal(picture.alternativeText, 'Replacement picture added by native-picture-edit');
      assert.equal(picture.name, 'native-picture-replacement');
      for (const [key, value] of Object.entries({left:204, top:126, width:516, height:288})) near(picture[key], value);
    }
  });
  await check('native picture geometry and crop survive save/reopen', async () => {
    const edited = report.edited.observation, reopened = report.reopened.observation;
    near(edited.slideWidth, reopened.slideWidth); near(edited.slideHeight, reopened.slideHeight);
    assert.equal(edited.pictures.length, reopened.pictures.length);
    for (let index = 0; index < edited.pictures.length; index++) {
      for (const key of ['left', 'top', 'width', 'height', 'rotation', 'cropLeft', 'cropTop', 'cropRight', 'cropBottom']) near(edited.pictures[index][key], reopened.pictures[index][key]);
      assert.equal(edited.pictures[index].alternativeText, reopened.pictures[index].alternativeText);
    }
  });
  if (bindingsVerified) {
    await check('saved current picture content reimports without resurrection', async () => {
      const {fromPptx} = await import(generation.bindings['@openpresentation/opf-pptx'].publicEntry);
      imported = await fromPptx(await readFile(await owned(report.saved.path)), {onDiagnostic: item => diagnostics.push(item)});
      const pictures = imported.slides.flatMap(slide => (slide.blocks ?? []).filter(block => block.image).map(block => block.image));
      assert.equal(pictures.length, mode === 'delete' ? 0 : 1);
      assert.ok(!JSON.stringify(imported).includes(generation.expectedAlt), 'Old alt text must not return.');
      if (mode !== 'delete') {
        const image = typeof pictures[0] === 'string' ? {src: pictures[0]} : pictures[0];
        const expectedBytes = mode === 'alter' ? generation.inputImage.sha256 : report.inputs.replacementImage.sha256;
        assert.equal(sha(Buffer.from(image.src.split(',')[1], 'base64')), expectedBytes);
        assert.equal(image.alt ?? '', report.reopened.observation.pictures[0].alternativeText);
      }
      if (mode === 'alter') {
        assert.deepEqual(diagnostics.map(item => item.code), ['unsupported-image-crop']);
        limitations.push('PowerPoint preserves the edited crop; OPF reimport retains the full source image and reports unsupported-image-crop. Crop and absolute geometry/reflow fidelity are not accepted.');
      } else assert.equal(diagnostics.length, 0);
    });
  }
  if (imported) await check('retain imported current content', async () => writeFile(path.join(root, 'saved-import.opf.json'), JSON.stringify(imported, null, 2) + '\n', {flag: 'wx'}));
}
const result = {
  passed: failures.length === 0,
  scope: 'Bounded actual PowerPoint edit/save/reopen and current-content reimport. Replacement means deleting and adding a new native picture; it does not certify Change Picture or original shape/provenance identity. Runtime binding covers recorded four OPF package files and consumer lock, not all transitive dependency bytes.',
  node: process.version, executable: process.execPath,
  verifierSha256: sha(await readFile(fileURLToPath(import.meta.url))),
  reportSha256: reportBytes ? sha(reportBytes) : null, generationSha256: generationBytes ? sha(generationBytes) : null,
  editMode: report?.editMode, checks, failures, diagnostics, limitations,
};
let output = path.join(root, 'edit-comparison.json');
try {
  await access(output);
  output = path.join(root, 'edit-comparison-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json');
  result.outputNote = 'Preserved the existing comparison and wrote this result to a unique path.';
} catch { /* no earlier report */ }
await writeFile(output, JSON.stringify(result, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({passed: result.passed, editMode: result.editMode, checks: checks.length, failures, limitations, output}));
process.exitCode = result.passed ? 0 : 1;
