import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { REPOSITORIES, readLock } from "./ecosystem-lock.mjs";
import { CHECK_WORKFLOWS, candidateLock, plan, ROLL_BRANCH, run, serializeLock } from "./ecosystem-roll.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sha = (digit) => digit.repeat(40);
const lock = {
  version: 1,
  repositories: { opf: { sha: sha("1") }, "opf-render": { sha: sha("2") }, "opf-pptx": { sha: sha("3") }, "opf-editor": { sha: sha("4") } },
  provenance: { source: "migration", at: "2026-10-03T03:00:00Z" },
};
const same = { opf: sha("1"), "opf-render": sha("2"), "opf-pptx": sha("3"), "opf-editor": sha("4") };
const at = "2026-10-04T00:00:00Z";

test("the candidate is the four mains and reports what moved", () => {
  assert.equal(candidateLock(lock, same, { at }).changed, false);
  const moved = candidateLock(lock, { ...same, "opf-pptx": sha("9") }, { at, run: "https://github.com/OpenPresentation/opf/actions/runs/7" });
  assert.equal(moved.changed, true);
  assert.deepEqual(moved.moved, ["opf-pptx"]);
  assert.equal(moved.candidate.repositories["opf-pptx"].sha, sha("9"));
  assert.equal(moved.candidate.provenance.source, "roller");
  assert.equal(moved.candidate.provenance.run, "https://github.com/OpenPresentation/opf/actions/runs/7");
  assert.throws(() => candidateLock(lock, { ...same, opf: "main" }, { at }), /candidate lock is invalid/);
});

test("the roller writes the lock in the checked-in format", () => {
  const file = path.join(root, "ecosystem.lock.json");
  assert.equal(serializeLock(readLock(file)), readFileSync(file, "utf8"));
});

/** A fake GitHub REST API for one roll. `checks` is the conclusion of every dispatched job. */
function fakeGitHub({ mains = { ...same, "opf-render": sha("8") }, checks = "success", pullRequests = "forbidden" } = {}) {
  const calls = [];
  let polls = 0;
  const encode = (text) => ({ sha: "blob", encoding: "base64", content: Buffer.from(text).toString("base64") });
  const api = async (route, { method = "GET", body } = {}) => {
    calls.push(`${method} ${route}`);
    let match = /^\/repos\/OpenPresentation\/([\w-]+)\/git\/ref\/heads\/main$/.exec(route);
    if (match) return { object: { sha: mains[match[1]] } };
    if (route === `/repos/OpenPresentation/opf/contents/ecosystem.lock.json?ref=${mains.opf}`) return encode(JSON.stringify(lock));
    if (method === "PATCH" && route === `/repos/OpenPresentation/opf/git/refs/heads/${ROLL_BRANCH}`) {
      assert.deepEqual(body, { sha: mains.opf, force: true });
      throw Object.assign(new Error("HTTP 422 Reference does not exist"), { status: 422 });
    }
    if (method === "POST" && route === "/repos/OpenPresentation/opf/git/refs") return { ref: body.ref };
    if (route === `/repos/OpenPresentation/opf/contents/ecosystem.lock.json?ref=${encodeURIComponent(ROLL_BRANCH)}`) return encode(JSON.stringify(lock));
    if (method === "PUT" && route === "/repos/OpenPresentation/opf/contents/ecosystem.lock.json") {
      assert.equal(body.branch, ROLL_BRANCH);
      const written = JSON.parse(Buffer.from(body.content, "base64").toString("utf8"));
      assert.deepEqual(Object.fromEntries(REPOSITORIES.map((name) => [name, written.repositories[name].sha])), mains);
      return { commit: { sha: sha("c") } };
    }
    match = /^\/repos\/OpenPresentation\/opf\/actions\/workflows\/([\w.-]+)\/dispatches$/.exec(route);
    if (match && method === "POST") {
      assert.deepEqual(body, { ref: ROLL_BRANCH });
      return null;
    }
    match = /^\/repos\/OpenPresentation\/opf\/actions\/workflows\/([\w.-]+)\/runs\?/.exec(route);
    if (match) {
      assert.match(route, new RegExp(`head_sha=${sha("c")}`));
      polls++;
      const done = polls > CHECK_WORKFLOWS.length;
      return { workflow_runs: [{ id: CHECK_WORKFLOWS.indexOf(match[1]) + 1, status: done ? "completed" : "in_progress", conclusion: done ? (checks === "success" ? "success" : "failure") : null, html_url: `https://github.com/OpenPresentation/opf/actions/runs/${match[1]}` }] };
    }
    match = /^\/repos\/OpenPresentation\/opf\/actions\/runs\/(\d+)\/jobs/.exec(route);
    if (match) return { jobs: [{ name: match[1] === "1" ? "packages" : "Verify OPF packages", conclusion: checks, html_url: "https://github.com/x" }] };
    if (route.startsWith("/repos/OpenPresentation/opf/pulls?head=")) return [];
    if (method === "POST" && route === "/repos/OpenPresentation/opf/pulls") {
      if (pullRequests === "forbidden") throw Object.assign(new Error("POST /pulls: HTTP 403 GitHub Actions is not permitted to create or approve pull requests."), { status: 403 });
      assert.equal(body.head, ROLL_BRANCH);
      return { html_url: "https://github.com/OpenPresentation/opf/pull/999" };
    }
    throw new Error(`unexpected ${method} ${route}`);
  };
  return { api, calls };
}

