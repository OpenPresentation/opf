// RR-105 (opf#1291) with LH-188/LH-189: a one-line display title (twice the body size or more) tracks -1.5% in the preview, and the
// Title placeholder it is bound to writes that tracking as spc (hundredths of a point), so PowerPoint draws the same line. A wrapped title
// takes the display tracking only at the 1.0 em display pitch; every line of it keeps the tracking in whatever form it is written
// (soft wrap, fixed lines or measured line boxes).
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {strFromU8, unzipSync} from 'fflate';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
import {toPptx} from './helpers/default-catalog.mjs';

const fonts = await loadFonts({pack: 'office', substitutionPolicy: 'visual'});
const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const titleShapes = (bytes, index) => [...strFromU8(unzipSync(bytes)['ppt/slides/slide1.xml']).matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(([shape]) => shape)
  .filter(shape => shape.includes(`name="OPF heading slides.${index}.title line `) || shape.includes('name="OPF heading slides.0.title line '));
const runs = shape => [...shape.matchAll(/<a:rPr\b[^>]*>/g)].map(([rPr]) => ({sz: Number(/\bsz="(\d+)"/.exec(rPr)?.[1]), spc: /\bspc="(-?\d+)"/.exec(rPr)?.[1]}));
async function exported(deck, index, extra = {}) {
  const single = {...deck, slides: [deck.slides[index]]}, diagnostics = [];
  await fonts.ensure(single);
  const bytes = new Uint8Array(await toPptx(single, {fonts, ...extra, onDiagnostic: value => diagnostics.push(value)}));
  return {titles: titleShapes(bytes, 0), diagnostics};
}

// 1. One line: the bound Title placeholder carries the display tracking, -1.5% of the run size, in both body modes.
const composition = read('../../../scripts/native-acceptance/qualification/decks/coverage-composition.opf.json');
for (const bodyText of [undefined, 'native']) {
  const {titles, diagnostics} = await exported(composition, 9, bodyText ? {bodyText} : {});
  assert.equal(titles.length, 1, 'one title shape');
  assert.match(titles[0], /<p:ph type="(?:ctrTitle|title)"\/>/, 'bound to the Title placeholder');
  assert.match(titles[0], /<a:bodyPr\b[^>]*\bwrap="none"/, 'one line');
  const written = runs(titles[0]).filter(run => run.sz);
  assert.ok(written.length > 0);
  for (const run of written) assert.equal(Number(run.spc), Math.round(-0.015 * run.sz), 'the display tracking as spc');
  assert.ok(!diagnostics.some(item => item.code === 'native-body-fallback' && /title/.test(item.message)), 'the title does not fall back');
}

// 2. Two lines at the display pitch (1.0 em) with the tracking: whatever form the title takes, every run of every line keeps the
// tracking. (Today no single-spaced native title keeps that pitch, so this title keeps its measured line boxes; see
// rr-105-native-title-wrap.mjs.)
const sampler = read('../../../examples/technical/layout-sampler.opf.json');
{
  const {titles} = await exported(sampler, 0);
  const written = titles.flatMap(title => runs(title).filter(item => item.sz));
  assert.ok(written.length >= 2, 'both lines written');
  for (const run of written) assert.equal(Number(run.spc), Math.round(-0.015 * run.sz), 'every line keeps the display tracking');
}

console.log('RR-105 title tracking passed: a one-line display title is the Title placeholder with the display tracking; every line of a two-line display title keeps the tracking.');
