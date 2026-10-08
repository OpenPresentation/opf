import assert from 'node:assert/strict';
import {test} from 'node:test';
import {defaultCatalog} from '../dist/catalog.js';
import { validateCatalogRecord } from '../dist/index.js';
import {composeSlide} from '../dist/composition.js';
import { check } from './support/validation.mjs';

test('number layouts declare and compose metric content for every supported count',()=>{
  for(let count=1;count<=6;count++){
    const id=`number-${count}x`,layout=defaultCatalog.layouts[id];
    assert.deepEqual(layout.placeholders.map(slot=>slot.type),['title',...Array(count).fill('metric')]);
    assert.equal(validateCatalogRecord('layouts',{$schema:'https://openpresentation.org/schema/opf-layout/v1',id,...layout}).valid,true);
    const slide={layout:id,title:'Business metrics',blocks:Array.from({length:count},(_,i)=>({metric:{value:i+1,label:`Metric ${i+1}`}}))};
    const document={slides:[slide],catalogs:{default:{source:defaultCatalog.source,layouts:{[id]:layout}}}};
    assert.equal(check(document).valid,true);
    const composed=composeSlide(slide,{layout});
    assert.equal(composed.items.filter(item=>item.type==='metric').length,count);
    assert.deepEqual(composed.items.filter(item=>item.type==='metric').map(item=>item.value.value),Array.from({length:count},(_,i)=>i+1));
  }
});
