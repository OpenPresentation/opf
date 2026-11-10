import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { referenceControllerDerivation } from "./derive-reference-controller.mjs";
import { assertReferenceWitnessStages } from "./reference-chart-profile.mjs";
import { windowsPowerShellEnvironment } from "./windows-powershell-env.mjs";
const folder = fileURLToPath(new URL("./", import.meta.url));
const shell = "C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe";
const parent =
  process.platform === "win32" ? fs.mkdtempSync("C:/opf-work/reference-managed-") : undefined;
const output = parent ? path.join(parent, "results") : undefined;
const windowsOnly = {
  skip:
    process.platform !== "win32"
      ? "Windows PowerShell managed-only controls; portable source/schema controls run everywhere"
      : false,
};
test("separate worker/wrapper/managed-test sources are exact mechanical derivatives; original sources unchanged", () => {
  for (const item of referenceControllerDerivation())
    assert.deepEqual(fs.readFileSync(path.join(folder, item.file)), Buffer.from(item.source), item.file + ": complete approved derivation");
});
test(
  "private worker refuses a direct invocation before any native bootstrap or output creation",
  windowsOnly,
  () => {
    const owned = output + "-private-denial";
    assert.equal(fs.existsSync(owned), false);
    const result = spawnSync(
      shell,
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        path.join(folder, "reference-chart-worker.ps1"),
        "-ExecutionEnvelope",
        path.join(owned, "missing.json"),
        "-ExpectedEnvelopeSha256",
        "0".repeat(64),
        "-NodeExecutable",
        process.execPath,
        "-OutputDirectory",
        owned,
      ],
      {
        encoding: "utf8",
        env: windowsPowerShellEnvironment(process.env),
        timeout: 10000,
        maxBuffer: 100000,
      },
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /worker is private to the explicitly authorized/);
    assert.equal(fs.existsSync(owned), false);
  },
);
test(
  "actual worker primitive/ownership/latch functions pass the managed getter/method/failure controls with no Office",
  windowsOnly,
  () => {
    assert.equal(fs.existsSync(output), false, "Managed outputs must be fresh");
    const result = spawnSync(
      shell,
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        path.join(folder, "reference-chart-worker-self-test.ps1"),
        "-Worker",
        path.join(folder, "reference-chart-worker.ps1"),
        "-Output",
        output,
      ],
      {
        encoding: "utf8",
        env: windowsPowerShellEnvironment(process.env),
        timeout: 60000,
        maxBuffer: 1000000,
      },
    );
    assert.equal(result.status, 0, result.stdout + "\n" + result.stderr);
    const report = JSON.parse(
      fs.readFileSync(path.join(output, "mock-results.json"), "utf8").replace(/^\uFEFF/u, ""),
    );
    assert.equal(report.mockOnly, true);
    assert.equal(report.officeInvoked, false);
    assert.ok(report.cases >= 50);
    assert.equal(report.results.length, report.cases);
    assert.ok(report.results.every((item) => item.passed === true));
    assert.ok(
      report.results.some(
        (item) => item.name === "forbidden Chart getter allowlist" && item.calls === 0,
      ),
    );
    assert.match(result.stdout, /Office invoked: false/);
    const successful = JSON.parse(
        fs.readFileSync(path.join(output, "success/report.json"), "utf8").replace(/^\uFEFF/u, ""),
      ),
      stages = fs
        .readFileSync(path.join(output, "success/stages.jsonl"), "utf8")
        .trim()
        .split(/\r?\n/u)
        .map((line) => JSON.parse(line.replace(/^\uFEFF/u, "")));
    assertReferenceWitnessStages(successful, stages);
    for (const mutate of [
      (s) => s.splice(4, 1),
      (s) => s[3].sequence++,
      (s) => (s[4].status = "error"),
      (s) => (s[5].officeOperationsStopped = true),
      (s) => (s[6].stage = "forbidden.Chart"),
    ]) {
      const changed = structuredClone(stages);
      mutate(changed);
      assert.throws(() => assertReferenceWitnessStages(successful, changed));
    }
    console.log(JSON.stringify({ managedCases: report.cases, officeInvoked: false, output }));
  },
);
