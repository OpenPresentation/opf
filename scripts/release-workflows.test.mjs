// MR-40: the shape of the release workflows (release.yml, npm-publish.yml) against the plan (docs/programs/monorepo/README.md,
// section 5, D6, D7, D16, D17, D19) and against scripts/release.mjs, whose commands they call. Text-level on purpose, like
// ci-workflows.test.mjs: the repository has no YAML parser dependency, and actionlint covers the syntax.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { NAMES, PACKAGES } from './release.mjs';
import { PUBLISH_WORKFLOW } from './release-registry.mjs';
import { PUBLISHED } from './workspace-packages.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (relative) => readFileSync(path.join(root, relative), 'utf8');
const publish = read('.github/workflows/npm-publish.yml');
const release = read('.github/workflows/release.yml');
const nightly = read('.github/workflows/nightly.yml');
const releaseScript = read('scripts/release.mjs');

/** [{ id, text }] for the two-space indented keys under `jobs:`. */
function jobsOf(text) {
  const jobs = [];
  for (const line of text.slice(text.indexOf('\njobs:\n') + 6).split('\n')) {
    if (/^\s*#/u.test(line)) continue;
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
  return match ? match[1].replace(/[[\]]/gu, '').split(',').map((name) => name.trim()).filter(Boolean) : [];
};
const jobsWith = (text, pattern) => jobsOf(text).filter((entry) => pattern.test(entry.text)).map((entry) => entry.id);

test('the six packages: the script and the workspace agree, and the publisher workflow the verifier expects exists', () => {
  assert.deepEqual([...NAMES].sort(), PUBLISHED.map(({ name }) => name).sort());
  assert.deepEqual(PACKAGES.map(({ dir }) => dir).sort(), PUBLISHED.map(({ dir }) => dir).sort());
  assert.equal(PUBLISH_WORKFLOW, '.github/workflows/npm-publish.yml');
  assert.ok(existsSync(path.join(root, PUBLISH_WORKFLOW)));
});

test('npm-publish.yml: a v* tag, or a dispatch; never a pull request, a branch push or a reusable call (npm checks the calling workflow)', () => {
  const triggers = triggersOf(publish);
  assert.match(triggers, /^ {2}push:\n {4}tags: \['v\*'\]/mu);
  assert.match(triggers, /^ {2}workflow_dispatch:/mu);
  assert.doesNotMatch(triggers, /workflow_call|pull_request|branches:/u);
  assert.match(triggers, /dry-run:\n {8}description: [^\n]*\n {8}type: boolean\n {8}default: true/u, 'a dispatch rehearses unless told otherwise');
  assert.match(publish, /group: publish\n {2}cancel-in-progress: false/u);
  assert.match(publish, /^permissions:\n {2}contents: read$/mu);
});

test('npm-publish.yml: id-token is held by publish alone, contents: write by release alone, issues: write by report alone; no secret, no environment', () => {
  assert.deepEqual(jobsWith(publish, /id-token: write/u), ['publish']);
  assert.deepEqual(jobsWith(publish, /contents: write/u), ['release']);
  assert.deepEqual(jobsWith(publish, /issues: write/u), ['report']);
  assert.doesNotMatch(publish, /secrets\.|create-github-app-token|NPM_TOKEN|NODE_AUTH_TOKEN/u);
  assert.doesNotMatch(publish, /^\s+environment:/mu, 'D7: no GitHub environment');
});

test('npm-publish.yml: the pipeline is plan, build, publish, verify, release and every real-only job is skipped in a dry run', () => {
  assert.deepEqual(jobsOf(publish).map((entry) => entry.id), ['plan', 'build', 'publish', 'verify', 'release', 'report']);
  assert.deepEqual(needsOf(job(publish, 'build')), ['plan']);
  assert.deepEqual(needsOf(job(publish, 'publish')), ['plan', 'build']);
  assert.deepEqual(needsOf(job(publish, 'verify')), ['plan', 'publish']);
  assert.deepEqual(needsOf(job(publish, 'release')), ['plan', 'verify']);
  for (const id of ['verify', 'release']) assert.match(job(publish, id).text, /if: \$\{\{ needs\.plan\.outputs\.dry-run != 'true' \}\}/u, id);
  assert.match(job(publish, 'report').text, /if: \$\{\{ always\(\) && needs\.plan\.outputs\.dry-run != 'true' \}\}/u);
  assert.match(job(publish, 'report').text, /release-failed/u);
});

test('npm-publish.yml: a real publish needs a tag on main; only a dry run takes a version from the dispatch', () => {
  const plan = job(publish, 'plan').text;
  assert.match(plan, /\[ "\$REF_TYPE" = tag \] \|\| fail/u);
  assert.match(plan, /git merge-base --is-ancestor "\$GITHUB_SHA" origin\/main/u);
  assert.match(plan, /fetch-depth: 0/u);
  assert.match(plan, /version="\$\{REF_NAME#v\}"/u);
});

test('npm-publish.yml: build packs the six and stamps gitHead with this commit, smokes the tarballs and uploads them', () => {
  const build = job(publish, 'build').text;
  assert.match(build, /uses: \.\/\.github\/actions\/setup-workspace/u);
  assert.match(build, /if: \$\{\{ needs\.plan\.outputs\.dry-run == 'true' \}\}\n(?: {8}env:\n {10}VERSION: [^\n]*\n)? {8}run: node scripts\/release\.mjs prepare "\$VERSION" --no-stability --no-lockfile/u, 'only a rehearsal prepares in the runner');
  assert.ok(build.indexOf('run: pnpm build') < build.indexOf('release.mjs pack'));
  assert.match(build, /release\.mjs pack "\$VERSION" --commit "\$GITHUB_SHA" --out "\$RUNNER_TEMP\/tarballs"/u);
  assert.ok(build.indexOf('release.mjs pack') < build.indexOf('release.mjs smoke'));
  assert.match(build, /upload-artifact@[0-9a-f]{40}[^\n]*\n {8}with:\n {10}name: tarballs/u);
});

test('npm-publish.yml: publish installs and builds nothing, uses npm 11.16.0 on Node 24, publishes the artifact with an explicit tag, and refuses any other top-level workflow', () => {
  const entry = job(publish, 'publish').text;
  assert.doesNotMatch(entry, /pnpm |npm ci|npm install(?! -g npm@11\.16\.0)/u, 'the published bytes are the tarballs of build');
  assert.match(entry, /node-version: 24/u);
  assert.match(entry, /registry-url: https:\/\/registry\.npmjs\.org/u);
  assert.match(entry, /npm install -g npm@11\.16\.0/u);
  assert.match(entry, /download-artifact@[0-9a-f]{40}[^\n]*\n {8}with:\n {10}name: tarballs/u);
  assert.match(entry, /release\.mjs publish "\$VERSION" --dir "\$RUNNER_TEMP\/tarballs" --tag "\$DIST_TAG"\n/u, 'every package gets an explicit --tag (D16)');
  assert.match(entry, /release\.mjs publish "\$VERSION" --dir "\$RUNNER_TEMP\/tarballs" --tag "\$DIST_TAG" --dry-run/u);
  assert.match(entry, /\*\/\.github\/workflows\/npm-publish\.yml@refs\/tags\/v\*\) ;;/u);
  assert.doesNotMatch(entry, /--provenance/u, 'provenance is added by release.mjs for a real publish and omitted for a dry run');
  assert.match(releaseScript, /dryRun \? \['--dry-run'\] : \['--provenance'\]/u);
});

test('npm-publish.yml: verify checks the registry against this commit and waits only for propagation; release creates the GitHub release once', () => {
  const verify = job(publish, 'verify').text;
  assert.match(verify, /release\.mjs verify "\$VERSION" --tag "\$DIST_TAG" --commit "\$GITHUB_SHA" --wait 10/u);
  // The registry lags the upload (v0.26.9: core ~20 min after npm exited 0): the wait is a verify step with a 60 minute budget,
  // before the checks, and the publish job neither waits nor fails for it.
  assert.match(verify, /release\.mjs await-registry "\$VERSION" --wait 60 /u);
  assert.ok(verify.indexOf('release.mjs await-registry') < verify.indexOf('release.mjs verify'), 'the registry wait comes first');
  const budget = Number(/await-registry[^\n]*--wait (\d+)/u.exec(verify)[1]);
  assert.ok(Number(/^ {4}timeout-minutes: (\d+)/mu.exec(verify)[1]) >= budget + 40, 'the job timeout covers the registry wait plus the checks');
  assert.ok(Number(/^ {8}timeout-minutes: (\d+)/mu.exec(verify)[1]) > budget, 'the wait step outlives its own budget');
  assert.doesNotMatch(job(publish, 'publish').text, /--wait/u, 'publish does not wait for registry visibility');
  assert.match(releaseScript, /export const REGISTRY_WAIT_MINUTES = 60;/u);
  assert.ok(Number(/^ {4}timeout-minutes: (\d+)/mu.exec(job(release, 'watch').text)[1]) >= 30 + 30 + Number(/^ {4}timeout-minutes: (\d+)/mu.exec(verify)[1]), 'release.yml follows the publish run for at least build + publish + verify');
  assert.match(verify, /release\.mjs smoke "\$VERSION" --registry/u);
  const entry = job(publish, 'release').text;
  assert.match(entry, /gh release view "\$TAG"/u);
  assert.match(entry, /--verify-tag/u);
  assert.match(entry, /--prerelease/u);
  assert.match(entry, /release\.mjs notes "\$VERSION"/u);
});

test('every action is pinned to a full commit SHA', () => {
  for (const [name, text] of [['npm-publish.yml', publish], ['release.yml', release]]) {
    for (const [, spec] of text.matchAll(/^\s+(?:- )?uses: (\S+)/gmu)) {
      if (spec.startsWith('./')) continue;
      assert.match(spec, /^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/u, `${name}: ${spec}`);
    }
  }
});

test('release.yml: dispatch with a version and a dry run that defaults to true; no push, no schedule', () => {
  const triggers = triggersOf(release);
  assert.match(triggers, /^ {2}workflow_dispatch:/mu);
  assert.doesNotMatch(triggers, /push:|schedule:|pull_request/u);
  assert.match(triggers, /version:\n {8}description: [^\n]*\n {8}required: true/u);
  assert.match(triggers, /dry-run:\n {8}description: [^\n]*\n {8}type: boolean\n {8}default: true/u);
  assert.match(release, /group: release\n {2}cancel-in-progress: false/u);
  assert.deepEqual(jobsOf(release).map((entry) => entry.id), ['plan', 'gate', 'prepare', 'commit', 'watch', 'sites', 'rehearse']);
});

test('release.yml: the pre-release gate is nightly.yml called with no issue reporting, and the caller grants what nightly asks for', () => {
  const gate = job(release, 'gate').text;
  assert.match(gate, /uses: \.\/\.github\/workflows\/nightly\.yml\n {4}with:\n {6}report: false/u);
  assert.match(triggersOf(nightly), /^ {2}workflow_call:/mu);
  assert.match(gate, /contents: read\n {6}issues: write/u);
  assert.deepEqual(jobsWith(nightly, /issues: write/u), ['report']);
  assert.match(job(release, 'gate').text, /if: \$\{\{ inputs\.skip-gate != true \}\}/u);
  assert.match(job(release, 'plan').text, /\[ "\$SKIP_GATE" != true \] \|\| fail/u, 'a real release never skips the gate');
});

test('release.yml: plan demands main and a green verify for a real release; prepare refuses early and uploads a patch', () => {
  const plan = job(release, 'plan').text;
  assert.match(plan, /\[ "\$REF" = refs\/heads\/main \] \|\| fail/u);
  assert.match(plan, /check_name=verify/u);
  assert.match(plan, /checks: read/u);
  const prepare = job(release, 'prepare').text;
  assert.deepEqual(needsOf(job(release, 'prepare')), ['plan']);
  assert.match(prepare, /run: pnpm build\n/u);
  assert.match(prepare, /git diff --exit-code/u);
  assert.match(prepare, /release\.mjs prepare "\$VERSION" --github-output "\$GITHUB_OUTPUT"/u);
  assert.doesNotMatch(prepare, /--no-stability/u, 'the real prepare applies the stability gate');
  assert.match(prepare, /scripts\/check-versions\.mjs/u);
  assert.match(prepare, /name: release-patch/u);
  assert.doesNotMatch(prepare, /git push|git commit|create-github-app-token/u, 'prepare holds no token and pushes nothing');
});

test('release.yml: only the commit job holds the App token; it waits for the gate and the patch, commits the tested head to main and pushes the tag with the token', () => {
  assert.deepEqual(jobsWith(release, /create-github-app-token/u), ['commit']);
  // `sites` passes the key to bump-sites.yml, a reusable workflow that mints its own tokens (bump-sites.test.mjs); nothing else sees it.
  assert.deepEqual(jobsWith(release, /ECOSYSTEM_APP_PRIVATE_KEY/u), ['commit', 'sites']);
  const commit = job(release, 'commit');
  assert.deepEqual(needsOf(commit), ['plan', 'prepare', 'gate']);
  assert.match(commit.text, /if: \$\{\{ needs\.plan\.outputs\.dry-run != 'true' \}\}/u);
  assert.match(commit.text, /app-id: \$\{\{ vars\.ECOSYSTEM_APP_ID \}\}/u);
  assert.match(commit.text, /repositories: opf\n {10}permission-contents: write/u);
  assert.match(commit.text, /token: \$\{\{ steps\.app\.outputs\.token \}\}/u);
  assert.match(commit.text, /\[ "\$\(git rev-parse HEAD\)" = "\$TESTED" \] \|\| fail/u, 'main moving during the run stops the release');
  assert.match(commit.text, /git ls-remote --exit-code --tags origin/u, 'a tag is never reused');
  assert.match(commit.text, /git apply --index/u);
  assert.match(commit.text, /git push origin HEAD:main\n[^\n]*git tag "\$TAG"\n[^\n]*git push origin "\$TAG"/u, 'the commit lands before the tag');
  assert.doesNotMatch(release, /gh pr merge|--force|push -f/u);
});

test('release.yml: a real run follows the publish run on the tag; a dry run dispatches npm-publish.yml with dry-run=true and follows it', () => {
  const watch = job(release, 'watch').text;
  assert.match(watch, /--workflow npm-publish\.yml --event push --branch "\$TAG"/u);
  assert.match(watch, /gh run watch "\$id" --repo "\$REPOSITORY" --exit-status --interval 30/u, 'a polite interval: the quota is shared');
  assert.match(watch, /actions: read/u);
  const rehearse = job(release, 'rehearse').text;
  assert.match(rehearse, /gh workflow run npm-publish\.yml --repo "\$REPOSITORY" --ref "\$REF" -f dry-run=true/u);
  assert.match(rehearse, /needs\.plan\.outputs\.dry-run == 'true'/u);
  assert.match(rehearse, /actions: write/u);
  assert.deepEqual(jobsWith(release, /actions: write/u), ['rehearse']);
});

test('release.yml: the sites are bumped only after the whole publish run succeeded, for a real stable release, and never fail the release', () => {
  const sites = job(release, 'sites');
  assert.deepEqual(needsOf(sites), ['plan', 'prepare', 'watch']);
  assert.match(sites.text, /if: \$\{\{ needs\.plan\.outputs\.dry-run != 'true' && !contains\(needs\.prepare\.outputs\.version, '-'\) \}\}/u, 'a dry run and a prerelease bump nothing');
  assert.match(sites.text, /uses: \.\/\.github\/workflows\/bump-sites\.yml/u);
  assert.match(sites.text, /contents: read\n {6}issues: write/u, 'the caller grants what the failure reporter asks for');
  assert.match(sites.text, /ECOSYSTEM_APP_PRIVATE_KEY: \$\{\{ secrets\.ECOSYSTEM_APP_PRIVATE_KEY \}\}/u);
  assert.doesNotMatch(release, /gh pr merge/u);
});

test('every release.mjs command the workflows call exists, and the workflows name no retired release machinery', () => {
  for (const text of [publish, release]) {
    for (const [, command] of text.matchAll(/scripts\/release\.mjs (\w[\w-]*)/gu)) assert.match(releaseScript, new RegExp(`command === '${command}'`, 'u'), `release.mjs has ${command}`);
    assert.doesNotMatch(text.replace(/^\s*#.*$/gmu, ''), /release-train|ci-evidence|release-plan\.json|candidate-gallery|cli-publish|publish-source/u);
  }
});

test('the first publish of the gallery below its own 5.0.0 is covered: the tag is explicit and the gate compares with the shared line', () => {
  assert.match(releaseScript, /'--tag', tag/u);
  assert.match(releaseScript, /name === GALLERY \? previous : latest\[name\]/u);
});
