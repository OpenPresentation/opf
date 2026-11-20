// Builds smartart-seeds.pptx, the seed deck of make-powerpoint-smartart.ps1 (SH-08): one slide per PowerPoint layout the fixture needs,
// each a SmartArt whose data model names that built-in layout by its id and carries no layout part (r:lo="", as OPF's export writes a
// built-in layout), so PowerPoint resolves the layout itself. The COM script reads each slide's SmartArt.Layout and adds a fresh graphic
// of it (PowerPoint's own style, colors and drawing), because this PowerPoint build gives scripts no Application.SmartArtLayouts list.
//   node test/fixtures/make-smartart-seeds.mjs [out.pptx]   (after `pnpm run build` in packages/pptx)
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';
import {toPptx} from '../helpers/default-catalog.mjs';

const L = 'urn:microsoft.com/office/officeart/2005/8/layout/';
// The fixture's slides, in make-powerpoint-smartart.ps1's order: [layout id, category]. Ids the fixture is not sure of are recorded by
// the COM script as PowerPoint names them.
export const SEEDS = [
  [`${L}pyramid1`, 'pyramid'], [`${L}pyramid3`, 'pyramid'], [`${L}matrix3`, 'matrix'], [`${L}cycle2`, 'cycle'], [`${L}cycle1`, 'cycle'],
  [`${L}chevron1`, 'process'], [`${L}process1`, 'process'], [`${L}process2`, 'process'], [`${L}process3`, 'process'], [`${L}default`, 'list'],
  [`${L}vList2`, 'list'], [`${L}venn1`, 'relationship'], [`${L}radial1`, 'cycle'], [`${L}orgChart1`, 'hierarchy'], [`${L}hierarchy1`, 'hierarchy'],
  [`${L}hierarchy2`, 'hierarchy'], ['urn:microsoft.com/office/officeart/2008/layout/NameandTitleOrganizationalChart', 'hierarchy'],
];

// A one-entry pyramid per slide is live SmartArt on pyramid1 (SH-09's domain); each slide's data model is then pointed at its layout.
const deck = {slides: SEEDS.map((_, index) => ({layout: 'pyramid', title: `Seed ${index + 1}`, items: ['Seed']}))};
const entries = unzipSync(new Uint8Array(await toPptx(deck, {seed: 808, timestamp: '2026-11-07T00:00:00Z', zipDate: '2026-11-07T00:00:00Z', provenance: false})));
SEEDS.forEach(([id, category], index) => {
  const rels = strFromU8(entries[`ppt/slides/_rels/slide${index + 1}.xml.rels`]);
  const part = /Target="\.\.\/diagrams\/(data\d+\.xml)"/.exec(rels)?.[1];
  if (!part) throw new Error(`slide ${index + 1} has no live SmartArt`);
  const path = `ppt/diagrams/${part}`, xml = strFromU8(entries[path]);
  const next = xml.replace(/loTypeId="[^"]*" loCatId="[^"]*"/, `loTypeId="${id}" loCatId="${category}"`);
  if (!next.includes(`loTypeId="${id}"`)) throw new Error(`slide ${index + 1}: no loTypeId`);
  entries[path] = strToU8(next);
});
const out = process.argv[2] ?? fileURLToPath(new URL('./smartart-seeds.pptx', import.meta.url));
writeFileSync(out, zipSync(entries));
console.log(out);
