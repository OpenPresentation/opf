import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {gallery} from '@openpresentation/gallery';
import {paginate} from '@openpresentation/opf/pagination';
import {resolvePresentation} from '../dist/index.js';
import {loadFonts} from '../dist/fonts-node.js';
const fixture=JSON.parse(readFileSync(new URL('../../javascript/test/fixtures/sh26-readable-continuations.json',import.meta.url)));
const lists=geometry=>geometry.items.filter(item=>item.text&&'listEntries'in item.text);
const fits=item=>item.listColumns?.map(column=>column.text)??[item.text];
for(const source of fixture.cases)test(`SH-26 measured ${source.slide.layout}: real office fonts refuse the unfit32px body and paginate complete items without shrinking`,async()=>{
  const deck={catalogs:{custom:{layouts:{[source.slide.layout]:structuredClone(gallery.layouts[source.slide.layout])}}},slides:[structuredClone(source.slide)]},saved=structuredClone(deck);
  const fonts=await loadFonts({pack:'office',substitutionPolicy:'visual',scripts:'auto',presentation:deck});await fonts.ensure(deck,{renderOptions:{catalogs:[gallery]}});
  const draw=presentation=>resolvePresentation(presentation,{fonts,catalogs:[gallery],date:'2026-11-08'}).slides.map(slide=>slide.geometry);
  const original=draw(deck)[0],item=lists(original)[0];assert.equal(item.text.fontSize,32);assert.ok(item.text.overflow);assert.ok(original.diagnostics.some(d=>d.code==='text-overflow'&&/70 characters/.test(d.message)));
  const plain=structuredClone(deck);for(const region of plain.catalogs.custom.layouts[source.slide.layout].regions){delete region.arrangement;delete region.pyramidDirection;}
  const baseline=draw(plain)[0];assert.equal(lists(baseline)[0].text.fontSize,32);assert.ok(!baseline.diagnostics.some(d=>d.code==='text-overflow'));assert.deepEqual(item.frameBox,lists(baseline)[0].frameBox);
  const result=paginate(deck,{catalogs:[gallery],fonts:{textMeasurement:fonts.textMeasurement}});assert.equal(result.layout,'measured');assert.deepEqual(deck,saved);assert.equal(result.presentation.slides.length,4);
  assert.deepEqual(result.presentation.slides.flatMap(slide=>slide.blocks.flatMap(block=>block.items??[])),source.slide.blocks.flatMap(block=>block.items));
  for(const page of draw(result.presentation)){
    assert.ok(!page.diagnostics.some(d=>d.code==='text-overflow'));for(const next of lists(page))for(const fit of fits(next)){
      assert.ok(fit.fontSize>=item.text.fontSize);assert.equal(fit.fontSize,37);assert.ok(!fit.overflow);
      for(const entry of fit.listEntries)for(const line of entry.text.richLines)assert.ok(line.fragments.map(fragment=>fragment.text).join('').trim().length<=70);
    }
  }
});


test('SH-26 measured RTL pagination preserves the exact numbered sequence through generated continuation starts',async()=>{
  const slide=structuredClone(fixture.cases[1].slide);slide.language='ar-SA';slide.blocks[0].numbering='arabic';slide.composition.gap=.02;
  const deck={catalogs:{custom:{layouts:{'org-chart':structuredClone(gallery.layouts['org-chart'])}}},slides:[slide]},saved=structuredClone(deck);
  const fonts=await loadFonts({pack:'office',substitutionPolicy:'visual',scripts:'auto',presentation:deck});await fonts.ensure(deck,{renderOptions:{catalogs:[gallery]}});
  const result=paginate(deck,{catalogs:[gallery],fonts:{textMeasurement:fonts.textMeasurement}});assert.deepEqual(deck,saved);assert.equal(result.layout,'measured');
  const actual=result.presentation.slides.flatMap(slide=>slide.blocks.flatMap(block=>block.items??[]));assert.deepEqual(actual.map(value=>typeof value==='string'?value:value.text),slide.blocks[0].items);
  for(const [index,value]of actual.entries())if(typeof value!=='string')assert.deepEqual(value,{text:slide.blocks[0].items[index],start:index+1});
  const drawn=resolvePresentation(result.presentation,{fonts,catalogs:[gallery],date:'2026-11-08'}),entries=drawn.slides.flatMap(slide=>lists(slide.geometry).flatMap(item=>fits(item).flatMap(fit=>fit.listEntries)));
  assert.deepEqual(entries.map(entry=>entry.marker.number.value),[1,2,3,4,5,6,7]);assert.ok(drawn.slides.every(slide=>!slide.geometry.diagnostics.some(d=>d.code==='text-overflow')));
  assert.ok(drawn.slides.flatMap(slide=>lists(slide.geometry)).every(item=>fits(item).every(fit=>fit.fontSize>=32)));
});