const quiet = { sleep: async () => {}, log: () => {}, report: () => {}, pollSeconds: 0 };

test("nothing to roll when the lock already records the four mains", async () => {
  const { api, calls } = fakeGitHub({ mains: same });
  assert.equal((await run(api, quiet)).status, "unchanged");
  assert.ok(!calls.some((call) => !call.startsWith("GET")), "no write");
});

test("with GITHUB_TOKEN: dispatch, wait, and propose only when green (compare link when PRs are refused)", async () => {
  const refused = fakeGitHub();
  const result = await run(refused.api, quiet);
  assert.equal(result.status, "green-no-pull-request");
  assert.match(result.compare, /compare\/main\.\.\.ecosystem-roll\/main$/);
  assert.equal(refused.calls.filter((call) => call.endsWith("/dispatches")).length, CHECK_WORKFLOWS.length);
  const allowed = fakeGitHub({ pullRequests: "allowed" });
  const proposed = await run(allowed.api, quiet);
  assert.equal(proposed.status, "proposed");
  assert.equal(proposed.pull.url, "https://github.com/OpenPresentation/opf/pull/999");
});

test("a red roll proposes nothing and keeps the lock", async () => {
  const { api, calls } = fakeGitHub({ checks: "failure" });
  assert.equal((await run(api, quiet)).status, "red");
  assert.ok(!calls.some((call) => call === "POST /repos/OpenPresentation/opf/pulls"));
});

test("with the App token: no dispatch, the pull request's own checks decide", async () => {
  const { api, calls } = fakeGitHub({ pullRequests: "allowed" });
  const result = await run(api, { ...quiet, tokenKind: "app" });
  assert.equal(result.status, "proposed");
  assert.ok(!calls.some((call) => call.endsWith("/dispatches")));
});

test("the workflow is dispatch-only, never cancels a roll, and swaps to the App token without an edit", () => {
  const workflow = readFileSync(path.join(root, ".github/workflows/ecosystem-roll.yml"), "utf8");
  assert.match(workflow, /^ {2}workflow_dispatch:/m);
  assert.doesNotMatch(workflow, /^ {2}schedule:/m, "the schedule stays off until the App is installed (opf#298)");
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /GITHUB_TOKEN: \$\{\{ steps\.app\.outputs\.token \|\| github\.token \}\}/);
  assert.match(workflow, /if: vars\.ECOSYSTEM_APP_ID != '' && github\.event_name != 'pull_request'/);
  assert.match(workflow, /Plan only[^\n]*\n\s+if: github\.event_name == 'pull_request'/);
});

test("plan-only on a pull request: a local lock is the starting point, the mains are still read", async () => {
  const { api } = fakeGitHub();
  const planned = await plan(api, { lock, at });
  assert.deepEqual(planned.moved, ["opf-render"]);
  assert.equal(planned.candidate.repositories["opf-render"].sha, sha("8"));
});
