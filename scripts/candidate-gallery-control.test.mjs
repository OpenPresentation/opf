import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,readFileSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {stagePublishedControlPlan,verifyPublishedControlPlan,FONT_COUNT_BRIDGE} from './candidate-gallery-control.mjs';
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
