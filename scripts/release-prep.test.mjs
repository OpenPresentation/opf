import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { assemble } from './changelog-fragments.mjs';
import { PREP_PACKAGES, checkPull, checkRelease, classifyChanges, main, manifestProblem, parsePrepMarker, prepMarker, queuePullNumber, releasePrepScope } from './release-prep.mjs';
import { PACKAGES, allowedPrepFile, defaultBranch, prepBody } from './release-train.mjs';

const REPO = 'OpenPresentation/opf';
const CORE = 'packages/javascript/package.json';
const CLI = 'packages/cli/package.json';

const manifest = (name, version, extra = {}) => `${JSON.stringify({ name, version, scripts: { test: 'node t.mjs' }, files: ['dist'], dependencies: { '@openpresentation/gallery': '^4.0.0', zod: '^3.0.0' }, ...extra }, null, 2)}\n`;
const files = () => ({
  [CORE]: manifest('@openpresentation/opf', '0.24.2'),
  [CLI]: manifest('@openpresentation/cli', '0.24.0', { dependencies: { '@openpresentation/opf': '^0.24.0' }, devDependencies: { '@openpresentation/opf-render': '0.24.0' } }),
  'CHANGELOG.md': '# Changelog\n\n## Unreleased\n\n## 0.24.2 (2026-10-20)\n\n- earlier\n',
  'packages/cli/CHANGELOG.md': '# CLI\n\n## Unreleased\n\n## 0.24.0 (2026-10-19)\n\n- earlier cli\n',
  'pnpm-lock.yaml': 'lockfileVersion: 9\n',
  'changes/config.json': JSON.stringify({ default: 'opf', targets: { opf: 'CHANGELOG.md', cli: 'packages/cli/CHANGELOG.md' }, codePaths: ['packages/javascript/src/'] }),
  'changes/core-fix.md': '---\ntype: fixed\npackages: [opf]\n---\nRR-1: a core fix.\n',
  'changes/both.md': '---\ntype: changed\npackages: [opf, cli]\n---\nRR-2: both.\n',
  'packages/javascript/src/index.ts': 'export const a = 1;\n',
  'scripts/tool.mjs': 'export const b = 1;\n',
});

