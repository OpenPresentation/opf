// MR-52: scripts/bump-site.mjs (what a site bump changes and how big it is) and the shape of bump-sites.yml and of the site-side
// workflows drafted in docs/programs/monorepo/site-workflows/ (README.md, section 6, decisions D17 and D19). The workflow checks are
// text-level on purpose, like release-workflows.test.mjs: the repository has no YAML parser dependency, and actionlint covers the syntax.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { LABELS, NAMES, bumpKind, largest, lockfileCommand, VENDORED_PATHS, main, manifestsOf, missingFromRegistry, planBump, pullRequestBody, specifierFor, vendorCommands, vendoredChanges, writeBump } from './bump-site.mjs';
import { SIX } from './workspace-packages.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (relative) => readFileSync(path.join(root, relative), 'utf8');
const bump = read('.github/workflows/bump-sites.yml');
const code = (text) => text.replace(/^\s*#.*$/gmu, '');
const siteDir = path.join(root, 'docs/programs/monorepo/site-workflows');

function site(files) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'bump-site-'));
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    writeFileSync(path.join(dir, file), typeof content === 'string' ? content : `${JSON.stringify(content, null, 2)}\n`);
  }
  return dir;
}

const manifest = {
  name: 'a-site',
  dependencies: { '@openpresentation/gallery': '^5.0.0', '@openpresentation/opf': '0.25.0', '@openpresentation/opf-render': '0.25.0', react: '19.0.0' },
  devDependencies: { '@openpresentation/cli': '0.25.0', '@openpresentation/opf-editor': '0.25.3', '@openpresentation/opf-pptx': '0.25.0', typescript: '7.0.0' },
};

test('the script knows the six packages of the workspace and no others', () => {
  assert.deepEqual([...NAMES].sort(), SIX.map(({ name }) => name).sort());
});

test('bumpKind: patch is the same major and minor; a minor of 0.x, a new major and any move down are not', () => {
  assert.equal(bumpKind('0.26.0', '0.26.0'), 'none');
  assert.equal(bumpKind('0.26.0', '0.26.1'), 'patch');
  assert.equal(bumpKind('0.25.3', '0.26.0'), 'minor');
  assert.equal(bumpKind('0.26.4', '0.27.0'), 'minor');
  assert.equal(bumpKind('0.26.0', '1.0.0'), 'major');
  assert.equal(bumpKind('5.0.0', '0.26.0'), 'major', 'the gallery joins the shared line from 5.0.0');
  assert.equal(bumpKind('0.26.2', '0.26.1'), 'major', 'a downgrade is never a patch');
  assert.equal(largest(['patch', 'none', 'minor']), 'minor');
  assert.equal(largest([]), 'none');
  assert.deepEqual(LABELS, { patch: 'auto-merge', minor: 'needs-review', major: 'needs-review' });
});

test('specifierFor keeps the site\'s style and refuses a style it does not understand', () => {
  assert.equal(specifierFor('0.25.0', '0.26.1'), '0.26.1');
  assert.equal(specifierFor('^5.0.0', '0.26.1'), '^0.26.1');
  assert.equal(specifierFor('~0.25.0', '0.25.2'), '~0.25.2');
  for (const odd of ['>=0.25.0', 'latest', 'workspace:*', 'npm:@x/y@1.0.0', '0.25.x', '']) assert.equal(specifierFor(odd, '0.26.1'), null, odd);
});

