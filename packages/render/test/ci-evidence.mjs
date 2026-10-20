import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { CONFIG_PATH, evaluateEvidence, githubApi, main, parseConfig } from '../scripts/ci-evidence.mjs';

// RR-100. Identical in the four public repositories except for the two relative paths below.
const SHA = 'e6ade17b4fcaf70bc716654d39102a54db015965';
const REPO = 'OpenPresentation/example';
const config = parseConfig(readFileSync(new URL('../scripts/ci-evidence.json', import.meta.url), 'utf8'));
// What each repository's evidence must name: the merge-queue runs and required checks of the `main` ruleset in opf, the
// push-to-main CI run (its jobs and engines-range legs) in the siblings, which have no merge queue. Identical test in all four.
const EXPECTED = {
  '@openpresentation/opf-render': [{ workflow: '.github/workflows/ci.yml', event: 'push', branch: 'main', jobs: ['package', 'Node 22 (engines range)', 'Node 26 (engines range)'] }],
  '@openpresentation/opf-pptx': [{ workflow: '.github/workflows/ci.yml', event: 'push', branch: 'main', jobs: ['package (ubuntu-latest)', 'package (windows-latest)', 'Node 22 (engines range)', 'Node 26 (engines range)'] }],
  '@openpresentation/opf-editor': [{ workflow: '.github/workflows/ci.yml', event: 'push', branch: 'main', jobs: ['package', 'Node 22 (engines range)', 'Node 26 (engines range)'] }],
  'openpresentation-workspace': [
    { workflow: '.github/workflows/opf-ci.yml', event: 'merge_group', branchPrefix: 'gh-readonly-queue/main/', jobs: ['Verify OPF packages'] },
    { workflow: '.github/workflows/ecosystem-ci.yml', event: 'merge_group', branchPrefix: 'gh-readonly-queue/main/', jobs: ['packages', 'Installed candidates (windows-latest)', 'Installed candidates (macos-latest)'] },
  ],
};
const repositoryName = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).name;
const QUEUE = `gh-readonly-queue/main/pr-760-${'7'.repeat(40)}`;
const branchOf = (requirement) => requirement.branch ?? `${requirement.branchPrefix}pr-760-${'7'.repeat(40)}`;
const WORKFLOW = config.requirements[0].workflow;
const OTHER_BRANCH = config.requirements[0].branch === undefined ? 'main' : 'feature';

const run = (id, requirement, over = {}) => ({ id, path: requirement.workflow, event: requirement.event, head_branch: branchOf(requirement), head_sha: SHA, status: 'completed', conclusion: 'success', run_number: id, created_at: '2026-10-20T13:29:23Z', ...over });
const job = (name, over = {}) => ({ name, status: 'completed', conclusion: 'success', ...over });

// A fake GitHub: `runs` for the commit and `jobs` by run id. Counts calls.
function github({ runs, jobs }) {
  const calls = [];
  const api = async (route) => {
    calls.push(route);
    if (route.includes('/actions/runs?')) return { workflow_runs: runs };
    const match = /\/actions\/runs\/(\d+)\/jobs/.exec(route);
    if (match) return { jobs: jobs[match[1]] ?? [] };
    throw new Error(`unexpected ${route}`);
  };
  return { api, calls };
}
// Run id n+1 is the run of requirement n; run 99 is an unrelated successful workflow on the same commit.
const idOf = (index) => index + 1;
const green = () => ({
  runs: [...config.requirements.map((requirement, index) => run(idOf(index), requirement)), run(99, { workflow: '.github/workflows/other.yml', event: 'push', branch: 'main' })],
  jobs: Object.fromEntries(config.requirements.map((requirement, index) => [idOf(index), [...requirement.jobs.map((name) => job(name)), job('Unrelated job')]])),
});
const evaluate = (data, over = {}) => evaluateEvidence({ api: github(data).api, repo: REPO, sha: SHA, config, ...over });
const first = config.requirements[0];
const lastJob = first.jobs.at(-1);

test('the configuration names exactly the evidence this repository trusts', () => {
  assert.equal(CONFIG_PATH, 'scripts/ci-evidence.json');
  assert.ok(EXPECTED[repositoryName], `no expectation for ${repositoryName}`);
  assert.deepEqual(config.requirements, EXPECTED[repositoryName]);
});

