// RR-101: files of a published package that its repository does not keep current are bound to the release commit by a
// reproducible build instead of a committed copy.
//
// opf-editor tracks `dist/` in git, but nothing makes a source change refresh it (0.25.1's gitHead carries a `dist/` that lacks
// `replaceDocument` while the published tarball, built at prepack, has it). Comparing the installed bytes with the committed
// `dist/` therefore fails a correct release. The registry lane proves the stronger fact: the published `dist/` is exactly what
// the editor's own lockfile and build script produce from the gitHead's sources. Every other file is still compared with the
// commit, byte for byte.
//
// rebuiltTree() exports the commit with `git archive`, removes the committed output directories, runs the repository's own
// `npm ci --ignore-scripts` and build, and caches the result per gitHead (a marker file proves a finished build).
//
// MR-34: the editor lives in packages/editor of this repository. A release the archived opf-editor repository built is in this
// repository's history as an import whose package directory still has its own package-lock.json: `directory` archives just that
// directory and the npm build above runs in it. A release of the shared line has the pnpm workspace: the whole commit is
// archived and `workspace` (install the frozen lockfile, build the package and what it depends on) runs at its root.
import {execFileSync, spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync} from 'node:fs';
import {mkdir, readFile, rename, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {packageManagerInvocation} from './package-manager.mjs';
import {tar} from './archive-tar.mjs';

/** Packages whose build output is rebuilt from the gitHead: files under `prefix` are compared with the rebuild. */
export const REBUILT = {
  'opf-editor': {
    prefix: 'dist/',
    install: ['npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund']],
    build: ['node', ['scripts/build.mjs']],
    workspace: {install: ['pnpm', ['install', '--frozen-lockfile', '--ignore-scripts']], build: ['pnpm', ['--filter', '@openpresentation/opf-editor...', '--fail-if-no-match', 'run', 'build']]},
  },
};

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const run = (command, args, cwd, label) => {
  const invocation = command === 'node' ? {command: process.execPath, args} : packageManagerInvocation(command, args);
  const result = spawnSync(invocation.command, invocation.args, {cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: {...process.env, npm_config_update_notifier: 'false'}});
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${label} failed (exit ${result.status}) in ${cwd}\n${result.stderr}${result.stdout}`);
};

/** True when the package rebuilds this file (it is under the package's build output directory). */
export const isRebuilt = (repo, file) => Boolean(REBUILT[repo] && file.startsWith(REBUILT[repo].prefix));

/**
 * The package root holding the build of `repo` at `ref`, built once per ref under `cacheRoot`.
 * `checkout` is the repository's git checkout; `config` defaults to REBUILT[repo]; `packageDirectory` is the package's directory
 * inside that checkout (see the header). The result is the package's root: the place its build output (`config.prefix`) is.
 */
export async function rebuiltTree({repo, checkout, ref, cacheRoot, config = REBUILT[repo], packageDirectory = ''}) {
  if (!config) throw new Error(`${repo} has no rebuilt output`);
  if (!/^[a-f0-9]{40}$/.test(ref ?? '')) throw new Error(`Missing immutable verification ref for ${repo}`);
  const directory = path.join(cacheRoot, `${repo}-${ref}`);
  const marker = path.join(directory, '.rebuilt');
  const hasFile = (file) => spawnSync('git', ['cat-file', '-e', `${ref}:${file}`], {cwd: checkout, stdio: 'ignore'}).status === 0;
  // A commit of the archived repository: its package directory alone, rebuilt as that repository built it. A commit of the
  // shared line: the whole workspace, so the package's dependencies are there to build.
  const workspace = Boolean(packageDirectory) && Boolean(config.workspace) && !hasFile(`${packageDirectory}/package-lock.json`) && hasFile('pnpm-workspace.yaml');
  const packageRootOf = (base) => (workspace ? path.join(base, ...packageDirectory.split('/')) : base);
  if (existsSync(marker) && (await readFile(marker, 'utf8')).trim() === ref) return packageRootOf(directory);
  await rm(directory, {recursive: true, force: true});
  const staging = `${directory}.partial-${process.pid}`;
  await rm(staging, {recursive: true, force: true});
  await mkdir(staging, {recursive: true});
  const archive = path.join(cacheRoot, `${repo}-${ref}.partial-${process.pid}.tar`);
  try {
    execFileSync('git', ['archive', '--format=tar', '-o', archive, packageDirectory && !workspace ? `${ref}:${packageDirectory}` : ref], {cwd: checkout});
    tar(archive, '-xf', ['-C', staging]);
    // The committed build output is what is not trusted: remove it so only the rebuild can supply those files.
    await rm(path.join(packageRootOf(staging), config.prefix), {recursive: true, force: true});
    const steps = workspace ? config.workspace : config;
    const label = (step) => `${repo}@${ref.slice(0, 12)}: ${step[0]} ${step[1].join(' ')}`;
    run(steps.install[0], steps.install[1], staging, label(steps.install));
    run(steps.build[0], steps.build[1], staging, label(steps.build));
    await writeFile(path.join(staging, '.rebuilt'), `${ref}\n`);
    await rename(staging, directory);
  } catch (error) {
    await rm(staging, {recursive: true, force: true});
    throw error;
  } finally {
    await rm(archive, {force: true});
  }
  return packageRootOf(directory);
}

/**
 * The bytes a published file must equal: the rebuild for build output, the commit's own file for everything else.
 * Throws a message naming the repo, ref and file when the rebuild does not contain the file.
 */
export async function rebuiltBytes({repo, checkout, ref, file, cacheRoot, config, packageDirectory}) {
  const directory = await rebuiltTree({repo, checkout, ref, cacheRoot, config, packageDirectory});
  const target = path.join(directory, ...file.split('/'));
  if (!existsSync(target)) throw new Error(`Published ${repo} file ${file} is not produced by rebuilding ${repo}@${ref}`);
  return readFile(target);
}

/** Assert that an installed file equals the rebuild, with a message that says what was compared. */
export async function assertReproducible(args) {
  const expected = await rebuiltBytes(args);
  const actual = args.installed;
  if (sha256(actual) !== sha256(expected)) {
    throw new Error(`Published ${args.repo} file ${args.file} is not a reproducible build of ${args.repo}@${args.ref} (installed sha256 ${sha256(actual)}, rebuilt sha256 ${sha256(expected)})`);
  }
  return sha256(actual);
}
