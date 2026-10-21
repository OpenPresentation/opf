#!/usr/bin/env node
// MR-16: a cheap checkout for one agent task. The repository is large (the evidence archives under docs/evidence are
// about 70 percent of the tracked tree and no agent task reads them), and every agent works in its own checkout on its own
// branch from a fresh origin/main. This script makes that checkout small and fast:
//   - a blobless clone (`--filter=blob:none`): history without file contents, contents fetched when checked out;
//   - a sparse profile that leaves docs/evidence/** and packages/*/docs/evidence/** out of the working tree (they stay in
//     the index and in `git log`; `git sparse-checkout disable` brings them back);
//   - one pnpm store per directory of worktrees (default: <parent of the checkout>/.pnpm-store, so it is on the same volume
//     and installs hard-link instead of copy; OPF_PNPM_STORE or --store-dir override it).
//
//   node scripts/agent-worktree.mjs add <task> [options]
//     --branch <name>     the new branch (default codex/<task>)
//     --path <dir>        the checkout directory (default <parent>/<task>; <parent> is OPF_WORKTREE_DIR, else ~/opf-work,
//                         else C:\opf-work on Windows)
//     --base <ref>        what the branch starts from (default origin/main; origin/* is fetched first)
//     --clone             make a new blobless clone instead of a worktree of the repository you are in (the default when
//                         you are not inside a clone of this repository)
//     --url <url>         what to clone (default OPF_REPO_URL, else https://github.com/OpenPresentation/opf.git)
//     --full              no sparse profile: the whole tree, evidence included
//     --store-dir <dir>   the shared pnpm store (default as above)
//     --no-install        do not run `pnpm install --frozen-lockfile`
//     --offline           do not fetch (a worktree of the clone you are in; the base must already exist)
//     --dry-run           print the commands and run nothing
//   node scripts/agent-worktree.mjs remove <task|path> [--delete-branch] [--force]
//     removes a checkout made by `add`; a worktree with uncommitted changes, or a clone with uncommitted or unpushed
//     work, is kept unless --force. Run it once the branch is merged or abandoned.
//
// Windows: keep checkouts under a short path such as C:\opf-work\<task> (esbuild and Biome exceed MAX_PATH deeper); `add`
// refuses a longer one unless --allow-long-path. Plain Node, no dependencies.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSpec } from './package-manager.mjs';

export const DEFAULT_URL = 'https://github.com/OpenPresentation/opf.git';
export const DEFAULT_BASE = 'origin/main';
export const WINDOWS_PATH_LIMIT = 60;
// Gitignore-style patterns for `git sparse-checkout set --no-cone`: everything except the evidence archives.
export const SPARSE_PATTERNS = ['/*', '!/docs/evidence/', '!/packages/*/docs/evidence/'];
const TASK = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const VALUE_FLAGS = new Set(['--branch', '--path', '--base', '--store-dir', '--url']);
const BOOLEAN_FLAGS = new Set(['--clone', '--full', '--no-install', '--offline', '--dry-run', '--allow-long-path', '--delete-branch', '--force']);

