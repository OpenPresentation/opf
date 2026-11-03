// LH-117 and LH-118 in the PPTX export. A column of numbers written as text is right-aligned natively, and an unchanged export imports
// without writing that alignment back. In a right-to-left deck each signed, currency or percent number is its own en-US run (PowerPoint
// orders a number of an Arabic run by Arabic rules: "+16%" drew as "%16+"), and a paragraph of only such a number is written left to
// right at its physical alignment (as an en-US run in a right-to-left paragraph PowerPoint still drew "16%+"; verified with PowerPoint's
// own slide export, LH-118). The English trend word is a hidden shape outside an English deck, so the metric imports with its trend.
import assert from 'node:assert/strict';
import {strFromU8, unzipSync, zipSync} from 'fflate';
import {fromPptx, toPptx} from '../dist/index.js';
import {leftToRightPieces} from '../src/script-fonts.js';
import {nativeTableEntries} from './table-values.js';

const read = async presentation => {
  const bytes = await toPptx(presentation);
  const entries = unzipSync(new Uint8Array(bytes));
  return {bytes, slide: index => strFromU8(entries[`ppt/slides/slide${index}.xml`])};
};
const paragraphs = xml => [...xml.matchAll(/<a:p>([\s\S]*?)<\/a:p>/g)].map(([, body]) => ({
  pPr: /<a:pPr\b[^>]*>/.exec(body)?.[0] ?? '',
  runs: [...body.matchAll(/<a:r><a:rPr\b[^>]*?\slang="([^"]*)"[^>]*>[\s\S]*?<a:t>([^<]*)<\/a:t><\/a:r>/g)].map(([, lang, text]) => `${lang}:${text}`),
  text: [...body.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(([, text]) => text).join(''),
}));
const attribute = (tag, name) => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];
let checks = 0;

// Right to left: numbers as en-US runs, a number-only paragraph left to right, the trend word hidden; the export imports unchanged.
{
  const deck = {language: 'ar', slides: [{title: 'أداء المبيعات', blocks: [
    {metric: {value: '+16%', label: 'نمو المبيعات السنوي', delta: '+8 نقاط', trend: 'up'}},
    {table: {columns: ['المنطقة', 'التغير'], rows: [['الخليج', '+3%'], ['مصر', '-2.5%']]}},
  ]}, {title: 'نص', text: 'ارتفعت المبيعات +16% و 2026 فقط.'}]};
  const out = await read(deck);
  const slide = paragraphs(out.slide(1)), text = paragraphs(out.slide(2));
  const value = slide.find(paragraph => paragraph.text === '+16%');
  assert.deepEqual(value.runs, ['en-US:+16%']);
  assert.equal(attribute(value.pPr, 'rtl'), '0', 'a number-only paragraph is written left to right');
  assert.equal(attribute(value.pPr, 'algn'), 'ctr', 'at the alignment it had');
  assert.deepEqual(slide.find(paragraph => paragraph.text === '+8 نقاط').runs, ['en-US:+8', 'ar-SA: نقاط']);
  assert.equal(attribute(slide.find(paragraph => paragraph.text === '+8 نقاط').pPr, 'rtl'), '1');
  const cell = slide.find(paragraph => paragraph.text === '-2.5%');
  assert.deepEqual(cell.runs, ['en-US:-2.5%']);
  assert.equal(attribute(cell.pPr, 'algn'), 'r', 'a numeric cell keeps the physical right of the right-to-left start');
  assert.deepEqual(text.find(paragraph => paragraph.text.includes('فقط')).runs, ['ar-SA:ارتفعت المبيعات ', 'en-US:+16%', 'ar-SA: و 2026 فقط.'], 'bare digits stay in the Arabic run');
  assert.match(out.slide(1), /name="OPF metric 1 trend line 1" hidden="1"/, 'the English trend word is hidden');
  const round = await fromPptx(out.bytes);
  assert.deepEqual(round.slides[0].blocks, deck.slides[0].blocks, 'the metric (with its trend) and the table import unchanged');
  assert.equal(round.slides[1].text, deck.slides[1].text);
  // Without provenance, a number-only cell written left to right still imports as the logical start.
  const native = await fromPptx(zipSync(nativeTableEntries(out.bytes)));
  const table = native.slides[0].blocks?.find(block => block.table)?.table ?? native.slides[0].table;
  assert.ok([...table.rows.flat()].every(entry => entry?.style?.align === undefined || entry.style.align === 'left'), 'number-only cells import as the start edge');
  assert.deepEqual(leftToRightPieces('عن v2.0 و +3% و $5'), [[3, 7], [10, 13], [16, 18]]);
  checks += 13;
}

// An English deck keeps its trend word and writes no number runs; a column of numbers written as text is right-aligned and imports
// without an alignment.
{
  const deck = {slides: [{title: 'Pricing', table: {columns: ['Region', 'Price', 'Status'], rows: [['North', '$42', 'Hold'], ['South', '$38', '+3%']]}}, {title: 'Growth', metric: {value: '+16%', label: 'Annual growth', trend: 'up'}}]};
  const out = await read(deck);
  const cells = paragraphs(out.slide(1));
  for (const text of ['Price', '$42', '$38']) assert.equal(attribute(cells.find(paragraph => paragraph.text === text).pPr, 'algn'), 'r', text);
  for (const text of ['Status', 'Hold', '+3%']) assert.notEqual(attribute(cells.find(paragraph => paragraph.text === text).pPr, 'algn'), 'r', text);
  assert.doesNotMatch(out.slide(2), /hidden="1"/);
  const round = await fromPptx(out.bytes);
  assert.deepEqual(round.slides[0].table, deck.slides[0].table, 'the default alignment is not written back');
  assert.deepEqual(round.slides[1].metric, deck.slides[1].metric);
  checks += 9;
}

console.log(`LH-117/118 PPTX passed: ${checks} checks (numbers as en-US runs, number-only paragraphs left to right, hidden trend word, numeric columns right-aligned, unchanged import).`);
