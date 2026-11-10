// Dedicated whole-reference observation controller. No Office calls in this module.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { inspectReferenceArchive, bindReferenceWitnessPhase } from "./reference-chart-archive.mjs";
import { digest, fileIdentity, installedIdentity, repositoryIdentity } from "./identity.mjs";
import { assertReferenceRuntimeRoutes } from "./reference-runtime-routes.mjs";

export const REFERENCE_SUPERVISOR = {
  path: "test/native-process.ps1",
  bytes: 2341,
  sha256: "b9444de1367fe3a3aab654f4787b5aa9a1304dc38360159a45d1f9f420adf69c",
};
export const REFERENCE_PROFILE = "reference-chart-original-readonly-v1";
export const REFERENCE_CASES = [
  "reference-native-lines",
  "reference-native-axes",
  "reference-overlays-markers",
  "reference-singleton-axes",
];
export const REFERENCE_CONTROLLER_FILES = [
  "scripts/native-acceptance/reference-chart-profile.mjs",
  "scripts/native-acceptance/reference-chart-archive.mjs",
  "scripts/native-acceptance/reference-runtime-routes.mjs",
  "scripts/native-acceptance/run-reference-chart-profile.ps1",
  "scripts/native-acceptance/reference-chart-worker.ps1",
  "scripts/native-acceptance/identity.mjs",
  "scripts/native-acceptance/run-windows.ps1",
];
const controllerRoot = fileURLToPath(new URL("../../", import.meta.url));
const hasControl = (value) => [...value].some((char) => char.charCodeAt(0) < 32);
const hex = (value) => assert.match(value, /^[a-f0-9]{64}$/u, "Expected an explicit SHA256 digest");
const unique = (items, key, label) => {
  assert.ok(Array.isArray(items), label);
  const seen = new Set();
  for (const item of items) {
    const value = key(item);
    assert.equal(typeof value, "string", label);
    assert.ok(value.length && !seen.has(value.toLowerCase()), label);
    seen.add(value.toLowerCase());
  }
};
export function plainLocalPath(file, { exists = true } = {}) {
  assert.equal(typeof file, "string");
  assert.ok(
    path.isAbsolute(file) && !/^[/\\]{2}/u.test(file) && !hasControl(file),
    "Expected an absolute local non-UNC path",
  );
  const full = path.resolve(file);
  let cursor = full;
  for (;;) {
    try {
      assert.ok(!fs.lstatSync(cursor).isSymbolicLink(), "Reparse/symlink path refused");
    } catch (error) {
      if (error.code !== "ENOENT" || (exists && cursor === full)) throw error;
    }
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  return full;
}
function portable(relative) {
  assert.equal(typeof relative, "string");
  assert.ok(
    relative &&
      !path.isAbsolute(relative) &&
      !hasControl(relative) &&
      ![...relative].some((char) => '\\<>:"|?*'.includes(char)),
    "Invalid portable asset path",
  );
  for (const part of relative.split("/"))
    assert.ok(
      part && ![".", ".."].includes(part) && !/[. ]$/u.test(part),
      "Invalid portable asset segment",
    );
  return relative;
}
function asset(root, relative) {
  portable(relative);
  const full = plainLocalPath(path.resolve(root, relative));
  assert.ok(full.startsWith(path.resolve(root) + path.sep), "Asset escaped root");
  assert.ok(fs.lstatSync(full).isFile(), "Expected a regular asset");
  return full;
}
function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/u, ""));
}
function records(root, files) {
  assert.ok(
    Array.isArray(files) && files.length > 0 && files.length <= 1000,
    "Bounded nonempty file records required",
  );
  unique(files, (r) => r.path, "Duplicate file record");
  let total = 0;
  for (const record of files) {
    hex(record.sha256);
    assert.ok(
      Number.isSafeInteger(record.bytes) && record.bytes >= 0 && record.bytes <= 64 * 1024 * 1024,
      "Invalid file byte bound",
    );
    total += record.bytes;
    assert.ok(total <= 256 * 1024 * 1024, "256MiB aggregate bound");
    assert.deepEqual(
      fileIdentity(asset(root, record.path)),
      { bytes: record.bytes, sha256: record.sha256 },
      "Changed recorded asset " + record.path,
    );
  }
}
function boundRepository(root, expected, required = []) {
  plainLocalPath(root);
  assert.match(expected.revision, /^[a-f0-9]{40}$/u);
  assert.equal(expected.dirty, false, "Only reviewed clean repositories are eligible");
  records(root, expected.files);
  for (const file of required)
    assert.equal(
      expected.files.filter((r) => r.path === file).length,
      1,
      "Missing required code identity " + file,
    );
  const actual = repositoryIdentity(
    root,
    expected.files.map((r) => r.path),
  );
  assert.deepEqual(actual, expected, "Repository HEAD, dirty state or code identity changed");
  return actual;
}
function dependencies() {
  const local = createRequire(import.meta.url);
  const pptx = createRequire(local.resolve("@openpresentation/opf-pptx/package.json"));
  return { ...pptx("fflate"), ...pptx("fast-xml-parser") };
}

