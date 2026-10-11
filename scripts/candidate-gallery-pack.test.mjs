import assert from 'node:assert/strict';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {mkdirSync,mkdtempSync,realpathSync,writeFileSync,readFileSync,rmSync,existsSync,symlinkSync,cpSync} from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {globalPrefixLayout} from './global-prefix.mjs';
import {stagedManifest,stageGalleryGraph,candidateArtifacts,candidatePeerPreflight,assertCandidatePeerPreflight,assertInstalledCandidateGraph,assertInstalledCandidatePeers,assertCandidateExecInstalls} from './candidate-gallery-pack.mjs';
import {preparePackedSmokeCli} from './pack-cli-candidate.mjs';
import {assertPublishedGallery} from './candidate-gallery.mjs';
test('explicit staged metadata keeps source versions and records only candidate dependency relationships',()=>{
 const original={name:'@openpresentation/opf',version:'0.19.0-dev.0',dependencies:{'@openpresentation/gallery':'^1.0.0',other:'^3.0.0'},peerDependencies:{'@openpresentation/opf-render':'^0.18.0'},scripts:{build:'never execute'},devDependencies:{typescript:'5'},opf:{requiresUnreleasedGallery:'2.0.0',other:true}};
 const before=structuredClone(original);
 assert.deepEqual(stagedManifest(original,{'@openpresentation/gallery':'2.0.0','@openpresentation/opf-render':'0.19.0-dev.0'}),{name:original.name,version:original.version,dependencies:{'@openpresentation/gallery':'2.0.0',other:'^3.0.0'},peerDependencies:{'@openpresentation/opf-render':'^0.19.0-dev.0'},opf:{other:true}});
 assert.deepEqual(original,before,'original package metadata must remain unchanged');
 assert.throws(()=>assertPublishedGallery(original),/unresolved/);
 assert.doesNotThrow(()=>assertPublishedGallery({name:'@openpresentation/opf',version:'0.19.0',dependencies:{'@openpresentation/gallery':'^2.0.0'}}));
 assert.throws(()=>assertPublishedGallery({name:'@openpresentation/opf',version:'0.19.0-next.0',dependencies:{'@openpresentation/gallery':'^1.0.0'}}),/actual gallery \^2/);
 assert.doesNotThrow(()=>assertPublishedGallery({name:'@openpresentation/opf',version:'0.18.3',dependencies:{'@openpresentation/gallery':'^1.0.0'}}));
 assert.throws(()=>assertPublishedGallery({}, {version:1}),/unresolved/);
 for(const present of [null,false,0]){assert.throws(()=>assertPublishedGallery({},present),/unresolved/);assert.throws(()=>assertPublishedGallery({opf:{requiresUnreleasedGallery:present}}),/unresolved/);}
});