test('green when every required workflow run on the commit succeeded with its required jobs', async () => {
  const result = await evaluate(green());
  assert.equal(result.state, 'green');
  assert.deepEqual([result.problems, result.pending], [[], []]);
  assert.equal(result.lines.length, config.requirements.length);
});

test('a missing run is pending, never green', async () => {
  for (const [index, requirement] of config.requirements.entries()) {
    const data = green();
    data.runs = data.runs.filter((entry) => entry.id !== idOf(index));
    const result = await evaluate(data);
    assert.equal(result.state, 'pending');
    assert.match(result.pending.join('\n'), new RegExp(`${requirement.workflow.replaceAll('.', '\\.')}.*no run on e6ade17b4fca`));
  }
});

test('a run that is still running or queued is pending', async () => {
  for (const status of ['in_progress', 'queued', 'waiting']) {
    const data = green();
    data.runs[0] = run(1, first, { status, conclusion: null });
    const result = await evaluate(data);
    assert.equal(result.state, 'pending', status);
    assert.match(result.pending[0], new RegExp(status));
  }
});

test('a failed, cancelled, timed-out or skipped run is red', async () => {
  for (const conclusion of ['failure', 'cancelled', 'timed_out', 'skipped', 'neutral', null]) {
    const data = green();
    data.runs[0] = run(1, first, { conclusion });
    const result = await evaluate(data);
    assert.equal(result.state, 'red', String(conclusion));
    assert.match(result.problems[0], /concluded/);
  }
});

test('a required job that is absent, skipped, failed or unfinished fails even when the run succeeded', async () => {
  const cases = [
    [first.jobs.slice(0, -1).map((name) => job(name)), 'red', new RegExp(`no job named ${lastJob.replace(/[()]/g, '\\$&')}`)],
    [first.jobs.map((name) => job(name, name === lastJob ? { conclusion: 'skipped' } : {})), 'red', /concluded skipped/],
    [first.jobs.map((name) => job(name, name === first.jobs[0] ? { conclusion: 'failure' } : {})), 'red', /concluded failure/],
    [first.jobs.map((name) => job(name, name === lastJob ? { status: 'in_progress', conclusion: null } : {})), 'pending', /has not completed/],
  ];
  for (const [jobs, state, pattern] of cases) {
    const data = green();
    data.jobs[1] = jobs;
    const result = await evaluate(data);
    assert.equal(result.state, state);
    assert.match([...result.problems, ...result.pending].join('\n'), pattern);
  }
});

test('a duplicate job name must succeed everywhere', async () => {
  const data = green();
  data.jobs[1] = [...first.jobs.map((name) => job(name)), job(first.jobs[0], { conclusion: 'failure' })];
  assert.equal((await evaluate(data)).state, 'red');
});

test('only a run of the named workflow, event, branch and exact commit counts', async () => {
  const wrong = [
    { event: first.event === 'push' ? 'pull_request' : 'push' },
    { event: 'schedule' },
    { head_branch: first.branch === undefined ? 'main' : 'feature' },
    { head_branch: first.branch === undefined ? 'gh-readonly-queue/release/pr-1-x' : 'main-2' },
    { head_branch: first.branch === undefined ? 'gh-readonly-queue' : 'refs/heads/main' },
    { head_sha: 'a'.repeat(40) },
    { path: '.github/workflows/other.yml' },
  ];
  for (const over of wrong) {
    const data = green();
    data.runs[0] = run(1, first, over);
    const result = await evaluate(data);
    assert.equal(result.state, 'pending', JSON.stringify(over));
  }
});

test('a successful run of another workflow or event cannot stand in for a missing one', async () => {
  const data = green();
  const decoys = [run(9, { ...first, workflow: '.github/workflows/engines-range.yml' }), run(10, first, { event: 'schedule', head_branch: 'main' }), run(11, first, { path: '.github/workflows/x.yml' })];
  data.runs = [...decoys, ...data.runs.slice(1)];
  data.jobs = { ...data.jobs, 9: data.jobs[1], 10: data.jobs[1], 11: data.jobs[1], 1: undefined };
  const result = await evaluate(data);
  assert.equal(result.state, 'pending');
  assert.match(result.pending[0], new RegExp(first.workflow.replaceAll('.', '\\.')));
});

