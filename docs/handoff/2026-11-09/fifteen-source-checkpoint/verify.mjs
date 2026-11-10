import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../../',import.meta.url)),base=new URL('./',import.meta.url),r=JSON.parse(fs.readFileSync(new URL('receipt.json',base))),hash=b=>createHash('sha256').update(b).digest('hex');
assert.equal(execFileSync('git',['rev-parse',r.source+'^{tree}'],{cwd:root,encoding:'utf8'}).trim(),r.sourceTree);assert.equal(r.exit.exitCode,0);assert.equal(r.exit.base,r.source);assert.equal(r.stepsPassed,5);assert.equal(r.typecheckSkipped,1);assert.equal(r.files.length,14);assert.equal(r.strict.length,3);assert(r.strict.every(s=>s.exitCode===0));
for(const f of r.files){assert.match(f.name,/^[a-zA-Z0-9_.-]+[.]gz$/);const b=fs.readFileSync(new URL('raw/'+f.name,base));assert.equal(b.length,f.gzipBytes);assert.equal(hash(b),f.gzipSHA256);const raw=gunzipSync(b);assert.equal(raw.length,f.rawBytes);assert.equal(hash(raw),f.rawSHA256);}
const snapshots=JSON.parse(fs.readFileSync(new URL('qualified-inputs.json',base)));assert.equal(snapshots.inputs.length,r.inputs.length);
for(const [i,f] of r.inputs.entries()){const s=snapshots.inputs[i];for(const key of ['file','bytes','sha256','mtime'])assert.equal(s[key],f[key]);assert.match(s.name,/^[a-zA-Z0-9_.-]+[.]gz$/);const gz=fs.readFileSync(new URL('qualified-inputs/'+s.name,base));assert.equal(gz.length,s.gzipBytes);assert.equal(hash(gz),s.gzipSHA256);const b=gunzipSync(gz);assert.equal(b.length,f.bytes,f.file);assert.equal(hash(b),f.sha256,f.file);assert(Date.parse(f.mtime)<=Date.parse(r.exit.startedAt));}
assert(gunzipSync(fs.readFileSync(new URL('raw/driver.log.gz',base))).toString().includes('check-changed: passed.'));console.log(JSON.stringify({verified:true,source:r.source,rawFiles:r.files.length,rawBytes:r.files.reduce((n,f)=>n+f.rawBytes,0),metadataPassed:r.stepsPassed,strictPassed:r.strict.length,scope:r.scope}));
