// RR-50: the roller. It tries the four OpenPresentation `main` branches together and, when the coordinated checks
// pass on them, proposes the new ecosystem.lock.json (docs/ecosystem-development.md, "Coordinated CI: the ecosystem
// lock"; ci-cd.md section 3).
//
//   node scripts/ecosystem-roll.mjs plan [--lock <file>]  # REST reads only: prints the candidate lock, writes nothing
//                                                        # (--lock: start from a local lock instead of core main's)
//   node scripts/ecosystem-roll.mjs run [--wait-minutes 150] [--poll-seconds 60]
//
// `run` (the ecosystem-roll workflow):
//   1. reads the four `main` SHAs and builds the candidate lock (the golden rule is below); stops when nothing moved,
//   2. force-moves the branch `ecosystem-roll/main` to core `main` and commits the candidate lock on it,
//   3. with GITHUB_TOKEN (ROLLER_TOKEN_KIND=github-token): pushes made with GITHUB_TOKEN start no workflow, but a
//      workflow_dispatch does, so it dispatches `Coordinated public packages` and `OPF CI` on the branch, waits for
//      both, and only when every job passed opens (or updates) the pull request. Those runs report the required checks
//      (`packages`, `Verify OPF packages`, `Installed candidates (...)`) on the branch head, which is the pull request
//      head. If the repository does not let GitHub Actions open pull requests (Settings, Actions, "Allow GitHub Actions
//      to create and approve pull requests"; off today), it leaves the green branch and a compare link in the summary,
//      and a maintainer opens the pull request by hand,
//   4. with the GitHub App token (ROLLER_TOKEN_KIND=app, once opf#298 is done): opens (or updates) the pull request
//      at once; an App's pull request starts the normal pull_request checks, and they decide.
// It never writes main: the lock changes only by merging that pull request (and through the merge queue once enabled).
//
// The golden: the candidate keeps the lock's golden (core main's lock, which a pull request that moves goldens may
// have changed), unless opf-render main's ci.yml selects its own baseline with `golden-override`, which then becomes
// the lock's golden. If the coordinated checks fail on the four mains (a renderer change that moved pixels, a broken
// main, a coupling), nothing is proposed and the run fails with the links: a human fixes main or the golden.
import { appendFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { githubApi, LOCK_FILE, OWNER, parseLock, REPOSITORIES, ROLLER_BRANCH_PREFIX, readLock, validateLock } from "./ecosystem-lock.mjs";

export const ROLL_BRANCH = `${ROLLER_BRANCH_PREFIX}main`;
export const CORE = `${OWNER}/opf`;
/** The workflows whose jobs are the required checks of a core pull request. */
export const CHECK_WORKFLOWS = ["ecosystem-ci.yml", "opf-ci.yml"];

/** The renderer's own golden selection in its ci.yml (the `golden-override` input of the ecosystem-refs step), or "". */
export function goldenOverrideOf(ciYaml) {
  const match = /^\s*golden-override:\s*(?:'([^']*)'|"([^"]*)"|([^\s#'"]*))\s*(?:#.*)?$/m.exec(ciYaml ?? "");
  return match ? (match[1] ?? match[2] ?? match[3] ?? "") : "";
}

/** The candidate lock for the four `main` SHAs. `renderOverride` is opf-render main's golden-override ("" for none). */
export function candidateLock(lock, mains, { renderOverride = "", at, run } = {}) {
  let golden = lock.golden;
  if (renderOverride) {
    const [repository, ...rest] = renderOverride.split("/");
    if (repository !== "opf-render") throw new Error(`opf-render main's golden-override ${renderOverride} does not name an opf-render baseline`);
    golden = { repository, path: rest.join("/"), note: "opf-render main's own golden selection (golden-override in its ci.yml)" };
  }
  const repositories = Object.fromEntries(REPOSITORIES.map((name) => [name, { sha: mains[name] }]));
  const moved = REPOSITORIES.filter((name) => lock.repositories[name].sha !== mains[name]);
  const candidate = {
    ...lock,
    repositories,
    golden,
    provenance: {
      source: "roller",
      at,
      ...(run ? { run } : {}),
      note: `Rolled to the four main branches (${REPOSITORIES.map((name) => `${name} ${mains[name].slice(0, 7)}`).join(", ")}); moved: ${moved.join(", ") || "none"}.`,
    },
  };
  const errors = validateLock(candidate);
  if (errors.length) throw new Error(`the candidate lock is invalid:\n- ${errors.join("\n- ")}`);
  const goldenChanged = JSON.stringify([golden.repository, golden.path]) !== JSON.stringify([lock.golden.repository, lock.golden.path]);
  return { candidate, moved, goldenChanged, changed: moved.length > 0 || goldenChanged };
}

export function serializeLock(lock) {
  return `${JSON.stringify(lock, null, 2)
    .replace(/\{\n\s+"sha": "([0-9a-f]{40})"\n\s+\}/g, '{ "sha": "$1" }')}\n`;
}

