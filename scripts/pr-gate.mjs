#!/usr/bin/env node
// RR-57: the one shared PR/CI gate. Watch (and optionally merge) pull requests, or wait for a commit's checks, with ONE
// batched GraphQL query per interval for every target. Agents use this instead of writing their own watcher.
//
//   node scripts/pr-gate.mjs <owner/repo#N> [more…] [--merge] [--expect-head <sha>]… [--required auto|all|<a,b,…>]
//                            [--interval 180] [--timeout-minutes 100] [--rerun-once] [--no-skipped] [--json]
//   node scripts/pr-gate.mjs --commit <owner/repo@sha> [same options, without --merge/--expect-head]
//
// Green: every REQUIRED check (the base branch's ruleset, read once per repository through REST) exists for the current
// head and completed with success (skipped/neutral pass unless --no-skipped), and the PR's mergeability is computed and
// not conflicting. Check runs and commit statuses both count; checks for older heads are ignored, and so are superseded
// runs on the same head: only the newest report of each check counts (per workflow and job name; a re-run or a newer run
// of the same job replaces the failed one, a newer failure replaces an older success; a CANCELLED check of a run that a newer
// run of the same workflow superseded is ignored even before the newer run reports that check). Zero checks or a required check
// that has not registered yet is pending, never green. Without a ruleset (or --required all) every check
// counts except neutral bots (Cursor Bugbot), every GitHub Actions suite must be complete, and green must hold on two
// consecutive polls. Red (a required check failed, was cancelled, timed out, hit a startup failure or needs action) stops
// at once and prints the failing checks with their URLs; --rerun-once re-runs the failed or cancelled workflow runs one
// time first. --merge enqueues into the merge queue (GraphQL, with the expected head; retried for up to 6 minutes while
// GitHub is still computing mergeability) and follows the queue, re-enqueueing once after an ejection; a repository
// without a queue is squash-merged. Re-running resumes: a merged PR exits 0 and a queued PR is followed. A PR the queue
// merges prints "MERGED <label> <sha> (merged by the merge queue)" and exits 0: the queue also records a removal with the
// reason "merged" for it, which is not an ejection (failed_checks, manual and other reasons are).
//
// Exit codes: 0 green, or MERGED (by the queue, by the squash merge, or already merged when the gate started), 1 red,
// 2 merge conflict (DIRTY), 3 closed without merging, 4 head moved (--expect-head; right after a push GitHub can still
// serve the previous head, so a different head is re-read up to 3 times, 15 s apart, before it exits 4; once the expected
// head has been seen, a later change exits 4 at once), 5 merge-queue ejection twice or the merge/enqueue was refused, 64 usage, failed gh auth or a target
// that does not exist, 75 timeout (prints a RESUME line; re-run it). With several targets the first failure code in argument order wins,
// then 75 if any target is unfinished. GitHub API: gh's auth; GraphQL only in the poll loop (rateLimit is read on every
// poll and the gate backs off below 200 points); REST only for the rulesets (once per repository) and --rerun-once.
import { spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const EXIT = { ok: 0, red: 1, dirty: 2, closed: 3, headMoved: 4, ejected: 5, usage: 64, timeout: 75 };
/** Checks that never gate (advisory bots), in the "all checks" fallback. Shared with release-train's ADVISORY_CHECKS. */
export const NEUTRAL_BOTS = new Set(['Cursor Bugbot']);
export const RED_CONCLUSIONS = new Set(['FAILURE', 'CANCELLED', 'TIMED_OUT', 'STARTUP_FAILURE', 'ACTION_REQUIRED', 'STALE']);
/** Enqueue/merge refusals that clear on their own once GitHub has computed mergeability or the checks registered. */
export const TRANSIENT_REFUSAL = /mergeability check has not yet completed|required status checks are expected|has not been computed|try again/i;
export const DEFAULTS = { interval: 180, minInterval: 60, timeoutMinutes: 100, heartbeatMinutes: 15, retryWindowMinutes: 6, retrySeconds: 60, rateFloor: 200, headLagRetries: 3, headLagSeconds: 15, mergedSettlePolls: 3 };

/** RemovedFromMergeQueueEvent.reason of a successful queue merge (others seen: failed_checks, manual). */
export const MERGED_REMOVAL = /^merged$/i;

export class UsageError extends Error {}

// ---------------------------------------------------------------------------------------------------------------
// Arguments

const NAME = '[A-Za-z0-9._-]+';
/** "owner/repo#N", a pull request URL, or (commit) "owner/repo@sha". */
export function parseTarget(text, { commit = false } = {}) {
  if (commit) {
    const match = new RegExp(`^(${NAME})/(${NAME})@([0-9a-fA-F]{7,40})$`).exec(text);
    if (!match) throw new UsageError(`--commit wants owner/repo@sha, not ${text}`);
    return { kind: 'commit', owner: match[1], name: match[2], sha: match[3].toLowerCase() };
  }
  const match = new RegExp(`^(${NAME})/(${NAME})#(\\d+)$`).exec(text) ?? new RegExp(`^https://github\\.com/(${NAME})/(${NAME})/pull/(\\d+)/?$`).exec(text);
  if (!match) throw new UsageError(`a target is owner/repo#N or a pull request URL, not ${text}`);
  return { kind: 'pr', owner: match[1], name: match[2], number: Number(match[3]) };
}

export function targetLabel(target) {
  return target.kind === 'pr' ? `${target.owner}/${target.name}#${target.number}` : `${target.owner}/${target.name}@${target.sha.slice(0, 12)}`;
}

export function parseArgs(argv) {
  const options = { targets: [], merge: false, expectHeads: [], required: 'auto', interval: DEFAULTS.interval, timeoutMinutes: DEFAULTS.timeoutMinutes, json: false, rerunOnce: false, allowSkipped: true, help: false };
  const value = (index, flag) => {
    if (index >= argv.length || argv[index].startsWith('--')) throw new UsageError(`${flag} needs a value`);
    return argv[index];
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--merge') options.merge = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--rerun-once') options.rerunOnce = true;
    else if (arg === '--no-skipped') options.allowSkipped = false;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--commit') options.targets.push(parseTarget(value(++index, arg), { commit: true }));
    else if (arg === '--expect-head') {
      const sha = value(++index, arg);
      if (!/^[0-9a-fA-F]{7,40}$/.test(sha)) throw new UsageError(`--expect-head wants a commit sha, not ${sha}`);
      options.expectHeads.push(sha.toLowerCase());
    } else if (arg === '--required') {
      const text = value(++index, arg);
      options.required = text === 'auto' || text === 'all' ? text : text.split(',').map((name) => name.trim()).filter(Boolean);
      if (Array.isArray(options.required) && !options.required.length) throw new UsageError('--required lists no check');
    } else if (arg === '--interval' || arg === '--timeout-minutes') {
      const number = Number(value(++index, arg));
      if (!Number.isFinite(number) || number <= 0) throw new UsageError(`${arg} wants a positive number`);
      if (arg === '--interval') options.interval = Math.max(DEFAULTS.minInterval, number);
      else options.timeoutMinutes = number;
    } else if (arg.startsWith('--')) throw new UsageError(`unknown option ${arg}`);
    else options.targets.push(parseTarget(arg));
  }
  if (options.help) return options;
  if (!options.targets.length) throw new UsageError('name at least one pull request (owner/repo#N) or --commit owner/repo@sha');
  const prs = options.targets.filter((target) => target.kind === 'pr');
  if (options.expectHeads.length && options.expectHeads.length !== prs.length) throw new UsageError(`give one --expect-head per pull request (${prs.length}), in the same order`);
  prs.forEach((target, index) => {
    target.expectHead = options.expectHeads[index];
  });
  const seen = new Set();
  for (const target of options.targets) {
    const label = targetLabel(target);
    if (seen.has(label)) throw new UsageError(`${label} is named twice`);
    seen.add(label);
  }
  return options;
}

