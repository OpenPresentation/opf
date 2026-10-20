#!/usr/bin/env node
// RR-100: the evidence that the exact commit passed CI. The publish workflows run it before `npm publish` instead of
// re-running the whole test suite, and `release-train.mjs tag` reads the same evidence instead of waiting for a second
// round of checks, so a tag is created exactly when its publish run would accept the commit.
//
//   node scripts/ci-evidence.mjs --sha "$(git rev-parse HEAD)" [--repo owner/name] [--config scripts/ci-evidence.json]
//
// scripts/ci-evidence.json lists the requirements. Each one names a workflow file, the event and branch of the run that
// counts, and the jobs that must have succeeded in it:
//   - opf: the merge-queue runs (event merge_group). The queue fast-forwards main to the exact commit it tested, so the
//     run sits on main's commit and `Verify OPF packages`, `packages` and both `Installed candidates` legs are its
//     required checks (the `main` ruleset).
//   - the siblings: the push-to-main run of ci.yml (they have no merge queue).
// Environment: GITHUB_TOKEN (needs `actions: read`), GITHUB_REPOSITORY, GITHUB_SHA (when the flags are absent), GITHUB_API_URL.
//
// It fails closed. Exit 0 only when every requirement has a COMPLETED run of that workflow on exactly this commit with
// conclusion `success` and every named job in it concluded `success` (a skipped required job fails). A missing run, a
// running one, a failed or cancelled one, a job that is absent or skipped, an unreadable configuration or any API error
// is exit 1. Nothing is waited for: a tag pushed while CI still runs fails here and is retried once CI is green
// (`gh run rerun <id> --failed`).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const CONFIG_PATH = 'scripts/ci-evidence.json';
const EVENTS = new Set(['push', 'merge_group']);
const SHA = /^[0-9a-f]{40}$/;

/** The parsed and validated configuration; throws a message that says what is wrong with it. */
export function parseConfig(text) {
  let config;
  try {
    config = JSON.parse(text);
  } catch (error) {
    throw new Error(`ci-evidence: ${CONFIG_PATH} is not JSON (${error.message})`);
  }
  const requirements = config?.requirements;
  if (!Array.isArray(requirements) || requirements.length === 0) throw new Error('ci-evidence: requirements must be a non-empty array');
  for (const [index, requirement] of requirements.entries()) {
    const where = `requirements[${index}]`;
    if (typeof requirement?.workflow !== 'string' || !/^\.github\/workflows\/[^/]+\.ya?ml$/.test(requirement.workflow)) throw new Error(`ci-evidence: ${where}.workflow must be a .github/workflows/*.yml path`);
    if (!EVENTS.has(requirement.event)) throw new Error(`ci-evidence: ${where}.event must be one of ${[...EVENTS].join(', ')}`);
    const named = ['branch', 'branchPrefix'].filter((key) => requirement[key] !== undefined);
    if (named.length !== 1 || typeof requirement[named[0]] !== 'string' || !requirement[named[0]]) throw new Error(`ci-evidence: ${where} needs exactly one non-empty branch or branchPrefix`);
    const { jobs } = requirement;
    if (!Array.isArray(jobs) || jobs.length === 0 || jobs.some((job) => typeof job !== 'string' || !job) || new Set(jobs).size !== jobs.length) throw new Error(`ci-evidence: ${where}.jobs must be a non-empty list of distinct job names`);
  }
  return { requirements };
}

const branchMatches = (requirement, branch) => (requirement.branch !== undefined ? branch === requirement.branch : typeof branch === 'string' && branch.startsWith(requirement.branchPrefix));
const describe = (requirement) => `${requirement.workflow} (${requirement.event}${requirement.branch !== undefined ? ` on ${requirement.branch}` : ` on ${requirement.branchPrefix}*`})`;

/**
 * Evaluates the configuration against one commit. `api(path)` returns the parsed JSON of a GET (an object with `workflow_runs`
 * or `jobs`) or throws. Returns { state: 'green' | 'pending' | 'red', problems: [], pending: [], lines: [] }:
 * red is a completed run that did not succeed or a job that is absent or did not succeed; pending is no run yet or one that
 * has not completed. Callers that must not publish treat anything but green as a failure.
 */
