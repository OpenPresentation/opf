import assert from 'node:assert/strict';
import {test} from 'node:test';
import {composeSlide} from '../dist/composition.js';
import { validateCatalogRecord } from '../dist/validator.js';
import {layouts} from './support/catalog.mjs';
import { check, errorsOf } from './support/validation.mjs';

test('composition preserves schema-valid leaf payload kinds, including text bullets',()=>{
  const values={text:'Text',items:['Item'],bullets:['Bullet'],image:'https://example.com/image.png',video:'https://example.com/video.mp4',chart:{type:'bar',data:{columns:['Name','Value'],rows:[['A',1]]}},table:{columns:['Name'],rows:[['A']]},code:{source:'const a = 1;'},metric:{value:1},quote:{text:'Quote'},timeline:{events:[{what:'Milestone'}]}};
  for(const [field,value] of Object.entries(values)){
    const item=composeSlide({[field]:value},{width:1280,height:720}).items.find(item=>item.field===field);
    const result=check({name:'Content contract',slides:[item.payload]});
    assert.equal(result.valid,true,`${field}: ${JSON.stringify(errorsOf(result))}`);
    assert.deepEqual(item.payload[field],value);
  }
});
test('quote and timeline layouts declare their native content kinds',()=>{
  for(const type of ['quote','timeline']){
    const layout=layouts.find(layout=>layout.id===`${type}-1x`);
    assert.deepEqual(layout.placeholders.map(p=>p.type),['title',type]);
    assert.equal(validateCatalogRecord('layouts',layout).valid,true);
  }
});
