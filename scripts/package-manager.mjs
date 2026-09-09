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
  if (!entry) throw new Error(`Cannot locate ${name}'s JavaScript entrypoint; install ${name} and include it in PATH.`);
  return {command:process.execPath,args:[entry,...args]};
}
