import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workflowName = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).name === '@openpresentation/opf-render' ? 'npm-publish.yml' : 'release.yml';
const workflow = readFileSync(path.join(root, '.github/workflows', workflowName), 'utf8');
const stepName = '- name: Trust the checked-out workspace for Git';
function trustCommand() {
  const start = workflow.indexOf(stepName);
  assert.ok(start > 0, 'The actual publishing job must establish exact workspace trust');
  const end = workflow.indexOf('\n      - ', start + 1);
  const step = workflow.slice(start, end);
  assert.ok(!/\n\s+if:/.test(step), 'Every publication entry must establish workspace trust');
  const command = step.match(/\n\s+run: (.+)/)?.[1];
  assert.equal(command, 'git config --global --add safe.directory "$GITHUB_WORKSPACE"');
  return { start, command };
}

test('publication trusts exactly its full-depth checkout before every Git identity check', () => {
  const { start } = trustCommand();
  const npm = workflow.indexOf('  npm:');
  const checkout = workflow.indexOf('fetch-depth: 0', npm);
  const guard = workflow.indexOf('- name: Verify merged release source', npm);
  assert.ok(npm >= 0 && checkout > npm && start > checkout && start < guard);
  assert.ok(guard < workflow.indexOf('actions/setup-node@', guard));
  assert.equal(workflow.indexOf(stepName, start + 1), -1, 'Only the publishing checkout is trusted');
});

test('actual setup survives checkout temporary HOME and does not trust a second repository', (t) => {
  const { command } = trustCommand();
  const base = realpathSync(mkdtempSync(path.join(tmpdir(), 'publish-workflow-')));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const workspace = path.join(base, 'workspace with spaces');
  const other = path.join(base, 'untrusted');
  const checkoutHome = path.join(base, 'checkout-home');
  const jobHome = path.join(base, 'job-home');
  for (const dir of [workspace, other, checkoutHome, jobHome]) mkdirSync(dir);
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (key.startsWith('GIT_')) delete env[key];
  Object.assign(env, { HOME: jobHome, USERPROFILE: jobHome, XDG_CONFIG_HOME: path.join(base, 'xdg'), GIT_CONFIG_NOSYSTEM: '1',
    LC_ALL: 'C', LANG: 'C', GITHUB_WORKSPACE: workspace, GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.invalid',
    GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.invalid' });
  for (const dir of [workspace, other]) execFileSync('git', ['init', dir], { env, stdio: 'pipe' });
  const git = (...args) => execFileSync('git', args, { cwd: workspace, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  writeFileSync(path.join(workspace, 'package.json'), JSON.stringify({ version: '1.2.3' }));
  git('add', 'package.json');
  git('-c', 'commit.gpgsign=false', 'commit', '-m', 'release fixture');
  const sha = git('rev-parse', 'HEAD');
  git('update-ref', 'refs/remotes/origin/main', sha);
  git('-c', 'tag.gpgsign=false', 'tag', 'test-v1.2.3');
  const checked = { ...env, HOME: checkoutHome };
  execFileSync('git', ['config', '--global', '--add', 'safe.directory', workspace], { env: checked, stdio: 'pipe' });
  const differentOwner = { ...env, GIT_TEST_ASSUME_DIFFERENT_OWNER: '1' };
  const read = (cwd) => spawnSync('git', ['rev-parse', '--is-shallow-repository'], { cwd, env: differentOwner, encoding: 'utf8' });
  const before = read(workspace);
  assert.notEqual(before.status, 0, 'Checkout temporary HOME must not silently authorize the job HOME');
  assert.match(before.stderr, /dubious ownership/i);
  execFileSync('sh', ['-c', command], { cwd: workspace, env, stdio: 'pipe' });
  const after = read(workspace);
  assert.equal(after.status, 0, after.stderr);
  assert.equal(after.stdout.trim(), 'false');
  const verify = (overrides = {}) => spawnSync(process.execPath, [path.join(root, 'scripts/publish-source.mjs'), '--manifest', 'package.json', '--tag-prefix', 'test-v'], {
    cwd: workspace, env: { ...differentOwner, GITHUB_REF: 'refs/tags/test-v1.2.3', GITHUB_SHA: sha, ...overrides }, encoding: 'utf8',
  });
  const publishedIdentity = verify();
  assert.equal(publishedIdentity.status, 0, publishedIdentity.stderr);
  assert.equal(JSON.parse(publishedIdentity.stdout).commit, sha);
  const wrongRef = verify({ GITHUB_REF: 'refs/heads/main' });
  assert.equal(wrongRef.status, 1);
  assert.match(wrongRef.stderr, /explicit refs\/tags/);
  const wrongIdentity = verify({ GITHUB_SHA: '0'.repeat(40) });
  assert.equal(wrongIdentity.status, 1);
  assert.match(wrongIdentity.stderr, /same release/);
  const entries = execFileSync('git', ['config', '--global', '--get-all', 'safe.directory'], { env, encoding: 'utf8' }).trim().split(/\r?\n/);
  assert.deepEqual(entries, [workspace]);
  const denied = read(other);
  assert.notEqual(denied.status, 0);
  assert.match(denied.stderr, /dubious ownership/i);
});