export const REFERENCE_LIMITS = {
  slides: 3,
  maxShapesPerSlide: 3,
  maxTotalShapes: 9,
  maxActions: 0,
  maxArchiveBytes: 16 * 1024 * 1024,
  maxZipEntries: 4096,
  maxTimeoutSeconds: 60,
};
export function assertReferenceWitnessSelection(suite, caseId, input, plan, deps) {
  assert.ok(
    REFERENCE_CASES.includes(caseId),
    "Select one of the four whole reference witness cases",
  );
  assert.equal(suite.schemaVersion, 1);
  assert.equal(suite.nativeAcceptance, false);
  assert.equal(suite.provenance.nativeAcceptance, false);
  assert.equal(suite.provenance.registryAcceptance, false);
  unique(suite.cases, (c) => c.id, "Case IDs");
  assert.deepEqual(
    suite.cases.map((c) => c.id),
    REFERENCE_CASES,
    "Exactly the four separate witness cases in authored order",
  );
  assert.equal(suite.fullSuite, false);
  assert.equal(suite.scope?.profile, REFERENCE_PROFILE);
  assert.equal(suite.scope?.fullSuite, false);
  const selected = suite.cases.find((c) => c.id === caseId);
  assert.ok(selected, "Selected whole case missing");
  assert.equal(selected.automaticControlEligible, false, "Generic eligibility must stay false");
  assert.equal(selected.slideCount, 3);
  assert.equal(selected.worker, "furniture");
  assert.equal(selected.archiveSha256, digest(input));
  assert.deepEqual(
    JSON.parse(
      Buffer.from(plan)
        .toString("utf8")
        .replace(/^\uFEFF/u, ""),
    ),
    [],
    "ReferenceWitness profile permits zero actions",
  );
  const archive = inspectReferenceArchive(input, deps);
  return { selected, archive };
}
function sourceBinding(generation, suite, selected) {
  assert.equal(
    typeof selected.source,
    "string",
    "Reference witnesses require sealed authored source, never legacy inference",
  );
  assert.equal(
    suite.files.filter((f) => f.path === selected.source).length,
    1,
    "Sealed OPF source must be recorded",
  );
  const file = asset(generation.suiteDirectory, selected.source),
    source = readJson(file);
  assert.equal(source.slides.length, 3, "Exactly three authored slides");
  assert.equal(source.design?.fontScheme, "roboto", "Pinned authored open-font role");
  for (const slide of source.slides)
    assert.ok(slide.chart?.data?.columns && slide.chart.data.rows, "Whole authored chart required");
  assert.equal(typeof selected.sourceSha256, "string");
  assert.equal(fileIdentity(file).sha256, selected.sourceSha256, "Authored source digest differs");
  return { identity: { path: file, ...fileIdentity(file) }, deck: source };
}
function suiteBinding(generation, deps) {
  const directory = plainLocalPath(generation.suiteDirectory),
    bytes = fs.readFileSync(asset(directory, "suite.json"));
  hex(generation.manifestSha256);
  assert.equal(digest(bytes), generation.manifestSha256, "Suite manifest digest changed");
  const suite = JSON.parse(bytes);
  records(directory, suite.files);
  assert.deepEqual(suite.provenance, generation.provenance, "Generation provenance changed");
  const selected = suite.cases.find((c) => c.id === generation.caseId);
  assert.ok(selected, "Missing selected case");
  for (const key of ["input", "actionPlan"])
    assert.equal(
      suite.files.filter((f) => f.path === selected[key]).length,
      1,
      "Unrecorded selected asset",
    );
  const input = fs.readFileSync(asset(directory, selected.input)),
    plan = fs.readFileSync(asset(directory, selected.actionPlan));
  const checked = assertReferenceWitnessSelection(suite, generation.caseId, input, plan, deps);
  assert.deepEqual(selected, generation.selectedCase);
  const source = sourceBinding(generation, suite, selected);
  assertReferenceWitnessSource(checked.archive, source.deck);
  return { suite, directory, input, plan, source, ...checked };
}
export function validateReferenceWitnessEnvelope(
  envelope,
  { root = controllerRoot, deps = dependencies() } = {},
) {
  assert.equal(envelope.schemaVersion, 1);
  assert.equal(envelope.profile, REFERENCE_PROFILE);
  assert.equal(envelope.fullSuite, false);
  assert.equal(envelope.automaticControlEligible, false);
  assert.equal(envelope.nativeAcceptance, false);
  assert.equal(envelope.registryAcceptance, false);
  assert.deepEqual(envelope.limits, REFERENCE_LIMITS);
  assert.deepEqual(envelope.phases, ["original", "saved-reopened"]);
  const binding = suiteBinding(envelope.generation, deps);
  const supervisors = binding.suite.provenance.workerRepository.files.filter(
    (f) => f.path === REFERENCE_SUPERVISOR.path,
  );
  assert.equal(supervisors.length, 1, "Missing original supervisor");
  assert.deepEqual(
    supervisors[0],
    REFERENCE_SUPERVISOR,
    "The reference profile requires the unchanged ce92 supervisor",
  );
  boundRepository(
    envelope.generation.preparationRepository,
    binding.suite.provenance.suiteRepository,
    ["scripts/native-acceptance/run-windows.ps1"],
  );
  boundRepository(envelope.generation.workerRepository, binding.suite.provenance.workerRepository, [
    "test/native-process.ps1",
    "test/native-process-check.ps1",
  ]);
  assert.deepEqual(
    installedIdentity(envelope.generation.consumer),
    binding.suite.provenance.packages,
    "Original runtime changed",
  );
  boundRepository(root, envelope.controllerRepository, REFERENCE_CONTROLLER_FILES);
  const runtimeRoutes = assertReferenceRuntimeRoutes(envelope.generation.consumer, binding.suite.provenance.runtimeRoutes);
  assert.equal(envelope.controllerRepository.directory, fs.realpathSync(root));
  assert.notEqual(
    envelope.controllerRepository.directory,
    binding.suite.provenance.suiteRepository.directory,
    "New controller must not impersonate generation",
  );
  assert.deepEqual(fileIdentity(plainLocalPath(envelope.node.path)), envelope.node.identity);
  assert.equal(envelope.node.path, process.execPath);
  assert.equal(envelope.node.version, process.version);
  assert.match(process.version, /^v24\./u);
  assert.deepEqual(envelope.archive, binding.archive);
  assert.deepEqual(envelope.source, binding.source);
  return { ...binding, envelope, runtimeRoutes };
}
export function createReferenceWitnessEnvelope({
  suiteDirectory,
  expectedManifestSha256,
  caseId,
  preparationRepository,
  workerRepository,
  consumer,
  root = controllerRoot,
}) {
  hex(expectedManifestSha256);
  const bytes = fs.readFileSync(asset(plainLocalPath(suiteDirectory), "suite.json"));
  assert.equal(digest(bytes), expectedManifestSha256, "Expected suite digest differs");
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
  const controllerRepository = repositoryIdentity(root, REFERENCE_CONTROLLER_FILES);
  assert.equal(controllerRepository.dirty, false, "Freeze controller before envelope creation");
  const binding = suiteBinding(generation, dependencies()),
    envelope = {
      schemaVersion: 1,
      profile: REFERENCE_PROFILE,
      fullSuite: false,
      automaticControlEligible: false,
      nativeAcceptance: false,
      registryAcceptance: false,
      generation,
      controllerRepository,
      node: {
        path: process.execPath,
        version: process.version,
        identity: fileIdentity(process.execPath),
      },
      limits: REFERENCE_LIMITS,
      phases: ["original", "saved-reopened"],
      archive: binding.archive,
      source: binding.source,
    };
  validateReferenceWitnessEnvelope(envelope, { root });
  return envelope;
}
export function readReferenceWitnessEnvelope(file, expectedSha256, options) {
  hex(expectedSha256);
  const bytes = fs.readFileSync(plainLocalPath(file));
  assert.ok(bytes.length <= 4 * 1024 * 1024, "Bounded envelope");
  assert.equal(digest(bytes), expectedSha256, "Envelope digest changed");
  return {
    ...validateReferenceWitnessEnvelope(JSON.parse(bytes), options),
    envelopeSha256: digest(bytes),
  };
}
export function assertReferenceWitnessOutput(directory, envelope, envelopeFile) {
  const full = plainLocalPath(directory, { exists: false }),
    key = (value) => path.resolve(value).replaceAll("\\", "/").toLowerCase(),
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
        !candidate.startsWith(protectedPath + "/") &&
        !protectedPath.startsWith(candidate + "/"),
      "Output overlaps immutable input/source/runtime",
    );
  }
  return full;
}
export function validateReferenceWitnessExecution({
  envelopeFile,
  expectedEnvelopeSha256,
  output,
  requireOffice = false,
  root = controllerRoot,
  deps = dependencies(),
}) {
  const binding = readReferenceWitnessEnvelope(envelopeFile, expectedEnvelopeSha256, {
      root,
      deps,
    }),
    directory = assertReferenceWitnessOutput(output, binding.envelope),
    snapshotEnvelope = asset(directory, "execution-envelope.json");
  const envelopePath = fs.realpathSync(plainLocalPath(envelopeFile));
  if (envelopePath !== fs.realpathSync(snapshotEnvelope))
    assertReferenceWitnessOutput(output, binding.envelope, envelopeFile);
  const runner = readJson(asset(directory, "runner.json"));
  assert.equal(runner.schemaVersion, 1);
  assert.equal(runner.profile, REFERENCE_PROFILE);
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
  assert.deepEqual(runner.limits, REFERENCE_LIMITS);
  assert.ok(
    requireOffice
      ? [
          "native-worker-pending",
          "native-observation-completed; supervisor-review-required",
        ].includes(runner.status)
      : runner.status === "pure-checks-completed; native-not-run",
    "Unexpected execution authorization/status",
  );
  const one = (entries, name) => {
    const matches = entries.filter((r) => r.path === name);
    assert.equal(matches.length, 1, "Missing snapshot source " + name);
    return matches[0];
  };
  const worker = one(
    binding.envelope.controllerRepository.files,
    "scripts/native-acceptance/reference-chart-worker.ps1",
  );
  const expected = [
    { path: "execution-envelope.json", ...fileIdentity(envelopePath) },
    { path: "inputs/case.pptx", bytes: binding.input.length, sha256: digest(binding.input) },
    { path: "inputs/action-plan.json", bytes: binding.plan.length, sha256: digest(binding.plan) },
    { path: "inputs/reference-chart-worker.ps1", bytes: worker.bytes, sha256: worker.sha256 },
    { ...REFERENCE_SUPERVISOR, path: "inputs/native-process.ps1" },
  ];
  assert.deepEqual(
    [...runner.snapshots].sort((a, b) => a.path.localeCompare(b.path)),
    expected.sort((a, b) => a.path.localeCompare(b.path)),
    "Owned snapshots must bind the exact input, code and unchanged supervisor",
  );
  records(directory, runner.snapshots);
  assert.equal(fileIdentity(snapshotEnvelope).sha256, binding.envelopeSha256);
  return { ...binding, directory, runner, snapshots: expected };
}

