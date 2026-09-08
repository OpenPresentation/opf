// Run pinned source tests against actual installed registry distributables.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile,symlink,rm,realpath} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
const root=process.cwd();
const plan=JSON.parse(await readFile(path.join(root,'release-plan.json'),'utf8'));
const consumer=path.resolve(process.argv[2]??'artifacts/npm/registry-consumer');
const require=createRequire(path.join(consumer,'package.json'));
const lock=JSON.parse(await readFile(path.join(consumer,'package-lock.json'),'utf8'));
const modules=await realpath(path.join(consumer,'node_modules'));
for(const item of plan.packages){
 const manifest=JSON.parse(await readFile(require.resolve(item.name+'/package.json'),'utf8'));
 assert.equal(manifest.version,item.version,item.name);
 const directory=await realpath(path.dirname(require.resolve(item.name+'/package.json')));
 const record=lock.packages['node_modules/'+item.name];
 assert.ok(directory.startsWith(modules+path.sep)&&record?.version===item.version&&!record.link&&record.resolved?.startsWith('https://registry.npmjs.org/')&&record.integrity?.startsWith('sha512-'),'Expected registry installation: '+item.name);
}
const results=[];
for(const [repo,tests] of [['opf-render',['webp.mjs','jpeg-orientation.mjs','golden.mjs']],['opf-pptx',['dependency-boundary.mjs']]]){
 const ref=plan.verificationRefs[repo];assert.match(ref,/^[a-f0-9]{40}$/);
 const directory=path.join(consumer,'fidelity',repo);await mkdir(directory,{recursive:true});
 const archive=path.join(directory,'tests.tar');
 execFileSync('git',['archive',ref,'test','--output',archive],{cwd:path.resolve(root,'..',repo)});
 execFileSync('tar',['-xf',archive,'-C',directory]);
 const installed=path.dirname(require.resolve('@openpresentation/'+repo+'/package.json'));
 await symlink(path.join(installed,'dist'),path.join(directory,'dist'),'dir').catch(e=>{if(e.code!=='EEXIST')throw e});
 assert.equal(await realpath(path.join(directory,'dist')),await realpath(path.join(installed,'dist')),'Test must execute the installed dist files');
 for(const test of tests){
  const env={...process.env};
  for(const key of ['OPF_TEST_RASTER_MODULE','OPF_TEST_PPTX_MODULE','OPF_GOLDEN_BASELINE','OPF_EXAMPLES_DIR','OPF_GOLDEN_OUT','OPF_GOLDEN_SCALE']) delete env[key];
  const output=execFileSync(process.execPath,[path.join(directory,'test',test)],{cwd:consumer,env,encoding:'utf8',maxBuffer:8*1024*1024});
  await writeFile(path.join(directory,test+'.log'),output);console.log(output.trim());results.push({repo,ref,test,passed:true});
 }
 await rm(archive);
}
await writeFile(path.join(consumer,'fidelity','report.json'),JSON.stringify({scope:'Pinned tests and fixtures, installed registry dist files; no source package overrides',packages:plan.packages,results},null,2)+'\n');
