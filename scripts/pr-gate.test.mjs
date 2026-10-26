// MR-34: scripts/pr-gate.mjs against a fake GraphQL endpoint and a fake clock. Nothing here touches GitHub.
import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULTS, ENABLE_AUTO_MERGE, EXIT, MAX_CONTEXT_PAGES, MERGE, UsageError, buildPollQuery, describeChecks, evaluateChecks, latestPerName, main, moreContextsQuery, normalizeContexts, parseArgs, parseTarget, resumeCommand, runGate } from './pr-gate.mjs';

const HEAD = 'a'.repeat(40);
const OTHER = 'b'.repeat(40);
const check = (name, conclusion = 'SUCCESS', extra = {}) => ({ __typename: 'CheckRun', name, status: conclusion ? 'COMPLETED' : 'IN_PROGRESS', conclusion, detailsUrl: `https://github.com/o/r/actions/runs/1/job/${name}`, startedAt: '2026-10-22T10:00:00Z', ...extra });
const status = (context, state) => ({ __typename: 'StatusContext', context, state, targetUrl: '', createdAt: '2026-10-22T10:00:00Z' });

/** One polled pull request, as GraphQL answers it. */
const pr = ({ state = 'OPEN', merged = false, mergeable = 'MERGEABLE', head = HEAD, rollupOf = head, contexts = [check('verify')], autoMerge = false, id = 'PR_1' } = {}) => ({
  repository: { pullRequest: { id, state, merged, isDraft: false, mergeable, headRefOid: head, autoMergeRequest: autoMerge ? { enabledAt: 'x' } : null, commits: { nodes: [{ commit: { oid: rollupOf, statusCheckRollup: { contexts: { pageInfo: { hasNextPage: false }, nodes: contexts } } } }] } } },
});
const commitData = (contexts, oid = HEAD) => ({ repository: { object: { oid, statusCheckRollup: { contexts: { pageInfo: { hasNextPage: false }, nodes: contexts } } } } });

