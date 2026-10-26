// MR-30: the shape of the monorepo CI workflows (ci.yml, full-ci.yml, nightly.yml, slow-checks.yml and the setup action) against the plan
// (docs/programs/monorepo/README.md, section 4) and against scripts/ci-scope.mjs, whose output decides which jobs run.
// Text-level on purpose: the repository has no YAML parser dependency. actionlint covers the syntax.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { JOB_SHAPE, LEG_PLAN, TARGET_GRAPH, scope } from './ci-scope.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (relative) => readFileSync(path.join(root, relative), 'utf8');
const ci = read('.github/workflows/ci.yml');
const nightly = read('.github/workflows/nightly.yml');
const fullCi = read('.github/workflows/full-ci.yml');
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

const workflowDir = path.join(root, '.github/workflows');
const workflows = readdirSync(workflowDir).filter((name) => name.endsWith('.yml')).sort();

// MR-34: the per-repository, merge-queue and cross-repository workflows are gone. A new workflow is a deliberate addition to
// this list (and to the plan, docs/programs/monorepo/README.md, section 2).
test('the workflows and actions are the monorepo set; the retired coordination machinery stays deleted', () => {
  assert.deepEqual(workflows, ['bump-sites.yml', 'ci.yml', 'full-ci.yml', 'golden.yml', 'nightly.yml', 'npm-publish.yml', 'release.yml', 'slow-checks.yml', 'tracker-refresh.yml']);
  // ecosystem-refs is the frozen shim the archived repositories' CI still calls until MR-60.
  assert.deepEqual(readdirSync(path.join(root, '.github/actions')).sort(), ['ecosystem-refs', 'setup-workspace']);
});

test('every job has a timeout-minutes (a hung job must not hold a runner for six hours)', () => {
  const missing = [];
  for (const name of workflows) {
    for (const entry of jobsOf(read(`.github/workflows/${name}`))) {
      if (/^ {4}uses:/mu.test(entry.text)) continue; // a reusable workflow call cannot set one
      if (!/^ {4}timeout-minutes:/mu.test(entry.text)) missing.push(`${name}: ${entry.id}`);
    }
  }
  assert.deepEqual(missing, []);
});

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

test('verify: the one required job, named verify, always runs and waits for the scope and the matrix job', () => {
  assert.equal(jobsOf(ci).filter((entry) => /^ {4}name: verify$/mu.test(entry.text)).length, 1, 'exactly one job is named verify');
  const verify = job(ci, 'verify');
  assert.match(verify.text, /^ {4}if: \$\{\{ always\(\) \}\}$/mu);
  assert.deepEqual(needsOf(verify).sort(), ['check', 'scope'], 'verify needs the matrix job that holds every leg, and the scope');
  assert.match(verify.text, /node scripts\/ci-verify\.mjs$/mu);
  assert.match(verify.text, /NEEDS: \$\{\{ toJSON\(needs\) \}\}/u);
  assert.match(verify.text, /JOBS: \$\{\{ needs\.scope\.outputs\.jobs \}\}/u);
  assert.match(verify.text, /LEGS: \$\{\{ needs\.scope\.outputs\.legs \}\}/u, 'verify checks the legs against the jobs the scope selected');
});

