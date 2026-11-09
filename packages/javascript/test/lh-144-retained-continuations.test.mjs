import assert from 'node:assert/strict';
import {test} from 'node:test';
import {composeSlide} from '../dist/composition.js';
import {continueOverfull,paginateSlide,OPFPaginationError} from '../dist/pagination.js';
import {resolveSlideContext} from '../dist/index.js';
import {layouts,sampleSlide} from './support/template-samples.mjs';
const documentFor=(id,count=5)=>({catalogs:{custom:{layouts:{[id]:layouts[id]}}},slides:[{layout:id,...sampleSlide(layouts[id],count,'long')}]});
const geometry=(doc,index)=>{const {slide,options}=resolveSlideContext(doc,index);return composeSlide(slide,options);};
const bodies=g=>g.items.filter(item=>item.path.includes('.blocks.')&&item.text&&'listEntries'in item.text);
const fragments=item=>(item.listColumns??[{text:item.text}]).flatMap(column=>column.text.listEntries.flatMap(entry=>entry.text.richLines.flatMap(line=>line.fragments.filter(fragment=>fragment.kind===undefined&&fragment.text.trim()))));
const labels=doc=>doc.slides.flatMap(slide=>slide.blocks.flatMap(block=>block.items));
const fitIssues=g=>g.diagnostics.filter(issue=>issue.code==='text-overflow'||issue.code==='small-cell');
for(const {id,count,offset} of [{id:'inverted-pyramid',count:5,offset:0},{id:'inverted-pyramid',count:5,offset:1},{id:'pyramid',count:6,offset:0}])test(`default whole-block continuation retains source readability and every entry, ${id} ${count} source index ${offset}`,()=>{
 const doc=documentFor(id,count);
 if(offset){doc.language='ar';doc.slides.unshift({title:'Introduction'});}
 const saved=structuredClone(doc),source=geometry(doc,offset),settled=fragments(bodies(source)[0])[0].fontSize;
 assert.ok(settled>=64/3-1e-6);
 const result=continueOverfull(doc),pages=result.presentation.slides.slice(offset);
 assert.deepEqual(doc,saved);
 assert.deepEqual(pages.map(page=>page.blocks.length),count===5?[2,2,1]:[2,2,2]);
 assert.deepEqual(labels({slides:pages}),labels({slides:doc.slides.slice(offset)}));
 assert.equal(labels({slides:pages}).length,count*7);
 assert.deepEqual(pages.flatMap(page=>page.blocks),doc.slides[offset].blocks,'whole blocks stay byte-for-byte authored');
 let firstMaximum;
 for(let page=offset;page<result.presentation.slides.length;page++){
  const drawn=geometry(result.presentation,page),fonts=bodies(drawn).flatMap(fragments).map(fragment=>fragment.fontSize);
  assert.deepEqual(fitIssues(drawn),[]);
  assert.ok(fonts.every(size=>size>=settled-1e-6),`page ${page}: ${fonts} retains ${settled}`);
  firstMaximum??=Math.max(...fonts);
  assert.ok(fonts.every(size=>size<=firstMaximum+1e-6),'actual painted continuation text obeys the first-page cap');
  assert.ok((drawn.arrangements??[]).every(arrangement=>arrangement.fontSize<=firstMaximum+1e-6));
  assert.equal(result.presentation.slides[page].composition?.minFontSize,undefined,'no derived minimum override');
 }
 assert.equal(result.continued[0].sourceSlideIndex,offset);
 assert.deepEqual(result.continued[0].blocks,count===5?[[0,1],[2,3],[4]]:[[0,1],[2,3],[4,5]]);
});
test('actual arrangements and their rich fragments honor an explicit body cap',()=>{
 const doc=documentFor('inverted-pyramid',2);doc.slides[0].composition={maxFontSize:17};
 const drawn=geometry(doc,0);
 assert.deepEqual(fitIssues(drawn),[]);
 assert.deepEqual(bodies(drawn).flatMap(item=>item.value),doc.slides[0].blocks.flatMap(block=>block.items));
 assert.ok(bodies(drawn).flatMap(fragments).every(fragment=>fragment.fontSize<=17+1e-6));
 assert.ok((drawn.arrangements??[]).every(arrangement=>arrangement.fontSize<=17+1e-6));
});
for(const id of ['org-chart','hierarchy'])test(`${id}: unfit whole units keep full source and explicit refusal`,()=>{
 const doc=documentFor(id),saved=structuredClone(doc),result=continueOverfull(doc);
 assert.deepEqual(result.presentation,saved);assert.deepEqual(result.continued,[]);
 assert.equal(labels(result.presentation).length,35);
 const context=resolveSlideContext(doc,0);
 assert.throws(()=>paginateSlide(context.slide,{...context.options,wholeBlocks:true}),OPFPaginationError);
 assert.ok(fitIssues(geometry(result.presentation,0)).length);
});
test('a real arrangement, not only a fallback list, obeys the automatic cap',()=>{
 const doc=documentFor('inverted-pyramid',1);
 doc.slides[0]={layout:'inverted-pyramid',...sampleSlide(layouts['inverted-pyramid'],1,'short'),composition:{maxFontSize:24}};
 const drawn=geometry(doc,0);
 assert.ok(drawn.arrangements.length>0,'exercise actually drawn arrangement nodes');
 assert.ok(drawn.arrangements.every(arrangement=>arrangement.fontSize<=24+1e-6));
 assert.ok(bodies(drawn).flatMap(fragments).every(fragment=>fragment.fontSize<=24+1e-6));
 assert.deepEqual(fitIssues(drawn),[]);
});
test('authored rich sizes and styles remain distinct from automatic body targets',()=>{
 const doc=documentFor('inverted-pyramid');
 doc.slides[0].blocks[1].items=doc.slides[0].blocks[1].items.map(text=>({text:[{text,fontSize:12,fontFamily:'Roboto',bold:true,italic:true}]}));
 const saved=structuredClone(doc),source=geometry(doc,0),automatic=fragments(bodies(source)[0])[0].fontSize;
 const originalExplicit=bodies(source).flatMap(fragments).filter(fragment=>fragment.run.fontSize===12);
 assert.ok(originalExplicit.length);
 const explicitSize=Math.min(...originalExplicit.map(fragment=>fragment.fontSize));
 const result=continueOverfull(doc);
 assert.equal(result.continued.length,1);
 assert.deepEqual(doc,saved);assert.deepEqual(result.presentation.slides.flatMap(slide=>slide.blocks),doc.slides[0].blocks);
 const painted=result.presentation.slides.flatMap((_,index)=>bodies(geometry(result.presentation,index)).flatMap(fragments));
 const explicit=painted.filter(fragment=>fragment.run.fontSize===12);
 assert.ok(explicit.length);
 assert.ok(explicit.every(fragment=>fragment.fontSize>=explicitSize-1e-6));
 assert.ok(explicit.some(fragment=>fragment.fontSize<automatic-1e-6),'explicit smaller rich text is not pooled with automatic body');
 assert.ok(explicit.every(fragment=>fragment.run.fontFamily==='Roboto'&&fragment.run.bold&&fragment.run.italic));
 assert.ok(painted.filter(fragment=>fragment.run.fontSize===undefined).every(fragment=>fragment.fontSize>=automatic-1e-6));
});
for(const composition of [{maxFontSize:18},{minFontSize:24}])test(`authored composition constraints survive continuation ${JSON.stringify(composition)}`,()=>{
 const doc=documentFor('inverted-pyramid');doc.slides[0].composition=composition;
 const saved=structuredClone(doc),result=continueOverfull(doc);
 assert.equal(result.continued.length,1);assert.deepEqual(doc,saved);
 assert.deepEqual(result.presentation.slides.flatMap(slide=>slide.blocks),doc.slides[0].blocks);
 for(let index=0;index<result.presentation.slides.length;index++){
  const slide=result.presentation.slides[index],drawn=geometry(result.presentation,index),fonts=bodies(drawn).flatMap(fragments).map(fragment=>fragment.fontSize);
  assert.equal(slide.composition.minFontSize,composition.minFontSize);
  if(composition.maxFontSize)assert.ok(fonts.every(size=>size<=composition.maxFontSize+1e-6));
  if(composition.minFontSize)assert.ok(fonts.every(size=>size>=composition.minFontSize-1e-6));
  assert.deepEqual(fitIssues(drawn),[]);
 }
});
