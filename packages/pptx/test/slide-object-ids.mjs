// RR-105: every drawing object on an exported slide has its own p:cNvPr id. The V2 scalar fragments (native-scalar-fragments.js) add
// shapes after export; their ids follow every id on the slide (charts, pictures, connectors and groups as well as shapes), not only the
// p:sp ids. Then the invariant over the technical examples, exported with per-script fonts (the export that writes scalar fragments).
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {strFromU8, unzipSync} from 'fflate';
import {examples} from '@openpresentation/opf/examples';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
import {fromPptx, toPptx} from '../dist/index.js';
import {drawingIdCollisions} from './helpers/drawing-id-collisions.mjs';

const png = new Uint8Array(await readFile(new URL('./fixtures/images/wide.png', import.meta.url)));
const imageResolver = async () => png;
const slideParts = zip => Object.keys(zip).filter(path => /^ppt\/slides\/slide\d+\.xml$/.test(path));
const objects = xml => [...xml.matchAll(/<p:cNvPr\b[^>]*\bid="(\d+)"[^>]*\bname="([^"]*)"/g)].map(([, id, name]) => ({id: Number(id), name}));

async function exported(deck, options = {}) {
  const fonts = await loadFonts({pack: 'office', substitutionPolicy: 'visual', scripts: 'auto', presentation: deck});
  try { return await toPptx(deck, {fonts, imageResolver, ...options}); } finally { fonts.dispose?.(); }
}

// 1. Arabic-Indic digits between Latin words in measured body text become scalar fragments; a chart or a picture after the text keeps its
// own id (before the fix the first fragment took the id of the object after the text).
const title = 'أرقام عربية وفارسية';
for (const [label, block] of [
  ['chart', {type: 'chart', chart: {type: 'bar', data: {columns: ['A', 'B'], rows: [['x', 1], ['y', 2]]}}}],
  ['picture', {type: 'image', image: {src: 'https://example.invalid/wide.png', alt: 'A wide picture'}}],
]) {
  const deck = {language: 'ar-SA', slides: [{title, blocks: [{type: 'text', text: 'Item ١ number'}, block]}]};
  const bytes = await exported(deck);
  const zip = unzipSync(new Uint8Array(bytes)), xml = strFromU8(zip['ppt/slides/slide1.xml']), all = objects(xml);
  const fragments = all.filter(object => object.name.startsWith('OPF scalar fragment '));
  assert.ok(fragments.length > 0, `${label}: the Arabic-Indic number is written as scalar fragments`);
  const other = label === 'chart' ? /<p:graphicFrame>[\s\S]*?<\/p:graphicFrame>/.exec(xml)?.[0] : /<p:pic>[\s\S]*?<\/p:pic>/.exec(xml)?.[0];
  assert.ok(other, `${label}: the ${label} is on the slide`);
  const otherId = Number(/<p:cNvPr\b[^>]*\bid="(\d+)"/.exec(other)[1]);
  assert.ok(fragments.every(fragment => fragment.id !== otherId), `${label}: no fragment takes the ${label}'s id ${otherId}`);
  assert.deepEqual(drawingIdCollisions(xml), [], `${label}: every object id on the slide is unique (${all.map(object => `${object.id}:${object.name}`).join(' | ')})`);
  assert.equal(new Set(all.map(object => object.id)).size, all.length, `${label}: no two p:cNvPr share an id`);
  // The fragments still import as the authored text, with the chart or picture beside it.
  const back = await fromPptx(bytes);
  assert.equal(back.slides[0].blocks.length, 2, `${label}: the text and the ${label} import`);
  assert.equal(back.slides[0].blocks[0].text, 'Item ١ number', `${label}: the fragmented text imports whole`);
}

// 2. The invariant over the technical examples, measured and native body text.
let decks = 0, slides = 0;
const collisions = [];
for (const {file, deck} of examples.filter(example => example.file.startsWith('examples/technical/'))) {
  for (const bodyText of ['measured', 'native']) {
    const zip = unzipSync(new Uint8Array(await exported(deck, {bodyText})));
    for (const part of slideParts(zip)) {
      slides++;
      const ids = drawingIdCollisions(strFromU8(zip[part]));
      if (ids.length) collisions.push({file, bodyText, part, ids});
    }
  }
  decks++;
}
assert.ok(decks >= 40, `the technical examples are read (${decks})`);
assert.deepEqual(collisions, [], 'every slide of every technical example has unique p:cNvPr ids');
console.log(`Slide object ids: scalar fragments after a chart and a picture, and ${decks} technical examples (${slides} slides, measured and native) have unique ids.`);