/** A real repository: `base` is main's tip; `change(dir)` edits the working tree and the result is the merge group head. */
function fixture(t, change) {
  const dir = mkdtempSync(path.join(tmpdir(), 'release-prep-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const env = { ...process.env, GIT_AUTHOR_NAME: 'T', GIT_AUTHOR_EMAIL: 't@example.invalid', GIT_COMMITTER_NAME: 'T', GIT_COMMITTER_EMAIL: 't@example.invalid' };
  const git = (...args) => execFileSync('git', args, { cwd: dir, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '--initial-branch=main');
  for (const [file, text] of Object.entries(files())) {
    mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    writeFileSync(path.join(dir, file), text);
  }
  git('add', '.');
  git('-c', 'commit.gpgsign=false', 'commit', '-m', 'main');
  const base = git('rev-parse', 'HEAD');
  change(dir, git);
  git('add', '-A');
  git('-c', 'commit.gpgsign=false', 'commit', '-m', 'queue entry');
  const head = git('rev-parse', 'HEAD');
  const event = { merge_group: { base_sha: base, head_sha: head, head_ref: `refs/heads/gh-readonly-queue/main/pr-760-${head}`, base_ref: 'refs/heads/main' } };
  return { dir, base, head, event, git };
}

const pull = (over = {}) => ({ number: 760, title: 'RR-97: release core 0.24.3', head: { ref: 'codex/release-core-0-24-3', repo: { full_name: REPO } }, base: { ref: 'main' }, body: `RR-97: release-prep PR.\n${prepMarker('core', '0.24.3')}\n`, ...over });

const edit = (dir, file, fn) => writeFileSync(path.join(dir, file), fn(readFileSync(path.join(dir, file), 'utf8')));
/** What `release-train.mjs prep core 0.24.3` produces: version, changelog section, the consumed fragments, the lockfile. */
function coreRelease(dir) {
  edit(dir, CORE, (text) => text.replace('"0.24.2"', '"0.24.3"'));
  assemble(dir, { version: '0.24.3', date: '2026-10-20', summary: '', package: 'opf' });
  edit(dir, 'pnpm-lock.yaml', (text) => `${text}# refreshed\n`);
}

const decide = (f, over = {}) => releasePrepScope({ event: f.event, eventName: 'merge_group', sha: f.head, repository: REPO, cwd: f.dir, fetchPull: async () => pull(), ...over });

test('the marker, the branch and the title are written by the train and read back by the fast path', () => {
  const core = PACKAGES.find((pkg) => pkg.key === 'core');
  const body = prepBody({ pkg: core, version: '0.24.3', previous: '0.24.2', item: 'RR-97', changes: [], fragments: 1, prose: [], train: { core: '0.24.3' } });
  assert.deepEqual(parsePrepMarker(body), { key: 'core', version: '0.24.3' });
  assert.equal(defaultBranch(core, '0.24.3'), 'codex/release-core-0-24-3');
  const announced = checkPull({ ...pull(), body }, REPO);
  assert.deepEqual(announced, { package: 'core', version: '0.24.3' });
  for (const bad of ['', null, 'no marker', `${prepMarker('core', '0.24.3')}${prepMarker('core', '0.24.4')}`, prepMarker('render', '0.24.3'), prepMarker('core', 'v0.24.3'), '<!-- release-train-prep: core 0.24.3 --', prepMarker('core', '0.24.3;rm')]) assert.equal(parsePrepMarker(bad), null, String(bad));
});

test('the allowed files are exactly the files the train lets a core or CLI release-prep PR change', () => {
  for (const [key, pkg] of Object.entries(PREP_PACKAGES)) {
    const train = PACKAGES.find((candidate) => candidate.key === key);
    assert.equal(train.manifest, pkg.manifest);
    assert.equal(train.changelog.file, pkg.changelog);
    assert.equal(train.changelog.package, pkg.target);
    assert.equal(train.repo, 'opf');
    for (const file of [pkg.manifest, pkg.changelog, 'pnpm-lock.yaml', 'changes/x.md']) assert.equal(allowedPrepFile(train, file), true, file);
  }
  assert.equal(allowedPrepFile(PACKAGES.find((pkg) => pkg.key === 'core'), 'README.md'), false);
});

test('a real core release-prep diff takes the fast path and names package and version', async (t) => {
  const f = fixture(t, coreRelease);
  const result = await decide(f);
  assert.deepEqual([result.releasePrep, result.package, result.version], [true, 'core', '0.24.3'], result.reason);
  // The multi-package fragment was rewritten to name only the CLI, as the assembler does; the single-package one is deleted.
  assert.match(readFileSync(path.join(f.dir, 'changes/both.md'), 'utf8'), /packages: \[cli\]/);
  assert.equal(execFileSync('git', ['diff', '--name-status', f.base, f.head], { cwd: f.dir, encoding: 'utf8' }).includes('D\tchanges/core-fix.md'), true);
  assert.deepEqual(checkRelease({ key: 'core', version: '0.24.3', root: f.dir }), []);
});

test('a CLI release-prep diff with a raised core floor takes the fast path', async (t) => {
  const f = fixture(t, (dir) => {
    edit(dir, CLI, (text) => text.replace('"0.24.0"', '"0.24.1"').replace('"^0.24.0"', '"^0.24.1"').replace('"opf-render": "0.24.0"', '"opf-render": "0.24.1"'));
    assemble(dir, { version: '0.24.1', date: '2026-10-20', summary: '', package: 'cli' });
  });
  const result = await decide(f, { fetchPull: async () => pull({ title: 'RR-97: release CLI 0.24.1', head: { ref: 'codex/release-cli-0-24-1', repo: { full_name: REPO } }, body: prepMarker('cli', '0.24.1') }) });
  assert.deepEqual([result.releasePrep, result.package, result.version], [true, 'cli', '0.24.1'], result.reason);
  assert.deepEqual(checkRelease({ key: 'cli', version: '0.24.1', root: f.dir }), []);
});

test('a release-prep PR cannot carry a code change: the fast path is not taken', async (t) => {
  const smuggled = {
    'core source': (dir) => edit(dir, 'packages/javascript/src/index.ts', (text) => `${text}export const evil = 1;\n`),
    'a script': (dir) => edit(dir, 'scripts/tool.mjs', (text) => `${text}process.exit(0);\n`),
    'a new file': (dir) => writeFileSync(path.join(dir, 'scripts/new.mjs'), 'export {};\n'),
    'a workflow': (dir) => { mkdirSync(path.join(dir, '.github/workflows'), { recursive: true }); writeFileSync(path.join(dir, '.github/workflows/x.yml'), 'on: push\n'); },
    'a README': (dir) => writeFileSync(path.join(dir, 'README.md'), 'hi\n'),
    'a test': (dir) => { mkdirSync(path.join(dir, 'test'), { recursive: true }); writeFileSync(path.join(dir, 'test/a.mjs'), ''); },
    'the lockfile deleted': (dir) => rmSync(path.join(dir, 'pnpm-lock.yaml')),
    'a manifest script': (dir) => edit(dir, CORE, (text) => text.replace('node t.mjs', 'node evil.mjs')),
    'a manifest files list': (dir) => edit(dir, CORE, (text) => text.replace('"dist"', '"dist", "extra"')),
    'a third-party dependency': (dir) => edit(dir, CORE, (text) => text.replace('"^3.0.0"', '"^3.9.0"')),
    'a new dependency': (dir) => edit(dir, CORE, (text) => text.replace('"zod"', '"left-pad": "^1.0.0",\n    "zod"')),
    'an ecosystem dependency removed': (dir) => edit(dir, CLI, (text) => text.replace('"@openpresentation/opf": "^0.24.0"', '')),
    'an ecosystem dependency pointed at a URL': (dir) => edit(dir, CLI, (text) => text.replace('"^0.24.0"', '"github:evil/opf"')),
    'the package name': (dir) => edit(dir, CORE, (text) => text.replace('@openpresentation/opf', '@openpresentation/other')),
    'a changelog line rewritten': (dir) => edit(dir, 'CHANGELOG.md', (text) => text.replace('- earlier', '- edited')),
    'an unrelated fragment added': (dir) => writeFileSync(path.join(dir, 'changes/new.md'), '---\ntype: fixed\n---\nx\n'),
    'a fragment edited': (dir) => edit(dir, 'changes/both.md', (text) => text.replace('RR-2: both.', 'RR-2: something else.')),
    'a manifest that is not JSON': (dir) => writeFileSync(path.join(dir, CORE), 'not json'),
  };
  for (const [name, extra] of Object.entries(smuggled)) {
    const f = fixture(t, (dir, git) => { coreRelease(dir); extra(dir, git); });
    const result = await decide(f);
    assert.equal(result.releasePrep, false, `${name}: ${result.reason}`);
  }
});

test('code changes and mixed groups never take the fast path, whatever the pull request says', async (t) => {
  for (const change of [
    (dir) => edit(dir, 'packages/javascript/src/index.ts', (text) => `${text}// x\n`),
    (dir) => { coreRelease(dir); writeFileSync(path.join(dir, 'packages/javascript/src/extra.ts'), ''); },
    (dir) => { edit(dir, CORE, (text) => text.replace('"0.24.2"', '"0.24.3"')); edit(dir, 'packages/javascript/src/index.ts', (text) => `${text}// x\n`); },
  ]) {
    const f = fixture(t, change);
    const result = await decide(f, { fetchPull: async () => pull() });
    assert.equal(result.releasePrep, false, result.reason);
  }
});

test('the marker is required: a clean release-looking diff from the wrong pull request is not fast-pathed', async (t) => {
  const f = fixture(t, coreRelease);
  const cases = [
    pull({ body: 'no marker' }),
    pull({ body: prepMarker('core', '0.24.4') }),
    pull({ body: prepMarker('cli', '0.24.3') }),
    pull({ head: { ref: 'feature/release', repo: { full_name: REPO } } }),
    pull({ head: { ref: 'codex/release-core-0-24-3', repo: { full_name: 'someone/opf' } } }),
    pull({ head: { ref: 'codex/release-core-0-24-3', repo: null } }),
    pull({ base: { ref: 'release' } }),
    pull({ title: 'RR-97: tidy things' }),
    pull({ title: 'RR-97: release core 0.24.30' }),
    pull({ head: { ref: 'codex/release-core-0-24-4', repo: { full_name: REPO } }, body: prepMarker('core', '0.24.4'), title: 'release core 0.24.4' }),
  ];
  for (const candidate of cases) assert.equal((await decide(f, { fetchPull: async () => candidate })).releasePrep, false, JSON.stringify(candidate.head) + candidate.body);
  assert.equal((await decide(f, { fetchPull: async () => { throw new Error('HTTP 500'); } })).releasePrep, false);
  assert.equal((await decide(f, { fetchPull: async () => null })).releasePrep, false);
});

test('the diff must set the announced package to the announced version', async (t) => {
  // The PR announces 0.24.4 but the diff sets 0.24.3, and a diff that leaves the version alone sets nothing.
  const f = fixture(t, coreRelease);
  assert.equal((await decide(f, { fetchPull: async () => pull({ title: 'release core 0.24.4', head: { ref: 'codex/release-core-0-24-4', repo: { full_name: REPO } }, body: prepMarker('core', '0.24.4') }) })).releasePrep, false);
  const noBump = fixture(t, (dir) => { edit(dir, 'pnpm-lock.yaml', (text) => `${text}# only\n`); });
  const result = await decide(noBump);
  assert.equal(result.releasePrep, false);
  assert.match(result.reason, /does not set/);
});

test('only a merge_group run whose checkout is the group head can take the fast path', async (t) => {
  const f = fixture(t, coreRelease);
  for (const eventName of ['pull_request', 'push', 'workflow_dispatch', 'schedule', undefined, '']) assert.equal((await decide(f, { eventName })).releasePrep, false, String(eventName));
  assert.equal((await decide(f, { sha: f.base })).releasePrep, false);
  assert.equal((await decide(f, { event: { merge_group: { ...f.event.merge_group, head_sha: f.base } } })).releasePrep, false);
  assert.equal((await decide(f, { event: { merge_group: { ...f.event.merge_group, base_sha: f.head } } })).releasePrep, false, 'an empty diff is not a release');
  assert.equal((await decide(f, { event: { merge_group: { ...f.event.merge_group, base_sha: 'abc' } } })).releasePrep, false);
  assert.equal((await decide(f, { event: { merge_group: { ...f.event.merge_group, base_sha: '1'.repeat(40) } } })).releasePrep, false, 'an unfetchable base fails closed');
  assert.equal((await decide(f, { event: { merge_group: { ...f.event.merge_group, head_ref: 'refs/heads/main' } } })).releasePrep, false);
  assert.equal((await decide(f, { event: {} })).releasePrep, false);
  assert.equal((await decide(f, { event: null })).releasePrep, false);
  assert.equal((await decide(f, { cwd: tmpdir() })).releasePrep, false);
});

test('queue branch names', () => {
  assert.equal(queuePullNumber(`refs/heads/gh-readonly-queue/main/pr-760-${'a'.repeat(40)}`), 760);
  assert.equal(queuePullNumber(`gh-readonly-queue/main/pr-5-${'a'.repeat(40)}`), 5);
  for (const bad of ['refs/heads/main', `gh-readonly-queue/main/pr-x-${'a'.repeat(40)}`, 'gh-readonly-queue/main/pr-760-short', undefined, null]) assert.equal(queuePullNumber(bad), null, String(bad));
});

test('manifestProblem allows a version and ecosystem range change and nothing else', () => {
  const base = manifest('@openpresentation/cli', '0.24.0', { dependencies: { '@openpresentation/opf': '^0.24.0', zod: '^3.0.0' }, opf: { requiresUnreleasedCore: '0.25.0' } });
  const ok = [
    (m) => { m.version = '0.24.1'; },
    (m) => { m.dependencies['@openpresentation/opf'] = '^0.24.1'; },
    (m) => { m.dependencies['@openpresentation/opf'] = '0.24.1-rc.1'; },
    (m) => { delete m.opf; },
    (m) => { m.version = '0.24.1'; m.dependencies = { zod: '^3.0.0', '@openpresentation/opf': '~0.24.1' }; },
  ];
  for (const change of ok) {
    const head = JSON.parse(base);
    change(head);
    assert.equal(manifestProblem(base, JSON.stringify(head)), null, JSON.stringify(head));
  }
  const bad = [
    (m) => { m.scripts.test = 'x'; },
    (m) => { m.name = 'x'; },
    (m) => { m.bin = 'evil.js'; },
    (m) => { m.dependencies.zod = '^4.0.0'; },
    (m) => { delete m.dependencies.zod; },
    (m) => { m.devDependencies = { '@openpresentation/opf': '^1.0.0' }; },
    (m) => { m.dependencies['@openpresentation/opf'] = 'file:../evil'; },
    (m) => { m.dependencies['@openpresentation/opf'] = '^0.24.x'; },
    (m) => { m.opf = { other: 1 }; },
    (m) => { m.version = 'next'; },
    (m) => { m.overrides = { zod: '1.0.0' }; },
    (m) => { m.pnpm = { overrides: {} }; },
  ];
  for (const change of bad) {
    const head = JSON.parse(base);
    change(head);
    assert.equal(typeof manifestProblem(base, JSON.stringify(head)), 'string', JSON.stringify(head));
  }
  assert.equal(manifestProblem('{', base), 'is not valid JSON');
  assert.equal(manifestProblem(base, '[]'), 'has no release version');
});

test('classifyChanges: empty and unknown statuses are rejected', () => {
  assert.equal(classifyChanges([], () => null).ok, false);
  const read = (side) => (side === 'base' ? manifest('x', '1.0.0') : manifest('x', '1.0.1'));
  assert.equal(classifyChanges([{ status: 'M', file: CORE, added: 1, deleted: 1 }], read).ok, true);
  for (const status of ['A', 'D', 'R', 'T', 'U']) assert.equal(classifyChanges([{ status, file: CORE, added: 1, deleted: 1 }], read).ok, false, status);
  assert.equal(classifyChanges([{ status: 'M', file: 'CHANGELOG.md', added: 4, deleted: 0 }], read).ok, true);
  assert.equal(classifyChanges([{ status: 'M', file: 'CHANGELOG.md', added: 4, deleted: 1 }], read).ok, false);
  assert.equal(classifyChanges([{ status: 'M', file: 'changes/README.md', added: 1, deleted: 0 }], read).ok, false);
  assert.equal(classifyChanges([{ status: 'D', file: 'changes/x.md', added: 0, deleted: 5 }], read).ok, true);
  assert.equal(classifyChanges([{ status: 'D', file: 'changes/config.json', added: 0, deleted: 5 }], read).ok, false);
});

test('the minimal job fails an inconsistent release', async (t) => {
  const f = fixture(t, coreRelease);
  assert.deepEqual(checkRelease({ key: 'core', version: '0.24.3', root: f.dir }), []);
  assert.match(checkRelease({ key: 'core', version: '0.24.4', root: f.dir }).join(), /carries 0\.24\.3, not 0\.24\.4/);
  assert.match(checkRelease({ key: 'core', version: '0.24.4', root: f.dir }).join(), /no non-empty "## 0\.24\.4" section/);
  assert.match(checkRelease({ key: 'cli', version: '0.24.0', root: f.dir }).join(), /fragments for cli are left in changes\/: both/);
  assert.match(checkRelease({ key: 'render', version: '0.24.0', root: f.dir }).join(), /must be one of core, cli/);
  assert.match(checkRelease({ key: 'core', version: 'latest', root: f.dir }).join(), /not a release version/);
  edit(f.dir, 'CHANGELOG.md', (text) => text.replace(/## 0\.24\.3[^\n]*\n[\s\S]*?(?=\n## )/, '## 0.24.3 (2026-10-20)\n'));
  assert.match(checkRelease({ key: 'core', version: '0.24.3', root: f.dir }).join(), /no non-empty "## 0\.24\.3" section/);
  writeFileSync(path.join(f.dir, 'changes/late.md'), '---\ntype: fixed\npackages: [opf]\n---\nlate\n');
  assert.match(checkRelease({ key: 'core', version: '0.24.3', root: f.dir }).join(), /fragments for opf are left in changes\/: late/);
});

test('the command writes the outputs a workflow reads, and never fast-paths a local run', async (t) => {
  const f = fixture(t, coreRelease);
  const output = path.join(f.dir, 'out.txt');
  writeFileSync(output, '');
  const lines = [];
  const eventPath = path.join(f.dir, 'event.json');
  writeFileSync(eventPath, JSON.stringify(f.event));
  const cwd = process.cwd();
  process.chdir(f.dir);
  t.after(() => process.chdir(cwd));
  const env = { GITHUB_EVENT_PATH: eventPath, GITHUB_EVENT_NAME: 'merge_group', GITHUB_SHA: f.head, GITHUB_REPOSITORY: REPO, GITHUB_OUTPUT: output, GITHUB_TOKEN: 'x' };
  // No network in a test: an unreachable API is "not taken".
  assert.equal(await main(['scope'], { ...env, GITHUB_API_URL: 'http://127.0.0.1:9' }, (line) => lines.push(line)), 0);
  assert.equal(readFileSync(output, 'utf8'), 'release_prep=false\n');
  assert.match(lines[0], /not taken/);
  assert.equal(await main(['check'], { RELEASE_PREP_PACKAGE: 'core', RELEASE_PREP_VERSION: '0.24.3' }, () => {}), 0);
  assert.equal(await main(['check'], { RELEASE_PREP_PACKAGE: 'core', RELEASE_PREP_VERSION: '9.9.9' }, () => {}), 1);
  assert.equal(await main(['nope'], {}, () => {}), 2);
});