test('real six-package tarballs bind source, staged manifests, installed bytes and one gallery',async()=>{
 const workspace=realpathSync(mkdtempSync(path.join(tmpdir(),'rr78-tarballs-'))),root=path.join(workspace,'opf');
 const previous=process.env.CANDIDATE_GALLERY_REF;
 const run=(command,args,cwd)=>execFileSync(command,args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']});
 const init=directory=>{mkdirSync(directory,{recursive:true});run('git',['init','-q'],directory);run('git',['config','user.name','fixture'],directory);run('git',['config','user.email','fixture@example.invalid'],directory);};
 const commit=directory=>{run('git',['add','.'],directory);run('git',['commit','-qm','fixture'],directory);return run('git',['rev-parse','HEAD'],directory).trim();};
 const roots=[root,...['opf-render','opf-pptx','opf-editor','gallery-candidate'].map(name=>path.join(workspace,name))];
 const names=['opf','opf-render','opf-pptx','opf-editor','cli','gallery'];
 try{
  for(const directory of roots)init(directory);
  const directories=[path.join(root,'packages/javascript'),roots[1],roots[2],roots[3],path.join(root,'packages/cli'),roots[4]];
  for(const [index,directory] of directories.entries()){
   mkdirSync(path.join(directory,'dist'),{recursive:true});
   writeFileSync(path.join(directory,'dist/index.js'),index===4?`#!/usr/bin/env node\nimport {createRequire} from 'node:module';const require=createRequire(import.meta.url);console.log(JSON.stringify({core:require.resolve('@openpresentation/opf/package.json'),gallery:require.resolve('@openpresentation/gallery/package.json')}));\n`:'export const fixture = true;\n');
   for(const file of ['README.md','LICENSE'])writeFileSync(path.join(directory,file),'fixture\n');
   writeFileSync(path.join(directory,'package.json'),JSON.stringify({name:`@openpresentation/${names[index]}`,version:index===5?'2.0.0':(index===1||index===2?'0.18.2':'0.19.0-next.0'),type:'module',exports:{'.':'./dist/index.js','./package.json':'./package.json'},files:['dist'],...(index===4?{bin:{rr78:'dist/index.js'}}:{}),...([0,4].includes(index)?{peerDependencies:{'@openpresentation/opf-render':'^0.19.0','@openpresentation/opf-pptx':'^0.19.0'},peerDependenciesMeta:{'@openpresentation/opf-render':{optional:true},'@openpresentation/opf-pptx':{optional:true}}}:{}),...(index!==5?{dependencies:index===4?{'@openpresentation/opf':'^0.18.0'}:{'@openpresentation/gallery':'^1.0.0',...(index>0?{'@openpresentation/opf':'^0.18.0'}:{})}}:{opf:{catalogSchema:2}}),...(index===0?{opf:{requiresUnreleasedGallery:'2.0.0'}}:{})},null,2)+'\n');
  }
  writeFileSync(path.join(roots[4],'package-lock.json'),'{}\n');
  const gallerySha=commit(roots[4]);
  mkdirSync(path.join(root,'.github'));writeFileSync(path.join(root,'.github/candidate-gallery.json'),JSON.stringify({version:1,gallery:{repository:'OpenPresentation/gallery',version:'2.0.0',sha:gallerySha}}));
  writeFileSync(path.join(root,'.gitignore'),'artifacts/\npackages/*/dist/\n');
  for(const directory of roots.slice(0,4))commit(directory);
  delete process.env.CANDIDATE_GALLERY_REF;assert.throws(()=>candidateArtifacts(root),/no published fallback/);
  process.env.CANDIDATE_GALLERY_REF=gallerySha;
  const out=path.join(root,'artifacts/npm'),report=stageGalleryGraph({coreRoot:root,workspace,out,run});
  assert.equal(report.artifacts.length,6);assert.equal(report.published,false);
  assert.deepEqual(candidateArtifacts(root),report);
  assert.equal(assertCandidatePeerPreflight(root).run,true,'mixed source versions qualify exact staged relationships, not original stable semver');
  assert.equal(candidatePeerPreflight(root,()=>assert.fail('candidate must not invoke default source gate')).run,true);
  for(const name of ['@openpresentation/opf','@openpresentation/cli']){
   const item=report.artifacts.find(record=>record.name===name);
   assert.equal(item.originalManifest.peerDependencies['@openpresentation/opf-render'],'^0.19.0');
   assert.equal(item.stagedManifest.peerDependencies['@openpresentation/opf-render'],'^0.18.2');
  }
  delete process.env.CANDIDATE_GALLERY_REF;assert.throws(()=>assertCandidatePeerPreflight(root),/no published fallback/);process.env.CANDIDATE_GALLERY_REF=gallerySha;
  const preflightManifest=path.join(out,'manifest.json'),preflightBytes=readFileSync(preflightManifest),wrongPeer=structuredClone(report);
  const wrongVersion=structuredClone(report);wrongVersion.artifacts.find(item=>item.name==='@openpresentation/opf-render').version='0.19.0';writeFileSync(preflightManifest,JSON.stringify(wrongVersion));assert.throws(()=>candidatePeerPreflight(root,()=>assert.fail('invalid candidate must not fall back')),/version differs from original source/);writeFileSync(preflightManifest,preflightBytes);
  const wrongSourceVersion=structuredClone(report);wrongSourceVersion.artifacts.find(item=>item.name==='@openpresentation/opf-render').sourceVersion='0.19.0';writeFileSync(preflightManifest,JSON.stringify(wrongSourceVersion));assert.throws(()=>assertCandidatePeerPreflight(root),/sourceVersion differs/);writeFileSync(preflightManifest,preflightBytes);
  wrongPeer.artifacts.find(item=>item.name==='@openpresentation/cli').stagedManifest.peerDependencies['@openpresentation/opf-render']='^0.19.0';
  writeFileSync(preflightManifest,JSON.stringify(wrongPeer));assert.throws(()=>assertCandidatePeerPreflight(root),/staging metadata differs/);writeFileSync(preflightManifest,preflightBytes);

  const qualifiedDist=path.join(root,'packages/javascript/dist/index.js'),qualifiedBytes=readFileSync(qualifiedDist);
  const rebuild=()=>execFileSync(process.execPath,['-e',`require('node:fs').writeFileSync(${JSON.stringify(qualifiedDist)},'ordinary rebuild')`]);
  assert.deepEqual(await preparePackedSmokeCli({root,build:rebuild}),report);
  assert.deepEqual(readFileSync(qualifiedDist),qualifiedBytes,'candidate smoke must not rebuild validated dist');
  writeFileSync(qualifiedDist,'unqualified runtime');
  await assert.rejects(preparePackedSmokeCli({root,build:rebuild}),/runtime differs from built source/);
  assert.equal(readFileSync(qualifiedDist,'utf8'),'unqualified runtime','invalid candidate must fail before build');
  writeFileSync(qualifiedDist,qualifiedBytes);

  const consumer=path.join(workspace,'consumer');mkdirSync(consumer);writeFileSync(path.join(consumer,'package.json'),JSON.stringify({private:true,dependencies:Object.fromEntries(report.artifacts.map(item=>[item.name,`file:${path.join(out,item.file)}`]))}));
  run('npm',['install','--offline','--cache',path.join(workspace,'cache'),'--ignore-scripts','--no-audit','--no-fund'],consumer);
  assertInstalledCandidateGraph(root,consumer);
  const global=globalPrefixLayout(path.join(workspace,'global'));
  const standalone=report.artifacts.filter(item=>['@openpresentation/cli','@openpresentation/opf','@openpresentation/gallery'].includes(item.name)).map(item=>path.join(out,item.file));
  run('npm',['install','--global','--prefix',global.prefix,'--offline','--cache',path.join(workspace,'cache'),'--ignore-scripts','--no-audit','--no-fund',...standalone],workspace);
  assert.equal(existsSync(path.join(global.modules,'@openpresentation/opf-render')),false,'optional renderer must remain absent');
  assertInstalledCandidatePeers(root,global.modules,['@openpresentation/cli'],'0.19.0-next.0');
  const globalGallery=path.join(global.modules,'@openpresentation/gallery/dist/index.js'),globalGalleryBytes=readFileSync(globalGallery);
  writeFileSync(globalGallery,'tampered gallery');assert.throws(()=>assertInstalledCandidatePeers(root,global.modules,['@openpresentation/cli'],'0.19.0-next.0'),/peer runtime differs/);writeFileSync(globalGallery,globalGalleryBytes);
  const output=JSON.parse(run(process.execPath,[path.join(global.modules,'@openpresentation/cli/dist/index.js')],workspace));
  assert.equal(output.core,path.join(global.modules,'@openpresentation/opf/package.json'));assert.equal(output.gallery,path.join(global.modules,'@openpresentation/gallery/package.json'));
  const executed=JSON.parse(run('npm',['exec','--offline','--cache',path.join(workspace,'cache'),...standalone.map(file=>`--package=${file}`),'--','rr78'],workspace));
  assert.ok(executed.core.includes(`${path.sep}_npx${path.sep}`));assert.ok(!executed.core.startsWith(global.modules+path.sep),'npm exec must not borrow global install');
  assert.equal(assertCandidateExecInstalls(root,path.join(workspace,'cache'),[]),1);
  const modules=path.join(consumer,'node_modules'),peerNames=['@openpresentation/opf-render','@openpresentation/opf-pptx'];
  assert.equal(assertInstalledCandidatePeers(root,modules,peerNames,'0.19.0-next.0').run,true);
  const modulesAlias=path.join(workspace,'global-modules-alias');symlinkSync(modules,modulesAlias,process.platform==='win32'?'junction':'dir');
  assert.equal(assertInstalledCandidatePeers(root,modulesAlias,peerNames,'0.19.0-next.0').run,true,'canonical global root supports system tmpdir aliases');
  assert.throws(()=>assertInstalledCandidatePeers(root,modules,peerNames,'0.18.3'),/core version differs/);
  const nestedGallery=path.join(modules,peerNames[0],'node_modules/@openpresentation/gallery');mkdirSync(path.dirname(nestedGallery),{recursive:true});cpSync(path.join(modules,'@openpresentation/gallery'),nestedGallery,{recursive:true});
  assert.throws(()=>assertInstalledCandidatePeers(root,modules,peerNames,'0.19.0-next.0'),/different gallery/);rmSync(nestedGallery,{recursive:true,force:true});
  const peerManifest=path.join(modules,peerNames[0],'package.json'),peerBytes=readFileSync(peerManifest);
  writeFileSync(peerManifest,JSON.stringify({...JSON.parse(peerBytes),dependencies:{'@openpresentation/opf':'file:/unreviewed.tgz'}}));
  assert.throws(()=>assertInstalledCandidatePeers(root,modules,peerNames,'0.19.0-next.0'),/peer metadata differs/);writeFileSync(peerManifest,peerBytes);
  const installed=path.join(consumer,'node_modules/@openpresentation/opf/dist/index.js');
  writeFileSync(installed,'changed\n');assert.throws(()=>assertInstalledCandidatePeers(root,modules,peerNames,'0.19.0-next.0'),/peer runtime differs/);assert.throws(()=>assertInstalledCandidateGraph(root,consumer),/installed runtime differs/);
  const file=path.join(out,report.artifacts[0].file),original=readFileSync(file);writeFileSync(file,'tampered');
  assert.throws(()=>candidateArtifacts(root),/tarball digest mismatch/);assert.throws(()=>assertCandidatePeerPreflight(root),/tarball digest mismatch/);writeFileSync(file,original);
  const manifestFile=path.join(out,'manifest.json'),bytes=readFileSync(manifestFile);const altered=structuredClone(report);altered.artifacts[0].sourceSha='f'.repeat(40);writeFileSync(manifestFile,JSON.stringify(altered));
  assert.throws(()=>candidateArtifacts(root),/source SHA mismatch/);writeFileSync(manifestFile,bytes);
  const built=path.join(root,'packages/javascript/dist/index.js'),builtBytes=readFileSync(built);
  writeFileSync(built,'rebuilt after qualification\n');assert.throws(()=>candidateArtifacts(root),/runtime differs from built source/);writeFileSync(built,builtBytes);
  const staged=path.join(out,'staging/opf/package.json');writeFileSync(staged,'{}');assert.throws(()=>candidateArtifacts(root),/staging metadata differs/);
 }finally{if(previous===undefined)delete process.env.CANDIDATE_GALLERY_REF;else process.env.CANDIDATE_GALLERY_REF=previous;rmSync(workspace,{recursive:true,force:true});}
});

test('ordinary packed smoke still builds the CLI',async()=>{
 const root=realpathSync(mkdtempSync(path.join(tmpdir(),'rr78-smoke-build-')));
 const previous=process.env.CANDIDATE_GALLERY_REF;
 try {
  delete process.env.CANDIDATE_GALLERY_REF;
  mkdirSync(path.join(root,'packages/javascript'),{recursive:true});
  writeFileSync(path.join(root,'packages/javascript/package.json'),JSON.stringify({name:'@openpresentation/opf',version:'0.18.3'}));
  const marker=path.join(root,'built');
  assert.equal(await preparePackedSmokeCli({root,build:()=>execFileSync(process.execPath,['-e',`require('node:fs').writeFileSync(${JSON.stringify(marker)},'built')`])}),null);
  assert.equal(readFileSync(marker,'utf8'),'built');
  const waiting={run:false,notice:'unchanged ordinary wait'};let calls=0;assert.equal(candidatePeerPreflight(root,()=>{calls++;return waiting;}),waiting);assert.equal(calls,1,'actual preflight entry preserves the ordinary gate result');
 } finally {if(previous===undefined)delete process.env.CANDIDATE_GALLERY_REF;else process.env.CANDIDATE_GALLERY_REF=previous;rmSync(root,{recursive:true,force:true});}
});
