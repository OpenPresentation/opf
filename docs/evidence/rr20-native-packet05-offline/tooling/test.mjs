import assert from 'node:assert/strict';import {readFile,writeFile,readdir,lstat,mkdtemp,cp,rm,symlink,rename} from 'node:fs/promises';import {spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';import {tmpdir} from 'node:os';import path from 'node:path';import {fileURLToPath} from 'node:url';
const args=process.argv.slice(2),packet=args[1],tools=path.dirname(fileURLToPath(import.meta.url)),hash=b=>createHash('sha256').update(b).digest('hex');
const invoke=(name,input=args)=>spawnSync(process.execPath,[path.join(tools,name+'.mjs'),...input],{encoding:'utf8',timeout:120000,maxBuffer:1048576});
async function snapshot(root){const result={};async function visit(dir){for(const name of await readdir(dir)){const file=path.join(dir,name),stat=await lstat(file);if(stat.isDirectory())await visit(file);else result[path.relative(root,file)]=hash(await readFile(file));}}await visit(root);return result;}
const before=await snapshot(packet);for(let i=0;i<2;i++){const r=invoke('inspect');assert.equal(r.status,0,r.stderr);assert.deepEqual(await snapshot(packet),before,'verifier mutated packet');}
const scratch=await mkdtemp(path.join(tmpdir(),'t31-packet-negative-'));const passed=['read-only verifier twice'];
try{
 for(const kind of ['duplicate','input-tamper','source-mismatch','extra-file','nested-symlink']){
  const copy=path.join(scratch,kind);await cp(packet,copy,{recursive:true});const testArgs=[...args];testArgs[1]=copy;
  if(kind==='duplicate'){
   const p=JSON.parse(await readFile(path.join(copy,'packet.json')));p.files.push(p.files[0]);await writeFile(path.join(copy,'packet.json'),JSON.stringify(p));const r=JSON.parse(await readFile(path.join(copy,'offline-result.json')));r.filesChecked=p.files.length;r.uniqueManifestPaths=p.files.length;await writeFile(path.join(copy,'offline-result.json'),JSON.stringify(r));await writeFile(path.join(copy,'seal.json'),JSON.stringify({packetSha256:hash(await readFile(path.join(copy,'packet.json'))),offlineResultSha256:hash(await readFile(path.join(copy,'offline-result.json')))}));
  }else if(kind==='input-tamper'){const file=path.join(copy,'inputs/layout-title-auto.pptx'),b=await readFile(file);b[0]^=1;await writeFile(file,b);
  }else if(kind==='source-mismatch'){const expected=JSON.parse(await readFile(args[4]));expected.artifacts[0].sourceSha='f'.repeat(40);const file=path.join(scratch,'wrong-expected.json');await writeFile(file,JSON.stringify(expected));testArgs[4]=file;
  }else if(kind==='extra-file'){await writeFile(path.join(copy,'unlisted.txt'),'unlisted');}else{const original=path.join(copy,'previews'),outside=path.join(scratch,'aliased-previews');await rename(original,outside);await symlink(outside,original,'dir');}
  const r=invoke('inspect',testArgs);assert.notEqual(r.status,0,`${kind} silently accepted`);const pattern={duplicate:/duplicate manifest path/, 'input-tamper':/AssertionError/,'source-mismatch':/sourceSha/,'nested-symlink':/symlink in packet path/,'extra-file':/manifest does not cover actual files/}[kind];assert.match(r.stderr,pattern);passed.push(kind);
 }
}finally{await rm(scratch,{recursive:true,force:true});}
assert.deepEqual(await snapshot(packet),before,'negative cases mutated original packet');console.log(JSON.stringify({passed,packetUnchanged:true}));
