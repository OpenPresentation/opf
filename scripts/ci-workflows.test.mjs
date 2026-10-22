// MR-30: the shape of the monorepo CI workflows (ci.yml, nightly.yml, slow-checks.yml and the setup action) against the plan
// (docs/programs/monorepo/README.md, section 4) and against scripts/ci-scope.mjs, whose output decides which jobs run.
// Text-level on purpose, like ci-diet.test.mjs: the repository has no YAML parser dependency. actionlint covers the syntax.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { LEG_PLAN, PACKAGE_IDS, TARGET_GRAPH, scope } from './ci-scope.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (relative) => readFileSync(path.join(root, relative), 'utf8');
const ci = read('.github/workflows/ci.yml');
const nightly = read('.github/workflows/nightly.yml');
const slow = read('.github/workflows/slow-checks.yml');
const setup = read('.github/actions/setup-workspace/action.yml');

/** [{ id, text }] for the two-space indented keys under `jobs:`. */
function jobsOf(text) {
  const jobs = [];
  for (const line of text.slice(text.indexOf('\njobs:\n') + 6).split('\n')) {
    if (/^\s*#/u.test(line)) continue; // comments describe the next job, they are not part of one
    const start = /^ {2}([A-Za-z0-9_-]+):\s*$/u.exec(line);
    if (start) jobs.push({ id: start[1], text: '' });
    else if (jobs.length) jobs.at(-1).text += `${line}\n`;
  }
  return jobs;
}
const job = (text, id) => {
  const found = jobsOf(text).find((entry) => entry.id === id);
  assert.ok(found, `job ${id}`);
  return found;
};
const triggersOf = (text) => text.slice(text.indexOf('\non:'), text.indexOf('\npermissions:'));
const needsOf = (entry) => {
  const match = /^ {4}needs:\s*(\[[^\]]*\]|[A-Za-z0-9_-]+)\s*$/mu.exec(entry.text);
  if (!match) return [];
  return match[1].replace(/[[\]]/gu, '').split(',').map((name) => name.trim()).filter(Boolean);
};

// A change that runs everything (a tooling path): every key the scope can ever name.
const everything = scope({ files: ['scripts/anything.mjs'], graph: TARGET_GRAPH });

test('ci.yml: pull_request, push to main and workflow_dispatch only: no merge queue, no labeled type, a run per pull request', () => {
  const triggers = triggersOf(ci);
  assert.match(triggers, /^ {2}pull_request:\s*$/mu);
  assert.match(triggers, /^ {2}push:\s*\n {4}branches: \[main\]/mu);
  assert.match(triggers, /^ {2}workflow_dispatch:/mu);
  assert.doesNotMatch(triggers, /merge_group/u, 'there is no merge queue (D15)');
  assert.doesNotMatch(triggers, /labeled|types:/u, 'an unrelated label must not re-run, and so possibly replace, a required check');
  assert.match(ci, /group: ci-\$\{\{ github\.event\.pull_request\.number \|\| github\.sha \}\}/u);
  assert.match(ci, /cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}/u);
  assert.match(ci, /^permissions:\n {2}contents: read$/mu);
});

test('verify: the one required job, named verify, always runs and waits for every job the scope can select', () => {
  const ids = jobsOf(ci).map((entry) => entry.id);
  assert.equal(jobsOf(ci).filter((entry) => /^ {4}name: verify$/mu.test(entry.text)).length, 1, 'exactly one job is named verify');
  const verify = job(ci, 'verify');
  assert.match(verify.text, /^ {4}if: \$\{\{ always\(\) \}\}$/mu);
  const needs = needsOf(verify);
  for (const key of Object.keys(everything.jobs)) assert.ok(needs.includes(key), `verify needs the job ${key} the scope names`);
  assert.ok(needs.includes('scope'));
  assert.ok(needs.includes('slow'), 'verify waits for the full-ci call of the slow set');
  for (const id of ids) if (!['verify', 'report-main'].includes(id)) assert.ok(needs.includes(id), `verify needs ${id}`);
  assert.deepEqual(needs.filter((id) => !ids.includes(id)), [], 'verify needs only jobs of this file');
  assert.match(verify.text, /node scripts\/ci-verify\.mjs --optional "\$OPTIONAL"/u);
  assert.match(verify.text, /NEEDS: \$\{\{ toJSON\(needs\) \}\}/u);
  assert.match(verify.text, /JOBS: \$\{\{ needs\.scope\.outputs\.jobs \}\}/u);
});

