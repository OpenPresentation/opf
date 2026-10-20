import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
export function qualificationPeerGate(result,candidate=false){
 if(candidate)assert.equal(result.run,true,'candidate peer contract must run completely; no unpublished-peer skip');
 return result;
}
export function requireQualification({mode,sha,results,releasePrep=false}){
 assert.ok(['core','ecosystem'].includes(mode),'unknown qualification mode');
 assert.equal(results.gallery?.result,'success','candidate selection must succeed');
 const normal=mode==='core'?['normal']:['ecosystem-render','ecosystem-pptx','ecosystem-editor','ecosystem-core'];
 if(releasePrep){
  // RR-100: the merge queue's release-prep fast path (scripts/release-prep.mjs scope). The full lanes did not run: every one
  // must have been skipped (a lane that ran, or a missing result, is a workflow mistake and fails), never succeeded or failed
  // silently, and core mode needs its minimal job's success. A candidate qualification never takes this path.
  assert.equal(sha,'','a release-prep run selects no candidate gallery');
  for(const name of [...normal,'candidate','control'])assert.equal(results[name]?.result,'skipped',`${name} must be skipped on the release-prep fast path`);
  if(mode==='core')assert.equal(results['release-prep']?.result,'success','the release-prep version and changelog check must succeed');
  return;
 }
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
 requireQualification({mode:process.env.MODE,sha:process.env.CANDIDATE_SHA??'',results:JSON.parse(process.env.RESULTS),releasePrep:process.env.RELEASE_PREP==='true'});
 console.log('The selected complete qualification and its required control succeeded.');
}
