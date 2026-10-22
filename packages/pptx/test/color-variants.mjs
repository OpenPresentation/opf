// RR-96: color variants. design.variant writes the master clrMap and a per-slide clrMapOvr (with accent re-mapping); scheme-derived colors
// are schemeClr (the neutrals with lumMod/lumOff); fromPptx reads the map, the override and a scheme background back into design.variant.
import assert from 'node:assert/strict';
import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';
import {normalizeColorVariant} from '@openpresentation/opf/composition';
import {fromPptx, toPptx} from '../dist/index.js';
import {clrMapOf, colorsInXml, themeColorsOf} from './helpers/scheme-colors.mjs';

const ACCENTS = ['accent2', 'accent1', 'accent3', 'accent4', 'accent5', 'accent6'];
const data = {columns: ['Quarter', 'A', 'B'], rows: [['Q1', 3, 5], ['Q2', 5, 2], ['Q3', 2, 7]]};
const deck = (variant, slides) => ({name: 'Variants', language: 'en-US', design: {fontScheme: 'roboto', ...(variant ? {variant} : {})}, slides});
const slides = [
  {title: 'Chart', chart: {type: 'column', data}},
  {title: 'Table', table: {columns: ['A', 'B'], rows: [['1', '2'], ['3', '4']]}},
  {title: 'Light', design: {variant: 'light1'}, text: 'A light slide in a dark deck.'},
  {title: 'Second light', design: {variant: 'light2'}, text: 'Another.'},
  {title: 'Light, permuted', design: {variant: {background: 'light1', accents: ['accent3', 'accent2', 'accent1', 'accent4', 'accent5', 'accent6']}}, text: 'Own accent order.'}
];
const open = async (document) => {
  const files = unzipSync(await toPptx(document));
  const text = name => strFromU8(files[name]);
  const theme = themeColorsOf(text('ppt/theme/theme1.xml'));
  const master = clrMapOf(text('ppt/slideMasters/slideMaster1.xml'));
  const override = index => { const xml = text(`ppt/slides/slide${index}.xml`); return /<a:overrideClrMapping/.test(xml) ? clrMapOf(xml.match(/<p:clrMapOvr>[\s\S]*?<\/p:clrMapOvr>/)[0]) : undefined; };
  return {files, text, theme, master, override};
};

// 1. The master map is the deck variant's; a slide with another variant overrides it, and only that slide.
{
  const {master, override} = await open(deck('dark1', slides));
  assert.deepEqual([master.bg1, master.tx1, master.bg2, master.tx2], ['dk1', 'lt1', 'dk2', 'lt2'], 'the master carries the dark1 map');
  assert.equal(override(1), undefined, 'a slide with the deck variant inherits the master map');
  assert.deepEqual([override(3).bg1, override(3).tx1], ['lt1', 'dk1']);
  assert.equal(override(4).bg1, 'lt2', 'light2 puts the second light slot on the background');
}

// 2. Accent re-mapping: the master and an override both carry the permutation; accent roles in content follow it.
{
  const {master, override, text, theme} = await open(deck({background: 'dark1', accents: ACCENTS}, slides));
  assert.equal(master.accent1, 'accent2'); assert.equal(master.accent2, 'accent1');
  assert.equal(override(3).bg1, 'lt1');
  assert.equal(override(3).accent1, 'accent1', 'a slide variant without accents uses the default accent order');
  assert.equal(override(5).accent1, 'accent3', 'a slide variant with accents carries its own order');
  assert.equal(override(5).accent3, 'accent1');
  // The second series keeps the deck's second accent (the first is lightened for the dark panel, which is a literal): the role, through the map.
  assert.match(text('ppt/charts/chart1.xml'), /<c:ser>[\s\S]*?<c:ser>[\s\S]*?<c:spPr><a:solidFill><a:schemeClr val="accent2"\/>/, 'the second series is the accent2 role');
  assert.ok(theme.accent1 && theme.accent2, 'the theme still holds the accent slots');
}

// 3. Scheme-derived colors are schemeClr: backgrounds, text, table lines and chart neutrals, resolved through the map in force.
{
  const {text, theme, master, override} = await open(deck('dark1', slides));
  const dark = text('ppt/slides/slide1.xml');
  assert.match(dark, /<p:bg><p:bgPr><a:solidFill><a:schemeClr val="bg1"/, 'the slide background is bg1');
  const chart = text('ppt/charts/chart1.xml');
  const chartColors = colorsInXml(chart, theme, master);
  assert.ok(chartColors.filter(color => color.role === 'tx1').length >= 3, 'chart text, gridlines and axis lines are the text slot');
  const gridlines = chart.match(/<c:majorGridlines>[\s\S]*?<\/c:majorGridlines>/)[0];
  assert.match(gridlines, /<a:schemeClr val="(?:tx1|bg1)">(?:<a:lum(?:Mod|Off) val="\d+"\/>)+/, 'the gridline is a derived neutral (a luminance transform of a map role)');
  assert.doesNotMatch(gridlines, /srgbClr/, 'the gridline is not a literal');
  const lightText = colorsInXml(text('ppt/slides/slide3.xml'), theme, {...master, ...override(3)}).find(color => color.role === 'tx1');
  assert.equal(lightText.hex, theme.dk1, 'on the light slide tx1 resolves to the dark text slot');
  const darkText = colorsInXml(dark, theme, master).find(color => color.role === 'tx1');
  assert.equal(darkText.hex, theme.lt1, 'on the dark slide tx1 resolves to the light text slot');
  const table = colorsInXml(text('ppt/slides/slide2.xml'), theme, master);
  assert.ok(table.some(color => color.role === 'tx1' && color.hex !== theme.lt1), 'table lines are tx1 with a luminance transform');
}