test('every job the scope can select has a job of that id, gated on its own key of the scope output', () => {
  const ids = jobsOf(ci).map((entry) => entry.id);
  for (const key of Object.keys(everything.jobs)) {
    assert.ok(ids.includes(key), `ci.yml has a job ${key}`);
    if (key === 'lint') continue; // always runs
    const entry = job(ci, key);
    const gate = key.includes('-') ? `fromJSON(needs.scope.outputs.jobs)['${key}'] != 'skip'` : `fromJSON(needs.scope.outputs.jobs).${key} != 'skip'`;
    assert.ok(entry.text.includes(gate), `${key} is gated on ${gate}`);
    assert.ok(entry.text.includes("needs.scope.result == 'success'"), `${key} does not evaluate the scope output when scope failed`);
    assert.deepEqual(needsOf(entry), ['scope'], key);
  }
});

test('the matrix jobs take their legs from the scope, one job per package of LEG_PLAN that has a browser or shard matrix', () => {
  assert.ok(job(ci, 'lint').text.includes('include: ${{ fromJSON(needs.scope.outputs.legs).lint }}'), 'lint reads its legs');
  assert.match(job(ci, 'lint').text, /run-checks\.mjs --shard "\$\{\{ matrix\.index \}\}\/\$\{\{ matrix\.count \}\}"/u, 'the check legs run their shard');
  for (const id of ['render', 'pptx', 'editor']) {
    assert.ok(job(ci, id).text.includes(`include: \${{ fromJSON(needs.scope.outputs.legs).${id} }}`), `${id} reads its legs`);
    assert.match(job(ci, id).text, /container: mcr\.microsoft\.com\/playwright:v\d+\.\d+\.\d+-noble@sha256:[0-9a-f]{64}/u, `${id} runs in the pinned Playwright image`);
  }
  // The jobs that are not matrices have one `tests` leg in the plan.
  for (const id of PACKAGE_IDS.filter((entry) => !['render', 'pptx', 'editor'].includes(entry))) {
    assert.deepEqual(LEG_PLAN[id].full, [['tests', 1]], id);
    assert.deepEqual(LEG_PLAN[id].contract, [['tests', 1]], id);
  }
  // Each kind a plan names is handled by a step of its job.
  for (const [id, plan] of Object.entries(LEG_PLAN)) {
    for (const kind of new Set(Object.values(plan).flatMap((legs) => legs.map(([name]) => name)))) {
      if (!['render', 'pptx', 'editor'].includes(id)) continue;
      assert.ok(job(ci, id).text.includes(`matrix.kind == '${kind}'`) || job(ci, id).text.includes(`matrix.kind != 'tests'`), `${id} has a step for its ${kind} leg`);
    }
  }
});

test('ci.yml runs on Linux only and keeps the slow set out of the pull request path', () => {
  assert.doesNotMatch(ci, /windows-|macos-/u, 'Windows and macOS are nightly legs');
  assert.doesNotMatch(ci, /node-version: (22|26)\b/u, 'Node 22 and 26 are nightly legs');
  assert.doesNotMatch(ci, /test:packed|pack:ecosystem|test:registry|published-matrix|installed-parity/u, 'the packed-install and registry consumers are nightly');
  const call = job(ci, 'slow');
  assert.match(call.text, /uses: \.\/\.github\/workflows\/nightly\.yml/u);
  assert.match(call.text, /report: false/u);
  assert.match(call.text, /needs\.scope\.outputs\.slow == 'true'/u);
});

