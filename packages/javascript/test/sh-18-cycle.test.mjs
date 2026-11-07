// SH-18: the cycle arrangement of a layout region. PowerPoint's design is its Basic Cycle (cycle2), measured through COM (SH-18 sweep,
// 2026-11-06): the layout is proportional to its frame at a fixed proportion, so OPF sets the frame to cycleAspect and reproduces the
// circles and arrows from the frame's width; OPF's own designs (a ring of rounded rectangles, or a loop of two rows) fill the region
// where PowerPoint's circles do not hold the entries. The text is one size for every node, never below the list's role size.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gallery } from '@openpresentation/gallery';
import {
  ARRANGEMENT_MAX, CYCLE_ARROW_ADJUST, LIST_NOMINAL_SIZE, SMART_ART_DOMAIN, SMART_ART_LAYOUTS, arrangementPaint, applyColorTransform, colorContrast, composeSlide, cycleAspect,
  cycleFrame, cycleLoop, cycleNodes, cycleRing, layoutTemplate, nodeWidthAt, rightArrowPoints, smartArtUnavailable,
} from '../dist/composition.js';

const near = (actual, expected, message, tolerance = .01) => assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} is not ${expected}`);
// COM, cycle2 inserted at (10, 10) in a frame 920 pt wide at cycleAspect: GroupItems left, top, width, height and rotation, in order
// (a circle, then its arrow), from C:/opf-work/shapes/sh-18/fit (a115.csv, a18.csv).
const MEASURED = {
  2: [[10.07764, 81.82504, 367.4609, 367.4609, 0], [348.9273, 29.88591, 229.1732, 124.018, 0], [562.4614, 81.82504, 367.4609, 367.4609, 0], [361.8994, 377.2071, 229.1732, 124.018, 180]],
  3: [[296.1523, 10.00465, 347.6953, 347.6953, 0], [552.996, 349.0587, 92.5222, 117.3472, 60], [557.2851, 462.2999, 347.6953, 347.6953, 0], [426.3574, 577.474, 92.5222, 117.3472, 180],
    [35.01953, 462.2999, 347.6953, 347.6953, 0], [291.8632, 353.5941, 92.5222, 117.3472, 300]],
  5: [[349.1601, 10.19, 241.6797, 241.6797, 0], [583.1599, 195.7376, 64.07268, 81.56685, 36], [642.4867, 223.3042, 241.6797, 241.6797, 0], [675.8301, 474.049, 64.07268, 81.56685, 108],
    [530.4459, 568.1302, 241.6797, 241.6797, 0], [439.777, 648.1866, 64.07268, 81.56685, 180], [167.8743, 568.1302, 241.6797, 241.6797, 0], [201.2178, 477.4983, 64.07268, 81.56685, 252],
    [55.83354, 223.3042, 241.6797, 241.6797, 0], [289.8333, 197.8694, 64.07268, 81.56685, 324]],
};

test("a cycle is PowerPoint's Basic Cycle: circles on a ring with an arrow after each, to 0.01 pt of the COM measurement", () => {
  for (const [count, shapes] of Object.entries(MEASURED)) {
    const n = Number(count), frame = { x: 10, y: 10, width: 920, height: 920 / cycleAspect(n) };
    const { nodes, arrows } = cycleNodes(frame, n);
    assert.equal(nodes.length, n); assert.equal(arrows.length, n);
    const drawn = nodes.flatMap((node, index) => [node, arrows[index]]);
    for (const [index, [left, top, width, height, rotation]] of shapes.entries()) {
      const shape = drawn[index], box = shape.box;
      near(box.x, left, `${n}: shape ${index} left`); near(box.y, top, `${n}: shape ${index} top`);
      near(box.width, width, `${n}: shape ${index} width`); near(box.height, height, `${n}: shape ${index} height`);
      near(shape.rotation ?? 0, rotation, `${n}: shape ${index} rotation`, .001);
    }
    for (const node of nodes) assert.equal(node.preset, 'ellipse');
    for (const arrow of arrows) assert.deepEqual([...arrow.adjust], [...CYCLE_ARROW_ADJUST]);
  }
  // The frame: one proportion per count (1.8 for two entries, 1.15 otherwise), the largest in the region, centered.
  assert.deepEqual(cycleFrame({ x: 0, y: 0, width: 1000, height: 400 }, 4), { x: 270, y: 0, width: 460, height: 400 });
  assert.deepEqual(cycleFrame({ x: 0, y: 0, width: 460, height: 1000 }, 2), { x: 0, y: 372.222, width: 460, height: 255.556 });
  // A circle's text rectangle is the inscribed square (PowerPoint's txXfrm: 1206722 of 1706562 EMU).
  const [first] = cycleNodes({ x: 0, y: 0, width: 920, height: 800 }, 4).nodes;
  near(first.textBox.width / first.box.width, Math.SQRT1_2, 'inscribed square', 1e-4);
  near(nodeWidthAt(first, first.box.y + first.box.height / 2), first.box.width, 'a circle is its full width across its middle');
  near(nodeWidthAt(first, first.box.y), 0, 'and a point at its top');
  // One entry: a circle and no arrow; eight: the most.
  assert.equal(cycleNodes({ x: 0, y: 0, width: 920, height: 800 }, 1).arrows.length, 0);
  assert.equal(cycleNodes({ x: 0, y: 0, width: 920, height: 800 }, 8).nodes.length, 8);
  assert.equal(SMART_ART_LAYOUTS.cycle, 'urn:microsoft.com/office/officeart/2005/8/layout/cycle2');
  assert.equal(ARRANGEMENT_MAX.cycle, 8);
});

test("an arrow is DrawingML's rightArrow, turned about its center; a right-to-left cycle runs counterclockwise", () => {
  const points = rightArrowPoints({ x: 0, y: 0, width: 100, height: 40 }, 0);
  // adj1 60000: the shaft is 60% of the height; adj2 50000: the head is half the smaller side long.
  assert.deepEqual(points, [[0, 8], [80, 8], [80, 0], [100, 20], [80, 40], [80, 32], [0, 32]]);
  const turned = rightArrowPoints({ x: 0, y: 0, width: 100, height: 40 }, 90);
  near(turned[3][0], 50, 'the tip turned down'); near(turned[3][1], 70, 'the tip turned down');
  const frame = { x: 0, y: 0, width: 920, height: 800 }, ltr = cycleNodes(frame, 3), rtl = cycleNodes(frame, 3, true);
  near(rtl.nodes[1].box.x, 920 - ltr.nodes[1].box.x - ltr.nodes[1].box.width, 'the second circle on the left');
  assert.equal(rtl.arrows[0].rotation, 120);
});

test("OPF's cycle fills the region: a ring of rounded rectangles, or a loop of two rows, with room for an arrow between neighbors", () => {
  const area = { x: 0, y: 0, width: 1200, height: 600 }, gap = 24;
  for (const count of [2, 3, 4, 5, 6, 7, 8]) {
    const { nodes, arrows } = cycleRing(area, count, gap);
    assert.equal(nodes.length, count); assert.equal(arrows.length, count);
    for (const node of nodes) {
      assert.equal(node.preset, 'roundRect');
      assert.ok(node.box.x >= -1e-6 && node.box.y >= -1e-6 && node.box.x + node.box.width <= 1200 + 1e-6 && node.box.y + node.box.height <= 600 + 1e-6, `${count}: inside the area`);
    }
    for (const [index, node] of nodes.entries()) for (const other of nodes.slice(index + 1)) {
      const apart = Math.max(Math.abs(node.box.x - other.box.x) - node.box.width, Math.abs(node.box.y - other.box.y) - node.box.height);
      assert.ok(apart >= gap - 1e-6, `${count}: nodes ${index} apart`);
    }
    assert.equal(new Set(arrows.map(arrow => `${arrow.box.width}x${arrow.box.height}`)).size, 1, `${count}: one arrow size`);
  }
  assert.equal(cycleLoop(area, 2, gap), undefined, 'a loop needs three entries');
  const loop = cycleLoop(area, 5, gap);
  assert.deepEqual(loop.nodes.map(node => [Math.round(node.box.x), Math.round(node.box.y)]), [[0, 0], [416, 0], [832, 0], [832, 324], [416, 324]], 'three across the top, two back along the bottom');
  assert.equal(loop.arrows[2].rotation, 90, 'the turn down at the end');
  const tall = cycleLoop({ x: 0, y: 0, width: 400, height: 900 }, 4, gap);
  assert.ok(tall.nodes[0].box.x > tall.nodes[3].box.x && tall.nodes[1].box.y > tall.nodes[0].box.y, 'down the right column, up the left');
});

test("the paint: circles in the primary, arrows in the primary lightened 40%", () => {
  const paint = arrangementPaint('#1F6FB2', '#FFFFFF', '#111111', colorContrast, applyColorTransform);
  assert.deepEqual(paint.arrow, { slot: 'accent1', hex: applyColorTransform('#1F6FB2', { lumMod: 60000, lumOff: 40000 }), lumMod: 60000, lumOff: 40000 });
});

const compose = slide => composeSlide(slide, { layout: gallery.layouts[slide.layout] });

test('the gallery cycle layout draws a lone list as a cycle, every entry centered on its node at one size', () => {
  assert.equal(layoutTemplate(gallery.layouts.cycle).regions.find(region => region.name === 'stages').arrangement, 'cycle');
  const items = ['Plan', 'Build', 'Ship', 'Learn'];
  const result = compose({ layout: 'cycle', title: 'The loop', items }), [arrangement] = result.arrangements, list = result.items.find(item => item.field === 'items');
  assert.equal(arrangement.kind, 'cycle');
  assert.equal(arrangement.design, 'smartart');
  near(arrangement.frame.width / arrangement.frame.height, cycleAspect(4), 'the frame at its proportion', 1e-3);
  assert.deepEqual(arrangement.nodes.map(node => node.path), items.map((_, index) => `slides.0.items.${index}`));
  assert.equal(arrangement.arrows.length, 4);
  assert.ok(arrangement.fontSize >= LIST_NOMINAL_SIZE - 1e-6, `size ${arrangement.fontSize}`);
  assert.equal(list.alignment, 'center');
  near(arrangement.textMargin, .1 * arrangement.fontSize, 'margin');
  for (const [index, column] of list.listColumns.entries()) {
    const node = arrangement.nodes[index], entry = column.text.listEntries[0];
    assert.equal(column.text.fontSize, arrangement.fontSize);
    assert.ok(entry.textBox.x >= node.textBox.x - 1e-6 && entry.textBox.x + entry.textBox.width <= node.textBox.x + node.textBox.width + 1e-6, `entry ${index} inside its circle's text rectangle`);
  }
  // Inside the domain: the export may write it as live SmartArt.
  assert.equal(smartArtUnavailable({ kind: 'cycle', count: 4, frame: arrangement.frame, rtl: false, nodes: arrangement.smartArt.lines.map((lines, index) => ({ lines, stable: arrangement.smartArt.stable[index] })) }), undefined);
});

