import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {gzipSync} from 'node:zlib';
const root='C:/opf-work/ref-native',folder=path.join(root,'docs/handoff/2026-11-09/mcp-main-alignment'),qualification='C:/opf-work/main-align-qualification-01';
const source='1c7ae946cc8f93d7c5cc0da74a523cadd178ecaa',main='a52dc9441f7eec9dc6f72debb174339758e1761e',staging='c2bee28714578af8d3e72475a5cdbaa37fdf9bf6';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),git=(...a)=>cp.execFileSync('git',['-C',root,...a],{maxBuffer:4*1024*1024}),text=(...a)=>git(...a).toString('utf8').trim();
assert.equal(text('rev-parse','HEAD'),source);
const audit=JSON.parse(fs.readFileSync(path.join(qualification,'source-owner-audit.json'),'utf8'));
assert.equal(audit.unknown.length,0);
const lock={file:'pnpm-lock.yaml',main:text('rev-parse',main+':pnpm-lock.yaml'),merged:text('rev-parse',source+':pnpm-lock.yaml'),staging:text('rev-parse',staging+':pnpm-lock.yaml'),diffNumstat:text('diff','--numstat',staging,source,'--','pnpm-lock.yaml'),reason:'Exactly the maina52 MCP workspace PPTX devDependency importer; no external version/integrity changes'};
assert.equal(lock.main,lock.merged);assert.equal(lock.diffNumstat,'3\t0\tpnpm-lock.yaml');
const resolution={status:'PASS',initialAudit:'source-owner-audit.json retains NEEDS_REVIEW because its initial invariant incorrectly assumed the lock must match staging',runtimeUnknown:0,lock,mainManifest:{file:'packages/mcp/package.json',main:text('rev-parse',main+':packages/mcp/package.json'),merged:text('rev-parse',source+':packages/mcp/package.json')}};
assert.equal(resolution.mainManifest.main,resolution.mainManifest.merged);
fs.writeFileSync(path.join(qualification,'source-owner-resolution.json'),JSON.stringify(resolution,null,2)+'\n',{flag:'wx'});
const scoped=cp.spawnSync('git',['-C',root,'diff','--check',staging,source,'--','docs/mcp.md','packages/mcp/app/main.ts','packages/mcp/test/deck-app-browser.mjs','changes/rr-111-mcp-main-alignment.md','docs/handoff/2026-11-09/mcp-main-alignment','docs/programs/release-readiness/burndown.md'],{encoding:'utf8'});
assert.equal(scoped.status,0);
fs.writeFileSync(path.join(qualification,'scoped-whitespace.json'),JSON.stringify({source,status:'PASS',exitCode:scoped.status,stdout:scoped.stdout,stderr:scoped.stderr,scope:'Only actual alignment paths; historical whole-merge whitespace command emitted inherited evidence warnings, was not a green qualification and its truncated tool output is not claimed as an archived raw log'},null,2)+'\n',{flag:'wx'});
const entries=[];
const add=(name,file)=>{const b=fs.readFileSync(file);entries.push({name,size:b.length,sha256:sha(b),base64:b.toString('base64')});};
for(const file of fs.readdirSync(qualification).sort())if(fs.statSync(path.join(qualification,file)).isFile())add('qualification/'+file,path.join(qualification,file));
for(const file of fs.readdirSync('C:/opf-work/main-alignment-review-01').sort())add('authoring/'+file,path.join('C:/opf-work/main-alignment-review-01',file));
const raw=Buffer.from(JSON.stringify({format:'mcp-main-alignment-v1',entries})+'\n'),archive=gzipSync(raw,{level:9,mtime:0});
fs.writeFileSync(path.join(folder,'raw.json.gz'),archive,{flag:'wx'});
const captureFolder=path.join(folder,'captures');fs.mkdirSync(captureFolder);
const captures=[];
for(const file of fs.readdirSync(path.join(qualification,'screenshots')).sort()){
 assert.match(file,/^[a-z0-9-]+[.]png$/);
 const b=fs.readFileSync(path.join(qualification,'screenshots',file));fs.writeFileSync(path.join(captureFolder,file),b,{flag:'wx'});captures.push({file:'captures/'+file,bytes:b.length,sha256:sha(b)});
}
assert.equal(captures.length,19);
const manual=JSON.parse(fs.readFileSync(path.join(folder,'resolution.json'),'utf8')).files.map(item=>({...item,blob:text('rev-parse',source+':'+item.file)}));
for(const item of manual)assert.equal(sha(git('show',source+':'+item.file)),item.proposedSha256);
const manifest={format:'mcp-main-alignment-v1',source,tree:text('rev-parse',source+'^{tree}'),parents:[main,staging],manual,mainOwned:audit.mainOwned,protectedObjects:audit.protectedObjects.filter(item=>item.file!=='pnpm-lock.yaml'),lock,mainManifest:resolution.mainManifest,
raw:{file:'raw.json.gz',bytes:archive.length,sha256:sha(archive),expandedBytes:raw.length,members:entries.length,decodedBytes:entries.reduce((n,item)=>n+item.size,0)},entries:entries.map(({base64,...item})=>item),captures,
scope:'Local in-memory MCP sandbox qualification at source1c7. Install/normalbuild/types/16maintainedbrowsergroups PASS. Scoped Biome processed0ignoredfiles/exit1, not a lint pass. Coherent mapped/CI/deploy/actualClaudehostsave/native/release acceptance remain separate.'};
fs.writeFileSync(path.join(folder,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:'SEALED',rawMembers:entries.length,decodedBytes:manifest.raw.decodedBytes,archiveBytes:archive.length,captures:captures.length,source}));
