import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {REFERENCE_CASES,REFERENCE_LIMITS,readReferenceSources,assertReferenceSources,titleInvariancePair,sourceSummary} from './reference-chart-fixtures.mjs';
const require=createRequire(new URL('../../packages/javascript/package.json',import.meta.url)),root=fileURLToPath(new URL('../../',import.meta.url));
test('all nine intentionally authored slides validate against this checkout authoritative schema',()=>{
  const Ajv=require('ajv/dist/2020.js').default,ajv=new Ajv({allErrors:true,verbose:true,strict:false,allowUnionTypes:true});
  require('ajv-formats').default(ajv);
  const schema=JSON.parse(fs.readFileSync(path.join(root,'spec/schemas/opf.schema.json'),'utf8'));
  const validate=ajv.compile(schema);
  for(const item of readReferenceSources())assert.equal(validate(item.document),true,item.id+': '+JSON.stringify(validate.errors));
});
test('closed scope preserves three whole cases, all six chart types, raw units and default/optional labels',()=>{
  const sources=readReferenceSources(),summary=sourceSummary(sources);
  assert.equal(summary.cases.length,3);assert.equal(summary.cases.reduce((n,item)=>n+item.slideCount,0),9);
  assert.equal(summary.cases.reduce((n,item)=>n+item.referenceCounts.reduce((a,b)=>a+b,0),0),10);
  assert.equal(summary.automaticControlEligible,false);assert.equal(summary.nativeAcceptance,false);assert.equal(summary.fullSuite,false);
  assert.deepEqual(REFERENCE_LIMITS,{slides:3,maxShapesPerSlide:3,maxTotalShapes:9,maxActions:0,maxArchiveBytes:16777216,maxZipEntries:4096,defaultTimeoutSeconds:45,maxTimeoutSeconds:60});
  assert.equal(summary.exportedShapeCounts.startsWith('UNMEASURED'),true,'Do not invent actual shape-count evidence from source intent');
});
test('wrong/partial cases, dropped slides, removed types, wrong percentage units and prose inference are refused',()=>{
  const mutations=[
    sources=>sources.pop(),
    sources=>sources[0].id='chart-all-seven',
    sources=>sources[0].document.slides.pop(),
    sources=>sources[1].document.slides[2].chart.type='line',
    sources=>sources[1].document.slides[0].chart.referenceLines[1].value=25,
    sources=>sources[0].document.slides[2].chart.referenceLines=[{value:92}],
    sources=>sources[2].document.slides[1].title='Extra shape',
    sources=>sources[2].document.slides[2].chart.data.rows.push(['Second',9])
  ];
  for(const mutate of mutations){const sources=readReferenceSources();mutate(sources);assert.throws(()=>assertReferenceSources(sources));}
});
test('title pair changes only authored prose and explicitly requires future actual frame/XML proof',()=>{
  const pair=titleInvariancePair();assert.equal(pair.physicalProfileCase,false);assert.equal(pair.requiresActualExportFrameEquality,true);
  const normalize=doc=>{const copy=structuredClone(doc);delete copy.slides[0].title;delete copy.slides[0].subtitle;return copy;};
  assert.deepEqual(normalize(pair.before),normalize(pair.after));
  assert.notEqual(pair.before.slides[0].title,pair.after.slides[0].title);
});
test('default CLI performs source-only inspection; Office/generation flags are not accepted',()=>{
  const script=fileURLToPath(new URL('./reference-chart-fixtures.mjs',import.meta.url));
  const run=spawnSync(process.execPath,[script],{encoding:'utf8',timeout:10000,maxBuffer:100000});
  assert.equal(run.status,0,run.stderr);assert.equal(JSON.parse(run.stdout).nativeAcceptance,false);
  for(const flag of ['--run-office','generate','--case','chart-all-seven']){
    const refused=spawnSync(process.execPath,[script,flag],{encoding:'utf8',timeout:10000,maxBuffer:100000});
    assert.notEqual(refused.status,0,flag);
  }
});
