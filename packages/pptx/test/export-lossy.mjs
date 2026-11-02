// LH-29: every mapping the PPTX export cannot represent exactly reports one `export-lossy` diagnostic with a `feature`, once per
// place; an exact mapping reports nothing. The SVG cases are checked in svg-image.mjs; the full table is in skills/opf-export.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {strFromU8, unzipSync} from 'fflate';
import {toPptx} from './helpers/default-catalog.mjs';

const image = async name => `data:image/webp;base64,${Buffer.from(await readFile(new URL(`./fixtures/images/${name}`, import.meta.url))).toString('base64')}`;
const lossy = async (deck, options = {}) => {
  const diagnostics = [];
  const bytes = await toPptx(deck, {...options, onDiagnostic: diagnostic => diagnostics.push(diagnostic)});
  return {bytes, found: diagnostics.filter(item => item.code === 'export-lossy').map(({feature, path}) => [feature, path])};
};
let checks = 0;

// A dotted cell border is PowerPoint's square dot; a dashed one is PowerPoint's dash exactly.
{
  const table = dash => ({columns: ['A', 'B'], rows: [[{value: '1', style: {borders: {bottom: {color: '#334155', width: 2, dash}}}}, '2']]});
  const dotted = await lossy({slides: [{title: 'Dots', table: table('dot')}]});
  assert.deepEqual(dotted.found, [['border-dot', 'slides.0.table']]);
  assert.match(strFromU8(unzipSync(dotted.bytes)['ppt/slides/slide1.xml']), /<a:prstDash val="sysDot"\/>/);
  assert.deepEqual((await lossy({slides: [{title: 'Dashes', table: table('dash')}]})).found, []);
  checks++;
}

// An engine-defined pattern preset is its closest DrawingML preset; a DrawingML preset is itself.
{
  const pattern = preset => ({design: {background: {type: 'pattern', pattern: {preset, foregroundColor: '#1e293b', backgroundColor: '#f8fafc'}}}, slides: [{title: 'Pattern'}]});
  const stripe = await lossy(pattern('diagStripe'));
  assert.deepEqual(stripe.found, [['pattern-preset', 'design.background.pattern.preset']]);
  assert.match(strFromU8(unzipSync(stripe.bytes)['ppt/slides/slide1.xml']) + strFromU8(unzipSync(stripe.bytes)['ppt/slideMasters/slideMaster1.xml']), /<a:pattFill prst="wdUpDiag">/);
  assert.deepEqual((await lossy(pattern('pct50'))).found, []);
  checks++;
}

// An animated WebP is a still PNG of its first frame under the default compatible images; preserve keeps it.
{
  const animated = await image('wide-animated.webp');
  const deck = {slides: [{title: 'Animated', blocks: [{type: 'image', image: {src: animated, alt: 'A moving picture'}}]}]};
  assert.deepEqual((await lossy(deck)).found, [['image-animation', 'slides.0.blocks.0.image']]);
  assert.deepEqual((await lossy(deck, {imageFormat: 'preserve'})).found, []);
  assert.deepEqual((await lossy({slides: [{title: 'Still', blocks: [{type: 'image', image: {src: await image('wide.webp'), alt: 'A picture'}}]}]})).found, [], 'a still WebP converts exactly');
  checks++;
}

// The former svg-image-rasterized code is gone: an SVG with a duotone is an export-lossy finding.
{
  const svg = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" fill="#00aa44"/></svg>').toString('base64')}`;
  const result = await lossy({slides: [{title: 'SVG', blocks: [{type: 'image', image: svg, recolor: {dark: '#102030', light: '#f0e0d0'}}]}]});
  assert.deepEqual(result.found, [['svg-rasterized', 'slides.0.blocks.0.image']]);
  checks++;
}

console.log(`Export-lossy checks passed (${checks}): dotted borders, pattern presets, animated WebP and rasterized SVG.`);
