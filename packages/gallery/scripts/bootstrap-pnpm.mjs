import {execFileSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
// Only bootstrap children receive temporary signed Corepack shims.
export function bootstrapPnpmEnvironment(temporary, env=process.env) {
 const bin=path.join(temporary,'bin');mkdirSync(bin,{recursive:true});
 execFileSync('corepack',['enable','--install-directory',bin,'pnpm'],{env,stdio:['ignore','pipe','inherit']});
 const key=Object.keys(env).find(key=>key.toLowerCase()==='path')??'PATH';
 return {...env,[key]:bin+path.delimiter+(env[key]??'')};
}
