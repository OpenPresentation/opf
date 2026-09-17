import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {colorContrast,textColorForFill,chartColorForFill,resolveColorRef,normalizeHexColor} from '../dist/index.js';
import {colorSchemes} from '../dist/index.js';

const forestGreen = colorSchemes.find((scheme) => scheme.id === 'forest-green');

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
test('resolveColorRef resolves hex, slots, roles, variables, and falls back', () => {
  assert.equal(normalizeHexColor('#abc'), '#AABBCC');
  const scheme = forestGreen;
  const fallback = '#111827';
  assert.equal(resolveColorRef('#0f172a', { colorScheme: scheme, fallback }), '#0F172A');
  assert.equal(resolveColorRef('accent2', { colorScheme: scheme, fallback }), '#68B0AB');
  assert.equal(resolveColorRef('surface', { colorScheme: scheme, fallback }), '#EEF5F0');
  assert.equal(resolveColorRef('var:risk', { colorScheme: scheme, variables: { risk: '#B42318' }, fallback }), '#B42318');
  assert.equal(resolveColorRef('var:risk', {
    colorScheme: scheme,
    variables: { risk: { type: 'color', value: '#B42318' } },
    fallback,
  }), '#B42318');
  assert.equal(resolveColorRef('var:missing', { colorScheme: scheme, fallback }), fallback);
  assert.equal(resolveColorRef('invalid', { colorScheme: scheme, fallback }), fallback);
  assert.equal(resolveColorRef('textSecondary', {
    colorScheme: scheme,
    roles: { textSecondary: '#475569' },
    fallback,
  }), '#475569');
});

test('resolveColorRef matches the color-references docs fixture', async () => {
  const fixture = JSON.parse(await readFile(new URL('../../../docs/fixtures/color-references.opf.json', import.meta.url), 'utf8'));
  const scheme = colorSchemes.find((entry) => entry.id === fixture.design.colorScheme);
  const fallback = '#0F172A';
  assert.equal(resolveColorRef('accent2', { colorScheme: scheme, fallback }), '#68B0AB');
  assert.equal(resolveColorRef('var:risk', { colorScheme: scheme, variables: fixture.variables, fallback }), '#B42318');
  assert.equal(resolveColorRef('var:highlight', { colorScheme: scheme, variables: fixture.variables, fallback }), '#0F4C81');
  assert.equal(resolveColorRef('surface', { colorScheme: scheme, fallback }), '#EEF5F0');
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
