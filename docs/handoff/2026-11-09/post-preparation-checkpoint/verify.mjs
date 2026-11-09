import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const base=new URL('./',import.meta.url),root=fileURLToPath(new URL('../../../../',import.meta.url)),r=JSON.parse(fs.readFileSync(new URL('receipt.json',base))),hash=b=>createHash('sha256').update(b).digest('hex');
assert.equal(execFileSync('git',['rev-parse',r.source+'^{tree}'],{cwd:root,encoding:'utf8'}).trim(),r.sourceTree);assert.equal(r.exit.exitCode,0);assert.equal(r.exit.stepsPassed,7);assert.equal(r.inputs.length,3);assert.equal(r.raw.length,11);
const verify=f=>{assert.match(f.file,/^(inputs|raw)\/[a-zA-Z0-9_.-]+[.]gz$/);const gz=fs.readFileSync(new URL(f.file,base));assert.equal(gz.length,f.gzipBytes);assert.equal(hash(gz),f.gzipSHA256);const b=gunzipSync(gz);assert.equal(b.length,f.bytes);assert.equal(hash(b),f.sha256);return b;};
for(const f of r.raw)verify(f);for(const f of r.inputs){const b=verify(f.snapshot);assert.equal(b.length,f.bytes);assert.equal(hash(b),f.sha256);assert(Date.parse(f.mtime)<Date.parse(r.exit.startedAt));}
assert(verify(r.raw[0]).toString().includes('check-changed: passed.'));console.log(JSON.stringify({verified:true,source:r.source,metadataPassed:7,qualifiedInputs:3,rawFiles:r.raw.length,productOrNativeAccepted:false}));
