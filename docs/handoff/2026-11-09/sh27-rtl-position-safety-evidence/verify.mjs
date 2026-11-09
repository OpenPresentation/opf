import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../../../packages/pptx/package.json',import.meta.url)),{unzipSync}=require('fflate');
const own=import.meta.dirname,m=JSON.parse(fs.readFileSync(path.join(own,'manifest.json'))),hash=b=>createHash('sha256').update(b).digest('hex'),bytes=fs.readFileSync(path.join(own,m.archive.path));
assert.equal(bytes.length,m.archive.bytes);assert.equal(hash(bytes),m.archive.sha256);const raw=unzipSync(bytes);assert.deepEqual(Object.keys(raw).sort(),m.files.map(f=>f.path).sort());for(const f of m.files){assert.equal(raw[f.path].length,f.bytes);assert.equal(hash(raw[f.path]),f.sha256);}
const json=k=>JSON.parse(new TextDecoder().decode(raw[k]));
const baseline=json('baseline-probe.json');assert.equal(baseline.formatErrorCount,0);assert.equal(baseline.boxX,'Infinity');assert.equal(baseline.pptx.hasInfinity,true);assert.equal(baseline.inlineEditorRtl,false);assert.equal(baseline.OfficeCalls,0);
for(const key of ['rtl-core-01','rtl-editor-01','rtl-core-lazy-followup','rtl-svg-recovery-01','rtl-pptx-recovery-01','rtl-browser-01','rtl-biome'])assert.equal(json(key+'.exit.json').status,0,key);
for(const key of ['rtl-svg-01','rtl-pptx-01'])assert.equal(json(key+'.exit.json').status,1,key);
assert.equal(m.nativeAcceptance,false);console.log(JSON.stringify({passed:true,files:m.files.length,browserChecks:41,nativeAcceptance:false}));
