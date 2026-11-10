import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../../',import.meta.url));
const read=name=>readFileSync(new URL(name,import.meta.url));
const parse=b=>JSON.parse(Buffer.from(b).toString('utf8').replace(/^\uFEFF/,''));
const sha=b=>createHash('sha256').update(b).digest('hex');
const git=(...a)=>execFileSync('git',['-C',root,...a]);
const text=(...a)=>git(...a).toString().trim();
const r=parse(read('receipt.json'));
assert.equal(text('status','--porcelain'),'');
assert.equal(r.source,'fdcd93c6300fd07eccf63782b8c36529535b714e');
assert.equal(text('rev-parse',r.source+'^{tree}'),r.sourceTree);
assert.deepEqual(text('diff','--name-only',r.base,r.source).split(/\r?\n/),r.sourcePaths);
for(const p of r.sourcePaths) assert.ok(p.startsWith('tools/rr105-proofing-direction/')||p==='changes/rr105-paragraph-direction-diagnostic.md'||p==='docs/handoff/2026-11-10/b07-paragraph-direction.md'||p==='docs/programs/release-readiness/burndown.md',p);
for(const f of r.codeFiles){const b=readFileSync(new URL('../../../../'+f.path,import.meta.url));assert.equal(b.length,f.bytes);assert.equal(sha(b),f.sha256);for(const ref of[r.source,'HEAD'])assert.equal(text('rev-parse',ref+':'+f.path),f.gitBlob);}
for(const p of text('diff','--name-only',r.source,'HEAD').split(/\r?\n/).filter(Boolean))assert.ok(p.startsWith(r.metadataPrefix)||r.metadataExtra.includes(p),p);
const z=read(r.raw.path);assert.equal(z.length,r.raw.bytes);assert.equal(sha(z),r.raw.sha256);
const raw=parse(gunzipSync(z));assert.equal(raw.entries.length,r.raw.members);let total=0;const files=new Map();
for(const f of raw.entries){assert.ok(!f.path.startsWith('/')&&!f.path.split('/').includes('..'));assert.equal(files.has(f.path),false);const b=Buffer.from(f.base64,'base64');assert.equal(b.length,f.bytes);assert.equal(sha(b),f.sha256);files.set(f.path,b);total+=b.length;if(f.path.endsWith('.png'))assert.match(b.toString(),/^PURE MOCK boundary/);}
assert.equal(total,r.raw.decodedBytes);
const json=p=>parse(files.get(p)),str=p=>files.get(p).toString();
assert.equal(json('pure01.exit.json').exitCode,1);assert.equal(json('pure01.json').passed,false);
assert.match(str('pure01.log'),/exact original09 single-paragraph UTF16 text/);
assert.equal(json('parser01.json').parsedTitleLength,48);
assert.equal(Buffer.from(json('parser01.json').parsedTitleUtf16Base64,'base64').length,96);
assert.equal(json('pure02.exit.json').exitCode,0);assert.equal(json('pure02.json').passed,true);assert.equal(json('pure02.json').cases.length,30);assert.equal(json('pure02.json').protectedFunctions,41);
assert.equal(json('input01.exit.json').exitCode,0);assert.equal(json('input01.json').passed,true);assert.equal(json('input01.json').cases.length,7);
assert.equal(json('identity01.exit.json').exitCode,0);const identity=json('identity01.log');assert.equal(identity.passed,true);assert.equal(identity.workerSha256,r.qualifiedWorkerSha256);assert.equal(identity.original09Sha256,r.original09Sha256);assert.equal(identity.titleUtf16Units,26);
for(const name of['pure01.json','pure02.json','input01.json']){assert.equal(json(name).officeConstructed,false);assert.equal(json(name).workerEntrypointExecuted,false);}
for(const p of['tools/rr105-proofing-direction/worker-package/test/native-furniture-control.ps1','tools/rr105-proofing-direction/qualify-source.ps1'])assert.equal(text('rev-parse','e4f36322669dbda5e0b0e3257e9b8ce9fc92ec7f:'+p),text('rev-parse',r.source+':'+p),'30 controls bind unchanged corrected source');
for(const value of Object.values(r.held))assert.equal(value,true);
await import('../../../../tools/rr105-proofing-direction/verify-source.mjs');
console.log(`PASS B07 source evidence: ${raw.entries.length} exact records/${total} bytes; original pureRED/parser48 retained, corrected30+7 controls and identityPASS; no install/build/export/Office/native acceptance.`);