/** A fake world: `polls` is a list of answers (one per poll, each an array of per-target data, the last one repeats); mutations are scripted by name. */
function world({ polls, pages = [], mutations = {}, interval = 90, timeoutMinutes = 100, merge = false, required = 'verify', expectHeads = [], targets, commit = false } = {}) {
  const log = [];
  const calls = { queries: 0, mutations: [], sleeps: [], pageQueries: [] };
  let time = 0;
  const deps = {
    now: () => time,
    sleep: async (ms) => {
      calls.sleeps.push(ms);
      time += ms;
    },
    log: (text) => log.push(text),
    graphql: async (query, variables) => {
      if (query.startsWith('mutation')) {
        const name = query.includes('enablePullRequestAutoMerge') ? 'enable' : 'merge';
        calls.mutations.push({ name, variables });
        const handler = mutations[name];
        if (!handler) throw new Error(`unexpected ${name}`);
        return handler(variables, calls.mutations.filter((entry) => entry.name === name).length);
      }
      if (query.includes(', after: ')) {
        // A follow-up page of one rollup: `pages` is a list of answers (a function gets the query), one per page query.
        calls.pageQueries.push(query);
        const page = pages[Math.min(calls.pageQueries.length - 1, pages.length - 1)];
        return typeof page === 'function' ? page(query) : page;
      }
      const answer = polls[Math.min(calls.queries, polls.length - 1)];
      calls.queries += 1;
      // The gate asks only for the targets it has not decided: an answer is positional (all targets open) or keyed by label.
      const asked = [...query.matchAll(/t(\d+): repository\(owner: "([^"]+)", name: "([^"]+)"\) \{ (?:pullRequest\(number: (\d+)\)|object\(expression: "([0-9a-f]+)"\))/g)].map((match) => (match[4] ? `${match[2]}/${match[3]}#${match[4]}` : `${match[2]}/${match[3]}@${match[5]}`));
      return { ...Object.fromEntries(asked.map((label, index) => [`t${index}`, Array.isArray(answer) ? answer[index] : answer[label]])), rateLimit: { remaining: 4000, resetAt: '2026-10-22T11:00:00Z' } };
    },
  };
  const parsed = targets ?? [parseTarget('o/r#7')];
  const options = { targets: parsed, merge, expectHeads, required, interval, timeoutMinutes, json: false, commit };
  return { deps, options, log, calls };
}
const run = (setup) => runGate(setup.options, setup.deps);

/** A first page that says there is more: `contexts` is the page, `cursor` where the next one starts. */
const firstPage = (contexts, cursor = 'c1', oid = HEAD) => {
  const data = pr({ head: oid, contexts });
  data.repository.pullRequest.commits.nodes[0].commit.statusCheckRollup.contexts.pageInfo = { hasNextPage: true, endCursor: cursor };
  return data;
};
/** A later page, as a follow-up query answers it. */
const laterPage = (contexts, { next = null, oid = HEAD } = {}) => ({ repository: { object: { oid, statusCheckRollup: { contexts: { pageInfo: { hasNextPage: Boolean(next), endCursor: next }, nodes: contexts } } } } });
const filler = (count) => Array.from({ length: count }, (_, index) => check(`job-${index}`));

test('the first page holds 100 contexts, comfortably above a full-ci run of about 50 checks, and its cursor is read', () => {
  const query = buildPollQuery([parseTarget('o/r#7')]);
  assert.match(query, /contexts\(first: 100\) \{ pageInfo \{ hasNextPage endCursor \}/);
  assert.ok(100 >= 2 * 50, 'a full-ci PR reports about 50 checks; the page is at least twice that');
  assert.match(moreContextsQuery(parseTarget('o/r#7'), HEAD, 'c"1'), /object\(oid: "a{40}"\).*contexts\(first: 100, after: "c\\"1"\)/);
});

test('more than 100 checks: the gate reads the next pages before it judges, so a failure or a re-run on a later page counts', async () => {
  // red hidden on page 2 (--required all would have gone green on the first 100)
  const hidden = world({ required: 'all', polls: [[firstPage(filler(100))]], pages: [laterPage([check('late-leg', 'FAILURE')])] });
  const red = await run(hidden);
  assert.equal(red.code, EXIT.red);
  assert.match(red.results[0].text, /late-leg: FAILURE/);
  assert.equal(hidden.calls.pageQueries.length, 1);
  assert.match(hidden.calls.pageQueries[0], /after: "c1"/);
  // verify first reported failed on page 1, re-run succeeded on page 2: the newest report wins
  const rerun = await run(world({ polls: [[firstPage([check('verify', 'FAILURE', { startedAt: '2026-10-22T10:00:00Z' }), ...filler(99)])]], pages: [laterPage([check('verify', 'SUCCESS', { startedAt: '2026-10-22T11:00:00Z' })])] }));
  assert.equal(rerun.code, EXIT.ok);
  // verify only on the third page: pages are followed until hasNextPage is false
  const third = world({ polls: [[firstPage(filler(100))]], pages: [laterPage(filler(100), { next: 'c2' }), laterPage([check('verify')])] });
  assert.equal((await run(third)).code, EXIT.ok);
  assert.equal(third.calls.pageQueries.length, 2);
  assert.match(third.calls.pageQueries[1], /after: "c2"/);
  assert.equal(third.calls.queries, 1, 'one batched poll; extra pages only because the rollup needed them');
  // a rollup that fits one page costs no extra query
  const small = world({ polls: [[pr()]] });
  await run(small);
  assert.equal(small.calls.pageQueries.length, 0);
});

test('commit targets page the rollup too', async () => {
  const first = commitData(filler(100));
  first.repository.object.statusCheckRollup.contexts.pageInfo = { hasNextPage: true, endCursor: 'c1' };
  const setup = world({ polls: [[first]], pages: [laterPage([check('verify')])], targets: [parseTarget('o/r@aaaaaaaaaaaa', { commit: true })], commit: true });
  assert.equal((await run(setup)).code, EXIT.ok);
});

test('an incomplete rollup page fails closed: nothing is judged, never green or red from a partial list', async () => {
  const cases = {
    'a failed page query': () => {
      throw new Error('502 Bad Gateway');
    },
    'a page of another commit': laterPage([check('verify')], { oid: OTHER }),
    'a missing commit': { repository: { object: null } },
    'a malformed page': { repository: { object: { oid: HEAD, statusCheckRollup: { contexts: { nodes: [check('verify')] } } } } },
    'a repeated cursor': laterPage(filler(100), { next: 'c1' }),
    'a next page without a cursor': { repository: { object: { oid: HEAD, statusCheckRollup: { contexts: { pageInfo: { hasNextPage: true }, nodes: filler(1) } } } } },
  };
  for (const [name, page] of Object.entries(cases)) {
    // verify succeeded and a failure is on the unread page; the gate must not report green, and never red from the part it has either
    const setup = world({ timeoutMinutes: 5, polls: [[firstPage([check('verify'), ...filler(99)])]], pages: [page] });
    const outcome = await run(setup);
    assert.equal(outcome.code, EXIT.timeout, name);
    assert.ok(setup.log.some((line) => /not judged this poll/.test(line)), name);
  }
  // a rollup longer than MAX_CONTEXT_PAGES further pages is refused too
  let issued = 0;
  const endless = world({ timeoutMinutes: 2, polls: [[firstPage(filler(100))]], pages: [() => laterPage(filler(100), { next: `n${issued++}` })] });
  assert.equal((await run(endless)).code, EXIT.timeout);
  assert.equal(endless.calls.pageQueries.length, MAX_CONTEXT_PAGES * endless.calls.queries, 'at most MAX_CONTEXT_PAGES further pages per poll; the next poll tries again');
  // a transient page failure heals on the next poll
  const heals = world({ polls: [[firstPage(filler(100))]], pages: [() => { throw new Error('502'); }, laterPage([check('verify')])] });
  assert.equal((await run(heals)).code, EXIT.ok);
});

test('arguments: targets, flags, one head per target, and what the shrunk gate no longer accepts', () => {
  assert.deepEqual(parseTarget('OpenPresentation/opf#803'), { kind: 'pr', owner: 'OpenPresentation', name: 'opf', number: 803 });
  assert.deepEqual(parseTarget('https://github.com/o/r/pull/9/'), { kind: 'pr', owner: 'o', name: 'r', number: 9 });
  assert.deepEqual(parseTarget('o/r@ABCDEF1234', { commit: true }), { kind: 'commit', owner: 'o', name: 'r', sha: 'abcdef1234' });
  assert.throws(() => parseTarget('o/r'), UsageError);
  const options = parseArgs(['o/r#1', 'o/r#2', '--merge', '--expect-head', HEAD, '--expect-head', OTHER.toUpperCase(), '--interval', '10', '--required', 'verify,lint']);
  assert.equal(options.merge, true);
  assert.deepEqual(options.expectHeads, [HEAD, OTHER]);
  assert.equal(options.interval, DEFAULTS.minInterval, 'the interval never goes below the minimum');
  assert.equal(options.required, 'verify,lint');
  assert.equal(parseArgs(['o/r#1']).required, 'verify');
  for (const bad of [[], ['o/r#1', '--expect-head'], ['o/r#1', 'o/r#2', '--expect-head', HEAD], ['--commit', 'o/r@abcdef1', '--merge'], ['o/r#1', '--timeout-minutes', '0'], ['o/r#1', '--bogus']]) assert.throws(() => parseArgs(bad), UsageError, bad.join(' '));
  for (const gone of ['--rerun-once', '--rerun-scope', '--no-skipped']) assert.throws(() => parseArgs(['o/r#1', gone]), /unknown option/, gone);
});

test('checks: only the newest report of a name counts; a required check that is missing, pending or skipped is not green', () => {
  const nodes = [check('verify', 'FAILURE', { startedAt: '2026-10-22T10:00:00Z' }), check('verify', 'SUCCESS', { startedAt: '2026-10-22T10:30:00Z' }), status('legacy/ci', 'SUCCESS')];
  const checks = normalizeContexts(nodes);
  assert.deepEqual(latestPerName(checks).map((entry) => [entry.name, entry.state]), [['verify', 'SUCCESS'], ['legacy/ci', 'SUCCESS']]);
  assert.equal(evaluateChecks({ checks, required: ['verify'] }).state, 'green');
  // a newer failure replaces an older success
  assert.equal(evaluateChecks({ checks: normalizeContexts([check('verify', 'SUCCESS'), check('verify', 'FAILURE', { startedAt: '2026-10-22T11:00:00Z' })]), required: ['verify'] }).state, 'red');
  assert.equal(evaluateChecks({ checks: [], required: ['verify'] }).state, 'pending', 'not registered yet');
  assert.equal(evaluateChecks({ checks: normalizeContexts([check('lint')]), required: ['verify'] }).state, 'pending', 'another check is not verify');
  assert.equal(evaluateChecks({ checks: normalizeContexts([check('verify', null)]), required: ['verify'] }).state, 'pending');
  assert.equal(evaluateChecks({ checks: normalizeContexts([check('verify', 'SKIPPED')]), required: ['verify'] }).state, 'red', 'a skipped verify is not green');
  for (const conclusion of ['FAILURE', 'CANCELLED', 'TIMED_OUT', 'STARTUP_FAILURE', 'ACTION_REQUIRED']) assert.equal(evaluateChecks({ checks: normalizeContexts([check('verify', conclusion)]), required: ['verify'] }).state, 'red', conclusion);
  const all = normalizeContexts([check('verify'), check('nightly-leg', 'SKIPPED'), check('Cursor Bugbot', 'FAILURE'), status('ci/legacy', 'PENDING')]);
  assert.equal(evaluateChecks({ checks: all, required: 'all' }).state, 'pending', 'every check counts in all mode');
  assert.equal(evaluateChecks({ checks: all.filter((entry) => entry.name !== 'ci/legacy'), required: 'all' }).state, 'green', 'skipped and neutral bots do not block all mode');
  assert.equal(evaluateChecks({ checks: [], required: 'all' }).state, 'pending', 'zero checks is never green');
  assert.match(describeChecks(evaluateChecks({ checks: normalizeContexts([check('verify', 'FAILURE')]), required: ['verify'] }).failing), /verify: FAILURE https:\/\/github\.com\/o\/r\/actions/);
});

test('one batched query names every target and the rate limit', () => {
  const query = buildPollQuery([parseTarget('o/r#7'), parseTarget('o/s@abcdef1234', { commit: true })]);
  assert.match(query, /t0: repository\(owner: "o", name: "r"\) \{ pullRequest\(number: 7\)/);
  assert.match(query, /t1: repository\(owner: "o", name: "s"\) \{ object\(expression: "abcdef1234"\)/);
  assert.match(query, /statusCheckRollup/);
  assert.match(query, /rateLimit \{ remaining resetAt \}/);
  assert.equal((query.match(/^query/gm) ?? []).length, 1);
});

test('green: verify passed for the head and the pull request merges cleanly; no merge without --merge', async () => {
  const setup = world({ polls: [[pr()]] });
  const outcome = await run(setup);
  assert.equal(outcome.code, EXIT.ok);
  assert.match(outcome.results[0].text, /^GREEN o\/r#7/);
  assert.deepEqual(setup.calls.mutations, []);
  assert.equal(setup.calls.queries, 1);
});

test('pending polls sleep the interval and then go green', async () => {
  const setup = world({ polls: [[pr({ contexts: [check('verify', null)] })], [pr({ contexts: [check('verify', null)] })], [pr()]], interval: 120 });
  const outcome = await run(setup);
  assert.equal(outcome.code, EXIT.ok);
  assert.deepEqual(setup.calls.sleeps, [120000, 120000]);
  assert.equal(setup.calls.queries, 3);
});

test('red stops at once and names the failing check with its URL', async () => {
  const setup = world({ polls: [[pr({ contexts: [check('lint'), check('verify', 'FAILURE')] })]] });
  const outcome = await run(setup);
  assert.equal(outcome.code, EXIT.red);
  assert.match(outcome.results[0].text, /RED\n {2}verify: FAILURE https:\/\/github\.com\/o\/r\/actions\/runs\/1\/job\/verify/);
  assert.equal(setup.calls.sleeps.length, 0);
});

test('a conflicting, closed, already merged or unknown pull request has its own code', async () => {
  assert.equal((await run(world({ polls: [[pr({ mergeable: 'CONFLICTING' })]] }))).code, EXIT.dirty);
  assert.equal((await run(world({ polls: [[pr({ state: 'CLOSED' })]] }))).code, EXIT.closed);
  const merged = await run(world({ polls: [[pr({ state: 'MERGED', merged: true })]] }));
  assert.equal(merged.code, EXIT.ok);
  assert.match(merged.results[0].text, /^MERGED o\/r#7/);
  assert.equal((await run(world({ polls: [[{ repository: { pullRequest: null } }]] }))).code, EXIT.usage);
  // mergeability not computed yet is waited out, not green
  const unknown = world({ polls: [[pr({ mergeable: 'UNKNOWN' })], [pr()]] });
  assert.equal((await run(unknown)).code, EXIT.ok);
  assert.equal(unknown.calls.queries, 2);
});

test('--expect-head: a lagging head is re-read a few times, a moved head exits 4 at once', async () => {
  const lag = world({ polls: [[pr({ head: OTHER })], [pr({ head: OTHER })], [pr()]], expectHeads: [HEAD] });
  assert.equal((await run(lag)).code, EXIT.ok, 'GitHub caught up on the third read');
  assert.deepEqual(lag.calls.sleeps, [15000, 15000], 'a head that has not caught up is re-read after 15 s');
  const never = world({ polls: [[pr({ head: OTHER })]], expectHeads: [HEAD] });
  const stuck = await run(never);
  assert.equal(stuck.code, EXIT.headMoved);
  assert.equal(never.calls.queries, DEFAULTS.headLagRetries + 1);
  const moved = world({ polls: [[pr({ contexts: [check('verify', null)] })], [pr({ head: OTHER })]], expectHeads: [HEAD] });
  assert.equal((await run(moved)).code, EXIT.headMoved);
  assert.equal(moved.calls.queries, 2, 'once the expected head was seen a change exits at once');
});

test('the checks of the previous head are not the new head\'s: wait for the rollup to catch up', async () => {
  const setup = world({ polls: [[pr({ head: OTHER, rollupOf: HEAD })], [pr({ head: OTHER, rollupOf: OTHER })]] });
  assert.equal((await run(setup)).code, EXIT.ok);
  assert.equal(setup.calls.queries, 2);
});

test('--merge enables auto-merge for the expected head (squash) and follows the pull request until it is merged', async () => {
  const setup = world({
    polls: [[pr({ contexts: [check('verify', null)] })], [pr({ contexts: [check('verify')], autoMerge: true })], [pr({ state: 'MERGED', merged: true, contexts: [check('verify')] })]],
    merge: true,
    expectHeads: [HEAD],
    mutations: { enable: () => ({ enablePullRequestAutoMerge: { pullRequest: { number: 7 } } }) },
  });
  const outcome = await run(setup);
  assert.equal(outcome.code, EXIT.ok);
  assert.match(outcome.results[0].text, /^MERGED o\/r#7/);
  assert.deepEqual(setup.calls.mutations, [{ name: 'enable', variables: { id: 'PR_1', head: HEAD } }]);
  assert.ok(ENABLE_AUTO_MERGE.includes('mergeMethod: SQUASH') && ENABLE_AUTO_MERGE.includes('expectedHeadOid'));
  assert.ok(MERGE.includes('mergeMethod: SQUASH') && MERGE.includes('expectedHeadOid'));
});

test('--merge on a red pull request enables nothing', async () => {
  const setup = world({ polls: [[pr({ contexts: [check('verify', 'FAILURE')] })]], merge: true });
  assert.equal((await run(setup)).code, EXIT.red);
  assert.deepEqual(setup.calls.mutations, []);
});

test('--merge: when auto-merge is not available the gate squash-merges the expected head itself once green', async () => {
  const setup = world({
    polls: [[pr()]],
    merge: true,
    expectHeads: [HEAD],
    mutations: {
      enable: () => {
        throw new Error('Pull request is in clean status');
      },
      merge: () => ({ mergePullRequest: { pullRequest: { merged: true, mergeCommit: { oid: 'c'.repeat(40) } } } }),
    },
  });
  const outcome = await run(setup);
  assert.equal(outcome.code, EXIT.ok);
  assert.match(outcome.results[0].text, /^MERGED o\/r#7 c{40} \(merged by the gate\)/);
  assert.deepEqual(setup.calls.mutations.map((entry) => entry.name), ['enable', 'merge']);
  assert.equal(setup.calls.mutations[1].variables.head, HEAD);
});

test('--merge: a refusal that is not transient exits 5; a transient one is retried', async () => {
  const refused = world({ polls: [[pr()]], merge: true, mutations: { enable: () => { throw new Error('Head branch is not up to date with the base branch'); } } });
  const outcome = await run(refused);
  assert.equal(outcome.code, EXIT.refused);
  assert.match(outcome.results[0].text, /merge refused: Head branch is not up to date/);
  const transient = world({
    polls: [[pr()]],
    merge: true,
    mutations: {
      enable: (_variables, call) => {
        if (call === 1) throw new Error('Pull request mergeability check has not yet completed');
        return { enablePullRequestAutoMerge: { pullRequest: { number: 7 } } };
      },
      merge: () => ({ mergePullRequest: { pullRequest: { merged: true, mergeCommit: { oid: 'd'.repeat(40) } } } }),
    },
  });
  const retried = await run(transient);
  assert.deepEqual(transient.calls.mutations.map((entry) => entry.name).slice(0, 2), ['enable', 'enable'], 'the enable is tried again on the next poll');
  assert.equal(retried.code, EXIT.ok);
});

test('several targets: one query, the first failure in argument order wins; unfinished ones time out with a RESUME line', async () => {
  const targets = [parseTarget('o/r#1'), parseTarget('o/r#2'), parseTarget('o/s#3')];
  const mixed = world({ polls: [[pr({ contexts: [check('verify', 'FAILURE')] }), pr({ mergeable: 'CONFLICTING' }), pr()]], targets });
  const failed = await run(mixed);
  assert.equal(mixed.calls.queries, 1, 'one GraphQL query for all three');
  assert.equal(failed.code, EXIT.red, 'argument order: the red pull request is first');
  assert.deepEqual(failed.results.map((result) => result.code), [EXIT.red, EXIT.dirty, EXIT.ok]);

  const slow = world({ polls: [{ 'o/r#1': pr(), 'o/r#2': pr({ contexts: [check('verify', null)] }), 'o/s#3': pr({ contexts: [check('verify', null)] }) }], targets, timeoutMinutes: 5, expectHeads: [HEAD, HEAD, HEAD], interval: 120 });
  const timedOut = await run(slow);
  assert.equal(timedOut.code, EXIT.timeout);
  assert.deepEqual(timedOut.results.map((result) => result.code), [EXIT.ok, EXIT.timeout, EXIT.timeout]);
  assert.equal(timedOut.resume, `node scripts/pr-gate.mjs o/r#2 o/s#3 --expect-head ${HEAD} --expect-head ${HEAD} --required verify --interval 120 --timeout-minutes 5`);
});

test('--commit waits for the required checks of a commit', async () => {
  const setup = world({ polls: [[commitData([check('verify', null)])], [commitData([check('verify')])]], targets: [parseTarget('o/r@aaaaaaaaaaaa', { commit: true })], commit: true });
  const outcome = await run(setup);
  assert.equal(outcome.code, EXIT.ok);
  assert.match(outcome.results[0].text, /^GREEN o\/r@aaaaaaaaaaaa/);
  const missing = await run(world({ polls: [[{ repository: { object: null } }]], targets: [parseTarget('o/r@aaaaaaaaaaaa', { commit: true })], commit: true }));
  assert.equal(missing.code, EXIT.usage);
  assert.match(resumeCommand({ targets: [parseTarget('o/r@aaaaaaaaaaaa', { commit: true })], expectHeads: [], merge: false, required: 'verify', interval: 180, timeoutMinutes: 100, commit: true }, [{ label: 'o/r@aaaaaaaaaaaa' }]), /^node scripts\/pr-gate\.mjs --commit o\/r@aaaaaaaaaaaa --required verify/);
});

test('--required all needs green on two consecutive polls; a low rate limit waits for its reset', async () => {
  const everything = [check('verify'), check('lint')];
  const setup = world({ polls: [[pr({ contexts: everything })]], required: 'all', interval: 60 });
  const outcome = await run(setup);
  assert.equal(outcome.code, EXIT.ok);
  assert.equal(setup.calls.queries, 2);
  const limited = world({ polls: [[pr({ contexts: [check('verify', null)] })], [pr()]] });
  const graphql = limited.deps.graphql;
  let first = true;
  limited.deps.graphql = async (query, variables) => {
    const data = await graphql(query, variables);
    if (first && query.startsWith('query')) {
      first = false;
      return { ...data, rateLimit: { remaining: 10, resetAt: new Date(10 * 60000).toISOString() } };
    }
    return data;
  };
  assert.equal((await run(limited)).code, EXIT.ok);
  assert.equal(limited.calls.sleeps[0], 10 * 60000, 'waited until the reset instead of the 90 s interval');
});

test('a failing poll is retried, then reported as a usage error; main maps usage errors to 64', async () => {
  const setup = world({ polls: [[pr()]] });
  let calls = 0;
  const graphql = setup.deps.graphql;
  setup.deps.graphql = async (query, variables) => {
    calls += 1;
    if (calls < 3) throw new Error('HTTP 502');
    return graphql(query, variables);
  };
  assert.equal((await run(setup)).code, EXIT.ok);
  const broken = world({ polls: [[pr()]] });
  broken.deps.graphql = async () => {
    throw new Error('HTTP 401 Bad credentials');
  };
  await assert.rejects(run(broken), (error) => error instanceof UsageError && /GraphQL poll failed: HTTP 401/.test(error.message));
  const originalError = console.error;
  const messages = [];
  console.error = (text) => messages.push(text);
  try {
    assert.equal(await main(['o/r#1', '--bogus'], () => assert.fail('no deps for a bad command line')), EXIT.usage);
  } finally {
    console.error = originalError;
  }
  assert.match(messages[0], /unknown option --bogus/);
});
