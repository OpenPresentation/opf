import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {gzipSync} from 'node:zlib';
const repo='C:/opf-work/ref-witness',source='a33d2bbc7e2e73c377b7483366d1886400d92835',folder=path.join(repo,'docs/handoff/2026-11-09/rr105-reference-witnesses');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),git=(...a)=>cp.execFileSync('git',['-C',repo,...a],{maxBuffer:4*1024*1024}),text=(...a)=>git(...a).toString('utf8').trim();
assert.equal(text('rev-parse','HEAD'),source);
const roots=[['checks','C:/opf-work/ref-witness-source-01'],['managed-initial-failed','C:/opf-work/ref-witness-managed-01'],['managed-pass','C:/opf-work/reference-managed-pmeScW/results']];
const entries=[];let total=0;
for(const[prefix,root]of roots){
 const top=path.resolve(root);
 const walk=directory=>{
  for(const name of fs.readdirSync(directory).sort()){
   const file=path.join(directory,name),stat=fs.lstatSync(file);
   assert.equal(stat.isSymbolicLink(),false);assert.ok(file.startsWith(top+path.sep));
   if(stat.isDirectory())walk(file);
   else{
    assert.ok(stat.isFile());assert.ok(stat.size<=16*1024*1024);assert.ok(entries.length<2000);
    const bytes=fs.readFileSync(file);total+=bytes.length;assert.ok(total<=64*1024*1024);
    const relative=path.relative(top,file).replaceAll(path.sep,'/');assert.ok(!relative.split('/').some(x=>x==='..'));
    entries.push({name:prefix+'/'+relative,size:bytes.length,sha256:sha(bytes),base64:bytes.toString('base64')});
   }
  }
 };
 walk(top);
}
const raw=Buffer.from(JSON.stringify({format:'rr105-reference-source-wip-v1',entries})+'\n'),archive=gzipSync(raw,{level:9,mtime:0});
fs.writeFileSync(path.join(folder,'raw.json.gz'),archive,{flag:'wx'});
const files=text('show','--pretty=format:','--name-only',source).split('\n').filter(Boolean).map(file=>{const bytes=git('show',source+':'+file);return{file,bytes:bytes.length,sha256:sha(bytes),blob:text('rev-parse',source+':'+file)};});
const originalSuite='C:/opf-work/n034-suite03/suite.json',originalSuiteSha256=sha(fs.readFileSync(originalSuite));assert.equal(originalSuiteSha256,'fd13b7725ea3b76717ec6976c9e12a7f6df9db5135818120cc026fa54c9c5d65');
const manifest={format:'rr105-reference-source-wip-v1',status:'INCOMPLETE_SOURCE_WIP',source,tree:text('rev-parse',source+'^{tree}'),base:'276f339a68069dc11970d649092d6181c9feba38',runGitRevision:'276f339a68069dc11970d649092d6181c9feba38',runSourceWasDirty:true,sourceFiles:files,
 originalSuite:{path:originalSuite,sha256:originalSuiteSha256,readOnlyVerification:true},
 originalProducerFiles:['scripts/native-acceptance/fixtures.mjs','scripts/native-acceptance/chart-modes.mjs','scripts/native-acceptance/generate.mjs','scripts/native-acceptance/prepare.mjs','scripts/native-acceptance/seven-chart-profile.mjs','scripts/native-acceptance/seven-chart-archive.mjs','scripts/native-acceptance/seven-chart-worker.ps1','scripts/native-acceptance/run-seven-chart-profile.ps1'].map(file=>{const before=text('rev-parse','276f339a68069dc11970d649092d6181c9feba38:'+file),after=text('rev-parse',source+':'+file);assert.equal(before,after);return{file,blob:after};}),
 raw:{file:'raw.json.gz',bytes:archive.length,sha256:sha(archive),expandedBytes:raw.length,members:entries.length,decodedBytes:total},entries:entries.map(({base64,...item})=>item),
 outcomes:{schemaAndSourceTests:{pass:5,fail:0},workerSourceTests:{pass:3,fail:0,managedCases:55},initialSchemaSetup:{pass:4,fail:1},initialManagedSetup:{pass:2,fail:1},packageBuild:false,currentConsumerGeneration:false,exportedShapeCounts:'UNMEASURED',nativeProfileAdmission:'NOT_IMPLEMENTED',officeInvoked:false,nativeAcceptance:false,registryAcceptance:false},
 limitation:'Fake executable/PPTX/PNG bytes are managed test fixtures only. Public profile/archive/generator/envelope/default-wrapper-positive controls remain owed. No original59/fd13/four-WHOLE mutation or native observation.'};
fs.writeFileSync(path.join(folder,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:manifest.status,records:entries.length,decodedBytes:total,archiveBytes:archive.length,source,officeInvoked:false}));
