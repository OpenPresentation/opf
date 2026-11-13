// Real filesystem boundary controls only. These inert records are NOT source/native admission.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {assertSnapshotOutput,verifySnapshotExecution,SNAPSHOT_ENTRIES,SNAPSHOT_FILES} from './seven-value-snapshot-profile.mjs';
import {digest,fileIdentity} from './identity.mjs';
import {VALUE_FILES} from './seven-value-profile.mjs';
function owned(check){
 const root=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'opf-snapshot-output-'));let passed=false;
 try{
  const names=['suiteDirectory','preparationRepository','workerRepository','consumer','controller'],roots=Object.fromEntries(names.map(name=>{const directory=path.join(root,name);fs.mkdirSync(directory);return[name,directory];})),base={generation:Object.fromEntries(names.slice(0,4).map(name=>[name,roots[name]])),controllerRepository:{directory:roots.controller}},output=path.join(root,'attempt'),external=path.join(root,'envelope.json');
  fs.mkdirSync(output);fs.writeFileSync(external,'{}\n',{flag:'wx'});const internal=path.join(output,'execution-envelope.json');fs.copyFileSync(external,internal,fs.constants.COPYFILE_EXCL);
  check({root,base,output,external,internal,roots});passed=true;
 }finally{if(passed)fs.rmSync(root,{recursive:true});else console.error('Preserved snapshot boundary failure: '+root);}
}
test('snapshot verifier permits its exact copied canonical envelope and still permits an external sibling envelope',()=>owned(f=>{
 const before=[fileIdentity(f.external),fileIdentity(f.internal)];assert.equal(assertSnapshotOutput(f.output,f.base,f.internal),f.output);assert.equal(assertSnapshotOutput(f.output,f.base,f.external),f.output);
 const sibling=path.join(f.root,'attempt-sibling');fs.mkdirSync(sibling);const file=path.join(sibling,'execution-envelope.json');fs.copyFileSync(f.external,file,fs.constants.COPYFILE_EXCL);assert.equal(assertSnapshotOutput(f.output,f.base,file),f.output);assert.deepEqual([fileIdentity(f.external),fileIdentity(f.internal)],before);
}));
for(const relative of ['other-envelope.json','inputs/execution-envelope.json','execution-envelope.json.backup'])test('snapshot output refuses unexpected contained envelope '+relative,()=>owned(f=>{
 const file=path.join(f.output,relative);fs.mkdirSync(path.dirname(file),{recursive:true});fs.copyFileSync(f.external,file,fs.constants.COPYFILE_EXCL);assert.throws(()=>assertSnapshotOutput(f.output,f.base,file),/Output overlaps immutable/u);
}));
test('external envelope equality and ancestor overlap remain refused independently of source roots',()=>owned(f=>{
 assert.throws(()=>assertSnapshotOutput(f.external,f.base,f.external),/Output overlaps immutable/u);
 const folder=path.join(f.root,'external-envelopes');fs.mkdirSync(folder);const file=path.join(folder,'envelope.json');fs.copyFileSync(f.external,file,fs.constants.COPYFILE_EXCL);assert.throws(()=>assertSnapshotOutput(folder,f.base,file),/Output overlaps immutable/u);
}));
test('an output below an external regular envelope file remains impossible or overlap-refused',()=>owned(f=>{
 assert.throws(()=>assertSnapshotOutput(path.join(f.external,'child'),f.base,f.external),error=>error.code==='ENOTDIR'||/Output overlaps immutable/u.test(error.message));
}));
for(const name of ['suiteDirectory','preparationRepository','workerRepository','consumer','controller'])for(const relation of ['equal','descendant','ancestor'])test('internal envelope cannot bypass '+name+' '+relation+' protection',()=>owned(f=>{
 const base=structuredClone(f.base),protectedRoot=f.roots[name];let output;
 if(relation==='equal')output=protectedRoot;
 else if(relation==='descendant'){output=path.join(protectedRoot,'attempt');fs.mkdirSync(output);}
 else{output=f.output;const nested=path.join(output,'protected');fs.mkdirSync(nested);if(name==='controller')base.controllerRepository.directory=nested;else base.generation[name]=nested;}
 const internal=path.join(output,'execution-envelope.json');if(!fs.existsSync(internal))fs.copyFileSync(f.external,internal,fs.constants.COPYFILE_EXCL);
 assert.throws(()=>assertSnapshotOutput(output,base,internal),/Output overlaps immutable/u);
}));
test('output and copied-envelope directory aliases remain refused',()=>owned(f=>{
 const link=path.join(f.root,'attempt-alias');fs.symlinkSync(f.output,link,process.platform==='win32'?'junction':'dir');assert.throws(()=>assertSnapshotOutput(link,f.base,path.join(link,'execution-envelope.json')),/Reparse|symlink|Aliased|Noncanonical/u);assert.throws(()=>assertSnapshotOutput(f.output,f.base,path.join(link,'execution-envelope.json')),/Aliased|Noncanonical/u);
}));
test('canonical exact-name exception is not a source-authority or digest bypass',()=>owned(f=>{
 assert.equal(assertSnapshotOutput(f.output,f.base,f.internal),f.output);const bytes=fs.readFileSync(f.internal);
 assert.throws(()=>verifySnapshotExecution(f.internal,'0'.repeat(64),f.output,false));assert.throws(()=>verifySnapshotExecution(f.internal,digest(bytes),f.output,false),'Inert boundary JSON must fail the actual unmodified source-envelope admission');fs.appendFileSync(f.internal,' ');assert.throws(()=>verifySnapshotExecution(f.internal,digest(bytes),f.output,false));
}));

