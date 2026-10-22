import {existsSync} from 'node:fs';
import path from 'node:path';

const entries={npm:['npm/bin/npm-cli.js'],pnpm:['pnpm/bin/pnpm.cjs','corepack/dist/pnpm.js'],corepack:['corepack/dist/corepack.js']};

// Windows cannot exec .cmd shims directly. Keep arguments literal and use the
// selected Node runtime to execute the installed package-manager entrypoint.
export function bootstrapInvocation(command,args,{platform=process.platform,env=process.env}={}) {
 if(platform!=='win32'||!Object.hasOwn(entries,command))return {command,args:[...args]};
 const pathKey=Object.keys(env).find(key=>key.toLowerCase()==='path');
 const directories=(env[pathKey]??'').split(';').filter(Boolean).map(value=>value.replace(/^"(.*)"$/,'$1'));
 const explicit=env.npm_execpath;
 const candidates=[
  ...(explicit&&entries[command].some(entry=>path.basename(entry)===path.basename(explicit))?[explicit]:[]),
  ...directories.flatMap(directory=>entries[command].flatMap(entry=>[
   path.resolve(directory,'node_modules',entry),
   path.resolve(directory,'..',entry),
  ])),
 ];
 const entry=candidates.find(existsSync);
 if(!entry)throw new Error(`Cannot locate ${command}'s JavaScript entrypoint; include its installation in PATH.`);
 return {command:process.execPath,args:[entry,...args]};
}
