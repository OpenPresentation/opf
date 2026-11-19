// First-session findings: a closed pipe ends the CLI quietly (opf schema presentation | head), `opf paginate --check` says why it
// failed, the JSON syntax hint has no editor advice in a terminal, and a typo of a removed command gets the removed command's answer.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const executable = process.env.OPF_TEST_BIN ?? fileURLToPath(new URL("../dist/index.js", import.meta.url));
let temp;
before(async () => { temp = await realpath(await mkdtemp(path.join(tmpdir(), "opf-cli-pipes-"))); });
after(async () => { await rm(temp, { recursive: true, force: true }); });

const run = (args, { status = 0 } = {}) => {
  const result = spawnSync(process.execPath, [executable, ...args], { cwd: temp, encoding: "utf8", timeout: 60000, maxBuffer: 64 * 1024 * 1024 });
  assert.equal(result.status, status, JSON.stringify({ args, stdout: result.stdout.slice(0, 1000), stderr: result.stderr.slice(0, 1000) }));
  return result;
};

/** Start the CLI, close the read end of `stream` before it writes (what `head` does), and report how it ended. */
function runWithClosedPipe(args, stream) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [executable, ...args], { cwd: temp, stdio: ["ignore", "pipe", "pipe"] });
    const other = stream === "stdout" ? "stderr" : "stdout";
    let seen = "";
    child[other].on("data", (chunk) => { seen += chunk; });
    child[stream].destroy();
    const timer = setTimeout(() => { child.kill(); reject(new Error(`opf ${args.join(" ")} did not end after its ${stream} was closed`)); }, 30000);
    child.on("close", (code, signal) => { clearTimeout(timer); resolve({ code, signal, seen }); });
  });
}

// A closed pipe gives the writer an EPIPE error on Linux and macOS (the reader's end is gone) and on Windows (a broken pipe
// write); the Windows leg of CI is the nightly run, which executes this test too, so nothing here is skipped by platform.
describe("a reader that closes the pipe early", () => {
  for (const args of [["schema", "presentation"], ["schemas"], ["catalogs"], ["catalog", "layouts"]]) {
    test(`opf ${args.join(" ")} stops quietly with 141 when stdout is closed`, async () => {
      const { code, signal, seen } = await runWithClosedPipe(args, "stdout");
      assert.equal(signal, null);
      assert.equal(code, 141);
      assert.doesNotMatch(seen, /EPIPE|Unhandled|node:events|at \w/, "no stack trace on stderr");
      assert.equal(seen, "", "nothing is written to stderr");
    });
  }

  test("a report written to stderr stops quietly with 141 when stderr is closed", async () => {
    const { code, signal, seen } = await runWithClosedPipe(["no-such-command"], "stderr");
    assert.equal(signal, null);
    assert.equal(code, 141);
    assert.equal(seen, "");
  });

  test("an open pipe is unchanged: the same command exits 0 with the complete output", () => {
    const result = run(["schema", "presentation"]);
    assert.equal(JSON.parse(result.stdout).$schema !== undefined, true);
  });
});

describe("opf paginate --check", () => {
  test("a failing check names every slide that would split, as a finding with a rule id and a path", async () => {
    const items = Array.from({ length: 60 }, (_, index) => `Item ${index + 1} with enough words to take a line`);
    await writeFile(path.join(temp, "long.opf.json"), JSON.stringify({ name: "Long", slides: [{ id: "short", title: "Short" }, { id: "long", title: "Many items", items }] }));
    const report = JSON.parse(run(["paginate", "long.opf.json", "--check"], { status: 1 }).stdout);
    assert.equal(report.ok, false);
    assert.equal(report.findings.length, report.overflow.length);
    const [finding] = report.findings;
    assert.equal(finding.ruleId, "cli/slide-would-split");
    assert.equal(finding.severity, "error");
    assert.equal(finding.path, "/slides/1");
    assert.match(finding.message, /^Slide 2 does not fit and would split into \d+ slides\.$/);
    assert.match(finding.help, /opf paginate/);
    assert.equal(report.counts.error, 1);
  });

  test("a deck that fits passes with no findings", async () => {
    await writeFile(path.join(temp, "fits.opf.json"), JSON.stringify({ name: "Fits", slides: [{ title: "Short" }] }));
    const report = JSON.parse(run(["paginate", "fits.opf.json", "--check"]).stdout);
    assert.deepEqual([report.ok, report.findings.length], [true, 0]);
  });
});

describe("messages", () => {
  test("a JSON syntax hint in a terminal does not give editor advice", async () => {
    await writeFile(path.join(temp, "syntax.json"), '{"name": "T", "slides": [ {"title": } ]}');
    const report = JSON.parse(run(["validate", "syntax.json"], { status: 1 }).stdout);
    const finding = report.findings.find((item) => item.ruleId === "opf/json-syntax");
    assert.match(finding.message, /`title` needs a value/);
    assert.doesNotMatch(JSON.stringify(report), /Ctrl\+Space/);
    assert.match(finding.help, /a string such as/);
  });

  test("a typo of a removed command names its replacement", () => {
    for (const [typed, removed, replacement] of [["rendr", "render", "opf convert"], ["exprot", "export", "opf convert"], ["imprt", "import", "opf convert"], ["lnt", "lint", "opf validate"]]) {
      const error = JSON.parse(run([typed], { status: 2 }).stderr);
      assert.equal(error.code, "removed-command", typed);
      assert.equal(error.command, removed);
      assert.equal(error.typed, typed);
      assert.match(error.error, new RegExp(`^Unknown command: ${typed}\\. opf ${removed} was removed`));
      assert.ok(error.error.includes(replacement), error.error);
    }
  });

  test("a current command keeps its own suggestion, and a far-fetched typo gets none", () => {
    assert.equal(JSON.parse(run(["validte"], { status: 2 }).stderr).suggestion, "validate");
    for (const typed of ["xyzzy", "deploy"]) assert.equal(JSON.parse(run([typed], { status: 2 }).stderr).code, "unknown-command", typed);
  });
});
