import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import { colorContrast, textColorForFill, chartColorForFill, chartPaletteForFill, resolveColorRef, normalizeHexColor } from '../dist/composition.js';
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

// RR-29: chartPaletteForFill keeps the series apart when the surface adjustment would merge them.
const lightness = hex => {
  const [r, g, b] = [1, 3, 5].map(at => Number.parseInt(hex.slice(at, at + 2), 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  const y = .2126729 * r + .7151522 * g + .072175 * b;
  return 116 * (y > 216 / 24389 ? Math.cbrt(y) : (24389 / 27 * y + 16) / 116) - 16;
};
const seriesPalette = ['#2874A6', '#1B4F72', '#5499C7', '#7BDBB2', '#3AC67A', '#24A89E', '#F59E0B', '#EF4444', '#8B5CF6', '#14B8A6', '#0F172A', '#64748B'];
const surfaces = ['#FFFFFF', '#F8FAFC', '#EAEDF6', '#DCDCDC', '#334155', '#2C2C2C', '#1B1B1B', '#011842', '#2B0B3E', '#0C6268', '#3D2E02'];

test('chartPaletteForFill: two blues that merge under per-colour clamping stay apart on a dark card', () => {
  const dark = '#334155';
  const clamped = ['#2874A6', '#1B4F72'].map(color => chartColorForFill(dark, color));
  assert.ok(Math.abs(lightness(clamped[0]) - lightness(clamped[1])) < 11, `per-colour clamping leaves ${clamped} within a few lightness points`);
  const palette = chartPaletteForFill(dark, ['#2874A6', '#1B4F72']);
  assert.ok(Math.abs(lightness(palette[0]) - lightness(palette[1])) >= 11, `${palette} differ in lightness`);
  for (const color of palette) assert.ok(colorContrast(color, dark) >= 3, `${color} on ${dark}`);
});

test('chartPaletteForFill: the default series palette keeps neighbouring series apart on every surface', () => {
  for (const surface of surfaces) {
    const palette = chartPaletteForFill(surface, seriesPalette);
    assert.equal(palette.length, seriesPalette.length);
    palette.forEach(color => {
      assert.match(color, /^#[0-9A-F]{6}$/i);
      assert.ok(colorContrast(color, surface) >= 3, `${color} on ${surface}`);
    });
    // Neighbouring series among the first three (the ones a short chart draws) stay at least 9 lightness points apart.
    for (const [a, b] of [[0, 1], [1, 2]]) assert.ok(Math.abs(lightness(palette[a]) - lightness(palette[b])) >= 9, `${surface}: series ${a + 1} and ${b + 1} are ${palette[a]} and ${palette[b]}`);
  }
});

test('chartPaletteForFill: colours the surface keeps are unchanged and the result is deterministic', () => {
  const white = chartPaletteForFill('#FFFFFF', seriesPalette);
  for (const index of [0, 1, 2, 7, 8, 10, 11]) assert.equal(white[index], seriesPalette[index], `series ${index + 1} already has contrast on white`);
  assert.deepEqual(chartPaletteForFill('#334155', seriesPalette), chartPaletteForFill('#334155', seriesPalette));
  // a colour that passes contrast is never moved, even on a dark surface
  const dark = chartPaletteForFill('#334155', seriesPalette);
  for (const index of [2, 3, 4, 5, 6, 9]) assert.equal(dark[index], seriesPalette[index]);
  assert.deepEqual(chartPaletteForFill('#FFFFFF', []), []);
});

test('chartPaletteForFill: unresolved fills and translucent colours pass through like chartColorForFill', () => {
  assert.deepEqual(chartPaletteForFill('#FFFFFF80', ['#2874A6', '#1B4F72']), ['#2874A6', '#1B4F72']);
  assert.deepEqual(chartPaletteForFill('red', ['#fff', '#eee']), ['#fff', '#eee']);
  const mixed = chartPaletteForFill('#334155', ['#2874A6', '#1B4F7280', '#5499C7']);
  assert.equal(mixed[1], '#1B4F7280');
});
