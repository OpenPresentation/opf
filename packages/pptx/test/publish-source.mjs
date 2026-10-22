import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { verifyPublishSource } from '../scripts/publish-source.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function fixture(t, manifest = 'packages/javascript/package.json') {
  const cwd = mkdtempSync(path.join(tmpdir(), 'publish-source-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.invalid', GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.invalid' } }).trim();
  git('init', '--initial-branch=main');
  mkdirSync(path.dirname(path.join(cwd, manifest)), { recursive: true });
  writeFileSync(path.join(cwd, manifest), JSON.stringify({ name: '@openpresentation/test', version: '1.2.3' }));
  git('add', '.'); git('-c', 'commit.gpgsign=false', 'commit', '-m', 'release');
  const sha = git('rev-parse', 'HEAD');
  git('update-ref', 'refs/remotes/origin/main', sha);
  git('tag', 'opf-v1.2.3');
  const options = { cwd, manifest, tagPrefixes: ['opf-v', '@openpresentation/opf@v'], ref: 'refs/tags/opf-v1.2.3', sha };
  return { cwd, git, options, verify: (overrides = {}) => verifyPublishSource({ ...options, ...overrides }) };
}

test('merged lightweight tags and repeated manual tag runs pass; a later main tip is allowed', (t) => {
  const { git, verify, options } = fixture(t);
  assert.equal(verify().commit, options.sha);
  assert.deepEqual(verify(), verify());
  writeFileSync(path.join(options.cwd, 'later.txt'), 'later');
  git('add', '.'); git('-c', 'commit.gpgsign=false', 'commit', '-m', 'later main');
  git('update-ref', 'refs/remotes/origin/main', git('rev-parse', 'HEAD'));
  git('checkout', '--detach', options.sha);
  assert.equal(verify().commit, options.sha);
});

test('literal alternate prefixes, root manifests and annotated tag objects are supported', (t) => {
  const { git, verify, options } = fixture(t, 'package.json');
  git('-c', 'tag.gpgsign=false', 'tag', '-a', '@openpresentation/opf@v1.2.3', '-m', 'release');
  const ref = 'refs/tags/@openpresentation/opf@v1.2.3';
  const tagObject = git('rev-parse', ref);
  assert.notEqual(tagObject, options.sha);
  assert.equal(verify({ ref }).commit, options.sha);
  assert.equal(verify({ ref, sha: tagObject }).commit, options.sha);
  git('tag', 'opf-render-v1.2.3');
  assert.equal(verify({ ref: 'refs/tags/opf-render-v1.2.3', tagPrefixes: ['opf-render-v'] }).version, '1.2.3');
});

test('missing, branch and wrong-version refs fail before publishing', (t) => {
  const { git, verify } = fixture(t);
  for (const ref of [null, '', 'refs/heads/main', 'refs/heads/opf-v1.2.3']) assert.throws(() => verify({ ref }), /explicit refs\/tags/);
  git('tag', 'opf-v1.2.30');
  assert.throws(() => verify({ ref: 'refs/tags/opf-v1.2.30' }), /does not match/);
  assert.throws(() => verify({ ref: 'refs/tags/absent' }), /Git identity/);
  assert.throws(() => verify({ tagPrefixes: ['cli-v'] }), /does not match/);
});

test('off-main tags, missing main, checkout mismatch and event hash mismatch fail', (t) => {
  const { git, verify, options } = fixture(t);
  assert.throws(() => verify({ sha: '0'.repeat(40) }), /same release/);
  for (const sha of [null, '']) assert.throws(() => verify({ sha }), /exact release/);
  writeFileSync(path.join(options.cwd, 'branch.txt'), 'off main');
  git('add', '.'); git('-c', 'commit.gpgsign=false', 'commit', '-m', 'not merged');
  const offMain = git('rev-parse', 'HEAD');
  assert.throws(() => verify(), /same release/);
  git('tag', '-f', 'opf-v1.2.3', offMain);
  assert.throws(() => verify({ sha: offMain }), /merge-base/);
  git('update-ref', '-d', 'refs/remotes/origin/main');
  assert.throws(() => verify({ sha: offMain }), /Git identity/);
});

test('modified manifest cannot supply a different release version', (t) => {
  const { verify, options } = fixture(t);
  writeFileSync(path.join(options.cwd, options.manifest), '{"version":"9.9.9"}');
  assert.throws(() => verify(), /manifest differs/);
});

test('CLI reads the actual event ref/hash and fails closed for branch dispatch', (t) => {
  const { options } = fixture(t, 'package.json');
  const args = [path.join(root, 'scripts/publish-source.mjs'), '--manifest', 'package.json', '--tag-prefix', 'opf-v'];
  const run = (overrides = {}, omit = []) => {
    const env = { ...process.env, GITHUB_REF: options.ref, GITHUB_SHA: options.sha, ...overrides };
    for (const key of omit) delete env[key];
    return spawnSync(process.execPath, args, { cwd: options.cwd, encoding: 'utf8', env });
  };
  const good = run();
  assert.equal(good.status, 0, good.stderr);
  assert.equal(JSON.parse(good.stdout).commit, options.sha);
  const branch = run({ GITHUB_REF: 'refs/heads/main' });
  assert.equal(branch.status, 1);
  assert.match(branch.stderr, /explicit refs\/tags/);
  for (const absent of [run({ GITHUB_SHA: '' }), run({}, ['GITHUB_SHA'])]) {
    assert.equal(absent.status, 1);
    assert.match(absent.stderr, /exact release/);
  }
  const absentRef = run({}, ['GITHUB_REF']);
  assert.equal(absentRef.status, 1);
  assert.match(absentRef.stderr, /explicit refs\/tags/);
});

test('fixture rejection controls are independent of ambient CI event identities', () => {
  const env = { ...process.env, CI: 'true', GITHUB_REF: 'refs/tags/unrelated-v9.9.9', GITHUB_SHA: 'f'.repeat(40) };
  // This child starts its own runner rather than recursively reusing the parent's node:test context.
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, [
    '--test', '--test-reporter=tap', '--test-name-pattern=^(missing, branch|off-main tags)', fileURLToPath(import.meta.url),
  ], { encoding: 'utf8', env });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /# pass 2(?:\r?\n|$)/, 'Both rejection fixtures must actually execute in the child');
});

