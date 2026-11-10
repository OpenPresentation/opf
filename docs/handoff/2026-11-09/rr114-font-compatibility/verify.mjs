import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {gunzipSync} from 'node:zlib';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const dir=new URL('./',import.meta.url),root=fileURLToPath(new URL('../../../../',import.meta.url));
const {unzipSync}=createRequire(new URL('../../../../packages/pptx/package.json',import.meta.url))('fflate');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const receipt=JSON.parse(readFileSync(new URL('receipt.json',dir),'utf8'));
const compressed=readFileSync(new URL('raw.json.gz',dir));
assert.equal(sha(compressed),receipt.archiveSha256);assert.equal(compressed.length,receipt.compressedBytes);
const raw=gunzipSync(compressed);assert.equal(raw.length,receipt.rawBytes);
const packet=JSON.parse(raw);assert.equal(packet.source,receipt.source);assert.equal(packet.base,receipt.base);assert.equal(packet.records.length,receipt.records);
const members=new Map();for(const record of packet.records){assert.ok(!members.has(record.name),'duplicate archive member');const bytes=Buffer.from(record.base64,'base64');assert.equal(bytes.length,record.bytes,record.name);assert.equal(sha(bytes),record.sha256,record.name);members.set(record.name,bytes);}
let currentRelevantMatches=true;for(const binding of receipt.bindings){const old=execFileSync('git',['show',receipt.source+':'+binding.file],{cwd:root});assert.equal(sha(old),binding.sha256,binding.file);const current=execFileSync('git',['show','HEAD:'+binding.file],{cwd:root});if(sha(current)!==binding.sha256)currentRelevantMatches=false;}
let currentBuiltAvailable=true,currentBuiltMatches=true;for(const item of receipt.built){assert.equal(item.sourceOnDiskSha256,item.builtSha256,item.source);if(!existsSync(new URL('../../../../'+item.output,import.meta.url))){currentBuiltAvailable=false;continue;}if(sha(readFileSync(new URL('../../../../'+item.output,import.meta.url)))!==item.builtSha256)currentBuiltMatches=false;}
const get=name=>{const data=members.get('artifacts/font-compat/output/'+name);assert.ok(data,name);return data;};
let svgPairs=0,nativePartPairs=0;for(const name of ['emoji','math']){assert.deepEqual(get(name+'.svg'),get(name+'-whole.svg'));svgPairs++;for(const mode of ['selected','safe']){const actual=unzipSync(get(`${name}-${mode}-demand.pptx`)),expected=unzipSync(get(`${name}-${mode}-whole.pptx`));for(const [part,suffix] of [['ppt/slides/slide1.xml','slide'],['ppt/theme/theme1.xml','theme']]){assert.deepEqual(actual[part],expected[part]);assert.deepEqual(Buffer.from(actual[part]),get(`${name}-${mode}-${suffix}.xml`));nativePartPairs++;}}}
assert.equal(svgPairs,receipt.observed.outputs.svgPairs);assert.equal(nativePartPairs,receipt.observed.outputs.nativePartPairs);
for(const item of receipt.observed.originalControls){assert.equal(item.before,1);assert.equal(item.after,0);assert.ok(members.get(`logs/font-compat-before-${item.test}.log`).length>0);assert.ok(members.has(`logs/font-compat-after-${item.test}.log`));}
console.log(JSON.stringify({passed:true,source:receipt.source,records:members.size,rawBytes:raw.length,svgPairs,nativePartPairs,currentRelevantMatches,currentBuiltAvailable,currentBuiltMatches,nativeApplicationRun:false}));
