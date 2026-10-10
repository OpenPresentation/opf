import {existsSync} from 'node:fs';
import path from 'node:path';

const ENTRYPOINTS = {npm: ['npm', 'npm-cli.js'], npx: ['npm', 'npx-cli.js'], pnpm: ['pnpm', 'pnpm.cjs']};

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
  if (platform !== 'win32') return {command:file, args, options:{}};
  const base = path.win32.basename(file).toLowerCase().replace(/\.(cmd|bat|exe)$/, '');
  const bare = !/[\\/]/.test(file);
  const manager = Object.hasOwn(ENTRYPOINTS, base);
  if (manager && (bare || /\.cmd$/i.test(file))) {
    try {
      const invocation = packageManagerInvocation(base, args, {platform, env});
      return {command:invocation.command, args:invocation.args, options:{}};
    } catch {
      // fall through to cmd.exe below
    }
  }
  if (/\.(cmd|bat)$/i.test(file) || (bare && manager)) {
    return {command:env.ComSpec ?? env.COMSPEC ?? 'cmd.exe', args:['/d', '/s', '/c', `"${[file, ...args].map(quoteForCmd).join(' ')}"`], options:{windowsVerbatimArguments:true}};
  }
  return {command:file, args, options:{}};
}
