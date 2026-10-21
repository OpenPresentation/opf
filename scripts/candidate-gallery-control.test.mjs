import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,readFileSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {stagePublishedControlPlan,verifyPublishedControlPlan,FONT_COUNT_BRIDGE,PUBLISHED_019_TOOLING,PUBLISHED_019_SOURCE,PUBLISHED_0242_TOOLING,PUBLISHED_0242_SOURCE} from './candidate-gallery-control.mjs';
test('published control permits only the independently recorded exact plan override',()=>{
 const root=realpathSync(mkdtempSync(path.join(tmpdir(),'rr78-control-'))),coreRoot=path.join(root,'core'),toolsRoot=path.join(root,'tools');
 try{
  mkdirSync(coreRoot);mkdirSync(toolsRoot);writeFileSync(path.join(coreRoot,'.gitignore'),'artifacts/\n');
  writeFileSync(path.join(coreRoot,'release-plan.json'),'{"old":true}\n');writeFileSync(path.join(coreRoot,'source.mjs'),'original\n');
  execFileSync('git',['init','-q',coreRoot]);execFileSync('git',['-C',coreRoot,'add','.']);execFileSync('git',['-C',coreRoot,'-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','published']);
  writeFileSync(path.join(toolsRoot,'release-plan.json'),'{"reviewed":true}\n');
  const record=stagePublishedControlPlan({coreRoot,toolsRoot});assert.deepEqual(record.originalPlan,{old:true});
  assert.deepEqual(verifyPublishedControlPlan({coreRoot,toolsRoot}),record);
  writeFileSync(path.join(coreRoot,'source.mjs'),'tampered\n');assert.throws(()=>verifyPublishedControlPlan({coreRoot,toolsRoot}),/outside/);
  writeFileSync(path.join(coreRoot,'source.mjs'),'original\n');writeFileSync(path.join(coreRoot,'release-plan.json'),'{"other":true}\n');assert.throws(()=>verifyPublishedControlPlan({coreRoot,toolsRoot}));
  writeFileSync(path.join(coreRoot,'release-plan.json'),readFileSync(path.join(toolsRoot,'release-plan.json')));
  writeFileSync(path.join(coreRoot,'artifacts/published-control/original-release-plan.json'),'{}');assert.throws(()=>verifyPublishedControlPlan({coreRoot,toolsRoot}));
 }finally{rmSync(root,{recursive:true,force:true});}
});

test('published runtime bridge is pinned, preserves original bytes and rejects arbitrary overrides',async()=>{
 const root=realpathSync(mkdtempSync(path.join(tmpdir(),'rr78-font-bridge-'))),coreRoot=path.join(root,'core'),toolsRoot=path.join(root,'tools');
 const sourceRoot=fileURLToPath(new URL('..',import.meta.url));
 const original=execFileSync('git',['-C',sourceRoot,'show','e09461624a64fb58761c28475c2b354984deb165:scripts/lazy-font-counts.mjs']);
 const sourceGit=execFileSync('git',['-C',sourceRoot,'rev-parse','--absolute-git-dir'],{encoding:'utf8'}).trim();
 try{
  mkdirSync(path.join(coreRoot,'scripts'),{recursive:true});mkdirSync(toolsRoot);writeFileSync(path.join(toolsRoot,'.git'),`gitdir: ${sourceGit}\n`);
  writeFileSync(path.join(coreRoot,'.gitignore'),'artifacts/\n');writeFileSync(path.join(coreRoot,'release-plan.json'),'{}\n');writeFileSync(path.join(coreRoot,'runtime.mjs'),'original runtime\n');
  writeFileSync(path.join(coreRoot,'scripts/lazy-font-counts.mjs'),original);writeFileSync(path.join(toolsRoot,'release-plan.json'),JSON.stringify({packages:[{name:'@openpresentation/opf-render',version:'0.18.2'}]}));
  execFileSync('git',['init','-q',coreRoot]);execFileSync('git',['-C',coreRoot,'add','.']);execFileSync('git',['-C',coreRoot,'-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','published']);
  const before=await import(`data:text/javascript;base64,${original.toString('base64')}`);assert.throws(()=>before.assertLazyFontCount('0.18.2',94),/no expected/);
  const record=stagePublishedControlPlan({coreRoot,toolsRoot});assert.deepEqual(record.testToolingBridge,{path:'scripts/lazy-font-counts.mjs',...FONT_COUNT_BRIDGE});assert.match(record.qualification,/published runtime.*test-tooling bridge/);
  assert.deepEqual(readFileSync(path.join(coreRoot,'artifacts/published-control/original-lazy-font-counts.mjs')),original);assert.deepEqual(verifyPublishedControlPlan({coreRoot,toolsRoot}),record);
  const helper=path.join(coreRoot,'scripts/lazy-font-counts.mjs'),bridged=readFileSync(helper);const after=await import(`data:text/javascript;base64,${bridged.toString('base64')}`);after.assertLazyFontCount('0.18.2',94);assert.throws(()=>after.assertLazyFontCount('0.18.2',95),/expected 94/);assert.throws(()=>after.assertLazyFontCount('99.99.99',94),/no expected/);assert.throws(()=>after.assertLazyFontCount('0.19.0-next.0',94),/no expected/);
  writeFileSync(path.join(coreRoot,'runtime.mjs'),'altered');assert.throws(()=>verifyPublishedControlPlan({coreRoot,toolsRoot}),/outside/);writeFileSync(path.join(coreRoot,'runtime.mjs'),'original runtime\n');
  writeFileSync(helper,'arbitrary helper');assert.throws(()=>verifyPublishedControlPlan({coreRoot,toolsRoot}),/helper identity/);writeFileSync(helper,bridged);
  writeFileSync(path.join(coreRoot,'extra.mjs'),'extra');assert.throws(()=>verifyPublishedControlPlan({coreRoot,toolsRoot}),/untracked/);rmSync(path.join(coreRoot,'extra.mjs'));
  const metadata=path.join(coreRoot,'artifacts/published-control/metadata.json');writeFileSync(metadata,JSON.stringify({...record,testToolingBridge:{...record.testToolingBridge,path:'runtime.mjs'}}));assert.throws(()=>verifyPublishedControlPlan({coreRoot,toolsRoot}),/unknown test-tooling override/);
 }finally{rmSync(root,{recursive:true,force:true});}
});