export async function mainShas(api) {
  const entries = await Promise.all(REPOSITORIES.map(async (name) => [name, (await api(`/repos/${OWNER}/${name}/git/ref/heads/main`)).object.sha]));
  return Object.fromEntries(entries);
}

async function fileAt(api, repository, file, ref) {
  const data = await api(`/repos/${OWNER}/${repository}/contents/${file}?ref=${encodeURIComponent(ref)}`);
  return { sha: data.sha, text: Buffer.from(data.content, data.encoding === "base64" ? "base64" : "utf8").toString("utf8") };
}

/** Reads the four mains and builds the candidate from core main's lock. */
export async function plan(api, { at = new Date().toISOString().replace(/\.\d{3}Z$/, "Z"), run, lock: localLock } = {}) {
  const mains = await mainShas(api);
  const lock = localLock ?? parseLock((await fileAt(api, "opf", LOCK_FILE, mains.opf)).text, `${CORE}@${mains.opf.slice(0, 12)}:${LOCK_FILE}`);
  const renderOverride = goldenOverrideOf((await fileAt(api, "opf-render", ".github/workflows/ci.yml", mains["opf-render"])).text);
  const result = candidateLock(lock, mains, { renderOverride, at, run });
  const goldenRef = mains[result.candidate.golden.repository];
  try {
    await api(`/repos/${OWNER}/${result.candidate.golden.repository}/contents/${result.candidate.golden.path}?ref=${goldenRef}`);
  } catch (error) {
    throw new Error(`the golden ${result.candidate.golden.repository}:${result.candidate.golden.path} does not exist at ${goldenRef.slice(0, 12)} (${error.message})`);
  }
  return { mains, lock, ...result };
}

/** Moves ecosystem-roll/main to core main and commits the candidate lock on it. Returns the new head SHA. */
export async function pushCandidate(api, { coreMain, candidate }) {
  try {
    await api(`/repos/${CORE}/git/refs/heads/${ROLL_BRANCH}`, { method: "PATCH", body: { sha: coreMain, force: true } });
  } catch (error) {
    if (error.status !== 404 && error.status !== 422) throw error;
    await api(`/repos/${CORE}/git/refs`, { method: "POST", body: { ref: `refs/heads/${ROLL_BRANCH}`, sha: coreMain } });
  }
  const current = await fileAt(api, "opf", LOCK_FILE, ROLL_BRANCH);
  const result = await api(`/repos/${CORE}/contents/${LOCK_FILE}`, {
    method: "PUT",
    body: { message: `RR-50: roll ${LOCK_FILE} to the four main branches\n\n${candidate.provenance.note}`, content: Buffer.from(serializeLock(candidate)).toString("base64"), sha: current.sha, branch: ROLL_BRANCH },
  });
  return result.commit.sha;
}

/** Dispatches the check workflows on the roll branch and waits until a run of each, on `head`, has completed. */
export async function dispatchAndWait(api, head, { waitMinutes = 150, pollSeconds = 60, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), log = console.log } = {}) {
  for (const workflow of CHECK_WORKFLOWS) await api(`/repos/${CORE}/actions/workflows/${workflow}/dispatches`, { method: "POST", body: { ref: ROLL_BRANCH } });
  const deadline = Date.now() + waitMinutes * 60_000;
  const runs = {};
  for (;;) {
    for (const workflow of CHECK_WORKFLOWS) {
      const list = await api(`/repos/${CORE}/actions/workflows/${workflow}/runs?branch=${encodeURIComponent(ROLL_BRANCH)}&event=workflow_dispatch&head_sha=${head}&per_page=5`);
      const run = list.workflow_runs?.[0];
      if (run) runs[workflow] = run;
    }
    const pending = CHECK_WORKFLOWS.filter((workflow) => runs[workflow]?.status !== "completed");
    if (!pending.length) break;
    if (Date.now() > deadline) throw new Error(`timed out after ${waitMinutes} min waiting for ${pending.join(", ")} on ${head.slice(0, 12)}`);
    log(`Waiting for ${pending.map((workflow) => `${workflow} (${runs[workflow]?.status ?? "not started"})`).join(", ")}...`);
    await sleep(pollSeconds * 1000);
  }
  const results = [];
  for (const workflow of CHECK_WORKFLOWS) {
    const jobs = await api(`/repos/${CORE}/actions/runs/${runs[workflow].id}/jobs?per_page=100`);
    for (const job of jobs.jobs) results.push({ workflow, name: job.name, conclusion: job.conclusion, url: job.html_url });
    results.push({ workflow, name: "(run)", conclusion: runs[workflow].conclusion, url: runs[workflow].html_url });
  }
  return { runs, results, green: results.every((result) => result.conclusion === "success" || result.conclusion === "skipped") && Object.values(runs).every((run) => run.conclusion === "success") };
}

