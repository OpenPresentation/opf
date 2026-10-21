import {publishedGalleryControl,resolvePublishedControl,publishedControlFloor,optionalRegularJson,assertPublishedGallery} from './candidate-gallery.mjs';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,symlinkSync,rmSync,readFileSync,realpathSync,lstatSync} from 'node:fs';
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
  const bad=path.join(gallery,'dist/dangling');symlinkSync(path.join(root,'missing'),bad,process.platform==='win32'?'junction':undefined);assert.ok(lstatSync(bad).isSymbolicLink());assert.throws(()=>linkCandidateGallery({gallery,candidate:exact,consumers:[consumer]}),/symlink/);rmSync(bad);
  writeFileSync(path.join(gallery,'package.json'),'{}');assert.throws(()=>linkCandidateGallery({gallery,candidate:exact,consumers:[consumer]}),/modified/);
  // Windows junctions alias the parent while the JSON leaf remains a real regular file.
  const aliasDirectory=path.join(root,'alias');
  const alias=process.platform==='win32'?path.join(aliasDirectory,'package-lock.json'):path.join(root,'alias.json');
  if(process.platform==='win32'){symlinkSync(gallery,aliasDirectory,'junction');assert.ok(lstatSync(alias).isFile());assert.equal(readFileSync(alias,'utf8'),readFileSync(path.join(gallery,'package-lock.json'),'utf8'));}
  else symlinkSync(path.join(gallery,'package-lock.json'),alias);
  assert.throws(()=>readRegularJson(alias),/aliased/);
  const dangling=path.join(root,'candidate-gallery.json');symlinkSync(path.join(root,'missing.json'),dangling,process.platform==='win32'?'junction':undefined);assert.ok(lstatSync(dangling).isSymbolicLink());assert.throws(()=>optionalRegularJson(dangling),/ENOENT/);
  assert.equal(optionalRegularJson(path.join(root,'absent.json')),undefined);
 }finally{rmSync(root,{recursive:true,force:true});}
});


test('pristine published control binds every immutable source to actual registry metadata', async()=>{
 const plan={packages:['opf','opf-render','opf-pptx','opf-editor','cli'].map(name=>({name:`@openpresentation/${name}`,version:'0.18.1'})),verificationRefs:Object.fromEntries(['opf','opf-render','opf-pptx','opf-editor','cli'].map(name=>[name,'a'.repeat(40)]))};
 plan.independentPackages=[{name:'@openpresentation/gallery',version:'0.18.1'}];
 const registry=async(name,version)=>({name,version:version==='latest'?'0.18.1':version,gitHead:'a'.repeat(40)});
 assert.deepEqual(await publishedGalleryControl(plan,registry),plan.verificationRefs);
 await assert.rejects(publishedGalleryControl(plan,async(name,version)=>({name,version:version==='latest'?'0.18.1':version,gitHead:'b'.repeat(40)})),/registry gitHead/);
 await assert.rejects(publishedGalleryControl(plan,async(name,version)=>({name,version:version==='latest'?'0.19.0':version,gitHead:'a'.repeat(40)})),/current reviewed stable/);
 await assert.rejects(publishedGalleryControl({...plan,verificationRefs:{}},registry),/immutable/);
 await assert.rejects(publishedGalleryControl(plan,async()=>{throw Error('registry unavailable');}),/registry unavailable/);
});


