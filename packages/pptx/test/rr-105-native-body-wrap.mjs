// RR-105 (opf#1089): a native body (bodyText 'native') is wrapped by PowerPoint itself, whose advances and kerning differ from core's
// measurement by a fraction of a percent. Written at exactly core's wrap width, layout-sampler slide 41's "Share results with both teams."
// (0.45 px inside its 483.55 px box) wrapped to two lines in PowerPoint 16.0.20527 and ran out of its card. The native box now wraps where
// core wrapped with WRAP_MARGIN to spare on both sides: every line fits with that room, and every soft break overruns by as much, so
// PowerPoint cannot pull a word up either (a region wider than core's measure, or lines core balanced). A body for which no width does both
// keeps its measured shapes (`native-body-fallback`, reason `tight-wrap`). Part 1 checks the written XML; part 2 checks the whole example
// corpus. PowerPoint itself is checked through COM by the qualification session (see the PR).
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {strFromU8, unzipSync} from 'fflate';
import {resolveSlideContext} from '@openpresentation/opf';
import {composeSlide} from '@openpresentation/opf/composition';
import {examples} from '@openpresentation/opf/examples';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
import {catalogs, toPptx} from './helpers/default-catalog.mjs';
import {nativeWrapWidths, planNativeBody, WRAP_MARGIN} from '../src/native-body.js';

// The fonts `opf convert` measures with.
const fonts = await loadFonts({pack: 'office', substitutionPolicy: 'visual'});
const measurement = fonts.textMeasurement;
const EMU = 9525;

