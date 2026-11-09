import assert from 'node:assert/strict';
import test from 'node:test';
import {tableColorDocument} from './table-colors.mjs';
import {validateTableGeneration, tableRelative, tableFileRecords, tableRegular} from './table-profile.mjs';
import {assertTableLifecycle} from './compare-table-profile.mjs';
import {digest} from './identity.mjs';
import path from 'node:path';
import {mkdtemp, readFile, writeFile, rm, symlink, mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
const clone = value => structuredClone(value);
function sourceFixture() {
  const {document, expected} = tableColorDocument(), input = Buffer.from('synthetic input');
  const provenance = {node: process.version, packages: {synthetic: true}, suiteRepository: {revision: '1'.repeat(40)}, workerRepository: {revision: '2'.repeat(40)}};
  const selected = {id: 'table-colors', worker: 'table-colors', dedicatedWorker: 'native-table-colors.ps1', automaticControlEligible: false, slideCount: 6, expectedCells: 24, input: 'table-colors/table-colors.pptx', archiveSha256: digest(input)};
  return {input, source: document, suite: {schemaVersion: 1, provenance, cases: [selected]}, generation: {node: process.version, runtime: clone(provenance), sourceSha256: digest(JSON.stringify(document)), pptxSha256: digest(input), expected}};
}
test('table profile requires the complete original six-slide source, data, colors and generation identity', () => {
  const f = sourceFixture(); assert.equal(validateTableGeneration(f.suite, f.generation, f.source, f.input).id, 'table-colors');
  for (const [name, mutate] of [
    ['duplicate ID', f => f.suite.cases.push(clone(f.suite.cases[0]))],
    ['eligibility', f => { f.suite.cases[0].automaticControlEligible = true; }],
    ['five slides', f => { f.suite.cases[0].slideCount = 5; }],
    ['missing cells', f => { f.suite.cases[0].expectedCells = 20; }],
    ['worker', f => { f.suite.cases[0].dedicatedWorker = 'new-worker.ps1'; }],
    ['source identity', f => { f.generation.runtime.suiteRepository.revision = '3'.repeat(40); }],
    ['generator Node', f => { f.generation.node = 'v0.0.0'; }],
    ['archive hash', f => { f.generation.pptxSha256 = '0'.repeat(64); }],
    ['source text', f => { f.source.slides[0].table.columns[0].value = 'Wrong'; }],
    ['run color', f => { f.generation.expected[1].cells[1].runs[1].color = '#000000'; }],
    ['cell mapping', f => { f.generation.expected[1].cells[1].column = 1; }],
    ['slide drop', f => { f.source.slides.pop(); }],
  ]) { const m = sourceFixture(); mutate(m); assert.throws(() => validateTableGeneration(m.suite, m.generation, m.source, m.input), name); }
});
test('table paths and sealed file records reject aliasing, traversal, duplicate paths and changed bytes', async () => {
  for (const relative of ['../a', '/a', 'C:/a', 'a\\b', 'a/../b', 'a//b', 'a/./b', 'a.', 'a ', 'a\u0000b']) assert.throws(() => tableRelative(relative));
  const root = await mkdtemp(path.join(tmpdir(), 'opf-table-profile-path-'));
  try {
    await writeFile(path.join(root, 'a'), 'abc');
    const record = {path: 'a', bytes: 3, sha256: digest('abc')};
    await tableFileRecords(root, [record]);
    await assert.rejects(() => tableFileRecords(root, [record, record]), /Duplicate/u);
    await assert.rejects(() => tableFileRecords(root, [{...record, bytes: 4}]), /Byte count/u);
    await assert.rejects(() => tableFileRecords(root, [{...record, sha256: '0'.repeat(64)}]), /Hash differs/u);
    await mkdir(path.join(root, 'dir')); await symlink(path.join(root, 'dir'), path.join(root, 'alias'), process.platform === 'win32' ? 'junction' : 'dir');
    await writeFile(path.join(root, 'dir', 'file'), 'x');
    await assert.rejects(() => tableRegular(path.join(root, 'alias', 'file')), /Aliased path/u);
    await rm(path.join(root, 'alias')); // Remove only the owned link, never its target recursively.
  } finally { await rm(root, {recursive: true, force: true}); }
});
function lifecycleFixture() {
  const profile = {output: path.resolve('table-profile-synthetic'), suiteSha256: 'a'.repeat(64), generationIdentity: {producer: 'original'}, controller: {revision: 'b'.repeat(40)}};
  const envelopeSha256 = 'c'.repeat(64), common = {schemaVersion: 2, profile: 'table-colors-v2', envelopeSha256, generationIdentity: clone(profile.generationIdentity), executionIdentity: clone(profile.controller), nativeAcceptance: false, registryAcceptance: false};
  const runner = {...clone(common), sourceSuiteSha256: profile.suiteSha256, runOfficeRequested: true, timeoutSeconds: 45, status: 'native-observation-completed; comparison-and-coordinator-review-required'};
  const terminal = {envelopeSha256, timedOut: false, exitCode: 0, cleanupConfirmed: true, lastDurableStage: 'worker.complete'};
  const report = {...clone(common), cleanupConfirmed: true, officeOperationsStopped: false, edits: Array.from({length: 6}, (_, i) => ({slide: i + 1, row: 2, column: 1, before: 'Body', after: 'Native Body', prefix: 'Native '}))};
  const names = ['worker.initialize', 'application.create', 'application.initial.count', 'original.preflight.count', 'original.open', 'original.fullName', 'original.readOnly', ...Array.from({length: 6}, (_, i) => `original.slide.${i + 1}.capture`), 'original.saveCopyAs', 'original.close', 'reopened.preflight.count', 'reopened.open', 'reopened.fullName', 'reopened.readOnly', ...Array.from({length: 6}, (_, i) => `reopened.slide.${i + 1}.capture`), ...Array.from({length: 6}, (_, i) => `edit.slide.${i + 1}.prefix`), 'edited.saveCopyAs', 'reopened.close', 'edited.preflight.count', 'edited.open', 'edited.fullName', 'edited.readOnly', ...Array.from({length: 6}, (_, i) => `edited.slide.${i + 1}.capture`), 'edited.close', 'application.final.count', 'application.quit', 'worker.complete'];
  const files = {original: 'table-colors.pptx', reopened: 'table-colors-saved.pptx', edited: 'table-colors-edited.pptx'};
  for (const phase of ['original', 'reopened', 'edited']) report[phase] = Array.from({length: 6}, (_, index) => ({png: `${phase}-${index + 1}.png`}));
  report.opens = ['original', 'reopened', 'edited'].map(phase => ({phase, path: path.join(profile.output, 'table-colors', files[phase]), readOnly: -1}));
  const stages = [];
  for (const name of names) for (const status of name.startsWith('worker.') ? ['success'] : ['begin', 'success']) {
    const phase = name.split('.')[0];
    stages.push({sequence: stages.length + 1, stage: name, status, officeOperationsStopped: false, timestamp: '2026-11-09T00:00:00.000Z', ownedPresentationPath: files[phase] ? path.join(profile.output, 'table-colors', files[phase]) : null});
  }
  return {runner, terminal, report, stages, profile, envelopeSha256};
}
test('table execution adapter keeps genuine generation and controller identities separate and checks all native phases', () => {
  assertTableLifecycle(lifecycleFixture());
  for (const [name, mutate] of [
    ['generator impersonation', f => { f.report.generationIdentity = clone(f.profile.controller); }],
    ['stale controller', f => { f.runner.executionIdentity.revision = 'd'.repeat(40); }],
    ['writeable open', f => { f.report.opens[1].readOnly = 0; }], ['foreign identical path', f => { f.report.opens[1].path += '-foreign'; }],
    ['timeout', f => { f.terminal.timedOut = true; }], ['exit failure', f => { f.terminal.exitCode = 1; }],
    ['cleanup', f => { f.terminal.cleanupConfirmed = false; }], ['latch', f => { f.report.officeOperationsStopped = true; }],
    ['61 seconds', f => { f.runner.timeoutSeconds = 61; }], ['five edits', f => { f.report.edits.pop(); }],
    ['wrong edit cell', f => { f.report.edits[0].column = 2; }], ['missing prefix', f => { f.report.edits[2].after = 'Body'; }],
    ['missing native phase', f => { f.report.edited.pop(); }], ['capture traversal', f => { f.report.original[0].png = '../original-1.png'; }],
    ['stage error', f => { f.stages[3].status = 'error'; }], ['stage gap', f => { f.stages[3].sequence++; }],
    ['wrong owned path', f => { f.stages.find(s => s.stage === 'edited.readOnly').ownedPresentationPath = '/wrong'; }],
    ['skip edit', f => { f.stages = f.stages.filter(s => s.stage !== 'edit.slide.6.prefix').map((s, i) => ({...s, sequence: i + 1})); }],
    ['missing original reopen', f => { f.stages = f.stages.filter(s => s.stage !== 'reopened.open').map((s, i) => ({...s, sequence: i + 1})); }],
    ['extra close', f => { const s = clone(f.stages.find(s => s.stage === 'edited.close' && s.status === 'begin')); f.stages.splice(-1, 0, s, {...s, status: 'success'}); f.stages.forEach((s, i) => { s.sequence = i + 1; }); }],
  ]) { const f = lifecycleFixture(); mutate(f); assert.throws(() => assertTableLifecycle(f), name); }
});

test('external profile pin and stale-attempt guards fail before execution without overwriting evidence', async () => {
  const {bindTableProfile, assertTableFreshOutput} = await import('./table-profile.mjs');
  const root = await mkdtemp(path.join(tmpdir(), 'opf-table-pin-'));
  try {
    await mkdir(path.join(root, 'table-colors'));
    const envelopeFile = path.join(root, 'table-profile.json');
    await writeFile(envelopeFile, '{}');
    await assert.rejects(() => bindTableProfile({envelopeFile, envelopeSha256: '0'.repeat(64)}), /External profile hash differs/u);
    await assert.rejects(() => bindTableProfile({envelopeFile, envelopeSha256: ''}), /External profile SHA/u);
    await assertTableFreshOutput(root);
    for (const relative of ['runner.json', 'table-colors/worker.stdout.log', 'table-colors/native.json', 'table-colors/table-colors-edited.pptx', 'table-colors/reopened-6.png']) {
      await writeFile(path.join(root, relative), 'protected prior bytes');
      await assert.rejects(() => assertTableFreshOutput(root), /Preserve prior attempt/u);
      assert.equal(await readFile(path.join(root, relative), 'utf8'), 'protected prior bytes');
      await rm(path.join(root, relative));
    }
  } finally { await rm(root, {recursive: true, force: true}); }
});

test('unchanged table comparator keeps all72cells, character colors,18rasters and all9current-data imports', async () => {
  const {generateTableColors} = await import('./table-colors.mjs');
  const {compareNativeTableColors} = await import('./compare-table-colors.mjs');
  const parent = await mkdtemp(path.join(tmpdir(), 'opf-table-contract-'));
  try {
    const modes = ['positive', 'missing-cell', 'wrong-character', 'wrong-color', 'wrong-prefix', 'edited-archive-hash', 'reopened-raster', ...Array.from({length: 9}, (_, i) => `import-${i + 1}`)];
    for (const mode of modes) {
      const output = path.join(parent, mode), consumer = path.join(parent, mode + '-consumer'); await mkdir(output); await mkdir(consumer);
      let imports = 0;
      const pptx = {toPptx: async document => Buffer.from(JSON.stringify(document)), fromPptx: async bytes => {
        imports++; const document = JSON.parse(Buffer.from(bytes).toString());
        if (mode === `import-${imports}`) document.slides[5].table.rows[0][0].value = 'CURRENT TEXT LOST';
        return document;
      }};
      const sourceIdentity = {kind: 'explicitly modeled comparator fixture, not native output'};
      await generateTableColors({consumer, output, sourceIdentity, engines: {pptx}});
      const root = path.join(output, 'table-colors'), generationBytes = await readFile(path.join(root, 'generation.json')), generation = JSON.parse(generationBytes);
      const source = JSON.parse(await readFile(path.join(output, 'sources/table-colors.opf.json'))), edited = clone(source);
      for (const slide of edited.slides) slide.table.rows[0][0].value = 'Native Body';
      const saved = await readFile(path.join(root, 'table-colors.pptx')), editedBytes = Buffer.from(JSON.stringify(edited));
      await writeFile(path.join(root, 'table-colors-saved.pptx'), saved); await writeFile(path.join(root, 'table-colors-edited.pptx'), editedBytes);
      const native = {generationSha256: digest(generationBytes), savedSha256: digest(saved), editedSha256: digest(editedBytes)};
      for (const phase of ['original', 'reopened', 'edited']) {
        native[phase] = [];
        for (const [index, slide] of generation.expected.entries()) {
          const cells = slide.cells.map(cell => {
            const runs = clone(cell.runs); if (phase === 'edited' && cell.row === 2 && cell.column === 1) runs[0].text = 'Native ' + runs[0].text;
            return {row: cell.row, column: cell.column, text: runs.map(run => run.text).join(''), characters: runs.flatMap(run => Array.from(run.text, character => ({character, color: run.color})))};
          });
          const png = `${phase}-${index + 1}.png`, pngBytes = Buffer.from(`modeled ${phase === 'edited' ? 'edited' : 'original'} image ${index}`);
          await writeFile(path.join(root, png), pngBytes); native[phase].push({slide: index + 1, cells, png, pngSha256: digest(pngBytes)});
        }
      }
      if (mode === 'missing-cell') native.reopened[5].cells.pop();
      if (mode === 'wrong-character') native.original[3].cells[1].characters[0].character = 'X';
      if (mode === 'wrong-color') native.edited[5].cells[3].characters.at(-1).color = '#000000';
      if (mode === 'wrong-prefix') native.edited[4].cells[2].text = 'Body';
      if (mode === 'edited-archive-hash') native.editedSha256 = '0'.repeat(64);
      if (mode === 'reopened-raster') { const bytes = Buffer.from('different image'); await writeFile(path.join(root, native.reopened[2].png), bytes); native.reopened[2].pngSha256 = digest(bytes); }
      await writeFile(path.join(root, 'native.json'), JSON.stringify(native));
      const compare = () => compareNativeTableColors({consumer, output, sourceIdentity, engines: {pptx}});
      if (mode === 'positive') {
        const result = await compare(); assert.equal(result.cells, 72); assert.equal(result.imports.length, 9); assert.equal(imports, 9);
        assert.equal(result.imports.reduce((sum, item) => sum + item.slides, 0), 54);
      } else {
        await assert.rejects(compare, mode.startsWith('import-') ? /cycle [0-2] slide 6 cell 2,1/u : undefined);
        if (mode.startsWith('import-')) assert.equal(imports, Number(mode.substring(7)), 'Each required import is actually reached and checked');
      }
    }
  } finally { await rm(parent, {recursive: true, force: true}); }
});

test('full modeled profile binds old generator, worker and installed bytes separately from new controller and snapshots', async () => {
  const {execFileSync} = await import('node:child_process');
  const {fileURLToPath} = await import('node:url');
  const {installedIdentity, repositoryIdentity} = await import('./identity.mjs');
  const {TABLE_PROFILE_FILES, prepareTableProfile, bindTableProfile} = await import('./table-profile.mjs');
  const {generateTableColors} = await import('./table-colors.mjs');
  const scratch = await mkdtemp(path.join(tmpdir(), 'opf-table-authority-'));
  const git = (root, ...args) => execFileSync('git', ['-C', root, ...args], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trim();
  const commit = root => { git(root, 'add', '.'); git(root, '-c', 'user.name=OPF pure control', '-c', 'user.email=control@invalid.test', 'commit', '-qm', 'Synthetic test authority; no native evidence'); };
  async function repository(name, files) {
    const root = path.join(scratch, name); await mkdir(root); git(root, 'init', '-q');
    for (const relative of files) { await mkdir(path.dirname(path.join(root, relative)), {recursive: true}); await writeFile(path.join(root, relative), `synthetic ${relative}\n`); }
    commit(root); return root;
  }
  try {
    const controller = await repository('controller', TABLE_PROFILE_FILES), producer = await repository('producer', ['source.txt']), worker = await repository('legacy', ['test/native-process.ps1']);
    const consumer = path.join(scratch, 'consumer'); await mkdir(consumer); await writeFile(path.join(consumer, 'package.json'), '{}');
    for (const short of ['opf', 'opf-render', 'opf-pptx', 'opf-editor', 'cli', 'gallery']) {
      const root = path.join(consumer, 'node_modules/@openpresentation', short); await mkdir(path.join(root, 'dist'), {recursive: true});
      await writeFile(path.join(root, 'package.json'), JSON.stringify({name: `@openpresentation/${short}`, version: '0.0.0-control', type: 'module', exports: {'.': './dist/index.js', './package.json': './package.json'}}));
      await writeFile(path.join(root, 'dist/index.js'), 'export const synthetic = true;\n');
    }
    const provenance = {node: process.version, packages: installedIdentity(consumer), suiteRepository: repositoryIdentity(producer, ['source.txt']), workerRepository: repositoryIdentity(worker, ['test/native-process.ps1']), nativeAcceptance: false, registryAcceptance: false};
    const suiteDirectory = path.join(scratch, 'suite'); await mkdir(suiteDirectory);
    const generated = await generateTableColors({consumer, output: suiteDirectory, sourceIdentity: provenance, engines: {pptx: {toPptx: async source => Buffer.from(JSON.stringify(source))}}});
    const suite = {schemaVersion: 1, cases: generated.cases.map(c => ({...c, worker: 'table-colors'})), files: generated.files, provenance};
    await writeFile(path.join(suiteDirectory, 'suite.json'), JSON.stringify(suite));
    const output = path.join(scratch, 'prepared');
    const prepared = await prepareTableProfile({suiteDirectory, producerRepository: producer, legacyWorkerRepository: worker, consumer, output}, {root: controller});
    const bind = sha256 => bindTableProfile({envelopeFile: prepared.envelope, envelopeSha256: sha256 ?? prepared.sha256, root: controller, fresh: true});
    const bound = await bind(); assert.deepEqual(bound.envelope.generationIdentity, provenance); assert.notEqual(bound.envelope.controller.revision, provenance.suiteRepository.revision);
    const protectedFiles = [path.join(suiteDirectory, 'table-colors/table-colors.pptx'), path.join(producer, 'source.txt'), path.join(worker, 'test/native-process.ps1'), path.join(controller, TABLE_PROFILE_FILES[0]), path.join(consumer, 'node_modules/@openpresentation/opf/dist/index.js'), path.join(output, 'inputs/native-table-colors-v2.ps1')];
    for (const file of protectedFiles) { const original = await readFile(file); try { await writeFile(file, Buffer.concat([original, Buffer.from('changed')])); await assert.rejects(bind); } finally { await writeFile(file, original); } }
    const originalEnvelope = await readFile(prepared.envelope);
    for (const mutate of [e => { e.node.path += '-foreign'; }, e => { e.controllerRepository = producer; }, e => { e.limits.cells = 20; }, e => { e.generationIdentity = clone(e.controller); }, e => { e.snapshots[0].path = '../escape'; }]) {
      const envelope = JSON.parse(originalEnvelope); mutate(envelope); const bytes = Buffer.from(JSON.stringify(envelope));
      try { await writeFile(prepared.envelope, bytes); await assert.rejects(() => bind(digest(bytes))); } finally { await writeFile(prepared.envelope, originalEnvelope); }
    }
    await writeFile(path.join(output, 'table-colors/native.json'), 'preserve prior attempt'); await assert.rejects(bind, /Preserve prior attempt/u);
    await assert.rejects(() => prepareTableProfile({suiteDirectory, producerRepository: producer, legacyWorkerRepository: worker, consumer, output}, {root: controller}), {code: 'EEXIST'});
    // Bootstrap runs only actual source helper definitions on a synthetic Git
    // controller; it does not execute Node/worker/Office entrypoints.
    if (process.platform === 'win32') {
      const {spawnSync} = await import('node:child_process');
      const {windowsPowerShellEnvironment} = await import('./windows-powershell-env.mjs');
      const checker = path.join(scratch, 'bootstrap.ps1'), identity = path.join(scratch, 'bootstrap.json');
      await writeFile(identity, JSON.stringify({controller: bound.envelope.controller, node: bound.envelope.node}));
      await writeFile(checker, `param([string]$Source,[string]$Root,[string]$Identity)\n$ErrorActionPreference='Stop'\n$t=$null;$e=$null;$a=[Management.Automation.Language.Parser]::ParseFile($Source,[ref]$t,[ref]$e);if($e.Count){throw 'Parse'}\nforeach($n in @('Assert-TableControllerBootstrap','Assert-TableNodeBootstrap')){$f=$a.Find({param($x)$x -is [Management.Automation.Language.FunctionDefinitionAst] -and $x.Name -ceq $n},$true);Invoke-Expression $f.Extent.Text}\n$i=Get-Content -LiteralPath $Identity -Raw|ConvertFrom-Json\nAssert-TableControllerBootstrap $Root $i.controller\nAssert-TableNodeBootstrap $i.node.path $i.node\n$i.node.identity.sha256='0'*64;$ok=$false;try{Assert-TableNodeBootstrap $i.node.path $i.node}catch{$ok=$true};if(-not $ok){throw 'Wrong Node accepted'}\n$i.controller.revision='0'*40;$ok=$false;try{Assert-TableControllerBootstrap $Root $i.controller}catch{$ok=$true};if(-not $ok){throw 'Wrong controller accepted'}\nWrite-Output 'PASS actual bootstrap helpers, no executable/worker/Office started'\n`);
      const actualWrapper = fileURLToPath(new URL('./run-table-profile.ps1', import.meta.url));
      const result = spawnSync(path.join(process.env.WINDIR, 'System32/WindowsPowerShell/v1.0/powershell.exe'), ['-NoProfile', '-NonInteractive', '-File', checker, '-Source', actualWrapper, '-Root', controller, '-Identity', identity], {encoding: 'utf8', windowsHide: true, timeout: 60000, env: windowsPowerShellEnvironment(process.env)});
      assert.equal(result.error, undefined); assert.equal(result.status, 0, result.stdout + result.stderr); assert.match(result.stdout, /PASS actual bootstrap/u);
    }
  } finally { await rm(scratch, {recursive: true, force: true}); }
});
