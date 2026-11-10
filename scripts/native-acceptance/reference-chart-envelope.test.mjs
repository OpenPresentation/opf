// Actual child admission tests use only synthetic packages/XML and the default-pure wrapper route.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  digest,
  fileIdentity,
  installedIdentity,
  repositoryIdentity,
  packageNames,
} from "./identity.mjs";
import {
  REFERENCE_CONTROLLER_FILES,
  REFERENCE_CASES,
  REFERENCE_SUPERVISOR,
} from "./reference-chart-profile.mjs";
import { syntheticCase, sources } from "./test-fixtures/reference-chart-synthetic.mjs";
import { windowsPowerShellEnvironment } from "./windows-powershell-env.mjs";
import { syntheticConsumer } from "./test-fixtures/reference-runtime-routes.mjs";
import { inspectReferenceRuntimeRoutes } from "./reference-runtime-routes.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const write = (file, bytes) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, bytes, { flag: "wx" });
};
const json = (value) => JSON.stringify(value, null, 2) + "\n";
function git(directory, ...args) {
  return execFileSync(
    "git",
    [
      "-c",
      "core.autocrlf=false",
      "-c",
      "user.name=OPF synthetic controller test",
      "-c",
      "user.email=synthetic@example.invalid",
      "-C",
      directory,
      ...args,
    ],
    { encoding: "utf8", windowsHide: true },
  ).trim();
}
function freeze(directory) {
  git(directory, "init", "--quiet");
  git(directory, "add", ".");
  git(directory, "commit", "--quiet", "-m", "Synthetic pure controller fixture");
}
function recordFiles(directory) {
  const records = [];
  function walk(dir, prefix = "") {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const r = prefix ? prefix + "/" + e.name : e.name;
      if (e.isDirectory()) walk(path.join(dir, e.name), r);
      else records.push({ path: r, ...fileIdentity(path.join(dir, e.name)) });
    }
  }
  walk(directory);
  return records.sort((a, b) => (a.path < b.path ? -1 : 1));
}
const logs = [];
function child(executable, args, options = {}) {
  const result = spawnSync(executable, args, {
    encoding: "utf8",
    timeout: 30000,
    maxBuffer: 8 * 1024 * 1024,
    windowsHide: true,
    ...options,
  });
  logs.push({
    executable,
    args,
    status: result.status,
    signal: result.signal,
    error: result.error?.message,
    stdout: result.stdout,
    stderr: result.stderr,
  });
  return result;
}

