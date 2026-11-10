import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const folder=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(folder,'../../../..');
const sha=b=>createHash('sha256').update(b).digest('hex');
const manifest=JSON.parse(fs.readFileSync(path.join(folder,'manifest.json'),'utf8'));
assert.equal(manifest.format,'b07-check-recovery-v1');
assert.equal(sha(fs.readFileSync(path.join(folder,'../b07-preparation-checkpoint/raw.json.gz'))),manifest.firstPacketSha256);
const raw=fs.readFileSync(path.join(folder,manifest.transport.path));assert.equal(raw.length,manifest.transport.bytes);assert.equal(sha(raw),manifest.transport.sha256);
const payload=JSON.parse(gunzipSync(raw,{maxOutputLength:2*1024*1024}));assert.equal(payload.format,manifest.format);assert.equal(payload.entries.length,6);
const entries=new Map();let bytes=0;
for(let i=0;i<payload.entries.length;i++){const e=payload.entries[i];assert.ok(e.path&&!e.path.includes('/')&&!e.path.includes('\\'));assert.equal(entries.has(e.path),false);const b=Buffer.from(e.base64,'base64');assert.equal(b.toString('base64'),e.base64);assert.equal(b.length,e.bytes);assert.equal(sha(b),e.sha256);assert.deepEqual(manifest.entries[i],{path:e.path,bytes:e.bytes,sha256:e.sha256});entries.set(e.path,b);bytes+=b.length;}
assert.equal(bytes,410441);const json=p=>JSON.parse(entries.get(p));
const hydrated=json('hydration01.json');assert.equal(hydrated.source,'2b825aa72e16dfa6593a8171011f7fcb6138255b');assert.equal(hydrated.indexBefore,hydrated.indexAfter);assert.equal(hydrated.clean,true);assert.equal(hydrated.exclusiveWrites,true);
assert.deepEqual(hydrated.files.map(f=>f.path),['docs/evidence/rr-20-pareto-series-scope/limitations.json','docs/evidence/rr-42-native-20261002/values.json','docs/evidence/rich-input-and-platform-ci-20260915/painting-Linux.json.gz']);
for(const f of hydrated.files){const b=execFileSync('git',['--no-optional-locks','-C',root,'cat-file','blob',f.oid],{maxBuffer:1024*1024});assert.equal(b.length,f.bytes);assert.equal(sha(b),f.sha256);const oid=execFileSync('git',['--no-optional-locks','-C',root,'rev-parse',hydrated.source+':'+f.path],{encoding:'utf8'}).trim();assert.equal(oid,f.oid);}
assert.equal(json('recovery01-text.exit.json').exitCode,0);assert.equal(json('recovery01-gallery-tracker.exit.json').exitCode,1);
assert.match(entries.get('recovery01-gallery-tracker.log').toString('utf8'),/rr-17-viet-supplement-native-20261002/);assert.match(entries.get('recovery01-gallery-tracker.log').toString('utf8'),/reproduction\.json/);
const closure=json('tracker-input-closure.json');assert.equal(closure.restored,false);assert.equal(closure.readOnly,true);assert.equal(closure.entries.length,1805);assert.equal(closure.count,1805);assert.equal(closure.entries.reduce((n,r)=>n+r.bytes,0),44606102);assert.equal(closure.entries.filter(r=>!r.present).length,1803);assert.equal(closure.entries.filter(r=>!r.present).reduce((n,r)=>n+r.bytes,0),44412757);
assert.equal(manifest.outcome.originalAggregate,'RED unchanged');assert.equal(manifest.outcome.OfficeRun,false);
console.log(JSON.stringify({verified:true,entries:entries.size,bytes,textRecovery:'PASS',galleryRecovery:'RED sparse',originalAggregate:'RED unchanged',OfficeRun:false}));
