import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {access, readFile, realpath, readdir, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = bytes => JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
const inside = (root, file) => {
  const relative = path.relative(root, file);
  return relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
};
const expectedBoundPackages = [
  '@openpresentation/opf',
  '@openpresentation/opf-render',
  '@openpresentation/opf-pptx',
  '@openpresentation/opf-editor',
];
const listFiles = async directory => {
  const files = [];
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const absolute = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) files.push(...await listFiles(absolute));
    else if (entry.isFile()) files.push(absolute);
  }
  return files;
};
const nativeCreatedGeometry = {left: 180, top: 120, width: 600, height: 300};
const nativeCreatedAlt = 'Four quadrants and a circle';

const [runArgument, generationArgument] = process.argv.slice(2);
if (!runArgument) {
  console.error('Usage: node test/compare-native-picture.mjs RUN_DIRECTORY [REGISTRY_GENERATION_DIRECTORY]');
  process.exitCode = 2;
} else {
  let root;
  try {
    root = await realpath(path.resolve(runArgument));
    assert.ok((await stat(root)).isDirectory(), 'RUN_DIRECTORY must be an existing directory.');
  } catch (error) {
    console.error(`Cannot use RUN_DIRECTORY: ${error.message}`);
    process.exitCode = 2;
  }

  if (root) {
    const reportPath = path.join(root, 'report.json');
    const workerPath = path.join(root, 'worker.json');
    const checks = [];
    const failures = [];
    let report = null;
    let worker = null;
    let reportBytes = null;
    let mode = 'unknown';
    let scope = 'Comparison did not load a native report.';
    let generation = null;
    let generationRoot = null;
    let imported = null;
    let currentInputHash = null;

    const check = (name, operation) => {
      try {
        operation();
        checks.push({name, passed: true});
        return true;
      } catch (error) {
        checks.push({name, passed: false});
        failures.push({name, message: error?.message ?? String(error)});
        return false;
      }
    };
    const checkAsync = async (name, operation) => {
      try {
        await operation();
        checks.push({name, passed: true});
        return true;
      } catch (error) {
        checks.push({name, passed: false});
        failures.push({name, message: error?.message ?? String(error)});
        return false;
      }
    };
    const canonicalFileUnder = async (baseDirectory, candidate, label) => {
      assert.equal(typeof candidate, 'string', `${label} path is missing.`);
      const base = await realpath(baseDirectory);
      const requested = path.isAbsolute(candidate) ? candidate : path.resolve(base, candidate);
      const canonical = await realpath(requested);
      assert.ok(inside(base, canonical), `${label} resolves outside its allowed directory: ${canonical}`);
      assert.ok((await stat(canonical)).isFile(), `${label} is not a file: ${canonical}`);
      return canonical;
    };
    const checkRecordedFile = async (name, record) => checkAsync(`${name} file identity`, async () => {
      assert.ok(record?.path && record?.sha256, 'Missing path or SHA-256.');
      const canonical = await canonicalFileUnder(root, record.path, name);
      assert.equal(sha(await readFile(canonical)), record.sha256);
      return canonical;
    });
    const addUnexpectedError = (error) => {
      failures.push({name: 'comparator execution', message: error?.stack ?? error?.message ?? String(error)});
    };

    try {
      check('Node 24 supported', () => assert.equal(process.versions.node.split('.')[0], '24'));

      await checkAsync('native report readable', async () => {
        reportBytes = await readFile(reportPath);
        report = json(reportBytes);
      });
      await checkAsync('worker report readable', async () => {
        worker = json(await readFile(workerPath));
      });

      if (report) {
        mode = report.mode ?? 'unknown';
        if (mode === 'native-created') {
          scope = 'Native-created PNG picture lifecycle, owned input snapshot integrity, native geometry and alt text, and exact save/reopen raster equality. No registry generation binding.';
          check('native-created mode has no generation argument', () => assert.equal(generationArgument, undefined));
        } else if (mode === 'supplied-presentation') {
          scope = 'Supplied registry presentation lifecycle, source snapshot identity, native geometry/alt text and current-image reimport. Runtime binding covers only the four recorded OpenPresentation package manifests, complete dist trees, the PPTX vendor tree, and consumer lockfile; it does not prove transitive dependency bytes.';
          check('supplied-presentation mode requires generation argument', () => assert.ok(generationArgument, 'Pass the matching registry generation directory.'));
          if (generationArgument) {
            await checkAsync('registry generation report readable', async () => {
              generationRoot = await realpath(path.resolve(generationArgument));
              const generationFile = await canonicalFileUnder(generationRoot, path.join(generationRoot, 'generation.json'), 'generation report');
              generation = json(await readFile(generationFile));
            });
          }
        } else {
          scope = `Unsupported native report mode: ${mode}.`;
          check('supported native report mode', () => assert.ok(false, scope));
        }

        check('owned presentations closed', () => assert.equal(report.cleanupConfirmed, true));
        check('native control reached completion', () => {
          assert.equal(report.lastStage, 'worker.complete');
          assert.equal(report.error, null);
        });
        check('worker completed within its deadline', () => {
          assert.equal(worker?.timedOut, false);
          assert.equal(worker?.exitCode, 0);
        });

        const inputEntries = Object.entries(report.inputs ?? {}).filter(([, input]) => input?.snapshotPath);
        const canonicalSnapshots = new Map();
        for (const [name, input] of inputEntries) {
          await checkAsync(`${name} source matches owned input snapshot`, async () => {
            assert.ok(input.path && input.sha256 && input.snapshotSha256, 'Input provenance is incomplete.');
            assert.equal(input.sha256, input.snapshotSha256, 'Input SHA differs from its owned snapshot SHA.');
            const snapshotPath = await canonicalFileUnder(root, input.snapshotPath, `${name} input snapshot`);
            const actual = sha(await readFile(snapshotPath));
            assert.equal(actual, input.snapshotSha256, 'Owned input snapshot bytes changed.');
            canonicalSnapshots.set(name, {path: snapshotPath, sha256: actual, record: input});
          });
        }

        const sourceInputName = mode === 'native-created' ? 'image' : mode === 'supplied-presentation' ? 'presentation' : null;
        if (sourceInputName) {
          await checkAsync('opened source matches owned input snapshot', async () => {
            const input = report.inputs?.[sourceInputName];
            const snapshot = canonicalSnapshots.get(sourceInputName);
            assert.ok(input && snapshot, `Missing owned ${sourceInputName} snapshot.`);
            assert.equal(report.source?.sha256, input.sha256, 'Source SHA differs from the declared input SHA.');
            assert.equal(report.source?.openedSha256, snapshot.sha256, 'Opened source SHA differs from the snapshot bytes.');
            const openedPath = await canonicalFileUnder(root, report.source?.openedPath, 'opened source');
            assert.equal(openedPath, snapshot.path, 'PowerPoint did not open the owned input snapshot.');
            currentInputHash = snapshot.sha256;
          });
        }

        for (const [name, record] of [
          ['saved presentation', report.saved],
          ['reopened presentation', report.reopened],
          ['original raster', report.original?.raster],
          ['reopened raster', report.reopened?.raster],
        ]) await checkRecordedFile(name, record);

        check('saved and reopened presentation identities agree', () => assert.equal(report.saved?.sha256, report.reopened?.sha256));
        check('save/reopen raster is identical', () => assert.equal(report.original?.raster?.sha256, report.reopened?.raster?.sha256));

        for (const phase of ['original', 'reopened']) {
          const observation = report[phase]?.observation;
          check(`${phase} contains one embedded native picture`, () => {
            assert.equal(observation?.slideCount, 1);
            assert.equal(observation?.shapeCount, 1);
            assert.equal(observation?.pictureCount, 1);
            assert.equal(observation?.linkedPictureCount, 0);
            assert.equal(observation?.pictures?.[0]?.type, 13);
          });
        }

        const expectedGeometry = mode === 'native-created' ? nativeCreatedGeometry : generation?.geometryPt;
        const expectedAlt = mode === 'native-created' ? nativeCreatedAlt : generation?.expectedAlt;
        if (mode === 'native-created' || generation) {
          for (const phase of ['original', 'reopened']) {
            const picture = report[phase]?.observation?.pictures?.[0];
            for (const key of ['left', 'top', 'width', 'height']) check(`${phase} ${key} within unchanged 0.02pt gate`, () => {
              assert.ok(Number.isFinite(picture?.[key]));
              assert.ok(Number.isFinite(expectedGeometry?.[key]));
              assert.ok(Math.abs(picture[key] - expectedGeometry[key]) <= 0.02, `${picture[key]} vs ${expectedGeometry[key]} pt`);
            });
            check(`${phase} native alt`, () => assert.equal(picture?.alternativeText, expectedAlt));
          }
        } else if (mode === 'supplied-presentation') {
          check('registry generation metadata available', () => assert.ok(false, 'Geometry and reimport checks require the supplied registry generation report.'));
        }

        if (mode === 'supplied-presentation' && generation && generationRoot) {
          const bindingsVerified = await checkAsync('registry package and lock bindings unchanged', async () => {
            const bindingNames = Object.keys(generation.bindings ?? {}).sort();
            assert.deepEqual(bindingNames, [...expectedBoundPackages].sort(), 'Unexpected or missing bound OpenPresentation package.');
            const consumer = await realpath(generation.consumer);
            const nodeModules = await realpath(path.join(consumer, 'node_modules'));
            assert.equal(process.version, generation.node, 'Node version differs from registry generation.');
            assert.equal(await realpath(process.execPath), await realpath(generation.executable), 'Node executable differs from registry generation.');
            const lockPath = await canonicalFileUnder(consumer, path.join(consumer, 'package-lock.json'), 'consumer lockfile');
            assert.equal(sha(await readFile(lockPath)), generation.lockSha256, 'Consumer lockfile changed.');
            const lock = json(await readFile(lockPath));

            for (const name of expectedBoundPackages) {
              const binding = generation.bindings[name];
              assert.ok(binding?.packageFile && binding?.publicEntry && binding?.version && binding?.files, `${name} binding is incomplete.`);
              const packageFile = await canonicalFileUnder(nodeModules, binding.packageFile, `${name} package manifest`);
              const packageRoot = await realpath(path.dirname(packageFile));
              assert.ok(inside(nodeModules, packageRoot), `${name} package resolves outside consumer node_modules.`);
              assert.equal(path.basename(packageFile).toLowerCase(), 'package.json');
              const manifest = json(await readFile(packageFile));
              assert.equal(manifest.name, name);
              assert.equal(manifest.version, binding.version);
              const locked = lock.packages?.[`node_modules/${name}`];
              assert.equal(locked?.version, binding.version, `${name} lock version changed.`);
              assert.equal(locked?.resolved, binding.resolved, `${name} registry URL changed.`);
              assert.equal(locked?.integrity, binding.integrity, `${name} integrity changed.`);

              const recordedFiles = Object.keys(binding.files).sort();
              const packageFiles = [packageFile];
              for (const subdirectory of ['dist', ...(name === '@openpresentation/opf-pptx' ? ['vendor'] : [])]) {
                packageFiles.push(...await listFiles(path.join(packageRoot, subdirectory)));
              }
              const currentFiles = packageFiles.map(file => path.relative(packageRoot, file).split(path.sep).join('/')).sort();
              assert.deepEqual(recordedFiles, currentFiles, `${name} package file set changed.`);

              for (const [relative, expected] of Object.entries(binding.files)) {
                assert.ok(!path.isAbsolute(relative), `${name} binding contains an absolute package-relative path.`);
                const file = await canonicalFileUnder(packageRoot, path.resolve(packageRoot, relative), `${name}/${relative}`);
                assert.equal(sha(await readFile(file)), expected, `Generation runtime changed: ${name}/${relative}`);
              }

              const entryUrl = new URL(binding.publicEntry);
              assert.equal(entryUrl.protocol, 'file:', `${name} public entry must be a file URL.`);
              const publicEntry = await canonicalFileUnder(packageRoot, fileURLToPath(entryUrl), `${name} public ESM entry`);
              const entryRelative = path.relative(packageRoot, publicEntry).split(path.sep).join('/');
              assert.ok(Object.hasOwn(binding.files, entryRelative), `${name} public entry is not covered by the package file hashes.`);
            }
          });

          await checkAsync('opened supplied registry presentation', async () => {
            assert.equal(currentInputHash, generation.pptxSha256, 'Opened presentation bytes differ from the generated registry PPTX.');
          });

          if (bindingsVerified) await checkAsync('current picture reimport', async () => {
            const binding = generation.bindings['@openpresentation/opf-pptx'];
            const {fromPptx} = await import(binding.publicEntry);
            const savedPath = await canonicalFileUnder(root, report.saved?.path, 'saved presentation for reimport');
            const diagnostics = [];
            imported = await fromPptx(await readFile(savedPath), {onDiagnostic: diagnostic => diagnostics.push(diagnostic)});
            const pictures = imported.slides?.[0]?.blocks?.filter(block => block.image).map(block => block.image) ?? [];
            assert.equal(imported.slides?.length, 1);
            assert.equal(pictures.length, 1);
            assert.equal(pictures[0].alt, generation.expectedAlt);
            assert.equal(sha(Buffer.from(pictures[0].src.split(',')[1], 'base64')), generation.inputImage.sha256);
            assert.equal(diagnostics.length, 0);
          });
          else check('current picture reimport skipped because registry package bindings failed', () => assert.ok(false));

          if (imported) {
            await checkAsync('write imported OPF evidence without overwriting', async () => {
              await writeFile(path.join(root, 'saved-import.opf.json'), JSON.stringify(imported, null, 2) + '\n', {flag: 'wx'});
            });
          }
        }
      }
    } catch (error) {
      addUnexpectedError(error);
    }

    let verifierSha256 = null;
    await checkAsync('comparator source hash available', async () => {
      verifierSha256 = sha(await readFile(fileURLToPath(import.meta.url)));
    });
    const result = {
      passed: failures.length === 0,
      mode,
      scope,
      node: process.version,
      verifierSha256,
      reportSha256: reportBytes ? sha(reportBytes) : null,
      checks,
      failures,
    };

    let outputPath = path.join(root, 'comparison.json');
    try {
      await access(outputPath);
      const suffix = new Date().toISOString().replace(/[:.]/g, '-');
      outputPath = path.join(root, `comparison-${suffix}.json`);
      result.outputNote = 'comparison.json already existed and was preserved; this result was written to a unique filename.';
    } catch { /* no existing comparison report */ }
    result.outputPath = outputPath;
    try {
      await writeFile(outputPath, JSON.stringify(result, null, 2) + '\n', {flag: 'wx'});
      console.log(JSON.stringify({passed: result.passed, mode, checks: checks.length, failures, outputPath}));
      process.exitCode = result.passed ? 0 : 1;
    } catch (error) {
      console.error(`Could not write comparison evidence without overwriting an existing file: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
