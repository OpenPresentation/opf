#!/usr/bin/env node
// The one shared PR/CI gate. Watch (and optionally merge) pull requests, or wait for a commit's checks, with ONE batched GraphQL
// query per interval for every target. Agents use this instead of writing their own watcher.
//
//   node scripts/pr-gate.mjs <owner/repo#N> [more…] [--merge] [--expect-head <sha>]… [--required verify|all|<a,b,…>]
//                            [--interval 180] [--timeout-minutes 100] [--json]
//   node scripts/pr-gate.mjs --commit <owner/repo@sha> [same options, without --merge and --expect-head]
//
// MR-34: this is the monorepo gate (docs/programs/monorepo/README.md, section 2). There is no merge queue and one required check,
// `verify` (ci.yml), so the gate is small: it reads the head commit's check runs, waits for `verify`, and with --merge turns on GitHub
// auto-merge (squash, for the expected head). The merge-queue enqueue and ejection handling, the ruleset parsing, the superseded-run
// logic, the `Depends-On` handling, the flake-measurement identity and --rerun-once are gone: re-run a failed `verify` with
// `gh run rerun <run id> --failed`.
//
// Green: the required checks exist for the current head and completed with success (a skipped required check is not green), and the
// pull request is not conflicting. Only the newest report of each check name counts (a re-run replaces the failed run). Zero checks
// or a required check that has not registered yet is pending, never green. `--required all` requires every check to pass (neutral
// bots, Cursor Bugbot, never gate) and green must then hold on two consecutive polls, because a suite can still be adding jobs.
// Red (a required check failed, was cancelled, timed out, hit a startup failure or needs action) stops at once and prints the failing
// checks with their URLs.
//
// --merge: after the head matches --expect-head (when given), enables GitHub auto-merge for it (squash), so GitHub merges on green
// even if this process dies, and follows the pull request until it is merged. If auto-merge cannot be enabled (the pull request is
// already clean, or the repository does not allow auto-merge) the gate squash-merges the expected head itself once the checks are
// green. Re-running resumes: a merged pull request exits 0 and an enabled auto-merge is followed.
//
// Exit codes: 0 green, or MERGED (by auto-merge, by the gate, or already merged when the gate started), 1 red, 2 merge conflict,
// 3 closed without merging, 4 head moved (--expect-head; right after a push GitHub can still serve the previous head, so a different
// head is re-read up to 3 times, 15 s apart, before it exits 4; once the expected head has been seen, a later change exits 4 at
// once), 5 the merge was refused (not a transient answer), 64 usage, failed gh auth or a target that does not exist, 75 timeout
// (prints a RESUME line; re-run it). With several targets the first failure code in argument order wins, then 75 if any target is
// unfinished. GitHub API: gh's auth, GraphQL only (rateLimit is read on every poll and the gate backs off below 200 points).
import { spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const EXIT = { ok: 0, red: 1, dirty: 2, closed: 3, headMoved: 4, refused: 5, usage: 64, timeout: 75 };
/** Checks that never gate (advisory bots), in `--required all`. */
export const NEUTRAL_BOTS = new Set(['Cursor Bugbot']);
export const RED_CONCLUSIONS = new Set(['FAILURE', 'CANCELLED', 'TIMED_OUT', 'STARTUP_FAILURE', 'ACTION_REQUIRED', 'STALE']);
/** Merge refusals that clear on their own once GitHub has computed mergeability or the checks registered. */
export const TRANSIENT_REFUSAL = /mergeability check has not yet completed|required status checks are expected|has not been computed|try again/i;
/** Answers that mean auto-merge is not available for this pull request right now: the gate merges it itself when green. */
export const NO_AUTO_MERGE = /clean status|auto[- ]?merge is not allowed|auto[- ]?merge is not enabled|not allowed for this repository/i;
export const DEFAULTS = { interval: 180, minInterval: 60, timeoutMinutes: 100, heartbeatMinutes: 15, retryWindowMinutes: 6, retrySeconds: 60, rateFloor: 200, headLagRetries: 3, headLagSeconds: 15, mergedSettlePolls: 3, pollRetries: 3, pollRetrySeconds: 20, required: 'verify' };

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

export const targetLabel = (target) => (target.kind === 'pr' ? `${target.owner}/${target.name}#${target.number}` : `${target.owner}/${target.name}@${target.sha.slice(0, 12)}`);

export function parseArgs(argv) {
  const options = { targets: [], merge: false, expectHeads: [], required: DEFAULTS.required, interval: DEFAULTS.interval, timeoutMinutes: DEFAULTS.timeoutMinutes, json: false, commit: false, help: false };
  const value = (index, flag) => {
    if (index >= argv.length || argv[index].startsWith('--')) throw new UsageError(`${flag} needs a value`);
    return argv[index];
  };
  const number = (text, flag) => {
    const parsed = Number(text);
    if (!Number.isFinite(parsed) || parsed <= 0) throw new UsageError(`${flag} wants a positive number, not ${text}`);
    return parsed;
  };
  const words = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--merge') options.merge = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--commit') options.commit = true;
    else if (['--expect-head', '--required', '--interval', '--timeout-minutes'].includes(arg)) {
      index += 1;
      const text = value(index, arg);
      if (arg === '--expect-head') options.expectHeads.push(text.toLowerCase());
      else if (arg === '--required') options.required = text;
      else if (arg === '--interval') options.interval = Math.max(DEFAULTS.minInterval, number(text, arg));
      else options.timeoutMinutes = number(text, arg);
    } else if (arg.startsWith('--')) throw new UsageError(`unknown option ${arg}`);
    else words.push(arg);
  }
  if (options.help) return options;
  if (!words.length) throw new UsageError('no target: a pull request (owner/repo#N) or, with --commit, owner/repo@sha');
  if (options.commit && (options.merge || options.expectHeads.length)) throw new UsageError('--commit cannot be combined with --merge or --expect-head');
  options.targets = words.map((word) => parseTarget(word, { commit: options.commit }));
  if (options.expectHeads.length && options.expectHeads.length !== options.targets.length) throw new UsageError('--expect-head is given once per target, in target order');
  if (!['all', 'verify'].includes(options.required) && !/^[^,]+(,[^,]+)*$/.test(options.required)) throw new UsageError(`--required is all, a check name or a comma-separated list, not ${options.required}`);
  return options;
}

