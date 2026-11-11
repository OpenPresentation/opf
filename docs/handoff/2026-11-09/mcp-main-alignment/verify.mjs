import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
const folder=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(folder,'../../../..');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),git=(...a)=>cp.execFileSync('git',['-C',root,...a],{maxBuffer:4*1024*1024}),text=(...a)=>git(...a).toString('utf8').trim();
const m=JSON.parse(fs.readFileSync(path.join(folder,'manifest.json'),'utf8'));
assert.equal(text('rev-parse',m.source+'^{tree}'),m.tree);assert.deepEqual(text('show','-s','--format=%P',m.source).split(' '),m.parents);
for(const f of m.manual){assert.equal(text('rev-parse',m.source+':'+f.file),f.blob);assert.equal(text('rev-parse','HEAD:'+f.file),f.blob);assert.equal(hash(git('show',m.source+':'+f.file)),f.proposedSha256);assert.equal(hash(fs.readFileSync(path.join(root,f.file))),f.proposedSha256);}
for(const f of m.mainOwned){assert.equal(text('rev-parse',m.source+':'+f.file),f.blob);assert.equal(text('rev-parse',m.parents[0]+':'+f.file),f.blob);}
for(const f of m.protectedObjects){assert.equal(f.equal,true);assert.equal(f.merged,f.staging);assert.equal(text('rev-parse',m.source+':'+f.file),f.merged);assert.equal(text('rev-parse',m.parents[1]+':'+f.file),f.staging);}
assert.equal(m.lock.main,m.lock.merged);assert.equal(text('rev-parse',m.parents[0]+':pnpm-lock.yaml'),m.lock.main);assert.equal(text('rev-parse',m.source+':pnpm-lock.yaml'),m.lock.merged);assert.equal(text('diff','--numstat',m.parents[1],m.source,'--','pnpm-lock.yaml'),'3\t0\tpnpm-lock.yaml');
assert.equal(m.mainManifest.main,m.mainManifest.merged);assert.equal(text('rev-parse',m.source+':packages/mcp/package.json'),m.mainManifest.merged);
const archive=fs.readFileSync(path.join(folder,m.raw.file));assert.equal(archive.length,m.raw.bytes);assert.equal(hash(archive),m.raw.sha256);
const expanded=gunzipSync(archive,{maxOutputLength:4*1024*1024});assert.equal(expanded.length,m.raw.expandedBytes);
const body=JSON.parse(expanded);assert.equal(body.format,m.format);assert.equal(body.entries.length,m.entries.length);
const records=new Map();let bytes=0;
for(const[i,e]of body.entries.entries()){assert.match(e.name,/^[A-Za-z0-9./-]+$/);assert.ok(!e.name.includes('..'));assert.ok(!records.has(e.name));const b=Buffer.from(e.base64,'base64');assert.equal(b.length,e.size);assert.equal(hash(b),e.sha256);const{base64,...meta}=e;assert.deepEqual(meta,m.entries[i]);records.set(e.name,b);bytes+=b.length;}
assert.equal(bytes,m.raw.decodedBytes);
const json=n=>JSON.parse(records.get(n));
for(const phase of ['install','build','types','browser']){const exit=json('qualification/'+phase+'-exit.json');assert.equal(exit.source,m.source);assert.equal(exit.exitCode,0);}
assert.equal(json('qualification/biome-exit.json').exitCode,1);assert.match(records.get('qualification/biome.log').toString('utf8'),/Checked 0 files/);
assert.equal(json('qualification/source-owner-audit.json').status,'NEEDS_REVIEW');assert.equal(json('qualification/source-owner-audit.json').unknown.length,0);assert.equal(json('qualification/source-owner-resolution.json').status,'PASS');assert.equal(json('qualification/scoped-whitespace.json').exitCode,0);
const log=records.get('qualification/browser.log').toString('utf8');assert.equal((log.match(/^ok - /gm)??[]).length,16);assert.match(log,/host downloads preserve untouched JSON, YAML and Markdown/);assert.match(log,/capable host binary Export denial/);assert.match(log,/runs without a CSP violation or a page error/);
for(const item of m.captures){assert.match(item.file,/^captures\/[a-z0-9-]+[.]png$/);const b=fs.readFileSync(path.join(folder,item.file));assert.equal(b.length,item.bytes);assert.equal(hash(b),item.sha256);}
assert.equal(m.captures.length,19);
console.log(JSON.stringify({verified:true,source:m.source,rawRecords:records.size,decodedBytes:bytes,captures:m.captures.length,browserGroups:16,scope:m.scope}));
