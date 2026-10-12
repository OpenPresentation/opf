import assert from 'node:assert/strict';
import {strFromU8, unzipSync} from 'fflate';
import {XMLValidator} from 'fast-xml-parser';
import {gallery as defaultCatalog} from '@openpresentation/gallery';
import {toPptx as exportPptx, fromPptx as importPptx} from '../dist/index.js';

// OPF 0.15 (FA-23): the gallery records these checks name come from the snapshot, which a host registers explicitly
// (`catalogs: [defaultCatalog]`); `records` lists them with their keys as ids.
const records = Object.fromEntries(Object.entries(defaultCatalog).filter(([, map]) => map && typeof map === 'object').map(([kind, map]) => [kind, Object.entries(map).map(([id, record]) => ({id, ...record}))]));
const toPptx = (presentation, options = {}) => exportPptx(presentation, {catalogs: [defaultCatalog], ...options});
const fromPptx = (bytes, options = {}) => importPptx(bytes, {catalogs: [defaultCatalog], ...options});

// FF-59: the slide tag is the eyebrow label. The export writes its run in the deck primary colour, the colour
// opf-render draws it in (colors.primary: scheme.primary, else accent1). Where the deck theme holds that colour in
// accent1 the run is a:schemeClr accent1 (FF-24 convention: engine chrome follows the deck theme); otherwise it is the
// literal. The title, subtitle and body keep the text colour.

