import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024}).trim();
const base='6d5d61edc5c78a5c92128dd517c7dd6257d52331',source='401d9f9f03f7c293cdcee8e7d14ec7e5161bde63';
const inputs=[
 {pr:1216,base,head:'237645bb0c22364af9060a01ff080b599f20a391'},
 {pr:1217,base,head:'fc4f4380f36e77971a3666f629920e50fd99ea79'},
 {pr:1218,base,head:'ca5ef93b857611922d9d75e4733dd99e98232c03'},
 {pr:1219,base,head:'261024588590c1ec9b787af4b9fb420445b603a1'},
 {pr:1221,base:'b3fea03d7abfee1217d586fa85d6061e0a659c4f',head:'418239bfd5446440813edaa9ca7e9c3ca4ef2e24'},
 {pr:1222,base,head:'1036e3e819257879d573772a9994c9142248ab07'},
 {pr:1223,base:'de693209caf392e3b86c30cc810a7fe9078a8ec9',head:'f40c2c9889661c82a0fcb0a6289a53ae33fb85c7'},
 {pr:1224,base:'5b9e4386c00319da1fa4370dcc0b3eb6e93c9578',head:'8b5805fff0a0c812539d4136b73ce092645d29b6'},
 {pr:'golden-42587651918',base:'a1126f6b7d08a24ca9b76303e22ac9316685c301',head:'f32f7ea982a3bf41edd7e31064ea9a5d779ea5db'},
 {pr:1226,base:'a1126f6b7d08a24ca9b76303e22ac9316685c301',head:'67858bf9dc671a51612493ca638fd8f2c7ae5375'},
 {pr:1227,base:'f32f7ea982a3bf41edd7e31064ea9a5d779ea5db',head:'63132173f62db7dc2a5013a187baf8ec0f7c1150'},
 {pr:1228,base:'b487178e7d5425c3bb272a4b294dfea3ba15e7cc',head:'d72f2d02cdc509610f8ee7f146f4c1a932b1f27b'},
 {pr:1230,base:'606cc9c26d622c747999e9f245c2b90402337ab0',head:'a1792b5970abcd47f21fa5af4110932df81f0ec6'},
];
const ownershipTransitions=[];
const paths=(...args)=>git(...args).split('\n').filter(Boolean);
const owners=new Map();
for(const input of inputs){
 assert.equal(spawnSync('git',['merge-base','--is-ancestor',input.head,source],{cwd:root}).status,0,`PR${input.pr} ancestor`);
 for(const file of paths('diff','--name-only',input.base,input.head,'--','packages','tools')){
  const binding={file,pr:input.pr,head:input.head,entry:git('ls-tree',input.head,'--',file).split('\t')[0]};
  if(owners.has(file)){
    const previous=owners.get(file);
    assert.equal(input.pr,1228);assert.equal(previous.pr,1227);assert.equal(file,'packages/javascript/src/composition.ts');
    const baseEntry=git('ls-tree',input.base,'--',file).split('\t')[0];assert.equal(previous.entry,baseEntry,'Continuation base must preserve exact reviewed selector');
    ownershipTransitions.push({file,base:input.base,baseEntry,previous,next:binding});
  }
  owners.set(file,binding);
 }
}
const changed=paths('diff','--name-only',base,source,'--','packages','tools').sort();
assert.deepEqual(changed,[...owners.keys()].sort());
for(const binding of owners.values())assert.equal(git('ls-tree',source,'--',binding.file).split('\t')[0],binding.entry,binding.file);
const protectedPaths=['spec','packages/render/src/font-registry.js','packages/editor/test/startup-perf-browser.mjs','packages/editor/test/support/startup-decks.mjs','packages/render/test/fixtures','.github','scripts','package.json','pnpm-lock.yaml','pnpm-workspace.yaml'];
const protectedObjects=protectedPaths.map(path=>{const object=git('rev-parse',base+':'+path);assert.equal(git('rev-parse',source+':'+path),object,path);return{path,object};});
assert.deepEqual(paths('diff','--name-only',base,source,'--','packages/render/src'),['packages/render/src/lazy-fonts.js']);
assert.deepEqual(paths('diff','--name-only',base,source,'--','packages/javascript/src'),['packages/javascript/src/composition.ts','packages/javascript/src/continuation-fonts.ts','packages/javascript/src/pagination.ts']);
assert.deepEqual(paths('diff','--name-only',base,source,'--','packages/render/test/golden'),['packages/render/test/golden/layout-templates-rr96-color-variants.json']);
assert.deepEqual(paths('diff','--name-only','a1126f6b7d08a24ca9b76303e22ac9316685c301','f32f7ea982a3bf41edd7e31064ea9a5d779ea5db'),['packages/javascript/test/fixtures/template-goldens-0.19.json','packages/render/test/golden/layout-templates-rr96-color-variants.json']);
const pptxChanged=paths('diff','--name-only',base,source,'--','packages/pptx/src');
assert.deepEqual(pptxChanged,['packages/pptx/src/body-text-import.js','packages/pptx/src/import-signals.js','packages/pptx/src/index.d.ts','packages/pptx/src/index.js','packages/pptx/src/native-autofit.js','packages/pptx/src/shape-import.js','packages/pptx/src/table-import.js']);
const pptxUnchangedSourceBindings=paths('ls-tree','-r','--name-only',base,'--','packages/pptx/src').filter(file=>!pptxChanged.includes(file)).map(file=>{const entry=git('ls-tree',base,'--',file).split('\t')[0];assert.equal(git('ls-tree',source,'--',file).split('\t')[0],entry,file);return{file,entry};});
const chart=JSON.parse(git('show',source+':spec/schemas/opf.schema.json')).$defs.Chart;
assert.deepEqual(chart,JSON.parse(git('show',base+':spec/schemas/opf.schema.json')).$defs.Chart);
const shapes=git('show',source+':docs/programs/shapes/burndown.md');assert(!/^(<<<<<<<|=======|>>>>>>>)/m.test(shapes));
for(const token of ['SH24-PUBLIC-COPY','SH-20 portable source462394ca','SH-20 portability follow-up'])assert(shapes.includes(token),token);
const proof={format:1,source,sourceTree:git('rev-parse',source+'^{tree}'),base,inputs,ownershipTransitions,pptxChanged,pptxUnchangedSourceBindings,packageToolPaths:changed.length,bindings:[...owners.values()].sort((a,b)=>a.file.localeCompare(b.file)),protectedObjects,chartDefinitionSha256:createHash('sha256').update(JSON.stringify(chart)).digest('hex'),scope:'Exact source/merge preservation only; not combined CI, native, golden or release acceptance.'};
const target=new URL('./assembly-twelve.json',import.meta.url);
if(process.argv.includes('--write')){assert.equal(git('rev-parse','HEAD'),source);fs.writeFileSync(target,JSON.stringify(proof,null,2)+'\n');}
else assert.deepEqual(JSON.parse(fs.readFileSync(target)),proof);
console.log(JSON.stringify({verified:true,source,sourceTree:proof.sourceTree,reviewedPrs:inputs.map(i=>i.pr).filter(pr=>typeof pr==='number'),packageToolPaths:changed.length,protectedObjects:protectedObjects.length,chartDefinitionSha256:proof.chartDefinitionSha256,combinedCiAccepted:false}));
