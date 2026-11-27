// opf#1551, opf#1552, opf#1553: a native body (`bodyText: 'native'`) writes the alignment, the weight and the color the default (measured)
// export writes for the same text, because both describe the one preview. Archive controls on the exported XML; the default export is the
// oracle for every value, read run by run.
import assert from 'node:assert/strict';
import test from 'node:test';
import {unzipSync, strFromU8} from 'fflate';
import {toPptx, fromPptx} from './helpers/default-catalog.mjs';
import * as nativeBody from '../dist/native-body.js';
const nativeAlignment = (...values) => nativeBody.nativeAlignment(...values);

const options = {seed: 1551, timestamp: '2026-11-27T00:00:00Z', zipDate: '2026-11-27T00:00:00Z'};
const slideNames = entries => Object.keys(entries).filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name)).sort((a, b) => Number(a.match(/\d+/)) - Number(b.match(/\d+/)));
const shapesOf = xml => [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(([shape]) => shape);
const nameOf = shape => shape.match(/<p:cNvPr\b[^>]*\bname="([^"]*)"/)?.[1] ?? '';
const unescape = text => text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

async function exportBoth(deck) {
  const result = {};
  for (const mode of ['default', 'native']) {
    const diagnostics = [];
    const bytes = new Uint8Array(await toPptx(deck, {...options, ...(mode === 'native' ? {bodyText: 'native'} : {}), onDiagnostic: diagnostic => diagnostics.push(diagnostic)}));
    result[mode] = {bytes, entries: unzipSync(bytes), diagnostics};
  }
  return result;
}

/** Each body shape of a slide (the default export's `OPF text` and `OPF list` lines, a native export's `OPF native body`) by paragraph and run. */
function bodies(entries, slide, mode) {
  const own = mode === 'native' ? /^OPF native body / : /^OPF (?:text|list) /;
  return shapesOf(strFromU8(entries[slideNames(entries)[slide]])).filter(shape => own.test(nameOf(shape))).map(shape => ({
    name: nameOf(shape), xml: shape,
    offset: shape.match(/<a:off x="(\d+)" y="(\d+)"/).slice(1).map(Number),
    paragraphs: (shape.match(/<a:p>[\s\S]*?<\/a:p>/g) ?? []).map(paragraph => ({
      align: paragraph.match(/<a:pPr\b[^>]*\balgn="([^"]*)"/)?.[1],
      runs: (paragraph.match(/<a:r>[\s\S]*?<\/a:r>/g) ?? []).map(run => {
        const properties = run.match(/<a:rPr\b[^>]*>/)[0];
        return {
          text: unescape(run.match(/<a:t>([^<]*)<\/a:t>/)?.[1] ?? ''), properties,
          bold: /\sb="1"/.test(properties), italic: /\si="1"/.test(properties),
          color: run.match(/<a:rPr\b[\s\S]*?<a:solidFill><a:(srgbClr|schemeClr) val="([^"]+)"/)?.slice(1, 3).join(':')
        };
      })
    }))
  }));
}
const runsOf = list => list.flatMap(shape => shape.paragraphs.flatMap(paragraph => paragraph.runs));
/** One look per visible character, in reading order: where a wrapped line ends the default export drops the space, so spaces are not compared. */
const characterLooks = list => runsOf(list).flatMap(run => [...run.text].filter(char => /\S/.test(char) && char !== ' ').map(char => `${char} b${+run.bold} i${+run.italic} ${run.color}`));
const alignments = list => new Set(list.flatMap(shape => shape.paragraphs.map(paragraph => paragraph.align)));