test('exact published19 runtime uses recorded final registry helpers and refuses tampering',async()=>{
 const root=realpathSync(mkdtempSync(path.join(tmpdir(),'rr20-control19-'))),coreRoot=path.join(root,'core'),toolsRoot=path.join(root,'tools');
 const sourceRoot=fileURLToPath(new URL('..',import.meta.url));
 const sourceGit=execFileSync('git',['-C',sourceRoot,'rev-parse','--absolute-git-dir'],{encoding:'utf8'}).trim();
 try{
  execFileSync('git',['clone','--shared','--no-checkout',sourceRoot,coreRoot],{stdio:'pipe'});
  execFileSync('git',['-C',coreRoot,'checkout','--detach',PUBLISHED_019_SOURCE],{stdio:'pipe'});
  mkdirSync(toolsRoot);writeFileSync(path.join(toolsRoot,'.git'),`gitdir: ${sourceGit}\n`);
  const plan=execFileSync('git',['-C',sourceRoot,'show','85089bf359a41950e5887d782452dd3884805386:release-plan.json']);writeFileSync(path.join(toolsRoot,'release-plan.json'),plan);
  const runtime=path.join(coreRoot,'packages/javascript/src/composition.ts'),runtimeBytes=readFileSync(runtime);
  const originalFont=readFileSync(path.join(coreRoot,'scripts/lazy-font-counts.mjs'));
  const before=await import(`data:text/javascript;base64,${originalFont.toString('base64')}`);assert.throws(()=>before.assertLazyFontCount('0.19.1',94),/no expected/);
  const oldLayout=readFileSync(path.join(coreRoot,'scripts/test-layout-contract-registry.mjs'),'utf8');
  const oldAssertions=oldLayout.split('\n').filter(line=>line.startsWith('assert.ok(layouts.some')).join('\n');
  const layouts=['quote','timeline'].map(id=>({id}));assert.throws(()=>new Function('assert','layouts',oldAssertions)(assert,layouts));
  const record=stagePublishedControlPlan({coreRoot,toolsRoot});assert.deepEqual(record.testToolingBridges,PUBLISHED_019_TOOLING);
  assert.deepEqual(verifyPublishedControlPlan({coreRoot,toolsRoot}),record);assert.deepEqual(readFileSync(runtime),runtimeBytes);
  const after=await import(`data:text/javascript;base64,${readFileSync(path.join(coreRoot,'scripts/lazy-font-counts.mjs')).toString('base64')}`);
  execFileSync(process.execPath,['--test','scripts/lazy-font-counts.test.mjs'],{cwd:coreRoot,stdio:'pipe'});
  after.assertLazyFontCount('0.19.1',94);assert.throws(()=>after.assertLazyFontCount('0.19.1',95),/expected 94/);assert.throws(()=>after.assertLazyFontCount('0.20.0',94),/no expected/);
  for(const bridge of PUBLISHED_019_TOOLING){
   const file=path.join(coreRoot,bridge.path),bytes=readFileSync(file);writeFileSync(file,'tampered');assert.throws(()=>verifyPublishedControlPlan({coreRoot,toolsRoot}),/helper identity/);writeFileSync(file,bytes);
  }
  writeFileSync(runtime,'tampered runtime');assert.throws(()=>verifyPublishedControlPlan({coreRoot,toolsRoot}),/outside/);writeFileSync(runtime,runtimeBytes);
  const extra=path.join(coreRoot,'scripts/unknown-tool.mjs');writeFileSync(extra,'unexpected');assert.throws(()=>verifyPublishedControlPlan({coreRoot,toolsRoot}),/untracked/);rmSync(extra);
  const metadata=path.join(coreRoot,'artifacts/published-control/metadata.json');writeFileSync(metadata,JSON.stringify({...record,testToolingBridges:[{...PUBLISHED_019_TOOLING[0],path:'packages/javascript/src/composition.ts'}]}));assert.throws(()=>verifyPublishedControlPlan({coreRoot,toolsRoot}),/unknown 0.19/);writeFileSync(metadata,JSON.stringify(record));
  const unknown=JSON.parse(plan);unknown.packages.find(item=>item.name==='@openpresentation/opf').version='0.20.0';writeFileSync(path.join(toolsRoot,'release-plan.json'),JSON.stringify(unknown));assert.throws(()=>verifyPublishedControlPlan({coreRoot,toolsRoot}));
  execFileSync('git',['-C',coreRoot,'checkout','HEAD','--','release-plan.json','scripts/lazy-font-counts.mjs','scripts/lazy-font-counts.test.mjs','scripts/test-layout-contract-registry.mjs']);rmSync(path.join(coreRoot,'scripts/registry-layout-v2.mjs'));
  assert.throws(()=>stagePublishedControlPlan({coreRoot,toolsRoot}),/unknown published 0.19 control graph/);
  assert.deepEqual(readFileSync(runtime),runtimeBytes);
 }finally{rmSync(root,{recursive:true,force:true});}
});

