import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
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

// RR-100: the release-prep fast path of the merge queue skips the full lanes; it still cannot turn anything else green.
test('the release-prep fast path needs every full lane skipped, and in core mode its own check green',()=>{
 for(const mode of ['core','ecosystem']){
  const normal=mode==='core'?['normal']:['ecosystem-render','ecosystem-pptx','ecosystem-editor','ecosystem-core'];
  const fast={gallery:{result:'success'},candidate:{result:'skipped'},control:{result:'skipped'},...(mode==='core'?{'release-prep':{result:'success'}}:{}),...Object.fromEntries(normal.map(name=>[name,{result:'skipped'}]))};
  assert.doesNotThrow(()=>requireQualification({mode,sha:'',results:fast,releasePrep:true}));
  // The flag is off by default: skipped full lanes are a failure on any ordinary run.
  assert.throws(()=>requireQualification({mode,sha:'',results:fast}),/must succeed/);
  assert.throws(()=>requireQualification({mode,sha:'a'.repeat(40),results:fast,releasePrep:true}),/no candidate/);
  for(const name of [...normal,'candidate','control'])for(const result of ['success','failure','cancelled',undefined]){
   const ran=structuredClone(fast);ran[name]={result};
   assert.throws(()=>requireQualification({mode,sha:'',results:ran,releasePrep:true}),/must be skipped/,`${name} ${result}`);
  }
  for(const result of ['skipped','failure','cancelled',undefined]){
   const invalid=structuredClone(fast);invalid.gallery={result};
   assert.throws(()=>requireQualification({mode,sha:'',results:invalid,releasePrep:true}));
  }
 }
 for(const result of ['skipped','failure','cancelled',undefined]){
  const results={gallery:{result:'success'},candidate:{result:'skipped'},control:{result:'skipped'},normal:{result:'skipped'},'release-prep':{result}};
  assert.throws(()=>requireQualification({mode:'core',sha:'',results,releasePrep:true}),/release-prep version and changelog check must succeed/,String(result));
 }
});
test('the command reads the fast path from RELEASE_PREP=true only',()=>{
 const script=fileURLToPath(new URL('./candidate-gallery-results.mjs',import.meta.url));
 const results=JSON.stringify({gallery:{result:'success'},candidate:{result:'skipped'},control:{result:'skipped'},normal:{result:'skipped'},'release-prep':{result:'success'}});
 const run=env=>spawnSync(process.execPath,[script],{env:{PATH:process.env.PATH,MODE:'core',RESULTS:results,...env},encoding:'utf8'});
 assert.equal(run({RELEASE_PREP:'true'}).status,0);
 for(const value of [undefined,'','false','TRUE','1','yes'])assert.notEqual(run({RELEASE_PREP:value}).status,0,String(value));
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
