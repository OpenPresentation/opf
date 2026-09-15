import assert from 'node:assert/strict';
import {test} from 'node:test';
import {layouts} from '../dist/catalogs.js';
import {validateCatalogRecord,validatePresentation} from '../dist/index.js';
import {composeSlide} from '../dist/composition.js';

test('number layouts declare and compose metric content for every supported count',()=>{
  for(let count=1;count<=6;count++){
    const layout=layouts.find(record=>record.id===`number-${count}x`);
    assert.deepEqual(layout.placeholders.map(slot=>slot.type),['title',...Array(count).fill('metric')]);
    assert.equal(validateCatalogRecord('layouts',layout).valid,true);
    const slide={layout:layout.id,title:'Business metrics',blocks:Array.from({length:count},(_,i)=>({metric:{value:i+1,label:`Metric ${i+1}`}}))};
    const document={slides:[slide],catalogs:{layouts:{records:[layout]}}};
    assert.equal(validatePresentation(document).valid,true);
    const composed=composeSlide(slide,{layout});
    assert.equal(composed.items.filter(item=>item.type==='metric').length,count);
    assert.deepEqual(composed.items.filter(item=>item.type==='metric').map(item=>item.value.value),Array.from({length:count},(_,i)=>i+1));
  }
});
