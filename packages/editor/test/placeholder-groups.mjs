// FA-26: layout records with nested placeholder groups in the editor. The canvas composes the same leaf boxes as core (and so
// as the preview and the PPTX export, which core's scripts/test-placeholder-groups-ecosystem.mjs checks within 0.5 pt), the
// layout UI names nested slots (`title, column (text, text), chart`) and compares layouts by their leaf regions, a layout
// switch adds the empty slots the record's leaves declare, and Arrange draws every slot of the record on the canvas.
// test/fixtures/placeholder-groups.opf.json is core's docs/fixtures/placeholder-groups.opf.json.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveSlideContext } from '@openpresentation/opf';
import { composeSlide } from '@openpresentation/opf/composition';
import { resolvePresentation } from '@openpresentation/opf-render';
import { createEditorSession } from '../dist/index.js';
import { layoutSlotSummary, layoutSlotTypes } from '../dist/layout-placeholders.js';
import { createLayoutHandles } from '../dist/layout-handles.js';
import { prepareDimensionSwitch } from '../dist/switches.js';

const deck = JSON.parse(readFileSync(new URL('./fixtures/placeholder-groups.opf.json', import.meta.url), 'utf8'));
const layouts = deck.catalogs.custom.layouts;

// The same leaf boxes as core, through the session and the renderer the canvas draws with.
const session = createEditorSession(deck, { rejectInvalid: true });
const resolved = resolvePresentation(session.presentation);
for (const [index, slide] of deck.slides.entries()) {
  const core = composeSlide(slide, resolveSlideContext(deck, index).options);
  assert.deepEqual(resolved.slides[index].geometry.items.map((item) => [item.path, item.box]), core.items.map((item) => [item.path, item.box]), slide.id);
  assert.deepEqual(resolved.slides[index].geometry.slots, core.slots, `${slide.id}: slots`);
}

// The layout UI: slot kinds are the leaves, in reading order; the summary shows how they nest.
assert.deepEqual(layoutSlotTypes(layouts['stacked-text-chart-right']), ['title', 'text', 'text', 'chart']);
assert.equal(layoutSlotSummary(layouts['stacked-text-chart-right']), 'title, column (text, text), chart');
assert.equal(layoutSlotSummary(layouts['three-level']), 'title, row (text, column (text, row (metric, metric)), text), row (text, text)');
assert.equal(layoutSlotSummary({ placeholders: [{ type: 'title' }, { type: 'text' }] }), 'title, text');
assert.equal(layoutSlotTypes({}), undefined);

// A layout switch adds the empty slots the record's leaves declare, as for a flat record.
const plain = { ...deck, slides: [{ id: 'plain', title: 'Only a title' }] };
const switched = prepareDimensionSwitch(plain, 'layouts', 'stacked-text-chart-right', { slideIndex: 0 });
const slide = switched.presentation.slides[0];
assert.equal(slide.layout, 'stacked-text-chart-right');
assert.deepEqual(slide.blocks.map((block) => Object.keys(block).find((key) => ['text', 'chart'].includes(key))), ['text', 'text', 'chart']);

// Arrange draws every slot of the record: groups, filled and empty regions, at their cells.
function fakeDocument() {
  const make = (tag) => {
    const node = { tag, style: {}, dataset: {}, attributes: {}, children: [], textContent: '',
      setAttribute(name, value) { this.attributes[name] = String(value); }, append(...nodes) { this.children.push(...nodes); },
      replaceChildren(...nodes) { this.children = nodes; }, addEventListener() {}, removeEventListener() {}, hasPointerCapture() { return false }, querySelector() { return null } };
    return node;
  };
  const doc = { createElement: make, addEventListener() {}, removeEventListener() {}, defaultView: { requestAnimationFrame() { return 0 }, cancelAnimationFrame() {} } };
  const root = make('div'); root.ownerDocument = doc;
  return root;
}
const root = fakeDocument();
const fewer = deck.slides.findIndex((entry) => entry.id === 'nested-fewer');
const handles = createLayoutHandles(root, { editor: { subscribe: () => () => {}, presentation: deck, get: () => undefined }, enabled: true, render() {}, onError(error) { throw error; }, isTextEditing: () => false, beforeEdit: () => true });
const layer = root.children[0];
const geometry = composeSlide({ ...deck.slides[fewer], blocks: [{ type: 'text', text: 'One' }] }, { layout: { ...layouts['stacked-text-chart-right'], composition: {} } });
handles.update(deck, geometry);
const slots = layer.children.filter((node) => node.dataset.layoutSlot);
assert.deepEqual(slots.map((node) => [node.dataset.layoutSlot, node.dataset.layoutSlotType]), geometry.slots.map((slot) => [slot.path, slot.type]));
assert.ok(slots.length >= 3, 'the group and its regions');
const empty = slots.filter((node) => node.children.some((child) => /^Empty /.test(child.textContent)));
assert.deepEqual(empty.map((node) => node.dataset.layoutSlot), geometry.slots.filter((slot) => slot.type !== 'group' && !slot.content).map((slot) => slot.path));
assert.ok(empty.length > 0, 'an empty region is labelled');
handles.setEnabled(false);
handles.update(deck, geometry); // the canvas re-renders after a mode change
assert.equal(layer.children.filter((node) => node.dataset?.layoutSlot).length, 0, 'slots show only while arranging');

console.log(`placeholder groups: ${deck.slides.length} slides compose the same leaf boxes in the editor as in core; the layout UI and Arrange show nested slots`);
