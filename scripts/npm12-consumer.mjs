// The npm 12 consumer leg of nightly.yml (MR-30 slow set): the helpers of scripts/test-npm12-consumer.mjs, kept apart so
// scripts/npm12-consumer.test.mjs can test them without installing anything.
//
// npm 12 ("npm install-time security", GitHub changelog 2026-07-08) changes the install defaults: a dependency's install scripts do
// not run (`allow-scripts` is empty) and git, remote and tarball-URL dependencies are refused (`allow-git` and `allow-remote` are
// `none`). A package that needs either breaks for every user on npm 12, so the leg installs the six packed packages into a clean
// project with those defaults and fails when anything in the tree needs a script or a git or remote source.
import { writeFileSync } from 'node:fs';
import path from 'node:path';

/** The install-time defaults npm 12 ships; the leg asserts them before it installs, so a changed runner config cannot hide a break. */
export const NPM12_DEFAULTS = Object.freeze({ 'allow-git': 'none', 'allow-remote': 'none', 'dangerously-allow-all-scripts': 'false' });

/** The lifecycle scripts npm runs when it installs a package (a `binding.gyp` makes npm run `node-gyp rebuild` as `install`). */
export const INSTALL_SCRIPTS = Object.freeze(['preinstall', 'install', 'postinstall']);

/** A dependency spec that is a semver range or dist-tag (or an `npm:` alias) installs from the registry; every other form names a source. */
export function isRegistrySpec(spec) {
  if (typeof spec !== 'string') return false;
  if (spec.startsWith('npm:')) return true;
  return !/[:/]/u.test(spec);
}

const DEPENDENCY_SECTIONS = ['dependencies', 'optionalDependencies', 'peerDependencies'];

/** Problems of one package manifest (a packed `package.json`): install scripts, a gyp build, and dependencies from a git or remote source. */
export function manifestHazards(manifest, label = manifest?.name ?? 'package') {
  const problems = [];
  for (const script of INSTALL_SCRIPTS) if (manifest.scripts?.[script] !== undefined) problems.push(`${label} declares the ${script} script`);
  if (manifest.gypfile === true) problems.push(`${label} declares gypfile (npm builds it with node-gyp on install)`);
  for (const section of DEPENDENCY_SECTIONS) {
    for (const [name, spec] of Object.entries(manifest[section] ?? {})) {
      if (!isRegistrySpec(spec)) problems.push(`${label} ${section} ${name} is "${spec}", not a registry range`);
    }
  }
  return problems;
}

/**
 * Problems of an installed tree, read from its package-lock.json: a package npm records as having an install script
 * (`hasInstallScript`), a dependency range that is a git, URL or path source, and a package resolved anywhere but the registry.
 * `localTarballs` are the `file:` resolutions of the six packed packages, the only non-registry sources the consumer asks for.
 */
export function lockHazards(lock, { localTarballs = [], registry = 'https://registry.npmjs.org/' } = {}) {
  const problems = [];
  for (const [key, entry] of Object.entries(lock?.packages ?? {})) {
    if (key === '') continue;
    const label = key.replace(/^.*node_modules\//u, '') + (entry.version ? `@${entry.version}` : '');
    if (entry.hasInstallScript) problems.push(`${label} has an install script (npm 12 skips it)`);
    if (entry.link) continue;
    const resolved = entry.resolved;
    if (typeof resolved === 'string' && !resolved.startsWith(registry) && !localTarballs.includes(resolved)) problems.push(`${label} is resolved from ${resolved}, not the registry`);
    for (const section of ['dependencies', 'optionalDependencies']) {
      for (const [name, spec] of Object.entries(entry[section] ?? {})) {
        if (!isRegistrySpec(spec)) problems.push(`${label} ${section} ${name} is "${spec}", not a registry range`);
      }
    }
  }
  return problems;
}

/**
 * The environment of the npm 12 install: the parent's, without any `npm_*` variable (pnpm sets several for a script it runs, and a
 * runner may set more), with the user and global npmrc replaced by an empty file so no configuration but npm 12's own defaults
 * applies. Only the cache location and the update notifier differ from a fresh machine.
 */
export function cleanNpmEnvironment(parent, { directory, cache }) {
  // Two files: npm refuses to load one file as both the user and the global config.
  const [user, global] = ['user.npmrc', 'global.npmrc'].map((name) => path.join(directory, name));
  for (const file of [user, global]) writeFileSync(file, '');
  const env = Object.fromEntries(Object.entries(parent).filter(([name]) => !/^npm_/iu.test(name)));
  return { ...env, npm_config_userconfig: user, npm_config_globalconfig: global, npm_config_cache: cache, npm_config_update_notifier: 'false' };
}
