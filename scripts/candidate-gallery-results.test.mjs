import assert from 'node:assert/strict';
import test from 'node:test';
import {requireQualification} from './candidate-gallery-results.mjs';
test('required status cannot turn missing, skipped, failed or mixed candidate/control checks green',()=>{
 for(const mode of ['core','ecosystem']){
  const normal=mode==='core'?['normal']:['ecosystem-render','ecosystem-pptx-editor','ecosystem-core'];
  const results={gallery:{result:'success'},candidate:{result:'skipped'},control:{result:'skipped'},...Object.fromEntries(normal.map(name=>[name,{result:'success'}]))};
  assert.doesNotThrow(()=>requireQualification({mode,sha:'',results}));
  const candidate={'installed-portability':{result:'success'},gallery:{result:'success'},candidate:{result:'success'},control:{result:'success'},...Object.fromEntries(normal.map(name=>[name,{result:'skipped'}]))};
  assert.doesNotThrow(()=>requireQualification({mode,sha:'a'.repeat(40),results:candidate}));
  for(const name of ['gallery','candidate','control',...(mode==='ecosystem'?['installed-portability']:[])])for(const result of ['skipped','failure','cancelled',undefined]){
   const invalid=structuredClone(candidate);invalid[name]={result};
   assert.throws(()=>requireQualification({mode,sha:'a'.repeat(40),results:invalid}));
  }
  const mixed=structuredClone(candidate);mixed[normal[0]]={result:'success'};
  assert.throws(()=>requireQualification({mode,sha:'a'.repeat(40),results:mixed}));
  assert.throws(()=>requireQualification({mode,sha:'main',results:candidate}));
 }
});
