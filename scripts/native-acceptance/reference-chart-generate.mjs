// Dedicated reference witness generation. Default invocation is pure source inspection.
// Product generation requires an explicit reviewed clean source and exact six-package consumer identity.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  readReferenceSources,
  sourceSummary,
  titleInvariancePair,
  REFERENCE_PROFILE,
  REFERENCE_CASES,
} from "./reference-chart-fixtures.mjs";
import { installedEngines, prepareFreshOutput, fixtureWriter } from "./generate.mjs";
import { preparationInputPaths, sealSuite } from "./prepare.mjs";
import { digest, fileIdentity, installedIdentity, repositoryIdentity } from "./identity.mjs";
import {
  archiveDependencies,
  inspectReferenceArchive,
  inspectReferenceTitlePair,
} from "./reference-chart-archive.mjs";
import {
  assertReferenceWitnessSource,
  compareReferenceWitnessImports,
  importReferenceWitnessPublic,
  REFERENCE_SUPERVISOR,
} from "./reference-chart-profile.mjs";
const repository = fileURLToPath(new URL("../../", import.meta.url)),
  json = (value) => Buffer.from(JSON.stringify(value, null, 2) + "\n");
const hex = (value) => assert.match(value, /^[a-f0-9]{64}$/u, "Explicit expected SHA256 required");
const chartAt = (archive) => archive.slides[0].shapes.find((s) => s.kind === "chart");
export function assertReferenceTitleInvariance(before, after) {
  assert.equal(before.slideCount, 1);
  assert.equal(after.slideCount, 1);
  const a = chartAt(before),
    b = chartAt(after);
  assert.deepEqual(
    a.geometry,
    b.geometry,
    "Prove actual chart frames identical BEFORE comparing title mutants",
  );
  assert.deepEqual(
    a.chart,
    b.chart,
    "Changing only title/subtitle must not add, remove, style or reposition explicit helper series/axes/labels",
  );
  return {
    framesEqual: true,
    helperAxesLabelsAndWorkbookEqual: true,
    physicalProfileCase: false,
    scope: "Pure-export XML/workbook/geometry proof, not native paint or editability",
  };
}
export async function generateReferenceWitnesses({
  consumer,
  output,
  workerRepository,
  expectedRevision,
  expectedRuntimeIdentitySha256,
} = {}) {
  assert.match(expectedRevision, /^[a-f0-9]{40}$/u, "Freeze an explicit reviewed source revision");
  hex(expectedRuntimeIdentitySha256);
  const sources = readReferenceSources(),
    packages = installedIdentity(consumer);
  assert.equal(
    digest(JSON.stringify(packages)),
    expectedRuntimeIdentitySha256,
    "Expected complete installed consumer identity differs",
  );
  const suiteRepository = repositoryIdentity(repository, await preparationInputPaths());
  assert.equal(suiteRepository.dirty, false, "Generation source must be clean");
  assert.equal(suiteRepository.revision, expectedRevision, "Reviewed generation source differs");
  const worker = repositoryIdentity(workerRepository, [
    "test/native-process.ps1",
    "test/native-process-check.ps1",
  ]);
  assert.equal(worker.dirty, false, "Original worker source must be clean");
  assert.deepEqual(
    worker.files.find((f) => f.path === REFERENCE_SUPERVISOR.path),
    REFERENCE_SUPERVISOR,
    "Only unchanged ce92 supervisor is eligible",
  );
  const provenance = {
    packages,
    suiteRepository,
    workerRepository: worker,
    node: { version: process.version, path: process.execPath, ...fileIdentity(process.execPath) },
    nativeAcceptance: false,
    registryAcceptance: false,
    sourceInputs: sources.map(({ id, file, sha256, bytes }) => ({
      id,
      path: "scripts/native-acceptance/reference-witnesses/" + file,
      sha256,
      bytes,
    })),
  };
  assert.match(process.version, /^v24\./u, "Pinned Node24 required");
  const engines = await installedEngines(consumer),
    { core, pptx, render, gallery } = engines,
    deps = archiveDependencies(),
    root = await prepareFreshOutput(output, consumer),
    { put } = fixtureWriter(root);
  const options = {
      catalogs: [gallery],
      seed: 1,
      timestamp: "2026-01-01T00:00:00Z",
      date: "2026-10-10",
      provenance: "full",
    },
    cases = [];
  let fonts;
  const prepare = async (deck) => {
    fonts ??= await render.loadFonts({
      pack: "office",
      substitutionPolicy: "visual",
      scripts: "auto",
      presentation: deck,
      renderOptions: { catalogs: [gallery] },
    });
    await fonts.ensure(deck, { renderOptions: { catalogs: [gallery] } });
    return fonts;
  };
  for (const source of sources) {
    const deck = structuredClone(source.document),
      unchanged = structuredClone(deck),
      validation = core.validate(deck, { catalogs: [gallery], only: ["format", "references"] });
    assert.equal(validation.valid, true, source.id + ": " + JSON.stringify(validation.findings));
    const sourcePath = "sources/" + source.id + ".opf.json",
      sourceRecord = await put(sourcePath, json(deck)),
      actionPlan = "actions/" + source.id + ".json";
    await put(actionPlan, json([]));
    const diagnostics = [],
      bytes = await pptx.toPptx(deck, {
        ...options,
        fonts: await prepare(deck),
        onDiagnostic: (d) => diagnostics.push(d),
      });
    assert.deepEqual(deck, unchanged, "Export must preserve source");
    const input = "inputs/" + source.id + ".pptx",
      archiveRecord = await put(input, bytes),
      archive = inspectReferenceArchive(bytes, deps);
    assertReferenceWitnessSource(archive, deck); // Real counts BEFORE locking a profile/case.
    const imported = await importReferenceWitnessPublic(bytes, { engines }),
      findings = compareReferenceWitnessImports(deck, {
        original: imported,
        "saved-reopened": imported,
      });
    await put(
      "inspection/" + source.id + ".json",
      json({
        validation,
        diagnostics,
        archive,
        imported,
        findings,
        nativeAcceptance: false,
        scope: "Preparation/source import only; no Office or native saved phase",
      }),
    );
    assert.deepEqual(
      findings,
      [],
      source.id + ": original public import must not expose helper series or duplicate overlays",
    );
    const previews = { svg: [], png: [] };
    for (const format of ["svg", "png"]) {
      const result = await core.convert(deck, {
        format,
        catalogs: [gallery],
        fonts,
        date: options.date,
      });
      assert.equal(result.files.length, 3, "No preview pagination/projection");
      for (const [index, file] of result.files.entries()) {
        const relative =
          "previews/" + source.id + "-" + String(index + 1).padStart(2, "0") + "." + format;
        await put(relative, file.bytes);
        previews[format].push(relative);
      }
    }
    assert.deepEqual(deck, unchanged, "Preview must preserve source");
    cases.push({
      id: source.id,
      input,
      source: sourcePath,
      sourceSha256: sourceRecord.sha256,
      actionPlan,
      archiveSha256: archiveRecord.sha256,
      slideCount: 3,
      worker: "furniture",
      automaticControlEligible: false,
      rawShapes: archive.slides.map((s) => s.shapes.length),
      roundTripAcceptance: "original-explicit-data-references-preserved; native-unrun",
      previews,
    });
  }
  const pair = titleInvariancePair(sources),
    pairArchives = [];
  for (const label of ["before", "after"]) {
    const deck = pair[label];
    await put("sources/title-invariance-" + label + ".opf.json", json(deck));
    const bytes = await pptx.toPptx(deck, { ...options, fonts: await prepare(deck) });
    await put("pure/title-invariance-" + label + ".pptx", bytes);
    pairArchives.push(inspectReferenceTitlePair(bytes, deps));
  }
  await put(
    "inspection/title-invariance.json",
    json(assertReferenceTitleInvariance(...pairArchives)),
  );
  const fontFiles = [...new Set(fonts.fontFiles)].map((file) => ({
    path: fs.realpathSync(file),
    ...fileIdentity(file),
  }));
  assert.ok(fontFiles.length, "Actual pinned preview font files required");
  const finalPackages = installedIdentity(consumer);
  assert.deepEqual(finalPackages, packages, "Installed consumer changed during preparation");
  assert.deepEqual(
    repositoryIdentity(
      repository,
      suiteRepository.files.map((f) => f.path),
    ),
    suiteRepository,
    "Generation source changed",
  );
  assert.deepEqual(
    repositoryIdentity(
      workerRepository,
      worker.files.map((f) => f.path),
    ),
    worker,
    "Original worker source changed",
  );
  assert.deepEqual(readReferenceSources(), sources, "Authored source changed");
  return sealSuite(root, {
    schemaVersion: 1,
    profile: REFERENCE_PROFILE,
    fullSuite: false,
    scope: {
      profile: REFERENCE_PROFILE,
      fullSuite: false,
      caseIds: REFERENCE_CASES.map((c) => c.id),
      automaticControlEligible: false,
    },
    nativeAcceptance: false,
    registryAcceptance: false,
    nativeStatus: "UNRUN; source preparation only",
    provenance,
    options: {
      seed: options.seed,
      timestamp: options.timestamp,
      date: options.date,
      provenance: options.provenance,
      fontPolicy: "office/visual; exact selected source files recorded",
      fontFiles,
    },
    cases,
  });
}
function args(argv) {
  const mode = argv.shift(),
    options = {};
  for (let i = 0; i < argv.length; i += 2) {
    assert.ok(
      [
        "--consumer",
        "--output",
        "--worker-repository",
        "--expected-revision",
        "--expected-runtime-identity-sha256",
      ].includes(argv[i]) &&
        argv[i + 1] &&
        !argv[i + 1].startsWith("--"),
      "Unknown/missing explicit generation option",
    );
    assert.ok(!Object.hasOwn(options, argv[i]), "Duplicate generation option");
    options[argv[i]] = argv[i + 1];
  }
  return { mode, options };
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  if (process.argv.length === 2) console.log(JSON.stringify(sourceSummary(), null, 2));
  else {
    const { mode, options: o } = args(process.argv.slice(2));
    assert.equal(mode, "generate", "Only explicit generate is supported");
    assert.equal(
      Object.keys(o).length,
      5,
      "All reviewed source/runtime/output identities are required",
    );
    const result = await generateReferenceWitnesses({
      consumer: o["--consumer"],
      output: o["--output"],
      workerRepository: o["--worker-repository"],
      expectedRevision: o["--expected-revision"],
      expectedRuntimeIdentitySha256: o["--expected-runtime-identity-sha256"],
    });
    console.log(
      JSON.stringify({
        profile: REFERENCE_PROFILE,
        fullSuite: false,
        nativeAcceptance: false,
        cases: result.cases.length,
        files: result.files.length,
        output: path.resolve(o["--output"]),
      }),
    );
  }
}