// RR-101: the plan is a floor. A newer patch release must not block every candidate-gallery pull request until the plan is refreshed by hand.
const packageNames=['opf','opf-render','opf-pptx','opf-editor','cli'];
const floorPlan=()=>({
 packages:packageNames.map(name=>({name:`@openpresentation/${name}`,version:'0.18.1'})),
 independentPackages:[{name:'@openpresentation/gallery',version:'4.0.0',repository:'OpenPresentation/gallery'}],
 exampleRefs:{'opf-editor':'c'.repeat(40)},
 verificationRefs:{...Object.fromEntries(packageNames.map(name=>[name,'a'.repeat(40)])),gallery:'d'.repeat(40)}
});
// Registry whose `latest` is `latest[name]` (default: the plan's version) and whose exact versions carry the plan gitHead or `newer`'s.
const floorRegistry=({latest={},heads={},overrides={}}={})=>async(name,version)=>{
 const short=name.split('/')[1],resolved=version==='latest'?latest[short]??(short==='gallery'?'4.0.0':'0.18.1'):version;
 return {name,version:resolved,gitHead:heads[`${short}@${resolved}`]??'a'.repeat(40),...(overrides[`${short}@${version}`]??{})};
};
test('a newer patch release is accepted and resolved with its own gitHead (RR-101)',async()=>{
 const plan=floorPlan(),before=structuredClone(plan),notices=[];
 const result=await resolvePublishedControl(plan,floorRegistry({latest:{'opf-render':'0.18.4',cli:'0.18.2'},heads:{'opf-render@0.18.4':'b'.repeat(40),'cli@0.18.2':'e'.repeat(40)}}),message=>notices.push(message));
 assert.deepEqual(plan,before,'the reviewed plan object is not mutated');
 assert.equal(result.refs['opf-render'],'b'.repeat(40));assert.equal(result.refs.cli,'e'.repeat(40));assert.equal(result.refs.opf,'a'.repeat(40));
 assert.deepEqual(Object.keys(result.refs).sort(),['cli','opf','opf-editor','opf-pptx','opf-render']);
 const version=name=>result.plan.packages.find(item=>item.name===`@openpresentation/${name}`).version;
 assert.equal(version('opf-render'),'0.18.4');assert.equal(version('cli'),'0.18.2');assert.equal(version('opf'),'0.18.1');
 assert.equal(result.plan.verificationRefs['opf-render'],'b'.repeat(40));assert.equal(result.plan.verificationRefs.gallery,'d'.repeat(40));
 assert.deepEqual(result.plan.exampleRefs,plan.exampleRefs);assert.equal(result.plan.independentPackages[0].repository,'OpenPresentation/gallery');
 assert.deepEqual(notices,['::notice::plan is behind registry: @openpresentation/opf-render 0.18.1 -> 0.18.4','::notice::plan is behind registry: @openpresentation/cli 0.18.1 -> 0.18.2']);
 // publishedGalleryControl keeps returning just the refs.
 assert.deepEqual(await publishedGalleryControl(plan,floorRegistry({latest:{'opf-render':'0.18.4'},heads:{'opf-render@0.18.4':'b'.repeat(40)}})),Object.fromEntries(packageNames.map(name=>[name,name==='opf-render'?'b'.repeat(40):'a'.repeat(40)])));
 // Plan equal to the registry stays strict and prints no notice.
 notices.length=0;const same=await resolvePublishedControl(plan,floorRegistry(),message=>notices.push(message));
 assert.deepEqual(same.plan,plan);assert.deepEqual(notices,[]);
});
test('the gallery accepts a newer minor or patch of its own major, and a package does not accept a newer minor (RR-101)',async()=>{
 const plan=floorPlan();
 for(const latest of ['4.0.1','4.1.0','4.3.7']){
  const result=await resolvePublishedControl(plan,floorRegistry({latest:{gallery:latest},heads:{[`gallery@${latest}`]:'f'.repeat(40)}}),()=>{});
  assert.equal(result.plan.independentPackages[0].version,latest);assert.equal(result.plan.verificationRefs.gallery,'f'.repeat(40));
 }
 for(const latest of ['5.0.0','3.9.9'])await assert.rejects(resolvePublishedControl(plan,floorRegistry({latest:{gallery:latest}}),()=>{}),/current reviewed stable/);
 await assert.rejects(resolvePublishedControl(plan,floorRegistry({latest:{gallery:'4.0.1'},heads:{'gallery@4.0.1':'xyz'}}),()=>{}),/gitHead/);
 const floor=(plan,latest,independent)=>publishedControlFloor(plan,latest,{independent});
 assert.equal(floor('0.24.2','0.24.2'),true);assert.equal(floor('0.24.2','0.24.10'),true);
 for(const latest of ['0.24.1','0.25.0','1.24.2','0.24.3-next.1','0.24','latest',undefined])assert.equal(floor('0.24.2',latest),false);
 assert.equal(floor('4.1.2','4.2.0',true),true);assert.equal(floor('4.1.2','4.1.1',true),false);assert.equal(floor('4.1.2','4.0.9',true),false);
});
test('a newer minor, major, lower or prerelease latest, or a bad newer gitHead or name or version, fails (RR-101)',async()=>{
 const plan=floorPlan(),good={'opf-pptx@0.18.2':'b'.repeat(40)};
 await resolvePublishedControl(plan,floorRegistry({latest:{'opf-pptx':'0.18.2'},heads:good}),()=>{});
 for(const latest of ['0.19.0','1.0.0','0.18.0','0.18.2-next.0'])await assert.rejects(resolvePublishedControl(plan,floorRegistry({latest:{'opf-pptx':latest},heads:good}),()=>{}),/current reviewed stable/,latest);
 for(const gitHead of [undefined,'','b'.repeat(39),'B'.repeat(40),'g'.repeat(40),'b'.repeat(41),'main'])await assert.rejects(resolvePublishedControl(plan,floorRegistry({latest:{'opf-pptx':'0.18.2'},overrides:{'opf-pptx@0.18.2':{gitHead}}}),()=>{}),/gitHead/,String(gitHead));
 await assert.rejects(resolvePublishedControl(plan,floorRegistry({latest:{'opf-pptx':'0.18.2'},heads:good,overrides:{'opf-pptx@0.18.2':{name:'@openpresentation/other'}}}),()=>{}));
 await assert.rejects(resolvePublishedControl(plan,floorRegistry({latest:{'opf-pptx':'0.18.2'},heads:good,overrides:{'opf-pptx@0.18.2':{version:'0.18.3'}}}),()=>{}));
 // A newer release never excuses a stale plan ref: when latest equals the plan, the registry gitHead must still equal verificationRefs.
 await assert.rejects(resolvePublishedControl(plan,floorRegistry({heads:{'opf@0.18.1':'b'.repeat(40)}}),()=>{}),/registry gitHead/);
});


