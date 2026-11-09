import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const own=import.meta.dirname,hash=b=>createHash('sha256').update(b).digest('hex');
const manifest=JSON.parse(fs.readFileSync(path.join(own,'lean-font-01.manifest.json'))),archive=fs.readFileSync(path.join(own,manifest.archive));
assert.equal(archive.length,manifest.bytes);assert.equal(hash(archive),manifest.sha256);
const raw=JSON.parse(gunzipSync(archive)).files;assert.deepEqual(raw.map(f=>f.file),manifest.files.map(f=>f.file));
const files=new Map();for(const f of raw){const b=Buffer.from(f.data,'base64');assert.equal(b.length,f.bytes);assert.equal(hash(b),f.sha256);assert.deepEqual({file:f.file,bytes:f.bytes,sha256:f.sha256},manifest.files.find(m=>m.file===f.file));files.set(f.file,b);}
const summary=JSON.parse(files.get('summary.json'));assert.deepEqual(summary,JSON.parse(fs.readFileSync(path.join(own,'lean-font-01.summary.json'))));assert.equal(summary.status,'PASS');assert.equal(summary.rows.length,6);
assert.equal(summary.harnessSha256,hash(fs.readFileSync(path.join(own,'lean-font-case.mjs'))));
const baselineRaw=JSON.parse(gunzipSync(fs.readFileSync(path.join(own,'server-baseline-01.raw.json.gz')))).files;
const baseline=JSON.parse(Buffer.from(baselineRaw.find(f=>f.file==='results/server-baseline-01/36-batch-fonts.json').data,'base64')),expected=baseline.storage.perSlide.map(s=>s.sha256);
for(const [i,row] of summary.rows.entries()){
 assert.equal(row.exitCode,0);assert.equal(row.outputEquivalent,true);assert.equal(row.order,i+1);
 const name=String(i+1).padStart(2,'0')+'-'+row.mode;
 const result=JSON.parse(files.get(name+'.json'));assert.equal(result.samples.length,3);assert.equal(result.runs,2);assert.equal(result.status,'PASS');assert.equal(result.fontFaces.length,row.faces);assert.equal(result.fontInputBytes,row.fontInputBytes);
 assert.equal(row.faces,{'batch-fonts':131,'batch-no-open':53,'batch-office-only':44}[row.mode]);assert.deepEqual(result.storage.perSlide.map(s=>s.sha256),expected);
 if(i)assert.ok(Date.parse(row.started)>=Date.parse(summary.rows[i-1].finished));
}
console.log(JSON.stringify({status:'PASS',members:raw.length,cases:6,baselineSlideComparisons:216,loadedFaceCounts:[131,53,44],productionChanges:false}));
