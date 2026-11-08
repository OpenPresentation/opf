import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {resolveSlideContext} from '../dist/index.js';
import {composeSlide,layoutFurniture,OPFCompositionError} from '../dist/composition.js';
import {paginate,OPFPaginationError} from '../dist/pagination.js';
import {gallery} from '@openpresentation/gallery';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/sh26-readable-continuations.json',import.meta.url)));
const layout=id=>structuredClone(gallery.layouts[id]);
const documentFor=(slide,id=slide.layout)=>({catalogs:{custom:{layouts:{[id]:layout(id)}}},slides:[structuredClone(slide)]});
const compose=(document,extra={},index=0)=>{const{slide,options}=resolveSlideContext(document,index);return composeSlide(slide,{...options,...extra});};
const body=result=>result.items.filter(item=>item.path.includes('.blocks.')&&item.text&&'listEntries'in item.text);
const fits=item=>item.listColumns?.map(column=>column.text)??[item.text];
const entries=item=>fits(item).flatMap(fit=>fit.listEntries);
for(const source of fixture.cases)test(`${source.key}: complete continuation wraps to70 without reducing settled type`,()=>{
  const document=documentFor(source.slide),saved=structuredClone(document),result=compose(document),lists=body(result);
  assert.equal(lists.length,1);assert.deepEqual(document,saved);
  assert.equal(result.diagnostics.filter(d=>d.code==='text-overflow').length,0);
  const item=lists[0];assert.ok(item.text.fontSize>=source.settledBodyFonts[0]-1e-6,'Retain or grow the settled source size');
  for(const entry of entries(item))for(const line of entry.text.richLines)assert.ok(line.fragments.map(fragment=>fragment.text).join('').trim().length<=70,'Whole-word reading measure');
  assert.deepEqual(entries(item).map(entry=>entry.value),source.slide.blocks[0].items);
  assert.deepEqual(entries(item).map(entry=>entry.index),source.slide.blocks[0].items.map((_,i)=>i));
  assert.deepEqual(entries(item).map(entry=>entry.textPath),source.slide.blocks[0].items.map((_,i)=>`slides.0.blocks.0.items.${i}`));
  assert.ok(entries(item).every(entry=>entry.marker.text==='•'));
});
for(const source of fixture.cases)test(`${source.slide.layout}: actual paginator retains every whole source label and returns readable pages`,()=>{
  const document=documentFor(source.sourceSlide),saved=structuredClone(document),result=paginate(document);
  assert.deepEqual(document,saved);
  assert.deepEqual(result.presentation.slides.flatMap(slide=>slide.blocks.flatMap(block=>block.items??[])),source.sourceSlide.blocks.flatMap(block=>block.items));
  assert.ok(result.presentation.slides.length>=4);
  for(let page=0;page<result.presentation.slides.length;page++){
    const drawn=compose(result.presentation,{},page);assert.ok(!drawn.diagnostics.some(d=>d.code==='text-overflow'));
    for(const item of body(drawn))for(const entry of entries(item))for(const line of entry.text.richLines)assert.ok(line.fragments.map(fragment=>fragment.text).join('').trim().length<=70);
  }
});
test('six long labels use spare space to grow beyond the frozen26px fallback without longer lines',()=>{
  const doc=documentFor(fixture.cases[0].slide);doc.slides[0].blocks[0].items=doc.slides[0].blocks[0].items.slice(0,6);
  const result=compose(doc),item=body(result)[0];assert.ok(item.text.fontSize>26);assert.ok(item.listColumns.length===2);
  assert.deepEqual(entries(item).map(entry=>entry.value),doc.slides[0].blocks[0].items);
  assert.ok(entries(item).every(entry=>entry.text.richLines.every(line=>line.fragments.map(f=>f.text).join('').trim().length<=70)));
});
test('fallback reflow keeps headings, title decoration, exact frame and footer unchanged',()=>{
  const doc=documentFor(fixture.cases[0].slide);doc.design={footer:{left:{text:'Complete original footer'},right:{text:'{{slide.number}}'}}};
  const plain=structuredClone(doc);for(const region of plain.catalogs.custom.layouts['inverted-pyramid'].regions){delete region.arrangement;delete region.pyramidDirection;}
  const before=compose(plain),after=compose(doc),heading=g=>g.items.filter(item=>!item.path.includes('.blocks.'));
  assert.deepEqual(heading(after),heading(before));assert.deepEqual(after.titleRule,before.titleRule);
  assert.deepEqual(after.furniture,before.furniture);assert.equal(after.furniture.parts.length,2);
  assert.deepEqual(body(after)[0].frameBox,body(before)[0].frameBox);
  const ctx=resolveSlideContext(doc,0);assert.deepEqual(after.furniture,layoutFurniture(ctx.slide,ctx.options));
});
test('explicit cap and fill:false retain settled26px while preserving the reading measure',()=>{
  for(const mode of['cap','fill']){
    const doc=documentFor(fixture.cases[0].slide);if(mode==='cap')doc.slides[0].composition.maxFontSize=26;
    const result=compose(doc,mode==='fill'?{fill:false}:{}),item=body(result)[0];assert.equal(item.text.fontSize,26);
    assert.ok(entries(item).every(entry=>entry.text.richLines.every(line=>line.fragments.map(f=>f.text).join('').trim().length<=70)));
  }
});
test('a matched diagram region listColumns:1 stays single-column without a payload override',()=>{
  const doc=documentFor(fixture.cases[0].slide),record=doc.catalogs.custom.layouts['inverted-pyramid'];record.regions.find(region=>region.name==='levels').listColumns=1;
  const result=compose(doc),item=body(result)[0];assert.equal(item.payload.columns,undefined);assert.equal(item.listColumns,undefined);assert.deepEqual(item.value,doc.slides[0].blocks[0].items);
  assert.ok(result.diagnostics.some(d=>d.code==='text-overflow'&&/70 characters/.test(d.message)));
  doc.slides[0].composition.overflow='error';assert.throws(()=>compose(doc),OPFCompositionError);
});
test('described singleton columns keep maintained column roles and whole description text',()=>{
  const doc=documentFor(fixture.cases[1].slide);doc.slides[0].composition.maxFontSize=26;doc.slides[0].blocks[0].items=doc.slides[0].blocks[0].items.slice(0,2).map(text=>({text,description:'Supporting detail remains in its authored entry. '.repeat(2)}));
  const result=compose(doc),item=body(result)[0];assert.ok(!result.diagnostics.some(d=>d.code==='text-overflow'));
  assert.deepEqual(entries(item).map(entry=>entry.value),doc.slides[0].blocks[0].items.map(value=>value.text));assert.deepEqual(entries(item).map(entry=>entry.descriptionValue),doc.slides[0].blocks[0].items.map(value=>value.description));
  const singleton=item.listColumns?.find(column=>column.end-column.start===1);assert.ok(singleton,'Actually exercise a split with one described entry');
  assert.equal(singleton.text.listEntries[0].heading,undefined,'Slicing a described list must not invent a singleton heading');
  assert.equal(singleton.text.listEntries[0].text.fontSize,singleton.text.fontSize);
  assert.ok(singleton.text.listEntries[0].description.fontSize<=singleton.text.fontSize);
  for(const entry of entries(item))for(const fit of[entry.text,entry.description].filter(Boolean))for(const line of fit.richLines)assert.ok(line.fragments.map(fragment=>fragment.text).join('').trim().length<=70);
});
test('an explicit single column and pinned region refuse an unfit retained-size reading measure',()=>{
  const doc=documentFor(fixture.cases[0].slide);doc.slides[0].blocks[0].columns=1;doc.slides[0].blocks[0].region='levels';
  const result=compose(doc),item=body(result)[0];assert.equal(item.region,'levels');assert.equal(item.listColumns,undefined);
  assert.deepEqual(item.value,doc.slides[0].blocks[0].items);assert.ok(item.text.fontSize>=26);
  assert.ok(result.diagnostics.some(d=>d.code==='text-overflow'&&/70 characters/.test(d.message)));
  doc.slides[0].composition.overflow='error';assert.throws(()=>compose(doc),OPFCompositionError);
});
test('RTL columns retain source order, numbering and exact authored gap',()=>{
  const doc=documentFor(fixture.cases[1].slide);doc.language='ar-SA';doc.slides[0].composition.gap=.02;doc.slides[0].blocks[0].numbering='arabic';
  const result=compose(doc),item=body(result)[0];assert.ok(item.listColumns.length>1);assert.ok(item.listColumns[0].box.x>item.listColumns[1].box.x);
  assert.deepEqual(entries(item).map(entry=>entry.value),doc.slides[0].blocks[0].items);assert.deepEqual(entries(item).map(entry=>entry.marker.number.value),[1,2,3,4,5,6,7]);
  const [right,left]=item.listColumns;assert.ok(Math.abs(right.box.x-left.box.x-left.box.width-.02*720)<.01);
});
test('rich label runs retain their authored text, emphasis, language and family',()=>{
  const doc=documentFor(fixture.cases[2].slide);doc.slides[0].blocks[0].items=doc.slides[0].blocks[0].items.map(text=>[{text:text.slice(0,8),bold:true,lang:'en-US'},text.slice(8)]);
  const saved=structuredClone(doc),result=compose(doc),item=body(result)[0];assert.deepEqual(doc,saved);assert.deepEqual(entries(item).map(entry=>entry.value),doc.slides[0].blocks[0].items);
  const fragments=entries(item).flatMap(entry=>entry.text.richLines.flatMap(line=>line.fragments));assert.ok(fragments.some(fragment=>fragment.run?.bold===true));assert.ok(fragments.filter(fragment=>fragment.run?.bold).every(fragment=>fragment.run.lang==='en-US'));
  assert.ok(fragments.every(fragment=>fragment.style.fontFamily===item.textStyle.fontFamily));
});
test('actual Venn circles and valid tree nodes keep their native arrangement rather than becoming fallback columns',()=>{
  for(const id of['venn','org-chart','hierarchy']){
    const items=id==='venn'?['First','Second','Third']:[{text:'Root',level:0},{text:'First',level:1},{text:'Second',level:1}];
    const result=compose(documentFor({layout:id,title:'Native groups remain',blocks:[{items}]})),arrangement=result.arrangements[0];assert.equal(arrangement.kind,id);assert.equal(arrangement.nodes.length,3);assert.deepEqual(body(result)[0].value,items);assert.ok(body(result)[0].text.fontSize>=32);
  }
});
test('a generic list region beside an unused diagram region is outside the fallback policy',()=>{
  const record={name:'Mixed layout',direction:'column',regions:[{name:'title'},{name:'sets',accepts:['list'],arrangement:'venn',empty:'collapse',size:1},{name:'notes',accepts:['list'],role:'primary',flow:'none',size:1}]};
  const slide=structuredClone(fixture.cases[0].slide);slide.blocks[0].region='notes';slide.blocks[0].columns=1;
  const result=composeSlide(slide,{layout:record}),item=body(result)[0];assert.equal(item.region,'notes');assert.equal(item.listColumns,undefined);assert.ok(item.text.lines.some(line=>line.trim().length>70));assert.ok(!result.diagnostics.some(d=>/diagram fallback/.test(d.message)));
});
test('unrelated plain lists keep their existing full-width lines and irreducible fallback words refuse pagination',()=>{
  const doc=documentFor(fixture.cases[0].slide);delete doc.slides[0].layout;const ordinary=compose(doc);assert.ok(body(ordinary)[0].text.lines.some(line=>line.trim().length>70));
  const impossible=documentFor({layout:'org-chart',title:'Complete unbreakable word',blocks:[{items:['x'.repeat(80)]}]});
  assert.ok(compose(impossible).diagnostics.some(d=>d.code==='text-overflow'));assert.throws(()=>paginate(impossible),OPFPaginationError);
});


