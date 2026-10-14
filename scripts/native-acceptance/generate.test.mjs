import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,mkdir,readFile,realpath,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {generatePrimaryFixtures} from './generate.mjs';
import {actionPlanFor,loadFixtureSource,PRIMARY_CASE_NAMES} from './fixture-source.mjs';
import {generateTableColors,tableColorDocument} from './table-colors.mjs';

test('tracked source retains 26 primary fixtures, all nine chart modes, measured features and reviewed actions',async()=>{
  const source=await loadFixtureSource();
  assert.deepEqual(Object.keys(source.decks),PRIMARY_CASE_NAMES);
  assert.equal(Object.keys(source.chartFixture.decks).length,9);
  assert.equal(Object.keys(source.featureManifest).length,8);
  assert.equal(source.decks['layout-empty-custom'].catalogs.custom.layouts.maximum.areas.length,12);
  assert.equal(source.decks['layout-empty-custom'].catalogs.custom.layouts.maximum.areas[0].length,12);
  assert.equal(source.decks['layout-title-auto'].slides.length,3);
  assert.equal(source.decks['chart-all-seven'].slides.length,7);
  assert.equal((await actionPlanFor('layout-title-auto'))[0].shapeName,'OPF heading slides.0.title line 0');
  assert.equal((await actionPlanFor('furniture-inherited')).length,3);
  assert.deepEqual(await actionPlanFor('feature-list'),[]);
  assert.deepEqual(source.decks['list-description-native-edit'].slides[0].items,[{text:'With a description',description:'about it'},'Unchanged second entry']);
  assert.deepEqual(await actionPlanFor('list-description-native-edit'),[{op:'set-text-style',slideIndex:1,shapeName:'OPF list slides.0.items line 1',fontSize:36,color:'FF0000'}]);
  const witness=source.decks['layout-bleed-card'];
  assert.equal(witness.design.contentBox,true);
  assert.equal(witness.catalogs.custom.layouts['bleed-card'].regions.media.bleed,true);
  assert.deepEqual(witness.catalogs.custom.layouts['bleed-card'].areas,[['media','body']]);
  assert.deepEqual(await actionPlanFor('layout-bleed-card'),[]);
  const table=tableColorDocument();assert.equal(table.document.slides.length,6);
  assert.equal(table.expected.length,6);assert.equal(table.expected.reduce((sum,slide)=>sum+slide.cells.length,0),24);
});

test('generation writes complete fresh receipts and never overwrites an attempt',async()=>{
  const scratch=await realpath(await mkdtemp(path.join(tmpdir(),'native-acceptance-fixtures-')));
  try{
    const consumer=path.join(scratch,'installed'),output=path.join(scratch,'attempt-01');await mkdir(consumer);
    const gallery={source:'test-gallery',layouts:{one:{}}};
    const engines={
      core:{validate:()=>({valid:true,findings:[]}),convert:async(_deck,{format})=>({files:[{bytes:Buffer.from(format)}]})},
      pptx:{toPptx:async deck=>Buffer.from(JSON.stringify(deck)),fromPptx:async bytes=>JSON.parse(Buffer.from(bytes).toString())},
      render:{loadFonts:async()=>({ensure:async()=>{}})},gallery,
      fflate:{unzipSync:bytes=>Object.fromEntries(JSON.parse(Buffer.from(bytes).toString()).slides.map((_,index)=>[`ppt/slides/slide${index+1}.xml`,Buffer.from('<p:sp>')])),strFromU8:data=>Buffer.from(data).toString()},
    };
    const result=await generatePrimaryFixtures({consumer,output,sourceIdentity:{core:'selected-by-caller'},engines});
    assert.equal(result.cases.length,26);assert.equal(result.nativeAcceptance,false);assert.equal(result.nativeStatus,'pending');
    assert.deepEqual(result.cases.map(item=>item.id),PRIMARY_CASE_NAMES);
    assert.equal(new Set(result.files.map(item=>item.path)).size,result.files.length);
    assert.ok(result.files.length>=26*6,'each case retains source, action, archive, import, inspection and previews');
    assert.deepEqual(JSON.parse(await readFile(path.join(output,'actions','layout-title-auto.json'))),await actionPlanFor('layout-title-auto'));
    assert.deepEqual(JSON.parse(await readFile(path.join(output,'actions','feature-list.json'))),[]);
    assert.equal(result.cases.find(item=>item.id==='feature-metrics').fontProfile,'prepared-office-font-handle-for-export-and-preview');
    assert.equal(result.cases.find(item=>item.id==='list-description-native-edit').fontProfile,'prepared-office-font-handle-for-export-and-preview');
    assert.deepEqual(JSON.parse(await readFile(path.join(output,'actions','list-description-native-edit.json'))),await actionPlanFor('list-description-native-edit'));
    assert.equal(result.cases.find(item=>item.id==='layout-bleed-card').fontProfile,'prepared-office-font-handle-for-export-and-preview');
    const seven=result.cases.find(item=>item.id==='chart-all-seven');
    assert.equal(seven.slideCount,7);assert.equal(seven.automaticControlEligible,false);
    const table=await generateTableColors({consumer,output,sourceIdentity:{core:'selected-by-caller'},engines});
    assert.equal(table.cases[0].automaticControlEligible,false);
    assert.equal(table.cases[0].dedicatedWorker,'native-table-colors.ps1');
    const generation=JSON.parse(await readFile(path.join(output,'table-colors','generation.json')));
    assert.equal(generation.expected.length,6);
    await assert.rejects(()=>generatePrimaryFixtures({consumer,output,sourceIdentity:{core:'selected-by-caller'},engines}),{code:'EEXIST'});
  }finally{await rm(scratch,{recursive:true,force:true});}
});
