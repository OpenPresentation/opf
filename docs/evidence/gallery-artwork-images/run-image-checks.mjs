import {spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync,readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {packageManagerInvocation} from './opf/scripts/package-manager.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)),repo=process.argv[2],major=process.versions.node.split('.')[0];
const output=path.join(root,'image-artwork-final-checks');mkdirSync(output,{recursive:true});
const commands={
 opf:[['pnpm','--filter','@openpresentation/opf','test'],['pnpm','typecheck'],['pnpm','lint'],['pnpm','check:examples']],
 'opf-pptx':[['npm','run','typecheck'],['npm','run','validate'],['npm','test'],['npm','run','test:code'],['npm','run','test:metric'],['node','test/browser-check.mjs']],
 'opf-render':[['npm','run','typecheck'],['npm','run','validate'],['npm','test'],['node','test/fonts-browser.mjs'],['node','test/design-preview.mjs'],['npm','run','build:browser-check'],['npm','run','test:styled-table'],['npm','run','test:code'],['npm','run','test:metric']],
};
if(!commands[repo])throw Error('Invalid repository');
const results=[];
for(const [i,[name,...args]]of commands[repo].entries()){
 const invocation=name==='node'?{command:process.execPath,args}:packageManagerInvocation(name,args);
 const result=spawnSync(invocation.command,invocation.args,{cwd:path.join(root,repo),encoding:'utf8',maxBuffer:30*1024*1024,env:{...process.env,OPF_GOLDEN_OUT:path.join(output,`golden-node${major}`),OPF_GOLDEN_ARTIFACTS:'1'}});
 const log=`${repo}-node${major}-${i}.log`,bytes=(result.stdout??'')+(result.stderr??'');writeFileSync(path.join(output,log),bytes);
 results.push({node:process.version,repo,command:[name,...args],status:result.status,log,sha256:createHash('sha256').update(bytes).digest('hex'),...(result.error?{error:result.error.message}:{})});
 console.log(JSON.stringify(results.at(-1)));
}
const runtime={};
for(const [name,directory]of [['opf','opf/packages/javascript'],['opf-render','opf-render'],['opf-pptx','opf-pptx']]){
 for(const file of [...readdirSync(path.join(root,directory,'dist')).filter(file=>file.endsWith('.js')).map(file=>'dist/'+file),'package.json'])runtime[name+'/'+file]=createHash('sha256').update(readFileSync(path.join(root,directory,file))).digest('hex');
}
writeFileSync(path.join(output,`${repo}-node${major}-checks.json`),JSON.stringify({mode:'linked-source',runtime,results},null,2)+'\n');
process.exitCode=results.some(result=>result.status!==0)?1:0;