test("long entries draw OPF's own cycle, never a plain list while a design holds them", () => {
  const result = compose({ layout: 'cycle', title: 'The loop', items: ['Clear purpose', 'Shared goals', 'Team habits', 'Weekly reviews', 'Open roadmap'] });
  const [arrangement] = result.arrangements;
  assert.equal(arrangement.design, 'opf');
  assert.match(arrangement.instead, /Basic Cycle/);
  assert.ok(arrangement.nodes.every(node => node.preset === 'roundRect'));
  assert.equal(arrangement.arrows.length, 5);
  assert.ok(arrangement.fontSize >= LIST_NOMINAL_SIZE - 1e-6);
  assert.equal(result.diagnostics.filter(item => item.code === 'arrangement-adapted').length, 0);
  // Nine steps are more than a cycle draws: a list, and the finding says why.
  const nine = compose({ layout: 'cycle', title: 'Too many', items: Array.from({ length: 9 }, (_, index) => `Step ${index + 1}`) });
  assert.equal(nine.arrangements, undefined);
  assert.match(nine.diagnostics.find(item => item.code === 'arrangement-adapted').message, /more than 8 steps/);
});

test('the SmartArt domain of a cycle', () => {
  assert.equal(SMART_ART_DOMAIN.count.cycle, 8);
  const frame = { x: 0, y: 0, width: 460, height: 400 }, nodes = Array.from({ length: 4 }, () => ({ lines: 1, stable: true }));
  assert.equal(smartArtUnavailable({ kind: 'cycle', count: 4, frame, rtl: false, nodes }), undefined);
  assert.match(smartArtUnavailable({ kind: 'cycle', count: 4, frame, rtl: true, nodes }), /right-to-left/);
  // Two lines an entry, however many in all (the sweep matched eight entries of one line and four of two).
  assert.equal(smartArtUnavailable({ kind: 'cycle', count: 4, frame, rtl: false, nodes: nodes.map(() => ({ lines: 2, stable: true })) }), undefined);
  assert.match(smartArtUnavailable({ kind: 'cycle', count: 4, frame, rtl: false, nodes: [{ lines: 3, stable: true }, ...nodes.slice(1)] }), /entry 1 wraps to 3 lines/);
  assert.match(smartArtUnavailable({ kind: 'cycle', count: 4, frame, rtl: false, script: 'cjk', nodes }), /Japanese/);
  assert.match(smartArtUnavailable({ kind: 'cycle', count: 4, frame: { x: 0, y: 0, width: 800, height: 400 }, rtl: false, nodes }), /proportions/);
});
