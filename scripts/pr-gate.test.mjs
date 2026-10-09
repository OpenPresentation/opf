import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildPollQuery, EXIT, evaluateChecks, normalizeContexts, parseArgs, runGate, summarizeRules, UsageError } from './pr-gate.mjs';
import { selectChecks } from './run-checks.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HEAD = 'a'.repeat(40);
const NEW = 'c'.repeat(40);
const OLD = 'b'.repeat(40);
const T0 = Date.parse('2026-10-07T12:00:00Z');
const RULES = [
  { type: 'required_status_checks', parameters: { required_status_checks: [{ context: 'packages', integration_id: 15368 }, { context: 'Verify OPF packages', integration_id: 15368 }] } },
  { type: 'merge_queue', parameters: { merge_method: 'SQUASH' } },
];
const NO_QUEUE_RULES = [RULES[0]];
const notFound = Object.assign(new Error('HTTP 404'), { status: 404 });

let nextId = 1;
function run(name, conclusion = 'SUCCESS', { status = 'COMPLETED', oid = HEAD, app = 15368, runId = 900, at = '2026-10-07T11:00:00Z', id = nextId++, workflow = 'CI', attempt = 1 } = {}) {
  return {
    __typename: 'CheckRun',
    databaseId: id,
    name,
    status,
    conclusion: status === 'COMPLETED' ? conclusion : null,
    detailsUrl: `https://github.com/o/r/actions/runs/${runId}/job/${id}`,
    startedAt: at,
    checkSuite: { commit: { oid }, app: { slug: 'github-actions', databaseId: app }, workflowRun: { databaseId: runId, event: 'pull_request', runAttempt: attempt, workflow: { name: workflow } } },
  };
}
const pending = (name, options = {}) => run(name, null, { status: 'IN_PROGRESS', ...options });
function status(context, state, { oid = HEAD } = {}) {
  return { __typename: 'StatusContext', context, state, targetUrl: `https://ci.example/${context}`, createdAt: '2026-10-07T11:00:00Z', commit: { oid } };
}
const GREEN = () => [run('packages'), run('Verify OPF packages')];

function pr({ head = HEAD, contexts = [], mergeable = 'MERGEABLE', mss = 'CLEAN', state = 'OPEN', merged = false, inQueue = false, removedAt = null, removalReason = 'MERGE_GROUP_FAILED', draft = false, suites = [], commitOid = head, mergeCommit = null, more = null }) {
  return {
    id: 'PR_1',
    number: 7,
    state,
    merged,
    isDraft: draft,
    mergeCommit: mergeCommit ? { oid: mergeCommit } : null,
    headRefOid: head,
    baseRefName: 'main',
    mergeable,
    mergeStateStatus: mss,
    isInMergeQueue: inQueue,
    mergeQueueEntry: inQueue ? { state: 'AWAITING_CHECKS', position: 1 } : null,
    timelineItems: { nodes: removedAt ? [{ reason: removalReason, createdAt: new Date(removedAt).toISOString() }] : [] },
    commits: { nodes: [{ commit: { oid: commitOid, statusCheckRollup: { state: 'X', contexts: { totalCount: contexts.length, pageInfo: { hasNextPage: Boolean(more), endCursor: more ? 'c1' : null }, nodes: contexts } }, checkSuites: { nodes: suites } } }] },
  };
}
function poll(nodes, { remaining = 4000, resetAt = '2026-10-07T13:00:00Z', queue = true } = {}) {
  const list = Array.isArray(nodes) ? nodes : [nodes];
  const repo = { defaultBranchRef: { name: 'main' }, mq0: queue ? { id: 'MQ' } : null };
  list.forEach((node, index) => {
    repo[`t${index}`] = node;
  });
  return { data: { rateLimit: { remaining, resetAt, cost: 1 }, r0: repo } };
}

/** Fake gh: polls are served in order (the last one repeats); mutations in order; rules for every rules/branches read. */
function fake({ polls, mutations = [], rules = RULES, more = null }) {
  let now = T0;
  const state = { lines: [], sleeps: [], queries: [], mutations: [], rest: [] };
  const deps = {
    async graphql(query, variables) {
      if (query.startsWith('mutation')) {
        state.mutations.push({ query, variables });
        const next = mutations.shift();
        if (!next) throw new Error('unexpected mutation');
        return next;
      }
      if (query.includes('after:')) return more;
      state.queries.push(query);
      const next = polls.length > 1 ? polls.shift() : polls[0];
      return typeof next === 'function' ? next(now) : next;
    },
    async rest(url, init = {}) {
      state.rest.push(`${init.method ?? 'GET'} ${url}`);
      if (url.includes('/rules/branches/')) {
        if (rules instanceof Error) throw rules;
        return rules;
      }
      return {};
    },
    async sleep(ms) {
      state.sleeps.push(ms);
      now += ms;
    },
    now: () => now,
    log: (line) => state.lines.push(line),
  };
  return { deps, state };
}
const gate = (argv, deps) => runGate(parseArgs(argv), deps);
const has = (lines, pattern) => lines.some((line) => pattern.test(line));

