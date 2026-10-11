import assert from 'node:assert/strict';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {mkdirSync,mkdtempSync,realpathSync,writeFileSync,readFileSync,rmSync,existsSync} from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {globalPrefixLayout} from './global-prefix.mjs';
import {stagedManifest,stageGalleryGraph,candidateArtifacts,assertInstalledCandidateGraph} from './candidate-gallery-pack.mjs';
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

test('real six-package tarballs bind source, staged manifests, installed bytes and one gallery',()=>{
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
   writeFileSync(path.join(directory,'package.json'),JSON.stringify({name:`@openpresentation/${names[index]}`,version:index===5?'2.0.0':'0.19.0-next.0',type:'module',exports:{'.':'./dist/index.js','./package.json':'./package.json'},files:['dist'],...(index===4?{bin:{rr78:'dist/index.js'},peerDependencies:{'@openpresentation/opf-render':'^0.18.0'},peerDependenciesMeta:{'@openpresentation/opf-render':{optional:true}}}:{}),...(index!==5?{dependencies:index===4?{'@openpresentation/opf':'^0.18.0'}:{'@openpresentation/gallery':'^1.0.0',...(index>0?{'@openpresentation/opf':'^0.18.0'}:{})}}:{opf:{catalogSchema:2}}),...(index===0?{opf:{requiresUnreleasedGallery:'2.0.0'}}:{})},null,2)+'\n');
  }
  writeFileSync(path.join(roots[4],'package-lock.json'),'{}\n');
  const gallerySha=commit(roots[4]);
  mkdirSync(path.join(root,'.github'));writeFileSync(path.join(root,'.github/candidate-gallery.json'),JSON.stringify({version:1,gallery:{repository:'OpenPresentation/gallery',version:'2.0.0',sha:gallerySha}}));
  writeFileSync(path.join(root,'.gitignore'),'artifacts/\n');
  for(const directory of roots.slice(0,4))commit(directory);
  delete process.env.CANDIDATE_GALLERY_REF;assert.throws(()=>candidateArtifacts(root),/no published fallback/);
  process.env.CANDIDATE_GALLERY_REF=gallerySha;
  const out=path.join(root,'artifacts/npm'),report=stageGalleryGraph({coreRoot:root,workspace,out,run});
  assert.equal(report.artifacts.length,6);assert.equal(report.published,false);
  assert.deepEqual(candidateArtifacts(root),report);
  const consumer=path.join(workspace,'consumer');mkdirSync(consumer);writeFileSync(path.join(consumer,'package.json'),JSON.stringify({private:true,dependencies:Object.fromEntries(report.artifacts.map(item=>[item.name,`file:${path.join(out,item.file)}`]))}));
  run('npm',['install','--offline','--cache',path.join(workspace,'cache'),'--ignore-scripts','--no-audit','--no-fund'],consumer);
  assertInstalledCandidateGraph(root,consumer);
  const global=globalPrefixLayout(path.join(workspace,'global'));
  const standalone=report.artifacts.filter(item=>['@openpresentation/cli','@openpresentation/opf','@openpresentation/gallery'].includes(item.name)).map(item=>path.join(out,item.file));
  run('npm',['install','--global','--prefix',global.prefix,'--offline','--cache',path.join(workspace,'cache'),'--ignore-scripts','--no-audit','--no-fund',...standalone],workspace);
  assert.equal(existsSync(path.join(global.modules,'@openpresentation/opf-render')),false,'optional renderer must remain absent');
  const output=JSON.parse(run(process.execPath,[path.join(global.modules,'@openpresentation/cli/dist/index.js')],workspace));
  assert.equal(output.core,path.join(global.modules,'@openpresentation/opf/package.json'));assert.equal(output.gallery,path.join(global.modules,'@openpresentation/gallery/package.json'));
  const executed=JSON.parse(run('npm',['exec','--offline','--cache',path.join(workspace,'cache'),...standalone.map(file=>`--package=${file}`),'--','rr78'],workspace));
  assert.ok(executed.core.includes(`${path.sep}_npx${path.sep}`));assert.ok(!executed.core.startsWith(global.modules+path.sep),'npm exec must not borrow global install');
  const installed=path.join(consumer,'node_modules/@openpresentation/opf/dist/index.js');
  writeFileSync(installed,'changed\n');assert.throws(()=>assertInstalledCandidateGraph(root,consumer),/installed runtime differs/);
  const file=path.join(out,report.artifacts[0].file),original=readFileSync(file);writeFileSync(file,'tampered');
  assert.throws(()=>candidateArtifacts(root),/tarball digest mismatch/);writeFileSync(file,original);
  const manifestFile=path.join(out,'manifest.json'),bytes=readFileSync(manifestFile);const altered=structuredClone(report);altered.artifacts[0].sourceSha='f'.repeat(40);writeFileSync(manifestFile,JSON.stringify(altered));
  assert.throws(()=>candidateArtifacts(root),/source SHA mismatch/);writeFileSync(manifestFile,bytes);
  const staged=path.join(out,'staging/opf/package.json');writeFileSync(staged,'{}');assert.throws(()=>candidateArtifacts(root),/staging metadata differs/);
 }finally{if(previous===undefined)delete process.env.CANDIDATE_GALLERY_REF;else process.env.CANDIDATE_GALLERY_REF=previous;rmSync(workspace,{recursive:true,force:true});}
});
