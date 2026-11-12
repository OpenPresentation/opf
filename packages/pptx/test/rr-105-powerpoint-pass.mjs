// RR-105: findings of the v0.34 PowerPoint pass (technical examples exported from 6cb8f52 and opened in PowerPoint 16.0.20527), pinned on
// the exported XML. PowerPoint itself is not run here.
//   A. A combo with a reference line on each axis: the legend hides exactly the helper series. PowerPoint lists the legend by chart
//      group, primary axes first, and a c:legendEntry names an entry by that place; the series' c:idx follow the same order.
//   B. A native reference helper's line is the authored stroke: width (OPF px at 9525 EMU, 4/3 px by default), dash and color.
//   C. A timeline label's run names the face or bold flag that draws core's composed weight (as the preview draws it).
//   D. A narrow no-break space (U+202F) is a run of its own, so a face without it (Aptos Display) still draws the digits.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';
import {toSvg} from '@openpresentation/opf-render';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
import {fromPptx, toPptx} from '../dist/index.js';
import {splitWeightFace} from '../dist/font-weights.js';

const example = name => JSON.parse(readFileSync(new URL(`../../../examples/technical/${name}.opf.json`, import.meta.url), 'utf8'));
async function exported(deck) {
  const fonts = await loadFonts({pack: 'office', substitutionPolicy: 'visual', scripts: 'auto', presentation: deck});
  try { return {bytes: await toPptx(deck, {fonts}), svg: [await toSvg(deck, {fonts})].flat().map(slide => String(slide.svg ?? slide))}; } finally { fonts.dispose?.(); }
}
const partOf = (zip, slide, type) => {
  const rels = strFromU8(zip[`ppt/slides/_rels/slide${slide}.xml.rels`]);
  return [...rels.matchAll(/<Relationship\b[^>]*>/g)].map(([rel]) => rel).filter(rel => rel.includes(`/relationships/${type}"`)).map(rel => `ppt/${/Target="\.\.\/([^"]+)"/.exec(rel)[1]}`);
};
const seriesName = ser => /<c:tx>[\s\S]*?<c:v>([^<]*)<\/c:v>/.exec(ser)?.[1];

// A and B.
{
  const deck = example('explicit-chart-reference-lines'), {bytes} = await exported(deck), zip = unzipSync(new Uint8Array(bytes));
  let combos = 0, helpers = 0;
  deck.slides.forEach((slide, index) => {
    for (const part of partOf(zip, index + 1, 'chart')) {
      const xml = strFromU8(zip[part]), plot = /<c:plotArea>[\s\S]*<\/c:plotArea>/.exec(xml)[0];
      const primary = /<c:valAx>\s*<c:axId val="([^"]+)"/.exec(plot)[1];
      const groups = [...plot.matchAll(/<c:(\w+Chart)>[\s\S]*?<\/c:\1>/g)].map(([group]) => ({primary: group.includes(`<c:axId val="${primary}"/>`),
        series: [...group.matchAll(/<c:ser>[\s\S]*?<\/c:ser>/g)].map(([ser]) => ({idx: Number(/<c:idx val="(\d+)"/.exec(ser)[1]), name: seriesName(ser), ser}))}));
      const legend = [...groups.filter(group => group.primary), ...groups.filter(group => !group.primary)].flatMap(group => group.series);
      if (groups.some(group => !group.primary)) combos++;
      assert.deepEqual(legend.map(series => series.idx), legend.map((_, place) => place), `slide ${index + 1}: the series indexes are their legend places`);
      const deleted = [...xml.matchAll(/<c:legendEntry>\s*<c:idx val="(\d+)"\/>\s*<c:delete val="1"\/>/g)].map(match => Number(match[1]));
      const own = legend.filter(series => series.name?.startsWith('OPF reference '));
      if (xml.includes('<c:legend>')) assert.deepEqual(deleted, own.map(series => series.idx).sort((a, b) => a - b), `slide ${index + 1}: the legend hides exactly the helper series`);
      // B: each native helper draws its authored stroke.
      const authored = slide.chart.referenceLines;
      for (const helper of own) {
        helpers++;
        const line = authored[Number(/OPF reference (\d+)/.exec(helper.name)[1]) - 1], ln = /<c:spPr><a:ln w="(\d+)" cap="flat"><a:solidFill>([\s\S]*?)<\/a:solidFill><a:prstDash val="(\w+)"\/><\/a:ln><\/c:spPr>/.exec(helper.ser);
        assert.ok(ln, `slide ${index + 1} ${helper.name}: one line fill and dash`);
        assert.equal(Number(ln[1]), Math.round((line.stroke?.width ?? 4 / 3) * 9525), `slide ${index + 1} ${helper.name}: the authored width`);
        assert.equal(ln[3], line.stroke?.dash ?? 'dash', `slide ${index + 1} ${helper.name}: the authored dash`);
        assert.match(ln[2], new RegExp(`^<a:schemeClr val="${line.stroke.color}">\\s*</a:schemeClr>$`), `slide ${index + 1} ${helper.name}: the authored theme color, untransformed`);
        assert.equal(helper.ser.includes('<c:dPt>'), false, `slide ${index + 1} ${helper.name}: no point override`);
      }
    }
  });
  assert.equal(combos, 1, 'the combo slide is checked');
  assert.equal(helpers, 6, 'every native helper is checked');
  const back = await fromPptx(bytes);
  assert.deepEqual(back.slides[2].chart.referenceLines.map(line => [line.axis, line.value, line.label]), [['secondary', 0.25, 'Margin 25%'], ['value', 150, 'Revenue 150']]);
  assert.deepEqual(back.slides[2].chart.data.columns, deck.slides[2].chart.data.columns, 'the authored series import in their order');
}