// ---------------------------------------------------------------------------------------------------------------
// Checks

/** A check run or commit status of a statusCheckRollup context, as { name, state, url, at }. state: SUCCESS, NEUTRAL, SKIPPED, PENDING or a red conclusion. */
export function normalizeContexts(nodes = []) {
  const checks = [];
  for (const node of nodes) {
    if (node?.__typename === 'CheckRun') {
      const state = node.status === 'COMPLETED' ? (node.conclusion ?? 'PENDING') : 'PENDING';
      checks.push({ name: node.name, state, url: node.detailsUrl ?? '', at: node.startedAt ?? '' });
    } else if (node?.__typename === 'StatusContext') {
      const state = { SUCCESS: 'SUCCESS', FAILURE: 'FAILURE', ERROR: 'FAILURE' }[node.state] ?? 'PENDING';
      checks.push({ name: node.context, state, url: node.targetUrl ?? '', at: node.createdAt ?? '' });
    }
  }
  return checks;
}

/** Only the newest report of each check name counts: a re-run replaces the failed run, a newer failure replaces an older success. */
export function latestPerName(checks) {
  const latest = new Map();
  for (const check of checks) {
    const known = latest.get(check.name);
    if (!known || check.at > known.at || (check.at === known.at && known.state === 'PENDING')) latest.set(check.name, check);
  }
  return [...latest.values()];
}

/**
 * { state: 'green' | 'red' | 'pending', failing, pending, missing } for the reported `checks`. `required` is 'all' or a list of
 * check names. A required check that has not registered (or a skipped one) is pending / not green, never green.
 */