const minimal = {
  list: {name: 'EX-06 native list centered', language: 'en-US', design: {contentBox: true, contentAlignment: 'center'},
    slides: [{title: 'Carded Content Override', items: ['Content can opt into card rendering.', 'Alignment can change per slide.']}]},
  weight: {name: 'EX-05 native bullets inherit the layout\'s bold', language: 'en-US', slides: [
    {title: 'Market Shift', blocks: [{region: 'start', text: 'Signal'}, {region: 'center+end', items: ['Demand moved upmarket', 'Procurement cycles shortened']}]},
    {title: 'Operating Choice', blocks: [{region: 'start+center', bullets: ['Standardize the intake path', 'Keep escalation rules visible']},
      {region: 'end', text: 'Decision owners need one place to see what changed.'}]}]},
  color: {name: 'EX-11 native lead-in emphasis color', language: 'en-US', slides: [{title: 'Promoted rows have distinct positions', blocks: [
    {region: 'top', text: 'First: state the situation.'}, {region: 'middle', text: 'Then: explain the change.'}, {region: 'bottom', text: 'Finally: make the recommendation.'}]}]}
};

// Every value below is read from the default export of the same deck: native and measured must agree run by run.
const sameLooks = (pair, slide) => assert.deepEqual(characterLooks(bodies(pair.native.entries, slide, 'native')), characterLooks(bodies(pair.default.entries, slide, 'default')),
  `slide ${slide + 1}: every native character has the weight, slant and color of the default export`);
const noFallback = pair => assert.deepEqual(pair.native.diagnostics.filter(diagnostic => diagnostic.code === 'native-body-fallback'), [], 'the native body is written, not the measured fallback');

test('opf#1551: a native list keeps its own alignment under the slide\'s content alignment', async () => {
  const pair = await exportBoth(minimal.list);
  noFallback(pair);
  const native = bodies(pair.native.entries, 0, 'native'), measured = bodies(pair.default.entries, 0, 'default');
  assert.equal(native.length, 1, 'one native list body');
  assert.deepEqual([...alignments(native)], ['l'], 'the native list paragraphs are left-aligned');
  assert.deepEqual([...alignments(measured)], ['l'], 'the default export keeps its list lines left-aligned');
  assert.equal(native[0].paragraphs.length, 2, 'two entries, two paragraphs');
  assert.equal((native[0].xml.match(/<a:buChar\b/g) ?? []).length, 2 + 1, 'the bullets are native (one per paragraph and the list style\'s)');
  // The wrap box is the one a left-aligned body grows (to the right), so the list does not shift left of where the preview draws it.
  assert.equal(native[0].offset[0], Math.min(...measured.map(line => line.offset[0])), 'the native list starts at the default export\'s left edge');
});

test('opf#1551: neighbors, a list under every content alignment and numbering, text, nested and right-to-left lists', async () => {
  const pair = await exportBoth({name: 'Native list alignment neighbors', language: 'en-US', slides: [
    {title: 'End aligned content', design: {contentBox: true, contentAlignment: 'end'}, bullets: ['Content can opt into card rendering.', 'Alignment can change per slide.']},
    {title: 'Centered numbered list', design: {contentBox: true, contentAlignment: 'center'}, items: ['Content can opt into card rendering.', 'Alignment can change per slide.'], numbering: 'arabic'},
    {title: 'Centered text stays centered', design: {contentBox: true, contentAlignment: 'center'}, text: 'Alignment can change per slide for a plain paragraph.'},
    {title: 'Centered nested list', design: {contentBox: true, contentAlignment: 'center'}, items: ['Content can opt into card rendering.', {text: 'A nested entry keeps its level.', level: 1}, 'Alignment can change per slide.']},
    {title: 'قائمة محاذاة', language: 'ar-SA', design: {contentBox: true, contentAlignment: 'center'}, items: ['يمكن أن يختار المحتوى عرض البطاقات.', 'يمكن أن تتغير المحاذاة لكل شريحة.']}]});
  const align = (slide, mode) => [...alignments(bodies(pair[mode].entries, slide, mode))];
  assert.deepEqual(align(0, 'native'), ['l'], 'a bulleted list under end alignment');
  assert.deepEqual(align(0, 'default'), ['l']);
  assert.deepEqual(align(1, 'native'), ['l'], 'a numbered list under center alignment');
  assert.deepEqual(align(1, 'default'), ['l']);
  assert.match(bodies(pair.native.entries, 1, 'native')[0].xml, /<a:buAutoNum\b/, 'the numbers are native auto-numbers');
  assert.deepEqual(align(2, 'native'), ['ctr'], 'plain text keeps the slide\'s content alignment');
  assert.deepEqual(align(2, 'default'), ['ctr']);
  // A nested list and a right-to-left list keep their measured lines (native-body-fallback); the alignment they write is the list rule.
  for (const [slide, expected] of [[3, 'l'], [4, 'r']]) {
    assert.ok(pair.native.diagnostics.some(diagnostic => diagnostic.code === 'native-body-fallback' && diagnostic.path === `slides.${slide}.items`), `slide ${slide + 1} stays measured`);
    // The measured fallback's shapes carry the default export's names, in the native export too.
    assert.deepEqual([...alignments(bodies(pair.native.entries, slide, 'default'))], [expected]);
    assert.deepEqual(align(slide, 'default'), [expected]);
  }
});