// A separate read-only shutdown observation; never a retry or additional worker budget.
export function assertReferenceWitnessPostflight(terminal, samples) {
  assert.equal(terminal.workerCleanupConfirmed, true);
  assert.equal(terminal.postflightError, null);
  const result = terminal.postflight;
  assert.equal(result.schemaVersion, 1);
  assert.equal(result.policy, 'global-zero-after-completed-owned-quit-v1');
  assert.equal(result.budgetMilliseconds, 5000);
  assert.equal(result.intervalMilliseconds, 100);
  assert.equal(result.maximumQueries, 51);
  assert.equal(result.observedZero, true);
  assert.equal(result.officeActions, 0);
  assert.ok(Array.isArray(samples) && samples.length >= 1 && samples.length <= 51);
  assert.equal(result.sampleCount, samples.length);
  const initial = samples[0].processIds;
  assert.ok(Array.isArray(initial));
  let previous = -1;
  for (const [index, row] of samples.entries()) {
    assert.equal(row.schemaVersion, 1);
    assert.equal(row.sequence, index + 1);
    assert.equal(row.status, 'observed');
    assert.equal(row.error, null);
    assert.ok(typeof row.utc === 'string' && row.utc.endsWith('Z') && Number.isFinite(Date.parse(row.utc)));
    assert.ok(Number.isFinite(row.elapsedMilliseconds) && row.elapsedMilliseconds >= 0 && row.elapsedMilliseconds >= previous && row.elapsedMilliseconds < 5000);
    previous = row.elapsedMilliseconds;
    assert.ok(Array.isArray(row.processIds));
    for (const [i, pid] of row.processIds.entries()) {
      assert.ok(Number.isInteger(pid) && pid > 0 && pid <= 2147483647);
      assert.ok(i === 0 || pid > row.processIds[i - 1]);
      assert.ok(initial.includes(pid), 'A new global process was observed');
    }
    assert.equal(row.processIds.length === 0, index === samples.length - 1, 'A zero ends the observation immediately');
  }
  assert.deepEqual(result.initialProcessIds, initial);
  assert.equal(result.initialCount, initial.length);
  assert.deepEqual(result.finalProcessIds, []);
  assert.equal(result.finalCount, 0);
  assert.equal(result.elapsedMilliseconds, previous);
  assert.ok(Number.isFinite(result.finishedElapsedMilliseconds) && result.finishedElapsedMilliseconds >= previous && result.finishedElapsedMilliseconds < 5000);

  assert.equal(terminal.powerPointPostflightInitialCount, initial.length);
  assert.equal(terminal.powerPointPostflightCount, 0);
  return true;
}