// ---------------------------------------------------------------------------------------------------------------
// GraphQL

const CONTEXT_NODES =
  'nodes{__typename ... on CheckRun{databaseId name status conclusion detailsUrl startedAt checkSuite{commit{oid} app{slug databaseId} workflowRun{databaseId event runAttempt workflow{name}}}} ... on StatusContext{context state targetUrl createdAt commit{oid}}}';
const CHECKS = `statusCheckRollup{state contexts(first:100){totalCount pageInfo{hasNextPage endCursor} ${CONTEXT_NODES}}} checkSuites(first:50){nodes{status conclusion app{slug} workflowRun{databaseId event workflow{name}}}}`;
const PR_FIELDS = `id number url state merged isDraft mergeCommit{oid} headRefOid baseRefName mergeable mergeStateStatus isInMergeQueue mergeQueueEntry{state position} timelineItems(last:1,itemTypes:[REMOVED_FROM_MERGE_QUEUE_EVENT]){nodes{... on RemovedFromMergeQueueEvent{reason createdAt}}} commits(last:1){nodes{commit{oid ${CHECKS}}}}`;
const COMMIT_FIELDS = `... on Commit{oid ${CHECKS}}`;

export const ENQUEUE_MUTATION =
  'mutation($id:ID!,$head:GitObjectID!){enqueuePullRequest(input:{pullRequestId:$id,expectedHeadOid:$head}){mergeQueueEntry{state position}}}';
export const MERGE_MUTATION =
  'mutation($id:ID!,$head:GitObjectID!){mergePullRequest(input:{pullRequestId:$id,mergeMethod:SQUASH,expectedHeadOid:$head}){pullRequest{merged mergeCommit{oid}}}}';

/**
 * One query for every target: rateLimit, then per repository its default branch, the merge queue of each known base
 * branch (mq0, mq1, …) and each target (t<i>). repos: [{alias, owner, name, bases: [branch…], targets: [target…]}].
 */
export function buildPollQuery(repos) {
  const parts = ['rateLimit{remaining resetAt cost}'];
  for (const repo of repos) {
    const inner = ['defaultBranchRef{name}'];
    repo.bases.forEach((base, index) => {
      inner.push(`mq${index}: mergeQueue(branch:${JSON.stringify(base)}){id}`);
    });
    for (const target of repo.targets) {
      if (target.kind === 'pr') inner.push(`${target.alias}: pullRequest(number:${target.number}){${PR_FIELDS}}`);
      else inner.push(`${target.alias}: object(expression:${JSON.stringify(target.sha)}){${COMMIT_FIELDS}}`);
    }
    parts.push(`${repo.alias}: repository(owner:${JSON.stringify(repo.owner)},name:${JSON.stringify(repo.name)}){${inner.join(' ')}}`);
  }
  return `query{${parts.join(' ')}}`;
}

export function moreContextsQuery(owner, name, oid, cursor) {
  return `query{rateLimit{remaining resetAt cost} repository(owner:${JSON.stringify(owner)},name:${JSON.stringify(name)}){object(oid:${JSON.stringify(oid)}){... on Commit{statusCheckRollup{contexts(first:100,after:${JSON.stringify(cursor)}){pageInfo{hasNextPage endCursor} ${CONTEXT_NODES}}}}}}}`;
}

// ---------------------------------------------------------------------------------------------------------------
// Rules and check evaluation (pure)

