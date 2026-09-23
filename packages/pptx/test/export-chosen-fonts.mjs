import assert from 'node:assert/strict';
import {strFromU8, unzipSync} from 'fflate';
import {prepareNodeFonts} from '@openpresentation/opf-render/fonts-node';
import {toPptx} from '../src/index.js';

// FF-31: a preview font substitute (Carlito for Aptos, Gelasio for Georgia, ...) only
// changes measurement and drawing. The exported PPTX always names the developer's
// chosen family, whatever registry or substitution policy the caller passes.

const allTypefaces = entries => {
  const faces = new Set();
  for (const [name, value] of Object.entries(entries)) {
    if (!/\.xml$/.test(name)) continue;
    for (const match of strFromU8(value).matchAll(/typeface="([^"]*)"/g)) if (match[1] && !match[1].startsWith('+')) faces.add(match[1]);
  }
  return faces;
};
const themePair = entries => {
  const xml = strFromU8(entries['ppt/theme/theme1.xml']);
  return {major: xml.match(/<a:majorFont><a:latin typeface="([^"]*)"/)?.[1], minor: xml.match(/<a:minorFont><a:latin typeface="([^"]*)"/)?.[1]};
};

const slides = [
  {id: 'text', title: 'Quarterly review', text: 'Body copy that wraps across the text region to exercise measurement.'},
  {id: 'rich', title: 'Rich', text: [{text: 'Bold ', bold: true}, {text: 'italic ', italic: true}, {text: 'plain'}]},
  {id: 'bullets', title: 'List', bullets: ['First point', 'Second point', 'Third point']},
  {id: 'code', layout: 'code-1x', title: 'Rule', code: {source: 'const score = urgency * confidence;', language: 'ts'}},
  {id: 'table', table: {columns: [['Header ', {text: 'bold', bold: true}]], rows: [[['Cell ', {text: 'emphasis', italic: true}]]]}},
  {id: 'quote', quote: {text: 'Quote body', attribution: 'Quote author', source: 'Original source'}},
  {id: 'metric', metric: {value: 123, label: 'Weight label', description: 'Regular description', delta: '+2'}},
  {id: 'timeline', timeline: {events: [{when: 'Q1', what: 'Plan'}, {when: 'Q2', what: 'Build'}]}},
  {id: 'chart', title: 'Chart', chart: {type: 'column', data: {columns: ['Quarter', 'Current'], rows: [['Q1', 2], ['Q2', 3]]}}},
];
const cases = [
  {fontScheme: 'aptos', substitute: 'Carlito', expected: {major: 'Aptos Display', minor: 'Aptos'}},
  {fontScheme: 'calibri', substitute: 'Carlito', expected: {major: 'Calibri', minor: 'Calibri'}},
  {fontScheme: 'georgia', substitute: 'Gelasio', expected: {major: 'Georgia', minor: 'Georgia'}},
  {fontScheme: 'times-new-roman', substitute: 'Tinos', expected: {major: 'Times New Roman', minor: 'Times New Roman'}},
  {fontScheme: 'tahoma', substitute: 'Arimo', expected: {major: 'Tahoma', minor: 'Tahoma'}},
  {fontScheme: 'consolas', substitute: 'Cousine', expected: {major: 'Consolas', minor: 'Consolas'}},
  {fontScheme: 'courier-new', substitute: 'Cousine', expected: {major: 'Courier New', minor: 'Courier New'}},
];
const substitutes = ['Carlito', 'Caladea', 'Arimo', 'Tinos', 'Cousine', 'Gelasio'];
const {options: visual, registry} = await prepareNodeFonts({pack: 'office', substitutionPolicy: 'visual'});
const reference = new Map();
for (const {fontScheme, substitute, expected} of cases) {
  const presentation = {name: fontScheme, design: {fontScheme}, slides};
  const plain = unzipSync(new Uint8Array(await toPptx(structuredClone(presentation), {strictAssets: true})));
  registry.clearSubstitutions();
  const measured = unzipSync(new Uint8Array(await toPptx(structuredClone(presentation), {...visual, strictAssets: true})));
  assert.ok(registry.substitutions.some(entry => entry.resolvedFamily === substitute), `${fontScheme}: the preview measured with ${substitute}`);
  assert.deepEqual(themePair(measured), expected, `${fontScheme}: theme keeps the chosen families`);
  const faces = allTypefaces(measured);
  for (const name of substitutes) assert.ok(!faces.has(name), `${fontScheme}: substitute ${name} must never reach the PPTX (${[...faces]})`);
  assert.deepEqual([...faces].sort(), [...allTypefaces(plain)].sort(), `${fontScheme}: measured export names the same typefaces as an unmeasured export`);
  reference.set(fontScheme, themePair(measured));
}

// Exact faces keep their native four-style selector names (Roboto Medium is Roboto, not a substitute).
const {options: base} = await prepareNodeFonts();
const roboto = unzipSync(new Uint8Array(await toPptx({name: 'Roboto', design: {fontScheme: 'roboto'}, slides: [{id: 'm', title: 'T', text: [{text: 'Regular '}, {text: 'bold', bold: true}]}]}, {...base, strictAssets: true})));
assert.deepEqual(themePair(roboto), {major: 'Roboto', minor: 'Roboto'});
assert.ok(!allTypefaces(roboto).has('Carlito'));

// A caller alias is a preview decision as well: the chosen name still reaches the PPTX.
const aliased = await prepareNodeFonts({aliases: {'Brand Sans': 'Roboto'}});
const brand = unzipSync(new Uint8Array(await toPptx({name: 'Brand', design: {fontScheme: {id: 'brand', major: 'Brand Sans', minor: 'Brand Sans'}}, slides}, {...aliased.options, strictAssets: true})));
assert.deepEqual(themePair(brand), {major: 'Brand Sans', minor: 'Brand Sans'});
assert.ok(allTypefaces(brand).has('Brand Sans') && ![...allTypefaces(brand)].some(face => /^Roboto(?! Mono)/.test(face)), `alias target leaked: ${[...allTypefaces(brand)]}`);

console.log(JSON.stringify({test: 'export-chosen-fonts', passed: true, schemes: Object.fromEntries(reference)}));
