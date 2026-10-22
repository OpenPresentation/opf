import assert from 'node:assert/strict';
import {unzipSync, zipSync} from 'fflate';
import {validate} from '@openpresentation/opf';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
import PptxGenJS from '../vendor/pptxgenjs/pptxgen.es.js';
import {toPptx, fromPptx} from './helpers/default-catalog.mjs';
import {FONT_WEIGHT_WORDS, isFaceStyleSuffix, splitWeightFace} from '../src/font-weights.js';

// The exporter names a chosen family's weight faces by their native style-link
// names ("Roboto SemiBold"). Import maps them back to family + OPF bold and never
// alters a genuine family that merely ends in a weight word ("Arial Black").
const runs = deck => deck.slides[0].blocks.filter(block => block.type === 'text').flatMap(block => [block.text].flat());
async function nativeRuns(faces, theme) {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  if (theme) pptx.theme = theme;
  const slide = pptx.addSlide();
  faces.forEach((face, index) => slide.addText(`Sample ${index}`, {x: 1, y: 0.5 + index * 0.6, w: 6, h: 0.5, fontSize: 18, fontFace: face}));
  const diagnostics = [];
  const deck = await fromPptx(await pptx.write({outputType: 'uint8array'}), {onDiagnostic: item => diagnostics.push(item)});
  assert.equal(validate(deck, {only: ['format']}).valid, true);
  return {runs: runs(deck), diagnostics};
}
const family = run => run.fontFamily;

// 1. Exporter round trip through the real weight faces: heading-weight quote body is Roboto SemiBold, attribution Roboto Medium.
const options = {fonts: await loadFonts()};
const source = {design: {fontScheme: 'roboto'}, slides: [{title: 'Weights', quote: {text: 'Retain the selected source.', attribution: 'Reviewer', source: 'Recorded interview'}}]};
const exported = await toPptx(structuredClone(source), {...options, strictAssets: true});
const diagnostics = [];
// FF-57: an unchanged quote re-imports as a quote payload (no runs). This case tests the native weight-face mapping, so import the
// quote lines without their OPF_QUOTE_V1 tags, as PowerPoint-authored text would arrive.
const untagged = unzipSync(exported);
untagged['ppt/slides/slide1.xml'] = new TextEncoder().encode(new TextDecoder().decode(untagged['ppt/slides/slide1.xml']).replace(/<p:custDataLst>[^]*?<\/p:custDataLst>/g, ''));
const round = await fromPptx(zipSync(untagged), {onDiagnostic: item => diagnostics.push(item)});
assert.equal(validate(round, {only: ['format']}).valid, true);
assert.ok(!JSON.stringify(round).includes('Roboto SemiBold') && !JSON.stringify(round).includes('Roboto Medium'), 'native weight-face names must not reach OPF');
const [body, footer] = runs(round);
assert.deepEqual([family(body), body.bold], ['Roboto', true], 'SemiBold maps to Roboto + bold');
assert.deepEqual([family(footer), footer.bold], ['Roboto', undefined], 'Medium maps to plain Roboto');
assert.ok(diagnostics.some(item => item.code === 'approximate-body-font-weight'), 'the lost numeric weight is reported');

// 2. Native weight faces of a known family, whatever the theme.
{
  const {runs: imported, diagnostics: notes} = await nativeRuns(['Roboto Medium', 'Roboto SemiBold', 'Roboto ExtraBold', 'Roboto Light', 'Roboto Bold', 'Roboto']);
  assert.deepEqual(imported.map(family), Array(6).fill('Roboto'));
  assert.deepEqual(imported.map(run => run.bold), [undefined, true, true, undefined, true, undefined]);
  assert.deepEqual(notes.filter(item => item.code === 'approximate-body-font-weight').length, 4, 'Medium, SemiBold, ExtraBold and Light are approximated; Bold and regular are exact');
}