test('every third-party action is pinned to a commit and every composite run step names its shell', () => {
  for (const [name, text] of [['ci.yml', ci], ['nightly.yml', nightly], ['slow-checks.yml', slow], ['setup-workspace', setup]]) {
    for (const [, action] of text.matchAll(/^\s*(?:-\s+)?uses:\s*(\S+)/gmu)) {
      if (action.startsWith('./')) continue;
      assert.match(action, /@[0-9a-f]{40}$/u, `${name}: ${action} is not pinned to a commit`);
    }
  }
  const runs = [...setup.matchAll(/^ {4}- name: [^\n]*\n(?:(?: {6,}[^\n]*)?\n)*?(?= {4}- name:|$)/gmu)].map((match) => match[0]).filter((step) => /^ {6}run:/mu.test(step));
  assert.ok(runs.length >= 3);
  for (const step of runs) assert.match(step, /^ {6}shell: bash$/mu, step.split('\n')[0]);
});

test('issues: write is granted only to the reporters and to the caller of the reusable nightly', () => {
  for (const [name, text] of [['ci.yml', ci], ['nightly.yml', nightly], ['slow-checks.yml', slow]]) {
    assert.match(text, /^permissions:\n {2}contents: read$/mu, `${name}: the default token is read-only`);
    for (const entry of jobsOf(text)) {
      if (/issues: write/u.test(entry.text)) assert.ok(['report', 'report-main', 'slow'].includes(entry.id), `${name}: ${entry.id} asks for issues: write`);
    }
  }
  assert.match(job(nightly, 'report').text, /issues: write/u);
  assert.match(job(slow, 'report').text, /issues: write/u);
  assert.match(job(ci, 'report-main').text, /github\.ref == 'refs\/heads\/main'/u);
  for (const text of [nightly, slow, ci]) assert.doesNotMatch(text, /secrets\.|create-github-app-token/u, 'the reporters use the workflow token only');
});

test('nightly.yml: schedule, dispatch and call; never a pull request or push; every cross-platform leg of the old CI is here', () => {
  const triggers = triggersOf(nightly);
  for (const trigger of ['schedule', 'workflow_dispatch', 'workflow_call']) assert.match(triggers, new RegExp(`^ {2}${trigger}:`, 'mu'), trigger);
  assert.doesNotMatch(triggers, /pull_request|push:|merge_group/u);
  assert.match(nightly, /os: \[windows-latest, macos-latest\]/u);
  assert.match(nightly, /node: \[22, 26\]/u);
  for (const id of ['cli-portability', 'installed', 'pptx-windows', 'editor-macos', 'node-range', 'packed-linux', 'registry', 'audit', 'platform-residual', 'flake', 'report']) assert.ok(jobsOf(nightly).some((entry) => entry.id === id), `nightly.yml has ${id}`);
  assert.match(nightly, /name: Installed candidates \(\$\{\{ matrix\.os \}\}\)/u, 'the old check name is kept');
  assert.match(job(nightly, 'pptx-windows').text, /native-tab-control-v2\.ps1 -PureRegression/u);
  assert.match(job(nightly, 'editor-macos').text, /runs-on: macos-15/u);
});

test('nightly.yml reports only a scheduled run or one that asked for it, ignores the advisory jobs and needs every leg', () => {
  const report = job(nightly, 'report');
  assert.match(report.text, /if: \$\{\{ always\(\) && \(github\.event_name == 'schedule' \|\| inputs\.report == true\) \}\}/u);
  assert.match(report.text, /--label nightly-red/u);
  assert.match(report.text, /--ignore platform-residual,flake/u);
  const legs = jobsOf(nightly).map((entry) => entry.id).filter((id) => !['plan', 'report'].includes(id));
  assert.deepEqual(needsOf(report).sort(), legs.sort(), 'the report waits for every leg');
  assert.match(nightly, /report:\n {8}description: [^\n]*\n {8}type: boolean\n {8}default: false/u, 'a call reports nothing by default (a release gate stops the release, it opens no issue)');
});

