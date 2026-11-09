import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const manifest=JSON.parse(readFileSync(new URL('server-baseline-01.manifest.json',import.meta.url))),hash=b=>createHash('sha256').update(b).digest('hex'),archive=readFileSync(new URL(manifest.archive,import.meta.url));
assert.equal(archive.length,manifest.bytes);assert.equal(hash(archive),manifest.sha256);
const files=JSON.parse(gunzipSync(archive)).files;assert.deepEqual(files.map(f=>f.file).sort(),manifest.files.map(f=>f.file).sort());const lookup=new Map();
for(const file of files){const bytes=Buffer.from(file.data,'base64'),expected=manifest.files.find(x=>x.file===file.file);assert.equal(bytes.length,expected.bytes);assert.equal(hash(bytes),expected.sha256);lookup.set(file.file,bytes);}
const summary=JSON.parse(lookup.get('results/server-baseline-01/summary.json'));assert.equal(summary.status,'PASS');assert.equal(summary.rows.length,8);assert.ok(summary.rows.every(r=>r.exitCode===0));assert.equal(summary.equivalentStandaloneOutput,true);
for(const size of [16,36]){let base;for(const mode of ['batch-fonts','selected-default','selected-once','batch-system']){const result=JSON.parse(lookup.get('results/server-baseline-01/'+size+'-'+mode+'.json'));assert.equal(result.status,'PASS');assert.equal(result.samples.length,6);assert.equal(result.size,size);assert.equal(result.storage.perSlide.length,size);const hashes=result.storage.perSlide.map(x=>x.sha256);if(mode==='batch-fonts')base=hashes;else if(mode!=='batch-system')assert.deepEqual(hashes,base);}}
console.log(JSON.stringify({status:'PASS',members:files.length,formalCases:8,warmRuns:40,equivalentStandaloneOutput:true,smokeExcluded:true}));