test('published 0.24.2 runs the reviewed installed-code and catalog-generation helpers, and only those files',()=>{
 const root=realpathSync(mkdtempSync(path.join(tmpdir(),'fa33-control0242-'))),coreRoot=path.join(root,'core'),toolsRoot=path.join(root,'tools');
 const sourceRoot=fileURLToPath(new URL('..',import.meta.url));
 const sourceGit=execFileSync('git',['-C',sourceRoot,'rev-parse','--absolute-git-dir'],{encoding:'utf8'}).trim();
 try{
  execFileSync('git',['clone','--shared','--no-checkout',sourceRoot,coreRoot],{stdio:'pipe'});
  execFileSync('git',['-C',coreRoot,'checkout','--detach',PUBLISHED_0242_SOURCE],{stdio:'pipe'});
  mkdirSync(toolsRoot);writeFileSync(path.join(toolsRoot,'.git'),`gitdir: ${sourceGit}\n`);
  const plan=execFileSync('git',['-C',sourceRoot,'show',`${PUBLISHED_0242_TOOLING[0].sourceSha}:release-plan.json`]);writeFileSync(path.join(toolsRoot,'release-plan.json'),plan);
  const runtime=path.join(coreRoot,'packages/javascript/src/composition.ts'),runtimeBytes=readFileSync(runtime);
  const helper=path.join(coreRoot,PUBLISHED_0242_TOOLING[0].path),originalHelper=readFileSync(helper);
  assert.ok(!originalHelper.toString('utf8').includes('generatedAtRef'),'the published helper lacks the styles rebuild');
  assert.deepEqual(PUBLISHED_0242_TOOLING.map(item=>item.path),['scripts/test-installed-code.mjs','scripts/published-matrix/consumer-dependencies.mjs','scripts/published-matrix/consumer-dependencies.test.mjs']);
  const record=stagePublishedControlPlan({coreRoot,toolsRoot});assert.deepEqual(record.testToolingBridges,PUBLISHED_0242_TOOLING);
  assert.deepEqual(verifyPublishedControlPlan({coreRoot,toolsRoot}),record);
  assert.ok(readFileSync(helper,'utf8').includes('generatedAtRef'),'the bridged helper rebuilds dist/styles.css from the release commit');
  assert.deepEqual(readFileSync(path.join(coreRoot,'artifacts/published-control/original-tooling',PUBLISHED_0242_TOOLING[0].path)),originalHelper);
  assert.deepEqual(readFileSync(runtime),runtimeBytes);
  const bridged=readFileSync(helper);writeFileSync(helper,'tampered');assert.throws(()=>verifyPublishedControlPlan({coreRoot,toolsRoot}),/helper identity/);writeFileSync(helper,bridged);
  writeFileSync(runtime,'tampered runtime');assert.throws(()=>verifyPublishedControlPlan({coreRoot,toolsRoot}),/outside/);writeFileSync(runtime,runtimeBytes);
  const metadata=path.join(coreRoot,'artifacts/published-control/metadata.json');writeFileSync(metadata,JSON.stringify({...record,testToolingBridges:[{...PUBLISHED_0242_TOOLING[0],path:'packages/javascript/src/composition.ts'}]}));assert.throws(()=>verifyPublishedControlPlan({coreRoot,toolsRoot}),/unknown 0.24.2/);
 }finally{rmSync(root,{recursive:true,force:true});}
});
