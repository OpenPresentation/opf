// SH-03 wired into SH-02: a shape block's effects are written as SH-03's a:effectLst inside p:spPr right after a:ln, in the schema's
// order; a lighter or darker theme color becomes a:schemeClr with a:lumMod and a:lumOff, the effect's opacity a:alpha; the lengths are
// at the canvas's scale; a shape without effects keeps an empty a:effectLst (the theme's effect style off).
import assert from 'node:assert/strict';
import { unzipSync } from 'fflate';
import { toPptx } from '../dist/index.js';

const scheme = { name: 'Test', dark1: '#101820', light1: '#FFFFFF', dark2: '#2A3440', light2: '#E8E4DC', accent1: '#1F5AA6', accent2: '#4A7A3A', accent3: '#B05A2A', accent4: '#7A4A9A', accent5: '#C0C8D0', accent6: '#5A8A9A', hyperlink: '#1F5AA6', followedHyperlink: '#7A4A9A' };
const deck = (blocks, dimensions) => ({ name: 'Effects', language: 'en-US', design: { colorScheme: scheme, ...(dimensions ? { dimensions } : {}) }, slides: [{ title: 'Effects', blocks }] });
const decode = bytes => new TextDecoder().decode(bytes);
async function shapes(blocks, dimensions) {
  const slide = decode(unzipSync(await toPptx(deck(blocks, dimensions), { imageFormat: 'preserve' }))['ppt/slides/slide1.xml']);
  return [...slide.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(match => match[0]).filter(shape => /name="OPF shape /.test(shape));
}

{
  const [shape] = await shapes([{ shape: 'roundRect', text: 'Plain' }]);
  assert.match(shape, /<\/a:ln><a:effectLst\/><\/p:spPr>/, 'no effects: an empty list right after the line');
}
{
  const [shape] = await shapes([{ shape: 'roundRect', text: 'All', shadow: 'soft', innerShadow: { opacity: 0.5 }, glow: { color: { color: 'accent2', lighten: 0.4 }, opacity: 0.6, radius: 10 }, softEdge: 4, reflection: { opacity: 0.4, size: 0.5 }, blur: 2 }]);
  const list = shape.match(/<\/a:ln>(<a:effectLst>[\s\S]*?<\/a:effectLst>)<\/p:spPr>/)?.[1];
  assert.ok(list, 'the effects sit in p:spPr right after a:ln');
  assert.deepEqual([...list.matchAll(/<a:(blur|glow|innerShdw|outerShdw|reflection|softEdge)\b/g)].map(match => match[1]), ['blur', 'glow', 'innerShdw', 'outerShdw', 'reflection', 'softEdge']);
  assert.match(list, /<a:glow rad="95250"><a:schemeClr val="accent2"><a:lumMod val="60000"\/><a:lumOff val="40000"\/><a:alpha val="60000"\/><\/a:schemeClr><\/a:glow>/);
  assert.match(list, /<a:outerShdw blurRad="50800" dist="38100" dir="5400000" algn="tl" rotWithShape="0"><a:prstClr val="black"><a:alpha val="40000"\/><\/a:prstClr><\/a:outerShdw>/, 'the shadow presets\' black is PowerPoint\'s preset black');
  assert.match(list, /<a:softEdge rad="38100"\/>/);
}
{
  // A 15-inch short edge (2560 x 1440 canvas pixels) doubles every length.
  const [shape] = await shapes([{ shape: 'ellipse', glow: { radius: 10 } }], { widthInches: 80 / 3, heightInches: 15 });
  assert.match(shape, /<a:glow rad="190500">/);
}
console.log('shape-block-effects: ok');
