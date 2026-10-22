import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {mkdtemp,mkdir,readFile,realpath,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {generatePrimaryFixtures} from './generate.mjs';
import {actionPlanFor,loadFixtureSource,PRIMARY_CASE_NAMES} from './fixture-source.mjs';
import {generateTableColors,tableColorDocument} from './table-colors.mjs';

test('tracked source retains 28 primary fixtures, all nine chart modes, measured features and reviewed actions',async()=>{
  const source=await loadFixtureSource();
  assert.deepEqual(Object.keys(source.decks),PRIMARY_CASE_NAMES);
  assert.equal(Object.keys(source.chartFixture.decks).length,9);
  assert.equal(Object.keys(source.featureManifest).length,8);
  assert.equal(source.decks['layout-empty-custom'].catalogs.custom.layouts.maximum.regions.length,12);
  assert.equal(source.decks['layout-empty-custom'].catalogs.custom.layouts.maximum.regions[0].regions.length,12);
  assert.equal(source.decks['layout-title-auto'].slides.length,3);
  assert.equal(source.decks['chart-all-seven'].slides.length,7);
  assert.equal((await actionPlanFor('layout-title-auto'))[0].shapeName,'OPF heading slides.0.title line 0');
  assert.equal((await actionPlanFor('furniture-inherited')).length,3);
  assert.deepEqual(await actionPlanFor('feature-list'),[]);
  assert.deepEqual(source.decks['list-description-native-edit'].slides[0].items,[{text:'With a description',description:'about it'},'Unchanged second entry']);
  assert.deepEqual(await actionPlanFor('list-description-native-edit'),[{op:'set-text-style',slideIndex:1,shapeName:'OPF list slides.0.items line 1',fontSize:36,color:'FF0000'}]);
  assert.deepEqual(source.decks['list-description-native-save'],source.decks['list-description-native-edit']);
  assert.notEqual(source.decks['list-description-native-save'],source.decks['list-description-native-edit']);
  assert.deepEqual(await actionPlanFor('list-description-native-save'),[]);
  const furniture=structuredClone(source.decks['furniture-inherited']);
  furniture.slides.forEach((slide,index)=>{slide.layout=index===0?'text':'two-column';});
  assert.deepEqual(source.decks['furniture-layouts'],furniture);
  assert.deepEqual(await actionPlanFor('furniture-layouts'),[]);
  const witness=source.decks['layout-bleed-card'];
  assert.equal(witness.design.contentBox,true);
  assert.equal(witness.catalogs.custom.layouts['bleed-card'].regions[0].bleed,true);
  assert.equal(witness.catalogs.custom.layouts['bleed-card'].direction,'row');
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
    assert.equal(result.cases.length,28);assert.equal(result.nativeAcceptance,false);assert.equal(result.nativeStatus,'pending');
    assert.deepEqual(result.cases.map(item=>item.id),PRIMARY_CASE_NAMES);
    assert.equal(new Set(result.files.map(item=>item.path)).size,result.files.length);
    assert.ok(result.files.length>=28*6,'each case retains source, action, archive, import, inspection and previews');
    assert.deepEqual(JSON.parse(await readFile(path.join(output,'actions','layout-title-auto.json'))),await actionPlanFor('layout-title-auto'));
    assert.deepEqual(JSON.parse(await readFile(path.join(output,'actions','feature-list.json'))),[]);
    assert.equal(result.cases.find(item=>item.id==='feature-metrics').fontProfile,'prepared-office-font-handle-for-export-and-preview');
    assert.equal(result.cases.find(item=>item.id==='list-description-native-edit').fontProfile,'prepared-office-font-handle-for-export-and-preview');
    assert.deepEqual(JSON.parse(await readFile(path.join(output,'actions','list-description-native-edit.json'))),await actionPlanFor('list-description-native-edit'));
    assert.equal(result.cases.find(item=>item.id==='layout-bleed-card').fontProfile,'prepared-office-font-handle-for-export-and-preview');
    const edit='list-description-native-edit',save='list-description-native-save';
    for(const folder of ['inputs','sources']) {
      const extension=folder==='inputs'?'pptx':'opf.json';
      assert.deepEqual(await readFile(path.join(output,folder,`${save}.${extension}`)),await readFile(path.join(output,folder,`${edit}.${extension}`)),`${folder}: identical document control`);
    }
    assert.deepEqual(JSON.parse(await readFile(path.join(output,'actions',`${save}.json`))),[]);
    assert.equal(result.cases.find(item=>item.id===save).fontProfile,result.cases.find(item=>item.id===edit).fontProfile);
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


test('furniture-layouts exports inherited carriers on distinct tagged layout variants',async()=>{
  const require=createRequire(process.env.OPF_NATIVE_FIXTURE_CONSUMER
    ?path.join(path.resolve(process.env.OPF_NATIVE_FIXTURE_CONSUMER),'package.json')
    :new URL('../../package.json',import.meta.url));
  const {toPptx}=await import(pathToFileURL(require.resolve('@openpresentation/opf-pptx')).href);
  const peer=createRequire(require.resolve('@openpresentation/opf-pptx/package.json'));
  const corePeer=createRequire(peer.resolve('@openpresentation/opf/package.json'));
  const {gallery}=await import(pathToFileURL(corePeer.resolve('@openpresentation/gallery')).href);
  const {unzipSync,strFromU8}=peer('fflate'),{XMLParser}=peer('fast-xml-parser');
  const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseAttributeValue:false,parseTagValue:false,trimValues:false});
  const source=await loadFixtureSource(),deck={...source.base,...source.decks['furniture-layouts']};
  const parts=unzipSync(await toPptx(deck,{catalogs:[gallery],seed:1,timestamp:'2026-01-01T00:00:00Z'}));
  const parse=part=>parser.parse(strFromU8(parts[part]));
  const list=value=>value===undefined?[]:Array.isArray(value)?value:[value];
  const relation=(part,type)=>list(parse(part).Relationships.Relationship).filter(record=>record.Type.endsWith('/'+type));
  const targets=[];
  for(const [index,id] of ['text','two-column','two-column'].entries()){
    const rels=relation(`ppt/slides/_rels/slide${index+1}.xml.rels`,'slideLayout');
    assert.equal(rels.length,1);const part=path.posix.normalize('ppt/slides/'+rels[0].Target);targets.push(part);
    const layout=parse(part)['p:sldLayout'];
    assert.equal(layout.type,index===0?'obj':'twoObj');
    assert.equal(layout['p:hf'].ftr,'1');assert.equal(layout['p:hf'].sldNum,'1');
    const records=relation(part.replace('slideLayouts/','slideLayouts/_rels/')+'.rels','tags');
    const tags=records.flatMap(record=>list(parse(path.posix.normalize('ppt/slideLayouts/'+record.Target))['p:tagLst']['p:tag']));
    const identity=JSON.parse(Buffer.from(tags.find(tag=>tag.name==='OPF_LAYOUT_V1').val,'hex').toString());
    assert.equal(identity.reference,id);
    const shapes=list(layout['p:cSld']['p:spTree']['p:sp']);
    const sharedHeader=shapes.filter(shape=>shape['p:nvSpPr']['p:cNvPr'].name.startsWith('OPF furniture header left text line '));
    assert.equal(sharedHeader.length,index===1?0:3,'Inherited header belongs to each used layout variant, not the local slide');
    if(index!==1){
      assert.match(layout['p:cSld'].name,/furniture/);
      const texts=sharedHeader.map(shape=>list(shape['p:txBody']['a:p']).flatMap(p=>list(p['a:r']).map(run=>run['a:t']??'')).join(''));
      assert.deepEqual(texts,['  Inherited header\twords','second line  ','']);
    }
    const slide=parse(`ppt/slides/slide${index+1}.xml`)['p:sld'];
    const slideShapes=list(slide['p:cSld']['p:spTree']['p:sp']);
    const placeholders=slideShapes.map(shape=>shape['p:nvSpPr']['p:nvPr']['p:ph']).filter(Boolean);
    assert.ok(placeholders.some(ph=>ph.type==='ftr'&&ph.idx==='11'));
    assert.ok(placeholders.some(ph=>ph.type==='sldNum'&&ph.idx==='12'));
    if(index===1)assert.equal(list(slide['p:cSld']['p:spTree']['p:pic']).length,1,'Local picture stays on its slide');
  }
  assert.notEqual(targets[0],targets[2],'Inherited Text and Two columns need distinct variants');
  assert.notEqual(targets[1],targets[2],'Local Two columns must not inherit the shared left header');
  assert.match(strFromU8(parts['ppt/slideMasters/slideMaster1.xml']),/Registry Organization/,'Shared center remains on master');
});
