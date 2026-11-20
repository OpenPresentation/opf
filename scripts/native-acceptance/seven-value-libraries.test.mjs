// SYNTHETIC installed-package trees exercise the actual identity collector.
// Their implementation entries must never execute; no native authority follows.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import test from 'node:test';

const here=path.dirname(fileURLToPath(import.meta.url)),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const put=(file,bytes)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);};
const writeJson=(file,value)=>put(file,JSON.stringify(value,null,2)+'\n');
async function owned(run){
 const root=fs.realpathSync(fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'opf-seven-library-')));let passed=false;
 try{
  for(const name of ['seven-value-libraries.mjs','identity.mjs'])fs.copyFileSync(path.join(here,name),path.join(root,name));
  writeJson(path.join(root,'package.json'),{name:'synthetic-library-controller',type:'module'});
  const sentinel=path.join(root,'implementation-executed');
  const pkg=(parent,name,{version='1.0.0',dependencies={},exports:exportMap={'.':{import:'./entry.mjs',require:'./entry.cjs'}},type='module'}={})=>{
   const directory=path.join(parent,'node_modules',...name.split('/'));
   writeJson(path.join(directory,'package.json'),{name,version,type,exports:exportMap,dependencies});
   put(path.join(directory,'entry.mjs'),`import fs from 'node:fs';fs.writeFileSync(${JSON.stringify(sentinel)},'unexpected');throw Error('Implementation must not execute');\n`);
   put(path.join(directory,'entry.cjs'),`require('node:fs').writeFileSync(${JSON.stringify(sentinel)},'unexpected');throw Error('Implementation must not execute');\n`);
   return directory;
  };
  const peer=pkg(root,'@openpresentation/opf-pptx'),parser=pkg(peer,'fast-xml-parser'),zip=pkg(peer,'fflate',{type:'commonjs',exports:{'.':{require:'./entry.cjs'}}});
  const {sevenValueLibraries:collect}=await import(pathToFileURL(path.join(root,'seven-value-libraries.mjs')));
  await run({root,peer,parser,zip,pkg,collect,sentinel});assert.equal(fs.existsSync(sentinel),false,'No fixture implementation may execute');passed=true;
 }finally{if(passed){assert(path.basename(root).startsWith('opf-seven-library-'));fs.rmSync(root,{recursive:true,force:true});}else console.error('Preserved SYNTHETIC library fixture: '+root);}
}
const manifest=directory=>path.join(directory,'package.json');
const update=(directory,change)=>{const value=JSON.parse(fs.readFileSync(manifest(directory)));change(value);writeJson(manifest(directory),value);};
const files=records=>records.flatMap(record=>record.files);
const sparse=(file,bytes)=>{const fd=fs.openSync(file,'w');try{fs.ftruncateSync(fd,bytes);}finally{fs.closeSync(fd);}};

test('actual collector inventories import-only, dual and CJS packages without exported metadata or code execution',()=>owned(async f=>{
 update(f.parser,value=>{value.dependencies={'fast-xml-builder':'1.3.1'};});
 const builder=f.pkg(f.parser,'fast-xml-builder',{version:'1.3.1',dependencies:{'xml-naming':'0.3.0'}}),xml=f.pkg(builder,'xml-naming',{version:'0.3.0',exports:{'.':{import:'./entry.mjs'}}});
 put(path.join(xml,'not-exported-data.txt'),'Complete package identity includes this file.');
 assert.throws(()=>createRequire(manifest(builder)).resolve('xml-naming'),error=>error.code==='ERR_PACKAGE_PATH_NOT_EXPORTED','This is the original require-entry defect, without importing code');
 assert.throws(()=>createRequire(manifest(f.peer)).resolve('fast-xml-parser/package.json'),error=>error.code==='ERR_PACKAGE_PATH_NOT_EXPORTED');
 assert.equal(fs.realpathSync(createRequire(manifest(f.peer)).resolve('fflate')),path.join(f.zip,'entry.cjs'));
 const records=f.collect();assert.deepEqual(records.map(record=>[record.name,record.version]).sort(),[['fast-xml-builder','1.3.1'],['fast-xml-parser','1.0.0'],['fflate','1.0.0'],['xml-naming','0.3.0']]);
 const record=records.find(record=>record.name==='xml-naming');assert.equal(record.directory,xml);assert(record.files.some(file=>file.path==='not-exported-data.txt'));assert(record.files.some(file=>file.path==='package.json'));
 for(const file of record.files){const bytes=fs.readFileSync(path.join(xml,file.path));assert.deepEqual({bytes:file.bytes,sha256:file.sha256},{bytes:bytes.length,sha256:hash(bytes)});}
}));

test('actual declaring manifests select nested versions and canonical cycles deduplicate',()=>owned(async f=>{
 update(f.parser,value=>{value.dependencies={shared:'1.0.0'};});update(f.zip,value=>{value.dependencies={shared:'2.0.0'};});
 const first=f.pkg(f.parser,'shared',{version:'1.0.0',dependencies:{'fast-xml-parser':'1.0.0'}}),second=f.pkg(f.zip,'shared',{version:'2.0.0'});
 const records=f.collect();assert.equal(records.length,4);assert.deepEqual(records.filter(record=>record.name==='shared').map(record=>[record.version,record.directory]).sort(),[['1.0.0',first],['2.0.0',second]]);assert.equal(records.filter(record=>record.name==='fast-xml-parser').length,1);
}));

