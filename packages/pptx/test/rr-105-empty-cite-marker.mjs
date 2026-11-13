// RR-105 (coverage finding 27): a `cite` or `footnote` on an empty run exports its marker as the native superscript run
// (baseline 30000) after the text before it, the preview draws the same marker, and the import gives the empty run back.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {unzipSync} from 'fflate';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
import {toSvg, toPptx, fromPptx} from './helpers/default-catalog.mjs';

const decoder = new TextDecoder();
const deck = () => ({
  design: {fontScheme: 'roboto'},
  references: [{id: 'itf', text: 'International Transport Forum, Port Outlook 2025.'}],
  slides: [
    {title: 'Cite', text: ['Ports grew 3 percent', {text: '', cite: 'itf'}, '.']},
    {title: 'Footnote', text: ['Ports grew 3 percent', {text: '', footnote: 'Unaudited.'}, '.']},
  ],
});
const runsOf = xml => [...xml.matchAll(/<a:r><a:rPr\b([^>]*)>[\s\S]*?<a:t>([^<]*)<\/a:t><\/a:r>/g)].map(match => ({marker: /baseline="30000"/.test(match[1]), text: match[2]}));
const stripEngine = value => Array.isArray(value) ? value.map(run => {
  if (typeof run === 'string') return run;
  const kept = Object.fromEntries(Object.entries(run).filter(([key]) => !['fontSize', 'fontFamily', 'color'].includes(key)));
  return Object.keys(kept).length === 1 && typeof kept.text === 'string' && kept.text !== '' ? kept.text : kept;
}) : value;
const fonts = await loadFonts({pack: 'office', fallbackFamily: 'Roboto', strictGlyphs: false});

test('an empty cited or footnoted run exports its marker after the text before it, as the preview draws it', async () => {
  const source = deck();
  const bytes = await toPptx(source, {seed: 1, fonts});
  const entries = unzipSync(bytes);
  for (const index of [0, 1]) {
    const xml = decoder.decode(entries[`ppt/slides/slide${index + 1}.xml`]);
    const runs = runsOf(xml), at = runs.findIndex(run => run.marker);
    assert.ok(at > 0, `slide ${index + 1} has a marker run`);
    assert.equal(runs[at].text, String(index + 1));
    assert.match(runs[at - 1].text, /percent$/u);
    assert.equal(runs[at + 1]?.text, '.');
    const svg = toSvg(source, index + 1, {trace: true});
    const markers = [...svg.matchAll(/<tspan[^>]*data-opf-segment="marker"[^>]*>([^<]*)<\/tspan>/g)].map(match => match[1]);
    assert.deepEqual(markers, [String(index + 1)], `slide ${index + 1} preview marker`);
  }
});

test('the empty marked run comes back from the import', async () => {
  const source = deck();
  const imported = await fromPptx(await toPptx(source, {seed: 1, fonts}));
  assert.deepEqual(imported.references, source.references);
  for (const index of [0, 1]) assert.deepEqual(stripEngine(imported.slides[index].text), source.slides[index].text);
  assert.ok(!JSON.stringify(imported).includes('"superscript":true'), 'no marker run survives import');
});