// 4. Literals the document wrote stay literal, and a slide with its own color scheme is pinned.
{
  const {text} = await open(deck('dark1', [{title: 'Literal', text: [{text: 'Pinned', color: '#123456'}]}, {title: 'Own scheme', design: {colorScheme: {id: 'own', accent1: '#C0392B'}}, text: 'x'}]));
  assert.match(text('ppt/slides/slide1.xml'), /<a:srgbClr val="123456"\/>/, 'a literal hex color stays sRGB');
  assert.doesNotMatch(text('ppt/slides/slide2.xml'), /<a:schemeClr val="(?:tx1|bg1|accent1)"/, 'a slide with its own color scheme has no scheme colors');
}

// 5. Round trip: the deck variant, the accent order and each slide's variant come back; a deck without a variant gains none.
{
  for (const variant of ['dark1', 'dark2', 'light2', {background: 'dark1', accents: ACCENTS}]) {
    const imported = await fromPptx(await toPptx(deck(variant, slides)));
    // dark2 is the default deck background: core implies it, so the import states nothing.
    assert.deepEqual(normalizeColorVariant(imported.design.variant ?? 'dark2'), normalizeColorVariant(variant), `the ${JSON.stringify(variant)} deck variant returns`);
    if (variant === 'dark2') assert.equal(imported.design.variant, undefined);
    assert.equal(imported.slides[2].design?.variant, 'light1', 'a slide variant returns');
    assert.equal(imported.slides[3].design?.variant, variant === 'light2' ? undefined : 'light2', 'a slide variant equal to the deck variant is not repeated');
    assert.equal(imported.slides[0].design?.variant, undefined, 'a slide with the deck variant carries none');
    assert.deepEqual(imported.slides[4].design?.variant, {background: 'light1', accents: ['accent3', 'accent2', 'accent1', 'accent4', 'accent5', 'accent6']}, 'a slide variant with accents returns whole');
  }
  const plain = await fromPptx(await toPptx(deck(undefined, [slides[0]])));
  assert.equal(plain.design?.variant, undefined, 'a deck with no variant imports with none');
  const shorthand = await fromPptx(await toPptx(deck('dark1', [slides[0]])));
  assert.equal(shorthand.design.variant, 'dark1', 'no accent change: the string shorthand');
}

// 6. A package whose color map is not one core describes reports it and keeps the deck as it was.
{
  const files = unzipSync(await toPptx(deck(undefined, [slides[0]])));
  const master = strFromU8(files['ppt/slideMasters/slideMaster1.xml']).replace(/<p:clrMap [^>]*\/>/, '<p:clrMap bg1="accent1" tx1="accent2" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>');
  const diagnostics = [];
  const imported = await fromPptx(zipSync({...files, 'ppt/slideMasters/slideMaster1.xml': strToU8(master)}), {onDiagnostic: d => diagnostics.push(d)});
  assert.equal(imported.design?.variant, undefined);
  assert.ok(diagnostics.some(d => d.code === 'unsupported-color-map'), 'the unsupported map is reported');
}

// 7. A picture background with a tone gets the preview's scrim: the tone variant's bg1 at 40%, directly above the picture and below the content.
{
  const src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  const toned = tone => deck(undefined, [{title: 'Cover', text: 'Readable', design: {background: {type: 'image', src, alt: 'A picture', ...(tone ? {tone} : {})}}}]);
  const scrim = xml => xml.match(/<p:sp>(?:(?!<\/p:sp>)[\s\S])*name="OPF background tone[\s\S]*?<\/p:sp>/)?.[0];
  for (const [tone, slot, dark] of [['dark', 'dk1', true], ['light', 'lt1', false]]) {
    const {text, theme, override} = await open(toned(tone));
    const xml = text('ppt/slides/slide1.xml'), shape = scrim(xml);
    assert.ok(shape, `${tone}: the scrim shape`);
    assert.match(shape, /<a:solidFill><a:schemeClr val="bg1"><a:alpha val="40000"\/><\/a:schemeClr><\/a:solidFill>/, `${tone}: bg1 at 40%`);
    assert.match(shape, /<a:off x="0" y="0"\/><a:ext cx="12192000" cy="6858000"\/>/, `${tone}: the full slide`);
    assert.equal(override(1).bg1, slot, `${tone}: the slide map is the tone's`);
    assert.ok(xml.indexOf('<p:pic>') < xml.indexOf('name="OPF background tone') && xml.indexOf('name="OPF background tone') < xml.indexOf('Readable'), `${tone}: picture, scrim, then content`);
    assert.ok(dark ? theme.dk1 : theme.lt1);
    const imported = await fromPptx(await toPptx(toned(tone)));
    assert.equal(imported.slides[0].design.background.tone, tone, `${tone}: the tone returns`);
    assert.equal(imported.slides[0].design.variant, undefined, `${tone}: the tone states the variant`);
    assert.equal(JSON.stringify(imported.slides[0]).includes('OPF background tone'), false, `${tone}: the scrim is no content`);
  }
  const own = deck(undefined, [{title: 'Cover', text: 'Readable', design: {background: {type: 'image', src, alt: 'A picture', tone: 'dark', overlay: {color: 'dark1', opacity: 0.5}}}}]);
  assert.equal(scrim((await open(own)).text('ppt/slides/slide1.xml')), undefined, 'an overlay of its own replaces the scrim');
  assert.equal(scrim((await open(toned(undefined))).text('ppt/slides/slide1.xml')), undefined, 'no tone, no scrim');
}

console.log('color-variants passed: master map, accent re-mapping, per-slide overrides, scheme-colored neutrals, literals, round trips and an unsupported map.');