// BEGIN shared owned-workspace controls (mirrored by sibling publication tests).
test('checkout temporary HOME trust does not authorize the job HOME; exact workspace trust stays scoped', (t) => {
  const current = fixture(t, 'package.json');
  const adjacent = fixture(t, 'package.json');
  const homes = mkdtempSync(path.join(tmpdir(), 'publish-homes-'));
  t.after(() => rmSync(homes, { recursive: true, force: true }));
  const checkoutHome = path.join(homes, 'checkout'), jobHome = path.join(homes, 'job');
  for (const home of [checkoutHome, jobHome]) mkdirSync(home);
  const environment = (home, options) => {
    const env = { ...process.env };
    // No inherited Git config, credentials or CI identity may make a synthetic repository trusted.
    for (const key of Object.keys(env)) if (key.startsWith('GIT_')) delete env[key];
    return { ...env, HOME: home, USERPROFILE: home, XDG_CONFIG_HOME: path.join(home, 'xdg'),
      GIT_CONFIG_NOSYSTEM: '1', GIT_TEST_ASSUME_DIFFERENT_OWNER: '1', GIT_TERMINAL_PROMPT: '0',
      LC_ALL: 'C', LANG: 'C', GITHUB_REF: options.ref, GITHUB_SHA: options.sha };
  };
  const runGit = (home, args) => spawnSync('git', args, { cwd: current.cwd, encoding: 'utf8', env: environment(home, current.options) });
  const runGuard = (owner, overrides = {}) => spawnSync(process.execPath, [path.join(root, 'scripts/publish-source.mjs'),
    '--manifest', owner.options.manifest, '--tag-prefix', 'opf-v'], {
    cwd: owner.cwd, encoding: 'utf8', env: { ...environment(jobHome, owner.options), ...overrides },
  });
  const workspace = realpathSync(current.cwd);
  const checkoutTrust = runGit(checkoutHome, ['config', '--global', '--add', 'safe.directory', workspace]);
  assert.equal(checkoutTrust.status, 0, checkoutTrust.stderr);
  assert.equal(runGit(jobHome, ['check-ref-format', current.options.ref]).status, 0);
  const refused = runGuard(current);
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /rev-parse --is-shallow-repository/);
  assert.match(refused.stderr, /exit 128/);
  assert.match(refused.stderr, /dubious ownership/);
  const jobTrust = runGit(jobHome, ['config', '--global', '--add', 'safe.directory', workspace]);
  assert.equal(jobTrust.status, 0, jobTrust.stderr);
  const accepted = runGuard(current);
  assert.equal(accepted.status, 0, accepted.stderr);
  assert.equal(JSON.parse(accepted.stdout).commit, current.options.sha);
  const other = runGuard(adjacent);
  assert.equal(other.status, 1);
  assert.match(other.stderr, /dubious ownership/);
  const wrongEvent = runGuard(current, { GITHUB_SHA: 'f'.repeat(40) });
  assert.equal(wrongEvent.status, 1);
  assert.match(wrongEvent.stderr, /same release/);
  const branch = runGuard(current, { GITHUB_REF: 'refs/heads/main' });
  assert.equal(branch.status, 1);
  assert.match(branch.stderr, /explicit refs\/tags/);
  writeFileSync(path.join(current.cwd, 'package.json'), '{"version":"9.9.9"}');
  const dirty = runGuard(current);
  assert.equal(dirty.status, 1);
  assert.match(dirty.stderr, /manifest differs/);
});

test('Git failure diagnostics retain status and bounded real stderr', (t) => {
  const { cwd, verify } = fixture(t);
  // Git itself emits a long malformed-config value; no fake Git binary or mocked child process.
  appendFileSync(path.join(cwd, '.git', 'config'), `\n[core]\nrepositoryformatversion = ${'x'.repeat(10_000)}\n`);
  assert.throws(() => verify(), error => {
    assert.match(error.message, /Git identity check failed/);
    assert.match(error.message, /exit 128/);
    assert.match(error.message, /bad numeric config value/);
    assert.match(error.message, /\[truncated\]/);
    assert.ok(error.message.length < 2300, 'Git stderr cannot flood the publication log');
    return true;
  });
});
// END shared owned-workspace controls.

test('the publish workflow gates every entry before dependencies with full history', () => {
  const text=readFileSync(path.join(root,'.github/workflows/release.yml'),'utf8');
  const step=text.indexOf('- name: Verify merged release source');
  assert.ok(step>text.indexOf('fetch-depth: 0'));
  assert.ok(step<text.indexOf('actions/setup-node@'));
  assert.ok(step<text.indexOf('npm ci'));
  const block=text.slice(step,text.indexOf('\n      - ',step+1));
  assert.ok(!/\n\s+if:/.test(block),'manual dispatch cannot skip the gate');
  assert.ok(block.includes('--manifest package.json'));
  for(const prefix of ['opf-pptx-v','@openpresentation/opf-pptx@v'])assert.ok(block.includes(`--tag-prefix ${prefix}`));
});
