// Identity only: resolve/read library files, never import their implementation.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileIdentity} from './identity.mjs';
export function sevenValueLibraries(){
 const local=createRequire(import.meta.url),peer=createRequire(local.resolve('@openpresentation/opf-pptx/package.json')),seen=new Map();let count=0,total=0;
 function visit(name,resolve){
  const entry=fs.realpathSync(resolve.resolve(name));let directory=path.dirname(entry),manifest;
  for(let depth=0;depth<12;depth++){
   const file=path.join(directory,'package.json');if(fs.existsSync(file)){const candidate=JSON.parse(fs.readFileSync(file,'utf8'));if(candidate.name===name){manifest=candidate;break;}}
   const parent=path.dirname(directory);assert.notEqual(parent,directory,'Library manifest missing');directory=parent;
  }
  assert.ok(manifest,'Bounded library manifest required');directory=fs.realpathSync(directory);if(seen.has(directory))return;
  assert.ok(seen.size<32);const record={name,version:manifest.version,directory,files:[]};seen.set(directory,record);
  function walk(relative){
   const file=path.join(directory,relative),stat=fs.lstatSync(file);assert.equal(stat.isSymbolicLink(),false,'Library file alias refused');
   if(stat.isDirectory()){for(const child of fs.readdirSync(file).sort()){if(child==='node_modules'||child==='.git')continue;walk(path.join(relative,child));}}
   else{assert.ok(stat.isFile()&&stat.size<=4*1024*1024);assert.ok(++count<=1500);total+=stat.size;assert.ok(total<=64*1024*1024);record.files.push({path:relative.split(path.sep).join('/'),...fileIdentity(file)});}
  }walk('');
  const nested=createRequire(path.join(directory,'package.json'));for(const dependency of Object.keys(manifest.dependencies??{}).sort())visit(dependency,nested);
 }
 visit('fast-xml-parser',peer);visit('fflate',peer);return[...seen.values()].sort((a,b)=>a.directory.localeCompare(b.directory));
}
