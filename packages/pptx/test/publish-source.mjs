import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