test('planBump reads every declared package and no other dependency, and the kind is the largest bump', () => {
  const dir = site({ 'package.json': manifest });
  const plan = planBump(dir, '0.26.0');
  assert.deepEqual(plan.changes.map((change) => `${change.name} ${change.from} ${change.to}`).sort(), [
    '@openpresentation/cli 0.25.0 0.26.0',
    '@openpresentation/gallery ^5.0.0 ^0.26.0',
    '@openpresentation/opf 0.25.0 0.26.0',
    '@openpresentation/opf-editor 0.25.3 0.26.0',
    '@openpresentation/opf-pptx 0.25.0 0.26.0',
    '@openpresentation/opf-render 0.25.0 0.26.0',
  ]);
  assert.equal(plan.kind, 'major');
  const patch = planBump(site({ 'package.json': { dependencies: { '@openpresentation/opf': '0.26.0', '@openpresentation/gallery': '^0.26.0' }, devDependencies: { '@openpresentation/opf-editor': '0.26.0' } } }), '0.26.1');
  assert.equal(patch.kind, 'patch');
  assert.equal(LABELS[patch.kind], 'auto-merge');
  assert.equal(planBump(site({ 'package.json': { dependencies: { '@openpresentation/opf': '0.26.1' } } }), '0.26.1').kind, 'none', 'a site already at the version has nothing to do (idempotent)');
  assert.throws(() => planBump(dir, '0.26.0-rc.0'), /not X\.Y\.Z/u, 'a canary never bumps a site');
  assert.throws(() => planBump(dir, 'patch'), /not X\.Y\.Z/u);
});

test('planBump reaches workspace members and the pin mirror a site keeps, and reports what it cannot rewrite', () => {
  const dir = site({
    'package.json': { dependencies: { '@openpresentation/opf': '0.25.0' } },
    'pnpm-workspace.yaml': 'packages:\n  - "."\n  - "sdk/typescript"\n  - "tools/*"\n',
    'sdk/typescript/package.json': { devDependencies: { '@openpresentation/opf-render': '0.25.0' } },
    'opf-reference-layer-pins.json': { description: 'x', packages: { '@openpresentation/opf': '0.25.0', '@openpresentation/opf-pptx': null } },
  });
  assert.deepEqual(manifestsOf(dir), ['package.json', 'sdk/typescript/package.json']);
  const plan = planBump(dir, '0.25.1');
  assert.deepEqual(plan.files.sort(), ['opf-reference-layer-pins.json', 'package.json', 'sdk/typescript/package.json']);
  assert.equal(plan.kind, 'patch');
  const odd = planBump(site({ 'package.json': { dependencies: { '@openpresentation/opf': '>=0.25.0' } } }), '0.25.1');
  assert.equal(odd.unsupported.length, 1);
});

test('writeBump edits only the specifiers and keeps the file\'s formatting', () => {
  const text = `{\n  "name": "a-site",\n\t"dependencies": {\n    "@openpresentation/opf": "0.25.0",\n    "@openpresentation/opf-render": "0.25.0",\n    "@openpresentation/gallery": "^5.0.0"\n  }\n}\n`;
  const dir = site({ 'package.json': text });
  writeBump(dir, planBump(dir, '0.26.0'));
  assert.equal(readFileSync(path.join(dir, 'package.json'), 'utf8'), text.replace('"0.25.0"', '"0.26.0"').replace('"0.25.0"', '"0.26.0"').replace('^5.0.0', '^0.26.0'));
});

test('the lockfile refresh follows the lockfile the site has and never installs or runs scripts', () => {
  assert.deepEqual(lockfileCommand(site({ 'package.json': {}, 'pnpm-lock.yaml': '' })), ['pnpm', ['install', '--lockfile-only', '--ignore-scripts']]);
  assert.deepEqual(lockfileCommand(site({ 'package.json': {}, 'package-lock.json': '{}' })), ['npm', ['install', '--package-lock-only', '--ignore-scripts']]);
  assert.throws(() => lockfileCommand(site({ 'package.json': {}, 'yarn.lock': '' })), /no pnpm-lock\.yaml/u);
});