test('missing local dependency refuses even when NODE_PATH offers a foreign package',()=>owned(async f=>{
 const name='missing-synthetic-rr105-library';update(f.parser,value=>{value.dependencies={[name]:'1.0.0'};});
 const globalRoot=path.join(f.root,'foreign-global'),foreign=f.pkg(globalRoot,name);
 put(path.join(f.root,'check.mjs'),`import {createRequire} from 'node:module';import {sevenValueLibraries} from './seven-value-libraries.mjs';const foreign=createRequire(import.meta.url).resolve(${JSON.stringify(name)});try{sevenValueLibraries();throw Error('Unexpected collector success');}catch(error){console.log(JSON.stringify({foreign,code:error.code}));if(error.code!=='ERR_MODULE_NOT_FOUND')process.exitCode=1;}\n`);
 const env={...process.env,NODE_PATH:path.join(globalRoot,'node_modules')};delete env.NODE_OPTIONS;
 const result=spawnSync(process.execPath,[path.join(f.root,'check.mjs')],{env,encoding:'utf8',timeout:5000});assert.ifError(result.error);assert.equal(result.status,0,result.stderr);assert.deepEqual(JSON.parse(result.stdout),{foreign:path.join(foreign,'entry.cjs'),code:'ERR_MODULE_NOT_FOUND'});
}));

test('wrong declared package names and package-internal aliases refuse',()=>owned(async f=>{
 update(f.parser,value=>{value.name='foreign-name';});assert.throws(()=>f.collect(),/Declared library manifest name differs/u);update(f.parser,value=>{value.name='fast-xml-parser';});
 const target=path.join(f.root,'foreign-owned');fs.mkdirSync(target);put(path.join(target,'data.txt'),'Not inside the selected library');fs.symlinkSync(target,path.join(f.parser,'alias'),process.platform==='win32'?'junction':'dir');assert.throws(()=>f.collect(),/Library file alias refused/u);
}));

test('fresh complete identities observe entry, nonexported-file and export-map tampering',()=>owned(async f=>{
 put(path.join(f.parser,'not-exported.txt'),'original');
 for(const [file,change]of [[path.join(f.parser,'entry.mjs'),()=>put(path.join(f.parser,'entry.mjs'),'throw Error("changed implementation");')],[path.join(f.parser,'not-exported.txt'),()=>put(path.join(f.parser,'not-exported.txt'),'changed')],[manifest(f.parser),()=>update(f.parser,value=>{value.exports={'.':{import:'./entry.mjs'}};})]]){
  const before=f.collect();change();const after=f.collect();assert.notDeepEqual(after,before,'The existing envelope equality guard must see the changed complete record');
  const actual=after.find(record=>record.directory===f.parser).files.find(record=>record.path===path.basename(file));assert.equal(actual.sha256,hash(fs.readFileSync(file)));assert.notEqual(actual.sha256,before.find(record=>record.directory===f.parser).files.find(record=>record.path===path.basename(file)).sha256);
 }
}));

test('existing 32-package and 1500-file bounds remain exact',async()=>{
 await owned(async f=>{
  update(f.parser,value=>{value.dependencies=Object.fromEntries(Array.from({length:30},(_,index)=>['bound-'+index,'1.0.0']));});for(let index=0;index<30;index++)f.pkg(f.parser,'bound-'+index);
  assert.equal(f.collect().length,32);f.pkg(f.parser,'bound-extra');update(f.parser,value=>{value.dependencies['bound-extra']='1.0.0';});assert.throws(()=>f.collect());
 });
 await owned(async f=>{
  const initial=files(f.collect()).length;for(let index=0;index<1500-initial;index++)put(path.join(f.parser,'file-'+index),'');assert.equal(files(f.collect()).length,1500);put(path.join(f.parser,'file-extra'),'');assert.throws(()=>f.collect());
 });
});

test('existing 4MiB per-file and 64MiB aggregate bounds remain exact',async()=>{
 await owned(async f=>{const file=path.join(f.parser,'bound.bin');sparse(file,4*1024*1024);assert(files(f.collect()).some(record=>record.path==='bound.bin'&&record.bytes===4*1024*1024));fs.appendFileSync(file,'x');assert.throws(()=>f.collect());});
 await owned(async f=>{
  let remaining=64*1024*1024-files(f.collect()).reduce((sum,record)=>sum+record.bytes,0),last;for(let index=0;remaining>0;index++){const size=Math.min(4*1024*1024,remaining);last=path.join(f.parser,'aggregate-'+index);sparse(last,size);remaining-=size;}
  assert.equal(files(f.collect()).reduce((sum,record)=>sum+record.bytes,0),64*1024*1024);fs.appendFileSync(last,'x');assert.throws(()=>f.collect());
 });
});