test('an originally single described heading retains its heading scale, weight and complete description',()=>{
  const doc=documentFor(fixture.cases[1].slide);doc.slides[0].blocks[0].items=[{text:'A complete authored heading',description:'Supporting detail remains in its authored entry. '.repeat(5)}];
  const result=compose(doc),item=body(result)[0],entry=entries(item)[0];
  assert.ok(!result.diagnostics.some(d=>d.code==='text-overflow'));assert.equal(entry.heading,true);assert.ok(entry.text.fontSize>item.text.fontSize);
  assert.ok(entry.text.richLines.flatMap(line=>line.fragments).every(fragment=>fragment.style.fontWeight===700));assert.deepEqual(entry.descriptionValue,doc.slides[0].blocks[0].items[0].description);
  for(const fit of[entry.text,entry.description])for(const line of fit.richLines)assert.ok(line.fragments.map(fragment=>fragment.text).join('').trim().length<=70);
});

test('structured numbered families stay whole across fallback columns with exact levels and source paths',()=>{
  const doc=documentFor(fixture.cases[2].slide),text=doc.slides[0].blocks[0].items[0];
  doc.slides[0].blocks[0].numbering='arabic';doc.slides[0].blocks[0].items=[0,1,2,3,4,5].map((_,index)=>({text,level:index%2}));
  const result=compose(doc),item=body(result)[0],all=entries(item);assert.ok(!result.diagnostics.some(d=>d.code==='text-overflow'));assert.ok(item.listColumns.length>1);
  assert.deepEqual(all.map(entry=>entry.level),[0,1,0,1,0,1]);assert.deepEqual(all.map(entry=>entry.index),[0,1,2,3,4,5]);assert.deepEqual(all.map(entry=>entry.value),doc.slides[0].blocks[0].items.map(entry=>entry.text));
  assert.ok(item.listColumns.every(column=>column.start%2===0&&column.end%2===0));assert.ok(all.every(entry=>entry.marker.number));assert.ok(all.every(entry=>entry.heading===undefined));
  assert.deepEqual(all.map(entry=>entry.textPath),doc.slides[0].blocks[0].items.map((_,index)=>'slides.0.blocks.0.items.'+index+'.text'));
});


test('an explicit payload auto count overrides an authored nested region single-column rule',()=>{
  const doc=documentFor(fixture.cases[0].slide),record=doc.catalogs.custom.layouts['inverted-pyramid'],region=record.regions.find(region=>region.name==='levels');
  region.listColumns=1;record.regions=[record.regions[0],{direction:'column',regions:[region]}];doc.slides[0].blocks[0].columns='auto';
  const result=compose(doc),item=body(result)[0];assert.ok(!result.diagnostics.some(d=>d.code==='text-overflow'));assert.ok(item.listColumns.length>1);assert.deepEqual(entries(item).map(entry=>entry.value),doc.slides[0].blocks[0].items);
});