export async function evaluateEvidence({ api, repo, sha, config }) {
  if (!SHA.test(sha ?? '')) throw new Error('ci-evidence: the commit must be a full 40-character SHA');
  const runs = [];
  for (let page = 1; page <= 5; page += 1) {
    const batch = (await api(`/repos/${repo}/actions/runs?head_sha=${sha}&per_page=100&page=${page}`)).workflow_runs ?? [];
    runs.push(...batch);
    if (batch.length < 100) break;
  }
  const problems = [];
  const pending = [];
  const lines = [];
  for (const requirement of config.requirements) {
    const label = describe(requirement);
    const matching = runs
      .filter((run) => run.head_sha === sha && run.path === requirement.workflow && run.event === requirement.event && branchMatches(requirement, run.head_branch))
      .sort((a, b) => (b.run_number ?? 0) - (a.run_number ?? 0) || String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')));
    const run = matching[0];
    if (!run) {
      pending.push(`${label}: no run on ${sha.slice(0, 12)}`);
      continue;
    }
    if (run.status !== 'completed') {
      pending.push(`${label}: run ${run.id} is ${run.status}`);
      continue;
    }
    if (run.conclusion !== 'success') {
      problems.push(`${label}: run ${run.id} concluded ${run.conclusion}`);
      continue;
    }
    const jobs = [];
    for (let page = 1; page <= 5; page += 1) {
      const batch = (await api(`/repos/${repo}/actions/runs/${run.id}/jobs?filter=latest&per_page=100&page=${page}`)).jobs ?? [];
      jobs.push(...batch);
      if (batch.length < 100) break;
    }
    for (const name of requirement.jobs) {
      const found = jobs.filter((job) => job.name === name);
      if (found.length === 0) problems.push(`${label}: run ${run.id} has no job named ${name}`);
      else if (found.some((job) => job.status !== 'completed')) pending.push(`${label}: job ${name} has not completed`);
      else if (found.some((job) => job.conclusion !== 'success')) problems.push(`${label}: job ${name} concluded ${found.map((job) => job.conclusion).join(', ')}`);
    }
    lines.push(`${label}: run ${run.id} succeeded; required jobs ${requirement.jobs.map((name) => `"${name}"`).join(', ')}`);
  }
  const state = problems.length ? 'red' : pending.length ? 'pending' : 'green';
  return { state, problems, pending, lines };
}

/** GET against the GitHub REST API; retries a network error or a 5xx twice, fails on anything else that is not 2xx. */
export function githubApi({ token, baseUrl = process.env.GITHUB_API_URL || 'https://api.github.com', fetchImpl = globalThis.fetch, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) }) {
  return async (route) => {
    let last;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (attempt) await sleep(2000 * attempt);
      let response;
      try {
        response = await fetchImpl(`${baseUrl}${route}`, { headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
      } catch (error) {
        last = error;
        continue;
      }
      if (response.ok) return await response.json();
      last = new Error(`GET ${route} failed with HTTP ${response.status}`);
      if (response.status < 500) throw last;
    }
    throw last;
  };
}

function parseArguments(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    if (!['--sha', '--repo', '--config'].includes(flag) || !argv[i + 1]) throw new Error('Usage: ci-evidence.mjs --sha <commit> [--repo owner/name] [--config scripts/ci-evidence.json]');
    options[flag.slice(2)] = argv[i + 1];
  }
  return options;
}

export async function main(argv, { env = process.env, api, log = console.log } = {}) {
  const options = parseArguments(argv);
  const sha = options.sha ?? env.GITHUB_SHA;
  const repo = options.repo ?? env.GITHUB_REPOSITORY;
  if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error('ci-evidence: a repository owner/name is required (--repo or GITHUB_REPOSITORY)');
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const config = parseConfig(readFileSync(path.resolve(root, options.config ?? CONFIG_PATH), 'utf8'));
  const result = await evaluateEvidence({ api: api ?? githubApi({ token: env.GITHUB_TOKEN }), repo, sha, config });
  for (const line of result.lines) log(`ok: ${line}`);
  for (const line of [...result.problems, ...result.pending]) log(`not green: ${line}`);
  if (result.state !== 'green') {
    log(`ci-evidence: ${repo}@${sha.slice(0, 12)} has no green CI evidence (${result.state}); not publishing. Get the required checks green on this exact commit, then re-run the failed job.`);
    return 1;
  }
  log(`ci-evidence: ${repo}@${sha.slice(0, 12)} passed every required check.`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
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
