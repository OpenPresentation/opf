// Dedicated whole-seven observation controller. No Office calls in this module.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { inspectSevenArchive, bindSevenPhase } from './seven-chart-archive.mjs';
import { digest, fileIdentity, installedIdentity, repositoryIdentity } from './identity.mjs';

export const SEVEN_SUPERVISOR = {
  path: 'test/native-process.ps1',
  bytes: 2341,
  sha256: 'b9444de1367fe3a3aab654f4787b5aa9a1304dc38360159a45d1f9f420adf69c',
};
export const SEVEN_PROFILE = 'seven-chart-original-readonly-v1';
export const SEVEN_CASES = [
  'chart-all-seven',
  'chart-mode-all-seven-fallback',
  'chart-mode-all-seven-auto',
  'chart-mode-all-seven-native',
];
export const SEVEN_CONTROLLER_FILES = [
  'scripts/native-acceptance/seven-chart-profile.mjs',
  'scripts/native-acceptance/seven-chart-archive.mjs',
  'scripts/native-acceptance/run-seven-chart-profile.ps1',
  'scripts/native-acceptance/seven-chart-worker.ps1',
  'scripts/native-acceptance/identity.mjs',
  'scripts/native-acceptance/run-windows.ps1',
];
const controllerRoot = fileURLToPath(new URL('../../', import.meta.url));
const hasControl = (value) => [...value].some((char) => char.charCodeAt(0) < 32);
const hex = (value) => assert.match(value, /^[a-f0-9]{64}$/u, 'Expected an explicit SHA256 digest');
const unique = (items, key, label) => {
  assert.ok(Array.isArray(items), label);
  const seen = new Set();
  for (const item of items) {
    const value = key(item);
    assert.equal(typeof value, 'string', label);
    assert.ok(value.length && !seen.has(value.toLowerCase()), label);
    seen.add(value.toLowerCase());
  }
};
export function plainLocalPath(file, { exists = true } = {}) {
  assert.equal(typeof file, 'string');
  assert.ok(
    path.isAbsolute(file) && !/^[/\\]{2}/u.test(file) && !hasControl(file),
    'Expected an absolute local non-UNC path',
  );
  const full = path.resolve(file);
  let cursor = full;
  for (;;) {
    try {
      assert.ok(!fs.lstatSync(cursor).isSymbolicLink(), 'Reparse/symlink path refused');
    } catch (error) {
      if (error.code !== 'ENOENT' || (exists && cursor === full)) throw error;
    }
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  return full;
}
function portable(relative) {
  assert.equal(typeof relative, 'string');
  assert.ok(
    relative &&
      !path.isAbsolute(relative) &&
      !hasControl(relative) &&
      ![...relative].some((char) => '\\<>:"|?*'.includes(char)),
    'Invalid portable asset path',
  );
  for (const part of relative.split('/'))
    assert.ok(
      part && !['.', '..'].includes(part) && !/[. ]$/u.test(part),
      'Invalid portable asset segment',
    );
  return relative;
}
function asset(root, relative) {
  portable(relative);
  const full = plainLocalPath(path.resolve(root, relative));
  assert.ok(full.startsWith(path.resolve(root) + path.sep), 'Asset escaped root');
  assert.ok(fs.lstatSync(full).isFile(), 'Expected a regular asset');
  return full;
}
function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/u, ''));
}
function records(root, files) {
  assert.ok(
    Array.isArray(files) && files.length > 0 && files.length <= 1000,
    'Bounded nonempty file records required',
  );
  unique(files, (r) => r.path, 'Duplicate file record');
  let total = 0;
  for (const record of files) {
    hex(record.sha256);
    assert.ok(
      Number.isSafeInteger(record.bytes) && record.bytes >= 0 && record.bytes <= 64 * 1024 * 1024,
      'Invalid file byte bound',
    );
    total += record.bytes;
    assert.ok(total <= 256 * 1024 * 1024, '256MiB aggregate bound');
    assert.deepEqual(
      fileIdentity(asset(root, record.path)),
      { bytes: record.bytes, sha256: record.sha256 },
      'Changed recorded asset ' + record.path,
    );
  }
}
function boundRepository(root, expected, required = []) {
  plainLocalPath(root);
  assert.match(expected.revision, /^[a-f0-9]{40}$/u);
  assert.equal(expected.dirty, false, 'Only reviewed clean repositories are eligible');
  records(root, expected.files);
  for (const file of required)
    assert.equal(
      expected.files.filter((r) => r.path === file).length,
      1,
      'Missing required code identity ' + file,
    );
  const actual = repositoryIdentity(
    root,
    expected.files.map((r) => r.path),
  );
  assert.deepEqual(actual, expected, 'Repository HEAD, dirty state or code identity changed');
  return actual;
}
function dependencies() {
  const local = createRequire(import.meta.url);
  const pptx = createRequire(local.resolve('@openpresentation/opf-pptx/package.json'));
  return { ...pptx('fflate'), ...pptx('fast-xml-parser') };
}

