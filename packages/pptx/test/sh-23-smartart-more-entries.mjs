// SH-23: OPF's own layout definitions carry a table for 1 to 12 entries (OPF_LAYOUT_TABLES), so an entry a PowerPoint user adds past OPF's
// 8 keeps OPF's design: OPF's interpreter draws 9 to 12 entries from the definition, every node inside the frame and none hidden; 13 or
// more take the 12-entry table (the ones past it are not drawn, as a ninth was before). The written layout part has the 12 branches.
import assert from 'node:assert/strict';
import {strFromU8, unzipSync} from 'fflate';
import {composeSlide, evaluateLayoutDefinition, layoutArrangement} from '@openpresentation/opf/composition';
import {defaultCatalog, toPptx} from './helpers/default-catalog.mjs';
import {OPF_LAYOUT_TABLES, opfLayoutDefinition} from '../src/smart-art-layouts.js';

assert.equal(OPF_LAYOUT_TABLES, 12);
const short = ['Vision', 'Plan', 'Build', 'Ship', 'Learn', 'Grow', 'Scale', 'Serve'];
// OPF's designs inside SMART_ART_OPF_DOMAIN: the stepped pyramid, a card grid, snaking flow and chevron rows, the vertical flow's columns.
const slides = [['pyramid', 8], ['matrix', 3], ['flow', 7], ['chevrons', 7], ['vertical-flow', 5]].map(([layout, count]) => ({layout, title: 'Steps', items: short.slice(0, count)}));
for (const slide of slides) {
  const composed = composeSlide(slide, {layout: defaultCatalog.layouts[slide.layout]});
  const arrangement = composed.arrangements?.[0], item = composed.items.find(entry => entry.path === arrangement?.path);
  assert.ok(['opf', 'cards'].includes(arrangement?.design), `${slide.layout}: OPF's design (a card grid for a matrix)`);
  const {definition, reason} = opfLayoutDefinition(arrangement, item);
  assert.ok(definition, `${slide.layout}: ${reason}`);
  const {frame} = arrangement, inside = box => box.x >= frame.x - .01 && box.y >= frame.y - .01 && box.x + box.width <= frame.x + frame.width + .01 && box.y + box.height <= frame.y + frame.height + .01;
  for (const count of [9, 10, 11, 12]) {
    const drawn = layoutArrangement(evaluateLayoutDefinition(definition, frame, count));
    assert.equal(drawn.nodes.length, count, `${slide.layout}: ${count} entries are drawn`);
    assert.ok(drawn.nodes.every(node => inside(node.box)), `${slide.layout}: ${count} entries inside the frame`);
  }
  assert.equal(layoutArrangement(evaluateLayoutDefinition(definition, frame, 13)).nodes.length, 12, `${slide.layout}: 13 entries take the 12-entry table`);
}
for (const slide of slides) {
  const entries = unzipSync(new Uint8Array(await toPptx({slides: [slide]}, {seed: 2323, timestamp: '2026-11-07T00:00:00Z', zipDate: '2026-11-07T00:00:00Z'})));
  const part = entries['ppt/diagrams/layout1.xml'];
  assert.ok(part, `${slide.layout}: live on OPF's layout`);
  assert.deepEqual([...strFromU8(part).matchAll(/<dgm:if name="[^"]+" func="cnt" axis="ch" ptType="node" op="equ" val="(\d+)">/g)].map(match => Number(match[1])), Array.from({length: 12}, (_, index) => index + 1), slide.layout);
}