export function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = { command };
  const positional = [];
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    const key = arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    if (VALUE_FLAGS.has(arg)) {
      if (!rest[index + 1] || rest[index + 1].startsWith('--')) throw new Error(`${arg} needs a value`);
      index += 1;
      options[key] = rest[index];
    } else if (BOOLEAN_FLAGS.has(arg)) {
      options[key] = true;
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown option ${arg}`);
    } else positional.push(arg);
  }
  if (positional.length !== 1) throw new Error(`Usage: agent-worktree.mjs ${command === 'remove' ? 'remove <task|path>' : 'add <task>'} [options] (see the header of scripts/agent-worktree.mjs)`);
  options.target = positional[0];
  return options;
}

/** The directory that holds every checkout (and the shared store). */
export function worktreeParent(env = process.env, platform = process.platform, home = homedir()) {
  if (env.OPF_WORKTREE_DIR) return path.resolve(env.OPF_WORKTREE_DIR);
  return platform === 'win32' ? 'C:\\opf-work' : path.join(home, 'opf-work');
}

/** A reason this path is too long for a Windows checkout, or null. */
export function windowsPathProblem(directory, platform = process.platform) {
  if (platform !== 'win32' || directory.length <= WINDOWS_PATH_LIMIT) return null;
  return `${directory} is ${directory.length} characters; esbuild and Biome exceed MAX_PATH below a long path on Windows. Use a short one such as C:\\opf-work\\<task> (--path), or pass --allow-long-path.`;
}

/** The pnpm store for a checkout: the flag, OPF_PNPM_STORE, then <parent of the checkout>/.pnpm-store (same volume). */
export function storeDirFor(directory, options = {}, env = process.env) {
  if (options.storeDir) return path.resolve(options.storeDir);
  if (env.OPF_PNPM_STORE) return path.resolve(env.OPF_PNPM_STORE);
  return path.join(path.dirname(directory), '.pnpm-store');
}

/**
 * The git commands that make the checkout, in order: [{ args, cwd? }] (cwd is the checkout unless it is the repository
 * for a worktree). Pure, so the plan can be read with --dry-run and tested without running git.
 */
export function planAdd({ mode, repo, url = DEFAULT_URL, directory, branch, base = DEFAULT_BASE, sparse = true, fetch = true }) {
  const steps = [];
  const sparseSet = { args: ['sparse-checkout', 'set', '--no-cone', ...SPARSE_PATTERNS], cwd: directory };
  if (mode === 'clone') {
    steps.push({ args: ['clone', '--filter=blob:none', '--no-checkout', url, directory], cwd: null });
    if (sparse) steps.push(sparseSet);
    steps.push({ args: ['checkout', '--no-track', '-b', branch, base], cwd: directory });
    return steps;
  }
  const remote = /^([^/]+)\/(.+)$/.exec(base);
  if (fetch && remote) steps.push({ args: ['fetch', remote[1], remote[2]], cwd: repo });
  steps.push({ args: ['worktree', 'add', '--no-checkout', '--no-track', '-b', branch, directory, base], cwd: repo });
  if (sparse) steps.push(sparseSet);
  // `worktree add --no-checkout` leaves an empty index; the hard reset fills the working tree with the sparse set only.
  steps.push({ args: ['reset', '--hard', '--quiet', 'HEAD'], cwd: directory });
  return steps;
}

const git = (args, cwd, options = {}) => execFileSync('git', args, { cwd: cwd ?? undefined, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], ...options });

function insideRepository(cwd) {
  try {
    return git(['rev-parse', '--show-toplevel'], cwd, { stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

// True when `root` looks like a clone of this repository (it has this script and the pnpm workspace file).
const isOpfClone = (root) => Boolean(root) && existsSync(path.join(root, 'scripts', 'agent-worktree.mjs')) && existsSync(path.join(root, 'pnpm-workspace.yaml'));

function run(step, dryRun, log) {
  const cwd = step.cwd === null ? undefined : step.cwd;
  log(`git ${step.args.map((arg) => (/[\s*!]/.test(arg) ? `'${arg}'` : arg)).join(' ')}${cwd ? `   (in ${cwd})` : ''}`);
  if (!dryRun) git(step.args, cwd, { stdio: ['ignore', 'inherit', 'inherit'] });
}

export function add(options, { env = process.env, platform = process.platform, cwd = process.cwd(), log = console.log } = {}) {
  const started = Date.now();
  const task = options.target;
  if (!TASK.test(task)) throw new Error(`"${task}" is not a task name (letters, digits, dot, dash, underscore; for example ff-07-script-slots)`);
  const branch = options.branch ?? `codex/${task}`;
  git(['check-ref-format', '--branch', branch], undefined);
  const directory = path.resolve(options.path ?? path.join(worktreeParent(env, platform), task));
  const problem = options.allowLongPath ? null : windowsPathProblem(directory, platform);
  if (problem) throw new Error(problem);
  if (existsSync(directory) && readdirSync(directory).length) throw new Error(`${directory} already exists and is not empty`);
  const root = insideRepository(cwd);
  const mode = options.clone || !isOpfClone(root) ? 'clone' : 'worktree';
  const base = options.base ?? DEFAULT_BASE;
  const steps = planAdd({ mode, repo: root, url: options.url ?? env.OPF_REPO_URL ?? DEFAULT_URL, directory, branch, base, sparse: !options.full, fetch: !options.offline });
  log(`${mode === 'clone' ? 'blobless clone' : `worktree of ${root}`} -> ${directory} (branch ${branch} from ${base}${options.full ? ', full tree' : ', sparse: no docs/evidence'})`);
  for (const step of steps) run(step, options.dryRun, log);
  const store = storeDirFor(directory, options, env);
  if (!options.noInstall) {
    log(`pnpm install --frozen-lockfile   (store ${store})`);
    if (!options.dryRun) {
      const { command, args, options: spawnOptions } = spawnSpec(['pnpm', 'install', '--frozen-lockfile']);
      const result = spawnSync(command, args, { cwd: directory, stdio: 'inherit', env: { ...env, npm_config_store_dir: store }, ...spawnOptions });
      if (result.status !== 0) throw new Error(`pnpm install failed in ${directory} (exit ${result.status ?? result.signal}); the checkout is made, fix the install there`);
    }
  }
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  log('');
  log(`ready in ${seconds} s: ${directory}`);
  log(`branch ${branch}; keep using the shared store in this checkout:`);
  log(platform === 'win32' ? `  PowerShell: $env:npm_config_store_dir = '${store}'` : `  export npm_config_store_dir='${store}'`);
  if (!options.full) log('docs/evidence is not checked out here; `git sparse-checkout disable` brings it back.');
  return { directory, branch, mode, store, steps };
}

/** Removes a checkout made by `add`. A worktree is removed by git (which refuses uncommitted changes); a clone is deleted only when clean and pushed. */
export function remove(options, { env = process.env, platform = process.platform, log = console.log } = {}) {
  const target = options.target;
  const directory = path.resolve(target.includes('/') || target.includes('\\') ? target : path.join(worktreeParent(env, platform), target));
  if (!existsSync(directory)) throw new Error(`${directory} does not exist`);
  const dotGit = path.join(directory, '.git');
  if (!existsSync(dotGit)) throw new Error(`${directory} is not a git checkout`);
  const isWorktree = statSync(dotGit).isFile();
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], directory).trim();
  if (isWorktree) {
    const common = path.resolve(directory, git(['rev-parse', '--git-common-dir'], directory).trim());
    const repo = path.dirname(common);
    // The branch is deletable when some remote branch contains it (merged or pushed); otherwise only with --force.
    const deletable = options.deleteBranch && branch !== 'HEAD';
    if (deletable && !options.force && !git(['branch', '-r', '--contains', branch], repo).trim()) {
      throw new Error(`branch ${branch} is on no remote branch, so deleting it could lose commits; push it, or pass --force`);
    }
    const args = ['worktree', 'remove', ...(options.force ? ['--force'] : []), directory];
    log(`git ${args.join(' ')}`);
    git(args, repo, { stdio: ['ignore', 'inherit', 'inherit'] });
    git(['worktree', 'prune'], repo);
    if (deletable) git(['branch', '-D', branch], repo);
  } else {
    if (!options.force) {
      if (git(['status', '--porcelain'], directory).trim()) throw new Error(`${directory} has uncommitted changes; commit or discard them, or pass --force`);
      if (!git(['branch', '-r', '--contains', 'HEAD'], directory).trim()) throw new Error(`${directory} has commits that are on no remote branch; push them, or pass --force`);
    }
    log(`delete ${directory}`);
    rmSync(directory, { recursive: true, force: true });
  }
  log(`removed ${directory}${isWorktree && options.deleteBranch ? ` and branch ${branch}` : ''}`);
  return { directory, isWorktree };
}

function main(argv) {
  const options = parseArgs(argv);
  if (options.command === 'add') add(options);
  else if (options.command === 'remove') remove(options);
  else throw new Error('Usage: agent-worktree.mjs add <task> [options] | remove <task|path> [--delete-branch] [--force]');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