export function pullRequestBody({ lock, candidate, moved, evidence }) {
  const rows = REPOSITORIES.map((name) => `| ${name} | \`${lock.repositories[name].sha.slice(0, 12)}\` | \`${candidate.repositories[name].sha.slice(0, 12)}\` |`).join("\n");
  return `RR-50: the roller proposes the four \`main\` branches as the new ecosystem lock.

| repository | lock | candidate (main) |
|---|---|---|
${rows}

Moved: ${moved.join(", ") || "none"}. Golden: \`${candidate.golden.repository}:${candidate.golden.path}\`.

${evidence}

Written by \`scripts/ecosystem-roll.mjs\` (the ecosystem-roll workflow). Do not edit this branch by hand; the next roll force-moves it.`;
}

/** Opens or updates the pull request of the roll branch. Returns { url } or { forbidden: message }. */
export async function openPullRequest(api, { title, body }) {
  const open = await api(`/repos/${CORE}/pulls?head=${OWNER}:${encodeURIComponent(ROLL_BRANCH)}&base=main&state=open`);
  if (open.length) {
    const updated = await api(`/repos/${CORE}/pulls/${open[0].number}`, { method: "PATCH", body: { title, body } });
    return { url: updated.html_url, updated: true };
  }
  try {
    const created = await api(`/repos/${CORE}/pulls`, { method: "POST", body: { title, body, head: ROLL_BRANCH, base: "main" } });
    return { url: created.html_url, updated: false };
  } catch (error) {
    if (error.status === 403 || /not permitted to create or approve pull requests/i.test(error.message)) return { forbidden: error.message };
    throw error;
  }
}

function summary(text) {
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);
}

export async function run(api, { tokenKind = "github-token", runUrl, waitMinutes, pollSeconds, sleep, log, report = summary } = {}) {
  const planned = await plan(api, { run: runUrl });
  if (!planned.changed) {
    report(`Nothing to roll: the lock already records the four main branches (${REPOSITORIES.map((name) => `${name} ${planned.mains[name].slice(0, 7)}`).join(", ")}).`);
    return { status: "unchanged" };
  }
  const head = await pushCandidate(api, { coreMain: planned.mains.opf, candidate: planned.candidate });
  const compare = `https://github.com/${CORE}/compare/main...${ROLL_BRANCH}`;
  const title = `RR-50: roll ecosystem.lock.json (${planned.moved.join(", ") || "golden"})`;
  if (tokenKind === "app") {
    const pull = await openPullRequest(api, { title, body: pullRequestBody({ ...planned, evidence: "Its pull_request checks decide; merge when they are green." }) });
    report(`Candidate lock pushed to ${ROLL_BRANCH} (${head.slice(0, 12)}); pull request: ${pull.url ?? pull.forbidden}`);
    return { status: "proposed", head, pull };
  }
  const checks = await dispatchAndWait(api, head, { waitMinutes, pollSeconds, sleep, log });
  const table = checks.results.map((result) => `| ${result.workflow} | ${result.name} | ${result.conclusion} | ${result.url} |`).join("\n");
  const evidence = `Coordinated checks on the four mains (workflow_dispatch on \`${ROLL_BRANCH}\` at \`${head.slice(0, 12)}\`, the head of this pull request):\n\n| workflow | job | result | link |\n|---|---|---|---|\n${table}`;
  if (!checks.green) {
    report(`### The four mains do not pass together; the lock stays\n\n${evidence}\n\nFix the failing main (or the golden) and run the roller again. Nothing was proposed.`);
    return { status: "red", head, checks };
  }
  const pull = await openPullRequest(api, { title, body: pullRequestBody({ ...planned, evidence }) });
  if (pull.forbidden) {
    report(`### Green: the candidate lock is on ${ROLL_BRANCH}\n\n${evidence}\n\nGitHub Actions may not open pull requests in this repository (${pull.forbidden}). Open it from ${compare} (title "${title}"); the checks above are on its head. With the GitHub App (opf#298) the roller opens it itself.`);
    return { status: "green-no-pull-request", head, checks, compare };
  }
  report(`### Green: ${pull.updated ? "updated" : "opened"} ${pull.url}\n\n${evidence}`);
  return { status: "proposed", head, checks, pull };
}

function option(args, name) {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
}

async function main(argv) {
  const [command, ...args] = argv;
  const api = githubApi();
  if (command === "plan") {
    const lockFile = option(args, "--lock");
    const planned = await plan(api, { lock: lockFile ? readLock(path.resolve(lockFile)) : undefined });
    console.log(serializeLock(planned.candidate));
    console.log(planned.changed ? `Would roll: ${planned.moved.join(", ") || "golden only"}.` : "Nothing to roll.");
    return 0;
  }
  if (command === "run") {
    const runUrl = process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_SERVER_URL ?? "https://github.com"}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : undefined;
    const result = await run(api, {
      tokenKind: process.env.ROLLER_TOKEN_KIND === "app" ? "app" : "github-token",
      runUrl,
      waitMinutes: Number(option(args, "--wait-minutes") ?? 150),
      pollSeconds: Number(option(args, "--poll-seconds") ?? 60),
    });
    return result.status === "red" ? 1 : 0;
  }
  console.error("Usage: node scripts/ecosystem-roll.mjs plan|run [--wait-minutes 150] [--poll-seconds 60]");
  return 2;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      console.error(error.message);
      process.exitCode = 1;
    },
  );
}

