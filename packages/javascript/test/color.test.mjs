import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import { colorContrast, textColorForFill, chartColorForFill, chartPaletteForFill, resolveColorRef, normalizeHexColor, resolveColorRoles, isDarkColor, defaultSlideBackground } from '../dist/composition.js';
import { colorSchemes } from '../dist/index.js';

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

test('isDarkColor: WCAG luminance under 0.179, so saturated mid-tones take dark text',()=>{
  assert.equal(isDarkColor('#000000'),true);
  assert.equal(isDarkColor('#0000FF'),true);
  assert.equal(isDarkColor('#FF0000'),false);
  assert.equal(isDarkColor('#777777'),false);
  assert.equal(isDarkColor('#707070'),true);
  assert.equal(isDarkColor('#00000080'),true,'alpha is not applied');
  assert.equal(isDarkColor('red'),false);
  assert.equal(isDarkColor(undefined),false);
});

test('resolveColorRoles: slot defaults, role overrides, and the dark background rules',()=>{
  const scheme={dark1:'#101010',light1:'#FAFAFA',dark2:'#223344',light2:'#EEEEEE',accent1:'#2874A6',accent2:'#1B4F72',accent3:'#5499C7',hyperlink:'#0033CC',followedHyperlink:'#660099'};
  const light=resolveColorRoles(scheme);
  assert.deepEqual(light,{primary:'#2874A6',secondary:'#1B4F72',accent:'#5499C7',background:'#FAFAFA',surface:'#EEEEEE',surfaceAlt:'#D8D8D8',text:'#101010',textSecondary:'#223344',hyperlink:'#0033CC',followedHyperlink:'#660099',dark:false});
  const dark=resolveColorRoles(scheme,{background:'#0B1220'});
  assert.deepEqual([dark.background,dark.surface,dark.text,dark.textSecondary,dark.dark],['#0B1220','#223344','#FAFAFA','#EEEEEE',true]);
  // Overrides: primary/secondary/accent/surface/textSecondary apply on any background; text only on a light one.
  const roles={primary:'#111111',secondary:'#222222',accent:'#333333',background:'#FFF8E7',surface:'#444444',text:'#555555',textSecondary:'#666666'};
  const over=resolveColorRoles({...scheme,...roles});
  assert.deepEqual([over.primary,over.secondary,over.accent,over.background,over.surface,over.text,over.textSecondary],['#111111','#222222','#333333','#FFF8E7','#444444','#555555','#666666']);
  const overDark=resolveColorRoles({...scheme,...roles},{background:'#000000'});
  assert.deepEqual([overDark.background,overDark.surface,overDark.text,overDark.textSecondary],['#000000','#444444','#FAFAFA','#666666']);
  // The background role is the default slide background; an explicit single-color background wins, and the dark decision follows it.
  assert.equal(defaultSlideBackground({...scheme,background:'#101010'}),'#101010');
  assert.equal(resolveColorRoles({...scheme,background:'#101010'}).dark,true);
  assert.equal(defaultSlideBackground(scheme),'#FAFAFA');
  assert.equal(defaultSlideBackground({}),'#FFFFFF');
});

test('resolveColorRoles: hyperlink falls back to the Office theme colors, alpha is kept, a bad color falls through',()=>{
  const bare=resolveColorRoles({});
  assert.equal(bare.hyperlink,'#0563C1');
  assert.equal(bare.followedHyperlink,'#954F72');
  // A link color with under 4.5:1 contrast against the slide takes the slide text color, as the slide tag does for the primary color.
  const dim={dark1:'#101010',light1:'#FFFFFF',dark2:'#223344',light2:'#EEEEEE',hyperlink:'#0000EE'};
  assert.equal(resolveColorRoles(dim).hyperlink,'#0000EE');
  assert.equal(resolveColorRoles(dim,{background:'#011842'}).hyperlink,'#FFFFFF');
  assert.equal(resolveColorRoles({...dim,hyperlink:'#7AB8FF'},{background:'#011842'}).hyperlink,'#7AB8FF');
  assert.equal(bare.text,'#111827');
  assert.equal(resolveColorRoles({light2:'#FFFFFF80'}).surface,'#FFFFFF80');
  assert.equal(resolveColorRoles({surface:'nope',light2:'#EEEEEE'}).surface,'#EEEEEE');
});
