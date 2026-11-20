// Identity only: resolve/read library files, never import their implementation.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {findPackageJSON} from 'node:module';
import {fileIdentity} from './identity.mjs';
export function sevenValueLibraries(){
 // This locates installed metadata, not an executable entry. Export conditions
 // and entry loading stay separate; every export map is hashed with its package.
 function locate(name,declaringManifest){
  const file=findPackageJSON(name,declaringManifest);assert.ok(file,'Library manifest missing');
  const stat=fs.lstatSync(file);assert.equal(stat.isSymbolicLink(),false,'Library file alias refused');assert.ok(stat.isFile()&&stat.size<=4*1024*1024);
  const manifest=JSON.parse(fs.readFileSync(file,'utf8'));assert.equal(manifest.name,name,'Declared library manifest name differs');
  const directory=fs.realpathSync(path.dirname(file)),anchor=path.join(directory,'package.json');assert.equal(fs.realpathSync(file),anchor,'Library manifest ownership differs');
  return {directory,anchor,manifest};
 }
 const peer=locate('@openpresentation/opf-pptx',import.meta.url),seen=new Map();let count=0,total=0;
 function visit(name,declaringManifest){
  const {directory,anchor,manifest}=locate(name,declaringManifest);
  if(seen.has(directory))return;
  assert.ok(seen.size<32);const record={name,version:manifest.version,directory,files:[]};seen.set(directory,record);
  function walk(relative){
   const file=path.join(directory,relative),stat=fs.lstatSync(file);assert.equal(stat.isSymbolicLink(),false,'Library file alias refused');
   if(stat.isDirectory()){for(const child of fs.readdirSync(file).sort()){if(child==='node_modules'||child==='.git')continue;walk(path.join(relative,child));}}
   else{assert.ok(stat.isFile()&&stat.size<=4*1024*1024);assert.ok(++count<=1500);total+=stat.size;assert.ok(total<=64*1024*1024);record.files.push({path:relative.split(path.sep).join('/'),...fileIdentity(file)});}
  }walk('');
  for(const dependency of Object.keys(manifest.dependencies??{}).sort())visit(dependency,anchor);
 }
 visit('fast-xml-parser',peer.anchor);visit('fflate',peer.anchor);return[...seen.values()].sort((a,b)=>a.directory.localeCompare(b.directory));
}
