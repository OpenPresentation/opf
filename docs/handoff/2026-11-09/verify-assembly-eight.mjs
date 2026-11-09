import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024}).trim();
const base='6d5d61edc5c78a5c92128dd517c7dd6257d52331',source='be65fa941edbd191a72db2f8d74742309ba9dd68';
const inputs=[
 {pr:1216,base,head:'237645bb0c22364af9060a01ff080b599f20a391'},
 {pr:1217,base,head:'fc4f4380f36e77971a3666f629920e50fd99ea79'},
 {pr:1218,base,head:'ca5ef93b857611922d9d75e4733dd99e98232c03'},
 {pr:1219,base,head:'261024588590c1ec9b787af4b9fb420445b603a1'},
 {pr:1221,base:'b3fea03d7abfee1217d586fa85d6061e0a659c4f',head:'418239bfd5446440813edaa9ca7e9c3ca4ef2e24'},
 {pr:1222,base,head:'1036e3e819257879d573772a9994c9142248ab07'},
 {pr:1223,base:'de693209caf392e3b86c30cc810a7fe9078a8ec9',head:'f40c2c9889661c82a0fcb0a6289a53ae33fb85c7'},
 {pr:1224,base:'5b9e4386c00319da1fa4370dcc0b3eb6e93c9578',head:'8b5805fff0a0c812539d4136b73ce092645d29b6'},
];
const paths=(...args)=>git(...args).split('\n').filter(Boolean);
const owners=new Map();
for(const input of inputs){
 assert.equal(spawnSync('git',['merge-base','--is-ancestor',input.head,source],{cwd:root}).status,0,`PR${input.pr} ancestor`);
 for(const file of paths('diff','--name-only',input.base,input.head,'--','packages','tools')){
  const binding={file,pr:input.pr,head:input.head,entry:git('ls-tree',input.head,'--',file).split('\t')[0]};
  assert(!owners.has(file),`Unexpected overlapping source ownership: ${file}`);owners.set(file,binding);
 }
}
const changed=paths('diff','--name-only',base,source,'--','packages','tools').sort();
assert.deepEqual(changed,[...owners.keys()].sort());
for(const binding of owners.values())assert.equal(git('ls-tree',source,'--',binding.file).split('\t')[0],binding.entry,binding.file);
const protectedPaths=['spec','packages/javascript/src','packages/pptx/src','packages/render/src/font-registry.js','packages/editor/test/startup-perf-browser.mjs','packages/editor/test/support/startup-decks.mjs','packages/render/test/golden','packages/render/test/fixtures','.github','scripts','package.json','pnpm-lock.yaml','pnpm-workspace.yaml'];
const protectedObjects=protectedPaths.map(path=>{const object=git('rev-parse',base+':'+path);assert.equal(git('rev-parse',source+':'+path),object,path);return{path,object};});
assert.deepEqual(paths('diff','--name-only',base,source,'--','packages/render/src'),['packages/render/src/lazy-fonts.js']);
const chart=JSON.parse(git('show',source+':spec/schemas/opf.schema.json')).$defs.Chart;
assert.deepEqual(chart,JSON.parse(git('show',base+':spec/schemas/opf.schema.json')).$defs.Chart);
const shapes=git('show',source+':docs/programs/shapes/burndown.md');assert(!/^(<<<<<<<|=======|>>>>>>>)/m.test(shapes));
for(const token of ['SH24-PUBLIC-COPY','SH-20 portable source462394ca','SH-20 portability follow-up'])assert(shapes.includes(token),token);
const proof={format:1,source,sourceTree:git('rev-parse',source+'^{tree}'),base,inputs,packageToolPaths:changed.length,bindings:[...owners.values()].sort((a,b)=>a.file.localeCompare(b.file)),protectedObjects,chartDefinitionSha256:createHash('sha256').update(JSON.stringify(chart)).digest('hex'),scope:'Exact source/merge preservation only; not combined CI, native, golden or release acceptance.'};
const target=new URL('./assembly-eight.json',import.meta.url);
if(process.argv.includes('--write')){assert.equal(git('rev-parse','HEAD'),source);fs.writeFileSync(target,JSON.stringify(proof,null,2)+'\n');}
else assert.deepEqual(JSON.parse(fs.readFileSync(target)),proof);
console.log(JSON.stringify({verified:true,source,sourceTree:proof.sourceTree,reviewedPrs:inputs.map(i=>i.pr),packageToolPaths:changed.length,protectedObjects:protectedObjects.length,chartDefinitionSha256:proof.chartDefinitionSha256,combinedCiAccepted:false}));
