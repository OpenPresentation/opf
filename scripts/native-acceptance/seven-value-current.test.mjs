// Prepared public-producer and ZIP-mutant controls. No native Office claim.
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {toPptx,fromPptx} from '@openpresentation/opf-pptx';
import {archiveDependencies,inspectSevenArchive} from './seven-chart-archive.mjs';
import {currentSevenSource,currentSevenArchiveContext,bindCurrentTreemap,compareCurrentTreemapEdit} from './seven-value-current.mjs';
import {assertSevenValueRawPreservation} from './seven-value-raw.mjs';
import {inspectSevenArchive as frozenDefaultInspector} from './test-fixtures/seven-value-old-inspector.mjs';
import {digest} from './identity.mjs';
const deps=archiveDependencies(),selection={slideIndex:1,seriesIndex:1,pointIndex:1,newValue:43};
const once=(value,before,after)=>{assert.equal(value.split(before).length,2,'One exact test-owned leaf');return value.replace(before,after);};
const change=(parts,name,edit)=>{assert.ok(parts[name]);parts[name]=deps.strToU8(edit(deps.strFromU8(parts[name])));};
const zip=parts=>Buffer.from(deps.zipSync(parts));
function phase(archive){return{slideCount:7,rasters:Array.from({length:7},(_,index)=>({slideIndex:index+1})),slides:archive.slides.map((slide,index)=>{
 const shapes=slide.shapes.filter(shape=>shape.kind==='title'||shape.branch==='choice'||shape.branch==='direct').map((shape,position)=>({index:position+1,id:shape.id,name:shape.name,type:shape.kind==='title'?14:3,...shape.geometry,hasTextFrame:shape.kind==='title'?-1:0,text:shape.kind==='title'?shape.text:null,alternativeText:''}));
 return{index:index+1,slideId:index+256,name:'Synthetic descriptors only '+index,shapeCount:shapes.length,shapes};
})};}
let prepared;
async function fixture(){return prepared??= (async()=>{
 const source=currentSevenSource(),input=Buffer.from(await toPptx(source,{chartex:'native'})),bound=bindCurrentTreemap(input,source,selection),parts=deps.unzipSync(input),action=bound.action;
 for(const slide of bound.archive.slides)for(const shape of slide.shapes){if(shape.kind!=='chart'||shape.chart.workbook.part!==action.workbookPart)continue;
  change(parts,shape.chartPart,text=>shape.chart.family==='chartEx'?once(text,'<cx:pt idx="0">42</cx:pt>','<cx:pt idx="0">43</cx:pt>'):once(text,'<c:pt idx="0"><c:v>42</c:v></c:pt>','<c:pt idx="0"><c:v>43</c:v></c:pt>'));
 }
 const book=deps.unzipSync(parts[action.workbookPart]);change(book,'xl/worksheets/sheet1.xml',text=>once(text,'<c r="B2"><v>42</v></c>','<c r="B2"><v>43</v></c>'));parts[action.workbookPart]=deps.zipSync(book);
 const saved=zip(parts),imports={};
 for(const [name,bytes]of [['original',input],['saved-reopened',saved]]){const diagnostics=[],document=await fromPptx(bytes,{onDiagnostic:issue=>diagnostics.push(issue)});imports[name]={document,diagnostics};}
 // Above documents are actual public imports; below descriptors are explicitly
 // synthetic and prove no COM observation. Actual native phases remain mandatory.
 return{input,saved,source,action,bound,archiveContext:bound.archiveContext,phases:{original:phase(bound.archive),'saved-reopened':phase(inspectSevenArchive(saved,deps,bound.archiveContext))},imports,deps};
})();}
test('current producer classifies two known classic adaptations and admits ONLY treemap',async()=>{
 const f=await fixture();assert.equal(f.bound.census.maximum,4);assert.notEqual(f.bound.census.arrays,46);
 assert.deepEqual(f.bound.classification.filter(item=>item.representation==='classic-column-fallback').map(item=>item.sourceType),['histogram','world']);
 assert.equal(f.bound.classification.filter(item=>item.editableHere).length,1);
 for(let slideIndex=2;slideIndex<=7;slideIndex++)assert.throws(()=>bindCurrentTreemap(f.input,f.source,{...selection,slideIndex}),/Only current treemap/);
 const changed=structuredClone(f.source);changed.slides[0].chart.data.rows[0][1]++;
 assert.throws(()=>bindCurrentTreemap(f.input,changed,selection),/reviewed exact all-seven/);
});
test('real public original/saved imports and complete raw signature permit only one coherent treemap value',async()=>{
 const f=await fixture(),result=compareCurrentTreemapEdit(f);assert.equal(result.nativeAcceptance,false);assert.equal(result.nativeMapQualified,false);assert.equal(result.rawOoxmlStyleFidelity,'strict-current-raw-signature-match');assert.equal(result.raw.maskedValueLeaves,3);
});
test('unknown chart attributes, current theme style and external resource links refuse raw preservation',async()=>{
 const f=await fixture();
 for(const mode of ['chart-attribute','theme-style','external-resource']){
  const parts=deps.unzipSync(f.saved);
  if(mode==='chart-attribute')change(parts,f.action.chartPart,text=>text.replace('<cx:chartSpace ','<cx:chartSpace unreviewedStyle="changed" '));
  if(mode==='theme-style'){
   const file=Object.keys(parts).find(name=>/^ppt\/theme\/theme\d+\.xml$/u.test(name));assert.ok(file);
   change(parts,file,text=>{const after=text.replace(/(<a:clrScheme\b[^>]*\bname=")[^"]*"/u,(_all,start)=>start+'CURRENT STYLE CHANGE"');assert.notEqual(after,text);return after;});
  }
  if(mode==='external-resource')change(parts,'ppt/slides/_rels/slide1.xml.rels',text=>once(text,'</Relationships>','<Relationship Id="rIdUnreviewedStyle" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="https://example.invalid/never-fetched" TargetMode="External"/></Relationships>'));
  assert.throws(()=>assertSevenValueRawPreservation({...f,saved:zip(parts)}),/raw style|External style|inventory changed/);
 }
});
test('public unknown extensions retain all whitespace and xml:space content in raw proof',async()=>{
 const f=await fixture();
 for(const preserve of [false,true]){
  const payload='<audit:payload xmlns:audit="urn:opf:test-unknown"'+(preserve?' xml:space="preserve"':'')+'>  <audit:child/> \t</audit:payload>',extension='<cx:extLst><cx:ext uri="{OPF-UNKNOWN-WHITESPACE-CONTROL}">'+payload+'</cx:ext></cx:extLst>';
  const original=deps.unzipSync(f.input),saved=deps.unzipSync(f.saved);
  for(const parts of [original,saved])change(parts,f.action.chartPart,text=>once(text,'</cx:chartSpace>',extension+'</cx:chartSpace>'));
  const input=zip(original),coherent=zip(saved),action=bindCurrentTreemap(input,f.source,selection).action;
  assert.equal(assertSevenValueRawPreservation({input,saved:coherent,action,deps,archiveContext:f.archiveContext}).maskedValueLeaves,3);
  const before=await fromPptx(input),after=await fromPptx(coherent);assert.equal(before.slides[0].chart.data.rows[0][1],42);assert.equal(after.slides[0].chart.data.rows[0][1],43);
  for(const changedPayload of [payload.replace('>  <audit:child/> \t<','>\n<audit:child/>\t<'),...(preserve?[payload.replace('xml:space="preserve"','xml:space="default"')]:[])]){
   const mutant=deps.unzipSync(coherent);change(mutant,f.action.chartPart,text=>once(text,payload,changedPayload));const bytes=zip(mutant);
   assert.deepEqual(await fromPptx(bytes),after,'Public reader may omit an unknown extension; raw proof must still reject its changed values');
   assert.throws(()=>assertSevenValueRawPreservation({input,saved:bytes,action,deps,archiveContext:f.archiveContext}),/Unknown raw style/);
  }
 }
});
test('four immutable historical default models stay deep and JSON-byte equivalent to exact ea0f inspector source',()=>{
 const directory=fileURLToPath(new URL('./test-fixtures/seven-chart/',import.meta.url)),census=JSON.parse(fs.readFileSync(new URL('./seven-value-corpus.json',import.meta.url),'utf8'));
 assert.equal(digest(fs.readFileSync(new URL('./test-fixtures/seven-value-old-inspector.mjs',import.meta.url))),'5f28663a38045a5ab98b8be8ab6beacd7312f8b141d03cfaa15deee6e159b990');
 for(const record of census.archives){const input=fs.readFileSync(path.join(directory,record.path));assert.equal(digest(input),record.sha256);const before=frozenDefaultInspector(input,deps),after=inspectSevenArchive(input,deps);assert.deepEqual(after,before);assert.equal(JSON.stringify(after),JSON.stringify(before));}
});
test('only explicit current context reads the exact static signed Pareto combo; malformed mixed models refuse',async()=>{
 const f=await fixture();assert.throws(()=>inspectSevenArchive(f.input,deps),/Mixed classic chart/);
 const actual=f.bound.archive.slides[2].shapes.find(shape=>shape.kind==='chart').chart;assert.equal(actual.family,'classic');assert.equal(actual.construct,'currentSignedParetoComboV1');assert.equal(actual.series.length,2);assert.equal(actual.groups.length,2);assert.equal(actual.axes.length,4);
 const base=deps.strFromU8(deps.unzipSync(f.input)['ppt/charts/chart3.xml']),bar=/<c:barChart>[\s\S]*?<\/c:barChart>/u.exec(base)[0],line=/<c:lineChart>[\s\S]*?<\/c:lineChart>/u.exec(base)[0],lineSeries=/<c:ser>[\s\S]*?<\/c:ser>/u.exec(line)[0];
 const mutations=[
  ['missing-line',text=>once(text,line,'')],['duplicate-bar',text=>once(text,bar,bar+bar)],['reordered-groups',text=>once(once(text,bar,'@BAR@'),line,line+bar).replace('@BAR@','')],
  ['third-construct',text=>once(text,'</c:plotArea>','<c:areaChart/></c:plotArea>')],['extra-line-series',text=>once(text,line,line.replace(lineSeries,lineSeries+lineSeries))],['missing-line-series',text=>once(text,line,line.replace(lineSeries,''))],
  ['wrong-direction',text=>once(text,'<c:barDir val="col"/>','<c:barDir val="bar"/>')],['wrong-grouping',text=>once(text,'<c:grouping val="clustered"/>','<c:grouping val="stacked"/>')],['wrong-gap',text=>once(text,'<c:gapWidth val="6"/>','<c:gapWidth val="7"/>')],
  ['duplicate-axis',text=>text.replace(/2094734553/g,'2094734552')],['nonreciprocal-axis',text=>once(text,'<c:crossAx val="2094734552"/>','<c:crossAx val="2094734553"/>')],
  ['swapped-group-pairs',text=>once(once(text,bar,bar.replace(/2094734554/g,'2094734555').replace(/2094734552/g,'2094734553')),line,line.replace(/2094734555/g,'2094734554').replace(/2094734553/g,'2094734552'))],
  ['wrong-primary-min',text=>once(text,'<c:min val="-20"/>','<c:min val="-21"/>')],['wrong-primary-max',text=>once(text,'<c:max val="50"/>','<c:max val="51"/>')],['wrong-secondary-max',text=>once(text,'<c:max val="1"/>','<c:max val="2"/>')],
  ['wrong-cumulative-cache',text=>once(text,'<c:v>0.7934782608695652</c:v>','<c:v>0.8</c:v>')],['wrong-category',text=>once(text,line,line.replace('<c:v>North</c:v>','<c:v>Other</c:v>'))],
 ];
 for(const [name,edit]of mutations){const parts=deps.unzipSync(f.input);change(parts,'ppt/charts/chart3.xml',text=>{const next=edit(text);assert.notEqual(next,text,name);return next;});assert.throws(()=>inspectSevenArchive(zip(parts),deps,f.archiveContext),undefined,name);}
 const coherent=deps.unzipSync(f.input),combo=f.bound.archive.slides[2].shapes.find(shape=>shape.kind==='chart').chart;
 change(coherent,'ppt/charts/chart3.xml',text=>once(text,'<c:v>0.7934782608695652</c:v>','<c:v>0.8</c:v>'));const book=deps.unzipSync(coherent[combo.workbook.part]);change(book,'xl/worksheets/sheet1.xml',text=>once(text,'<c r="C3"><v>0.7934782608695652</v></c>','<c r="C3"><v>0.8</v></c>'));coherent[combo.workbook.part]=deps.zipSync(book);
 assert.throws(()=>inspectSevenArchive(zip(coherent),deps,f.archiveContext),/complete signed\/cumulative cache|complete sorted\/derived workbook/,'Even coherent derived-cache/workbook edits cannot be waived as recalculation');
 const context=currentSevenArchiveContext();assert.throws(()=>inspectSevenArchive(f.input,deps,{...context,fixture:{...context.fixture,sha256:'0'.repeat(64)}}));assert.throws(()=>inspectSevenArchive(f.input,deps,{...context,source:{slides:[]}}));
});
