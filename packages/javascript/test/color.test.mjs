import assert from 'node:assert/strict';
import {test} from 'node:test';
import {colorContrast,textColorForFill,chartColorForFill} from '../dist/index.js';

test('opaque contrast follows unrounded sRGB luminance thresholds',()=>{
  assert.equal(colorContrast('#fff','#000'),21);
  assert.equal(colorContrast('#123456','#123456FF'),1);
  assert.ok(colorContrast('#777777','#fff')<4.5);
  assert.ok(colorContrast('#767676','#fff')>4.5);
  assert.equal(textColorForFill('#767676','#fff'),'#fff');
  assert.equal(textColorForFill('#777777','#fff'),'#000000');
});

test('chart marks retain passing colors and brighten/darken failing opaque palettes',()=>{
  assert.equal(chartColorForFill('#FFFFFF','#2874A6'),'#2874A6');
  assert.equal(chartColorForFill('#000000','#FFFFFF'),'#FFFFFF');
  for(const fill of ['#FFFFFF','#000000','#334155','#292929','#330044','#777777','#F8FAFC']){
    for(const preferred of ['#2874A6','#1B4F72','#4F1EFF','#801FAD','#EEEEEE','#111111','#aaa','#123456FF']){
      const resolved=chartColorForFill(fill,preferred);
      assert.ok(colorContrast(resolved,fill)>=3,`${fill} ${preferred} -> ${resolved}`);
      if(colorContrast(preferred,fill)>=3)assert.equal(resolved,preferred);
      assert.equal(chartColorForFill(fill,resolved),resolved,'A resolved color is stable');
    }
  }
  for(const [fill,preferred]of [['#FFFFFF80','#2874A6'],['red','#fff'],['#FFFFFF','#12345680']])assert.equal(chartColorForFill(fill,preferred),preferred);
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