test('slow-checks.yml: weekly, on demand, or by the label slow-checks; its jobs run for no other label', () => {
  const triggers = triggersOf(slow);
  assert.match(triggers, /^ {2}schedule:/mu);
  assert.match(triggers, /^ {2}workflow_dispatch:/mu);
  assert.match(triggers, /^ {2}pull_request:\n {4}types: \[labeled\]/mu);
  assert.doesNotMatch(triggers, /push:|merge_group/u);
  for (const entry of jobsOf(slow)) {
    if (['report'].includes(entry.id) || /^ {4}needs:/mu.test(entry.text)) continue;
    assert.match(entry.text, /github\.event\.label\.name == 'slow-checks'/u, `${entry.id} runs for the label slow-checks only`);
  }
  assert.match(job(slow, 'report').text, /github\.event_name == 'schedule'/u);
});

test('the pinned Playwright image is one string in the three workflows', () => {
  const images = new Set([...`${ci}${nightly}${slow}`.matchAll(/mcr\.microsoft\.com\/playwright:[^\s'"]+/gu)].map((match) => match[0]));
  assert.equal(images.size, 1, [...images].join(' '));
});

test('the setup action installs the whole frozen workspace (a filtered install would seed an incomplete store cache) and does not use pnpm/action-setup inside the container', () => {
  assert.match(setup, /^ {8}pnpm install --frozen-lockfile$/mu);
  assert.doesNotMatch(setup, /pnpm install[^\n]*--filter/u);
  for (const text of [ci, nightly, slow]) assert.doesNotMatch(text, /^\s+filter: '@openpresentation/mu, 'no job filters its install');
  assert.match(setup, /cache: pnpm/u);
  assert.match(setup, /if: \$\{\{ inputs\.container != 'true' \}\}\n {6}uses: pnpm\/action-setup@/u);
  assert.match(setup, /if: \$\{\{ inputs\.container == 'true' \}\}/u);
  assert.match(setup, /pnpm --filter "\$\{PACKAGE\}\^\.\.\." run --if-present build/u);
});

test('a pnpm filter that matches no package must fail: pnpm exits 0 on an empty match and a missing package would pass silently', () => {
  // Seen on the first Actions run of this workflow, before MR-23: `integration` and `gallery-gates` "succeeded" without running.
  for (const [name, text] of [['ci.yml', ci], ['nightly.yml', nightly], ['slow-checks.yml', slow]]) {
    for (const [line] of text.matchAll(/^.*pnpm --filter @openpresentation\/[a-z-]+ .*$/gmu)) {
      if (/--if-present/u.test(line)) continue;
      assert.match(line, /--filter @openpresentation\/[a-z-]+ --fail-if-no-match (run|exec) /u, `${name}: ${line.trim()}`);
    }
  }
});

test('lint has a docs leg without a build, and audit is its own job gated by the scope', () => {
  const lint = job(ci, 'lint').text;
  assert.match(lint, /matrix\.kind == 'docs'[^\n]*\n\s+run: node scripts\/check-changed\.mjs --base "origin\/\$\{\{ github\.base_ref \}\}"/u);
  assert.match(lint, /name: Build core and the CLI\n\s+if: \$\{\{ matrix\.kind != 'docs' \}\}/u, 'the docs leg does not build');
  assert.match(job(ci, 'audit').text, /pnpm audit/u);
  assert.match(job(nightly, 'audit').text, /pnpm audit/u, 'and the nightly audits every night');
  assert.match(nightly, /name: editor playground on macOS \(\$\{\{ matrix\.shard \}\}\/2\)/u, 'macOS legs: 1 + 1 + 2 + 1 = 5, the account limit');
});