export function evaluateChecks({ checks, required }) {
  const latest = latestPerName(checks);
  const considered = required === 'all' ? latest.filter((check) => !NEUTRAL_BOTS.has(check.name)) : latest.filter((check) => required.includes(check.name));
  const missing = required === 'all' ? (latest.length ? [] : ['(no checks yet)']) : required.filter((name) => !latest.some((check) => check.name === name));
  const failing = considered.filter((check) => RED_CONCLUSIONS.has(check.state));
  const pending = considered.filter((check) => check.state === 'PENDING');
  const notGreen = required === 'all' ? [] : considered.filter((check) => !['SUCCESS', 'PENDING', ...RED_CONCLUSIONS].includes(check.state));
  if (failing.length) return { state: 'red', failing, pending, missing };
  if (pending.length || missing.length) return { state: 'pending', failing, pending, missing };
  if (notGreen.length) return { state: 'red', failing: notGreen, pending, missing };
  return { state: 'green', failing, pending, missing };
}

export const describeChecks = (checks) => checks.map((check) => `  ${check.name}: ${check.state}${check.url ? ` ${check.url}` : ''}`).join('\n');

// ---------------------------------------------------------------------------------------------------------------
// GraphQL

const CONTEXTS = `statusCheckRollup { contexts(first: 100) { pageInfo { hasNextPage } nodes { __typename
  ... on CheckRun { name status conclusion detailsUrl startedAt }
  ... on StatusContext { context state targetUrl createdAt } } } }`;

/** One query for every target, aliased t0, t1, …, plus the rate limit. Names and numbers are validated by parseTarget. */
export function buildPollQuery(targets) {
  const parts = targets.map((target, index) => {
    const repo = `repository(owner: "${target.owner}", name: "${target.name}")`;
    if (target.kind === 'pr') {
      return `t${index}: ${repo} { pullRequest(number: ${target.number}) { id state merged isDraft mergeable headRefOid autoMergeRequest { enabledAt } commits(last: 1) { nodes { commit { oid ${CONTEXTS} } } } } }`;
    }
    return `t${index}: ${repo} { object(expression: "${target.sha}") { ... on Commit { oid ${CONTEXTS} } } }`;
  });
  return `query { ${parts.join('\n')}\n rateLimit { remaining resetAt } }`;
}
export const ENABLE_AUTO_MERGE = 'mutation($id: ID!, $head: GitObjectID!) { enablePullRequestAutoMerge(input: { pullRequestId: $id, mergeMethod: SQUASH, expectedHeadOid: $head }) { pullRequest { number } } }';
export const MERGE = 'mutation($id: ID!, $head: GitObjectID!) { mergePullRequest(input: { pullRequestId: $id, mergeMethod: SQUASH, expectedHeadOid: $head }) { pullRequest { merged mergeCommit { oid } } } }';

