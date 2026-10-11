import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
export function qualificationPeerGate(result,candidate=false){
 if(candidate)assert.equal(result.run,true,'candidate peer contract must run completely; no unpublished-peer skip');
 return result;
}
export function requireQualification({mode,sha,results}){
 assert.ok(['core','ecosystem'].includes(mode),'unknown qualification mode');
 assert.equal(results.gallery?.result,'success','candidate selection must succeed');
 const normal=mode==='core'?['normal']:['ecosystem-render','ecosystem-pptx-editor','ecosystem-core'];
 if(sha){
  assert.match(sha,/^[0-9a-f]{40}$/,'selected candidate SHA must be immutable');
  assert.equal(results.candidate?.result,'success','complete staged qualification must succeed');
  assert.equal(results.control?.result,'success','published source and reviewed registry qualification must succeed');
  if(mode==='ecosystem')assert.equal(results['installed-portability']?.result,'success','both required installed portability legs must succeed');
  for(const name of normal)assert.equal(results[name]?.result,'skipped','normal and candidate lanes must not mix');
 }else{
  for(const name of normal)assert.equal(results[name]?.result,'success',`${name} must succeed`);
  for(const name of ['candidate','control'])assert.equal(results[name]?.result,'skipped','default qualification must not use staging');
 }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 requireQualification({mode:process.env.MODE,sha:process.env.CANDIDATE_SHA??'',results:JSON.parse(process.env.RESULTS)});
 console.log('The selected complete qualification and its required control succeeded.');
}
