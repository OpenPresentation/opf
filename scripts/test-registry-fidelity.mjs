// Run pinned source tests against actual installed registry distributables.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile,symlink,rm,realpath} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {archiveRegistryFidelity} from './registry-fidelity-archive.mjs';
import {examplesDigest,readPublishedCoreGolden} from './registry-golden.mjs';
import {registryPlan, SET} from './registry-plan.mjs';
const root=process.cwd();
// MR-34: the published set is the registry's `latest` of each package (scripts/registry-plan.mjs) (nothing hand-edited).
const plan=registryPlan();
const consumer=path.resolve(process.argv[2]??'artifacts/npm/registry-consumer');
const require=createRequire(path.join(consumer,'package.json'));
const lock=JSON.parse(await readFile(path.join(consumer,'package-lock.json'),'utf8'));
const modules=await realpath(path.join(consumer,'node_modules'));
const installedPackages=plan.packages;
for(const item of installedPackages){
 const manifest=JSON.parse(await readFile(require.resolve(item.name+'/package.json'),'utf8'));
 assert.equal(manifest.version,item.version,item.name);
 const directory=await realpath(path.dirname(require.resolve(item.name+'/package.json')));
 const record=lock.packages['node_modules/'+item.name];
 assert.ok(directory.startsWith(modules+path.sep)&&record?.version===item.version&&!record.link&&record.resolved?.startsWith('https://registry.npmjs.org/')&&record.integrity?.startsWith('sha512-'),'Expected registry installation: '+item.name);
}
const results=[];
const coreVersion=plan.packages.find(item=>item.name==='@openpresentation/opf').version.split('.').map(Number);
const styled=coreVersion[0]>0||coreVersion[1]>=7;
const atLeast=(name,minimum)=>{
 const actual=plan.packages.find(item=>item.name===name).version.split('.').map(Number);
 for(let index=0;index<3;index++)if(actual[index]!==minimum[index])return actual[index]>minimum[index];
 return true;
};
const quoteFooter=atLeast('@openpresentation/opf-render',[0,5,1]);
const nativeContent=atLeast('@openpresentation/opf-pptx',[0,5,2]);
const sharedQuotes=atLeast('@openpresentation/opf',[0,8,0]);
const sharedCode=atLeast('@openpresentation/opf',[0,9,0]);
const acceptedLayout=atLeast('@openpresentation/opf',[0,10,0]);
// Read the reviewed golden from the same immutable core release source as the installed registry package. Current
// source may compose the same examples differently; its golden must never qualify an older installed core.
// The package exports ./examples for import only, so resolve it from the installed manifest, not through require.
const coreManifestPath=require.resolve('@openpresentation/opf/package.json');
const coreExamples=JSON.parse(await readFile(coreManifestPath,'utf8')).exports['./examples'].import;
const {examples}=await import(pathToFileURL(path.resolve(path.dirname(coreManifestPath),coreExamples)).href);
const publishedGolden=readPublishedCoreGolden({root,ref:plan.verificationRefs?.opf,version:plan.packages.find(item=>item.name==='@openpresentation/opf').version,digest:examplesDigest(examples)});
let reviewedGolden;
if(publishedGolden){
 const directory=path.join(consumer,'fidelity','opf');await mkdir(directory,{recursive:true});
 reviewedGolden=path.join(directory,'golden.json');await writeFile(reviewedGolden,publishedGolden.bytes);
 console.log('Registry golden: exact '+publishedGolden.ref+':'+publishedGolden.path+'; installed core version and examples digest match; pixel hashes compared exactly.');
}
const suites=[
 ['opf-render',['webp.mjs','jpeg-orientation.mjs','rich-table.mjs','golden.mjs',...(styled?['styled-table.mjs']:[]),...(quoteFooter?['quote-footer.mjs']:[]),...(sharedQuotes?['shared-quote.mjs']:[]),...(sharedCode?['shared-code.mjs']:[]),...(acceptedLayout?['accepted-text.mjs','shared-metric.mjs','timeline.mjs']:[])]],
 ['opf-pptx',['dependency-boundary.mjs',...(styled?['styled-table.mjs','styled-table-import.mjs']:[]),...(nativeContent?['content-layout.mjs']:[]),...(sharedQuotes?['shared-quote.mjs']:[]),...(sharedCode?['shared-code.mjs','code-provenance.mjs']:[]),...(acceptedLayout?['plain-whitespace.mjs','accepted-text.mjs','content-cards.mjs','shared-timeline.mjs','font-variants.mjs']:[])]],
];
for(const [repo,tests] of suites){
 const ref=plan.verificationRefs[repo];assert.match(ref,/^[a-f0-9]{40}$/);
 const directory=path.join(consumer,'fidelity',repo);await mkdir(directory,{recursive:true});
 const archive=archiveRegistryFidelity({checkout:root,ref,repo,directory,prefix:SET.find(item=>item.key===repo).directory});
 const installed=path.dirname(require.resolve('@openpresentation/'+repo+'/package.json'));
 const shipped=JSON.parse(await readFile(path.join(installed,'package.json'),'utf8'));
 // Newer PPTX smoke fixtures reference the shipped, hash-verified vendor code.
 // Link the actual installed directory, never a source checkout substitute.
 for(const part of ['dist',...(shipped.files?.includes('vendor')?['vendor']:[])]){
  await symlink(path.join(installed,part),path.join(directory,part),process.platform==='win32'?'junction':'dir').catch(e=>{if(e.code!=='EEXIST')throw e});
  assert.equal(await realpath(path.join(directory,part)),await realpath(path.join(installed,part)),`Test must execute the installed ${part} files`);
 }
 for(const test of tests){
  const env={...process.env};
  for(const key of ['NODE_OPTIONS','OPF_TEST_RASTER_MODULE','OPF_TEST_PPTX_MODULE','OPF_GOLDEN_BASELINE','OPF_EXAMPLES_DIR','OPF_GOLDEN_OUT','OPF_GOLDEN_SCALE']) delete env[key];
  if(test==='golden.mjs'&&reviewedGolden)env.OPF_GOLDEN_BASELINE=reviewedGolden;
  const output=execFileSync(process.execPath,[path.join(directory,'test',test)],{cwd:consumer,env,encoding:'utf8',maxBuffer:8*1024*1024});
  await writeFile(path.join(directory,test+'.log'),output);console.log(output.trim());results.push({repo,ref,test,passed:true});
 }
 await rm(archive);
}
await writeFile(path.join(consumer,'fidelity','report.json'),JSON.stringify({scope:'Pinned tests and fixtures, installed registry dist files; no source package overrides',packages:installedPackages,results},null,2)+'\n');
