// RR-105: a no-op Office caption rewrite must not invalidate the authored data shape.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {unzipSync,zipSync,strFromU8,strToU8} from 'fflate';
import {chartEvidence} from '../dist/data-provenance.js';
import {fromPptx} from './helpers/default-catalog.mjs';

const witness=unzipSync(readFileSync(new URL('./fixtures/native-waterfall-caption-20261109.zip',import.meta.url)));
const source=JSON.parse(strFromU8(witness['source.opf.json']));
const original=unzipSync(witness['original.pptx']),saved=unzipSync(witness['saved.pptx']);
const part='ppt/charts/chartEx1.xml',originalXml=strFromU8(original[part]),savedXml=strFromU8(saved[part]);
const hash=b=>createHash('sha256').update(b).digest('hex');
const recordOf=parts=>{const xml=Object.entries(parts).filter(([p])=>/^ppt\/tags\//.test(p)).map(([,b])=>strFromU8(b)).find(x=>x.includes('name="OPF_DATA_V1"'));return JSON.parse(Buffer.from(xml.match(/name="OPF_DATA_V1"\s+val="([^"]+)"/)[1],'hex').toString('utf8'));};
const sourceData=source.slides[0].chart.data,stored=recordOf(original);
const getChart=doc=>doc.slides[0].chart??doc.slides[0].blocks?.find(b=>b.chart)?.chart;
async function imported(bytes){const diagnostics=[];const doc=await fromPptx(bytes,{onDiagnostic:d=>diagnostics.push(d)});assert.equal(doc.slides.length,1);return {doc,chart:getChart(doc),diagnostics};}
function change(block,from,to){assert.ok(block.includes(from),'exact native mutation anchor');return block.replace(from,to);}
function region(xml,pattern,mutate){let count=0;const result=xml.replace(pattern,block=>{count++;return mutate(block);});assert.equal(count,1,'one structural region mutated');return result;}
const rewritten=xml=>zipSync({...saved,[part]:strToU8(xml)});

test('captured original and saved bytes retain the exact owned OPF_DATA and classic cache',async()=>{
  assert.equal(hash(witness['original.pptx']),'83a01144694d526ffa7399c8142a150b29cd7e42784b00fa9d67a1766f84a170');
  assert.equal(hash(witness['saved.pptx']),'845aaa463f1ef7116e5da88193143d855878742f88cd47dc1ab33a58c989b1c5');
  assert.deepEqual(recordOf(saved),stored,'Office preserved the authored data and legacy fingerprints');
  assert.deepEqual(stored.data,sourceData);assert.deepEqual(saved['ppt/charts/chart1.xml'],original['ppt/charts/chart1.xml']);
  assert.match(originalXml,/<cx:title[^>]*><cx:tx><cx:rich>/);assert.match(savedXml,/<cx:title[^>]*><cx:tx><cx:txData><cx:v>Sample<\/cx:v>/);
  assert.deepEqual((await imported(witness['original.pptx'])).doc,source);
  assert.equal(chartEvidence(originalXml),'057cdc6c5efc23fe','keep the original accepted fingerprint');
});

test('actual no-op saved archive restores the authored single column',async()=>{
  const {doc,chart,diagnostics}=await imported(witness['saved.pptx']);
  assert.deepEqual(chart.data,sourceData,'do not invent a Row column after Office save');
  assert.deepEqual(doc,source);
  assert.equal(chartEvidence(savedXml),'057cdc6c5efc23fe','saved title serialization is not cached data');
  assert.deepEqual(diagnostics.filter(d=>d.code==='chart-data-provenance-changed'),[]);
});

test('editing only the native display caption keeps the data shape',async()=>{
  const xml=region(savedXml,/<cx:title\b[\s\S]*?<\/cx:title>/g,b=>change(b,'<cx:v>Sample</cx:v>','<cx:v>Native caption renamed</cx:v>'));
  const {chart,diagnostics}=await imported(rewritten(xml));
  assert.deepEqual(chart.data,sourceData);assert.equal(chartEvidence(xml),'057cdc6c5efc23fe');
  assert.deepEqual(diagnostics.filter(d=>d.code==='chart-data-provenance-changed'),[]);
});

const mutations=[
  {name:'numeric value',edit:xml=>region(xml,/<cx:numDim type="val">[\s\S]*?<\/cx:numDim>/g,b=>change(b,'<cx:pt idx="0">3</cx:pt>','<cx:pt idx="0">300</cx:pt>')),check:data=>assert.equal(data.rows[0].at(-1),300)},
  {name:'category',edit:xml=>region(xml,/<cx:strDim type="cat">[\s\S]*?<\/cx:strDim>/g,b=>change(b,'<cx:pt idx="0">1</cx:pt>','<cx:pt idx="0">Changed category</cx:pt>')),check:data=>assert.equal(data.rows[0][0],'Changed category')},
  {name:'series name',edit:xml=>region(xml,/<cx:series\b[\s\S]*?<\/cx:series>/g,b=>change(b,'<cx:v>Sample</cx:v>','<cx:v>Native series</cx:v>')),check:data=>assert.equal(typeof data.columns[1]==='string'?data.columns[1]:data.columns[1].name,'Native series')},
  {name:'number format',edit:xml=>region(xml,/<cx:numDim type="val">[\s\S]*?<\/cx:numDim>/g,b=>change(b,'formatCode="General"','formatCode="0.0"')),check:data=>{assert.equal(typeof data.columns[1],'object');assert.equal(data.columns[1].name,'Sample');assert.ok(data.columns[1].format);}},
];
for(const item of mutations)test('real '+item.name+' edit refuses stale authored data',async()=>{
  const xml=item.edit(savedXml);assert.notEqual(chartEvidence(xml),'057cdc6c5efc23fe');
  const {chart,diagnostics}=await imported(rewritten(xml));
  assert.notDeepEqual(chart.data,sourceData);item.check(chart.data);
  assert.ok(diagnostics.some(d=>d.code==='chart-data-provenance-changed'),'a genuine cache edit stays diagnosed');
});