export function assertReferenceWitnessLifecycle(report, terminal, inputSha256, envelopeSha256) {
  assert.equal(terminal.timedOut, false);
  assert.equal(terminal.exitCode, 0);
  assert.equal(terminal.cleanupConfirmed, true);
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.profile, REFERENCE_PROFILE);
  assert.equal(report.envelopeSha256, envelopeSha256);
  assert.equal(report.sourceSha256, inputSha256);
  assert.equal(report.cleanupConfirmed, true);
  assert.equal(report.officeOperationsStopped, false);
  assert.equal(report.error, null);
  assert.equal(report.lastStage, "worker.complete");
  assert.equal(report.lastStatus, "success");
  assert.deepEqual(report.actions, []);
  assert.deepEqual(
    report.opens.map((x) => [x.phase, x.readOnly]),
    [
      ["original", -1],
      ["saved-reopened", -1],
    ],
  );
  assert.equal(report.closes, 2);
  assert.equal(report.saveCopies, 1);
  assert.equal(report.quits, 1);
  assert.deepEqual(Object.keys(report.phases), ["original", "saved-reopened"]);
  for (const phase of Object.values(report.phases)) {
    assert.equal(phase.slideCount, 3);
    assert.equal(phase.slides.length, 3);
    assert.equal(phase.rasters.length, 3);
  }
  return true;
}
export function assertReferenceWitnessStages(report, stages) {
  const names = [
    "worker.initialize",
    "application.create",
    "application.initial.presentations",
    "application.initial.count",
    "application.version",
    "application.path",
  ];
  for (const phase of ["original", "saved-reopened"]) {
    names.push(
      phase + ".preflight.presentations",
      phase + ".preflight.count",
      phase + ".open",
      phase + ".fullName",
      phase + ".readOnly",
      phase + ".slides",
      phase + ".slides.count",
    );
    for (let i = 1; i <= 3; i++) {
      names.push(
        phase + ".slide." + i + ".get",
        phase + ".slide." + i + ".id",
        phase + ".slide." + i + ".name",
        phase + ".slide." + i + ".shapes",
        phase + ".slide." + i + ".shapes.count",
      );
      const slide = report.phases[phase].slides[i - 1];
      for (let j = 1; j <= slide.shapeCount; j++) {
        const base = phase + ".slide." + i + ".shape." + j;
        names.push(
          base + ".get",
          ...[
            "id",
            "name",
            "type",
            "left",
            "top",
            "width",
            "height",
            "rotation",
            "hasTextFrame",
            "alternativeText",
          ].map((p) => base + "." + p),
        );
        if (slide.shapes[j - 1].hasTextFrame === -1)
          names.push(base + ".textFrame", base + ".textRange", base + ".text");
      }
      names.push(phase + ".slide." + i + ".export");
    }
    if (phase === "original") names.push("copy.fullName", "copy.saveCopyAs", "copy.afterName");
    names.push(phase + ".close.fullName", phase + ".close.discard", phase + ".close");
  }
  names.push(
    "application.final.presentations",
    "application.final.count",
    "application.quit",
    "worker.complete",
  );
  const expected = names.flatMap((stage) =>
    stage.startsWith("worker.")
      ? [{ stage, status: "success" }]
      : [
          { stage, status: "begin" },
          { stage, status: "success" },
        ],
  );
  assert.equal(stages.length, expected.length, "Missing or extra reference Office stage");
  stages.forEach((s, i) => {
    assert.equal(s.sequence, i + 1, "Noncontiguous reference stage journal");
    assert.equal(s.stage, expected[i].stage);
    assert.equal(s.status, expected[i].status);
    assert.equal(s.officeOperationsStopped, false);
    assert.equal(typeof s.timestamp, "string");
    assert.ok(Number.isFinite(Date.parse(s.timestamp)));
  });
  assert.ok(
    Array.isArray(report.probes) && report.probes.length > 0,
    "Primitive probes must be retained",
  );
  for (const probe of report.probes) assert.equal(probe.matched, true, "A native probe refused");
  return true;
}
function semanticChart(chart) {
  const copy = structuredClone(chart);
  if (copy.workbook) delete copy.workbook.part;
  return copy;
}
export function compareReferenceWitnessBindings(before, after) {
  const findings = [];
  for (let i = 0; i < 3; i++) {
    const a = before[i].shapes.find((s) => s.kind === "chart"),
      b = after[i].shapes.find((s) => s.kind === "chart");
    if (
      !isDeepStrictEqual(
        before[i].shapes.map((s) => ({
          id: s.id,
          name: s.name,
          kind: s.kind,
          geometry: s.geometry,
        })),
        after[i].shapes.map((s) => ({
          id: s.id,
          name: s.name,
          kind: s.kind,
          geometry: s.geometry,
        })),
      )
    )
      findings.push({
        slide: i + 1,
        code: "native-geometry-or-shape-topology-changed",
        before: before[i].shapes,
        after: after[i].shapes,
      });
    if (a.uri !== b.uri)
      findings.push({
        slide: i + 1,
        code: "exposed-chart-family-changed",
        before: a.uri,
        after: b.uri,
      });
    const aDrawings = before[i].shapes
        .filter((s) => s.kind !== "chart")
        .map((s) => ({ id: s.id, name: s.name, kind: s.kind, text: s.text, paint: s.paint })),
      bDrawings = after[i].shapes
        .filter((s) => s.kind !== "chart")
        .map((s) => ({ id: s.id, name: s.name, kind: s.kind, text: s.text, paint: s.paint }));
    if (!isDeepStrictEqual(aDrawings, bDrawings))
      findings.push({
        slide: i + 1,
        code: "visible-reference-or-title-paint-changed",
        before: aDrawings,
        after: bDrawings,
      });
    if (!isDeepStrictEqual(semanticChart(a.chart), semanticChart(b.chart)))
      findings.push({
        slide: i + 1,
        code: "exposed-cache-or-workbook-changed",
        before: a.chart,
        after: b.chart,
      });
  }
  return findings;
}
export function assertReferenceWitnessTitles(archive, source) {
  assert.equal(source.slides.length, 3);
  archive.slides.forEach((slide, i) => {
    const expected = [source.slides[i].title, source.slides[i].subtitle].filter(
      (v) => v !== undefined,
    );
    const visible = slide.shapes.filter((s) => s.kind === "text").map((s) => s.text);
    // Overlay labels are additional visible text; authored title/subtitle must each appear exactly once.
    for (const value of expected)
      assert.equal(
        visible.filter((v) => v === value).length,
        1,
        "Source title/subtitle/order mismatch",
      );
    const count = source.slides[i].chart.referenceLines?.length ?? 0,
      chart = slide.shapes.find((s) => s.kind === "chart").chart;
    assert.equal(
      (chart.ownership?.helpers.length ?? 0) + (chart.ownership?.overlays.length ?? 0),
      count,
      "Only explicit references may own chart furniture",
    );
  });
  return true;
}
const list = (value) => (value === undefined ? [] : Array.isArray(value) ? value : [value]);
const richText = (node) =>
  node && typeof node === "object"
    ? Object.entries(node)
        .map(([key, value]) =>
          key === "a:t"
            ? typeof value === "object"
              ? String(value["#text"] ?? "")
              : String(value)
            : Array.isArray(value)
              ? value.map(richText).join("")
              : richText(value),
        )
        .join("")
    : "";
