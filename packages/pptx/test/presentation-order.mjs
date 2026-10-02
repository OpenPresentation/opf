import assert from 'node:assert/strict';
import {strFromU8, unzipSync} from 'fflate';
import {XMLParser} from 'fast-xml-parser';
import {toPptx} from '../src/index.js';

// FF-05 (font-fidelity-everywhere). `p:presentation` is a CT_Presentation sequence: sldMasterIdLst, notesMasterIdLst,
// handoutMasterIdLst, sldIdLst, sldSz, notesSz, smartTags, embeddedFontLst, custShowLst, photoAlbum, custDataLst,
// kinsoku, defaultTextStyle, modifyVerifier, extLst. PptxGenJS 4.0.1 writes notesMasterIdLst after sldIdLst; PowerPoint then
// treats the deck as having no notes master and lists a default-theme font (Aptos) in Presentation.Fonts although no part
// names it. The exporter writes the children in schema order.
const ORDER = ['p:sldMasterIdLst', 'p:notesMasterIdLst', 'p:handoutMasterIdLst', 'p:sldIdLst', 'p:sldSz', 'p:notesSz', 'p:smartTags',
  'p:embeddedFontLst', 'p:custShowLst', 'p:photoAlbum', 'p:custDataLst', 'p:kinsoku', 'p:defaultTextStyle', 'p:modifyVerifier', 'p:extLst'];

const childOrder = xml => {
  const root = new XMLParser({ignoreAttributes: false, preserveOrder: true}).parse(xml).find(node => node['p:presentation'])['p:presentation'];
  return root.map(node => Object.keys(node).find(key => key !== ':@'));
};
const slide = {id: 'one', title: 'Notes', text: 'Body', notes: 'Speaker notes'};
const decks = [
  {name: 'Plain', slides: [slide]},
  {name: 'Georgia', language: 'english', design: {fontScheme: 'georgia'}, slides: [slide, {id: 'two', title: 'Two', items: ['A', 'B']}]},
  {name: 'Sections', slides: [{...slide, id: 'a', section: 'First'}, {...slide, id: 'b', section: 'Second'}]},
];
for (const deck of decks) {
  const entries = unzipSync(await toPptx(structuredClone(deck), {seed: 1, date: '2026-10-02', timestamp: '2026-10-02T00:00:00Z', zipDate: '2026-10-02T00:00:00Z'}));
  const order = childOrder(strFromU8(entries['ppt/presentation.xml']));
  const positions = order.map(name => ORDER.indexOf(name));
  assert.ok(!positions.includes(-1), `${deck.name}: unknown p:presentation child in ${order}`);
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b), `${deck.name}: p:presentation children are in schema order: ${order}`);
  assert.ok(order.indexOf('p:notesMasterIdLst') >= 0 && order.indexOf('p:notesMasterIdLst') < order.indexOf('p:sldIdLst'), `${deck.name}: the notes master list precedes the slide list`);
}
console.log(JSON.stringify({test: 'presentation-order', passed: true, decks: decks.length}));
