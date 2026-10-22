// MR-56: a clean npm consumer of one published set of the packages. The pptx.gallery vendored editor
// (scripts/vendor-gallery-editor.mjs) is built from it: the libraries come from the registry (the set is
// registryPlan({ tag: 'X.Y.Z' }) of registry-plan.mjs), the editor example (packages/editor/examples) from this repository at a git ref
// (a release tag, `vX.Y.Z`, or HEAD).
//
// The six packages share one version (docs/programs/monorepo/README.md), so `--version X.Y.Z` names the set. `--pin <package>=<version>`
// overrides one package, only to build against a set that is published but not shared (0.25.x, where the editor had a patch of its own).
// The gallery package is not installed by name: core depends on it and npm installs it beside core.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { npmEnvironment, packageManagerInvocation } from './package-manager.mjs';
import { registryBindings } from './registry-toolchain.mjs';

/** The packages the consumer installs (the site's manifest lists these five), in manifest order. */
export const CONSUMER_PACKAGES = [
  '@openpresentation/opf',
  '@openpresentation/opf-render',
  '@openpresentation/opf-editor',
  '@openpresentation/opf-pptx',
  '@openpresentation/cli',
];
/** The esbuild the bundles are made with: the one the workspace's tsup resolves (check: registry-consumer.test.mjs reads pnpm-lock.yaml). */
export const ESBUILD_VERSION = '0.28.2';
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const SHA = /^[a-f0-9]{40}$/;

export const isVersion = (value) => VERSION.test(value ?? '');

const PINNABLE = [...CONSUMER_PACKAGES, '@openpresentation/gallery'];

/** `opf-editor=0.25.3` or `@openpresentation/opf-editor=0.25.3` to { '@openpresentation/opf-editor': '0.25.3' }; anything else throws. */
export function parsePins(pins = []) {
  const result = {};
  for (const pin of pins) {
    const [name, version, ...rest] = String(pin).split('=');
    const full = name?.startsWith('@') ? name : `@openpresentation/${name}`;
    if (rest.length || !PINNABLE.includes(full) || !isVersion(version)) {
      throw new Error(`--pin needs <package>=<X.Y.Z> with one of ${PINNABLE.map((item) => item.replace('@openpresentation/', '')).join(', ')}, not '${pin}'`);
    }
    result[full] = version;
  }
  return result;
}

/** `{ name: version }` as the `name@version,...` string registryPlan() takes as overrides. */
export const pinOverrides = (pins = {}) => Object.entries(pins).map(([name, version]) => `${name}@${version}`).join(',');

/** The exact { name, version } of each consumer package of a registryPlan() set, in manifest order; throws when one is missing. */
export function consumerPackages(plan) {
  return CONSUMER_PACKAGES.map((name) => {
    const found = plan.packages.find((item) => item.name === name);
    if (!found) throw new Error(`the published set has no ${name}`);
    return { name, version: found.version };
  });
}

/**
 * opf-render's converters, font packages and script packs are optional peers that npm does not install; a complete host installs
 * them at the versions the renderer tests (its devDependencies, else the peer range). A renderer that lists them as dependencies adds nothing.
 */
export function rendererOptionalPeers(rendererPackage) {
  const peers = {};
  for (const [name, range] of Object.entries(rendererPackage.peerDependencies ?? {})) {
    if (rendererPackage.peerDependenciesMeta?.[name]?.optional === true && !rendererPackage.dependencies?.[name]) peers[name] = rendererPackage.devDependencies?.[name] ?? range;
  }
  return peers;
}

/** The consumer's package.json: the optional peers, the exact libraries and the bundler. */
export function consumerManifest({ packages, rendererPackage = {} }) {
  return {
    name: 'opf-gallery-editor-consumer',
    private: true,
    type: 'module',
    dependencies: {
      esbuild: ESBUILD_VERSION,
      ...rendererOptionalPeers(rendererPackage),
      ...Object.fromEntries(packages.map((item) => [item.name, item.version])),
    },
  };
}

