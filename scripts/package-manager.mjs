import {existsSync} from 'node:fs';
import path from 'node:path';

/** Execute package-manager JavaScript with the selected Node runtime on Windows.
 * Never pass package arguments or paths through cmd.exe or a shell.
 */
export function packageManagerInvocation(name, args, {platform=process.platform, env=process.env}={}) {
  if (name !== 'npm' && name !== 'pnpm') throw new Error(`Unsupported package manager: ${name}`);
  if (platform !== 'win32') return {command:name,args:[...args]};
  const bin = name === 'npm' ? 'npm-cli.js' : 'pnpm.cjs';
  const explicit = env.npm_execpath;
  const directories = (env.PATH ?? env.Path ?? '').split(';').filter(Boolean).map(value=>value.replace(/^"(.*)"$/,'$1'));
  const candidates = [
    ...(explicit && path.basename(explicit) === bin ? [explicit] : []),
    ...directories.flatMap(directory=>[
      path.resolve(directory,'node_modules',name,'bin',bin),
      path.resolve(directory,'..',name,'bin',bin),
    ]),
  ];
  const entry=candidates.find(existsSync);
  if (entry) return {command:process.execPath,args:[entry,...args]};
  // RR-57: CI installs the standalone pnpm release, a single pnpm.exe with no JavaScript entrypoint. Spawn it directly
  // (still no shell, so arguments stay literal), the way node is spawned.
  if (name === 'pnpm') {
    const executable = [
      ...(explicit && path.basename(explicit).toLowerCase() === 'pnpm.exe' ? [explicit] : []),
      ...directories.map(directory=>path.resolve(directory,'pnpm.exe')),
    ].find(existsSync);
    if (executable) return {command:executable,args:[...args]};
  }
  throw new Error(`Cannot locate ${name}'s JavaScript entrypoint; install ${name} and include it in PATH.`);
}