export function assertReferenceWitnessSource(archive, source) {
  assertReferenceWitnessTitles(archive, source);
  archive.slides.forEach((slide, i) => {
    const wanted = source.slides[i].chart,
      chart = slide.shapes.find((s) => s.kind === "chart").chart,
      all = chart.groups.flatMap((group) => group.series.map((series) => ({ group, series }))),
      ordinary = all.filter((x) => !x.series.owner),
      refs = wanted.referenceLines ?? [];
    const names = wanted.data.columns.slice(1).map((c) => (typeof c === "string" ? c : c.name));
    assert.equal(
      ordinary.length,
      names.length,
      "Unintended helper/data series or dropped ordinary series",
    );
    ordinary.forEach(({ series, group }, j) => {
      assert.deepEqual(
        series["c:tx"].values ?? [series["c:tx"].value],
        [names[j]],
        "Ordinary series names/order differ",
      );
      assert.deepEqual(
        series["c:cat"].values,
        wanted.data.rows.map((r) => String(r[0])),
        "Ordinary category labels/order differ",
      );
      assert.deepEqual(
        series["c:val"].values,
        wanted.data.rows.map((r) => r[j + 1]),
        "Ordinary numeric values/order differ",
      );
      const line =
        wanted.type === "line" ||
        wanted.type === "line-with-markers" ||
        (wanted.type === "combo" && wanted.line?.includes(names[j]));
      assert.equal(
        group.construct,
        line ? "c:lineChart" : wanted.type === "area" ? "c:areaChart" : "c:barChart",
        "Ordinary chart representation differs",
      );
      if (group.construct === "c:barChart")
        assert.equal(group.direction, wanted.type === "bar" ? "bar" : "col");
      if (wanted.type === "line")
        assert.equal(
          series.paint?.["a:ln"]?.["a:prstDash"]?.val ?? "solid",
          "solid",
          "Ordinary data line must stay solid independently of helpers",
        );
    });
    const native = wanted.type !== "bar" && wanted.data.rows.length >= 2;
    assert.equal(
      chart.ownership?.helpers.length ?? 0,
      native ? refs.length : 0,
      "Native-vs-overlay reference eligibility differs",
    );
    assert.equal(chart.ownership?.overlays.length ?? 0, native ? 0 : refs.length);
    for (let j = 0; j < refs.length; j++) {
      const ref = refs[j],
        owned = native
          ? chart.ownership.helpers.find((x) => x.index === j)
          : chart.ownership.overlays.find((x) => x.index === j);
      assert.ok(owned, "Missing exact reference index");
      if (native) {
        const candidates = all.filter((x) => x.series.owner?.id === owned.id);
        assert.equal(candidates.length, 1, "Missing/duplicate helper series");
        const { series, group } = candidates[0];
        assert.deepEqual(
          series["c:val"].values,
          wanted.data.rows.map(() => ref.value),
          "Explicit raw reference values differ",
        );
        assert.deepEqual(
          series["c:cat"].values,
          wanted.data.rows.map((r) => String(r[0])),
          "Helper category span differs",
        );
        assert.equal(group.construct, "c:lineChart");
        assert.ok([null, "standard"].includes(group.grouping), "Helper grouping must be standard");
        const associated =
          ordinary.find(
            (x) =>
              (wanted.type === "combo" &&
                wanted.secondaryAxis?.includes(x.series["c:tx"].values?.[0])) ===
              (ref.axis === "secondary"),
          ) ?? ordinary[0];
        assert.deepEqual(
          group.axes,
          associated.group.axes,
          "Reference must share the selected ordinary numeric/category axes",
        );
        assert.equal(series.paint?.["a:ln"]?.["a:prstDash"]?.val, ref.stroke?.dash ?? "dash");
        const stroke = series.paint?.["a:ln"],
          scale = Math.min(archive.canvas.cx, archive.canvas.cy) / 6858000;
        assert.equal(
          Number(stroke?.w),
          Math.round((ref.stroke?.width ?? 4 / 3) * scale * 9525),
          "Explicit/default line width differs",
        );
        if (ref.stroke?.color !== undefined)
          assert.equal(
            stroke?.["a:solidFill"]?.["a:srgbClr"]?.val,
            String(ref.stroke.color).slice(1).toUpperCase(),
            "Literal reference color differs",
          );
        const valueAxis = chart.axes.find((a) => a.kind === "c:valAx" && group.axes.includes(a.id));
        assert.ok(valueAxis, "Reference numeric axis missing");
        assert.ok(
          Number(valueAxis.scaling?.["c:min"]?.val) <= ref.value &&
            Number(valueAxis.scaling?.["c:max"]?.val) >= ref.value,
          "Explicit reference is outside written automatic bounds",
        );
        const labels = list(series.labels?.["c:dLbl"]);
        assert.equal(
          labels.length,
          ref.label === undefined ? 0 : 1,
          "Optional label count differs",
        );
        if (ref.label !== undefined) {
          assert.equal(
            String(labels[0]["c:idx"]?.val),
            String(ref.labelPosition === "start" ? 0 : wanted.data.rows.length - 1),
            "Label endpoint differs",
          );
          assert.equal(richText(labels[0]["c:tx"]), ref.label, "Verbatim native label differs");
        }
      } else {
        assert.equal(owned.value, ref.value, "Bound overlay authored value differs");
        assert.equal(owned.axis, ref.axis ?? "value");
        assert.equal(owned.labelPosition, ref.labelPosition ?? "end");
        if (wanted.type === 'combo' && wanted.secondaryAxis?.length) {
          const associated = ordinary.find(x => wanted.secondaryAxis.includes(x.series['c:tx'].values?.[0]) === (ref.axis === 'secondary'));
          assert.ok(associated, 'Singleton overlay ordinary axis association missing');
          assert.equal(associated.group.axes.length, 2, 'Singleton overlay needs exactly one category/value pair');
          const axes = associated.group.axes.map(id => chart.axes.find(a => a.id === id)),
            category = axes.find(a => a?.kind === 'c:catAx'), value = axes.find(a => a?.kind === 'c:valAx');
          assert.ok(category && value, 'Singleton overlay category/value pair missing');
          assert.equal(category.cross, value.id, 'Singleton category/value pair is not reciprocal');
          assert.equal(value.cross, category.id, 'Singleton value/category pair is not reciprocal');
          assert.deepEqual(Object.keys(owned.axisIds ?? {}).sort(), ['category','value'], 'Explicit singleton axis IDs missing');
          for (const [key, axis] of [['category',category],['value',value]]) {
            assert.ok(Number.isInteger(owned.axisIds[key]) && owned.axisIds[key] >= 0 && owned.axisIds[key] <= 4294967295, 'Singleton axis ID must be uint32');
            assert.equal(String(owned.axisIds[key]), axis.id, 'Singleton overlay selected the wrong current native axis');
          }
          assert.ok(Number(value.scaling?.['c:min']?.val) <= ref.value && Number(value.scaling?.['c:max']?.val) >= ref.value, 'Singleton explicit value is outside its own written bounds');
        }
        assert.equal(
          slide.shapes.filter((x) => x.name === owned.id + " line").length,
          1,
          "Bound overlay line missing/duplicate",
        );
        assert.equal(
          slide.shapes.filter((x) => x.name === owned.id + " label" && x.text === ref.label).length,
          ref.label === undefined ? 0 : 1,
          "Bound overlay label missing/duplicate",
        );
      }
    }
  });
  return true;
}
const chartOf = (slide) => slide.chart ?? slide.blocks?.find((b) => b.chart)?.chart;
export function compareReferenceWitnessImports(source, imported, sourceCanvas, resolveChartData) {
  assert.ok(
    sourceCanvas && ["cx", "cy"].every((key) => Number.isSafeInteger(sourceCanvas[key]) && sourceCanvas[key] > 0),
    "Explicit verified source canvas is required",
  );
  assert.equal(typeof resolveChartData, "function", "Explicit bound core.resolveChartData is required");
  // Callers supply the validated ORIGINAL source archive canvas, never observed line paint or saved geometry.
  const scale = Math.min(sourceCanvas.cx, sourceCanvas.cy) / 6858000;
  const findings = [];
  for (const phase of ["original", "saved-reopened"]) {
    const result = imported[phase];
    assert.equal(result.document.slides.length, 3, "Public import lost a slide");
    assert.ok(Array.isArray(result.diagnostics), "Retain all import diagnostics");
    for (let i = 0; i < 3; i++) {
      const wanted = source.slides[i].chart,
        slide = result.document.slides[i],
        actual = chartOf(slide),
        refs = actual?.referenceLines ?? [],
        expected = wanted.referenceLines ?? [];
      if (!isDeepStrictEqual(actual?.data, wanted.data))
        findings.push({
          phase,
          slide: i + 1,
          code: "import-authored-data-differs",
          source: wanted.data,
          actual: actual?.data,
        });
      if (wanted.type === "combo") {
        // The public importer elides a redundant last-series line list. Core alone owns those defaults.
        // Compare its full named/ordered data-role-axis model, including validity and diagnostics.
        const sourcePlan = resolveChartData(wanted), actualPlan = resolveChartData(actual);
        if (sourcePlan?.ok !== true || actualPlan?.ok !== true || !isDeepStrictEqual(sourcePlan, actualPlan))
          findings.push({phase, slide:i+1, code:"import-combo-axis-association-differs",
            source:sourcePlan, actual:actualPlan});
      }
      if (actual?.type !== wanted.type)
        findings.push({
          phase,
          slide: i + 1,
          code: "import-chart-type-differs",
          source: wanted.type,
          actual: actual?.type,
        });
      if (refs.length !== expected.length)
        findings.push({
          phase,
          slide: i + 1,
          code: "import-reference-count-differs",
          source: expected,
          actual: refs,
        });
      for (let j = 0; j < Math.min(refs.length, expected.length); j++) {
        const a = refs[j],
          w = expected[j],
          width = w.stroke?.width ?? 4 / 3,
          canonicalWidth = Number.isFinite(width) && width >= 0 && width <= 64
            ? Math.min(64, Math.round((width * scale) * 9525) / (9525 * scale))
            : Number.NaN,
          mismatch =
            a.value !== w.value ||
            (a.axis ?? "value") !== (w.axis ?? "value") ||
            a.label !== w.label ||
            (w.label !== undefined && (a.labelPosition ?? "end") !== (w.labelPosition ?? "end")) ||
            a.stroke?.width !== canonicalWidth ||
            a.stroke?.dash !== (w.stroke?.dash ?? "dash") ||
            (w.stroke?.color !== undefined &&
              String(a.stroke?.color).toUpperCase() !== String(w.stroke.color).toUpperCase());
        if (mismatch)
          findings.push({
            phase,
            slide: i + 1,
            reference: j,
            code: "import-reference-value-label-style-differs",
            source: w,
            actual: a,
          });
      }
      if ((slide.shapes?.length ?? 0) !== 0)
        findings.push({
          phase,
          slide: i + 1,
          code: "import-visible-overlay-or-duplicate-remains",
          actual: slide.shapes,
        });
      const charts = [
        ...(slide.chart ? [slide.chart] : []),
        ...(slide.blocks ?? []).filter((b) => b.chart).map((b) => b.chart),
      ];
      if (charts.length !== 1)
        findings.push({
          phase,
          slide: i + 1,
          code: "import-chart-topology-differs",
          chartCount: charts.length,
        });
    }
  }
  if (!isDeepStrictEqual(imported.original.document, imported["saved-reopened"].document))
    findings.push({
      code: "saved-public-import-differs",
      scope:
        "Both full documents retained; no generated helper data, duplicate visible shape or adaptation is waived.",
    });
  if (!isDeepStrictEqual(imported.original.diagnostics, imported["saved-reopened"].diagnostics))
    findings.push({ code: "saved-public-import-diagnostics-differ" });
  return findings;
}
export async function importReferenceWitnessPublic(bytes, { consumer, engines } = {}) {
  const req = engines ? null : createRequire(path.join(consumer, "package.json"));
  const { pptx, gallery } = engines ?? {
    pptx: await import(pathToFileURL(req.resolve("@openpresentation/opf-pptx")).href),
    gallery: (await import(pathToFileURL(req.resolve("@openpresentation/gallery")).href)).gallery,
  };
  assert.equal(typeof pptx?.fromPptx, "function", "Missing bound public PPTX import");
  assert.equal(
    typeof gallery?.source,
    "string",
    "Use the named registered Gallery catalog, not its module namespace",
  );
  const diagnostics = [];
  const document = await pptx.fromPptx(bytes, {
    catalogs: [gallery],
    onDiagnostic: (d) => diagnostics.push(d),
  });
  assert.equal(document.slides.length, 3, "Public import lost a slide");
  return { document, diagnostics };
}
export async function bindReferenceWitnessObservation({
  envelopeFile,
  expectedEnvelopeSha256,
  output,
  root = controllerRoot,
  engines,
}) {
  const binding = validateReferenceWitnessExecution({
      envelopeFile,
      expectedEnvelopeSha256,
      output,
      requireOffice: true,
      root,
    }),
    directory = binding.directory,
    runner = binding.runner;
  assert.equal(runner.profile, REFERENCE_PROFILE);
  assert.equal(runner.envelopeSha256, binding.envelopeSha256);
  assert.equal(runner.runOfficeRequested, true);
  assert.equal(runner.nativeAcceptance, false);
  assert.equal(runner.registryAcceptance, false);
  assert.ok(
    ["native-worker-pending", "native-observation-completed; supervisor-review-required"].includes(
      runner.status,
    ),
    "Failed/pure-only attempt cannot count as native",
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
      "Foreign identical-looking output path",
    );
  for (const [file, hash] of [
    ["execution-envelope.json", binding.envelopeSha256],
    ["inputs/case.pptx", digest(binding.input)],
    ["inputs/action-plan.json", digest(binding.plan)],
  ])
    assert.equal(fileIdentity(asset(directory, file)).sha256, hash);
  const report = readJson(asset(directory, "native/report.json")),
    terminal = readJson(asset(directory, "native/supervisor.json"));
  assertReferenceWitnessLifecycle(report, terminal, digest(binding.input), binding.envelopeSha256);
  assert.equal(terminal.postflightIdentity?.path, 'native/postflight.jsonl');
  const postflightBytes = fs.readFileSync(asset(directory, 'native/postflight.jsonl'));
  assert.ok(postflightBytes.length > 0 && postflightBytes.length <= 65536);
  assert.equal(postflightBytes.length, terminal.postflightIdentity.bytes);
  assert.equal(digest(postflightBytes), terminal.postflightIdentity.sha256);
  const postflightSamples = postflightBytes.toString('utf8').trim().split(/\r?\n/u).map(line => JSON.parse(line));
  assertReferenceWitnessPostflight(terminal, postflightSamples);

  const stages = fs
    .readFileSync(asset(directory, "native/stages.jsonl"), "utf8")
    .replace(/^\uFEFF/u, "")
    .trim()
    .split(/\r?\n/u)
    .map((line) => JSON.parse(line.replace(/^\uFEFF/u, "")));
  assertReferenceWitnessStages(report, stages);
  owned(report.sourcePath, "inputs/case.pptx");
  owned(report.savedPath, "native/saved.pptx");
  owned(report.workerPath, "inputs/reference-chart-worker.ps1");
  assert.equal(
    report.workerSha256,
    fileIdentity(asset(directory, "inputs/reference-chart-worker.ps1")).sha256,
  );
  assert.deepEqual(report.node, binding.envelope.node);
  assert.deepEqual(report.limits, REFERENCE_LIMITS);
  assert.deepEqual(report.generation, binding.envelope.generation);
  assert.deepEqual(report.controllerRepository, binding.envelope.controllerRepository);
  owned(report.opens[0].path, "inputs/case.pptx");
  owned(report.opens[1].path, "native/saved.pptx");
  const saved = fs.readFileSync(asset(directory, "native/saved.pptx"));
  assert.equal(digest(saved), report.savedSha256);
  const archive = inspectReferenceArchive(saved),
    before = bindReferenceWitnessPhase(binding.archive, report.phases.original),
    after = bindReferenceWitnessPhase(archive, report.phases["saved-reopened"]),
    findings = compareReferenceWitnessBindings(before, after),
    pngs = [];
  for (const phase of ["original", "saved-reopened"])
    for (const [index, record] of report.phases[phase].rasters.entries()) {
      assert.equal(record.slideIndex, index + 1);
      const relative = "native/" + phase + "-" + String(index + 1).padStart(2, "0") + ".png";
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
  const core = engines ? engines.core : await import(pathToFileURL(
    createRequire(path.join(binding.envelope.generation.consumer, "package.json")).resolve("@openpresentation/opf"),
  ).href);
  assert.equal(typeof core?.resolveChartData, "function", "Missing bound installed core.resolveChartData");
  const imported = {};
  for (const [phase, bytes] of [
    ["original", binding.input],
    ["saved-reopened", saved],
  ])
    imported[phase] = await importReferenceWitnessPublic(bytes, {
      consumer: binding.envelope.generation.consumer,
      engines,
    });
  findings.push(...compareReferenceWitnessImports(binding.source.deck, imported, binding.archive.canvas, core.resolveChartData));
  readReferenceWitnessEnvelope(envelopeFile, expectedEnvelopeSha256, { root });
  return {
    schemaVersion: 1,
    profile: REFERENCE_PROFILE,
    fullSuite: false,
    automaticControlEligible: false,
    nativeAcceptance: false,
    registryAcceptance: false,
    envelopeSha256: binding.envelopeSha256,
    generation: binding.envelope.generation,
    controllerRepository: binding.envelope.controllerRepository,
    runtimeRoutes: binding.runtimeRoutes,
    inputSha256: digest(binding.input),
    savedSha256: digest(saved),
    phases: 2,
    slidesPerPhase: 3,
    pngs,
    before,
    after,
    imported,
    findings,
    status: findings.length
      ? "observations-bound; findings-require-review"
      : "observations-bound; supervisor-review-required",
    scope:
      "Whole-file windowless read-only open/save/reopen,6rasters and offline cache/workbook/import facts; no content edits, repair-dialog, native editability, font/glyph or release acceptance.",
  };
}
function args(argv) {
  const [mode, ...rest] = argv,
    options = {};
  for (let i = 0; i < rest.length; i += 2) {
    assert.ok(
      /^--[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u.test(rest[i]) &&
        rest[i + 1] &&
        !rest[i + 1].startsWith("--"),
      "Malformed/missing option",
    );
    assert.ok(!Object.hasOwn(options, rest[i]), "Duplicate option");
    options[rest[i]] = rest[i + 1];
  }
  return { mode, options };
}
function writeExclusive(file, value) {
  const full = plainLocalPath(file, { exists: false });
  assert.ok(!fs.existsSync(full), "Fresh output required");
  fs.writeFileSync(full, JSON.stringify(value, null, 2) + "\n", { flag: "wx" });
  return fileIdentity(full);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const { mode, options: o } = args(process.argv.slice(2));
  if (mode === "create") {
    assert.deepEqual(
      Object.keys(o).sort(),
      [
        "--case",
        "--consumer",
        "--expected-manifest-sha256",
        "--output",
        "--preparation-repository",
        "--suite",
        "--worker-repository",
      ].sort(),
    );
    const e = createReferenceWitnessEnvelope({
      suiteDirectory: o["--suite"],
      caseId: o["--case"],
      expectedManifestSha256: o["--expected-manifest-sha256"],
      preparationRepository: o["--preparation-repository"],
      workerRepository: o["--worker-repository"],
      consumer: o["--consumer"],
    });
    assertReferenceWitnessOutput(o["--output"], e);
    console.log(
      JSON.stringify({
        profile: REFERENCE_PROFILE,
        fullSuite: false,
        automaticControlEligible: false,
        ...writeExclusive(o["--output"], e),
        nativeAcceptance: false,
      }),
    );
  } else if (mode === "verify") {
    assert.deepEqual(Object.keys(o).sort(), ["--envelope", "--expected-envelope-sha256"].sort());
    const b = readReferenceWitnessEnvelope(o["--envelope"], o["--expected-envelope-sha256"]);
    console.log(
      JSON.stringify({
        profile: REFERENCE_PROFILE,
        fullSuite: false,
        automaticControlEligible: false,
        envelopeSha256: b.envelopeSha256,
        generation: b.envelope.generation,
        controllerRepository: b.envelope.controllerRepository,
        node: b.envelope.node,
        inputPath: asset(b.directory, b.selected.input),
        planPath: asset(b.directory, b.selected.actionPlan),
        archive: b.archive,
        runtimeRoutes: b.runtimeRoutes,
      }),
    );
  } else if (mode === "verify-execution") {
    assert.deepEqual(
      Object.keys(o).sort(),
      ["--envelope", "--expected-envelope-sha256", "--output", "--require-office"].sort(),
    );
    assert.ok(["true", "false"].includes(o["--require-office"]));
    const b = validateReferenceWitnessExecution({
      envelopeFile: o["--envelope"],
      expectedEnvelopeSha256: o["--expected-envelope-sha256"],
      output: o["--output"],
      requireOffice: o["--require-office"] === "true",
    });
    console.log(
      JSON.stringify({
        profile: REFERENCE_PROFILE,
        fullSuite: false,
        automaticControlEligible: false,
        envelopeSha256: b.envelopeSha256,
        generation: b.envelope.generation,
        controllerRepository: b.envelope.controllerRepository,
        node: b.envelope.node,
        inputPath: asset(b.directory, "inputs/case.pptx"),
        planPath: asset(b.directory, "inputs/action-plan.json"),
        archive: b.archive,
        snapshots: b.snapshots,
        status: b.runner.status,
      }),
    );
  } else if (mode === "observe") {
    assert.deepEqual(
      Object.keys(o).sort(),
      ["--envelope", "--expected-envelope-sha256", "--output"].sort(),
    );
    const result = await bindReferenceWitnessObservation({
      envelopeFile: o["--envelope"],
      expectedEnvelopeSha256: o["--expected-envelope-sha256"],
      output: o["--output"],
    });
    writeExclusive(path.join(o["--output"], "reference-chart-observation.json"), result);
    console.log(
      JSON.stringify({
        profile: REFERENCE_PROFILE,
        fullSuite: false,
        automaticControlEligible: false,
        status: result.status,
        nativeAcceptance: false,
        findings: result.findings.length,
      }),
    );
  } else
    throw Error("Use create, verify, verify-execution or observe; no Office calls in this module");
}