/** The base branch's rules (REST rules/branches/<base>): the required checks and whether a merge queue is configured. */
export function summarizeRules(rules) {
  const required = [];
  const seen = new Set();
  for (const rule of Array.isArray(rules) ? rules : []) {
    if (rule.type !== 'required_status_checks') continue;
    for (const check of rule.parameters?.required_status_checks ?? []) {
      const key = `${check.context}\u0000${check.integration_id ?? ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      required.push({ context: check.context, integrationId: check.integration_id ?? null });
    }
  }
  return { required, hasQueue: Array.isArray(rules) && rules.some((rule) => rule.type === 'merge_queue') };
}

/**
 * Rollup contexts → [{kind, name, result: success|skipped|pending|failure, conclusion, url, at, id, runId, attempt,
 * workflow, appId}]. workflow is the workflow's name for a GitHub Actions job (null for other apps and statuses): with
 * name it identifies "the same check", of which only the newest report counts (pickLatest).
 */
export function normalizeContexts(nodes, headOid) {
  const out = [];
  for (const node of nodes ?? []) {
    if (!node) continue;
    if (node.__typename === 'CheckRun') {
      const oid = node.checkSuite?.commit?.oid;
      if (headOid && oid && oid !== headOid) continue;
      let result = 'failure';
      if (node.status !== 'COMPLETED') result = 'pending';
      else if (node.conclusion === 'SUCCESS') result = 'success';
      else if (node.conclusion === 'SKIPPED' || node.conclusion === 'NEUTRAL') result = 'skipped';
      out.push({
        kind: 'check',
        name: node.name,
        result,
        conclusion: node.status === 'COMPLETED' ? node.conclusion : node.status,
        url: node.detailsUrl ?? null,
        at: node.startedAt ?? null,
        id: node.databaseId ?? null,
        runId: node.checkSuite?.workflowRun?.databaseId ?? null,
        attempt: node.checkSuite?.workflowRun?.runAttempt ?? null,
        workflow: node.checkSuite?.workflowRun?.workflow?.name ?? null,
        appId: node.checkSuite?.app?.databaseId ?? null,
      });
    } else if (node.__typename === 'StatusContext') {
      const oid = node.commit?.oid;
      if (headOid && oid && oid !== headOid) continue;
      const result = node.state === 'SUCCESS' ? 'success' : node.state === 'PENDING' || node.state === 'EXPECTED' ? 'pending' : 'failure';
      out.push({ kind: 'status', name: node.context, result, conclusion: node.state, url: node.targetUrl ?? null, at: node.createdAt ?? null, id: null, runId: null, attempt: null, workflow: null, appId: null });
    }
  }
  return out;
}

/**
 * True when report `item` of a check supersedes report `best` of the same check. Creation order decides when both carry
 * ids: a newer workflow run beats an older one, and within one run a re-run attempt (a new check run, so a higher id) beats
 * the attempt it replaces. Start times are only the fallback (commit statuses have no ids), because a run cancelled or
 * failed before it started has no start time and must not look "newest". Fallback: a queued run (no start time yet) is
 * newest; on a tie a pending one wins.
 */
function supersedes(item, best) {
  if (item.runId != null && best.runId != null && item.runId !== best.runId) return item.runId > best.runId;
  if (item.id != null && best.id != null && item.id !== best.id) return item.id > best.id;
  const a = item.at ?? '￿';
  const b = best.at ?? '￿';
  return a > b || (a === b && item.result === 'pending' && best.result !== 'pending');
}

/** The newest of several reports of one check. */
export function pickLatest(list) {
  let best = null;
  for (const item of list) if (!best || supersedes(item, best)) best = item;
  return best;
}

/**
 * Only the newest report of each check counts: one per (workflow, job name) for GitHub Actions jobs, one per name for
 * other check runs and commit statuses. An earlier failed or cancelled attempt, a cancelled-in-progress run or a run of
 * an older workflow run on the same head is ignored once a newer report of that check exists. Jobs of different
 * workflows that share a name stay separate, so neither can hide the other.
 */
export function latestPerCheck(checks) {
  const groups = new Map();
  for (const check of checks) {
    const key = `${check.kind}\u0000${check.workflow ?? ''}\u0000${check.name}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(check);
  }
  return [...groups.values()].map(pickLatest);
}

/**
 * A CANCELLED check of a workflow run that a newer run of the same workflow superseded on the same head does not count.
 * Concurrency groups cancel the older run when a second event (a label added right after the PR opened, a push race) starts
 * a new one; the newer run may not have created its check runs yet, so latestPerCheck alone would still see only the
 * cancelled one. A newer run supersedes only while it is live: a run whose check runs are all cancelled, or whose suite
 * completed as CANCELLED, does not hide anything, so the newest run being cancelled still counts as not green. Only
 * cancellations are dropped; a real failure of an older run stays until a newer report of that same check replaces it.
 */
export function dropSupersededCancellations(checks, suites = []) {
  const live = new Map();
  const seen = (workflow, runId) => {
    if (workflow == null || runId == null) return;
    if (!live.has(workflow) || live.get(workflow) < runId) live.set(workflow, runId);
  };
  for (const check of checks) if (check.kind === 'check' && check.conclusion !== 'CANCELLED') seen(check.workflow, check.runId);
  for (const suite of suites) {
    if (suite?.app?.slug !== 'github-actions' || (suite.status === 'COMPLETED' && suite.conclusion === 'CANCELLED')) continue;
    seen(suite.workflowRun?.workflow?.name, suite.workflowRun?.databaseId);
  }
  return checks.filter((check) => !(check.kind === 'check' && check.conclusion === 'CANCELLED' && check.workflow != null && check.runId != null && (live.get(check.workflow) ?? -1) > check.runId));
}

/**
 * The verdict on one head's checks. required: [{context, integrationId}] (a ruleset or --required list) or null for
 * "every check except the neutral bots". suites: the commit's check suites (only used in the "all" mode, where a GitHub
 * Actions suite that is not complete means jobs that have not created their check runs yet).
 * Returns {state: green|pending|red, mode, failing: [{name, conclusion, url, runId, id}], pending, missing, passed,
 * advisoryFailing, total}.
 */
export function evaluateChecks({ checks: reported, required, suites = [], allowSkipped = true, neutral = NEUTRAL_BOTS }) {
  const checks = dropSupersededCancellations(reported, suites);
  const mode = required?.length ? 'required' : 'all';
  const verdicts = [];
  const missing = [];
  const counted = new Set();
  if (mode === 'required') {
    for (const req of required) {
      const candidates = checks.filter((check) => check.name === req.context && (check.kind === 'status' || req.integrationId == null || check.appId == null || check.appId === req.integrationId));
      counted.add(req.context);
      const latest = latestPerCheck(candidates);
      if (latest.length) verdicts.push(...latest);
      else missing.push(req.context);
    }
  } else {
    for (const check of latestPerCheck(checks.filter((entry) => !neutral.has(entry.name)))) {
      counted.add(check.name);
      verdicts.push(check);
    }
  }
  const passes = (check) => check.result === 'success' || (check.result === 'skipped' && allowSkipped);
  const failing = verdicts.filter((check) => check.result === 'failure' || (check.result === 'skipped' && !allowSkipped));
  const pending = verdicts.filter((check) => check.result === 'pending').map((check) => check.name);
  const passed = verdicts.filter(passes).map((check) => check.name);
  const advisoryFailing = [...new Set(latestPerCheck(checks).filter((check) => !counted.has(check.name) && check.result === 'failure').map((check) => check.name))];
  const suitesRunning = mode === 'all' ? suites.filter((suite) => suite?.app?.slug === 'github-actions' && suite.workflowRun && suite.status !== 'COMPLETED').length : 0;
  let state = 'green';
  if (failing.length) state = 'red';
  else if (pending.length || missing.length || !verdicts.length || suitesRunning) state = 'pending';
  return {
    state,
    mode,
    failing: failing.map(({ name, conclusion, url, runId, id }) => ({ name, conclusion, url, runId, id })),
    pending,
    missing,
    passed,
    advisoryFailing,
    suitesRunning,
    total: verdicts.length,
  };
}

/** A short, stable description of a verdict (it is compared between polls to print only changes). */
export function describeChecks(checks) {
  const count = checks.mode === 'required' ? `${checks.passed.length}/${checks.passed.length + checks.pending.length + checks.missing.length + checks.failing.length} required` : `${checks.passed.length}/${checks.total} checks, no ruleset`;
  const parts = [`checks ${checks.state} (${count})`];
  if (checks.failing.length) parts.push(`failing: ${checks.failing.map((check) => `${check.name}=${check.conclusion}`).join(', ')}`);
  if (checks.pending.length) parts.push(`running: ${checks.pending.join(', ')}`);
  if (checks.missing.length) parts.push(`not reported yet: ${checks.missing.join(', ')}`);
  if (checks.suitesRunning) parts.push(`${checks.suitesRunning} workflow runs in progress`);
  if (!checks.total && !checks.missing.length) parts.push('no checks reported');
  if (checks.advisoryFailing.length) parts.push(`not required, failing: ${checks.advisoryFailing.join(', ')}`);
  return parts.join('; ');
}

// ---------------------------------------------------------------------------------------------------------------
// The gate

function clock(ms) {
  return new Date(ms).toISOString().slice(11, 19);
}

function errorText(response) {
  return (response?.errors ?? []).map((error) => error.message).join('; ');
}

/**
 * Runs the gate. deps: {graphql(query, variables) → response JSON, rest(path, {method}) → JSON (throws {status} on an
 * HTTP error), sleep(ms), now() → ms, log(line), err(line)}. Returns {code, results, polls, graphqlCalls, restCalls,
 * resume}.
 */
export async function runGate(options, deps) {
  const interval = Math.max(DEFAULTS.minInterval, options.interval ?? DEFAULTS.interval) * 1000;
  const started = deps.now();
  const deadline = started + (options.timeoutMinutes ?? DEFAULTS.timeoutMinutes) * 60000;
  const counts = { graphql: 0, rest: 0, polls: 0 };
  let lastLogAt = started;
  const say = (line) => {
    lastLogAt = deps.now();
    deps.log(`${clock(lastLogAt)} ${line}`);
  };
  const graphql = async (query, variables) => {
    counts.graphql += 1;
    return deps.graphql(query, variables);
  };
  const rest = async (path, init) => {
    counts.rest += 1;
    return deps.rest(path, init);
  };

  // Repositories and targets, with stable aliases.
  const repos = [];
  const targets = options.targets.map((target, index) => ({ ...target, alias: `t${index}`, label: targetLabel(target), done: null, last: '', head: null, fresh: freshHeadState() }));
  for (const target of targets) {
    const key = `${target.owner}/${target.name}`.toLowerCase();
    let repo = repos.find((entry) => entry.key === key);
    if (!repo) {
      repo = { key, alias: `r${repos.length}`, owner: target.owner, name: target.name, bases: [], rules: new Map(), queue: new Map(), defaultBranch: null, targets: [] };
      repos.push(repo);
    }
    repo.targets.push(target);
    target.repo = repo;
  }

  const finish = (target, code, outcome, line, extra = {}) => {
    target.done = { code, outcome, ...extra };
    say(line);
  };

  async function rulesFor(repo, base) {
    if (repo.rules.has(base)) return repo.rules.get(base);
    let summary = { required: [], hasQueue: false, source: 'none' };
    try {
      const path = `repos/${repo.owner}/${repo.name}/rules/branches/${base.split('/').map(encodeURIComponent).join('/')}?per_page=100`;
      summary = { ...summarizeRules(await rest(path)), source: 'ruleset' };
    } catch (error) {
      if (error?.status !== 404) say(`${repo.owner}/${repo.name}: could not read the rules of ${base} (${error?.message ?? error}); every check counts`);
    }
    let required;
    if (Array.isArray(options.required)) required = options.required.map((context) => ({ context, integrationId: null }));
    else if (options.required === 'all') required = null;
    else required = summary.required.length ? summary.required : null;
    const entry = { ...summary, required };
    repo.rules.set(base, entry);
    if (!repo.bases.includes(base)) repo.bases.push(base);
    const what = required ? `${required.length} required checks (${required.map((check) => check.context).join(', ')})` : 'no required checks: every check except neutral bots counts';
    say(`${repo.owner}/${repo.name} ${base}: ${what}${summary.hasQueue ? '; merge queue' : ''}`);
    return entry;
  }

  async function fullContexts(repo, commit) {
    const rollup = commit?.statusCheckRollup;
    const nodes = [...(rollup?.contexts?.nodes ?? [])];
    let page = rollup?.contexts?.pageInfo;
    while (page?.hasNextPage && page.endCursor) {
      const response = await graphql(moreContextsQuery(repo.owner, repo.name, commit.oid, page.endCursor));
      const contexts = response?.data?.repository?.object?.statusCheckRollup?.contexts;
      if (!contexts) break;
      nodes.push(...(contexts.nodes ?? []));
      page = contexts.pageInfo;
    }
    return nodes;
  }

  async function rerunFailed(repo, target, checks) {
    const runs = new Map();
    for (const check of checks.failing) if (check.runId) runs.set(check.runId, check.conclusion);
    if (!runs.size) return false;
    for (const [runId, conclusion] of runs) {
      const path = `repos/${repo.owner}/${repo.name}/actions/runs/${runId}/${conclusion === 'CANCELLED' ? 'rerun' : 'rerun-failed-jobs'}`;
      try {
        await rest(path, { method: 'POST' });
        say(`${target.label}: re-ran ${conclusion === 'CANCELLED' ? 'the cancelled run' : 'the failed jobs of run'} ${runId}`);
      } catch (error) {
        say(`${target.label}: could not re-run ${runId}: ${error?.message ?? error}`);
      }
    }
    return true;
  }

  // A mutation, retried while GitHub says mergeability or the required checks are not settled (up to 6 minutes).
  async function mutateWithRetry(target, query, variables, field) {
    const until = Math.min(deadline, deps.now() + DEFAULTS.retryWindowMinutes * 60000);
    for (let attempt = 1; ; attempt += 1) {
      let response;
      try {
        response = await graphql(query, variables);
      } catch (error) {
        response = { errors: [{ message: String(error?.message ?? error) }] };
      }
      const value = response?.data?.[field];
      const message = errorText(response);
      if (value && !message) return { ok: true, value };
      if (/already (in|queued|enqueued)|is already in the merge queue/i.test(message)) return { ok: true, already: true, value };
      if (!TRANSIENT_REFUSAL.test(message) || deps.now() + DEFAULTS.retrySeconds * 1000 > until) return { ok: false, message: message || 'no result' };
      say(`${target.label}: not ${field === 'enqueuePullRequest' ? 'enqueueable' : 'mergeable'} yet (${message}); retry ${attempt} in ${DEFAULTS.retrySeconds} s`);
      await deps.sleep(DEFAULTS.retrySeconds * 1000);
    }
  }

  async function handleChecks(repo, commit, headOid, rules) {
    const nodes = commit && commit.oid === headOid ? await fullContexts(repo, commit) : [];
    const checks = evaluateChecks({ checks: normalizeContexts(nodes, headOid), required: rules.required, suites: commit?.checkSuites?.nodes ?? [], allowSkipped: options.allowSkipped !== false });
    if (commit && commit.oid !== headOid) checks.note = 'the rollup is for an older commit';
    return checks;
  }

  // Red: re-run once (when asked), else stop. Returns true when the target is finished.
  async function onRed(target, repo, checks) {
    const fresh = target.fresh;
    if (options.rerunOnce && !fresh.reran) {
      fresh.reran = true;
      if (await rerunFailed(repo, target, checks)) {
        fresh.rerunIds = new Set(checks.failing.map((check) => check.id).filter(Boolean));
        fresh.pollsSinceRerun = 0;
        return false;
      }
    }
    if (fresh.rerunIds && fresh.pollsSinceRerun < 2 && checks.failing.every((check) => check.id && fresh.rerunIds.has(check.id))) return false;
    const failing = checks.failing.map((check) => `\n  ${check.name} (${check.conclusion}) ${check.url ?? ''}`.trimEnd()).join('');
    finish(target, EXIT.red, 'red', `RED ${target.label}: required checks failed:${failing}`, { failing: checks.failing });
    return true;
  }

  // Confirmation in the "all checks" mode: the same green on two consecutive polls of the same head.
  function confirmed(target, checks) {
    if (checks.mode === 'required') return true;
    const key = `${target.head}:${checks.passed.slice().sort().join(',')}`;
    if (target.fresh.greenKey === key) return true;
    target.fresh.greenKey = key;
    return false;
  }

  async function handleCommit(target, repo, object) {
    const base = repo.defaultBranch ?? 'main';
    const rules = await rulesFor(repo, base);
    const oid = object.oid;
    target.head = oid;
    const checks = await handleChecks(repo, object, oid, rules);
    if (target.fresh.rerunIds) target.fresh.pollsSinceRerun += 1;
    const line = describeChecks(checks);
    if (checks.state === 'red' && (await onRed(target, repo, checks))) return;
    if (checks.state === 'green' && confirmed(target, checks)) {
      finish(target, EXIT.ok, 'green', `GREEN ${target.label} ${oid} (${line})`, { head: oid, checks });
      return;
    }
    report(target, `${line}${checks.state === 'green' ? '; confirming at the next poll' : ''}`);
  }

  const matchesExpected = (target, pr) => !target.expectHead || String(pr.headRefOid).startsWith(target.expectHead);

  // Right after a push GitHub can still serve the previous head. Until the expected head has been seen once, a different
  // head is re-read a few times (one single-PR query each, headLagSeconds apart) before it counts as moved.
  async function settleExpectedHead(target, repo, pr) {
    if (!target.expectHead || target.expectSeen || pr.merged || pr.state !== 'OPEN') return pr;
    let current = pr;
    for (let attempt = 1; attempt <= DEFAULTS.headLagRetries && !matchesExpected(target, current); attempt += 1) {
      say(`${target.label}: head is ${String(current.headRefOid).slice(0, 12)}, expected ${target.expectHead.slice(0, 12)}; re-reading in ${DEFAULTS.headLagSeconds} s (${attempt}/${DEFAULTS.headLagRetries})`);
      await deps.sleep(DEFAULTS.headLagSeconds * 1000);
      let response = null;
      try {
        response = await graphql(buildPollQuery([{ ...repo, targets: [target] }]));
      } catch (error) {
        say(`${target.label}: re-reading the head failed: ${String(error?.message ?? error).slice(0, 200)}`);
      }
      const next = response?.data?.[repo.alias]?.[target.alias];
      if (!next) continue;
      current = next;
      if (current.merged || current.state !== 'OPEN') break;
    }
    return current;
  }

  async function handlePr(target, repo, polled) {
    const pr = await settleExpectedHead(target, repo, polled);
    if (pr.merged || pr.state === 'MERGED') {
      // Followed through the queue: the queue's own merge (it also shows as a removal with the reason "merged") is a success.
      const queue = target.fresh.queued;
      finish(target, EXIT.ok, 'merged', ['MERGED', target.label, pr.mergeCommit?.oid, queue ? '(merged by the merge queue)' : null].filter(Boolean).join(' '), { head: pr.headRefOid, mergeCommit: pr.mergeCommit?.oid ?? null, via: queue ? 'merge-queue' : undefined });
      return;
    }
    if (pr.state === 'CLOSED') {
      finish(target, EXIT.closed, 'closed', `CLOSED ${target.label}: closed without merging`, { head: pr.headRefOid });
      return;
    }
    const head = pr.headRefOid;
    if (!matchesExpected(target, pr)) {
      finish(target, EXIT.headMoved, 'head-moved', `HEAD-MOVED ${target.label}: expected ${target.expectHead.slice(0, 12)}, the head is now ${head.slice(0, 12)}`, { head });
      return;
    }
    if (target.expectHead) target.expectSeen = true;
    if (target.head && head !== target.head) {
      say(`${target.label}: head moved ${target.head.slice(0, 8)} -> ${head.slice(0, 8)}; evaluating the new head`);
      target.fresh = freshHeadState();
    }
    target.head = head;
    const rules = await rulesFor(repo, pr.baseRefName);
    const hasQueue = repo.queue.has(pr.baseRefName) ? repo.queue.get(pr.baseRefName) : rules.hasQueue;
    const commit = pr.commits?.nodes?.[0]?.commit;
    const checks = await handleChecks(repo, commit, head, rules);
    const fresh = target.fresh;
    if (fresh.rerunIds) fresh.pollsSinceRerun += 1;
    const mergeState = `${pr.mergeable}/${pr.mergeStateStatus}`;
    const state = [`head ${head.slice(0, 8)}`, describeChecks(checks), `mergeable ${mergeState}`];
    if (checks.note) state.push(checks.note);
    if (pr.isDraft) state.push('draft');

    if (pr.mergeable === 'CONFLICTING' || pr.mergeStateStatus === 'DIRTY') {
      finish(target, EXIT.dirty, 'dirty', `DIRTY ${target.label}: merge conflict with ${pr.baseRefName}; rebase it`, { head });
      return;
    }

    if (options.merge) {
      if (pr.isInMergeQueue) {
        if (!fresh.queued) fresh.queuedAt = deps.now();
        fresh.queued = true;
        fresh.outPolls = 0;
        report(target, `${state.join('; ')}; in the merge queue (${pr.mergeQueueEntry?.state ?? 'queued'}, position ${pr.mergeQueueEntry?.position ?? '?'})`);
        return;
      }
      if (fresh.queued) {
        // Not merged and not queued. A successful queue merge also records a removal (reason "merged", the same second as
        // the merge), and GitHub can show it before the PR reads as merged: wait for the merged state instead of calling it
        // an ejection. Any other reason (failed_checks, manual, ...) is an ejection at once; with no removal event yet,
        // confirm on a second poll.
        const removal = pr.timelineItems?.nodes?.find((node) => node?.createdAt && Date.parse(node.createdAt) >= fresh.queuedAt - 60000);
        fresh.outPolls += 1;
        if (removal && MERGED_REMOVAL.test(removal.reason ?? '') && fresh.outPolls < DEFAULTS.mergedSettlePolls) {
          report(target, `${state.join('; ')}; the merge queue merged it (removal reason "${removal.reason}"); waiting for the merged state`);
          return;
        }
        if (!removal && fresh.outPolls < 2) {
          report(target, `${state.join('; ')}; not in the merge queue any more (confirming at the next poll)`);
          return;
        }
        fresh.queued = false;
        fresh.ejections += 1;
        fresh.ejectReason = MERGED_REMOVAL.test(removal?.reason ?? '') ? 'the queue reported "merged" but the PR never read as merged' : (removal?.reason ?? 'no reason reported');
        if (fresh.ejections >= 2) {
          finish(target, EXIT.ejected, 'ejected', `EJECTED ${target.label}: removed from the merge queue twice (${fresh.ejectReason}); look at its merge_group run`, { head, reason: fresh.ejectReason });
          return;
        }
        say(`${target.label}: ejected from the merge queue (${fresh.ejectReason}); re-enqueueing once when green`);
      }
    }

    if (checks.state === 'red') {
      if (await onRed(target, repo, checks)) return;
      report(target, `${state.join('; ')}; re-run requested, waiting for the new runs`);
      return;
    }
    if (checks.state !== 'green' || pr.mergeable !== 'MERGEABLE') {
      if (pr.mergeable === 'UNKNOWN') state.push('mergeability not computed yet');
      report(target, state.join('; '));
      return;
    }
    if (!confirmed(target, checks)) {
      report(target, `${state.join('; ')}; confirming at the next poll`);
      return;
    }
    if (!options.merge) {
      finish(target, EXIT.ok, 'green', `GREEN ${target.label} ${head} (${describeChecks(checks)})`, { head, checks });
      return;
    }
    if (pr.isDraft) {
      report(target, `${state.join('; ')}; waiting for ready for review before merging`);
      return;
    }
    if (hasQueue) {
      const result = await mutateWithRetry(target, ENQUEUE_MUTATION, { id: pr.id, head }, 'enqueuePullRequest');
      if (!result.ok) {
        finish(target, EXIT.ejected, 'refused', `REFUSED ${target.label}: enqueue failed: ${result.message}`, { head, reason: result.message });
        return;
      }
      fresh.queued = true;
      fresh.queuedAt = deps.now();
      fresh.outPolls = 0;
      const entry = result.value?.mergeQueueEntry;
      say(`${target.label}: ${result.already ? 'already in the merge queue' : `enqueued at ${head.slice(0, 8)} (${entry?.state ?? 'queued'}, position ${entry?.position ?? '?'})`}`);
      target.last = '';
      return;
    }
    const result = await mutateWithRetry(target, MERGE_MUTATION, { id: pr.id, head }, 'mergePullRequest');
    const merged = result.value?.pullRequest;
    if (!result.ok || !merged?.merged) {
      finish(target, EXIT.ejected, 'refused', `REFUSED ${target.label}: squash merge failed: ${result.message ?? 'not merged'}`, { head, reason: result.message ?? 'not merged' });
      return;
    }
    finish(target, EXIT.ok, 'merged', `MERGED ${target.label} ${merged.mergeCommit?.oid ?? ''}`.trimEnd(), { head, mergeCommit: merged.mergeCommit?.oid ?? null });
  }

  function report(target, line) {
    if (line === target.last) return;
    target.last = line;
    say(`${target.label} ${line}`);
  }

  let errorsInRow = 0;
  let backedOff = false;
  for (;;) {
    const active = targets.filter((target) => !target.done);
    const activeRepos = repos.filter((repo) => repo.targets.some((target) => !target.done)).map((repo) => ({ ...repo, targets: repo.targets.filter((target) => !target.done) }));
    let response = null;
    try {
      response = await graphql(buildPollQuery(activeRepos));
      counts.polls += 1;
    } catch (error) {
      if (/gh auth login|HTTP 401|Bad credentials/i.test(String(error?.message ?? error))) throw new UsageError(`GitHub authentication failed: ${String(error?.message ?? error).slice(0, 200)}`);
      errorsInRow += 1;
      if (errorsInRow === 1 || errorsInRow % 5 === 0) say(`GraphQL poll failed (${errorsInRow} in a row): ${String(error?.message ?? error).slice(0, 300)}; retrying at the next interval`);
    }
    if (response && !response.data) {
      errorsInRow += 1;
      say(`GraphQL poll returned no data: ${errorText(response).slice(0, 300)}`);
      response = null;
    }
    if (response) {
      errorsInRow = 0;
      const missingPaths = new Map((response.errors ?? []).filter((error) => error.path).map((error) => [error.path.join('.'), error.message]));
      for (const repo of activeRepos) {
        const data = response.data[repo.alias];
        const real = repos.find((entry) => entry.key === repo.key);
        if (data?.defaultBranchRef?.name) real.defaultBranch = data.defaultBranchRef.name;
        real.bases.forEach((base, index) => {
          if (data && `mq${index}` in data) real.queue.set(base, Boolean(data[`mq${index}`]));
        });
        for (const target of repo.targets) {
          const original = targets.find((entry) => entry.alias === target.alias);
          const node = data?.[target.alias];
          if (!node) {
            const why = missingPaths.get(`${repo.alias}.${target.alias}`) ?? missingPaths.get(repo.alias) ?? (data ? 'not found' : 'repository not found');
            finish(original, EXIT.usage, 'not-found', `NOT-FOUND ${original.label}: ${why}`);
            continue;
          }
          if (original.kind === 'pr') await handlePr(original, real, node);
          else await handleCommit(original, real, node);
        }
      }
      const rate = response.data.rateLimit;
      if (rate && rate.remaining < DEFAULTS.rateFloor && targets.some((target) => !target.done)) {
        const resetAt = Date.parse(rate.resetAt);
        const wait = Math.max(0, Math.min(deadline - deps.now(), (Number.isFinite(resetAt) ? resetAt - deps.now() : 15 * 60000) + 5000));
        say(`GraphQL rate limit: ${rate.remaining} points left; backing off until ${rate.resetAt}`);
        if (wait > 0) await deps.sleep(wait);
        backedOff = true;
      }
    }
    if (!active.length || targets.every((target) => target.done)) break;
    const now = deps.now();
    if (now >= deadline) break;
    if (backedOff) {
      backedOff = false;
      continue;
    }
    if (now - lastLogAt >= DEFAULTS.heartbeatMinutes * 60000) {
      say(`heartbeat: ${targets.filter((target) => !target.done).map((target) => `${target.label} ${target.last.split('; ').slice(0, 2).join('; ') || 'waiting'}`).join(' | ')}`);
    }
    await deps.sleep(Math.min(interval, deadline - now));
  }

  const unfinished = targets.filter((target) => !target.done);
  let resume = null;
  if (unfinished.length) {
    resume = resumeCommand(options, unfinished);
    for (const target of unfinished) target.done = { code: EXIT.timeout, outcome: 'timeout', head: target.head };
    say(`TIMEOUT after ${options.timeoutMinutes ?? DEFAULTS.timeoutMinutes} min: ${unfinished.map((target) => target.label).join(', ')} not finished`);
    say(`RESUME: ${resume}`);
  }
  const failure = targets.find((target) => target.done.code !== EXIT.ok && target.done.code !== EXIT.timeout);
  const code = failure ? failure.done.code : unfinished.length ? EXIT.timeout : EXIT.ok;
  return {
    code,
    results: targets.map((target) => ({ target: target.label, ...target.done, state: target.last || null })),
    polls: counts.polls,
    graphqlCalls: counts.graphql,
    restCalls: counts.rest,
    minutes: Math.round((deps.now() - started) / 600) / 100,
    resume,
  };
}

function freshHeadState() {
  return { reran: false, rerunIds: null, pollsSinceRerun: 0, queued: false, queuedAt: 0, outPolls: 0, ejections: 0, ejectReason: null, greenKey: null };
}

/** The command that resumes the unfinished targets with the same options. */
export function resumeCommand(options, unfinished) {
  const args = ['node', 'scripts/pr-gate.mjs'];
  for (const target of unfinished) args.push(target.kind === 'pr' ? targetLabel(target) : `--commit ${target.owner}/${target.name}@${target.sha}`);
  if (options.merge) args.push('--merge');
  for (const target of unfinished) if (target.expectHead) args.push('--expect-head', target.expectHead);
  if (options.required && options.required !== 'auto') args.push('--required', JSON.stringify(Array.isArray(options.required) ? options.required.join(',') : options.required));
  if ((options.interval ?? DEFAULTS.interval) !== DEFAULTS.interval) args.push('--interval', String(options.interval));
  args.push('--timeout-minutes', String(options.timeoutMinutes ?? DEFAULTS.timeoutMinutes));
  if (options.rerunOnce) args.push('--rerun-once');
  if (options.allowSkipped === false) args.push('--no-skipped');
  if (options.json) args.push('--json');
  return args.join(' ');
}

// ---------------------------------------------------------------------------------------------------------------
// gh-backed dependencies and the CLI

function gh(args, input) {
  const result = spawnSync('gh', args, { input, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 120000 });
  if (result.error) throw new Error(`gh: ${result.error.message}`);
  return { status: result.status ?? 1, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

export function ghDeps({ json = false } = {}) {
  return {
    async graphql(query, variables = {}) {
      const result = gh(['api', 'graphql', '--input', '-'], JSON.stringify({ query, variables }));
      const text = result.stdout.trim();
      if (text.startsWith('{')) return JSON.parse(text);
      throw new Error((result.stderr || text || `gh exited ${result.status}`).trim());
    },
    async rest(path, { method = 'GET' } = {}) {
      const result = gh(['api', '-X', method, path]);
      if (result.status !== 0) {
        const error = new Error((result.stderr || result.stdout).trim().slice(0, 300));
        error.status = Number(/HTTP (\d{3})/.exec(result.stderr)?.[1] ?? 0) || null;
        throw error;
      }
      const text = result.stdout.trim();
      return text ? JSON.parse(text) : null;
    },
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now: () => Date.now(),
    log: json ? (line) => process.stderr.write(`${line}\n`) : (line) => process.stdout.write(`${line}\n`),
  };
}

const USAGE = `Usage: node scripts/pr-gate.mjs <owner/repo#N> [more…] [--merge] [--expect-head <sha>]… [--required auto|all|<a,b>]
                              [--interval 180] [--timeout-minutes 100] [--rerun-once] [--no-skipped] [--json]
       node scripts/pr-gate.mjs --commit <owner/repo@sha> [--required …] [--interval …] [--timeout-minutes …] [--json]
Exit: 0 green/merged (also merged by the queue), 1 red, 2 conflict, 3 closed, 4 head moved (after 3 re-reads), 5 ejected/refused, 64 usage, 75 timeout (re-run the RESUME line).`;

export async function main(argv, depsFactory = ghDeps) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    process.stderr.write(`pr-gate: ${error.message}\n${USAGE}\n`);
    return EXIT.usage;
  }
  if (options.help) {
    process.stdout.write(`${USAGE}\n`);
    return EXIT.ok;
  }
  if (options.merge && options.targets.some((target) => target.kind === 'commit')) {
    process.stderr.write('pr-gate: --merge applies to pull requests, not --commit\n');
    return EXIT.usage;
  }
  const deps = depsFactory({ json: options.json });
  let summary;
  try {
    summary = await runGate(options, deps);
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    process.stderr.write(`pr-gate: ${error.message}\n`);
    return EXIT.usage;
  }
  if (options.json) process.stdout.write(`${JSON.stringify(summary)}\n`);
  return summary.code;
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      process.stderr.write(`pr-gate: ${error?.stack ?? error}\n`);
      process.exitCode = 1;
    },
  );
}