test('the newest run wins: a later failed run is red even after an earlier success', async () => {
  const data = green();
  data.runs.push(run(500, first, { conclusion: 'failure' }));
  assert.equal((await evaluate(data)).state, 'red');
});

test('the commit must be a full SHA', async () => {
  await assert.rejects(() => evaluate(green(), { sha: 'main' }), /40-character/);
});

test('configuration errors fail closed', () => {
  const ok = { workflow: '.github/workflows/ci.yml', event: 'push', branch: 'main', jobs: ['package'] };
  assert.doesNotThrow(() => parseConfig(JSON.stringify({ requirements: [ok] })));
  for (const bad of [
    '', '{', '{}', '{"requirements":[]}',
    JSON.stringify({ requirements: [{ ...ok, workflow: 'ci.yml' }] }),
    JSON.stringify({ requirements: [{ ...ok, workflow: '.github/workflows/../ci.yml' }] }),
    JSON.stringify({ requirements: [{ ...ok, event: 'pull_request' }] }),
    JSON.stringify({ requirements: [{ ...ok, branch: undefined }] }),
    JSON.stringify({ requirements: [{ ...ok, branchPrefix: 'gh-readonly-queue/' }] }),
    JSON.stringify({ requirements: [{ ...ok, jobs: [] }] }),
    JSON.stringify({ requirements: [{ ...ok, jobs: ['a', 'a'] }] }),
    JSON.stringify({ requirements: [{ ...ok, jobs: [''] }] }),
  ]) assert.throws(() => parseConfig(bad), /ci-evidence/, bad);
});

test('the command exits 0 only when green and prints what is missing otherwise', async () => {
  const lines = [];
  const env = { GITHUB_REPOSITORY: REPO, GITHUB_SHA: SHA };
  assert.equal(await main([], { env, api: github(green()).api, log: (line) => lines.push(line) }), 0);
  assert.match(lines.at(-1), /passed every required check/);
  const data = green();
  data.runs = data.runs.filter((entry) => entry.id !== 1);
  lines.length = 0;
  assert.equal(await main(['--sha', SHA], { env, api: github(data).api, log: (line) => lines.push(line) }), 1);
  assert.ok(lines.some((line) => line.startsWith(`not green: ${first.workflow}`)));
  assert.match(lines.at(-1), /not publishing/);
  await assert.rejects(() => main([], { env: {}, api: github(green()).api, log() {} }), /repository/);
  await assert.rejects(() => main(['--bogus', 'x'], { env, api: github(green()).api, log() {} }), /Usage/);
});

test('an API failure propagates, so the publish step fails', async () => {
  const api = async () => { throw new Error('GET failed with HTTP 403'); };
  await assert.rejects(() => main([], { env: { GITHUB_REPOSITORY: REPO, GITHUB_SHA: SHA }, api, log() {} }), /HTTP 403/);
});

test('the API client retries a 5xx or a network error twice and never a 4xx', async () => {
  const responses = [{ ok: false, status: 502 }, new Error('socket hang up'), { ok: true, json: async () => ({ jobs: [] }) }];
  const fetchImpl = async () => { const next = responses.shift(); if (next instanceof Error) throw next; return next; };
  const api = githubApi({ token: 't', baseUrl: 'https://x.invalid', fetchImpl, sleep: async () => {} });
  assert.deepEqual(await api('/r'), { jobs: [] });
  let calls = 0;
  const forbidden = githubApi({ token: 't', baseUrl: 'https://x.invalid', fetchImpl: async () => { calls += 1; return { ok: false, status: 403 }; }, sleep: async () => {} });
  await assert.rejects(() => forbidden('/r'), /HTTP 403/);
  assert.equal(calls, 1);
  const down = githubApi({ token: 't', baseUrl: 'https://x.invalid', fetchImpl: async () => { calls += 1; return { ok: false, status: 503 }; }, sleep: async () => {} });
  await assert.rejects(() => down('/r'), /HTTP 503/);
  assert.equal(calls, 4);
});