const parts = bytes => unzipSync(new Uint8Array(bytes));
const slideXml = entries => {
  const xml = strFromU8(entries['ppt/slides/slide1.xml']);
  assert.equal(XMLValidator.validate(xml), true, 'slide XML');
  return xml;
};
const themeAccent1 = entries => strFromU8(entries['ppt/theme/theme1.xml']).match(/<a:accent1><a:srgbClr val="([0-9A-F]{6})"\/><\/a:accent1>/)[1];
const runs = (xml, text) => [...xml.matchAll(/<a:r>([\s\S]*?)<\/a:r>/g)].map(m => m[1]).filter(body => body.includes(`<a:t>${text}</a:t>`));
const fillOf = run => run.match(/<a:solidFill>(<a:(?:srgbClr|schemeClr) val="[^"]+"\s*\/>)/)?.[1];
const hex = value => value.replace(/^#/, '').toUpperCase();
const slide = {id: 'intro', layout: 'title-slide', tag: 'Pitch Intro', title: 'New category, clear wedge', subtitle: 'Why now', items: ['Problem worth solving']};
const wcag = value => {
  const channels = [0, 2, 4].map(offset => {
    const channel = parseInt(value.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};
const contrast = (a, b) => { const [hi, lo] = [wcag(a), wcag(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
const tagRuns = xml => { const found = runs(xml, 'Pitch Intro'); assert.equal(found.length, 1, 'one tag run'); return found; };

// 1. Every catalog color scheme: the tag resolves to the theme accent1 (the renderer's primary, no scheme in the catalog
// names a separate primary) and is a:schemeClr accent1, except where that is under 4.5:1 against the slide background
// (FF-61), where it takes the title's text color (see 6).
assert.ok(records.colorSchemes.length > 10);
let lowCount = 0;
for (const record of records.colorSchemes) {
  const entries = parts(await toPptx({design: {colorScheme: record.id}, slides: [slide]}));
  const xml = slideXml(entries);
  const expected = hex(record.primary ?? record.accent1);
  const [run] = tagRuns(xml);
  const low = contrast(expected, hex(record.dark2)) < 4.5; // the default theme (minimal) paints the dark2 slot
  if (low) assert.equal(fillOf(run), fillOf(runs(xml, 'New category, clear wedge')[0]), `${record.id}: low-contrast tag takes the text color`);
  else assert.equal(fillOf(run), '<a:schemeClr val="accent1"/>', `${record.id}: tag is scheme accent1`);
  lowCount += low;
  assert.equal(themeAccent1(entries), expected, `${record.id}: theme accent1 is the preview primary`);
  // Only the tag is retinted: the title keeps the text colour.
  assert.notEqual(fillOf(runs(xml, 'New category, clear wedge')[0]), '<a:schemeClr val="accent1"/>', `${record.id}: title is not the tag colour`);
}

assert.ok(lowCount > 0 && lowCount < records.colorSchemes.length, 'both outcomes are exercised');
console.log(`default dark2 slide: ${lowCount} of ${records.colorSchemes.length} catalog schemes take the text colour`);

// 2. A scheme that names a primary other than accent1: the theme does not hold it, so the tag stays the literal primary.
{
  const scheme = {light1: '#FFFFFF', dark1: '#111111', accent1: '#AA0000', primary: '#0055AA'};
  const [run] = tagRuns(slideXml(parts(await toPptx({design: {colorScheme: scheme, background: {type: 'solid', color: '#FFFFFF'}}, slides: [slide]}))));
  assert.equal(fillOf(run), '<a:srgbClr val="0055AA"/>');
}

// 3. A slide with its own scheme is pinned to literals, even when the deck theme holds the same colour. (A scheme whose
// primary passes on the white slide, so FF-61 keeps it.)
{
  const other = records.colorSchemes.find(record => hex(record.primary ?? record.accent1) !== hex(records.colorSchemes.find(r => r.id === 'cool-horizon').accent1) && contrast(hex(record.primary ?? record.accent1), 'FFFFFF') >= 4.5);
  const entries = parts(await toPptx({design: {colorScheme: 'cool-horizon'}, slides: [{...slide, design: {colorScheme: other.id, background: {type: 'solid', color: '#FFFFFF'}}}]}));
  assert.notEqual(hex(other.accent1), themeAccent1(entries));
  const [run] = tagRuns(slideXml(entries));
  assert.equal(fillOf(run), `<a:srgbClr val="${hex(other.primary ?? other.accent1)}"/>`);
}

// 4. A tag that wraps writes every line in the tag colour.
{
  const long = {...slide, tag: 'A long eyebrow label that needs more than one line to fit in the heading width, '.repeat(6)};
  const xml = slideXml(parts(await toPptx({design: {colorScheme: 'cool-horizon', background: {type: 'solid', color: '#FFFFFF'}}, slides: [long]})));
  const tagShapes = [...xml.matchAll(/<p:sp>(?:(?!<\/p:sp>)[\s\S])*?name="OPF heading slides\.0\.tag line \d+"[\s\S]*?<\/p:sp>/g)].map(m => m[0]);
  assert.ok(tagShapes.length >= 1);
  for (const shape of tagShapes) for (const run of shape.match(/<a:r>[\s\S]*?<\/a:r>/g) ?? []) assert.equal(fillOf(run), '<a:schemeClr val="accent1"/>');
}

// 5. Byte-identical output and lossless re-import of the tag text.
{
  const deck = {design: {colorScheme: 'cool-horizon'}, slides: [slide]};
  const first = await toPptx(deck), second = await toPptx(deck);
  assert.deepEqual(Buffer.from(first), Buffer.from(second), 'deterministic');
  const imported = await fromPptx(first);
  assert.equal(imported.slides[0].tag, 'Pitch Intro');
  assert.equal(imported.design.colorScheme, 'cool-horizon');
}
// 6. FF-61: when the primary is under 4.5:1 (WCAG 2.x) against the slide background the tag takes the slide text
// color, the value the title gets (the scheme text slot where the theme holds it, else the literal); otherwise it keeps
// the primary. The same color pairs are pinned in opf-render test/tag-colour.mjs: the eight distinct pairs of the ten corpus tags that were under
// 4.5:1 (core example corpus, FF-59; 9E9E9E on white occurs three times) and four that pass.
const pairs = [
  ['#FE938C', '#FFFFFF', 2.15], ['#6A1B9A', '#000000', 2.24], ['#4A1BE4', '#000000', 2.57], ['#F77F00', '#FFFFFF', 2.63],
  ['#9E9E9E', '#FFFFFF', 2.68], ['#A41410', '#000000', 2.69], ['#FD3223', '#FFFFFF', 3.71], ['#997929', '#FFFFFF', 4.10],
  ['#767676', '#FFFFFF', 4.54], ['#2874A6', '#FFFFFF', 5.07], ['#38BDF8', '#0B1220', 8.74], ['#FFFFFF', '#000000', 21],
];
const titleText = 'New category, clear wedge';
const tagAndTitle = async design => {
  const xml = slideXml(parts(await toPptx({design, slides: [slide]})));
  return [fillOf(tagRuns(xml)[0]), fillOf(runs(xml, titleText)[0])];
};
for (const [primary, background, ratio] of pairs) {
  const dark = wcag(background.slice(1)) < 0.179;
  assert.equal(Number(contrast(primary.slice(1), background.slice(1)).toFixed(2)), ratio, `${primary} on ${background}: ratio`);
  const [tag, title] = await tagAndTitle({colorScheme: {light1: '#FFFFFF', dark1: '#111111', accent1: primary}, fontScheme: 'aptos', background: {type: 'solid', color: background}});
  assert.equal(title, `<a:srgbClr val="${dark ? 'FFFFFF' : '111111'}"/>`, `${primary} on ${background}: title color`);
  assert.equal(tag, ratio < 4.5 ? title : '<a:schemeClr val="accent1"/>', `${primary} on ${background}: tag color`);
}
// The threshold is 4.5 exactly: #767676 on white is 4.54 (kept), #777777 is 4.48 (text color).
for (const [primary, kept] of [['#767676', true], ['#777777', false]]) {
  const [tag, title] = await tagAndTitle({colorScheme: {light1: '#FFFFFF', dark1: '#111111', accent1: primary}, fontScheme: 'aptos', background: {type: 'solid', color: '#FFFFFF'}});
  assert.equal(tag, kept ? '<a:schemeClr val="accent1"/>' : title);
}
// A theme-slot background gives the text a scheme reference, and the fallback tag uses the same one.
{
  const light = await tagAndTitle({colorScheme: {light1: '#FFFFFF', dark1: '#111111', accent1: '#FE938C'}, fontScheme: 'aptos', background: {type: 'theme', slot: 'light1'}});
  assert.deepEqual(light, ['<a:schemeClr val="tx1"/>', '<a:schemeClr val="tx1"/>']);
  const dark = await tagAndTitle({colorScheme: {light1: '#FFFFFF', dark1: '#000000', accent1: '#6A1B9A'}, fontScheme: 'aptos', background: {type: 'theme', slot: 'dark1'}});
  assert.deepEqual(dark, ['<a:schemeClr val="bg1"/>', '<a:schemeClr val="bg1"/>']);
}
// A slide-level background is the one the tag sits on, per slide.
{
  const design = {colorScheme: {light1: '#FFFFFF', dark1: '#111111', accent1: '#6A1B9A'}, fontScheme: 'aptos', background: {type: 'solid', color: '#FFFFFF'}};
  const entries = parts(await toPptx({design, slides: [slide, {...slide, id: 'dark', design: {background: {type: 'solid', color: '#000000'}}}]}));
  const [first, second] = [1, 2].map(number => strFromU8(entries[`ppt/slides/slide${number}.xml`]));
  assert.equal(fillOf(tagRuns(first)[0]), '<a:schemeClr val="accent1"/>', 'white slide keeps the primary');
  assert.equal(fillOf(tagRuns(second)[0]), '<a:srgbClr val="FFFFFF"/>', 'black slide takes the text color');
}
// A wrapped low-contrast tag writes every line in the text color.
{
  const long = {...slide, tag: 'A long eyebrow label that needs more than one line to fit in the heading width, '.repeat(6)};
  const xml = slideXml(parts(await toPptx({design: {colorScheme: {light1: '#FFFFFF', dark1: '#111111', accent1: '#FE938C'}, fontScheme: 'aptos', background: {type: 'solid', color: '#FFFFFF'}}, slides: [long]})));
  const tagShapes = [...xml.matchAll(/<p:sp>(?:(?!<\/p:sp>)[\s\S])*?name="OPF heading slides\.0\.tag line \d+"[\s\S]*?<\/p:sp>/g)].map(m => m[0]);
  assert.ok(tagShapes.length > 1);
  for (const shape of tagShapes) for (const run of shape.match(/<a:r>[\s\S]*?<\/a:r>/g) ?? []) assert.equal(fillOf(run), '<a:srgbClr val="111111"/>');
}
console.log('tag colour ok');
