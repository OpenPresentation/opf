import {existsSync} from 'node:fs';
import path from 'node:path';

const ENTRYPOINTS = {npm: ['npm', 'npm-cli.js'], npx: ['npm', 'npx-cli.js'], pnpm: ['pnpm', 'pnpm.cjs']};

// `pnpm run` exports its own settings to every child as `npm_config_*` variables (workspace settings such as `overrides` and
// `recursive`, `verify-deps-before-run`, ...). npm reads them as config it does not know and prints one "Unknown env config"
// warning per variable. These are the variables pnpm sets that npm has no setting for; npm's own (`registry`, `cache`,
// `globalconfig`, `user_agent`, scoped registries and auth) and any variable a person set are left alone.
const PNPM_ONLY_NPM_CONFIG = new Set([
  'recursive', 'overrides', 'verify_deps_before_run', 'manage_package_manager_versions', 'link_workspace_packages',
  'auto_install_peers', 'frozen_lockfile', 'npm_globalconfig', '_jsr_registry', 'workspace_concurrency', 'shared_workspace_lockfile',
  'ignored_built_dependencies', 'only_built_dependencies', 'node_linker', 'hoist', 'hoist_pattern', 'public_hoist_pattern',
  'package_import_method', 'fail_if_no_match', 'filter', 'filter_prod', 'workspace_root', 'prefer_workspace_packages', 'save_workspace_protocol', 'dedupe_peer_dependents',
]);

/** `env` without the `npm_config_*` variables only pnpm understands, for a child that runs npm or npx. */
export function npmEnvironment(env = process.env) {
  return Object.fromEntries(Object.entries(env).filter(([name]) => !(/^npm_config_/i.test(name) && PNPM_ONLY_NPM_CONFIG.has(name.slice('npm_config_'.length).toLowerCase()))));
}

/** Execute package-manager JavaScript with the selected Node runtime on Windows.
 * Never pass package arguments or paths through cmd.exe or a shell.
 */
export function packageManagerInvocation(name, args, {platform=process.platform, env=process.env}={}) {
  if (!Object.hasOwn(ENTRYPOINTS, name)) throw new Error(`Unsupported package manager: ${name}`);
  if (platform !== 'win32') return {command:name,args:[...args]};
  const [directoryName, bin] = ENTRYPOINTS[name];
  const explicit = env.npm_execpath;
  const directories = (env.PATH ?? env.Path ?? '').split(';').filter(Boolean).map(value=>value.replace(/^"(.*)"$/,'$1'));
  const candidates = [
    ...(explicit && path.basename(explicit) === bin ? [explicit] : []),
    // `npm run` and `pnpm run` set npm_execpath to their own entrypoint; npx lives next to npm's.
    ...(explicit && name === 'npx' && path.basename(explicit) === 'npm-cli.js' ? [path.join(path.dirname(explicit), bin)] : []),
    ...directories.flatMap(directory=>[
      path.resolve(directory,'node_modules',directoryName,'bin',bin),
      path.resolve(directory,'..',directoryName,'bin',bin),
    ]),
  ];
  const entry=candidates.find(existsSync);
  if (!entry) throw new Error(`Cannot locate ${name}'s JavaScript entrypoint; install ${name} and include it in PATH.`);
  return {command:process.execPath,args:[entry,...args]};
}

/** Quote one argument for a cmd.exe command line. */
export function quoteForCmd(argument) {
  return /[\s"&|<>^()%!]/.test(argument) || argument === '' ? `"${argument.replaceAll('"', '\\"')}"` : argument;
}

/**
 * The `[command, args, options]` to hand to child_process.spawn (or spawnSync) for `argv`, with no shell, so that an
 * executable or an argument with a space in it ("C:\Program Files\nodejs\node.exe", a checkout under a folder with a
 * space) reaches the program intact. On Windows `pnpm`, `npm` and `npx` (also as `.cmd`) are run as their JavaScript
 * entrypoint with the current Node (node refuses to start a .cmd file without a shell, and a shell would split the
 * path at the space); any other .cmd or .bat file, or a package manager whose entrypoint cannot be found, goes through
 * cmd.exe with every argument quoted. Everywhere else the command is spawned as is.
 */
export function spawnSpec(argv, {platform=process.platform, env=process.env}={}) {
  const [file, ...args] = argv;
  const base = path.win32.basename(file).toLowerCase().replace(/\.(cmd|bat|exe)$/, '');
  // A child that runs npm gets an environment without the npm_config_* variables only pnpm understands.
  const own = base === 'npm' || base === 'npx' ? {env:npmEnvironment(env)} : {};
  if (platform !== 'win32') return {command:file, args, options:{...own}};
  const bare = !/[\\/]/.test(file);
  const manager = Object.hasOwn(ENTRYPOINTS, base);
  if (manager && (bare || /\.cmd$/i.test(file))) {
    try {
      const invocation = packageManagerInvocation(base, args, {platform, env});
      return {command:invocation.command, args:invocation.args, options:{...own}};
    } catch {
      // fall through to cmd.exe below
    }
  }
  if (/\.(cmd|bat)$/i.test(file) || (bare && manager)) {
    return {command:env.ComSpec ?? env.COMSPEC ?? 'cmd.exe', args:['/d', '/s', '/c', `"${[file, ...args].map(quoteForCmd).join(' ')}"`], options:{windowsVerbatimArguments:true, ...own}};
  }
  return {command:file, args, options:{}};
}
