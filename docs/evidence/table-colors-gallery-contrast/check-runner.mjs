import {spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {packageManagerInvocation} from './opf/scripts/package-manager.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)),repo=process.argv[2],major=process.versions.node.split('.')[0];
const output=path.join(root,'contrast-checks');mkdirSync(output,{recursive:true});
const commands={
 opf:[['pnpm','--filter','@openpresentation/opf','test'],['pnpm','typecheck'],['pnpm','lint'],['pnpm','check:examples']],
 'opf-pptx':[['npm','run','typecheck'],['npm','run','validate'],['npm','test'],['npm','run','test:code'],['npm','run','test:metric']],
 'opf-render':[['npm','run','typecheck'],['npm','run','validate'],['npm','test'],['node','test/fonts-browser.mjs'],['node','test/design-preview.mjs'],['npm','run','build:browser-check'],['npm','run','test:styled-table'],['npm','run','test:metric']],
};
if(!commands[repo])throw Error('Invalid repository');
const results=[];
for(const [i,[name,...args]]of commands[repo].entries()){
 const invocation=name==='node'?{command:process.execPath,args}:packageManagerInvocation(name,args);
 const result=spawnSync(invocation.command,invocation.args,{cwd:path.join(root,repo),encoding:'utf8',maxBuffer:30*1024*1024,env:{...process.env,OPF_GOLDEN_OUT:path.join(output,`golden-node${major}`)}});
 const log=`${repo}-node${major}-${i}.log`;writeFileSync(path.join(output,log),(result.stdout??'')+(result.stderr??''));
 results.push({node:process.version,repo,command:[name,...args],status:result.status,log,...(result.error?{error:result.error.message}:{})});
 console.log(JSON.stringify(results.at(-1)));
}
writeFileSync(path.join(output,`${repo}-node${major}-checks.json`),JSON.stringify({mode:'linked-source',results},null,2)+'\n');
process.exitCode=results.some(result=>result.status!==0)?1:0;
