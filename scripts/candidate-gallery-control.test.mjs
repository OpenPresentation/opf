import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,readFileSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {stagePublishedControlPlan,verifyPublishedControlPlan} from './candidate-gallery-control.mjs';
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