export const SEVEN_LIMITS = {
  slides: 7,
  maxShapesPerSlide: 3,
  maxTotalShapes: 20,
  maxActions: 0,
  maxArchiveBytes: 16 * 1024 * 1024,
  maxZipEntries: 4096,
  maxTimeoutSeconds: 60,
};
export function assertSevenSelection(suite, caseId, input, plan, deps) {
  assert.ok(SEVEN_CASES.includes(caseId), 'Select one of the four whole seven cases');
  assert.equal(suite.schemaVersion, 1);
  assert.equal(suite.nativeAcceptance, false);
  assert.equal(suite.provenance.nativeAcceptance, false);
  assert.equal(suite.provenance.registryAcceptance, false);
  unique(suite.cases, (c) => c.id, 'Case IDs');
  const selected = suite.cases.find((c) => c.id === caseId);
  assert.ok(selected, 'Selected whole case missing');
  assert.equal(selected.automaticControlEligible, false, 'Generic eligibility must stay false');
  assert.equal(selected.slideCount, 7);
  assert.equal(selected.worker, 'furniture');
  assert.equal(selected.archiveSha256, digest(input));
  assert.deepEqual(
    JSON.parse(
      Buffer.from(plan)
        .toString('utf8')
        .replace(/^\uFEFF/u, ''),
    ),
    [],
    'Seven profile permits zero actions',
  );
  const archive = inspectSevenArchive(input, deps);
  if (caseId.endsWith('-fallback'))
    assert.ok(
      archive.slides.every((s) => s.shapes.every((x) => x.branch === 'direct')),
      'Fallback must contain no alternate frames',
    );
  return { selected, archive };
}
function sourceBinding(generation, suite, selected) {
  let file, source;
  if (selected.source) {
    assert.equal(
      suite.files.filter((f) => f.path === selected.source).length,
      1,
      'Sealed OPF source must be recorded',
    );
    file = asset(generation.suiteDirectory, selected.source);
    source = readJson(file);
  } else {
    const baseline = suite.provenance.chartBaselines?.current;
    assert.ok(baseline, 'Missing original canonical chart authority');
    file = asset(generation.preparationRepository, baseline.path);
    assert.equal(fileIdentity(file).sha256, baseline.sha256, 'Canonical chart source changed');
    assert.equal(
      suite.provenance.suiteRepository.files.filter(
        (f) => f.path === baseline.path && f.sha256 === baseline.sha256,
      ).length,
      1,
      'Canonical source missing from generation identity',
    );
    source = readJson(file).decks['all-seven'];
  }
  assert.equal(source.slides.length, 7);
  for (const slide of source.slides) {
    assert.equal(typeof slide.title, 'string');
    assert.ok(slide.chart?.data?.columns && slide.chart.data.rows);
  }
  return { identity: { path: file, ...fileIdentity(file) }, deck: source };
}
function suiteBinding(generation, deps) {
  const directory = plainLocalPath(generation.suiteDirectory),
    bytes = fs.readFileSync(asset(directory, 'suite.json'));
  hex(generation.manifestSha256);
  assert.equal(digest(bytes), generation.manifestSha256, 'Suite manifest digest changed');
  const suite = JSON.parse(bytes);
  records(directory, suite.files);
  assert.deepEqual(suite.provenance, generation.provenance, 'Generation provenance changed');
  const selected = suite.cases.find((c) => c.id === generation.caseId);
  assert.ok(selected, 'Missing selected case');
  for (const key of ['input', 'actionPlan'])
    assert.equal(
      suite.files.filter((f) => f.path === selected[key]).length,
      1,
      'Unrecorded selected asset',
    );
  const input = fs.readFileSync(asset(directory, selected.input)),
    plan = fs.readFileSync(asset(directory, selected.actionPlan));
  const checked = assertSevenSelection(suite, generation.caseId, input, plan, deps);
  assert.deepEqual(selected, generation.selectedCase);
  const source = sourceBinding(generation, suite, selected);
  assertSevenTitles(checked.archive, source.deck);
  return { suite, directory, input, plan, source, ...checked };
}
export function validateSevenEnvelope(
  envelope,
  { root = controllerRoot, deps = dependencies() } = {},
) {
  assert.equal(envelope.schemaVersion, 1);
  assert.equal(envelope.profile, SEVEN_PROFILE);
  assert.equal(envelope.nativeAcceptance, false);
  assert.equal(envelope.registryAcceptance, false);
  assert.deepEqual(envelope.limits, SEVEN_LIMITS);
  assert.deepEqual(envelope.phases, ['original', 'saved-reopened']);
  const binding = suiteBinding(envelope.generation, deps);
  const supervisors = binding.suite.provenance.workerRepository.files.filter(
    (f) => f.path === SEVEN_SUPERVISOR.path,
  );
  assert.equal(supervisors.length, 1, 'Missing original supervisor');
  assert.deepEqual(
    supervisors[0],
    SEVEN_SUPERVISOR,
    'The seven profile requires the unchanged ce92 supervisor',
  );
  boundRepository(
    envelope.generation.preparationRepository,
    binding.suite.provenance.suiteRepository,
    ['scripts/native-acceptance/run-windows.ps1'],
  );
  boundRepository(envelope.generation.workerRepository, binding.suite.provenance.workerRepository, [
    'test/native-process.ps1',
    'test/native-process-check.ps1',
  ]);
  assert.deepEqual(
    installedIdentity(envelope.generation.consumer),
    binding.suite.provenance.packages,
    'Original runtime changed',
  );
  boundRepository(root, envelope.controllerRepository, SEVEN_CONTROLLER_FILES);
  assert.equal(envelope.controllerRepository.directory, fs.realpathSync(root));
  assert.notEqual(
    envelope.controllerRepository.directory,
    binding.suite.provenance.suiteRepository.directory,
    'New controller must not impersonate generation',
  );
  assert.deepEqual(fileIdentity(plainLocalPath(envelope.node.path)), envelope.node.identity);
  assert.equal(envelope.node.path, process.execPath);
  assert.equal(envelope.node.version, process.version);
  assert.match(process.version, /^v24\./u);
  assert.deepEqual(envelope.archive, binding.archive);
  assert.deepEqual(envelope.source, binding.source);
  return { ...binding, envelope };
}
export function createSevenEnvelope({
  suiteDirectory,
  expectedManifestSha256,
  caseId,
  preparationRepository,
  workerRepository,
  consumer,
  root = controllerRoot,
}) {
  hex(expectedManifestSha256);
  const bytes = fs.readFileSync(asset(plainLocalPath(suiteDirectory), 'suite.json'));
  assert.equal(digest(bytes), expectedManifestSha256, 'Expected suite digest differs');
  const suite = JSON.parse(bytes),
    generation = {
      suiteDirectory: fs.realpathSync(suiteDirectory),
      manifestSha256: expectedManifestSha256,
      caseId,
      preparationRepository: fs.realpathSync(preparationRepository),
      workerRepository: fs.realpathSync(workerRepository),
      consumer: fs.realpathSync(consumer),
      provenance: suite.provenance,
      selectedCase: suite.cases.find((c) => c.id === caseId),
    };
  const controllerRepository = repositoryIdentity(root, SEVEN_CONTROLLER_FILES);
  assert.equal(controllerRepository.dirty, false, 'Freeze controller before envelope creation');
  const binding = suiteBinding(generation, dependencies()),
    envelope = {
      schemaVersion: 1,
      profile: SEVEN_PROFILE,
      nativeAcceptance: false,
      registryAcceptance: false,
      generation,
      controllerRepository,
      node: {
        path: process.execPath,
        version: process.version,
        identity: fileIdentity(process.execPath),
      },
      limits: SEVEN_LIMITS,
      phases: ['original', 'saved-reopened'],
      archive: binding.archive,
      source: binding.source,
    };
  validateSevenEnvelope(envelope, { root });
  return envelope;
}
export function readSevenEnvelope(file, expectedSha256, options) {
  hex(expectedSha256);
  const bytes = fs.readFileSync(plainLocalPath(file));
  assert.ok(bytes.length <= 4 * 1024 * 1024, 'Bounded envelope');
  assert.equal(digest(bytes), expectedSha256, 'Envelope digest changed');
  return { ...validateSevenEnvelope(JSON.parse(bytes), options), envelopeSha256: digest(bytes) };
}
export function assertSevenOutput(directory, envelope, envelopeFile) {
  const full = plainLocalPath(directory, { exists: false }),
    key = (value) => path.resolve(value).replaceAll('\\', '/').toLowerCase(),
    candidate = key(full);
  for (const root of [
    envelope.generation.suiteDirectory,
    envelope.generation.preparationRepository,
    envelope.generation.workerRepository,
    envelope.generation.consumer,
    envelope.controllerRepository.directory,
    ...(envelopeFile ? [envelopeFile] : []),
  ]) {
    const protectedPath = key(plainLocalPath(root));
    assert.ok(
      candidate !== protectedPath &&
        !candidate.startsWith(protectedPath + '/') &&
        !protectedPath.startsWith(candidate + '/'),
      'Output overlaps immutable input/source/runtime',
    );
  }
  return full;
}
export function validateSevenExecution({
  envelopeFile,
  expectedEnvelopeSha256,
  output,
  requireOffice = false,
  root = controllerRoot,
  deps = dependencies(),
}) {
  const binding = readSevenEnvelope(envelopeFile, expectedEnvelopeSha256, { root, deps }),
    directory = assertSevenOutput(output, binding.envelope),
    snapshotEnvelope = asset(directory, 'execution-envelope.json');
  const envelopePath = fs.realpathSync(plainLocalPath(envelopeFile));
  if (envelopePath !== fs.realpathSync(snapshotEnvelope))
    assertSevenOutput(output, binding.envelope, envelopeFile);
  const runner = readJson(asset(directory, 'runner.json'));
  assert.equal(runner.schemaVersion, 1);
  assert.equal(runner.profile, SEVEN_PROFILE);
  assert.equal(runner.envelopeSha256, binding.envelopeSha256);
  assert.equal(runner.nativeAcceptance, false);
  assert.equal(runner.registryAcceptance, false);
  assert.equal(runner.runOfficeRequested, requireOffice);
  assert.ok(
    Number.isInteger(runner.timeoutSeconds) &&
      runner.timeoutSeconds >= 5 &&
      runner.timeoutSeconds <= 60,
  );
  assert.deepEqual(runner.generation, binding.envelope.generation);
  assert.deepEqual(runner.controllerRepository, binding.envelope.controllerRepository);
  assert.deepEqual(runner.node, binding.envelope.node);
  assert.deepEqual(runner.limits, SEVEN_LIMITS);
  assert.ok(
    requireOffice
      ? [
          'native-worker-pending',
          'native-observation-completed; supervisor-review-required',
        ].includes(runner.status)
      : runner.status === 'pure-checks-completed; native-not-run',
    'Unexpected execution authorization/status',
  );
  const one = (entries, name) => {
    const matches = entries.filter((r) => r.path === name);
    assert.equal(matches.length, 1, 'Missing snapshot source ' + name);
    return matches[0];
  };
  const worker = one(
    binding.envelope.controllerRepository.files,
    'scripts/native-acceptance/seven-chart-worker.ps1',
  );
  const expected = [
    { path: 'execution-envelope.json', ...fileIdentity(envelopePath) },
    { path: 'inputs/case.pptx', bytes: binding.input.length, sha256: digest(binding.input) },
    { path: 'inputs/action-plan.json', bytes: binding.plan.length, sha256: digest(binding.plan) },
    { path: 'inputs/seven-chart-worker.ps1', bytes: worker.bytes, sha256: worker.sha256 },
    { ...SEVEN_SUPERVISOR, path: 'inputs/native-process.ps1' },
  ];
  assert.deepEqual(
    [...runner.snapshots].sort((a, b) => a.path.localeCompare(b.path)),
    expected.sort((a, b) => a.path.localeCompare(b.path)),
    'Owned snapshots must bind the exact input, code and unchanged supervisor',
  );
  records(directory, runner.snapshots);
  assert.equal(fileIdentity(snapshotEnvelope).sha256, binding.envelopeSha256);
  return { ...binding, directory, runner, snapshots: expected };
}
export function assertSevenLifecycle(report, terminal, inputSha256, envelopeSha256) {
  assert.equal(terminal.timedOut, false);
  assert.equal(terminal.exitCode, 0);
  assert.equal(terminal.cleanupConfirmed, true);
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.profile, SEVEN_PROFILE);
  assert.equal(report.envelopeSha256, envelopeSha256);
  assert.equal(report.sourceSha256, inputSha256);
  assert.equal(report.cleanupConfirmed, true);
  assert.equal(report.officeOperationsStopped, false);
  assert.equal(report.error, null);
  assert.equal(report.lastStage, 'worker.complete');
  assert.equal(report.lastStatus, 'success');
  assert.deepEqual(report.actions, []);
  assert.deepEqual(
    report.opens.map((x) => [x.phase, x.readOnly]),
    [
      ['original', -1],
      ['saved-reopened', -1],
    ],
  );
  assert.equal(report.closes, 2);
  assert.equal(report.saveCopies, 1);
  assert.equal(report.quits, 1);
  assert.deepEqual(Object.keys(report.phases), ['original', 'saved-reopened']);
  for (const phase of Object.values(report.phases)) {
    assert.equal(phase.slideCount, 7);
    assert.equal(phase.slides.length, 7);
    assert.equal(phase.rasters.length, 7);
  }
  return true;
}
export function assertSevenStages(report, stages) {
  const names = [
    'worker.initialize',
    'application.create',
    'application.initial.presentations',
    'application.initial.count',
    'application.version',
    'application.path',
  ];
  for (const phase of ['original', 'saved-reopened']) {
    names.push(
      phase + '.preflight.presentations',
      phase + '.preflight.count',
      phase + '.open',
      phase + '.fullName',
      phase + '.readOnly',
      phase + '.slides',
      phase + '.slides.count',
    );
    for (let i = 1; i <= 7; i++) {
      names.push(
        phase + '.slide.' + i + '.get',
        phase + '.slide.' + i + '.id',
        phase + '.slide.' + i + '.name',
        phase + '.slide.' + i + '.shapes',
        phase + '.slide.' + i + '.shapes.count',
      );
      const slide = report.phases[phase].slides[i - 1];
      for (let j = 1; j <= slide.shapeCount; j++) {
        const base = phase + '.slide.' + i + '.shape.' + j;
        names.push(
          base + '.get',
          ...[
            'id',
            'name',
            'type',
            'left',
            'top',
            'width',
            'height',
            'rotation',
            'hasTextFrame',
            'alternativeText',
          ].map((p) => base + '.' + p),
        );
        if (slide.shapes[j - 1].hasTextFrame === -1)
          names.push(base + '.textFrame', base + '.textRange', base + '.text');
      }
      names.push(phase + '.slide.' + i + '.export');
    }
    if (phase === 'original') names.push('copy.fullName', 'copy.saveCopyAs', 'copy.afterName');
    names.push(phase + '.close.fullName', phase + '.close.discard', phase + '.close');
  }
  names.push(
    'application.final.presentations',
    'application.final.count',
    'application.quit',
    'worker.complete',
  );
  const expected = names.flatMap((stage) =>
    stage.startsWith('worker.')
      ? [{ stage, status: 'success' }]
      : [
          { stage, status: 'begin' },
          { stage, status: 'success' },
        ],
  );
  assert.equal(stages.length, expected.length, 'Missing or extra seven Office stage');
  stages.forEach((s, i) => {
    assert.equal(s.sequence, i + 1, 'Noncontiguous seven stage journal');
    assert.equal(s.stage, expected[i].stage);
    assert.equal(s.status, expected[i].status);
    assert.equal(s.officeOperationsStopped, false);
    assert.equal(typeof s.timestamp, 'string');
    assert.ok(Number.isFinite(Date.parse(s.timestamp)));
  });
  assert.ok(
    Array.isArray(report.probes) && report.probes.length > 0,
    'Primitive probes must be retained',
  );
  for (const probe of report.probes) assert.equal(probe.matched, true, 'A native probe refused');
  return true;
}
function semanticChart(chart) {
  const copy = structuredClone(chart);
  if (copy.workbook) delete copy.workbook.part;
  return copy;
}
export function compareSevenBindings(before, after) {
  const findings = [];
  for (let i = 0; i < 7; i++) {
    const a = before[i].shapes.find((s) => s.kind === 'chart'),
      b = after[i].shapes.find((s) => s.kind === 'chart');
    if (a.uri !== b.uri)
      findings.push({
        slide: i + 1,
        code: 'exposed-chart-family-changed',
        before: a.uri,
        after: b.uri,
      });
    if (!isDeepStrictEqual(semanticChart(a.chart), semanticChart(b.chart)))
      findings.push({
        slide: i + 1,
        code: 'exposed-cache-or-workbook-changed',
        before: a.chart,
        after: b.chart,
      });
  }
  return findings;
}
export function assertSevenTitles(archive, source) {
  assert.equal(source.slides.length, 7);
  archive.slides.forEach((slide, i) => {
    assert.equal(
      slide.shapes.find((s) => s.kind === 'title').text,
      source.slides[i].title,
      'Source title/order mismatch',
    );
  });
  return true;
}
export function compareSevenImports(source, imported) {
  const findings = [];
  for (const phase of ['original', 'saved-reopened']) {
    assert.equal(imported[phase].document.slides.length, 7, 'Public import lost a slide');
    assert.ok(Array.isArray(imported[phase].diagnostics), 'Retain import diagnostics');
    for (let i = 0; i < 7; i++)
      if (
        !isDeepStrictEqual(
          imported[phase].document.slides[i].chart?.data,
          source.slides[i].chart.data,
        )
      )
        findings.push({
          slide: i + 1,
          phase,
          code: 'import-authored-data-differs',
          source: source.slides[i].chart.data,
          actual: imported[phase].document.slides[i].chart?.data,
        });
  }
  if (!isDeepStrictEqual(imported.original.document, imported['saved-reopened'].document))
    findings.push({
      code: 'saved-public-import-differs',
      scope:
        'Full documents and diagnostics retained; no synthetic Row or other differences waived.',
    });
  if (!isDeepStrictEqual(imported.original.diagnostics, imported['saved-reopened'].diagnostics))
    findings.push({
      code: 'saved-public-import-diagnostics-differ',
      scope: 'Both diagnostic arrays retained; no changed warning/error is waived.',
    });
  return findings;
}
export async function bindSevenObservation({
  envelopeFile,
  expectedEnvelopeSha256,
  output,
  root = controllerRoot,
  engines,
}) {
  const binding = validateSevenExecution({
      envelopeFile,
      expectedEnvelopeSha256,
      output,
      requireOffice: true,
      root,
    }),
    directory = binding.directory,
    runner = binding.runner;
  assert.equal(runner.profile, SEVEN_PROFILE);
  assert.equal(runner.envelopeSha256, binding.envelopeSha256);
  assert.equal(runner.runOfficeRequested, true);
  assert.equal(runner.nativeAcceptance, false);
  assert.equal(runner.registryAcceptance, false);
  assert.ok(
    ['native-worker-pending', 'native-observation-completed; supervisor-review-required'].includes(
      runner.status,
    ),
    'Failed/pure-only attempt cannot count as native',
  );
  assert.deepEqual(runner.generation, binding.envelope.generation);
  assert.deepEqual(runner.controllerRepository, binding.envelope.controllerRepository);
  assert.ok(
    Number.isInteger(runner.timeoutSeconds) &&
      runner.timeoutSeconds >= 5 &&
      runner.timeoutSeconds <= 60,
  );
  const owned = (actual, relative) =>
    assert.equal(
      fs.realpathSync(plainLocalPath(actual)),
      fs.realpathSync(asset(directory, relative)),
      'Foreign identical-looking output path',
    );
  for (const [file, hash] of [
    ['execution-envelope.json', binding.envelopeSha256],
    ['inputs/case.pptx', digest(binding.input)],
    ['inputs/action-plan.json', digest(binding.plan)],
  ])
    assert.equal(fileIdentity(asset(directory, file)).sha256, hash);
  const report = readJson(asset(directory, 'native/report.json')),
    terminal = readJson(asset(directory, 'native/supervisor.json'));
  assertSevenLifecycle(report, terminal, digest(binding.input), binding.envelopeSha256);
  const stages = fs
    .readFileSync(asset(directory, 'native/stages.jsonl'), 'utf8')
    .replace(/^\uFEFF/u, '')
    .trim()
    .split(/\r?\n/u)
    .map((line) => JSON.parse(line.replace(/^\uFEFF/u, '')));
  assertSevenStages(report, stages);
  owned(report.sourcePath, 'inputs/case.pptx');
  owned(report.savedPath, 'native/saved.pptx');
  owned(report.workerPath, 'inputs/seven-chart-worker.ps1');
  assert.equal(
    report.workerSha256,
    fileIdentity(asset(directory, 'inputs/seven-chart-worker.ps1')).sha256,
  );
  assert.deepEqual(report.node, binding.envelope.node);
  assert.deepEqual(report.limits, SEVEN_LIMITS);
  assert.deepEqual(report.generation, binding.envelope.generation);
  assert.deepEqual(report.controllerRepository, binding.envelope.controllerRepository);
  owned(report.opens[0].path, 'inputs/case.pptx');
  owned(report.opens[1].path, 'native/saved.pptx');
  const saved = fs.readFileSync(asset(directory, 'native/saved.pptx'));
  assert.equal(digest(saved), report.savedSha256);
  const archive = inspectSevenArchive(saved),
    before = bindSevenPhase(binding.archive, report.phases.original),
    after = bindSevenPhase(archive, report.phases['saved-reopened']),
    findings = compareSevenBindings(before, after),
    pngs = [];
  for (const phase of ['original', 'saved-reopened'])
    for (const [index, record] of report.phases[phase].rasters.entries()) {
      assert.equal(record.slideIndex, index + 1);
      const relative = 'native/' + phase + '-' + String(index + 1).padStart(2, '0') + '.png';
      owned(record.path, relative);
      const png = fs.readFileSync(asset(directory, relative));
      assert.ok(
        png.length >= 33 &&
          png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
      );
      assert.equal(png.readUInt32BE(16), 1280);
      assert.equal(png.readUInt32BE(20), 720);
      assert.equal(digest(png), record.sha256);
      pngs.push({ phase, slide: index + 1, sha256: record.sha256 });
    }
  const req = createRequire(path.join(binding.envelope.generation.consumer, 'package.json'));
  const { pptx, gallery } = engines ?? {
    pptx: await import(pathToFileURL(req.resolve('@openpresentation/opf-pptx')).href),
    gallery: await import(pathToFileURL(req.resolve('@openpresentation/gallery')).href),
  };
  const imported = {};
  for (const [phase, bytes] of [
    ['original', binding.input],
    ['saved-reopened', saved],
  ]) {
    const diagnostics = [];
    const document = await pptx.fromPptx(bytes, {
      catalogs: [gallery],
      onDiagnostic: (d) => diagnostics.push(d),
    });
    assert.equal(document.slides.length, 7, 'Public import lost a slide');
    imported[phase] = { document, diagnostics };
  }
  findings.push(...compareSevenImports(binding.source.deck, imported));
  readSevenEnvelope(envelopeFile, expectedEnvelopeSha256, { root });
  return {
    schemaVersion: 1,
    profile: SEVEN_PROFILE,
    nativeAcceptance: false,
    registryAcceptance: false,
    envelopeSha256: binding.envelopeSha256,
    generation: binding.envelope.generation,
    controllerRepository: binding.envelope.controllerRepository,
    inputSha256: digest(binding.input),
    savedSha256: digest(saved),
    phases: 2,
    slidesPerPhase: 7,
    pngs,
    before,
    after,
    imported,
    findings,
    status: findings.length
      ? 'observations-bound; findings-require-review'
      : 'observations-bound; supervisor-review-required',
    scope:
      'Whole-file windowless read-only open/save/reopen,14rasters and offline cache/workbook/import facts; no content edits, repair-dialog, native editability, font/glyph or release acceptance.',
  };
}
function args(argv) {
  const [mode, ...rest] = argv,
    options = {};
  for (let i = 0; i < rest.length; i += 2) {
    assert.ok(
      /^--[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u.test(rest[i]) &&
        rest[i + 1] &&
        !rest[i + 1].startsWith('--'),
      'Malformed/missing option',
    );
    assert.ok(!Object.hasOwn(options, rest[i]), 'Duplicate option');
    options[rest[i]] = rest[i + 1];
  }
  return { mode, options };
}
function writeExclusive(file, value) {
  const full = plainLocalPath(file, { exists: false });
  assert.ok(!fs.existsSync(full), 'Fresh output required');
  fs.writeFileSync(full, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  return fileIdentity(full);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const { mode, options: o } = args(process.argv.slice(2));
  if (mode === 'create') {
    assert.deepEqual(
      Object.keys(o).sort(),
      [
        '--case',
        '--consumer',
        '--expected-manifest-sha256',
        '--output',
        '--preparation-repository',
        '--suite',
        '--worker-repository',
      ].sort(),
    );
    const e = createSevenEnvelope({
      suiteDirectory: o['--suite'],
      caseId: o['--case'],
      expectedManifestSha256: o['--expected-manifest-sha256'],
      preparationRepository: o['--preparation-repository'],
      workerRepository: o['--worker-repository'],
      consumer: o['--consumer'],
    });
    assertSevenOutput(o['--output'], e);
    console.log(
      JSON.stringify({
        profile: SEVEN_PROFILE,
        ...writeExclusive(o['--output'], e),
        nativeAcceptance: false,
      }),
    );
  } else if (mode === 'verify') {
    assert.deepEqual(Object.keys(o).sort(), ['--envelope', '--expected-envelope-sha256'].sort());
    const b = readSevenEnvelope(o['--envelope'], o['--expected-envelope-sha256']);
    console.log(
      JSON.stringify({
        profile: SEVEN_PROFILE,
        envelopeSha256: b.envelopeSha256,
        generation: b.envelope.generation,
        controllerRepository: b.envelope.controllerRepository,
        node: b.envelope.node,
        inputPath: asset(b.directory, b.selected.input),
        planPath: asset(b.directory, b.selected.actionPlan),
        archive: b.archive,
      }),
    );
  } else if (mode === 'verify-execution') {
    assert.deepEqual(
      Object.keys(o).sort(),
      ['--envelope', '--expected-envelope-sha256', '--output', '--require-office'].sort(),
    );
    assert.ok(['true', 'false'].includes(o['--require-office']));
    const b = validateSevenExecution({
      envelopeFile: o['--envelope'],
      expectedEnvelopeSha256: o['--expected-envelope-sha256'],
      output: o['--output'],
      requireOffice: o['--require-office'] === 'true',
    });
    console.log(
      JSON.stringify({
        profile: SEVEN_PROFILE,
        envelopeSha256: b.envelopeSha256,
        generation: b.envelope.generation,
        controllerRepository: b.envelope.controllerRepository,
        node: b.envelope.node,
        inputPath: asset(b.directory, 'inputs/case.pptx'),
        planPath: asset(b.directory, 'inputs/action-plan.json'),
        archive: b.archive,
        snapshots: b.snapshots,
        status: b.runner.status,
      }),
    );
  } else if (mode === 'observe') {
    assert.deepEqual(
      Object.keys(o).sort(),
      ['--envelope', '--expected-envelope-sha256', '--output'].sort(),
    );
    const result = await bindSevenObservation({
      envelopeFile: o['--envelope'],
      expectedEnvelopeSha256: o['--expected-envelope-sha256'],
      output: o['--output'],
    });
    writeExclusive(path.join(o['--output'], 'seven-chart-observation.json'), result);
    console.log(
      JSON.stringify({
        profile: SEVEN_PROFILE,
        status: result.status,
        nativeAcceptance: false,
        findings: result.findings.length,
      }),
    );
  } else
    throw Error('Use create, verify, verify-execution or observe; no Office calls in this module');
}