// C. Every timeline label the preview draws at a weight has a run that draws it: a weight face (Roboto SemiBold) at its weight, else
// PowerPoint's bold flag at 600 and above.
let labels = 0;
for (const name of ['duration-timeline', 'localized-timeline', 'layout-sampler']) {
  const deck = example(name), {bytes, svg} = await exported(deck), zip = unzipSync(new Uint8Array(bytes));
  deck.slides.forEach((slide, index) => {
    if (!slide.timeline) return;
    const runs = [...strFromU8(zip[`ppt/slides/slide${index + 1}.xml`]).matchAll(/<a:rPr\b([^>]*)>(?:(?!<\/a:rPr>)[\s\S])*?<a:latin typeface="([^"]+)"[\s\S]*?<\/a:rPr><a:t[^>]*>([^<]*)<\/a:t>/g)]
      .map(([, attributes, latin, text]) => ({bold: /\bb="1"/.test(attributes), latin, text}));
    for (const [text] of svg[index].matchAll(/<text\b[^>]*>[\s\S]*?<\/text>/g)) {
      const weight = Number(/font-weight="(\d+)"/.exec(text)?.[1] ?? 400), family = /font-family="([^",]+)/.exec(text)?.[1], words = text.replace(/<[^>]+>/g, '');
      const matching = runs.filter(run => run.text === words);
      if (matching.length !== 1 || !family) continue;
      const face = splitWeightFace(family), run = matching[0], drawn = splitWeightFace(run.latin)?.weight ?? (run.bold ? 700 : 400);
      assert.equal(drawn, face ? weight : weight >= 600 ? 700 : 400, `${name} slide ${index + 1} ${JSON.stringify(words)}: ${run.latin}${run.bold ? ' bold' : ''} draws ${family} ${weight}`);
      labels++;
    }
  });
}
assert.ok(labels >= 20, `the timeline labels are compared (${labels})`);

// D. "150 000" (fr-FR grouping with U+202F) is three runs of the metric's properties, which the import reads as one.
{
  const deck = example('multilingual-slides'), {bytes} = await exported(deck), zip = unzipSync(new Uint8Array(bytes));
  const xml = strFromU8(zip['ppt/slides/slide4.xml']);
  const value = /<p:sp>(?:(?!<\/p:sp>)[\s\S])*?name="OPF metric 1 value line 1"[\s\S]*?<\/p:sp>/.exec(xml)[0];
  const runs = [...value.matchAll(/<a:r>(<a:rPr\b[\s\S]*?<\/a:rPr>)<a:t>([^<]*)<\/a:t><\/a:r>/g)].map(([, properties, text]) => ({properties, text}));
  assert.deepEqual(runs.map(run => run.text), ['150', '\u202F', '000'], 'the separator is a run of its own');
  assert.equal(new Set(runs.map(run => run.properties)).size, 1, 'with the same properties');
  assert.match(runs[0].properties, /<a:latin typeface="Aptos Display"/);
  assert.equal(/<a:t>[^<]*\u202F[^<]*<\/a:t>/.test(xml.replace(/<a:t>\u202F+<\/a:t>/g, '')), false, 'no other run on the slide holds the separator with other text');
  // The import reads the split runs as it read the one run (the joined runs written back as one give the same document).
  const joined = {...zip, 'ppt/slides/slide4.xml': strToU8(xml.replace(runs.map(run => `<a:r>${run.properties}<a:t>${run.text}</a:t></a:r>`).join(''), `<a:r>${runs[0].properties}<a:t>150 000</a:t></a:r>`))};
  assert.notEqual(strFromU8(joined['ppt/slides/slide4.xml']), xml, 'the control joins the runs');
  assert.deepEqual(await fromPptx(bytes), await fromPptx(zipSync(joined)), 'the split runs import as one run did');
}

console.log(`RR-105 PowerPoint pass: combo legend places and helper strokes, ${labels} timeline label weights, and the U+202F run pass.`);
