import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { spawnSync, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  PROFILE,
  CATALOG,
  folder,
  repository,
  digest,
  fact,
  plain,
  asset,
  validateSource,
  inspect,
  create,
  verify,
  verifyExecution,
} from "./profile.mjs";
const output = path.resolve(
  process.argv[2] ?? "C:/opf-work/b07-seg-observer-admission01",
);
assert.ok(!fs.existsSync(output), "Fresh pure-test output");
fs.mkdirSync(output);
const tests = [];
const save = (name, value) =>
  fs.writeFileSync(
    path.join(output, name),
    JSON.stringify(value, null, 2) + "\n",
    { flag: "wx" },
  );
const run = (name, fn) => {
  fn();
  tests.push({ name, passed: true });
};
const refuses = (name, fn) => run(name, () => assert.throws(fn));
const source = validateSource();
run("all5 exact archived inputs/source/expectation closures", () =>
  assert.deepEqual(
    source.cases.map((c) => c.shapeCount),
    [2, 4, 5, 20, 3],
  ),
);
for (const c of source.cases) {
  run("exact archive " + c.id, () =>
    assert.equal(
      inspect(fs.readFileSync(asset(folder, c.input)), c).shapes.length,
      c.shapeCount,
    ),
  );
  const b = Buffer.from(fs.readFileSync(asset(folder, c.input)));
  b[0] ^= 1;
  refuses("altered archive before parsing " + c.id, () => inspect(b, c));
}
refuses("UNC is refused without network lookup", () =>
  plain("\\\\untrusted.invalid\\share\\case.pptx"),
);
refuses("relative path refused", () => plain("relative"));
refuses("portable traversal refused", () => asset(folder, "../SOURCE.json"));
refuses("backslash portable asset refused", () =>
  asset(folder, "references\\case.pptx"),
);
const junction = path.join(output, "aliased");
fs.symlinkSync(folder, junction, "junction");
refuses("junction alias refused", () => plain(junction));
// Frozen clean source identity is checked by actual create/verify entrypoints.
const head = execFileSync("git", ["-C", repository, "rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
let admitted;
run("actual create defaults Office authorization false", () => {
  admitted = create({
    expectedHead: head,
    caseId: CATALOG[2][0],
    output: path.join(output, "admission"),
  });
  assert.equal(admitted.officeAuthorized, false);
  assert.equal(admitted.nativeRun, false);
  verify(admitted.envelope, admitted.expectedEnvelopeSha256);
});
refuses("default envelope cannot authorize Office", () =>
  verify(admitted.envelope, admitted.expectedEnvelopeSha256, {
    requireOffice: true,
  }),
);
refuses("wrong external envelope digest", () =>
  verify(admitted.envelope, "0".repeat(64)),
);
refuses("wrong controller head", () =>
  create({
    expectedHead: "0".repeat(40),
    caseId: CATALOG[0][0],
    output: path.join(output, "bad-head"),
  }),
);
refuses("unknown case refused", () =>
  create({
    expectedHead: head,
    caseId: "other",
    output: path.join(output, "other"),
  }),
);
refuses("existing output refuses overwrite", () =>
  create({
    expectedHead: head,
    caseId: CATALOG[2][0],
    output: path.join(output, "admission"),
  }),
);
refuses("controller-contained output refused", () =>
  create({
    expectedHead: head,
    caseId: CATALOG[0][0],
    output: path.join(repository, "artifacts", "forbidden"),
  }),
);
const original = fs.readFileSync(admitted.envelope),
  value = JSON.parse(original);
let counter = 0;
for (const [name, mutate] of [
  ["editing action", (e) => e.actions.push({ type: "LtrRun" })],
  ["deadline change", (e) => (e.timeoutSeconds = 60)],
  ["shape cap change", (e) => (e.limits.maxShapesPerSlide = 31)],
  ["selected count change", (e) => (e.selected.shapeCount = 3)],
  ["selected hash change", (e) => (e.selected.archiveSha256 = "0".repeat(64))],
  ["selected path traversal", (e) => (e.selected.input = "../outside.pptx")],
  [
    "automatic eligibility change",
    (e) => (e.selected.automaticControlEligible = true),
  ],
  [
    "constructor identity change",
    (e) => (e.generation.diagnosticConstructorHead = "0".repeat(40)),
  ],
  [
    "historical exporter identity change",
    (e) => (e.generation.originalExporterHead = "0".repeat(40)),
  ],
  [
    "evidence identity change",
    (e) => (e.generation.artifactEvidenceHead = "0".repeat(40)),
  ],
  [
    "installed consumer claim",
    (e) => (e.generation.installedConsumerClaim = true),
  ],
  ["native acceptance claim", (e) => (e.nativeAcceptance = true)],
  ["public import acceptance claim", (e) => (e.publicImportAcceptance = true)],
  ["Node hash changed", (e) => (e.node.identity.sha256 = "0".repeat(64))],
  ["code manifest omitted", (e) => e.controllerRepository.files.pop()],
  [
    "code hash changed",
    (e) => (e.controllerRepository.files[0].sha256 = "0".repeat(64)),
  ],
  ["false clean source", (e) => (e.controllerRepository.dirty = true)],
]) {
  const e = structuredClone(value);
  mutate(e);
  const b = Buffer.from(JSON.stringify(e)),
    file = path.join(output, `mutant-${++counter}.json`);
  fs.writeFileSync(file, b, { flag: "wx" });
  refuses(name, () => verify(file, digest(b)));
}
// AST copied functions only; actual wrapper DEFAULT path does not load the supervisor or query Office.
const env = {
  ...process.env,
  PSModulePath: [
    path.join(process.env.ProgramFiles, "WindowsPowerShell/Modules"),
    path.join(
      process.env.SystemRoot,
      "system32/WindowsPowerShell/v1.0/Modules",
    ),
  ].join(";"),
};
const ps = path.join(
  process.env.SystemRoot,
  "System32/WindowsPowerShell/v1.0/powershell.exe",
);
for (const c of source.cases) {
  const admission = create({
      expectedHead: head,
      caseId: c.id,
      output: path.join(output, c.id + "-admission"),
    }),
    execution = path.join(output, c.id + "-execution");
  const args = [
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    path.join(folder, "run-segment-observer.ps1"),
    "-ExecutionEnvelope",
    admission.envelope,
    "-ExpectedEnvelopeSha256",
    admission.expectedEnvelopeSha256,
    "-NodeExecutable",
    process.execPath,
    "-OutputDirectory",
    execution,
  ];
  const result = spawnSync(ps, args, {
    env,
    encoding: "utf8",
    timeout: 30000,
    maxBuffer: 4 * 1024 * 1024,
  });
  const terminal = {
    status: result.status,
    signal: result.signal,
    error: result.error
      ? { code: result.error.code, message: result.error.message }
      : null,
    args,
    officeRequested: false,
  };
  save(c.id + "-wrapper-terminal.json", terminal);
  fs.writeFileSync(
    path.join(output, c.id + ".stdout.log"),
    result.stdout ?? "",
    { flag: "wx" },
  );
  fs.writeFileSync(
    path.join(output, c.id + ".stderr.log"),
    result.stderr ?? "",
    { flag: "wx" },
  );
  run("actual default wrapper " + c.id, () => {
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.signal, null);
    const runner = JSON.parse(
      fs
        .readFileSync(path.join(execution, "runner.json"), "utf8")
        .replace(/^\uFEFF/u, ""),
    );
    assert.equal(runner.runOfficeRequested, false);
    assert.equal(runner.status, "pure-checks-completed; native-not-run");
    assert.ok(!fs.existsSync(path.join(execution, "native")));
    verifyExecution(
      path.join(execution, "execution-envelope.json"),
      admission.expectedEnvelopeSha256,
      execution,
    );
  });
}
save("results.json", {
  profile: PROFILE,
  head,
  tests,
  passed: tests.length,
  officeInvoked: false,
  scope:
    "Pure admission/archive/path mutants and default wrapper snapshots only. No Office-capable branch or worker entrypoint was invoked.",
});
console.log(
  JSON.stringify({ passed: tests.length, officeInvoked: false, output }),
);