test("actual create/verify/default-pure child route binds three whole cases, six packages, clean separate repos and unchanged supervisor without Office", {
  timeout: 30000,
}, async () => {
  const folder = fs.mkdtempSync(
      process.platform === "win32"
        ? "C:/opf-work/ref-envelope-"
        : path.join(os.tmpdir(), "ref-envelope-"),
    ),
    controller = path.join(folder, "controller"),
    preparation = path.join(folder, "preparation"),
    worker = path.join(folder, "worker"),
    consumer = path.join(folder, "consumer"),
    suiteRoot = path.join(folder, "suite");
  for (const d of [controller, preparation, worker, consumer, suiteRoot]) fs.mkdirSync(d);
  for (const file of REFERENCE_CONTROLLER_FILES)
    write(path.join(controller, file), fs.readFileSync(path.join(root, file)));
  write(path.join(controller, "package.json"), json({ private: true, type: "module" }));
  write(path.join(controller, ".gitignore"), "node_modules/\n");
  fs.symlinkSync(
    path.join(root, "node_modules"),
    path.join(controller, "node_modules"),
    process.platform === "win32" ? "junction" : "dir",
  );
  freeze(controller);
  write(
    path.join(preparation, "scripts/native-acceptance/run-windows.ps1"),
    fs.readFileSync(path.join(root, "scripts/native-acceptance/run-windows.ps1")),
  );
  freeze(preparation);
  for (const name of ["native-process.ps1", "native-process-check.ps1"])
    write(
      path.join(worker, "test", name),
      fs.readFileSync(
        path.join(root, "scripts/native-acceptance/test-fixtures/reference-chart", name),
      ),
    );
  freeze(worker);
  syntheticConsumer(consumer);
  const provenance = {
      suiteRepository: repositoryIdentity(preparation, [
        "scripts/native-acceptance/run-windows.ps1",
      ]),
      workerRepository: repositoryIdentity(worker, [
        "test/native-process.ps1",
        "test/native-process-check.ps1",
      ]),
      packages: installedIdentity(consumer),
      runtimeRoutes: await inspectReferenceRuntimeRoutes(consumer),
      nativeAcceptance: false,
      registryAcceptance: false,
    },
    cases = [];
  for (const source of sources) {
    const input = "inputs/" + source.id + ".pptx",
      actionPlan = "actions/" + source.id + ".json",
      sourcePath = "sources/" + source.id + ".opf.json",
      bytes = syntheticCase(source),
      sourceBytes = Buffer.from(json(source.document));
    write(path.join(suiteRoot, input), bytes);
    write(path.join(suiteRoot, actionPlan), "[]\n");
    write(path.join(suiteRoot, sourcePath), sourceBytes);
    cases.push({
      id: source.id,
      input,
      source: sourcePath,
      sourceSha256: digest(sourceBytes),
      actionPlan,
      archiveSha256: digest(bytes),
      slideCount: 3,
      worker: "furniture",
      automaticControlEligible: false,
    });
  }
  const suite = {
      schemaVersion: 1,
      fullSuite: false,
      scope: { profile: "reference-chart-original-readonly-v1", fullSuite: false },
      nativeAcceptance: false,
      provenance,
      cases,
      files: recordFiles(suiteRoot),
    },
    suiteBytes = Buffer.from(json(suite));
  write(path.join(suiteRoot, "suite.json"), suiteBytes);
  const profile = path.join(controller, "scripts/native-acceptance/reference-chart-profile.mjs"),
    envelope = path.join(folder, "envelope.json"),
    base = [
      "--suite",
      suiteRoot,
      "--case",
      REFERENCE_CASES[0],
      "--expected-manifest-sha256",
      digest(suiteBytes),
      "--preparation-repository",
      preparation,
      "--worker-repository",
      worker,
      "--consumer",
      consumer,
      "--output",
      envelope,
    ];
  let result = child(process.execPath, [profile, "create", ...base]);
  assert.equal(result.status, 0, result.stderr);
  const envelopeSha = fileIdentity(envelope).sha256;
  const document = JSON.parse(fs.readFileSync(envelope));
  assert.equal(document.generation.provenance.packages.packages.length, 6);
  assert.deepEqual(document.phases, ["original", "saved-reopened"]);
  assert.equal(document.limits.maxTotalShapes, 9);
  assert.equal(document.nativeAcceptance, false);
  assert.notEqual(
    document.generation.preparationRepository,
    document.controllerRepository.directory,
  );
  result = child(process.execPath, [
    profile,
    "verify",
    "--envelope",
    envelope,
    "--expected-envelope-sha256",
    envelopeSha,
  ]);
  assert.equal(result.status, 0, result.stderr);
  const refused = child(process.execPath, [
    profile,
    "verify",
    "--envelope",
    envelope,
    "--expected-envelope-sha256",
    "0".repeat(64),
  ]);
  assert.notEqual(refused.status, 0);
  assert.match(refused.stderr, /digest changed/);
  if (process.platform === "win32") {
    const ps = path.join(
        process.env.SystemRoot ?? "C:/Windows",
        "System32/WindowsPowerShell/v1.0/powershell.exe",
      ),
      wrapper = path.join(controller, "scripts/native-acceptance/run-reference-chart-profile.ps1"),
      output = path.join(folder, "default-pure");
    // No -RunOffice: supervisor and worker scripts are copied only, never dot-sourced/invoked.
    result = child(
      ps,
      [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        wrapper,
        "-ExecutionEnvelope",
        envelope,
        "-ExpectedEnvelopeSha256",
        envelopeSha,
        "-NodeExecutable",
        process.execPath,
        "-OutputDirectory",
        output,
      ],
      { env: windowsPowerShellEnvironment(process.env) },
    );
    assert.equal(result.status, 0, result.stderr);
    const runner = JSON.parse(
      fs.readFileSync(path.join(output, "runner.json"), "utf8").replace(/^\uFEFF/u, ""),
    );
    assert.equal(runner.status, "pure-checks-completed; native-not-run");
    assert.equal(runner.runOfficeRequested, false);
    assert.equal(runner.timeoutSeconds, 45);
    assert.equal(fs.existsSync(path.join(output, "native")), false);
    assert.deepEqual(fileIdentity(path.join(output, "inputs/native-process.ps1")), {
      bytes: REFERENCE_SUPERVISOR.bytes,
      sha256: REFERENCE_SUPERVISOR.sha256,
    });
  }
  for(const name of packageNames){
    const manifest=path.join(consumer,'node_modules',name,'package.json'),held=manifest+'.held';fs.renameSync(manifest,held);
    try{const refusal=child(process.execPath,[profile,'verify','--envelope',envelope,'--expected-envelope-sha256',envelopeSha]);assert.notEqual(refusal.status,0,'Removing required consumer '+name+' must refuse');}
    finally{fs.renameSync(held,manifest);}
  }
  const changed=path.join(controller,REFERENCE_CONTROLLER_FILES[0]),original=fs.readFileSync(changed);fs.appendFileSync(changed,'\n// Deliberate dirty-controller mutation.\n');
  try{const refusal=child(process.execPath,[profile,'verify','--envelope',envelope,'--expected-envelope-sha256',envelopeSha]);assert.notEqual(refusal.status,0,'Dirty/changed controller must refuse');}
  finally{fs.writeFileSync(changed,original);}
  // Retained for bounded evidence sealing; no recursive deletion of synthetic source/results.
  write(
    path.join(folder, "child-results.json"),
    json({
      scope: "Synthetic source/admission only; no generation/render/Office",
      nativeAcceptance: false,
      folder,
      logs,
    }),
  );
  console.log("reference pure child evidence", folder);
});
