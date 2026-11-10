import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../../',import.meta.url));
const dir=new URL('./',import.meta.url),r=JSON.parse(fs.readFileSync(new URL('receipt.json',dir)));
const hash=b=>createHash('sha256').update(b).digest('hex');
assert.equal(execFileSync('git',['rev-parse',r.source+'^{tree}'],{cwd:root,encoding:'utf8'}).trim(),r.sourceTree);
assert.equal(r.exit.base,r.source);assert.equal(r.exit.exitCode,0);assert.equal(r.passedSteps,7);assert.equal(r.typecheckSkipped,1);assert.equal(r.files.length,9);
for(const f of r.files){assert.match(f.name,/^[a-zA-Z0-9_.-]+[.]gz$/);const b=fs.readFileSync(new URL('raw/'+f.name,dir));assert.equal(b.length,f.gzipBytes);assert.equal(hash(b),f.gzipSHA256);const raw=gunzipSync(b);assert.equal(raw.length,f.rawBytes);assert.equal(hash(raw),f.rawSHA256);}
const log=gunzipSync(fs.readFileSync(new URL('raw/driver.log.gz',dir))).toString();assert(log.includes('check-changed: passed.'));assert(log.includes('6 changed files'));assert.equal(JSON.parse(gunzipSync(fs.readFileSync(new URL('raw/driver.exit.json.gz',dir)))).exitCode,0);
console.log(JSON.stringify({verified:true,source:r.source,rawFiles:r.files.length,rawBytes:r.files.reduce((n,f)=>n+f.rawBytes,0),scope:r.scope}));
