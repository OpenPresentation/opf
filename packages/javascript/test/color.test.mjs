import assert from 'node:assert/strict';
import {test} from 'node:test';
import {colorContrast,textColorForFill} from '../dist/index.js';

test('opaque contrast follows unrounded sRGB luminance thresholds',()=>{
  assert.equal(colorContrast('#fff','#000'),21);
  assert.equal(colorContrast('#123456','#123456FF'),1);
  assert.ok(colorContrast('#777777','#fff')<4.5);
  assert.ok(colorContrast('#767676','#fff')>4.5);
  assert.equal(textColorForFill('#767676','#fff'),'#fff');
  assert.equal(textColorForFill('#777777','#fff'),'#000000');
});
test('bright and dark fills select readable inherited text without guessing alpha backdrops',()=>{
  assert.equal(textColorForFill('#F8FAFC','#FFFFFF'),'#000000');
  assert.equal(textColorForFill('#0F172A','#000000'),'#FFFFFF');
  assert.equal(textColorForFill('#F8FAFC','#334155'),'#334155');
  for(const unresolved of ['#FFFFFF80','#00000000','red','url(#paint)','not-a-color']){
    assert.equal(colorContrast('#fff',unresolved),undefined);
    assert.equal(textColorForFill(unresolved,'#fff'),'#fff');
  }
});