test('explicit contract4 configuration stages Gallery 5 (FA-33) and refuses the earlier contracts',async()=>{
 const manifest={opf:{requiresUnreleasedGallery:'5.0.0'}};
 const configuration={version:3,gallery:{repository:'OpenPresentation/gallery',version:'5.0.0',catalogSchema:4,sha}};
 const selected=galleryConfiguration(manifest,configuration);
 assert.deepEqual(selected,{...configuration.gallery});
 assert.deepEqual(await resolveCandidateGallery({manifest,configuration,event:'workflow_dispatch',input:sha}),selected);
 for(const changed of [undefined,2,3,5,'4'])assert.throws(()=>galleryConfiguration(manifest,{...configuration,gallery:{...configuration.gallery,catalogSchema:changed}}));
 for(const version of [1,2,4])assert.throws(()=>galleryConfiguration(manifest,{...configuration,version}));
 assert.throws(()=>galleryConfiguration({opf:{requiresUnreleasedGallery:'3.0.0'}},configuration));
 assert.throws(()=>galleryConfiguration(manifest,{version:2,gallery:{...configuration.gallery,version:'3.0.0',catalogSchema:3}}));
 assert.throws(()=>assertPublishedGallery(manifest,configuration),/unresolved/);
});

test('explicit contract3 configuration preserves immutable authorization and release refusals',async()=>{
 const manifest={opf:{requiresUnreleasedGallery:'3.0.0'}};
 const configuration={version:2,gallery:{repository:'OpenPresentation/gallery',version:'3.0.0',catalogSchema:3,sha}};
 const selected=galleryConfiguration(manifest,configuration);
 assert.deepEqual(selected,{...configuration.gallery});
 assert.deepEqual(await resolveCandidateGallery({manifest,configuration,event:'workflow_dispatch',input:sha}),selected);
 for(const changed of [undefined,2,4,'3'])assert.throws(()=>galleryConfiguration(manifest,{...configuration,gallery:{...configuration.gallery,catalogSchema:changed}}));
 for(const changed of ['main','b'.repeat(39),''])assert.throws(()=>galleryConfiguration(manifest,{...configuration,gallery:{...configuration.gallery,sha:changed}}));
 assert.throws(()=>galleryConfiguration({opf:{requiresUnreleasedGallery:'2.0.0'}},configuration));
 assert.throws(()=>galleryConfiguration(manifest,{...configuration,version:1}));
 assert.throws(()=>galleryConfiguration(manifest,{...configuration,extra:true}));
 await assert.rejects(resolveCandidateGallery({manifest,configuration,event:'workflow_dispatch',input:sha,ref:'refs/tags/opf-v0.20.0'}),/release tags/);
 for(const event of ['push','schedule','pull_request_target'])await assert.rejects(resolveCandidateGallery({manifest,configuration,event,input:sha}));
 assert.throws(()=>assertPublishedGallery(manifest,configuration),/unresolved/);
});