// -- evaluation ---------------------------------------------------------------------------------------------------

test('zero checks is never green, with or without a ruleset', async () => {
  const required = summarizeRules(RULES).required;
  assert.equal(evaluateChecks({ checks: [], required }).state, 'pending');
  assert.equal(evaluateChecks({ checks: [], required: null }).state, 'pending');
  const { deps, state } = fake({ polls: [poll(pr({ contexts: [] }))], rules: notFound });
  const result = await gate(['o/r#7', '--timeout-minutes', '7'], deps);
  assert.equal(result.code, EXIT.timeout);
  assert.ok(has(state.lines, /no checks reported/));
});

test('a failing check that is not required does not block; a failing required check is red with its URL', async () => {
  const ok = fake({ polls: [poll(pr({ contexts: [...GREEN(), run('lint', 'FAILURE'), run('Cursor Bugbot', 'FAILURE')] }))] });
  const green = await gate(['o/r#7'], ok.deps);
  assert.equal(green.code, EXIT.ok);
  assert.ok(has(ok.state.lines, /^.{8} GREEN o\/r#7 a{40}/));

  const bad = fake({ polls: [poll(pr({ contexts: [run('packages', 'FAILURE', { runId: 42 }), run('Verify OPF packages')] }))] });
  const red = await gate(['o/r#7'], bad.deps);
  assert.equal(red.code, EXIT.red);
  assert.equal(bad.state.queries.length, 1, 'red stops at once, no further polls');
  assert.ok(has(bad.state.lines, /RED o\/r#7/));
  assert.ok(has(bad.state.lines, /packages \(FAILURE\) https:\/\/github\.com\/o\/r\/actions\/runs\/42\//));
});

test('every red conclusion of a required check is red; cancelled and timed out included', () => {
  const required = summarizeRules(RULES).required;
  for (const conclusion of ['FAILURE', 'CANCELLED', 'TIMED_OUT', 'STARTUP_FAILURE', 'ACTION_REQUIRED']) {
    assert.equal(evaluateChecks({ checks: normalizeContexts([run('packages', conclusion), run('Verify OPF packages')], HEAD), required }).state, 'red', conclusion);
  }
  const skipped = normalizeContexts([run('packages', 'SKIPPED'), run('Verify OPF packages', 'NEUTRAL')], HEAD);
  assert.equal(evaluateChecks({ checks: skipped, required }).state, 'green');
  assert.equal(evaluateChecks({ checks: skipped, required, allowSkipped: false }).state, 'red');
});

test('a required check that has not registered yet is pending, not green', async () => {
  const { deps, state } = fake({ polls: [poll(pr({ contexts: [run('packages')] })), poll(pr({ contexts: GREEN() }))] });
  const result = await gate(['o/r#7'], deps);
  assert.equal(result.code, EXIT.ok);
  assert.equal(state.queries.length, 2);
  assert.ok(has(state.lines, /not reported yet: Verify OPF packages/));
});

test('a required check from another app does not satisfy the ruleset', () => {
  const required = summarizeRules(RULES).required;
  const checks = normalizeContexts([run('packages', 'SUCCESS', { app: 999 }), run('Verify OPF packages')], HEAD);
  assert.deepEqual(evaluateChecks({ checks, required }).missing, ['packages']);
});

test('mergeable UNKNOWN is pending until GitHub has computed it', async () => {
  const { deps, state } = fake({ polls: [poll(pr({ contexts: GREEN(), mergeable: 'UNKNOWN', mss: 'UNKNOWN' })), poll(pr({ contexts: GREEN() }))] });
  const result = await gate(['o/r#7'], deps);
  assert.equal(result.code, EXIT.ok);
  assert.equal(state.queries.length, 2);
  assert.ok(has(state.lines, /mergeability not computed yet/));
});

test('a merge conflict (DIRTY) exits 2 and a closed PR exits 3', async () => {
  const dirty = fake({ polls: [poll(pr({ contexts: GREEN(), mergeable: 'CONFLICTING', mss: 'DIRTY' }))] });
  assert.equal((await gate(['o/r#7', '--merge'], dirty.deps)).code, EXIT.dirty);
  assert.ok(has(dirty.state.lines, /DIRTY o\/r#7/));
  const closed = fake({ polls: [poll(pr({ state: 'CLOSED' }))] });
  assert.equal((await gate(['o/r#7'], closed.deps)).code, EXIT.closed);
});

test('checks reported for an older head are ignored', async () => {
  const contexts = [run('packages', 'FAILURE', { oid: OLD }), run('Verify OPF packages')];
  const stale = normalizeContexts(contexts, HEAD);
  assert.deepEqual(stale.map((check) => check.name), ['Verify OPF packages']);
  const { deps, state } = fake({ polls: [poll(pr({ contexts })), poll(pr({ contexts: GREEN() }))] });
  assert.equal((await gate(['o/r#7'], deps)).code, EXIT.ok, 'the old red run does not make the new head red');
  assert.ok(has(state.lines, /not reported yet: packages/));
  // A rollup that still belongs to the previous commit counts as no checks at all.
  const lag = fake({ polls: [poll(pr({ contexts: GREEN(), commitOid: OLD })), poll(pr({ contexts: GREEN() }))] });
  assert.equal((await gate(['o/r#7'], lag.deps)).code, EXIT.ok);
  assert.ok(has(lag.state.lines, /rollup is for an older commit/));
});

test('a new head resets the evaluation without --expect-head and exits 4 with it', async () => {
  const polls = () => [poll(pr({ contexts: [run('packages'), pending('Verify OPF packages')] })), poll(pr({ head: NEW, contexts: [run('packages', 'SUCCESS', { oid: NEW }), run('Verify OPF packages', 'SUCCESS', { oid: NEW })] }))];
  const free = fake({ polls: polls() });
  const result = await gate(['o/r#7'], free.deps);
  assert.equal(result.code, EXIT.ok);
  assert.equal(result.results[0].head, NEW);
  assert.ok(has(free.state.lines, /head moved aaaaaaaa -> cccccccc; evaluating the new head/));

  const pinned = fake({ polls: polls() });
  assert.equal((await gate(['o/r#7', '--expect-head', HEAD], pinned.deps)).code, EXIT.headMoved);
  assert.ok(has(pinned.state.lines, /HEAD-MOVED o\/r#7: expected aaaaaaaaaaaa, the head is now cccccccccccc/));
  const wrongFromStart = fake({ polls: [poll(pr({ contexts: GREEN() }))] });
  assert.equal((await gate(['o/r#7', '--expect-head', NEW.slice(0, 7)], wrongFromStart.deps)).code, EXIT.headMoved);
});

test('StatusContext (commit statuses) counts as a check', async () => {
  const rules = [{ type: 'required_status_checks', parameters: { required_status_checks: [{ context: 'packages' }, { context: 'ci/legacy' }] } }];
  const required = summarizeRules(rules).required;
  const at = (state) => evaluateChecks({ checks: normalizeContexts([run('packages'), status('ci/legacy', state)], HEAD), required }).state;
  assert.equal(at('PENDING'), 'pending');
  assert.equal(at('EXPECTED'), 'pending');
  assert.equal(at('ERROR'), 'red');
  assert.equal(at('FAILURE'), 'red');
  assert.equal(at('SUCCESS'), 'green');
  assert.equal(evaluateChecks({ checks: normalizeContexts([run('packages'), status('ci/legacy', 'SUCCESS', { oid: OLD })], HEAD), required }).state, 'pending');
  const { deps } = fake({ polls: [poll(pr({ contexts: [run('packages'), status('ci/legacy', 'FAILURE')] }))], rules });
  assert.equal((await gate(['o/r#7'], deps)).code, EXIT.red);
});

test('without a ruleset every check counts except neutral bots, Actions suites must be complete, and green is confirmed twice', async () => {
  const suite = (status) => ({ status, conclusion: null, app: { slug: 'github-actions' }, workflowRun: { databaseId: 1, event: 'pull_request' } });
  const idleApp = { status: 'QUEUED', conclusion: null, app: { slug: 'cursor' }, workflowRun: null };
  const checks = normalizeContexts([run('build'), pending('Cursor Bugbot')], HEAD);
  assert.equal(evaluateChecks({ checks, required: null, suites: [suite('IN_PROGRESS')] }).state, 'pending', 'a job behind needs: has no check run yet');
  assert.equal(evaluateChecks({ checks, required: null, suites: [suite('COMPLETED'), idleApp] }).state, 'green');
  const { deps, state } = fake({ polls: [poll(pr({ contexts: [run('build')], suites: [suite('COMPLETED')] }))], rules: notFound });
  assert.equal((await gate(['o/r#7'], deps)).code, EXIT.ok);
  assert.equal(state.queries.length, 2, 'green on two consecutive polls');
  assert.ok(has(state.lines, /confirming at the next poll/));
});

// -- merging ------------------------------------------------------------------------------------------------------

test('--merge enqueues with the expected head and retries while mergeability has not been computed', async () => {
  const notYet = { data: { enqueuePullRequest: null }, errors: [{ message: 'Pull request mergeability check has not yet completed.' }] };
  const { deps, state } = fake({
    polls: [poll(pr({ contexts: GREEN() })), poll(pr({ contexts: GREEN(), inQueue: true })), poll(pr({ state: 'MERGED', merged: true, mergeCommit: 'd'.repeat(40) }))],
    mutations: [notYet, notYet, { data: { enqueuePullRequest: { mergeQueueEntry: { state: 'QUEUED', position: 2 } } } }],
  });
  const result = await gate(['o/r#7', '--merge'], deps);
  assert.equal(result.code, EXIT.ok);
  assert.equal(state.mutations.length, 3);
  assert.ok(state.mutations.every((call) => call.query.includes('enqueuePullRequest') && call.variables.head === HEAD && call.variables.id === 'PR_1'));
  assert.deepEqual(state.sleeps.slice(0, 2), [60000, 60000]);
  assert.ok(has(state.lines, /^.{8} MERGED o\/r#7 d{40} \(merged by the merge queue\)$/));
  assert.equal(state.rest.length, 1, 'REST only for the ruleset, once');
});

test('the enqueue retry gives up after 6 minutes and exits 5', async () => {
  const notYet = { data: { enqueuePullRequest: null }, errors: [{ message: 'Required status checks are expected.' }] };
  const { deps, state } = fake({ polls: [poll(pr({ contexts: GREEN() }))], mutations: Array.from({ length: 20 }, () => notYet) });
  assert.equal((await gate(['o/r#7', '--merge'], deps)).code, EXIT.ejected);
  assert.equal(state.mutations.length, 7, 'the first try and 6 retries, a minute apart');
  assert.ok(has(state.lines, /REFUSED o\/r#7: enqueue failed/));
});

test('an ejected PR that is still green is re-enqueued once; a second ejection exits 5', async () => {
  const enqueued = { data: { enqueuePullRequest: { mergeQueueEntry: { state: 'QUEUED', position: 1 } } } };
  const { deps, state } = fake({
    polls: [
      poll(pr({ contexts: GREEN() })),
      poll(pr({ contexts: GREEN(), inQueue: true })),
      (now) => poll(pr({ contexts: GREEN(), removedAt: now })),
      poll(pr({ contexts: GREEN(), inQueue: true })),
      (now) => poll(pr({ contexts: GREEN(), removedAt: now })),
    ],
    mutations: [enqueued, enqueued],
  });
  const result = await gate(['o/r#7', '--merge'], deps);
  assert.equal(result.code, EXIT.ejected);
  assert.equal(state.mutations.length, 2, 'one re-enqueue only');
  assert.ok(has(state.lines, /ejected from the merge queue \(MERGE_GROUP_FAILED\); re-enqueueing once/));
  assert.ok(has(state.lines, /EJECTED o\/r#7: removed from the merge queue twice \(MERGE_GROUP_FAILED\)/));
});

test('leaving the queue without a removal event is confirmed on a second poll (a merge in progress is not an ejection)', async () => {
  const { deps, state } = fake({
    polls: [poll(pr({ contexts: GREEN(), inQueue: true })), poll(pr({ contexts: GREEN() })), poll(pr({ state: 'MERGED', merged: true, mergeCommit: 'e'.repeat(40) }))],
  });
  assert.equal((await gate(['o/r#7', '--merge'], deps)).code, EXIT.ok);
  assert.equal(state.mutations.length, 0, 'an already-queued PR is followed, not enqueued again');
});

test('a repository without a merge queue is squash-merged with the expected head', async () => {
  const { deps, state } = fake({
    polls: [poll(pr({ contexts: GREEN(), mss: 'UNSTABLE' }), { queue: false })],
    rules: NO_QUEUE_RULES,
    mutations: [{ data: { mergePullRequest: { pullRequest: { merged: true, mergeCommit: { oid: 'f'.repeat(40) } } } } }],
  });
  assert.equal((await gate(['o/r#7', '--merge'], deps)).code, EXIT.ok);
  assert.match(state.mutations[0].query, /mergePullRequest\(input:\{pullRequestId:\$id,mergeMethod:SQUASH,expectedHeadOid:\$head\}/);
  assert.ok(has(state.lines, /MERGED o\/r#7 f{40}/));
});

test('an already-merged PR exits 0 without REST calls or mutations', async () => {
  const { deps, state } = fake({ polls: [poll(pr({ state: 'MERGED', merged: true, mergeCommit: 'd'.repeat(40) }))] });
  const result = await gate(['o/r#7', '--merge'], deps);
  assert.equal(result.code, EXIT.ok);
  assert.equal(result.results[0].outcome, 'merged');
  assert.equal(state.rest.length + state.mutations.length, 0);
});

test('a draft is green without --merge but is not merged', async () => {
  const plain = fake({ polls: [poll(pr({ contexts: GREEN(), draft: true, mss: 'DRAFT' }))] });
  assert.equal((await gate(['o/r#7'], plain.deps)).code, EXIT.ok);
  const merging = fake({ polls: [poll(pr({ contexts: GREEN(), draft: true, mss: 'DRAFT' }))] });
  assert.equal((await gate(['o/r#7', '--merge', '--timeout-minutes', '5'], merging.deps)).code, EXIT.timeout);
  assert.equal(merging.state.mutations.length, 0);
});

// -- RR-67: queue merges, superseded runs, head lag -----------------------------------------------------------------

const MERGE_SHA = 'd'.repeat(40);
const enqueued = { data: { enqueuePullRequest: { mergeQueueEntry: { state: 'QUEUED', position: 1 } } } };

test('RR-67: a PR the merge queue merged is MERGED (exit 0), also while its removal shows before the merged state', async () => {
  const { deps, state } = fake({
    polls: [
      poll(pr({ contexts: GREEN(), inQueue: true })),
      // The queue records a removal with the reason "merged" in the same second as the merge; the PR still reads as open.
      (now) => poll(pr({ contexts: GREEN(), removedAt: now, removalReason: 'merged' })),
      poll(pr({ state: 'MERGED', merged: true, mergeCommit: MERGE_SHA })),
    ],
  });
  const result = await gate(['o/r#7', '--merge'], deps);
  assert.equal(result.code, EXIT.ok);
  assert.equal(result.results[0].outcome, 'merged');
  assert.equal(result.results[0].via, 'merge-queue');
  assert.equal(state.queries.length, 3);
  assert.equal(state.mutations.length, 0);
  assert.ok(has(state.lines, /the merge queue merged it/));
  assert.ok(has(state.lines, /MERGED o\/r#7 d{40} \(merged by the merge queue\)/));
  assert.ok(!has(state.lines, /EJECTED|ejected/));

  // Merged state visible on the very first poll after the removal: no waiting at all.
  const direct = fake({ polls: [poll(pr({ contexts: GREEN(), inQueue: true })), poll(pr({ state: 'MERGED', merged: true, mergeCommit: MERGE_SHA }))] });
  assert.equal((await gate(['o/r#7', '--merge'], direct.deps)).code, EXIT.ok);
});

test('RR-67: a "merged" removal on a PR that never reads as merged is handled as an ejection after a bounded wait', async () => {
  const { deps, state } = fake({
    polls: [poll(pr({ contexts: GREEN(), inQueue: true })), (now) => poll(pr({ contexts: GREEN(), removedAt: now, removalReason: 'merged' }))],
    mutations: [enqueued],
  });
  const result = await gate(['o/r#7', '--merge', '--timeout-minutes', '60'], deps);
  assert.equal(result.code, EXIT.ejected);
  assert.equal(state.mutations.length, 1, 'one re-enqueue only');
  assert.ok(has(state.lines, /ejected from the merge queue \(the queue reported "merged" but the PR never read as merged\)/));
  assert.equal(state.lines.filter((line) => /waiting for the merged state/.test(line)).length >= 2, true, 'it waited before giving up');
});

test('RR-67: a queue ejection for failed checks or by hand is still EJECTED', async () => {
  for (const reason of ['failed_checks', 'manual']) {
    const { deps, state } = fake({
      polls: [
        poll(pr({ contexts: GREEN(), inQueue: true })),
        (now) => poll(pr({ contexts: GREEN(), removedAt: now, removalReason: reason })),
        poll(pr({ contexts: GREEN(), inQueue: true })),
        (now) => poll(pr({ contexts: GREEN(), removedAt: now, removalReason: reason })),
      ],
      mutations: [enqueued],
    });
    const result = await gate(['o/r#7', '--merge'], deps);
    assert.equal(result.code, EXIT.ejected, reason);
    assert.equal(result.results[0].outcome, 'ejected');
    assert.equal(state.mutations.length, 1, 'one re-enqueue only');
    assert.ok(has(state.lines, new RegExp(`EJECTED o/r#7: removed from the merge queue twice \\(${reason}\\)`)));
    assert.ok(!has(state.lines, /merged by the merge queue/));
  }
});

test('RR-67: a superseded failed run of the same job is ignored once a newer run of it went green', async () => {
  const required = summarizeRules(RULES).required;
  // A re-run (same workflow run, attempt 2: a new check run with a higher id) and a newer workflow run.
  const rerun = normalizeContexts([run('packages', 'FAILURE', { runId: 900, id: 10, attempt: 1 }), run('packages', 'SUCCESS', { runId: 900, id: 11, attempt: 2, at: '2026-10-07T11:05:00Z' }), run('Verify OPF packages', 'SUCCESS', { id: 12 })], HEAD);
  assert.equal(evaluateChecks({ checks: rerun, required }).state, 'green');
  const newer = normalizeContexts([run('packages', 'FAILURE', { runId: 900, id: 10 }), run('packages', 'SUCCESS', { runId: 905, id: 20, at: '2026-10-07T11:30:00Z' }), run('Verify OPF packages', 'SUCCESS', { runId: 905, id: 21 })], HEAD);
  assert.equal(evaluateChecks({ checks: newer, required }).state, 'green');
  // A run cancelled before it started has no start time; it must not read as the newest report.
  const cancelled = normalizeContexts([run('packages', 'CANCELLED', { runId: 900, id: 10, at: null }), run('packages', 'SUCCESS', { runId: 905, id: 20 }), run('Verify OPF packages', 'SUCCESS', { runId: 905, id: 21 })], HEAD);
  assert.equal(evaluateChecks({ checks: cancelled, required }).state, 'green');
  // The same without a ruleset ("all checks" mode) and through the gate.
  assert.equal(evaluateChecks({ checks: newer, required: null }).state, 'green');
  const contexts = [run('packages', 'FAILURE', { runId: 900, id: 10 }), run('Verify OPF packages', 'FAILURE', { runId: 900, id: 11 }), run('packages', 'SUCCESS', { runId: 905, id: 20 }), run('Verify OPF packages', 'SUCCESS', { runId: 905, id: 21 })];
  const { deps, state } = fake({ polls: [poll(pr({ contexts }))] });
  const result = await gate(['o/r#7'], deps);
  assert.equal(result.code, EXIT.ok);
  assert.ok(has(state.lines, /GREEN o\/r#7/));
  assert.ok(!has(state.lines, /RED/));
});

test('RR-67: a newer failed run after an older green run of the same job is RED', async () => {
  const required = summarizeRules(RULES).required;
  const checks = normalizeContexts([run('packages', 'SUCCESS', { runId: 900, id: 10 }), run('packages', 'FAILURE', { runId: 905, id: 20, at: '2026-10-07T11:30:00Z' }), run('Verify OPF packages', 'SUCCESS', { runId: 905, id: 21 })], HEAD);
  const verdict = evaluateChecks({ checks, required });
  assert.equal(verdict.state, 'red');
  assert.deepEqual(verdict.failing.map((check) => check.name), ['packages']);
  const { deps, state } = fake({ polls: [poll(pr({ contexts: [run('packages', 'SUCCESS', { runId: 900, id: 10 }), run('packages', 'FAILURE', { runId: 905, id: 20 }), run('Verify OPF packages')] }))] });
  assert.equal((await gate(['o/r#7'], deps)).code, EXIT.red);
  assert.ok(has(state.lines, /RED o\/r#7/));
});

test('RR-67: jobs with the same name in different workflows do not hide each other', () => {
  const required = summarizeRules(RULES).required;
  const checks = normalizeContexts([run('packages', 'FAILURE', { workflow: 'Other', runId: 910, id: 30 }), run('packages', 'SUCCESS', { workflow: 'CI', runId: 905, id: 20 }), run('Verify OPF packages', 'SUCCESS', { id: 21 })], HEAD);
  assert.equal(evaluateChecks({ checks, required }).state, 'red');
  assert.equal(evaluateChecks({ checks, required: null }).state, 'red');
});

test('RR-67: a lagging head with --expect-head is re-read and proceeds once GitHub serves the new head', async () => {
  const fresh = (oid) => [run('packages', 'SUCCESS', { oid }), run('Verify OPF packages', 'SUCCESS', { oid })];
  const { deps, state } = fake({ polls: [poll(pr({ head: OLD, contexts: fresh(OLD) })), poll(pr({ head: OLD, contexts: fresh(OLD) })), poll(pr({ head: NEW, contexts: fresh(NEW) }))] });
  const result = await gate(['o/r#7', '--expect-head', NEW], deps);
  assert.equal(result.code, EXIT.ok);
  assert.equal(result.results[0].head, NEW);
  assert.equal(state.queries.length, 3, 'the poll and two single-PR re-reads');
  assert.deepEqual(state.sleeps, [15000, 15000]);
  assert.ok(has(state.lines, /head is bbbbbbbbbbbb, expected cccccccccccc; re-reading in 15 s \(1\/3\)/));
  assert.ok(!has(state.lines, /HEAD-MOVED/));
  assert.match(state.queries[1], /^query\{rateLimit.*t0: pullRequest\(number:7\)/);
});

test('RR-67: an expected head that never shows up exits 4 after three re-reads; a head that moves later exits 4 at once', async () => {
  const lagging = fake({ polls: [poll(pr({ head: OLD, contexts: GREEN() }))] });
  const result = await gate(['o/r#7', '--expect-head', NEW], lagging.deps);
  assert.equal(result.code, EXIT.headMoved);
  assert.equal(lagging.state.queries.length, 4, 'the poll and three re-reads, no more');
  assert.deepEqual(lagging.state.sleeps, [15000, 15000, 15000]);
  assert.ok(has(lagging.state.lines, /HEAD-MOVED o\/r#7: expected cccccccccccc, the head is now bbbbbbbbbbbb/));

  // Once the expected head was seen, a different head is a real move: no retries.
  const moved = fake({ polls: [poll(pr({ head: NEW, contexts: [run('packages', 'SUCCESS', { oid: NEW }), pending('Verify OPF packages', { oid: NEW })] })), poll(pr({ head: OLD, contexts: GREEN() }))] });
  assert.equal((await gate(['o/r#7', '--expect-head', NEW], moved.deps)).code, EXIT.headMoved);
  assert.equal(moved.state.queries.length, 2);
  assert.ok(!moved.state.sleeps.includes(15000));

  // A merged PR is reported as merged, not as a moved head, even if the head differs.
  const merged = fake({ polls: [poll(pr({ head: OLD, state: 'MERGED', merged: true, mergeCommit: MERGE_SHA }))] });
  assert.equal((await gate(['o/r#7', '--expect-head', NEW], merged.deps)).code, EXIT.ok);
  assert.equal(merged.state.queries.length, 1);
});

// -- loop behaviour -----------------------------------------------------------------------------------------------

test('timeout exits 75 with a RESUME line, polls once per interval and logs only changes', async () => {
  const { deps, state } = fake({ polls: [poll(pr({ contexts: [run('packages'), pending('Verify OPF packages')] }))] });
  const result = await gate(['o/r#7', '--merge', '--timeout-minutes', '10', '--rerun-once'], deps);
  assert.equal(result.code, EXIT.timeout);
  assert.ok(state.sleeps.every((ms) => ms <= 180000));
  assert.equal(state.queries.length, 5, 'polls at 0, 3, 6, 9 and 10 minutes');
  assert.equal(state.lines.filter((line) => /running: Verify OPF packages/.test(line)).length, 1, 'an unchanged state is printed once');
  assert.equal(result.resume, 'node scripts/pr-gate.mjs o/r#7 --merge --timeout-minutes 10 --rerun-once');
  assert.ok(has(state.lines, /RESUME: node scripts\/pr-gate\.mjs o\/r#7 --merge/));
});

test('a heartbeat is printed every 15 minutes while nothing changes', async () => {
  const { deps, state } = fake({ polls: [poll(pr({ contexts: [run('packages'), pending('Verify OPF packages')] }))] });
  await gate(['o/r#7', '--timeout-minutes', '40'], deps);
  assert.equal(state.lines.filter((line) => line.includes('heartbeat')).length, 2);
});

test('the GraphQL rate limit below 200 backs off until resetAt', async () => {
  const resetAt = new Date(T0 + 20 * 60000).toISOString();
  const { deps, state } = fake({ polls: [poll(pr({ contexts: [run('packages'), pending('Verify OPF packages')] }), { remaining: 150, resetAt }), poll(pr({ contexts: GREEN() }))] });
  assert.equal((await gate(['o/r#7'], deps)).code, EXIT.ok);
  assert.equal(state.sleeps[0], 20 * 60000 + 5000);
  assert.equal(state.queries.length, 2, 'no extra poll during the back-off');
  assert.ok(has(state.lines, /rate limit: 150 points left; backing off/));
});

test('--rerun-once re-runs failed and cancelled runs once, then a second red stops', async () => {
  const redPoll = () => poll(pr({ contexts: [run('packages', 'FAILURE', { runId: 41 }), run('Verify OPF packages', 'CANCELLED', { runId: 42 })] }));
  const { deps, state } = fake({
    polls: [redPoll(), poll(pr({ contexts: [pending('packages', { runId: 41, at: null }), pending('Verify OPF packages', { runId: 42, at: null })] })), poll(pr({ contexts: [run('packages', 'FAILURE', { runId: 41, at: '2026-10-07T12:05:00Z' }), run('Verify OPF packages')] }))],
  });
  assert.equal((await gate(['o/r#7', '--rerun-once'], deps)).code, EXIT.red);
  assert.deepEqual(state.rest.filter((call) => call.startsWith('POST')), ['POST repos/o/r/actions/runs/41/rerun-failed-jobs', 'POST repos/o/r/actions/runs/42/rerun']);
});

test('several PRs share one GraphQL query per poll and one ruleset read per repository', async () => {
  const { deps, state } = fake({ polls: [poll([pr({ contexts: [run('packages')] }), pr({ contexts: GREEN() })]), poll([pr({ contexts: GREEN() })])] });
  const result = await gate(['o/r#7', 'o/r#8'], deps);
  assert.equal(result.code, EXIT.ok);
  assert.equal(state.queries.length, 2);
  assert.match(state.queries[0], /t0: pullRequest\(number:7\).*t1: pullRequest\(number:8\)/);
  assert.doesNotMatch(state.queries[1], /number:8/, 'a finished PR is no longer polled');
  assert.match(state.queries[1], /mq0: mergeQueue\(branch:"main"\)/);
  assert.equal(state.rest.length, 1);
});

test('the first failure wins the exit code of a batch; an unknown PR exits 64', async () => {
  const { deps } = fake({ polls: [poll([pr({ contexts: GREEN() }), pr({ contexts: GREEN(), mergeable: 'CONFLICTING', mss: 'DIRTY' })])] });
  assert.equal((await gate(['o/r#7', 'o/r#8'], deps)).code, EXIT.dirty);
  const missing = fake({ polls: [{ data: { rateLimit: { remaining: 4000 }, r0: { defaultBranchRef: { name: 'main' }, t0: null } }, errors: [{ path: ['r0', 't0'], message: 'Could not resolve to a PullRequest with the number of 99.' }] }] });
  const result = await gate(['o/r#99'], missing.deps);
  assert.equal(result.code, EXIT.usage);
});

test('a gh authentication failure stops at once instead of retrying until the timeout', async () => {
  const { deps } = fake({ polls: [] });
  deps.graphql = async () => {
    throw new Error('To get started with GitHub CLI, please run:  gh auth login');
  };
  await assert.rejects(gate(['o/r#7'], deps), UsageError);
});

test('--commit waits for a commit and reads more than 100 contexts through GraphQL', async () => {
  const commitPoll = (contexts, more) => ({ data: { rateLimit: { remaining: 4000 }, r0: { defaultBranchRef: { name: 'main' }, t0: pr({ contexts, more }).commits.nodes[0].commit } } });
  const extra = { data: { repository: { object: { statusCheckRollup: { contexts: { pageInfo: { hasNextPage: false }, nodes: [run('Verify OPF packages')] } } } } } };
  const { deps, state } = fake({ polls: [commitPoll([run('packages')], true)], more: extra });
  const result = await gate(['--commit', `o/r@${HEAD}`], deps);
  assert.equal(result.code, EXIT.ok);
  assert.match(state.queries[0], /t0: object\(expression:"a{40}"\)/);
  assert.ok(has(state.lines, /GREEN o\/r@aaaaaaaaaaaa/));
});

// -- arguments and wiring ---------------------------------------------------------------------------------------

test('parseArgs validates targets and options', () => {
  const options = parseArgs(['OpenPresentation/opf#445', 'https://github.com/OpenPresentation/opf-pptx/pull/12', '--interval', '10', '--required', 'a, b', '--json']);
  assert.deepEqual(options.targets.map((target) => target.number), [445, 12]);
  assert.equal(options.interval, 60, 'the interval is at least 60 s');
  assert.deepEqual(options.required, ['a', 'b']);
  assert.throws(() => parseArgs([]), UsageError);
  assert.throws(() => parseArgs(['o/r#1', 'o/r#2', '--expect-head', HEAD]), /one --expect-head per pull request/);
  assert.throws(() => parseArgs(['o/r#1', 'o/r#1']), /twice/);
  assert.throws(() => parseArgs(['o/r']), UsageError);
  assert.throws(() => parseArgs(['o/r#1', '--bogus']), /unknown option/);
  assert.equal(parseArgs(['--commit', 'o/r@ABCDEF1']).targets[0].sha, 'abcdef1');
});

test('buildPollQuery is one query with rateLimit and escapes names', () => {
  const query = buildPollQuery([{ alias: 'r0', owner: 'o', name: 'r', bases: ['main'], targets: [{ kind: 'pr', alias: 't0', number: 1 }, { kind: 'commit', alias: 't1', sha: 'abc1234' }] }]);
  assert.match(query, /^query\{rateLimit\{remaining resetAt cost\} r0: repository\(owner:"o",name:"r"\)/);
  assert.match(query, /statusCheckRollup\{state contexts\(first:100\)/);
  assert.match(query, /isInMergeQueue/);
  assert.match(query, /t1: object\(expression:"abc1234"\)/);
});

test('check:pr-gate is a root check that run-checks picks up', () => {
  const scripts = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).scripts;
  const config = JSON.parse(readFileSync(path.join(root, 'scripts', 'checks.json'), 'utf8'));
  assert.match(scripts['check:pr-gate'], /pr-gate\.test\.mjs/);
  assert.ok(selectChecks(scripts, config).includes('check:pr-gate'));
});