const sampler = JSON.parse(await readFile(new URL('../../../examples/technical/layout-sampler.opf.json', import.meta.url), 'utf8'));
const compose = (deck, index) => {
  const context = resolveSlideContext(deck, index, {catalogs, fonts});
  return composeSlide(context.slide, context.options);
};
const plainValue = item => item.field === 'text' ? [item.runs ?? item.value] : item.value.map(entry => entry && typeof entry === 'object' && !Array.isArray(entry) ? entry.text : entry);
const shapesOf = xml => [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(([shape]) => shape);
const nativeBody = (xml, path) => shapesOf(xml).find(shape => shape.includes(`name="OPF native body ${path}"`));
const frame = shape => {
  const [, x, , width] = /<a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/>/.exec(shape).map(Number);
  return {x: x / EMU, width: width / EMU, indent: Number(/<a:pPr\b[^>]*\bmarL="(\d+)"/.exec(shape)?.[1] ?? 0) / EMU};
};
// Both margins of core's lines in a written box: the widest line's room and the narrowest soft break's overrun.
const margins = (item, shape) => {
  const {width, indent} = frame(shape), wrap = width - indent;
  const widths = nativeWrapWidths(item, plainValue(item), item.field !== 'text', measurement);
  assert.ok(widths, `${item.path}: core's lines are the body's text`);
  return {room: wrap - widths.widest, overrun: widths.unbroken - wrap, need: WRAP_MARGIN * (item.box.width - indent)};
};

// 1. layout-sampler slides 41 (step cards), 22 (a text block core measured at 980 px in a 1164.8 px region) and 20 (a body PowerPoint could
// break either way). Slides keep their positions in a three-slide deck.
{
  const picked = [40, 21, 19];
  const deck = {...sampler, slides: picked.map(index => sampler.slides[index])};
  const diagnostics = [];
  const entries = unzipSync(new Uint8Array(await toPptx(deck, {fonts, bodyText: 'native', onDiagnostic: diagnostic => diagnostics.push(diagnostic)})));
  const slideXml = index => strFromU8(entries[`ppt/slides/slide${index + 1}.xml`]);

  // Slide 41: all six cards stay native, each box wraps where core did with the margin to spare, and no box leaves the slide.
  const cards = compose(deck, 0).items.filter(item => item.field === 'text');
  assert.equal(cards.length, 6);
  for (const item of cards) {
    const shape = nativeBody(slideXml(0), item.path);
    assert.ok(shape, `${item.path} stays native`);
    const {room, overrun, need} = margins(item, shape), {x, width} = frame(shape);
    assert.ok(room >= need - 1e-6, `${item.path}: widest line leaves ${room} px, needs ${need}`);
    assert.ok(overrun >= need - 1e-6, `${item.path}: next word overruns by ${overrun} px, needs ${need}`);
    assert.ok(Math.abs(x - item.box.x) < .01, `${item.path}: left-aligned text starts where the preview draws it`);
    // The box grows (or, where core broke a line by less than the margin, narrows) on the right only, and stays on the slide.
    assert.ok(width > item.box.width - 10 && x + width <= 1280, `${item.path}: the box changes on the right only, inside the slide`);
  }
  const share = cards.find(item => item.value === 'Share results with both teams.');
  assert.deepEqual(share.text.lines, ['Share results with both teams.']);
  const before = margins(share, nativeBody(slideXml(0), share.path).replace(/cx="\d+"/, `cx="${Math.round(share.box.width * EMU)}"`));
  assert.ok(before.room < before.need, `the old box (core's exact width) left only ${before.room} px`);
  assert.ok(frame(nativeBody(slideXml(0), share.path)).width - share.box.width > 10, 'about one average character of slack');

  // Slide 22: the box is core's 980 px measure plus slack, not the 1164.8 px region, where PowerPoint would take "deciding" up a line.
  const lead = compose(deck, 1).items.find(item => item.path === 'slides.1.blocks.1.text');
  const region = compose(deck, 1).regions?.find(entry => entry.name === lead.region)?.box;
  assert.ok(region && region.width - lead.box.width > 100, 'core measures this text narrower than its region');
  const leadShape = nativeBody(slideXml(1), lead.path), leadMargins = margins(lead, leadShape);
  assert.ok(leadMargins.overrun >= leadMargins.need && leadMargins.room >= leadMargins.need);
  assert.ok(frame(leadShape).width < region.width - 100);

  // Slide 20: line 1 plus "task" overruns core's 570.4 px by 0.14 px, so no width keeps both: the measured lines stay.
  assert.ok(diagnostics.some(diagnostic => diagnostic.code === 'native-body-fallback' && diagnostic.reason === 'tight-wrap' && diagnostic.path === 'slides.2.blocks.1.text'));
  assert.equal(nativeBody(slideXml(2), 'slides.2.blocks.1.text'), undefined);
  assert.ok(shapesOf(slideXml(2)).some(shape => shape.includes('name="OPF text slides.2.blocks.1.text line 0"')), 'measured lines exported');
}

// 2. The corpus: every body of every example that the exporter writes natively keeps both margins in its planned box, and the check bites
// (bodies that the exact-width box left within the margin exist, layout-sampler slide 41 among them).
{
  let checked = 0, tight = 0, unsafeBefore = 0;
  for (const {file, deck} of examples) {
    for (const [index, slide] of deck.slides.entries()) {
      let geometry;
      try { geometry = compose(deck, index); } catch { continue; }
      const automatic = slide.layout === undefined || slide.layout === 'auto' || geometry.recomposed !== undefined;
      const reasons = [];
      const plan = planNativeBody(slide, geometry, {automatic, textMeasurement: measurement, report: diagnostic => reasons.push(diagnostic.reason)});
      tight += reasons.filter(reason => reason === 'tight-wrap').length;
      for (const body of plan ? [plan, ...plan.others] : []) {
        const {item, values, list, wrap} = body;
        const indent = list ? item.text.listEntries[0].marker.indent : 0, need = WRAP_MARGIN * (item.box.width - indent);
        const widths = nativeWrapWidths(item, values, list, measurement);
        const where = `${file} slide ${index + 1} ${item.path}`;
        assert.ok(widths, `${where}: lines verified`);
        assert.ok(wrap.width - indent - widths.widest >= need - 1e-6, `${where}: a line within ${need} px of the box`);
        assert.ok(widths.unbroken - (wrap.width - indent) >= need - 1e-6, `${where}: a break PowerPoint could undo`);
        const exact = item.box.width - indent;
        if (exact - widths.widest < need || widths.unbroken - exact < need) unsafeBefore++;
        checked++;
      }
    }
  }
  assert.ok(checked > 150, `${checked} native bodies checked`);
  assert.ok(unsafeBefore > 0, 'the exact-width box left some bodies within the margin');
  console.log(`RR-105: ${checked} native bodies keep a ${WRAP_MARGIN * 100}% wrap margin on both sides (${unsafeBefore} did not at core's exact width); ${tight} keep measured lines (tight-wrap).`);
}
