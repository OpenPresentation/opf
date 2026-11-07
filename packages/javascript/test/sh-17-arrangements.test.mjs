// SH-17: the chevrons, flow and vertical-flow arrangements of a layout region. The geometry is PowerPoint's Basic Chevron Process,
// Basic Process and Vertical Process, as the SH-17 sweep measured them through COM (fixtures/sh-17-powerpoint-geometry.json: 1 to 8 nodes
// in six frames each); the text is one size for all nodes, never below the list's role size; OPF draws its own row or column where
// PowerPoint's design does not hold the entries; and the safe domain decides whether the PPTX export writes live SmartArt.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { gallery } from '@openpresentation/gallery';
import {
  ARRANGEMENT_MAX, ARRANGEMENTS, LIST_NOMINAL_SIZE, SMART_ART_DOMAIN, SMART_ART_LAYOUTS, SMART_ART_SCALES, arrangementPaint, applyColorTransform, chevronNodes,
  colorContrast, composeSlide, flowNodes, layoutTemplate, linearDesign, linearMargins, rightArrowPoints, smartArtUnavailable, verticalFlowNodes,
} from '../dist/composition.js';

const near = (actual, expected, message, tolerance = .01) => assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} is not ${expected}`);
const measured = JSON.parse(readFileSync(new URL('./fixtures/sh-17-powerpoint-geometry.json', import.meta.url), 'utf8'));
const rect = box => [box.x, box.y, box.width, box.height];

test('every measured frame: core lays the nodes and arrows out where PowerPoint does, within 0.01 pt', () => {
  const geometry = { chevrons: chevronNodes, flow: flowNodes, 'vertical-flow': verticalFlowNodes };
  for (const [kind, frames] of Object.entries(measured.layouts)) {
    assert.ok(frames.length >= 40, kind);
    for (const { width, height, count, shapes } of frames) {
      const { nodes, arrows } = geometry[kind]({ x: 0, y: 0, width, height }, count);
      // PowerPoint lists a flow's shapes node, arrow, node, ...
      const ours = nodes.flatMap((node, index) => [rect(node.box), ...(arrows[index] ? [rect(arrows[index].box)] : [])]);
      assert.equal(ours.length, shapes.length, `${kind} ${width} x ${height}, ${count}`);
      for (const [index, box] of ours.entries()) for (const [at, value] of box.entries()) near(value, shapes[index][at], `${kind} ${width} x ${height}, ${count}: shape ${index + 1} [${at}]`);
    }
  }
});

test('PowerPoint\'s scale is its binary search\'s last fitting step, not the closed form', () => {
  // Two chevrons: 538/1024 of the frame, where 1 / (0.9 n + 0.1) would be 538.95/1024 (0.74 pt wider at 800 pt).
  assert.equal(SMART_ART_SCALES.chevrons[1], 538 / 1024);
  assert.ok(Math.abs(800 / 1.9 - 800 * SMART_ART_SCALES.chevrons[1]) > .7);
  // Seven chevrons (6.4 widths) and six boxes (8 widths) are exact binary fractions, so the search lands on the closed form.
  assert.equal(SMART_ART_SCALES.chevrons[6], 1 / 6.4);
  assert.equal(SMART_ART_SCALES.flow[5], 1 / 8);
  for (const scales of Object.values(SMART_ART_SCALES)) for (const value of scales) assert.equal(value * 8192, Math.round(value * 8192), 'a multiple of 1/8192');
  // One node squeezed by the frame's other side is 1023/1024 of it (COM: 799.22 of an 800 x 300 frame), its height the frame's.
  assert.deepEqual(rect(chevronNodes({ x: 0, y: 0, width: 800, height: 300 }, 1).nodes[0].box), [.391, 0, 799.219, 300]);
  assert.deepEqual(rect(flowNodes({ x: 0, y: 0, width: 800, height: 120 }, 1).nodes[0].box), [.391, 0, 799.219, 120]);
  assert.deepEqual(rect(verticalFlowNodes({ x: 0, y: 0, width: 600, height: 420 }, 1).nodes[0].box), [0, .205, 600, 419.59]);
});

test('the shapes: chevrons at their default point, boxes rounded at 10000, arrows the rightArrow PowerPoint draws', () => {
  const frame = { x: 0, y: 0, width: 800, height: 420 };
  const [chevron] = chevronNodes(frame, 4).nodes;
  assert.deepEqual([chevron.preset, chevron.adjust], ['chevron', 50000]);
  // The text rectangle is the chevron's own: between the notch and the point (PowerPoint's txXfrm), at the chevron's height.
  near(chevron.textBox.x - chevron.box.x, chevron.box.height / 2, 'notch');
  near(chevron.textBox.width, chevron.box.width - chevron.box.height, 'text width');
  assert.deepEqual(linearMargins('chevrons', false), [.315, .105, .105, .105]);
  assert.deepEqual(linearMargins('chevrons', true), [.105, .105, .315, .105]);
  const flow = flowNodes(frame, 4), [box] = flow.nodes;
  assert.deepEqual([box.preset, box.adjust], ['roundRect', 10000]);
  near(box.radius, .1 * box.box.height, 'corner');
  near(box.textBox.x - box.box.x, .29289 * box.radius, 'roundRect text inset');
  assert.equal(flow.arrows.length, 3);
  assert.deepEqual([flow.arrows[0].rotation, ...flow.arrows[0].adjust], [0, 60000, 50000]);
  const vertical = verticalFlowNodes(frame, 4);
  assert.equal(vertical.arrows[0].rotation, 90);
  // The arrow's outline: a stem 0.6 of its height, a head as long as half its smaller side, then turned about its center.
  const points = rightArrowPoints({ x: 0, y: 0, width: 40, height: 20 }, 0, [60000, 50000]);
  assert.deepEqual(points, [[0, 4], [30, 4], [30, 0], [40, 10], [30, 20], [30, 16], [0, 16]]);
  const down = rightArrowPoints({ x: 0, y: 0, width: 40, height: 20 }, 90, [60000, 50000]);
  assert.deepEqual(down[3], [20, 30], 'the tip points down');
});

test('OPF\'s own designs: PowerPoint\'s proportions, lines that span the region, rows that snake with a connector', () => {
  const area = { x: 0, y: 0, width: 1200, height: 500 }, span = node => [node.box.x, node.box.x + node.box.width];
  const row = linearDesign('chevrons', area, 4, 24);
  near(span(row.nodes[0])[0], 0, 'start'); near(span(row.nodes[3])[1], 1200, 'end');
  const mirrored = linearDesign('chevrons', area, 4, 24, true);
  assert.equal(mirrored.nodes[0].flip, true);
  near(span(mirrored.nodes[0])[1], 1200, 'the first chevron at the right in a right-to-left deck');
  // A flow's arrows are PowerPoint's: 0.212 x 0.248 of a box's width, in a room of 0.4 of it.
  const flow = linearDesign('flow', area, 3, 24), w = flow.nodes[0].box.width;
  near(flow.nodes[1].box.x - (flow.nodes[0].box.x + w), .4 * w, 'room');
  near(flow.arrows[0].box.width, .212 * w, 'arrow length'); near(flow.arrows[0].box.height, .248 * w, 'arrow thickness');
  near(span(flow.nodes[2])[1], 1200, 'the boxes fill the width');
  // Each node takes the height its text needs, PowerPoint's proportion at least, centered.
  const short = linearDesign('flow', area, 3, 24, false, 1, 40);
  near(short.nodes[0].box.height, .6 * w, 'at least 0.6 of a width tall');
  near(short.nodes[0].box.y + short.nodes[0].box.height / 2, 250, 'centered');
  // Five boxes in two rows: 3 and 2, the second row widened to span the region, running back, joined by a down arrow at the right.
  const two = linearDesign('flow', area, 5, 24, false, 2);
  near(span(two.nodes[3])[1], 1200, 'the second row starts at the right'); near(span(two.nodes[4])[0], 0, 'and spans the region');
  assert.ok(two.nodes[3].box.width > two.nodes[0].box.width, 'a row of fewer boxes widens them');
  assert.deepEqual(two.arrows.map(arrow => [arrow.index, arrow.rotation]), [[0, 0], [1, 0], [2, 90], [3, 180]]);
  assert.ok(two.arrows[2].box.x > two.nodes[2].box.x, 'the connector under the end of the first row');
  // Chevrons wrap with each row full width, starting again at the left (a row breaks after a point).
  const chevrons = linearDesign('chevrons', area, 5, 24, false, 2);
  near(span(chevrons.nodes[3])[0], 0, 'the second row starts at the left'); near(span(chevrons.nodes[4])[1], 1200, 'and spans the region');
  // A vertical flow's columns snake too: the second runs bottom to top, joined by a right arrow at the bottom.
  const column = linearDesign('vertical-flow', { x: 0, y: 0, width: 600, height: 600 }, 5, 24, false, 2);
  assert.deepEqual(column.arrows.map(arrow => arrow.rotation), [90, 90, 0, 270]);
  assert.ok(column.nodes[3].box.y > column.nodes[4].box.y, 'the second column runs up');
  near(column.nodes[3].box.y + column.nodes[3].box.height, column.nodes[2].box.y + column.nodes[2].box.height, 'both columns end at the same bottom');
});

const compose = (slide, layout = slide.layout) => composeSlide(slide, { layout: gallery.layouts[layout] });
const adapted = (result) => result.diagnostics.filter(entry => entry.code === 'arrangement-adapted').map(entry => entry.message);

test('the gallery has a chevrons, a flow and a vertical-flow layout, each a lone list in an arrangement region', () => {
  for (const kind of ['chevrons', 'flow', 'vertical-flow']) {
    const region = layoutTemplate(gallery.layouts[kind]).regions.find(entry => entry.arrangement);
    assert.deepEqual([region.name, region.arrangement], ['stages', kind]);
  }
  assert.deepEqual(ARRANGEMENTS, ['pyramid', 'matrix', 'chevrons', 'flow', 'vertical-flow']);
  assert.equal(SMART_ART_LAYOUTS.chevrons, 'urn:microsoft.com/office/officeart/2005/8/layout/chevron1');
  assert.equal(SMART_ART_LAYOUTS.flow, 'urn:microsoft.com/office/officeart/2005/8/layout/process1');
  assert.equal(SMART_ART_LAYOUTS['vertical-flow'], 'urn:microsoft.com/office/officeart/2005/8/layout/process2');
  assert.equal(ARRANGEMENT_MAX.chevrons, 8);
});

test('a lone list draws as PowerPoint\'s design, centered on its nodes at one size, never below the list\'s role size', () => {
  for (const kind of ['chevrons', 'flow', 'vertical-flow']) {
    const items = ['Plan', 'Build', 'Test', 'Ship'];
    const result = compose({ layout: kind, title: 'How we work', items });
    const [arrangement] = result.arrangements, list = result.items.find(item => item.field === 'items');
    assert.deepEqual([arrangement.kind, arrangement.design, arrangement.align, arrangement.text], [kind, 'smartart', 'center', 'node'], kind);
    assert.deepEqual(arrangement.nodes.map(node => node.path), items.map((_, index) => `slides.0.items.${index}`));
    assert.equal(arrangement.arrows?.length ?? 0, kind === 'chevrons' ? 0 : 3);
    assert.ok(arrangement.fontSize >= LIST_NOMINAL_SIZE - 1e-6, `${kind} size ${arrangement.fontSize}`);
    assert.ok(list.listColumns.every(column => column.text.fontSize === arrangement.fontSize));
    assert.deepEqual(adapted(result), []);
    // The text block is centered in the node's text rectangle less its margins (a chevron's is larger at its start).
    const [left, top, right, bottom] = arrangement.margins;
    for (const [index, column] of list.listColumns.entries()) {
      const node = arrangement.nodes[index];
      near(column.box.x, node.textBox.x + left, `${kind} entry ${index} start`, .05);
      near(column.box.y + column.box.height / 2, node.textBox.y + top + (node.textBox.height - top - bottom) / 2, `${kind} entry ${index} centered`, .05);
      assert.ok(column.box.x + column.box.width <= node.textBox.x + node.textBox.width - right + 1e-6);
    }
    if (kind === 'chevrons') near(left, .315 * arrangement.fontSize, 'start margin');
  }
});

test('long entries draw OPF\'s design, a right-to-left deck mirrors it, and what no design holds stays a list', () => {
  const long = ['Research the whole market first', 'Design the pilot with two teams', 'Run it'];
  const chevrons = compose({ layout: 'chevrons', title: 'Long', items: long });
  assert.equal(chevrons.arrangements[0].design, 'opf');
  assert.match(chevrons.arrangements[0].instead, /Basic Chevron Process|wraps/);
  assert.ok(chevrons.arrangements[0].fontSize >= LIST_NOMINAL_SIZE - 1e-6);
  const arabic = composeSlide({ layout: 'flow', title: 'العملية', items: ['الرؤية', 'الأهداف', 'البرامج'] }, { layout: gallery.layouts.flow, direction: 'rtl' });
  const [flow] = arabic.arrangements;
  assert.ok(flow.nodes[0].box.x > flow.nodes[2].box.x, 'the first box at the right');
  assert.ok(flow.arrows.every(arrow => arrow.rotation === 180), 'arrows point left');
  assert.match(adapted(compose({ layout: 'flow', title: 'T', items: ['A', 'B'], numbering: 'arabic' }))[0], /a numbered list/);
  const nine = compose({ layout: 'chevrons', title: 'T', items: ['1', '2', '3', '4', '5', '6', '7', '8', '9'] });
  assert.equal(nine.arrangements, undefined);
  assert.match(adapted(nine)[0], /A row of chevrons draws a list .* more than 8 chevrons/);
});

test('the arrows\' paint: the primary lightened 40%, a color SmartArt\'s colors part names exactly', () => {
  const paint = arrangementPaint('#1F6FB2', '#FFFFFF', '#111111', colorContrast, applyColorTransform);
  assert.deepEqual([paint.arrow.slot, paint.arrow.lumMod, paint.arrow.lumOff], ['accent1', 60000, 40000]);
  assert.equal(paint.arrow.hex, applyColorTransform('#1F6FB2', { lumMod: 60000, lumOff: 40000 }));
});

test('the SmartArt domain of the linear arrangements', () => {
  const candidate = (kind, extra = {}) => ({ kind, count: 4, frame: kind === 'vertical-flow' ? { x: 0, y: 0, width: 684, height: 605 } : { x: 0, y: 0, width: 1165, height: 515 }, rtl: false, nodes: Array.from({ length: 4 }, () => ({ lines: 1, stable: true })), ...extra });
  for (const kind of ['chevrons', 'flow']) assert.equal(smartArtUnavailable(candidate(kind)), undefined, kind);
  assert.equal(smartArtUnavailable(candidate('vertical-flow', { frame: { x: 0, y: 0, width: 684, height: 605 } })), undefined);
  for (const kind of ['chevrons', 'flow', 'vertical-flow']) {
    assert.match(smartArtUnavailable(candidate(kind, { count: SMART_ART_DOMAIN.count[kind] + 1 })), /outside the compared/);
    assert.match(smartArtUnavailable(candidate(kind, { rtl: true })), /right-to-left/);
    assert.match(smartArtUnavailable(candidate(kind, { script: 'cjk' })), /Japanese/);
    // A node nearly full of text, and a frame dense with large text, are what the sweep found PowerPoint lays out or sets otherwise.
    assert.match(smartArtUnavailable(candidate(kind, { fill: .97 })), /fills 97% of its node's height/);
    assert.match(smartArtUnavailable(candidate(kind, { ink: .09 })), /covers 9% of the frame/);
  }
  // The domain the sweep passed (docs/smartart.md).
  assert.deepEqual([SMART_ART_DOMAIN.count.chevrons, SMART_ART_DOMAIN.count.flow, SMART_ART_DOMAIN.count['vertical-flow']], [6, 6, 4]);
  assert.match(smartArtUnavailable(candidate('flow', { frame: { x: 0, y: 0, width: 1200, height: 400 } })), /proportions \(3\.00 : 1\)/);
  // Pyramids and matrices keep SH-09's domain: no fill or ink limit.
  assert.equal(smartArtUnavailable({ kind: 'pyramid', count: 4, frame: { x: 0, y: 0, width: 1000, height: 500 }, rtl: false, nodes: Array.from({ length: 4 }, () => ({ lines: 1, stable: true })), fill: 1, ink: .5 }), undefined);
});
