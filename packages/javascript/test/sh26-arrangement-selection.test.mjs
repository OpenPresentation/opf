import assert from 'node:assert/strict';
import {test} from 'node:test';
import {composeSlide,OPFCompositionError} from '../dist/composition.js';
import {paginate,continueOverfull,paginateSlide,OPFPaginationError} from '../dist/pagination.js';
import {resolveSlideContext} from '../dist/index.js';
import {layouts,sampleSlide} from './support/template-samples.mjs';

const cases=['inverted-pyramid','org-chart','hierarchy'].flatMap(id=>[5,6].map(count=>({id,count,slide:sampleSlide(layouts[id],count,'long')})));
const bodies=geometry=>geometry.items.filter(item=>item.path.includes('.blocks.')&&item.text&&'listEntries'in item.text);
const fits=item=>item.listColumns?.map(column=>column.text)??[item.text];
const entries=item=>fits(item).flatMap(fit=>fit.listEntries);
const labels=slide=>slide.blocks.flatMap(block=>block.items??[]);
const fitFindings=geometry=>geometry.diagnostics.filter(entry=>entry.code==='text-overflow'||entry.code==='small-cell');
const documentFor=(slide,id)=>({catalogs:{custom:{layouts:{[id]:layouts[id]}}},slides:[{layout:id,...structuredClone(slide)}]});
const drawn=(document,index)=>{const{slide,options}=resolveSlideContext(document,index);return composeSlide(slide,options);};

for(const source of cases){
  test(`${source.id} ${source.count} long: equal fit failures retain every source font and refusal`,()=>{
    const saved=structuredClone(source.slide),geometry=composeSlide(source.slide,{layout:layouts[source.id]}),items=bodies(geometry);
    assert.deepEqual(source.slide,saved);
    assert.equal(items.length,source.count);
    assert.deepEqual(items.map(item=>item.path),source.slide.blocks.map((_,i)=>`slides.0.blocks.${i}.items`));
    assert.deepEqual(items.flatMap(item=>entries(item).map(entry=>entry.value)),labels(source.slide).map(value=>typeof value==='object'?value.text:value));
    assert.ok(items[0].text.fontSize>=64/3-1e-6,'Retain the 21.3px settled first block instead of selecting 16px');
    assert.ok(items.slice(1).every(item=>item.text.fontSize>=16),'Every other source block keeps its font');
    assert.equal(fitFindings(geometry).length,source.count,'All genuine fit refusals remain visible');
    assert.equal(geometry.diagnostics.filter(entry=>entry.code==='layout-unplaced').length,source.count-1);
    assert.ok(geometry.diagnostics.some(entry=>entry.code==='text-overflow'&&/70 characters/.test(entry.message)));
    assert.throws(()=>composeSlide({...source.slide,composition:{overflow:'error'}},{layout:layouts[source.id]}),OPFCompositionError);
  });
  for(const wholeBlocks of[false,true])test(`${source.id} ${source.count} long: ${wholeBlocks?'whole-block continuation fits or refuses':'default pagination fits'} pagination retains exact ordered content and readable type`,()=>{
    const document=documentFor(source.slide,source.id),saved=structuredClone(document),result=wholeBlocks?continueOverfull(document,{minFontSize:24}):paginate(document);
    assert.deepEqual(document,saved);
    assert.deepEqual(result.presentation.slides.flatMap(labels),labels(source.slide));
    if(wholeBlocks&&source.id!=='inverted-pyramid'){
      assert.deepEqual(result.presentation,document,'An indivisible unfit list keeps the original document and its findings');
      const context=resolveSlideContext(document,0);
      assert.throws(()=>paginateSlide(context.slide,{...context.options,wholeBlocks:true,minFontSize:24}),OPFPaginationError);
      assert.equal(fitFindings(drawn(result.presentation,0)).length,source.count);
      return;
    }
    assert.ok(result.presentation.slides.length>1);
    for(let index=0;index<result.presentation.slides.length;index++){
      const geometry=drawn(result.presentation,index);assert.deepEqual(fitFindings(geometry),[]);
      for(const item of bodies(geometry)){
        assert.ok(item.text.fontSize>=24-1e-6,'Returned readable pages honor the 24px floor');
        for(const entry of entries(item))for(const line of entry.text.richLines)assert.ok(line.fragments.map(fragment=>fragment.text).join('').trim().length<=70,'Whole-word reading measure');
      }
    }
    if(wholeBlocks)assert.deepEqual(result.presentation.slides.flatMap(slide=>slide.blocks.map(block=>block.items)),source.slide.blocks.map(block=>block.items),'Whole-block continuation keeps each original list together');
  });
}

test('strictly fewer fit failures still outrank an equal-font joined arrangement',()=>{
  const slide=sampleSlide(layouts['org-chart'],5,'long');slide.composition={minFontSize:16,maxFontSize:16};
  const selected=composeSlide(slide,{layout:layouts['org-chart'],recompose:false});
  assert.equal(fitFindings(selected).length,4);
  assert.equal(bodies(selected).filter(item=>item.region===undefined).length,4);
  assert.ok(bodies(selected).every(item=>item.text.fontSize===16));
  assert.deepEqual(bodies(selected).flatMap(item=>entries(item).map(entry=>entry.value)),labels(slide).map(value=>value.text));
});

test('equal fit failures without font dominance keep the joined arrangement',()=>{
  const slide=sampleSlide(layouts['org-chart'],5,'long');slide.composition={minFontSize:22,maxFontSize:22};
  const selected=composeSlide(slide,{layout:layouts['org-chart'],recompose:false});
  assert.equal(fitFindings(selected).length,5);
  assert.equal(geometryUnplaced(selected),0);
  assert.ok(bodies(selected).every(item=>item.region==='people'&&item.text.fontSize===22));
  assert.deepEqual(bodies(selected).flatMap(item=>entries(item).map(entry=>entry.value)),labels(slide).map(value=>value.text));
});
const geometryUnplaced=geometry=>geometry.diagnostics.filter(entry=>entry.code==='layout-unplaced').length;


test('mixed fallback composition keeps non-text payloads as well as every list source',()=>{
  const slide=sampleSlide(layouts['org-chart'],5,'long');
  const image={src:'data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22/%3E',alt:'Complete original non-text payload'};
  slide.blocks.push({image});const saved=structuredClone(slide);
  const geometry=composeSlide(slide,{layout:layouts['org-chart']}),item=geometry.items.find(item=>item.path==='slides.0.blocks.5.image');
  assert.deepEqual(slide,saved);assert.ok(item);assert.deepEqual(item.value,image);
  assert.deepEqual(bodies(geometry).flatMap(item=>entries(item).map(entry=>entry.value)),labels(slide).map(value=>value.text));
});