function git(args, cwd, runGit = spawnSync) {
  const result = runGit('git', args, { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${String(result.stderr ?? '').trim()}`);
  return result.stdout;
}

/** The commit a ref (a tag `vX.Y.Z`, a branch, a SHA, HEAD) names, as 40 hex digits. */
export function resolveRef(ref, { cwd, runGit } = {}) {
  if (typeof ref !== 'string' || !ref.trim() || ref.startsWith('-')) throw new Error(`'${ref}' is not a git ref`);
  const sha = git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], cwd, runGit).trim();
  if (!SHA.test(sha)) throw new Error(`'${ref}' does not name a commit in ${cwd}`);
  return sha;
}

/** The text of `file` (a path from the repository root) at `sha`. */
export function fileAtRef(sha, file, { cwd, runGit } = {}) {
  return git(['show', `${sha}:${file}`], cwd, runGit);
}

/** Does the file exist at the commit? (an old example may lack an optional file) */
export function existsAtRef(sha, file, { cwd, runGit = spawnSync } = {}) {
  return runGit('git', ['cat-file', '-e', `${sha}:${file}`], { cwd, encoding: 'utf8' }).status === 0;
}

/** The published package.json of `name@version`, from the registry (`npm view`): what the optional peers of a renderer are is read from the artifact itself. */
export function registryManifest(name, version, { run = spawnSync } = {}) {
  const invocation = packageManagerInvocation('npm', ['view', `${name}@${version}`, '--json']);
  const result = run(invocation.command, invocation.args, { encoding: 'utf8', env: npmEnvironment(), maxBuffer: 64 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${name}@${version} is not on the registry: ${String(result.stderr ?? '').trim().split('\n')[0]}`);
  const manifest = JSON.parse(result.stdout);
  if (manifest?.name !== name || manifest.version !== version) throw new Error(`npm view ${name}@${version} answered ${manifest?.name}@${manifest?.version}`);
  return manifest;
}

function npm(args, cwd) {
  const invocation = packageManagerInvocation('npm', args);
  const result = spawnSync(invocation.command, invocation.args, { cwd, stdio: 'inherit', env: npmEnvironment() });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`npm ${args.join(' ')} exited ${result.status}`);
}

/**
 * What a clean registry install of `manifest` must look like, from the consumer's package-lock.json: each exact dependency installed
 * once, from registry.npmjs.org with an integrity hash, not a link. Returns { name, version, tarball, integrity } per consumer package,
 * and throws on anything else.
 */
export async function verifiedPackages(consumer, expected) {
  const lock = JSON.parse(await readFile(path.join(consumer, 'package-lock.json'), 'utf8'));
  const modules = await realpath(path.join(consumer, 'node_modules'));
  const packages = [];
  for (const { name, version } of expected) {
    const directory = await realpath(path.join(modules, name));
    const installed = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
    const record = lock.packages?.[`node_modules/${name}`];
    if (!directory.startsWith(modules + path.sep) || installed.version !== version || record?.version !== version
      || !record?.resolved?.startsWith('https://registry.npmjs.org/') || !record?.integrity?.startsWith('sha512-') || record.link) {
      throw new Error(`Expected a clean registry installation of ${name}@${version} in ${consumer}`);
    }
    packages.push({ name, version, tarball: record.resolved, integrity: record.integrity });
  }
  return packages;
}

/**
 * Install (or keep) the consumer of one published set in `directory`: the same package.json and a verified lockfile mean the
 * install is reused, anything else is removed and installed again. Needs only npm and the network.
 */
export async function installConsumer({ directory, packages, rendererPackage = {}, cache = path.join(directory, '..', 'cache') }) {
  const manifest = consumerManifest({ packages, rendererPackage });
  const text = `${JSON.stringify(manifest, null, 2)}\n`;
  const expected = packages;
  if (existsSync(path.join(directory, 'node_modules')) && existsSync(path.join(directory, 'package.json')) && (await readFile(path.join(directory, 'package.json'), 'utf8')) === text) {
    try {
      return { directory, packages: await verifiedPackages(directory, expected) };
    } catch {
      // a partial or modified install: install it again
    }
  }
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'package.json'), text);
  npm(['install', '--ignore-scripts', '--no-audit', '--no-fund', '--offline=false', '--prefer-online', '--cache', cache], directory);
  return { directory, packages: await verifiedPackages(directory, expected) };
}

/** The pins (exact dependencies on @openpresentation packages) of an installed consumer, as the toolchain's expected versions. */
export async function installedExpectation(consumer) {
  const manifest = JSON.parse(await readFile(path.join(consumer, 'package.json'), 'utf8'));
  return CONSUMER_PACKAGES.filter((name) => manifest.dependencies?.[name]).map((name) => ({ name, version: manifest.dependencies[name] }));
}

/**
 * The toolchain of vendor-gallery-editor.mjs and build-gallery-snapshot.mjs over an installed consumer: what
 * registryToolchain() (registry-toolchain.mjs) returns, minus the release plan's refs. `esbuild` is the consumer's own bundler.
 */
export async function consumerToolchain(consumer) {
  const directory = await realpath(consumer);
  const packages = await verifiedPackages(directory, await installedExpectation(directory));
  const modules = await realpath(path.join(directory, 'node_modules'));
  const resolver = path.join(directory, 'asset-resolver.mjs');
  await writeFile(resolver, 'export const resolve = specifier => import.meta.resolve(specifier);\n');
  const { resolve } = await import(pathToFileURL(resolver).href);
  const esbuild = createRequire(path.join(directory, 'package.json'))('esbuild');
  return { consumer: directory, packages, esbuild, ...registryBindings(modules, resolve) };
}