test('no skipped checks: ci.yml is scope, one matrix job and verify; no job but verify has an `if:`, so none is ever listed as skipped', () => {
  assert.deepEqual(jobsOf(ci).map((entry) => entry.id), ['scope', 'check', 'verify']);
  for (const entry of jobsOf(ci)) {
    if (entry.id === 'verify') continue;
    assert.doesNotMatch(entry.text, /^ {4}if:/mu, `${entry.id} has no job-level if (a false one is a skipped check)`);
  }
  assert.doesNotMatch(ci, /^ {2}(slow|report-main|audit|gallery|core|cli|render|pptx|editor|integration|goldens|gallery-gates|pack-shape|lint):/mu, 'the per-package jobs are legs of the matrix');
  assert.doesNotMatch(ci, /fromJSON\(needs\.scope\.outputs\.jobs\)/u, 'nothing is gated on the skip value of the scope any more');
  assert.doesNotMatch(ci, /uses: \.\/\.github\/workflows\//u, 'the slow set is its own workflow (full-ci.yml)');
});

test('the matrix job: its matrix is the legs of the scope, named like the old jobs, with the legs deciding how each runs', () => {
  const check = job(ci, 'check').text;
  assert.deepEqual(needsOf(job(ci, 'check')), ['scope']);
  assert.match(check, /^ {4}name: \$\{\{ matrix\.name \}\}$/mu);
  assert.match(check, /^ {4}timeout-minutes: \$\{\{ matrix\.timeout \}\}$/mu);
  assert.match(check, /fail-fast: false/u, 'a red leg does not cancel the others');
  assert.ok(check.includes('include: ${{ fromJSON(needs.scope.outputs.legs) }}'), 'the matrix is the scope output');
  assert.match(check, /container: \$\{\{ matrix\.browser && 'mcr\.microsoft\.com\/playwright:v\d+\.\d+\.\d+-noble@sha256:[0-9a-f]{64}' \|\| '' \}\}/u, 'the browser legs run in the pinned Playwright image, the others on the host');
  assert.match(check, /fetch-depth: \$\{\{ matrix\.fetchDepth \}\}/u);
  assert.match(check, /filter: \$\{\{ matrix\.filter \}\}/u);
  assert.match(check, /container: \$\{\{ matrix\.browser && 'true' \|\| 'false' \}\}/u, 'the setup action knows it runs in the container');
  assert.match(check, /build-deps: \$\{\{ matrix\.buildDeps \}\}/u);
  assert.match(check, /build-also: \$\{\{ matrix\.buildAlso \}\}/u);
  assert.match(check, /OPF_REUSE_BUILD: \$\{\{ matrix\.reuse && format\('\{0\}-\{1\}-\{2\}', github\.run_id, github\.run_attempt, matrix\.id\) \|\| '' \}\}/u);
  assert.match(check, /OPF_TRACKER_STALE: \$\{\{ matrix\.job == 'lint' && github\.event_name == 'pull_request' && 'warn' \|\| 'fail' \}\}/u, 'only lint downgrades a stale tracker');
  assert.match(check, /run-checks\.mjs --shard "\$\{\{ matrix\.index \}\}\/\$\{\{ matrix\.count \}\}"/u, 'the check legs run their shard');
  assert.match(check, /name: evidence-\$\{\{ matrix\.id \}\}/u, 'artifact names are unique per leg');
});

test('every job and leg kind the scope can emit has a step that runs it, and every step is guarded by its job', () => {
  const check = job(ci, 'check').text;
  const steps = check.slice(check.indexOf('\n    steps:\n')).split(/\n {6}- /u).slice(1);
  const unguarded = steps.filter((step) => !/\bif: /u.test(step)).map((step) => step.split('\n')[0]);
  assert.deepEqual(unguarded, ['name: Checkout', 'uses: ./.github/actions/setup-workspace'], 'only the checkout and the setup are common to every leg');
  for (const key of Object.keys(everything.jobs)) {
    assert.ok(check.includes(`matrix.job == '${key}'`), `the matrix job has steps for ${key}`);
    assert.ok(everything.legs.some((leg) => leg.job === key) || key === 'audit', `a forced run has legs of ${key}`);
  }
  assert.deepEqual(Object.keys(JOB_SHAPE).filter((key) => !check.includes(`matrix.job == '${key}'`)), [], 'every job of the plan has steps');
  // Each kind a plan names is handled by a step of its job (a step that names no kind runs for every leg of the job).
  const handles = (step, id, kind) => step.includes(`matrix.job == '${id}'`) && (!step.includes('matrix.kind') || step.includes(`matrix.kind == '${kind}'`) || (step.includes("matrix.kind != 'tests'") && kind !== 'tests'));
  for (const [id, plan] of Object.entries(LEG_PLAN)) {
    for (const kind of new Set(Object.values(plan).flatMap((legs) => legs.map(([name]) => name)))) {
      assert.ok(steps.some((step) => handles(step, id, kind)), `${id} has a step for its ${kind} leg`);
    }
  }
  assert.match(check, /name: Audit the dependencies\n\s+if: \$\{\{ matrix\.job == 'audit' \}\}\n\s+run: pnpm audit/u);
});

test('the legs of the browser jobs run in the Playwright image and the others do not', () => {
  const browser = Object.entries(JOB_SHAPE).filter(([, shape]) => shape.browser).map(([id]) => id).sort();
  assert.deepEqual(browser, ['editor', 'goldens', 'pptx', 'render']);
  assert.ok(everything.legs.filter((leg) => leg.browser).every((leg) => browser.includes(leg.job)));
});

test('ci.yml runs on Linux only and keeps the slow set out of the pull request path', () => {
  assert.doesNotMatch(ci, /windows-|macos-/u, 'Windows and macOS are nightly legs');
  assert.doesNotMatch(ci, /node-version: (22|26)\b/u, 'Node 22 and 26 are nightly legs');
  assert.doesNotMatch(ci, /test:packed|pack:ecosystem|test:registry|published-matrix|installed-parity/u, 'the packed-install and registry consumers are nightly');
  assert.doesNotMatch(ci, /uses: .*nightly\.yml/u, 'ci.yml does not call the nightly set');
});

test('full-ci.yml: the label full-ci runs the slow set in a workflow of its own, so an unlabeled pull request shows no entry', () => {
  const triggers = triggersOf(fullCi);
  assert.match(triggers, /^ {2}pull_request:\n {4}types: \[labeled\]/mu, 'only when a label is added');
  assert.match(triggers, /^ {2}workflow_dispatch:/mu);
  assert.doesNotMatch(triggers, /push:|merge_group|synchronize|schedule/u, 'a push must not run (and skip) a job on a pull request without the label');
  assert.deepEqual(jobsOf(fullCi).map((entry) => entry.id), ['slow']);
  const call = job(fullCi, 'slow');
  assert.match(call.text, /^ {4}name: slow set \(only with the full-ci label\)$/mu, 'the name says why it runs');
  assert.match(call.text, /github\.event\.label\.name == 'full-ci'/u);
  assert.match(call.text, /uses: \.\/\.github\/workflows\/nightly\.yml/u);
  assert.match(call.text, /report: false/u);
  assert.match(call.text, /issues: write/u, 'the called nightly report job asks for it, so the caller grants it');
  assert.match(fullCi, /^permissions:\n {2}contents: read$/mu);
  assert.match(nightly, /^ {2}workflow_call:/mu);
  assert.match(read('scripts/ci-scope.mjs'), /label full-ci/u, 'the label still makes ci.yml run everything at full');
});

test('every third-party action is pinned to a commit and every composite run step names its shell', () => {
  for (const [name, text] of [['ci.yml', ci], ['full-ci.yml', fullCi], ['nightly.yml', nightly], ['slow-checks.yml', slow], ['setup-workspace', setup]]) {
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
  for (const [name, text] of [['ci.yml', ci], ['full-ci.yml', fullCi], ['nightly.yml', nightly], ['slow-checks.yml', slow]]) {
    assert.match(text, /^permissions:\n {2}contents: read$/mu, `${name}: the default token is read-only`);
    for (const entry of jobsOf(text)) {
      if (/issues: write/u.test(entry.text)) assert.ok(['report', 'verify', 'slow'].includes(entry.id), `${name}: ${entry.id} asks for issues: write`);
    }
  }
  assert.match(job(nightly, 'report').text, /issues: write/u);
  assert.match(job(slow, 'report').text, /issues: write/u);
  // The red-main reporter is the last step of verify (a `report main` job would be listed as skipped on every pull request).
  const verify = job(ci, 'verify').text;
  assert.match(verify, /name: Open, update or close the main-red issue\n\s+if: \$\{\{ always\(\) && github\.event_name == 'push' && github\.ref == 'refs\/heads\/main' \}\}\n\s+continue-on-error: true/u, 'only on a push to main, and it never fails verify');
  assert.match(verify, /ci-report-issue\.mjs --label main-red/u);
  assert.match(verify, /format\('\{\{"verify":\{\{"result":"\{0\}"\}\}\}\}', job\.status\)/u, 'the reporter reads the status of the job, the verdict included');
  for (const text of [nightly, slow, ci, fullCi]) assert.doesNotMatch(text, /secrets\.|create-github-app-token/u, 'the reporters use the workflow token only');
});

test('nightly.yml: schedule, dispatch and call; never a pull request or push; every cross-platform leg of the old CI is here', () => {
  const triggers = triggersOf(nightly);
  for (const trigger of ['schedule', 'workflow_dispatch', 'workflow_call']) assert.match(triggers, new RegExp(`^ {2}${trigger}:`, 'mu'), trigger);
  assert.doesNotMatch(triggers, /pull_request|push:|merge_group/u);
  assert.match(nightly, /os: \[windows-latest, macos-latest\]/u);
  assert.match(nightly, /node: \[22, 26\]/u);
  for (const id of ['cli-portability', 'installed', 'pptx-windows', 'editor-macos', 'node-range', 'packed-linux', 'registry', 'npm12-consumer', 'audit', 'platform-residual', 'flake', 'report']) assert.ok(jobsOf(nightly).some((entry) => entry.id === id), `nightly.yml has ${id}`);
  assert.match(nightly, /name: Installed candidates \(\$\{\{ matrix\.os \}\}\)/u, 'the old check name is kept');
  assert.match(job(nightly, 'pptx-windows').text, /native-tab-control-v2\.ps1 -PureRegression/u);
  assert.match(job(nightly, 'editor-macos').text, /runs-on: macos-15/u);
  // MR-30: npm 12's install-time defaults (no install scripts, no git or remote dependencies) are checked on the packed packages, at an exact npm 12.
  assert.match(job(nightly, 'npm12-consumer').text, /NPM12_VERSION: 12\.\d+\.\d+\n/u, 'npm 12 is pinned to an exact version');
  assert.match(job(nightly, 'npm12-consumer').text, /pnpm test:npm12-consumer/u);
  assert.doesNotMatch(job(nightly, 'npm12-consumer').text, /ignore-scripts|allow-scripts|dangerously/u, 'the leg never re-enables scripts');
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
  const images = new Set([...`${ci}${nightly}${slow}${fullCi}`.matchAll(/mcr\.microsoft\.com\/playwright:[^\s'"]+/gu)].map((match) => match[0]));
  assert.equal(images.size, 1, [...images].join(' '));
});

test('the setup action installs the whole frozen workspace (a filtered install would seed an incomplete store cache) and does not use pnpm/action-setup inside the container', () => {
  assert.match(setup, /^ {8}pnpm install --frozen-lockfile$/mu);
  assert.doesNotMatch(setup, /pnpm install[^\n]*--filter/u);
  for (const text of [ci, nightly, slow]) assert.doesNotMatch(text, /^\s+filter: '@openpresentation/mu, 'no job filters its install');
  assert.match(setup, /cache: pnpm/u);
  assert.match(setup, /if: \$\{\{ inputs\.container != 'true' \}\}\n {6}uses: pnpm\/action-setup@/u);
  assert.match(setup, /if: \$\{\{ inputs\.container == 'true' \}\}/u);
  assert.match(setup, /git config --global --add safe\.directory "\$GITHUB_WORKSPACE"/u, 'git works in the container (the checkout is not owned by its user)');
  assert.match(setup, /--filter "\$\{PACKAGE\}\^\.\.\."/u);
  assert.match(setup, /--filter "\$\{name\}\.\.\."/u, 'build-also builds a package and its dependencies');
  assert.match(setup, /pnpm "\$\{filters\[@\]\}" run --if-present build/u);
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

test('lint has a docs leg without a build, and audit is a leg that exists only when the scope selects it', () => {
  const check = job(ci, 'check').text;
  assert.match(check, /matrix\.job == 'lint' && matrix\.kind == 'docs'[^\n]*\n\s+run: node scripts\/check-changed\.mjs --base "origin\/\$\{\{ github\.base_ref \}\}"/u);
  assert.match(check, /name: Build every package\n\s+if: \$\{\{ \(matrix\.job == 'lint' && matrix\.kind != 'docs'\) \|\| matrix\.job == 'pack-shape' \}\}/u, 'the docs leg does not build');
  assert.match(check, /pnpm audit/u);
  assert.match(job(nightly, 'audit').text, /pnpm audit/u, 'and the nightly audits every night');
  assert.match(nightly, /name: editor playground on macOS \(\$\{\{ matrix\.shard \}\}\/2\)/u, 'macOS legs: 1 + 1 + 2 + 1 = 5, the account limit');
});
