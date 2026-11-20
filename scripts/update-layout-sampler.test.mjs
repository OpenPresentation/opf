import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {validate,updateFromCatalog} from '@openpresentation/opf';
import {gallery} from '@openpresentation/gallery';
import {updatedLayoutSampler} from './update-layout-sampler.mjs';
const before=JSON.parse(readFileSync(new URL('../examples/technical/layout-sampler.opf.json',import.meta.url),'utf8'));
test('exhaustive sampler refresh preserves authored slides/ordinals, includes every current layout and is standalone and idempotent',()=>{
 const result=updatedLayoutSampler(before),deck=result.document;assert.deepEqual(deck.slides.slice(0,before.slides.length),before.slides);assert.equal(deck.slides.length,before.slides.filter(s=>!s.layout).length+Object.keys(gallery.layouts).length);assert.equal(new Set(deck.slides.map(s=>s.id)).size,deck.slides.length);assert.deepEqual(deck.slides.filter(s=>s.layout).map(s=>s.layout).sort(),Object.keys(gallery.layouts).sort());
 assert.equal(validate(deck,{catalogs:[],only:['format','references']}).valid,true);assert.deepEqual(updateFromCatalog(deck,[gallery],Object.keys(gallery.layouts).map(reference=>({kind:'layouts',reference}))).changes,[]);assert.deepEqual(updatedLayoutSampler(deck).document,deck);
});
test('unknown and duplicate authored sampler layout references fail without changing the input',()=>{
 for(const slide of [{id:'bad',layout:'unknown-layout'},{id:'duplicate',layout:before.slides[0].layout}]){const source={...before,slides:[...before.slides,slide]},saved=structuredClone(source);assert.throws(()=>updatedLayoutSampler(source));assert.deepEqual(source,saved);}
});
