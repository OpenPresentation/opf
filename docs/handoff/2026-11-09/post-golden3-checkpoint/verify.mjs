import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const base=new URL('./',import.meta.url),root=fileURLToPath(new URL('../../../../',import.meta.url)),r=JSON.parse(fs.readFileSync(new URL('receipt.json',base))),hash=b=>createHash('sha256').update(b).digest('hex');
assert.equal(execFileSync('git',['rev-parse',r.source+'^{tree}'],{cwd:root,encoding:'utf8'}).trim(),r.sourceTree);assert.equal(r.check.exitCode,0);assert.equal(r.check.stepsPassed,5);assert.equal(r.check.inputs.length,2);assert.equal(r.files.length,11);
for(const f of r.files){assert.match(f.name,/^[a-zA-Z0-9_.-]+[.]gz$/);const gz=fs.readFileSync(new URL('raw/'+f.name,base));assert.equal(gz.length,f.gzipBytes);assert.equal(hash(gz),f.gzipSHA256);const b=gunzipSync(gz);assert.equal(b.length,f.rawBytes);assert.equal(hash(b),f.rawSHA256);}
for(const f of r.check.inputs){const b=fs.readFileSync(new URL('../../../../'+f.file,import.meta.url));assert.equal(b.length,f.bytes);assert.equal(hash(b),f.sha256);assert(Date.parse(f.mtime)<Date.parse(r.check.startedAt));}
assert(gunzipSync(fs.readFileSync(new URL('raw/driver.log.gz',base))).toString().includes('check-changed: passed.'));console.log(JSON.stringify({verified:true,source:r.source,metadataPassed:5,qualifiedInputs:2,rawFiles:r.files.length,rawBytes:r.files.reduce((n,f)=>n+f.rawBytes,0),productOrNativeAccepted:false,publicSafe:true,neverMerge:true}));
