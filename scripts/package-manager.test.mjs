import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { npmEnvironment, packageManagerInvocation, quoteForCmd, spawnSpec } from './package-manager.mjs';

// #525: Windows launchers must not hand the executable or an argument to cmd.exe unquoted ("C:\Program Files\...").
const WINDOWS_NODE = String.raw`C:\Program Files\nodejs\node.exe`;

function fakeInstall(t) {
  const parent = mkdtempSync(path.join(tmpdir(), 'opf-package-manager-'));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const bin = path.join(parent, 'Program Files', 'nodejs');
  const entries = {
    pnpm: path.join(bin, 'node_modules', 'pnpm', 'bin', 'pnpm.cjs'),
    npm: path.join(bin, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    npx: path.join(bin, 'node_modules', 'npm', 'bin', 'npx-cli.js'),
  };
  for (const entry of Object.values(entries)) {
    mkdirSync(path.dirname(entry), { recursive: true });
    writeFileSync(entry, '');
  }
  return { bin, entries, env: { PATH: `${path.join(parent, 'elsewhere')};"${bin}"`, ComSpec: String.raw`C:\Windows\System32\cmd.exe` } };
}

test('spawnSpec spawns as is outside Windows', () => {
  assert.deepEqual(spawnSpec(['pnpm', 'run', 'a b'], { platform: 'linux' }), { command: 'pnpm', args: ['run', 'a b'], options: {} });
});

test('an npm or npx child does not inherit the npm_config_* variables only pnpm understands (npm warns "Unknown env config" for each)', () => {
  const env = {
    PATH: '/bin', npm_config_registry: 'https://registry.example/', npm_config_user_agent: 'pnpm/10', 'npm_config_@scope:registry': 'https://scope.example/',
    npm_config_overrides: '{}', npm_config_recursive: 'true', npm_config_verify_deps_before_run: 'false', npm_config_npm_globalconfig: '/x', npm_config__jsr_registry: 'https://npm.jsr.io/',
    npm_config_link_workspace_packages: 'false', npm_config_auto_install_peers: 'false', npm_config_frozen_lockfile: 'true', npm_config_manage_package_manager_versions: 'false',
  };
  const kept = { PATH: '/bin', npm_config_registry: 'https://registry.example/', npm_config_user_agent: 'pnpm/10', 'npm_config_@scope:registry': 'https://scope.example/' };
  assert.deepEqual(npmEnvironment(env), kept);
  for (const program of ['npm', 'npx', '/usr/bin/npm']) assert.deepEqual(spawnSpec([program, 'view', 'x'], { platform: 'linux', env }).options, { env: kept }, program);
  assert.deepEqual(spawnSpec(['pnpm', 'run', 'x'], { platform: 'linux', env }).options, {}, 'pnpm keeps its own variables');
  assert.deepEqual(spawnSpec(['node', 'x.mjs'], { platform: 'linux', env }).options, {});
  assert.equal(npmEnvironment({ NPM_CONFIG_OVERRIDES: '{}', A: '1' }).NPM_CONFIG_OVERRIDES, undefined);
});

test('spawnSpec runs pnpm, npm and npx as their JavaScript entrypoint with Node on Windows, with no shell', (t) => {
  const { entries, env } = fakeInstall(t);
  for (const name of ['pnpm', 'pnpm.cmd', 'PNPM.CMD']) {
    assert.deepEqual(spawnSpec([name, 'run', 'check text'], { platform: 'win32', env }), { command: process.execPath, args: [entries.pnpm, 'run', 'check text'], options: {} }, name);
  }
  assert.deepEqual(spawnSpec(['npm.cmd', 'view', 'x'], { platform: 'win32', env }), { command: process.execPath, args: [entries.npm, 'view', 'x'], options: { env } });
  assert.deepEqual(spawnSpec(['npx', 'tsc'], { platform: 'win32', env }), { command: process.execPath, args: [entries.npx, 'tsc'], options: { env } });
  // `pnpm run` sets npm_execpath to the pnpm that is running it.
  const explicit = path.join(path.dirname(entries.pnpm), 'pnpm.cjs');
  assert.equal(spawnSpec(['pnpm', 'x'], { platform: 'win32', env: { npm_execpath: explicit } }).args[0], explicit);
});

test('spawnSpec leaves a program with a space in its path alone: no shell, nothing split', () => {
  const spec = spawnSpec([WINDOWS_NODE, String.raw`C:\Users\A B\repo\scripts\agent-slot.mjs`, '--', 'a b'], { platform: 'win32', env: {} });
  assert.deepEqual(spec, { command: WINDOWS_NODE, args: [String.raw`C:\Users\A B\repo\scripts\agent-slot.mjs`, '--', 'a b'], options: {} });
  // A package manager's own .exe, and a name that only looks like an object property, are plain programs.
  assert.equal(spawnSpec([String.raw`C:\tools\pnpm.exe`, '-v'], { platform: 'win32', env: {} }).command, String.raw`C:\tools\pnpm.exe`);
  assert.equal(spawnSpec(['constructor'], { platform: 'win32', env: {} }).command, 'constructor');
});

test('spawnSpec quotes every part of a .cmd file, or of a package manager it cannot find, for cmd.exe', () => {
  const env = { PATH: '', ComSpec: String.raw`C:\Windows\System32\cmd.exe` };
  const shim = String.raw`C:\Program Files\tool\tool.cmd`;
  const spec = spawnSpec([shim, 'a b', 'c'], { platform: 'win32', env });
  assert.equal(spec.command, env.ComSpec);
  assert.deepEqual(spec.args, ['/d', '/s', '/c', `""${shim}" "a b" c"`]);
  assert.deepEqual(spec.options, { windowsVerbatimArguments: true });
  assert.deepEqual(spawnSpec(['pnpm', 'run', 'x y'], { platform: 'win32', env }).args, ['/d', '/s', '/c', '"pnpm run "x y""']);
});

test('packageManagerInvocation still refuses an unknown package manager and a missing entrypoint', () => {
  assert.throws(() => packageManagerInvocation('yarn', [], { platform: 'win32', env: {} }), /Unsupported package manager/);
  assert.throws(() => packageManagerInvocation('constructor', [], { platform: 'win32', env: {} }), /Unsupported package manager/);
  assert.throws(() => packageManagerInvocation('pnpm', [], { platform: 'win32', env: { PATH: '' } }), /Cannot locate pnpm/);
  assert.deepEqual(packageManagerInvocation('pnpm', ['-v'], { platform: 'linux' }), { command: 'pnpm', args: ['-v'] });
});

test('quoteForCmd quotes spaces and cmd metacharacters only', () => {
  assert.equal(quoteForCmd('plain'), 'plain');
  assert.equal(quoteForCmd('a b'), '"a b"');
  assert.equal(quoteForCmd('a&b'), '"a&b"');
  assert.equal(quoteForCmd(''), '""');
});
