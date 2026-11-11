// Pure caller-admission controls, no build/browser/GC/Office or mutable maintained fixture.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {fileRecord,verifyFiles} from './bindings.mjs';
import {assertFontCacheOwnershipSource} from './font-cache-diagnostics.mjs';

const sites=['workspace actual-owner getter root','workspace actual-owner getter session'];
const ownerPath='packages/editor/src/workspace.js';
const getters=['root','session'].map(name=>`    get ${name}() {\n      return ${name};\n    },`);
const source='const workspace = {\n'+getters.join('\n')+'\n};\n';
const identity=record=>({path:record.path,bytes:record.bytes,sha256:record.sha256});
function owned(run){
 const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'opf-owner-admission-'))),file=path.join(root,ownerPath);
 fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,source,{flag:'wx'});
 try{run({root,file,record:{...fileRecord(root,file),sites:[...sites]}});}finally{fs.rmSync(root,{recursive:true,force:true});}
}
test('actual maintained workspace: ownership sites are checked separately from the exact three-field identity',()=>{
 const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../..'),record={...fileRecord(root,ownerPath),sites:[...sites]};
 assertFontCacheOwnershipSource(root,record);assert.throws(()=>verifyFiles(root,[record]),/Bound file changed/u);
 assert.deepEqual(Object.keys(identity(record)).sort(),['bytes','path','sha256']);verifyFiles(root,[identity(record)]);
});
test('test-owned valid record admits sites metadata while the generic verifier remains strict',()=>owned(({root,record})=>{
 assertFontCacheOwnershipSource(root,record);assert.throws(()=>verifyFiles(root,[record]),/Bound file changed/u);verifyFiles(root,[identity(record)]);
 assert.throws(()=>assertFontCacheOwnershipSource(root,{...record,extra:true}),/ownership source\/site record differs/u);
}));
test('changed path, length, hash or recorded sites refuse without modifying the source',()=>owned(({root,record})=>{
 for(const change of [r=>r.path='different.js',r=>r.bytes++,r=>r.sha256='0'.repeat(64),r=>r.sites=[],r=>r.sites.reverse(),r=>r.sites.push('another site'),r=>r.sites[0]='workspace actual-owner getter clone',r=>r.sites='root/session']){
  const mutant=structuredClone(record);change(mutant);assert.throws(()=>assertFontCacheOwnershipSource(root,mutant),/ownership source\/site record differs/u);
 }
 verifyFiles(root,[identity(record)]);
}));
test('changed file with stale original identity refuses through both maintained checks',()=>owned(({root,file,record})=>{
 fs.appendFileSync(file,'// owned mutation\n');assert.throws(()=>assertFontCacheOwnershipSource(root,record),/ownership source\/site record differs/u);assert.throws(()=>verifyFiles(root,[identity(record)]),/Bound file changed/u);
}));
test('fresh matching file identity cannot waive missing, duplicate or clone/snapshot getters',()=>owned(({root,file})=>{
 for(const changed of [source.replace(getters[0],''),source+'\n'+getters[1],source.replace('return root;','return {};'),source.replace('return session;','return structuredClone(session);')]){
  fs.writeFileSync(file,changed);const record={...fileRecord(root,file),sites:[...sites]};
  verifyFiles(root,[identity(record)]);assert.throws(()=>assertFontCacheOwnershipSource(root,record),/Expected exactly one diagnostic source site/u);
 }
}));