// Portable exact source-roster parity, not execution of the PowerShell bootstrap.
const bootstrapSource=()=>fs.readFileSync(new URL('./seven-value-snapshot-bootstrap.ps1',import.meta.url),'utf8');
function assertBootstrapEntries(source){
 const assignments=[...source.matchAll(/^\s*\$extra=@\(([^\r\n]*)\) \| ForEach-Object \{'scripts\/native-acceptance\/'\+\$_\}\r?$/gmu)];assert.equal(assignments.length,1,'One exact literal snapshot roster required');
 const names=assignments[0][1].split(',').map(value=>{assert.match(value,/^'[a-z0-9-]+(?:\.test)?\.(?:mjs|ps1)'$/u,'Only literal source filenames are admitted');return 'scripts/native-acceptance/'+value.slice(1,-1);});
 assert.equal(new Set(names).size,names.length,'No duplicate PowerShell source entry');assert.deepEqual(names,SNAPSHOT_ENTRIES,'PowerShell additions must match actual Node source entries exactly');
 assert.equal(new Set([...VALUE_FILES,...names]).size,VALUE_FILES.length+names.length,'Existing source closure and additions must not overlap');assert.deepEqual([...VALUE_FILES,...names].sort(),SNAPSHOT_FILES,'The entire Node closure must equal the exact PowerShell required roster');return names;
}
test('snapshot PowerShell source roster exactly matches Node additions and complete source closure',()=>{assertBootstrapEntries(bootstrapSource());});
const alterOnce=(source,old,value)=>{assert.equal(source.split(old).length,2);return source.replace(old,value);};
for(const [name,mutate]of Object.entries({
 'missing new test':s=>alterOnce(s,",'seven-value-snapshot-output.test.mjs'",''),
 'duplicate entry':s=>alterOnce(s,"'seven-value-snapshot-output.test.mjs'","'seven-value-snapshot-output.test.mjs','seven-value-snapshot-output.test.mjs'"),
 'foreign entry':s=>alterOnce(s,"'seven-value-snapshot-output.test.mjs'","'foreign-snapshot.test.mjs'"),
 'computed entry':s=>alterOnce(s,"'seven-value-snapshot-output.test.mjs'","'seven-value-snapshot-output.test.mjs'+$env:UNTRUSTED"),
 'duplicate assignment':s=>s+'\n'+s.split('\n').find(line=>line.includes('$extra=@('))+'\n',
 'missing assignment':s=>alterOnce(s,'$extra=@(','$other=@('),
}))test('snapshot roster parity refuses '+name,()=>{const source=mutate(bootstrapSource());assert.throws(()=>assertBootstrapEntries(source));});
