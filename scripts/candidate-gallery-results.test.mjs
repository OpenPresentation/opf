import assert from 'node:assert/strict';
import test from 'node:test';
import {qualificationPeerGate,requireQualification} from './candidate-gallery-results.mjs';
test('required status cannot turn missing, skipped, failed or mixed candidate/control checks green',()=>{
 for(const mode of ['core','ecosystem']){
  const normal=mode==='core'?['normal']:['ecosystem-render','ecosystem-pptx','ecosystem-editor','ecosystem-core'];
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

import {gate,report} from './unreleased-gate.mjs';
test('default unpublished-peer waits retain their report while explicit candidate waits fail',()=>{
 const waiting=gate({subject:'published peer',required:'0.19.0',installed:'0.18.1',met:false,event:'pull_request'});
 const notices=[],original=console.log;console.log=value=>notices.push(value);
 try{assert.equal(report(qualificationPeerGate(waiting,false)),false);}finally{console.log=original;}
 assert.equal(notices.length,1);assert.match(notices[0],/Unreleased dependency/);
 assert.throws(()=>qualificationPeerGate(waiting,true),/candidate peer contract must run completely/);
 const ready={run:true};assert.equal(qualificationPeerGate(ready,false),ready);assert.equal(qualificationPeerGate(ready,true),ready);
});