test('opf#1551: the list alignment rule is the measured export\'s: start edge, mirrored in right-to-left text, never the content alignment', () => {
  const fit = direction => ({listEntries: [{direction}], directions: [direction]});
  for (const alignment of ['left', 'center', 'right', undefined]) {
    assert.equal(nativeAlignment({alignment, text: fit('ltr')}, true), 'left', `a left-to-right list under ${alignment}`);
    assert.equal(nativeAlignment({alignment, text: fit('rtl')}, true), 'right', `a right-to-left list under ${alignment}: mirrored, not centered`);
  }
  assert.equal(nativeAlignment({alignment: 'center', text: {}}, false), 'center', 'plain text takes the item\'s alignment');
  assert.equal(nativeAlignment({text: {}}, false), 'left');
});

test('opf#1552: regular native runs state their weight, so the layout placeholder\'s bold does not reach them', async () => {
  const pair = await exportBoth(minimal.weight);
  noFallback(pair);
  // The control holds the defect's condition: slide 2's layout gives the Body placeholder b="1" at level 1.
  const relationships = strFromU8(pair.native.entries['ppt/slides/_rels/slide2.xml.rels']);
  const layout = strFromU8(pair.native.entries['ppt/slideLayouts/' + relationships.match(/slideLayouts\/([^"]+)"/)[1]]);
  assert.match(layout, /<p:ph type="body" idx="300"\/>[\s\S]*?<a:lvl1pPr\b[^>]*><a:defRPr\b[^>]*\bb="1"/, 'the layout\'s Body placeholder is bold at level 1');
  const native = bodies(pair.native.entries, 1, 'native');
  assert.equal(native[0].name, 'OPF native body slides.1.blocks.0.bullets');
  for (const run of runsOf(native)) {
    assert.match(run.properties, /\sb="0"/, `"${run.text}" says b="0"`);
    assert.match(run.properties, /\si="0"/, `"${run.text}" says i="0"`);
  }
  assert.ok(native.length === 2 && runsOf(native).length === 3, 'the bullets and the sentence beside them');
  for (const slide of [0, 1]) sameLooks(pair, slide);
  // Imported again, the regular bullets are regular (the importer reads the run's own weight first).
  const imported = await fromPptx(pair.native.bytes);
  assert.ok(!JSON.stringify(imported.slides[1]).includes('"bold":true'), 'no regular text is imported bold');
});

test('opf#1552: neighbors, italic, bold and both under a bold placeholder, an authored regular run in a bold text, list entries', async () => {
  const pair = await exportBoth({name: 'Native weight neighbors', language: 'en-US', slides: [
    {title: 'Market Shift', blocks: [{region: 'start', text: 'Signal'}, {region: 'center+end', items: ['Demand moved upmarket', 'Procurement cycles shortened']}]},
    {title: 'Operating Choice', blocks: [{region: 'start+center', bullets: ['Standardize the intake path', 'Keep escalation rules visible']},
      {region: 'end', text: [{text: 'Plain, '}, {text: 'italic', italic: true}, {text: ', '}, {text: 'bold', bold: true}, {text: ' and '}, {text: 'both', bold: true, italic: true}, {text: '.'}]}]},
    {title: 'Weight under a bold sample', blocks: [{region: 'start', text: [{text: 'Signal', bold: true}, {text: ' and regular words', bold: false}]},
      {region: 'center+end', items: [[{text: 'Italic entry', italic: true}], [{text: 'Regular entry'}]]}]}]});
  noFallback(pair);
  for (const slide of [0, 1, 2]) sameLooks(pair, slide);
  const rich = runsOf(bodies(pair.native.entries, 1, 'native')).filter(run => /^(italic|bold|both|Plain, )$/.test(run.text));
  assert.deepEqual(rich.map(run => [run.text, run.bold, run.italic]), [['Plain, ', false, false], ['italic', false, true], ['bold', true, false], ['both', true, true]]);
  const mixed = runsOf(bodies(pair.native.entries, 2, 'native'));
  assert.deepEqual(mixed.filter(run => run.text.includes('regular') || run.text === 'Signal').map(run => [run.text, run.bold]), [['Signal', true], [' and regular words', false]]);
  assert.match(mixed.find(run => run.text.includes('regular')).properties, /\sb="0"/, 'a regular run in a bold text says so');
});

test('opf#1553: a native run has the emphasis color core gives a bold run, on a dark slide and on a light one', async () => {
  const pair = await exportBoth(minimal.color);
  noFallback(pair);
  const native = bodies(pair.native.entries, 0, 'native'), measured = bodies(pair.default.entries, 0, 'default');
  assert.equal(native.length, 3, 'three native bodies');
  const colorOf = (list, text) => runsOf(list).find(run => run.text === text).color;
  for (const label of ['First:', 'Then:', 'Finally:']) {
    assert.match(colorOf(measured, label), /^srgbClr:[0-9A-F]{6}$/, `the default export writes ${label} in core\'s emphasis tint`);
    assert.equal(colorOf(native, label), colorOf(measured, label), `${label} has the default export\'s color`);
  }
  assert.equal(colorOf(native, 'First:'), 'srgbClr:308BC7');
  assert.equal(colorOf(native, ' state the situation.'), 'schemeClr:tx1', 'the rest of the line keeps the text color');
  sameLooks(pair, 0);
});

test('opf#1553: neighbors, an authored run color, a light slide and a plain text', async () => {
  const pair = await exportBoth({name: 'Native emphasis color neighbors', language: 'en-US', slides: [
    {title: 'Authored color wins', blocks: [
      {region: 'top', text: [{text: 'Alert:', bold: true, color: '#C0392B'}, {text: ' keep this red.'}]},
      {region: 'middle', text: [{text: 'Note:', bold: true}, {text: ' this label takes the emphasis color.'}]},
      {region: 'bottom', text: 'A plain sentence has no emphasis.'}]},
    {title: 'Light slide', design: {variant: 'light1'}, blocks: [
      {region: 'top', text: 'First: state the situation.'},
      {region: 'middle', text: [{text: 'Then:', bold: true}, {text: ' explain the change.'}]},
      {region: 'bottom', text: [{text: 'Finally:', bold: true, color: '#C0392B'}, {text: ' make the recommendation.'}]}]}]});
  noFallback(pair);
  for (const slide of [0, 1]) sameLooks(pair, slide);
  const colorOf = (slide, text) => runsOf(bodies(pair.native.entries, slide, 'native')).find(run => run.text === text).color;
  assert.equal(colorOf(0, 'Alert:'), 'srgbClr:C0392B', 'an authored color is kept');
  assert.equal(colorOf(1, 'Finally:'), 'srgbClr:C0392B');
  assert.equal(colorOf(1, 'First:'), 'schemeClr:accent1', 'on a light slide the emphasis is the primary, as the default export writes it');
  assert.equal(runsOf(bodies(pair.default.entries, 1, 'default')).find(run => run.text === 'First:').color, 'schemeClr:accent1');
  assert.equal(colorOf(0, 'Note:'), 'schemeClr:tx1', 'a text that is not a lone display message has no emphasis in either export');
});