/** The view of one polled target: { exists, closed, merged, head, mergeable, autoMerge, id, commitOid, checks, truncated }. */
export function readTarget(target, data) {
  const node = data?.repository ?? data;
  if (target.kind === 'commit') {
    const commit = node?.object;
    if (!commit) return { exists: false };
    const contexts = commit.statusCheckRollup?.contexts;
    return { exists: true, commitOid: commit.oid, checks: normalizeContexts(contexts?.nodes), truncated: Boolean(contexts?.pageInfo?.hasNextPage) };
  }
  const pr = node?.pullRequest;
  if (!pr) return { exists: false };
  const last = pr.commits?.nodes?.at(-1)?.commit;
  const contexts = last?.statusCheckRollup?.contexts;
  return {
    exists: true,
    id: pr.id,
    closed: pr.state === 'CLOSED',
    merged: pr.merged === true || pr.state === 'MERGED',
    head: pr.headRefOid,
    mergeable: pr.mergeable,
    autoMerge: Boolean(pr.autoMergeRequest),
    commitOid: last?.oid,
    checks: normalizeContexts(contexts?.nodes),
    truncated: Boolean(contexts?.pageInfo?.hasNextPage),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// The gate

const clock = (ms) => `${Math.round(ms / 60000)} min`;
const messageOf = (error) => String(error?.message ?? error);

/**
 * Polls until every target is decided. `deps`: { graphql(query, variables) → data, now(), sleep(ms), log(text) }.
 * Returns { code, results: [{ label, code, text }], resume }.
 */
export async function runGate(options, deps) {
  const { graphql, now, sleep, log } = deps;
  const required = options.required === 'all' ? 'all' : options.required.split(',').map((name) => name.trim());
  const settlePolls = required === 'all' ? 2 : 1;
  const started = now();
  const deadline = started + options.timeoutMinutes * 60000;
  let nextHeartbeat = started + DEFAULTS.heartbeatMinutes * 60000;
  const states = options.targets.map((target, index) => ({
    target,
    label: targetLabel(target),
    expect: options.expectHeads[index],
    seenExpected: false,
    headLag: 0,
    greenPolls: 0,
    autoMergeAttempted: false,
    mergeNow: false,
    mergeRetryUntil: 0,
    settled: 0,
    done: null,
  }));
  const finish = (state, code, text) => {
    state.done = { code, text };
    log(`${state.label}: ${text}`);
  };

  const attemptMerge = async (state, view) => {
    // Enable auto-merge once (the expected head only), else merge the head ourselves when green.
    const head = state.expect ?? view.head;
    if (!state.autoMergeAttempted && !view.autoMerge) {
      state.autoMergeAttempted = true;
      try {
        await graphql(ENABLE_AUTO_MERGE, { id: view.id, head });
        log(`${state.label}: auto-merge enabled (squash, head ${head.slice(0, 12)})`);
        return;
      } catch (error) {
        if (NO_AUTO_MERGE.test(messageOf(error))) {
          state.mergeNow = true;
          log(`${state.label}: auto-merge is not available (${messageOf(error).split('\n')[0]}); the gate merges when the checks are green`);
          return;
        }
        if (!TRANSIENT_REFUSAL.test(messageOf(error))) throw Object.assign(new Error(messageOf(error)), { refused: true });
        state.autoMergeAttempted = false;
        state.mergeRetryUntil ||= now() + DEFAULTS.retryWindowMinutes * 60000;
        if (now() > state.mergeRetryUntil) throw Object.assign(new Error(messageOf(error)), { refused: true });
        log(`${state.label}: auto-merge not accepted yet (${messageOf(error).split('\n')[0]}); retrying`);
      }
    }
  };

  const mergeIfGreen = async (state, view) => {
    try {
      const done = await graphql(MERGE, { id: view.id, head: state.expect ?? view.head });
      const merged = done?.mergePullRequest?.pullRequest;
      if (merged?.merged) return finish(state, EXIT.ok, `MERGED ${state.label} ${merged.mergeCommit?.oid ?? ''} (merged by the gate)`.trim());
    } catch (error) {
      state.mergeRetryUntil = state.mergeRetryUntil || now() + DEFAULTS.retryWindowMinutes * 60000;
      if (TRANSIENT_REFUSAL.test(messageOf(error)) && now() < state.mergeRetryUntil) return log(`${state.label}: merge not accepted yet (${messageOf(error).split('\n')[0]}); retrying`);
      return finish(state, EXIT.refused, `merge refused: ${messageOf(error).split('\n')[0]}`);
    }
    return undefined;
  };

  for (;;) {
    const open = states.filter((state) => !state.done);
    if (!open.length) break;
    let data;
    for (let attempt = 1; !data; attempt += 1) {
      try {
        data = await graphql(buildPollQuery(open.map((state) => state.target)));
      } catch (error) {
        if (attempt >= DEFAULTS.pollRetries) throw new UsageError(`GraphQL poll failed: ${messageOf(error).split('\n')[0]}`);
        log(`GraphQL poll failed (${messageOf(error).split('\n')[0]}); retrying in ${DEFAULTS.pollRetrySeconds} s`);
        await sleep(DEFAULTS.pollRetrySeconds * 1000);
      }
    }
    for (const [index, state] of open.entries()) {
      const view = readTarget(state.target, data[`t${index}`]);
      if (!view.exists) {
        finish(state, EXIT.usage, `${state.label} does not exist (or gh cannot read it)`);
        continue;
      }
      if (view.truncated) log(`${state.label}: more than 100 checks reported; only the first 100 are read`);
      if (state.target.kind === 'pr') {
        if (view.merged) {
          finish(state, EXIT.ok, `MERGED ${state.label} ${view.head?.slice(0, 12) ?? ''} (already merged)`.trim());
          continue;
        }
        if (view.closed) {
          finish(state, EXIT.closed, `${state.label} was closed without merging`);
          continue;
        }
        if (state.expect) {
          if (view.head === state.expect) {
            state.seenExpected = true;
            state.headLag = 0;
          } else if (state.seenExpected || state.headLag >= DEFAULTS.headLagRetries) {
            finish(state, EXIT.headMoved, `head moved: expected ${state.expect.slice(0, 12)}, now ${String(view.head).slice(0, 12)}`);
            continue;
          } else {
            state.headLag += 1;
            log(`${state.label}: head is ${String(view.head).slice(0, 12)}, expected ${state.expect.slice(0, 12)}; re-reading (${state.headLag}/${DEFAULTS.headLagRetries})`);
            continue;
          }
        }
        // The rollup belongs to the last commit; right after a push it can still be the previous head's.
        if (view.commitOid !== view.head) {
          log(`${state.label}: checks of ${String(view.commitOid).slice(0, 12)} are not the head's yet`);
          continue;
        }
      }
      const verdict = evaluateChecks({ checks: view.checks, required });
      if (verdict.state === 'red') {
        finish(state, EXIT.red, `RED\n${describeChecks(verdict.failing)}`);
        continue;
      }
      if (options.merge && state.target.kind === 'pr' && !view.autoMerge && !state.mergeNow) {
        try {
          await attemptMerge(state, view);
        } catch (error) {
          finish(state, EXIT.refused, `merge refused: ${messageOf(error).split('\n')[0]}`);
          continue;
        }
      }
      if (verdict.state === 'pending') {
        state.greenPolls = 0;
        log(`${state.label}: waiting for ${[...verdict.pending.map((check) => check.name), ...verdict.missing].join(', ')}`);
        continue;
      }
      state.greenPolls += 1;
      if (state.target.kind === 'pr') {
        if (view.mergeable === 'CONFLICTING') {
          finish(state, EXIT.dirty, `${state.label} has merge conflicts`);
          continue;
        }
        if (view.mergeable === 'UNKNOWN') {
          log(`${state.label}: checks green, mergeability not computed yet`);
          continue;
        }
      }
      if (state.greenPolls < settlePolls) {
        log(`${state.label}: green; confirming on the next poll`);
        continue;
      }
      if (state.target.kind === 'commit' || !options.merge) {
        finish(state, EXIT.ok, `GREEN ${state.label}`);
        continue;
      }
      // Green and mergeable under --merge: auto-merge merges within seconds; after a few polls (or when it is unavailable) merge it here.
      state.settled += 1;
      if (state.mergeNow || state.settled > DEFAULTS.mergedSettlePolls) await mergeIfGreen(state, view);
      else log(`${state.label}: green; waiting for auto-merge`);
    }
    if (states.every((state) => state.done)) break;
    if (now() >= deadline) break;
    if (now() >= nextHeartbeat) {
      nextHeartbeat = now() + DEFAULTS.heartbeatMinutes * 60000;
      log(`still waiting (${clock(now() - started)} of ${options.timeoutMinutes} min)`);
    }
    const rate = data.rateLimit;
    const backoff = rate && rate.remaining < DEFAULTS.rateFloor ? Math.min(Math.max(0, Date.parse(rate.resetAt) - now()), 15 * 60000) : 0;
    if (backoff) log(`GraphQL rate limit low (${rate.remaining}); waiting ${clock(backoff)}`);
    const wait = Math.max(options.interval * 1000, backoff);
    // A head that has not caught up yet is re-read sooner than a normal interval.
    const lagging = states.some((state) => !state.done && state.expect && !state.seenExpected);
    await sleep(Math.min(wait, deadline - now(), lagging ? DEFAULTS.headLagSeconds * 1000 : Infinity));
  }

  const results = states.map((state) => ({ label: state.label, code: state.done?.code ?? EXIT.timeout, text: state.done?.text ?? 'still pending' }));
  const failure = results.find((result) => result.code !== EXIT.ok && result.code !== EXIT.timeout);
  const code = failure ? failure.code : results.some((result) => result.code === EXIT.timeout) ? EXIT.timeout : EXIT.ok;
  return { code, results, resume: code === EXIT.timeout ? resumeCommand(options, results.filter((result) => result.code === EXIT.timeout)) : undefined };
}

export function resumeCommand(options, unfinished) {
  const labels = new Set(unfinished.map((result) => result.label));
  const targets = options.targets.filter((target) => labels.has(targetLabel(target)));
  const words = [options.commit ? '--commit' : '', ...targets.map(targetLabel)].filter(Boolean);
  const heads = options.targets.flatMap((target, index) => (labels.has(targetLabel(target)) && options.expectHeads[index] ? ['--expect-head', options.expectHeads[index]] : []));
  const flags = [options.merge ? '--merge' : '', `--required ${options.required}`, `--interval ${options.interval}`, `--timeout-minutes ${options.timeoutMinutes}`].filter(Boolean);
  return `node scripts/pr-gate.mjs ${[...words, ...heads, ...flags].join(' ')}`;
}

// ---------------------------------------------------------------------------------------------------------------
// gh

function gh(args) {
  const result = spawnSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.error) throw new UsageError(`cannot run gh: ${result.error.message}`);
  return result;
}

export function ghDeps() {
  const auth = gh(['auth', 'status']);
  if (auth.status !== 0) throw new UsageError('gh is not authenticated (gh auth login)');
  return {
    graphql: async (query, variables = {}) => {
      const args = ['api', 'graphql', '-f', `query=${query}`];
      for (const [key, value] of Object.entries(variables)) args.push('-f', `${key}=${value}`);
      const result = gh(args);
      let body;
      try {
        body = JSON.parse(result.stdout || '{}');
      } catch {
        throw new Error(result.stderr.trim() || result.stdout.trim() || `gh exited ${result.status}`);
      }
      // A target that does not exist is NOT_FOUND with a null alias: the gate reports it by name (exit 64), the rest of the batch is kept.
      const fatal = (body.errors ?? []).filter((error) => error.type !== 'NOT_FOUND');
      if (fatal.length || (body.errors?.length && !body.data)) throw new Error((fatal.length ? fatal : body.errors).map((error) => error.message).join('; '));
      if (result.status !== 0 && !body.data) throw new Error(result.stderr.trim() || `gh exited ${result.status}`);
      return body.data;
    },
    now: () => Date.now(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    log: (text) => console.log(`${new Date().toISOString().slice(11, 19)} ${text}`),
  };
}

export async function main(argv, depsFactory = ghDeps) {
  let options;
  try {
    options = parseArgs(argv);
    if (options.help) {
      console.log('usage: node scripts/pr-gate.mjs <owner/repo#N>… [--merge] [--expect-head <sha>]… [--required verify|all|a,b] [--interval 180] [--timeout-minutes 100] [--json]\n       node scripts/pr-gate.mjs --commit <owner/repo@sha>… (see the header of scripts/pr-gate.mjs)');
      return EXIT.ok;
    }
    const outcome = await runGate(options, depsFactory());
    if (options.json) console.log(JSON.stringify(outcome, null, 2));
    if (outcome.resume) console.log(`RESUME ${outcome.resume}`);
    return outcome.code;
  } catch (error) {
    if (error instanceof UsageError) {
      console.error(error.message);
      return EXIT.usage;
    }
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
