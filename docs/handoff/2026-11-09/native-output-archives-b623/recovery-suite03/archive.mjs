#!/usr/bin/env node
// Reconstruct exact producer output bytes by existing-member references plus one bounded delta archive.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import '../verify.mjs';
import {sha256,inventory,makeZip,verifyZip,relativeSafe} from './archive-format.mjs';
const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(HERE,'../../../../..');
const PRODUCER='2400d38bf549cdb661c31725776df25e497d364c';
const PACKAGE_SOURCE='b623a3674037f29d68496e96a3f5b6da55d73470';
const ORIGINAL='C:/opf-work/n034-suite03';
const DELTA='docs/evidence/native-current-b623-20261109/generic-recovery-delta.zip';
const manifestPath=path.join(HERE,'manifest.json');
const {BUNDLED_FONT_MANIFEST}=await import(pathToFileURL(path.join(ROOT,'packages/render/src/font-manifest.js')).href);
const robotoPins=BUNDLED_FONT_MANIFEST.packages.filter(p=>p.name==='@expo-google-fonts/roboto');assert.equal(robotoPins.length,1);
const roboto=robotoPins[0];assert.equal(roboto.version,'0.4.3');assert.equal(roboto.license,'OFL-1.1');assert.equal(roboto.faces.length,7);
const fontPaths=new Set([...roboto.faces.map(f=>'fonts/roboto/'+f.file),'fonts/roboto/LICENSE']);
const oldManifest=JSON.parse(readFileSync(path.join(HERE,'../manifest.json'),'utf8'));
const object=ref=>execFileSync('git',['rev-parse',ref],{cwd:ROOT,encoding:'utf8'}).trim();
const archiveMaps=new Map();
const pool=new Map();
for(const archive of oldManifest.archives){
 const bytes=readFileSync(path.join(ROOT,archive.archivePath));assert.equal(bytes.length,archive.bytes);assert.equal(sha256(bytes),archive.sha256);
 archiveMaps.set(archive.archivePath,verifyZip(bytes,archive.files));
 for(const file of archive.files){const key=`${file.bytes}:${file.sha256}`;if(!pool.has(key))pool.set(key,{archivePath:archive.archivePath,member:file.path});}
}
if(process.argv.includes('--create-recovery')){
 assert.ok(!existsSync(manifestPath)&&!existsSync(path.join(ROOT,DELTA)),'Fresh recovery archive paths required');
 const originals=inventory(ORIGINAL,fontPaths);assert.equal(originals.length,340);assert.equal(originals.reduce((n,f)=>n+f.bytes,0),49552300);
 const auditBytes=readFileSync('C:/opf-work/n034-fix-evidence-01/recovery-inventory.json');
 const audit=JSON.parse(auditBytes);assert.equal(audit.source,PRODUCER);assert.equal(audit.packageSource,PACKAGE_SOURCE);assert.equal(audit.nativeAcceptance,false);assert.equal(audit.workerExecution,false);
 assert.equal(audit.files.length,340);const auditFiles=new Map(audit.files.map(f=>[f.path,f]));
 for(const file of originals){const match=auditFiles.get(file.path);assert.ok(match);assert.equal(match.bytes,file.bytes);assert.equal(match.sha256,file.sha256);}
 const deltaFiles=originals.filter(f=>!pool.has(`${f.bytes}:${f.sha256}`));assert.equal(deltaFiles.length,59);assert.equal(deltaFiles.reduce((n,f)=>n+f.bytes,0),4112797);
 const zip=makeZip(ORIGINAL,deltaFiles);verifyZip(zip,deltaFiles);writeFileSync(path.join(ROOT,DELTA),zip,{flag:'wx'});
 const files=originals.map(file=>({...file,storage:pool.get(`${file.bytes}:${file.sha256}`)??{archivePath:DELTA,member:file.path}}));
 assert.deepEqual(inventory(ORIGINAL,fontPaths),originals,'Producer output changed during archival');
 writeFileSync(path.join(HERE,'producer-recovery-inventory.json'),auditBytes,{flag:'wx'});
 const manifest={schema:1,publication:'PUBLIC-SAFE evidence-only NEVER MERGE',source:PRODUCER,packageSource:PACKAGE_SOURCE,sourceRoot:ORIGINAL,nativeAcceptance:false,nativeStatus:'pending',preparationStatus:'Fresh generic prepare completed and sealed; original partial historical failure remains unchanged',expectedCases:59,logicalFiles:340,logicalBytes:49552300,reusedFiles:281,reusedBytes:45439503,delta:{archivePath:DELTA,bytes:zip.length,sha256:sha256(zip),files:deltaFiles},producerInventory:{file:'producer-recovery-inventory.json',bytes:auditBytes.length,sha256:sha256(auditBytes)},verifierFiles:['archive.mjs','archive-format.mjs'].map(file=>({file,sha256:sha256(readFileSync(path.join(HERE,file)))})),files};
 writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
}
const manifest=JSON.parse(readFileSync(manifestPath,'utf8'));
assert.equal(manifest.source,PRODUCER);assert.equal(manifest.packageSource,PACKAGE_SOURCE);assert.equal(manifest.nativeAcceptance,false);assert.equal(manifest.nativeStatus,'pending');
for(const file of manifest.verifierFiles){relativeSafe(file.file);assert.equal(sha256(readFileSync(path.join(HERE,file.file))),file.sha256);}
const auditBytes=readFileSync(path.join(HERE,manifest.producerInventory.file));assert.equal(auditBytes.length,manifest.producerInventory.bytes);assert.equal(sha256(auditBytes),manifest.producerInventory.sha256);
const audit=JSON.parse(auditBytes);assert.equal(audit.source,PRODUCER);assert.equal(audit.packageSource,PACKAGE_SOURCE);assert.equal(audit.nativeAcceptance,false);assert.equal(audit.workerExecution,false);assert.equal(audit.workerLimitsUnchanged,true);
for(const entry of audit.protectedObjects){assert.equal(entry.current,entry.baseline);assert.equal(object(`${PRODUCER}:${entry.path}`),entry.current);assert.equal(object(`${PACKAGE_SOURCE}:${entry.path}`),entry.baseline);}
assert.equal(audit.protectedObjects.length,9);
const deltaBytes=readFileSync(path.join(ROOT,DELTA));assert.equal(deltaBytes.length,manifest.delta.bytes);assert.equal(sha256(deltaBytes),manifest.delta.sha256);assert.equal(manifest.delta.archivePath,DELTA);assert.equal(manifest.delta.files.length,59);
archiveMaps.set(DELTA,verifyZip(deltaBytes,manifest.delta.files));
const reconstructed=new Map();let reused=0,rawBytes=0,reusedBytes=0;
for(const file of manifest.files){
 relativeSafe(file.path);assert.ok(!reconstructed.has(file.path));const map=archiveMaps.get(file.storage.archivePath);assert.ok(map);const bytes=map.get(file.storage.member);assert.ok(bytes);assert.equal(bytes.length,file.bytes);assert.equal(sha256(bytes),file.sha256);reconstructed.set(file.path,bytes);rawBytes+=bytes.length;
 if(file.storage.archivePath!==DELTA){reused++;reusedBytes+=bytes.length;}
}
assert.equal(reconstructed.size,340);assert.equal(rawBytes,49552300);assert.equal(manifest.logicalFiles,340);assert.equal(manifest.logicalBytes,rawBytes);assert.equal(reused,281);assert.equal(reusedBytes,45439503);assert.equal(manifest.reusedFiles,reused);assert.equal(manifest.reusedBytes,reusedBytes);
assert.equal(audit.files.length,reconstructed.size);for(const file of audit.files){const bytes=reconstructed.get(file.path);assert.ok(bytes);assert.equal(bytes.length,file.bytes);assert.equal(sha256(bytes),file.sha256);}
const suiteBytes=reconstructed.get('suite.json');assert.ok(suiteBytes);assert.equal(suiteBytes.length,551804);assert.equal(sha256(suiteBytes),'fd13b7725ea3b76717ec6976c9e12a7f6df9db5135818120cc026fa54c9c5d65');
const suite=JSON.parse(suiteBytes);assert.equal(suite.schemaVersion,1);assert.equal(suite.nativeAcceptance,false);assert.equal(suite.nativeStatus,'pending');
const font=suite.fontInventory;for(const key of ['name','version','pack','source','license','licenseFile','licenseSha256'])assert.equal(font[key],roboto[key]);
assert.equal(font.actualLicenseVerified,true);assert.equal(font.actualFaceHashesVerified,true);assert.equal(font.registeredByAgent,false);assert.equal(font.transferredFaces.length,7);
for(const face of roboto.faces){const file='fonts/roboto/'+face.file;assert.equal(sha256(reconstructed.get(file)),face.sha256);const transfer=font.transferredFaces.find(f=>f.file===file);assert.ok(transfer);assert.equal(transfer.sha256,face.sha256);assert.equal(transfer.bytes,reconstructed.get(file).length);}
assert.equal(font.transferredLicense.file,'fonts/roboto/LICENSE');assert.equal(font.transferredLicense.sha256,roboto.licenseSha256);assert.equal(sha256(reconstructed.get('fonts/roboto/LICENSE')),roboto.licenseSha256);assert.match(reconstructed.get('fonts/roboto/LICENSE').toString('utf8'),/SIL OPEN FONT LICENSE/i);
assert.equal(suite.cases.length,59);assert.equal(new Set(suite.cases.map(c=>c.id)).size,59);assert.equal(suite.files.length,339);
assert.deepEqual(suite.cases.map(c=>c.id),audit.cases.map(c=>c.id));for(const file of suite.files){const bytes=reconstructed.get(file.path);assert.ok(bytes);assert.equal(bytes.length,file.bytes);assert.equal(sha256(bytes),file.sha256);}
assert.equal(audit.genericStructurallyEligible,53);assert.equal(audit.ineligible.length,6);
if(process.argv.includes('--originals'))assert.deepEqual(inventory(ORIGINAL,fontPaths),manifest.files.map(({storage,...file})=>file));
console.log(JSON.stringify({result:'PASS',source:PRODUCER,packageSource:PACKAGE_SOURCE,cases:59,logicalFiles:340,logicalBytes:rawBytes,reusedFiles:reused,reusedBytes,deltaFiles:59,deltaBytes:deltaBytes.length,allOutputRootsLogicalFiles:804,allOutputRootsRawBytes:111955685,allOutputZipBytes:oldManifest.totalZipBytes+deltaBytes.length,originalsVerified:process.argv.includes('--originals'),preparationSeal:true,nativeAcceptance:false,nativeStatus:'pending',originalPartialFailure:'PRESERVED unchanged'}));
