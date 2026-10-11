import {publishedGalleryControl,optionalRegularJson} from './candidate-gallery.mjs';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,symlinkSync,rmSync,readFileSync,realpathSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {tmpdir} from 'node:os';
import test from 'node:test';
import {candidateGalleryTrailer,galleryConfiguration,resolveCandidateGallery,linkCandidateGallery,readRegularJson} from './candidate-gallery.mjs';
import {pullRequestOfEvent} from './ecosystem-lock.mjs';
const sha='a'.repeat(40),manifest={opf:{requiresUnreleasedGallery:'2.0.0'}},configuration={version:1,gallery:{repository:'OpenPresentation/gallery',sha,version:'2.0.0'}};
const candidate=galleryConfiguration(manifest,configuration);
test('default source selection is unchanged and no candidate input may fall back',async()=>{
 assert.equal(await resolveCandidateGallery({manifest:{},event:'push'}),null);
 await assert.rejects(resolveCandidateGallery({manifest:{},event:'workflow_dispatch',input:sha}),/reviewed source/);
 for(const config of [null,{...configuration,gallery:{...configuration.gallery,sha:'main'}},{...configuration,extra:true}])assert.throws(()=>galleryConfiguration(manifest,config));
});
test('exact source authorization survives the merge queue and refuses mismatches or unreadable bodies',async()=>{
 const root=mkdtempSync(path.join(tmpdir(),'gallery-queue-'));try{
  const file=path.join(root,'event.json');writeFileSync(file,JSON.stringify({merge_group:{head_ref:`refs/heads/gh-readonly-queue/main/pr-42-${sha}`}}));
  const pullRequest=pullRequestOfEvent({GITHUB_EVENT_NAME:'merge_group',GITHUB_EVENT_PATH:file,GITHUB_REPOSITORY:'OpenPresentation/opf'});
  assert.equal(pullRequest.number,42);
  const args={manifest,configuration,event:'merge_group',pullRequest,eventRepository:'OpenPresentation/opf'};
  assert.deepEqual(await resolveCandidateGallery({...args,api:async()=>({body:`Candidate-Gallery: OpenPresentation/gallery@${sha}`})}),candidate);
  for(const body of ['',`Candidate-Gallery: OpenPresentation/gallery@${'b'.repeat(40)}`,'Candidate-Gallery: OpenPresentation/gallery@main'])await assert.rejects(resolveCandidateGallery({...args,api:async()=>({body})}));
  await assert.rejects(resolveCandidateGallery({...args,api:async()=>{throw Error('unreadable current body');}}),/unreadable/);
  await assert.rejects(resolveCandidateGallery({...args,pullRequest:{...pullRequest,repository:'Other/opf'},api:async()=>({body:`Candidate-Gallery: OpenPresentation/gallery@${sha}`})}),/CI event/);
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('manual, release and other events cannot substitute candidate data',async()=>{
 assert.deepEqual(await resolveCandidateGallery({manifest,configuration,event:'workflow_dispatch',input:sha}),candidate);
 for(const event of ['push','schedule','pull_request_target'])await assert.rejects(resolveCandidateGallery({manifest,configuration,event,input:sha}));
 await assert.rejects(resolveCandidateGallery({manifest,configuration,event:'workflow_dispatch',input:sha,ref:'refs/tags/opf-v0.19.0'}),/release tags/);
 await assert.rejects(resolveCandidateGallery({manifest,configuration,event:'workflow_dispatch',input:'b'.repeat(40)}),/reviewed source/);
 assert.equal(candidateGalleryTrailer(`\`\`\`\nCandidate-Gallery: OpenPresentation/gallery@${sha}\n\`\`\``),undefined);
 assert.throws(()=>candidateGalleryTrailer(`Candidate-Gallery: OpenPresentation/gallery@${sha}\nCandidate-Gallery: OpenPresentation/gallery@${'b'.repeat(40)}`),/conflicting/);
});
test('source linking verifies actual immutable package identity and preserves metadata',()=>{
 const root=realpathSync(mkdtempSync(path.join(tmpdir(),'gallery-link-'))),gallery=path.join(root,'gallery'),consumer=path.join(root,'core');
 const run=(...args)=>execFileSync('git',['-C',gallery,...args],{encoding:'utf8',env:{...process.env,GIT_AUTHOR_NAME:'Test',GIT_AUTHOR_EMAIL:'test@example.com',GIT_COMMITTER_NAME:'Test',GIT_COMMITTER_EMAIL:'test@example.com'}}).trim();
 try{
  mkdirSync(path.join(gallery,'dist'),{recursive:true});mkdirSync(consumer);
  writeFileSync(path.join(gallery,'package.json'),JSON.stringify({name:'@openpresentation/gallery',version:'2.0.0',opf:{catalogSchema:2}}));writeFileSync(path.join(gallery,'package-lock.json'),'{}');writeFileSync(path.join(gallery,'dist/index.js'),'export {};');
  writeFileSync(path.join(gallery,'.gitignore'),'dist/\n');
  run('init','-q');run('add','-A');run('commit','-qm','candidate');const exact={...candidate,sha:run('rev-parse','HEAD')};
  assert.throws(()=>linkCandidateGallery({gallery,candidate,consumers:[consumer]}),/reviewed SHA/);
  const before=readFileSync(path.join(gallery,'package.json'));const result=linkCandidateGallery({gallery,candidate:exact,consumers:[consumer]});assert.match(result.qualification,/source-only/);assert.deepEqual(readFileSync(path.join(gallery,'package.json')),before);
  writeFileSync(path.join(gallery,'untracked-script.mjs'),'export {};');assert.throws(()=>linkCandidateGallery({gallery,candidate:exact,consumers:[consumer]}),/untracked/);rmSync(path.join(gallery,'untracked-script.mjs'));
  const bad=path.join(gallery,'dist/dangling');symlinkSync(path.join(root,'missing'),bad);assert.throws(()=>linkCandidateGallery({gallery,candidate:exact,consumers:[consumer]}),/symlink/);rmSync(bad);
  writeFileSync(path.join(gallery,'package.json'),'{}');assert.throws(()=>linkCandidateGallery({gallery,candidate:exact,consumers:[consumer]}),/modified/);
  const alias=path.join(root,'alias.json');symlinkSync(path.join(gallery,'package-lock.json'),alias);assert.throws(()=>readRegularJson(alias),/aliased/);
  const dangling=path.join(root,'candidate-gallery.json');symlinkSync(path.join(root,'missing.json'),dangling);assert.throws(()=>optionalRegularJson(dangling),/ENOENT/);
  assert.equal(optionalRegularJson(path.join(root,'absent.json')),undefined);
 }finally{rmSync(root,{recursive:true,force:true});}
});


test('pristine published control binds every immutable source to actual registry metadata', async()=>{
 const plan={packages:['opf','opf-render','opf-pptx','opf-editor','cli'].map(name=>({name:`@openpresentation/${name}`,version:'0.18.1'})),verificationRefs:Object.fromEntries(['opf','opf-render','opf-pptx','opf-editor','cli'].map(name=>[name,'a'.repeat(40)]))};
 plan.independentPackages=[{name:'@openpresentation/gallery',version:'0.18.1'}];
 const registry=async(name,version)=>({name,version:version==='latest'?'0.18.1':version,gitHead:'a'.repeat(40)});
 assert.deepEqual(await publishedGalleryControl(plan,registry),plan.verificationRefs);
 await assert.rejects(publishedGalleryControl(plan,async(name,version)=>({name,version:version==='latest'?'0.18.1':version,gitHead:'b'.repeat(40)})),/registry gitHead/);
 await assert.rejects(publishedGalleryControl(plan,async(name,version)=>({name,version:version==='latest'?'0.18.2':version,gitHead:'a'.repeat(40)})),/current reviewed stable/);
 await assert.rejects(publishedGalleryControl({...plan,verificationRefs:{}},registry),/immutable/);
 await assert.rejects(publishedGalleryControl(plan,async()=>{throw Error('registry unavailable');}),/registry unavailable/);
});
