import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { INSTALL_SCRIPTS, NPM12_DEFAULTS, cleanNpmEnvironment, isRegistrySpec, lockHazards, manifestHazards } from './npm12-consumer.mjs';

test('a registry range, a dist-tag and an npm: alias install from the registry; every other source does not', () => {
  for (const spec of ['1.2.3', '^0.26.8', '>=22', '~1.0.0 || ^2.0.0', 'latest', '*', 'npm:other@^1.0.0']) assert.equal(isRegistrySpec(spec), true, spec);
  for (const spec of ['github:user/repo', 'user/repo', 'git+https://example.com/repo.git', 'git://example.com/repo.git', 'https://example.com/pkg.tgz', 'file:../pkg.tgz', 'link:../pkg', 'workspace:^', 'catalog:', undefined]) assert.equal(isRegistrySpec(spec), false, String(spec));
});

test('a packed manifest with an install script, a gyp build or a git or remote dependency is a hazard; build and test scripts are not', () => {
  const clean = { name: 'a', scripts: { build: 'tsc', test: 'node --test', prepack: 'pnpm build' }, dependencies: { b: '^1.0.0' }, optionalDependencies: { c: '1.2.3' }, peerDependencies: { d: '^2' } };
  assert.deepEqual(manifestHazards(clean), []);
  for (const script of INSTALL_SCRIPTS) assert.match(manifestHazards({ ...clean, scripts: { [script]: 'node setup.js' } }).join(), new RegExp(`declares the ${script} script`));
  assert.match(manifestHazards({ ...clean, gypfile: true }).join(), /gypfile/);
  assert.match(manifestHazards({ ...clean, dependencies: { b: 'github:user/b' } }).join(), /dependencies b is "github:user\/b"/);
  assert.match(manifestHazards({ ...clean, optionalDependencies: { c: 'https://example.com/c.tgz' } }).join(), /optionalDependencies c/);
});

test('a lockfile entry with an install script, a non-registry source or a git dependency is a hazard; the local tarballs are not', () => {
  const tarball = 'file:../openpresentation-opf-0.26.8.tgz';
  const lock = { packages: {
    '': { name: 'consumer', dependencies: { '@openpresentation/opf': 'file:../openpresentation-opf-0.26.8.tgz' } },
    'node_modules/@openpresentation/opf': { version: '0.26.8', resolved: tarball, dependencies: { ajv: '^8.17.1' } },
    'node_modules/ajv': { version: '8.17.1', resolved: 'https://registry.npmjs.org/ajv/-/ajv-8.17.1.tgz' },
    'node_modules/linked': { resolved: '../elsewhere', link: true },
  } };
  assert.deepEqual(lockHazards(lock, { localTarballs: [tarball] }), []);
  assert.match(lockHazards(lock).join(), /opf@0\.26\.8 is resolved from file:/, 'without the allowance the tarball is a non-registry source');
  const bad = structuredClone(lock);
  bad.packages['node_modules/core-js'] = { version: '3.38.0', resolved: 'https://registry.npmjs.org/core-js/-/core-js-3.38.0.tgz', hasInstallScript: true };
  bad.packages['node_modules/fromgit'] = { version: '1.0.0', resolved: 'git+ssh://git@github.com/user/repo.git#abc' };
  bad.packages['node_modules/ajv'].dependencies = { dep: 'github:user/dep' };
  const problems = lockHazards(bad, { localTarballs: [tarball] });
  assert.equal(problems.length, 3, problems.join('\n'));
  assert.match(problems.join('\n'), /core-js@3\.38\.0 has an install script/);
  assert.match(problems.join('\n'), /fromgit@1\.0\.0 is resolved from git\+ssh/);
  assert.match(problems.join('\n'), /ajv@8\.17\.1 dependencies dep is "github:user\/dep"/);
});

test('the install environment drops every npm_* variable and points both npmrc files at empty files of their own', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'npm12-env-'));
  try {
    const env = cleanNpmEnvironment({ PATH: '/bin', HOME: '/home/a', npm_config_ignore_scripts: 'true', NPM_CONFIG_REGISTRY: 'https://example.com', npm_execpath: '/x/pnpm.cjs' }, { directory, cache: '/cache' });
    assert.deepEqual(Object.keys(env).sort(), ['HOME', 'PATH', 'npm_config_cache', 'npm_config_globalconfig', 'npm_config_update_notifier', 'npm_config_userconfig']);
    assert.notEqual(env.npm_config_userconfig, env.npm_config_globalconfig, 'npm refuses one file as both');
    for (const file of [env.npm_config_userconfig, env.npm_config_globalconfig]) assert.equal(readFileSync(file, 'utf8'), '');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('the leg asserts the npm 12 install-time defaults', () => {
  assert.deepEqual(NPM12_DEFAULTS, { 'allow-git': 'none', 'allow-remote': 'none', 'dangerously-allow-all-scripts': 'false' });
});
