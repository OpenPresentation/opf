#!/usr/bin/env node
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import './archive.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../../../../..');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const list=()=>readdirSync(here,{withFileTypes:true}).filter(f=>f.isFile()&&f.name!=='packet-files.json').map(f=>{const bytes=readFileSync(path.join(here,f.name));return{file:f.name,bytes:bytes.length,sha256:sha(bytes)};}).sort((a,b)=>a.file.localeCompare(b.file,'en'));
const receipt=JSON.parse(readFileSync(path.join(here,'receipt.json'),'utf8'));
assert.equal(receipt.requiredCheck.exitCode,0);assert.equal(receipt.nativeAcceptance,false);assert.equal(receipt.preparationSeal,true);assert.equal(receipt.originalInitialAggregate,'RED retained; exact sparse-only text recovery PASS');
if(process.argv.includes('--seal-recovery'))writeFileSync(path.join(here,'packet-files.json'),JSON.stringify({source:'2400d38bf549cdb661c31725776df25e497d364c',packageSource:'b623a3674037f29d68496e96a3f5b6da55d73470',files:list()},null,2)+'\n',{flag:'wx'});
const packet=JSON.parse(readFileSync(path.join(here,'packet-files.json'),'utf8'));assert.equal(packet.source,'2400d38bf549cdb661c31725776df25e497d364c');assert.deepEqual(packet.files,list());
const changed=execFileSync('git',['diff','--name-only','5975b8bda8dd471783ffd2b68ea97790008de19f'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean);
for(const file of changed)assert.ok(file.startsWith('docs/handoff/2026-11-09/native-output-archives-b623/recovery-suite03/')||file==='docs/evidence/native-current-b623-20261109/generic-recovery-delta.zip',`Initial evidence changed: ${file}`);
console.log(JSON.stringify({result:'PASS',newMetadataFiles:packet.files.length+1,newMetadataBytes:packet.files.reduce((n,f)=>n+f.bytes,0),resultGroups:4,logicalFiles:804,logicalBytes:111955685,zipMembers:523,zipBytes:41172020,originalThreeArchivesAndMetadataUnchanged:true,preparationSeal:true,nativeAcceptance:false,nativeStatus:'pending'}));