// 3. Only faces the exporter itself can emit (bundled Roboto) are split. Authored theme families are not,
// including a theme font that is itself a weight-named Roboto face.
{
  const other = await nativeRuns(['Inter SemiBold', 'Inter Medium'], {headFontFace: 'Inter', bodyFontFace: 'Inter'});
  assert.deepEqual(other.runs.map(family), ['Inter SemiBold', 'Inter Medium']);
  assert.deepEqual(other.runs.map(run => run.bold), [undefined, undefined]);
  const aptos = await nativeRuns(['Aptos Light', 'Aptos SemiBold', 'Aptos Black'], {headFontFace: 'Aptos Display', bodyFontFace: 'Aptos'});
  assert.deepEqual(aptos.runs.map(family), ['Aptos Light', 'Aptos SemiBold', 'Aptos Black']);
  assert.ok(aptos.runs.every(run => run.bold === undefined));
  assert.ok(!aptos.diagnostics.some(item => item.code === 'approximate-body-font-weight'));
  const themed = await nativeRuns(['Roboto Light', 'Roboto SemiBold'], {headFontFace: 'Roboto Light', bodyFontFace: 'Roboto Light'});
  assert.equal(themed.runs[0].fontFamily, 'Roboto Light', 'a theme font that is itself Roboto Light is an authored family');
  assert.equal(themed.runs[0].bold, undefined);
  assert.deepEqual([themed.runs[1].fontFamily, themed.runs[1].bold], ['Roboto', true], 'other Roboto faces still map');
}

// 4. Genuine families ending in a weight word stay exactly as authored.
for (const [face, theme] of [['Arial Black', undefined], ['Arial Black', {headFontFace: 'Arial', bodyFontFace: 'Arial'}], ['Segoe UI Semibold', {headFontFace: 'Segoe UI', bodyFontFace: 'Segoe UI'}], ['Calibri Light', {headFontFace: 'Calibri', bodyFontFace: 'Calibri'}], ['Roboto Mono', undefined], ['Roboto Fancy', undefined]]) {
  const {runs: imported, diagnostics: notes} = await nativeRuns([face], theme);
  assert.equal(imported[0].fontFamily, face, `${face} keeps its genuine family name`);
  assert.equal(imported[0].bold, undefined, `${face} is not turned bold`);
  assert.ok(!notes.some(item => item.code === 'approximate-body-font-weight'), `${face} reports no weight approximation`);
}

// 5. Table cell runs use the same mapping.
{
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.addSlide().addTable([[{text: 'Cell', options: {fontFace: 'Roboto SemiBold', fontSize: 14}}]], {x: 1, y: 1, w: 4, colW: [4]});
  const cell = (await fromPptx(await pptx.write({outputType: 'uint8array'}))).slides[0].blocks.find(block => block.table).table.rows[0][0];
  const cellRuns = [cell.value].flat().filter(run => typeof run === 'object');
  assert.deepEqual(cellRuns.map(run => [run.fontFamily, run.bold]), [['Roboto', true]]);
}

// 6. One table: every recognized weight word both keeps a face (exporter) and splits it (importer), spaced or joined.
for (const [word, weight] of FONT_WEIGHT_WORDS) {
  assert.ok(isFaceStyleSuffix(word), word);
  assert.equal(splitWeightFace(`Roboto ${word}`)?.weight, weight, word);
}
for (const [spaced, weight] of [['semi bold', 600], ['Extra Bold', 800], ['ultra black', 950], ['Demi Light', 350], ['extra light', 200]]) {
  assert.equal(splitWeightFace(`Roboto ${spaced}`)?.weight, weight, spaced);
}
assert.equal(splitWeightFace('Roboto Fancy'), undefined);
assert.equal(splitWeightFace('Roboto'), undefined);
assert.equal(splitWeightFace('Robotox Bold'), undefined);
assert.equal(splitWeightFace('Arial Black'), undefined);
assert.equal(splitWeightFace('Aptos Light'), undefined);
assert.deepEqual(splitWeightFace('Roboto Medium Italic'), {family: 'Roboto', weight: 500, italic: true});

// 7. Typeface names come from untrusted files: matching is linear. A repeated near-miss must not backtrack.
{
  const hostile = 'Roboto ' + 'semibold '.repeat(50000) + 'x';
  const started = performance.now();
  assert.equal(splitWeightFace(hostile), undefined);
  assert.equal(isFaceStyleSuffix('semi bold '.repeat(50000) + 'x'), false);
  assert.equal(isFaceStyleSuffix('extra black '.repeat(50000)), true);
  assert.ok(performance.now() - started < 100, 'n=50000 style words finish in under 100 ms');
  const imported = await nativeRuns(['Roboto ' + 'semibold '.repeat(50000) + 'x']);
  assert.equal(imported.runs[0].fontFamily, hostile, 'the hostile name is imported as authored');
  assert.ok(performance.now() - started < 5000, 'the whole import stays fast');
}

console.log(JSON.stringify({test: 'font-weight-import', passed: true, words: FONT_WEIGHT_WORDS.length}));
