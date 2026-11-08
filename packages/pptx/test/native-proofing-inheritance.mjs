// NEVERMERGE source/mock qualification. This test never executes the native worker.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdirSync, mkdtempSync, readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gzipSync, gunzipSync} from 'node:zlib';
import {scanPowerShellSource} from './powershell-scan.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const lane = path.join(root, 'tools/rr105-proofing-readonly');
const worker = path.join(lane, 'worker-package/test/native-furniture-control.ps1');
const checker = path.join(lane, 'qualify.ps1');
const helper = path.join(lane, 'worker-package/test/native-process.ps1');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const baseline = gunzipSync(readFileSync(path.join(lane, 'reference-worker.ps1.gz')));
assert.equal(sha(baseline), 'de0905bd8024f3eebbd0518c338e67449c45f5e2de998714069d7a14210e1943');
assert.equal(sha(readFileSync(helper)), 'b9444de1367fe3a3aab654f4787b5aa9a1304dc38360159a45d1f9f420adf69c');
for (const file of [worker, checker, helper]) assert.deepEqual(scanPowerShellSource(readFileSync(file, 'utf8')).issues, [], file);
const modeled = scanPowerShellSource(readFileSync(worker, 'utf8')).code;
assert.equal([...modeled.matchAll(/\$Range\.LanguageID\b/g)].length, 1, 'one legacy primary-language getter');
assert.doesNotMatch(modeled, /\.LanguageID\s*=/i, 'no proofing setter');
assert.doesNotMatch(modeled, /\.(?:LtrRun|RtlRun)\b/i, 'no direction mutation or alternate API');
assert.equal([...modeled.matchAll(/New-Object\s+-ComObject/g)].length, [...scanPowerShellSource(baseline.toString('utf8')).code.matchAll(/New-Object\s+-ComObject/g)].length, 'no new Office construction path');
const reader = text => text.slice(text.indexOf('function Read-FurnitureState('), text.indexOf('function Get-ActionTags('));
const readerAddedLines = [
  `    Assert-FurnitureProofingPhase $Phase $false`,
  `    if($slideCount -ne 1) { Stop-FurnitureLifecycle 'Proofing diagnostic requires one observed native slide' }`,
  `        if($shapeCount -ne 3) { Stop-FurnitureLifecycle 'Proofing diagnostic requires exactly three observed top-level shapes' }`,
  `            if($hasTextFrame -eq 0 -or $text -isnot [string] -or [string]::IsNullOrEmpty($text)) { Stop-FurnitureLifecycle 'Proofing diagnostic requires a nonempty observed text range on every shape' }`,
  `            $proofingLanguage=Read-FurnitureProofingLanguage $range $Phase $slideIndex $name "$Phase.slide-$slideIndex.shape-$shapeIndex"`,
  `            $shapeRecord.textProofingLanguage=$proofingLanguage`,
  `        Assert-FurnitureProofingPhase $Phase $true`,
];
const readerLines = reader(readFileSync(worker, 'utf8')).split('\n');
for (const line of readerAddedLines) assert.equal(readerLines.filter(current => current === line).length, 1, 'one reviewed reader extension line: ' + line);
assert.equal(readerLines.filter(line => !readerAddedLines.includes(line)).join('\n'), reader(baseline.toString('utf8')), 'every original phase-reader byte remains exact outside seven reviewed additions');
const inputTransport = readFileSync(path.join(lane, 'offline-inputs.zip.gz'));
assert.equal(sha(inputTransport), 'a4ee35c59e817f45268b0a35879d26abfbe09992f34862ded82f7a9c36cbf91e');
const {unzipSync, zipSync, strFromU8} = createRequire(new URL('../package.json', import.meta.url))('fflate');
const packet = unzipSync(gunzipSync(inputTransport));
const seals = JSON.parse(strFromU8(packet['input-seals.json']));
for (const file of seals) {
  assert.equal(packet[file.path].length, file.bytes, 'exact original packet length ' + file.path);
  assert.equal(sha(packet[file.path]), file.sha256, 'exact original packet hash ' + file.path);
}
const expected = {A: '4b9d084f5ddccd23f553cc0a030ad8a43bca6e120de89d13cfca34b4163f06e2', B: '2d83ede6179333d73994af25e633129de05c44441ec3b0b570c19aa718152ad5', C: '60fe2d29b96d30be594c115fd84332b0f5a14ac882f25d6ea8dcbbc655e3a5e4'};
for (const [id, hash] of Object.entries(expected)) assert.equal(sha(packet[id + '.pptx']), hash);
const nativeMetadata = JSON.parse(gunzipSync(readFileSync(path.join(lane, 'reference-native-shapes.json.gz'))));
assert.equal(nativeMetadata.inputSha256, expected.A);
assert.equal(nativeMetadata.nativeReportSha256, 'bb22605327a8097373bf8ba0b1f72a5f5bcfa11d80cbe762d1ece87d97d04152');
assert.equal(nativeMetadata.rows.length, 3);
if (process.platform === 'win32') {
  const artifacts = path.join(root, 'artifacts'); mkdirSync(artifacts, {recursive: true});
  const dir = mkdtempSync(path.join(artifacts, 'native-proofing-inheritance-'));
  const expectedRuntime = JSON.parse(strFromU8(packet['runtime-before.json']));
  const frozenRoots = {q473: 'C:/opf-work/rr105-sh26-rtl', corrected: 'C:/opf-work/rr105-tag-ownership'};
  const verifyFrozen = () => Object.fromEntries(Object.entries(expectedRuntime).map(([name, expectedState]) => {
    const revision = spawnSync('git', ['--no-optional-locks', '-C', frozenRoots[name], 'rev-parse', 'HEAD'], {encoding: 'utf8', windowsHide: true});
    assert.equal(revision.status, 0, revision.stderr);
    assert.equal(revision.stdout.trim(), expectedState.revision, 'frozen source revision ' + name);
    for (const file of expectedState.files) {
      const bytes = readFileSync(path.join(frozenRoots[name], file.path));
      assert.equal(bytes.length, file.bytes, 'frozen runtime length ' + name + ':' + file.path);
      assert.equal(sha(bytes), file.sha256, 'frozen runtime hash ' + name + ':' + file.path);
    }
    return [name, {revision: expectedState.revision, files: expectedState.files.length, manifestSha256: expectedState.sha256}];
  }));
  const frozenBefore = verifyFrozen();
  writeFileSync(path.join(dir, 'frozen-runtime-before.json'), JSON.stringify(frozenBefore, null, 2) + '\n');
  const suite = path.join(dir, 'inputs'); mkdirSync(suite);
  for (const id of Object.keys(expected)) writeFileSync(path.join(suite, id + '.pptx'), packet[id + '.pptx']);
  writeFileSync(path.join(suite, 'mock-shapes.json'), JSON.stringify(nativeMetadata.rows, null, 2) + '\n');
  writeFileSync(path.join(dir, 'baseline.ps1'), baseline);
  for (const file of [worker, checker, helper, path.join(lane, 'derive-worker.mjs')]) writeFileSync(path.join(dir, path.basename(file) + '.gz'), gzipSync(readFileSync(file)));
  writeFileSync(path.join(dir, 'reference-worker.ps1.gz'), readFileSync(path.join(lane, 'reference-worker.ps1.gz')));
  writeFileSync(path.join(dir, 'derive-worker.mjs'), readFileSync(path.join(lane, 'derive-worker.mjs')));
  const derive = spawnSync(process.execPath, [path.join(dir, 'derive-worker.mjs')], {encoding: 'utf8', windowsHide: true, timeout: 10000});
  writeFileSync(path.join(dir, 'derive.stdout.log'), derive.stdout ?? ''); writeFileSync(path.join(dir, 'derive.stderr.log'), derive.stderr ?? '');
  assert.equal(derive.status, 0, derive.error?.message ?? derive.stderr);
  assert.deepEqual(readFileSync(path.join(dir, 'worker-package/test/native-furniture-control.ps1')), readFileSync(worker), 'new worker is exactly reproducible from sealed ce92');
  const sourceEntries = unzipSync(packet['A.pptx']);
  const variant = (name, edit) => {
    const entries = Object.fromEntries(Object.entries(sourceEntries).map(([key, value]) => [key, new Uint8Array(value)]));
    edit(entries);
    const bytes = zipSync(Object.fromEntries(Object.entries(entries).map(([key, value]) => [key, [value, {mtime: new Date('2000-01-01T00:00:00Z')}]])), {level: 9});
    assert(!Object.values(expected).includes(sha(bytes)), 'negative must not be an authorized archive');
    writeFileSync(path.join(suite, name + '.pptx'), bytes);
  };
  variant('unlisted', () => {});
  variant('two-slides', entries => { entries['ppt/slides/slide2.xml'] = entries['ppt/slides/slide1.xml']; });
  variant('foreign-shape', entries => { entries['ppt/slides/slide1.xml'] = Buffer.from(strFromU8(entries['ppt/slides/slide1.xml']).replace('name="OPF heading slides.0.title line 0"', 'name="Foreign shape"')); });
  variant('missing-shape', entries => { entries['ppt/slides/slide1.xml'] = Buffer.from(strFromU8(entries['ppt/slides/slide1.xml']).replace(/<p:sp>[\s\S]*?<\/p:sp>/g, shape => shape.includes('name="OPF list slides.0.items line 1"') ? '' : shape)); });
  variant('duplicate-shape', entries => { entries['ppt/slides/slide1.xml'] = Buffer.from(strFromU8(entries['ppt/slides/slide1.xml']).replace(/<p:sp>[\s\S]*?<\/p:sp>/g, shape => shape.includes('name="OPF list slides.0.items line 1"') ? shape + shape : shape)); });
  const env = {...process.env}; for (const key of Object.keys(env)) if (key.toLowerCase() === 'psmodulepath') delete env[key];
  const executable = path.join(process.env.WINDIR, 'System32/WindowsPowerShell/v1.0/powershell.exe');
  for (const mode of ['validate-only', 'source-and-mocks']) {
    const report = path.join(dir, mode + '.json');
    const args = ['-NoProfile', '-NonInteractive', '-File', checker, '-ScriptPath', worker, '-BaselinePath', path.join(dir, 'baseline.ps1'), '-SuiteRoot', suite, '-ReportPath', report, ...(mode === 'validate-only' ? ['-ValidateOnly'] : [])];
    const run = spawnSync(executable, args, {encoding: 'utf8', windowsHide: true, env, timeout: 30000});
    writeFileSync(path.join(dir, mode + '.stdout.log'), run.stdout ?? ''); writeFileSync(path.join(dir, mode + '.stderr.log'), run.stderr ?? '');
    writeFileSync(path.join(dir, mode + '.execution.json'), JSON.stringify({executable, args, exitCode: run.status, signal: run.signal, error: run.error ? String(run.error) : null, workerSha256: sha(readFileSync(worker)), checkerSha256: sha(readFileSync(checker)), officeConstructed: false}, null, 2) + '\n');
    assert.equal(run.status, 0, run.error?.message ?? run.stdout + run.stderr + '\nRetained: ' + dir);
    const result = JSON.parse(readFileSync(report, 'utf8').replace(/^\uFEFF/, ''));
    assert.equal(result.passed, true); assert.equal(result.officeConstructed, false); assert.equal(result.actualOfficeAcceptance, false);
    assert.ok(result.cases.every(row => row.passed)); assert.equal(new Set(result.cases.map(row => row.name)).size, result.cases.length);
    assert.ok(result.protectedFunctions.length > 25);
    if (mode === 'source-and-mocks') {
      const positive = result.cases.find(row => row.name === 'all-nine-phase-name-primary-language-getters-exact');
      assert.equal(positive.evidence.getters, 9); assert.equal(positive.evidence.observations.length, 9);
      assert.ok(positive.evidence.observations.every(row => row.observedLanguageId === 1025));
      for (const name of ['null', 'mixed', 'english', 'zero', 'string', 'fraction']) assert.ok(result.cases.some(row => row.name === 'reject-language-' + name));
      assert.ok(result.cases.some(row => row.name === 'reject-language-getter-throw'));
      assert.ok(result.cases.some(row => row.name === 'reject-changed-language-in-reopened'));
    }
    console.log(JSON.stringify({mode, report, controls: result.cases.length, protectedFunctions: result.protectedFunctions.length, officeConstructed: false}));
  }
  const frozenAfter = verifyFrozen();
  assert.deepEqual(frozenAfter, frozenBefore);
  writeFileSync(path.join(dir, 'frozen-runtime-after.json'), JSON.stringify(frozenAfter, null, 2) + '\n');
} else console.log('Proofing diagnostic archive/source policy passes. Windows PowerShell 5.1 mocks and ValidateOnly require Windows; no native acceptance.');