test('main: bump writes the pins, reports the label for the workflow and the body for the pull request; published waits only a bounded time', async () => {
  const dir = site({ 'package.json': manifest });
  const output = path.join(dir, 'gh-output');
  const bodyFile = path.join(dir, 'body.md');
  const lines = [];
  const result = await main(['bump', '--site', dir, '--version', '0.26.0', '--write', '--github-output', output, '--body-file', bodyFile], { log: (line) => lines.push(line) });
  assert.equal(result.label, 'needs-review');
  assert.equal(JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')).dependencies['@openpresentation/opf'], '0.26.0');
  assert.match(readFileSync(output, 'utf8'), /^changed=true\nkind=major\nlabel=needs-review\n$/u);
  assert.match(readFileSync(bodyFile, 'utf8'), /\*\*v0\.26\.0\*\*[\s\S]*not merged automatically/u);
  assert.match(pullRequestBody(planBump(site({ 'package.json': { dependencies: { '@openpresentation/opf': '0.26.0' } } }), '0.26.1')), /patch\*\* bump \(label `auto-merge`\)[^\n]*build-and-smoke/u);
  await assert.rejects(main(['bump', '--site', dir, '--version', '0.26.0', '--write', '--bogus']), /unknown option/u);

  const status = (found) => ({ status: found ? 0 : 1, stdout: found ? JSON.stringify(found) : '' });
  assert.deepEqual(missingFromRegistry('0.26.0', () => status('0.26.0')), []);
  assert.deepEqual(missingFromRegistry('0.26.0', (_c, args) => status(args[1].startsWith('@openpresentation/gallery') ? null : '0.26.0')), ['@openpresentation/gallery']);
  await assert.rejects(main(['published', '0.26.0'], { exec: () => status(null), log() {} }), /not on the registry at 0\.26\.0/u);
  await assert.doesNotReject(main(['published', '0.26.0'], { exec: () => status('0.26.0'), log() {} }));
});

test('bump-sites.yml: called after a release or dispatched by hand; the dispatch rehearses unless told otherwise; one leg per site', () => {
  const triggers = bump.slice(bump.indexOf('\non:'), bump.indexOf('\npermissions:'));
  assert.match(triggers, /^ {2}workflow_call:/mu);
  assert.match(triggers, /^ {2}workflow_dispatch:/mu);
  assert.doesNotMatch(triggers, /workflow_run|push:|schedule:|pull_request/u);
  assert.match(triggers, /secrets:\n {6}ECOSYSTEM_APP_PRIVATE_KEY:/u);
  assert.match(triggers, /workflow_dispatch:[\s\S]*dry-run:\n {8}description: [^\n]*\n {8}type: boolean\n {8}default: true/u);
  assert.match(triggers, /workflow_call:[\s\S]*dry-run:\n {8}description: [^\n]*\n {8}type: boolean\n {8}default: false/u);
  assert.match(bump, /^permissions:\n {2}contents: read$/mu);
  for (const [repo, branch] of [['openpresentation-site', 'main'], ['pptx-gallery', 'main'], ['pptx-dev', 'master']]) {
    assert.ok(bump.includes(`{"repo":"${repo}","branch":"${branch}"}`), `${repo} on ${branch}`);
  }
  assert.match(bump, /node scripts\/bump-site\.mjs published "\$VERSION" --wait 5/u, 'the bump follows verification: the packages must be on the registry');
  assert.match(bump, /\^\(0\|\[1-9\]\[0-9\]\*\)\\\.\(0\|\[1-9\]\[0-9\]\*\)\\\.\(0\|\[1-9\]\[0-9\]\*\)\$/u, 'a stable X.Y.Z only');
});

test('bump-sites.yml: the App token is per site repository and narrow; the pull request is opened, labeled and never merged', () => {
  assert.match(bump, /uses: actions\/create-github-app-token@[0-9a-f]{40}[^\n]*\n {8}with:\n {10}app-id: \$\{\{ vars\.ECOSYSTEM_APP_ID \}\}\n {10}private-key: \$\{\{ secrets\.ECOSYSTEM_APP_PRIVATE_KEY \}\}\n {10}owner: Data-Advantage\n {10}repositories: \$\{\{ matrix\.repo \}\}\n {10}permission-contents: write\n {10}permission-pull-requests: write\n/u);
  assert.doesNotMatch(code(bump), /gh pr merge|\s--auto\b/u, 'D19: the workflow never merges');
  assert.match(bump, /gh pr create --repo "\$SITE" --base "\$BASE" --head "\$branch" --title "\$title" --body-file "\$RUNNER_TEMP\/body\.md" --label "\$LABEL"/u);
  assert.match(bump, /title="bump to v\$VERSION"/u);
  assert.match(bump, /branch="bot\/opf-v\$VERSION"/u);
  assert.match(bump, /--force-with-lease="\$branch"/u, 'an existing branch is updated, never force-pushed over unseen work');
  assert.match(bump, /gh label create auto-merge[\s\S]*gh label create needs-review/u);
  assert.match(bump, /Superseded by/u);
  assert.match(bump, /if \[ "\$DRY_RUN" = true \]; then[\s\S]*exit 0/u, 'a dry run pushes nothing');
  assert.ok(bump.indexOf('Dry run: nothing is pushed.') < bump.indexOf('git push'), 'the dry-run exit comes before the push');
  assert.doesNotMatch(code(bump), /npm publish|id-token|environment:|deploy/u);
});

test('bump-sites.yml: a failure to bump never fails the release: every step that can fail continues and the last step opens an issue', () => {
  for (const id of ['app', 'pm', 'bump', 'pr']) {
    assert.match(bump, new RegExp(`id: ${id}\\n(?: {8}if: [^\\n]*\\n)? {8}continue-on-error: true`, 'u'), `${id} continues on error`);
  }
  assert.match(bump, /fail-fast: false/u);
  assert.match(bump, /name: Report a failed bump\n {8}if: \$\{\{ always\(\) && \(steps\.app\.outcome == 'failure' \|\| steps\.pm\.outcome == 'failure' \|\| steps\.tag\.outcome == 'failure' \|\| steps\.bump\.outcome == 'failure' \|\| steps\.pr\.outcome == 'failure'\) \}\}/u);
  assert.match(bump, /GH_TOKEN: \$\{\{ github\.token \}\}\n {10}REPOSITORY/u, 'the issue is opened with the workflow token');
  assert.match(bump, /bump-sites-failed/u);
  assert.match(bump, /issues: write/u);
});

test('bump-sites.yml: every action is pinned to a full commit SHA, and the lockfile is refreshed with the site\'s own pnpm, without scripts', () => {
  for (const [, spec] of bump.matchAll(/^\s+(?:- )?uses: (\S+)/gmu)) assert.match(spec, /^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/u, spec);
  assert.match(bump, /corepack enable\n\s+pnpm --version/u);
  assert.match(bump, /--write --refresh-lockfile/u);
  assert.match(read('scripts/bump-site.mjs'), /--lockfile-only', '--ignore-scripts'/u);
});

test('the site-side workflows: one merge workflow per site, on the site\'s default branch, merging only a labeled patch bump with the App\'s token', () => {
  const sites = { 'openpresentation-site': 'main', 'pptx-gallery': 'main', 'pptx-dev': 'master' };
  assert.deepEqual(readdirSync(siteDir).filter((entry) => !entry.endsWith('.md')).sort(), Object.keys(sites).sort());
  for (const [name, branch] of Object.entries(sites)) {
    const file = `docs/programs/monorepo/site-workflows/${name}/opf-bump-merge.yml`;
    const text = read(file);
    assert.match(text, new RegExp(`Data-Advantage/${name} \\(default branch ${branch}\\)`, 'u'), `${name}: the header names the default branch`);
    assert.match(text, /\non:\n {2}workflow_run:\n {4}workflows: \[[^\]]+\]\n {4}types: \[completed\]\n/u, name);
    assert.doesNotMatch(text, /pull_request_target|\n {2}pull_request:|\n {2}push:/u, `${name}: runs no code of the pull request`);
    assert.doesNotMatch(code(text), /actions\/checkout|pnpm |npm /u, `${name}: checks nothing out and installs nothing`);
    assert.match(text, /startsWith\(github\.event\.workflow_run\.head_branch, 'bot\/opf-v'\)/u);
    assert.match(text, /github\.event\.workflow_run\.head_repository\.full_name == github\.repository/u, `${name}: no fork`);
    assert.match(text, /app-id: \$\{\{ secrets\.ECOSYSTEM_APP_ID \}\}\n {10}private-key: \$\{\{ secrets\.ECOSYSTEM_APP_PRIVATE_KEY \}\}/u, `${name}: the App's token`);
    assert.match(text, /GH_TOKEN: \$\{\{ steps\.app\.outputs\.token \}\}/u);
    assert.doesNotMatch(code(text), /GITHUB_TOKEN|github\.token/u, `${name}: a GITHUB_TOKEN merge would start no deploy workflow`);
    assert.match(text, /grep -qx needs-review <<<"\$labels" && stop/u);
    assert.match(text, /grep -qx auto-merge <<<"\$labels" \|\| stop/u);
    assert.match(text, /gh pr merge "\$number" --repo "\$REPO" --squash --delete-branch --match-head-commit "\$HEAD_SHA"/u);
    assert.match(text, /REQUIRED_CHECKS: \|\n {12}\S/u, `${name}: names the checks that must pass`);
    assert.doesNotMatch(code(text), /--auto|npm publish|deploy:/u);
    for (const [, spec] of text.matchAll(/^\s+(?:- )?uses: (\S+)/gmu)) assert.match(spec, /^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/u, `${name}: ${spec}`);
    // The default branch the guard compares with is read from the repository, so a rename cannot leave a stale name behind.
    assert.match(text, /DEFAULT_BRANCH: \$\{\{ github\.event\.repository\.default_branch \}\}/u);
  }
  const gallery = read('docs/programs/monorepo/site-workflows/pptx-gallery/build-and-smoke.yml');
  assert.match(gallery, /\n {2}build-and-smoke:\n {4}name: build-and-smoke\n {4}if: \$\{\{ startsWith\(github\.head_ref, 'bot\/opf-v'\)/u, 'the check the merge workflow requires exists');
  assert.match(gallery, /pnpm verify:published-editor/u);
  assert.match(read('docs/programs/monorepo/site-workflows/pptx-gallery/opf-bump-merge.yml'), /REQUIRED_CHECKS: \|\n {12}build-and-smoke\n/u);
});

// MR-56: pptx-gallery vendors the editor bundle and the schema reference; the bump pull request carries a rebuilt copy.
test('MR-56: the vendored editor is rebuilt from the registry at the version and the editor example at the release tag', () => {
  const [install, prepare] = vendorCommands({ opf: '/work/opf', site: '/work/site', version: '0.26.1', execPath: 'node' });
  assert.deepEqual(install, ['pnpm', ['install', '--frozen-lockfile', '--ignore-scripts'], '/work/site']);
  assert.equal(prepare[0], 'node');
  assert.deepEqual(prepare[1].slice(1), ['--version', '0.26.1', '--ref', 'v0.26.1', '--site', '/work/site']);
  assert.match(prepare[1][0], /scripts[\\/]vendor-gallery-editor\.mjs$/u);
  assert.throws(() => vendorCommands({ opf: 'o', site: 's', version: 'v0.26.1' }), /not X\.Y\.Z/u);
  assert.deepEqual(VENDORED_PATHS, ['public/opf-editor', 'data/opf-spec.json']);
  const git = (stdout, status = 0) => (command, args) => ({ status, stdout, stderr: 'boom', command, args });
  assert.equal(vendoredChanges('/s', git(' M public/opf-editor/manifest.json\n?? public/opf-editor/new.ttf\n')), 2);
  assert.equal(vendoredChanges('/s', git('')), 0);
  assert.throws(() => vendoredChanges('/s', git('', 128)), /git status failed in \/s: boom/u);
});

test('MR-56: main --vendor-editor runs the refresh after the pins, counts the vendored files as a change and never merges a refresh by itself', async () => {
  const calls = [];
  const vendorExec = (command, args, options) => {
    calls.push([path.basename(command), args[0], options.cwd]);
    return { status: 0 };
  };
  const written = site({ 'package.json': manifest });
  const output = path.join(written, 'gh-output');
  const lines = [];
  const result = await main(['bump', '--site', written, '--version', '0.26.0', '--write', '--vendor-editor', '/work/opf', '--github-output', output, '--body-file', path.join(written, 'body.md')], {
    log: (line) => lines.push(line), vendorExec, vendorStatus: () => ({ status: 0, stdout: ' M public/opf-editor/index.html\n M data/opf-spec.json\n' }),
  });
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], ['pnpm', 'install', path.resolve(written)]);
  assert.match(calls[1][1], /vendor-gallery-editor\.mjs$/u);
  assert.equal(result.vendored, 2);
  assert.match(readFileSync(output, 'utf8'), /^changed=true\nkind=major\nlabel=needs-review\n$/u);
  assert.match(readFileSync(path.join(written, 'body.md'), 'utf8'), /vendored editor[^\n]*2 changed paths[^\n]*v0\.26\.0/u);
  assert.ok(lines.some((line) => /rebuilt from the published 0\.26\.0 packages/u.test(line)));

  // pins already at the version, bundle rebuilt: a change, but not an automatic merge
  const current = site({ 'package.json': { dependencies: { '@openpresentation/opf': '0.26.0' } } });
  const again = path.join(current, 'gh-output');
  const rerun = await main(['bump', '--site', current, '--version', '0.26.0', '--write', '--vendor-editor', '/work/opf', '--github-output', again, '--body-file', path.join(current, 'body.md')], {
    log() {}, vendorExec, vendorStatus: () => ({ status: 0, stdout: ' M public/opf-editor/index.html\n' }),
  });
  assert.equal(rerun.label, 'needs-review');
  assert.match(readFileSync(again, 'utf8'), /^changed=true\nkind=none\nlabel=needs-review\n$/u);
  assert.match(readFileSync(path.join(current, 'body.md'), 'utf8'), /only the vendored files changed/u);

  // nothing changed at all: no pull request
  const same = site({ 'package.json': { dependencies: { '@openpresentation/opf': '0.26.0' } } });
  const quiet = path.join(same, 'gh-output');
  await main(['bump', '--site', same, '--version', '0.26.0', '--write', '--vendor-editor', '/work/opf', '--github-output', quiet], { log() {}, vendorExec, vendorStatus: () => ({ status: 0, stdout: '' }) });
  assert.match(readFileSync(quiet, 'utf8'), /^changed=false\n/u);

  await assert.rejects(main(['bump', '--site', same, '--version', '0.26.0', '--vendor-editor', '/work/opf'], { log() {}, vendorExec }), /needs --write/u);
  await assert.rejects(main(['bump', '--site', same, '--version', '0.26.0', '--write', '--vendor-editor', '/work/opf'], { log() {}, vendorExec: () => ({ status: 2 }), vendorStatus: () => ({ status: 0, stdout: '' }) }), /failed in/u);
});

test('MR-56: bump-sites.yml rebuilds the vendored editor in the pptx-gallery leg only, from the release tag, and reports a failure there too', () => {
  assert.match(bump, /- name: Fetch the release tag\n {8}id: tag\n {8}if: \$\{\{ steps\.app\.outcome == 'success' && matrix\.repo == 'pptx-gallery' \}\}\n {8}continue-on-error: true\n {8}working-directory: opf\n {8}run: git fetch --depth=1 origin "refs\/tags\/v\$VERSION:refs\/tags\/v\$VERSION"/u);
  assert.match(bump, /VENDOR_EDITOR: \$\{\{ matrix\.repo == 'pptx-gallery' \}\}/u);
  assert.match(bump, /\[ "\$VENDOR_EDITOR" = true \] && vendor=\(--vendor-editor opf\)/u);
  assert.match(bump, /--write --refresh-lockfile "\$\{vendor\[@\]\}" --github-output/u);
  assert.match(bump, /matrix\.repo != 'pptx-gallery' \|\| steps\.tag\.outcome == 'success'/u, 'a missing tag stops the leg before it opens a pull request with a stale bundle');
  assert.match(bump, /steps\.tag\.outcome == 'failure' \|\| steps\.bump\.outcome == 'failure'/u);
  assert.match(bump, /git add -A/u, 'the rebuilt files are committed with the pins');
  const docs = read('docs/programs/monorepo/site-workflows/README.md');
  assert.doesNotMatch(docs, /not been made monorepo-aware|MR-52 follow-up|refreshes the bundle on the bump branch/u, 'the manual refresh note is gone');
  assert.match(docs, /pnpm vendor:gallery-editor --version/u);
  assert.match(read('docs/programs/monorepo/site-workflows/pptx-gallery/opf-bump-merge.yml'), /ALLOWED_FILES: '\^\(package\\\.json\|pnpm-lock\\\.yaml\|public\/opf-editor\/\.\*\|data\/opf-spec\\\.json\)\$'/u, 'the merge allows the vendored files');
});
