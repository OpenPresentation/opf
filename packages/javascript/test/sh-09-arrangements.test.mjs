// SH-09: the pyramid and matrix arrangements of a layout region. The geometry is PowerPoint's Basic Pyramid and Basic Matrix, as the
// SH-09 spike measured them through COM (a frame of 800 x 420 pt at 80, 60); the text is one size for all nodes, never below the list's
// role size, centered in each node's text rectangle; and the safe domain decides whether the PPTX export writes live SmartArt.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gallery } from '@openpresentation/gallery';
import { layoutTemplate } from '../dist/composition.js';
import {
  ARRANGEMENT_MAX, ARRANGEMENT_TEXT_MARGIN, LIST_NOMINAL_SIZE, SMART_ART_DOMAIN, SMART_ART_LAYOUTS, arrangementPaint, applyColorTransform, colorContrast, composeSlide, matrixNodes, matrixSquare,
  nodeWidthAt, pyramidFrame, pyramidNodes, smartArtUnavailable,
} from '../dist/composition.js';

const near = (actual, expected, message, tolerance = .01) => assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} is not ${expected}`);
const frame = { x: 80, y: 60, width: 800, height: 420 };

test('a pyramid is PowerPoint\'s Basic Pyramid: level i of n is H/n tall and W*i/n wide, the apex on top', () => {
  // COM, pyramid1 at 800 x 420 (q4/geometry-pyramid1.csv): 3 levels at 346.67/213.33/80, 266.67/533.33/800 wide, 140 tall.
  const nodes = pyramidNodes(frame, 3);
  assert.deepEqual(nodes.map(node => node.preset), ['trapezoid', 'trapezoid', 'trapezoid']);
  for (const [index, [left, top, width]] of [[346.67, 60, 266.67], [213.33, 200, 533.33], [80, 340, 800]].entries()) {
    near(nodes[index].box.x, left, `level ${index} left`); near(nodes[index].box.y, top, `level ${index} top`);
    near(nodes[index].box.width, width, `level ${index} width`); near(nodes[index].box.height, 140, `level ${index} height`);
  }
  // The sides continue one slope: every level steps in by W/(2n) at its top edge (DrawingML adj over the smaller side; 95238 at 3 levels).
  assert.deepEqual(nodes.map(node => node.adjust), [95238, 95238, 95238]);
  near(nodes[0].points[0][0] - nodes[0].box.x, 800 / 6, 'apex inset');
  // The apex's text rectangle is its whole box; a lower level's is 0.65 of its width, centered, as PowerPoint's txXfrm.
  assert.deepEqual(nodes[0].textBox, nodes[0].box);
  near(nodes[1].textBox.width, .65 * 533.333, 'level 2 text width');
  near(nodes[1].textBox.x + nodes[1].textBox.width / 2, 480, 'level 2 text centered');
  // Eight levels, and a wide area: a frame at most 2.5 times as wide as tall, centered.
  for (const count of [1, 2, 4, 8]) assert.equal(pyramidNodes(frame, count).length, count);
  assert.deepEqual(pyramidFrame({ x: 0, y: 0, width: 1200, height: 300 }), { x: 225, y: 0, width: 750, height: 300 });
  // A trapezoid narrows toward its top edge.
  near(nodeWidthAt(nodes[0], nodes[0].box.y), 0, 'apex point');
  near(nodeWidthAt(nodes[2], nodes[2].box.y + 140), 800, 'base');
});

test('a matrix is PowerPoint\'s Basic Matrix: four rounded squares in a centered square, whatever the count', () => {
  // COM, matrix3 at 800 x 420: the diamond 420 x 420 at 270, 60; quadrants 163.8 at 309.9/486.3 and 99.9/276.3.
  assert.deepEqual(matrixSquare(frame), { x: 270, y: 60, width: 420, height: 420 });
  const nodes = matrixNodes(frame);
  assert.equal(nodes.length, 4);
  for (const [index, [left, top]] of [[309.9, 99.9], [486.3, 99.9], [309.9, 276.3], [486.3, 276.3]].entries()) {
    near(nodes[index].box.x, left, `quadrant ${index + 1} left`); near(nodes[index].box.y, top, `quadrant ${index + 1} top`);
    near(nodes[index].box.width, 163.8, `quadrant ${index + 1} width`); near(nodes[index].box.height, 163.8, `quadrant ${index + 1} height`);
    assert.equal(nodes[index].preset, 'roundRect');
  }
  // roundRect's text rectangle: inset by 0.29289 of its 16667 corner (PowerPoint's txXfrm: 8 pt on a 163.8 pt quadrant).
  near(nodes[0].textBox.x - nodes[0].box.x, .29289 * .16667 * 163.8, 'quadrant text inset');
  assert.deepEqual(SMART_ART_LAYOUTS, { pyramid: 'urn:microsoft.com/office/officeart/2005/8/layout/pyramid1', matrix: 'urn:microsoft.com/office/officeart/2005/8/layout/matrix3' });
  assert.deepEqual(ARRANGEMENT_MAX, { pyramid: 8, matrix: 4 });
  assert.deepEqual(ARRANGEMENT_TEXT_MARGIN, { pyramid: .1, matrix: .3 });
});

test('a region\'s arrangement is read from the layout record, and the gallery has a pyramid and a matrix layout', () => {
  assert.equal(layoutTemplate(gallery.layouts.pyramid).regions.find(region => region.name === 'levels').arrangement, 'pyramid');
  assert.equal(layoutTemplate(gallery.layouts.matrix).regions.find(region => region.name === 'quadrants').arrangement, 'matrix');
  assert.equal(layoutTemplate({ regions: [{ name: 'title' }, { name: 'body', arrangement: 'spiral' }] }).regions[0].arrangement, undefined);
});

const compose = (slide, layout = slide.layout) => composeSlide(slide, { layout: gallery.layouts[layout] });

test('a lone list in a pyramid region draws as a pyramid, every entry centered on its level at one size', () => {
  const items = ['Vision', 'Strategy and goals', 'Programs we run', 'Teams, budgets and the platform'];
  const result = compose({ layout: 'pyramid', title: 'Our strategy', items });
  assert.equal(result.arrangements?.length, 1);
  const [arrangement] = result.arrangements, list = result.items.find(item => item.field === 'items');
  assert.equal(arrangement.kind, 'pyramid');
  assert.equal(arrangement.nodes.length, 4);
  assert.deepEqual(arrangement.nodes.map(node => node.path), items.map((_, index) => `slides.0.items.${index}`));
  // One size for every node, never below the list's role size.
  assert.ok(arrangement.fontSize >= LIST_NOMINAL_SIZE - 1e-6, `size ${arrangement.fontSize}`);
  assert.equal(list.listColumns.length, 4);
  assert.ok(list.listColumns.every(column => column.text.fontSize === arrangement.fontSize));
  assert.equal(list.alignment, 'center');
  near(arrangement.textMargin, .1 * arrangement.fontSize, 'margin');
  for (const [index, column] of list.listColumns.entries()) {
    const node = arrangement.nodes[index], entry = column.text.listEntries[0];
    assert.equal(entry.marker.none, true, 'no bullet');
    // The text block is in the middle of its node's text rectangle, and every line inside the node's outline.
    near(column.box.y + column.box.height / 2, node.textBox.y + node.textBox.height / 2, `entry ${index} centered`, .05);
    for (const line of entry.text.richLines) assert.ok(line.width <= nodeWidthAt(node, entry.textBox.y + line.baseline - .72 * arrangement.fontSize) - 2 * arrangement.textMargin + 1e-6, `entry ${index} inside its level`);
  }
  assert.deepEqual(arrangement.smartArt.lines.length, 4);
});

const adapted = (result) => result.diagnostics.filter(entry => entry.code === 'arrangement-adapted').map(entry => entry.message);

test('a matrix of four entries draws its quadrants; another count draws a grid of cards and says so', () => {
  const result = compose({ layout: 'matrix', title: 'Four markets', items: ['Enterprise', 'Mid-market', 'Consumer', 'Public sector'] });
  const [arrangement] = result.arrangements;
  assert.deepEqual([arrangement.kind, arrangement.design, arrangement.align, arrangement.paint], ['matrix', 'smartart', 'center', 'primary']);
  assert.equal(arrangement.nodes.length, 4);
  assert.ok(arrangement.nodes.every(node => node.path), 'no empty quadrant');
  assert.deepEqual(arrangement.background, matrixSquare(arrangement.frame));
  near(arrangement.textMargin, .3 * arrangement.fontSize, 'margin');
  assert.deepEqual(adapted(result), []);
  for (const items of [['North', 'South'], ['North', 'South', 'East'], ['North', 'South', 'East', 'West', 'Central', 'Online']]) {
    const other = compose({ layout: 'matrix', title: 'T', items });
    const [cards] = other.arrangements;
    assert.deepEqual([cards.design, cards.paint, cards.align, cards.text, cards.nodes.length], ['cards', 'card', 'start', 'slide', items.length], items.join());
    assert.equal(cards.background, undefined);
    assert.ok(cards.fontSize >= LIST_NOMINAL_SIZE - 1e-6);
    assert.match(adapted(other)[0], new RegExp(`its ${items.length} entries are drawn as a grid of cards`));
  }
});

test('OPF\'s own design where PowerPoint\'s does not hold the entries: a stepped pyramid with the entries beside it, quadrants that fill', () => {
  const pyramid = compose({ layout: 'pyramid', title: 'Eight levels', items: ['Purpose', 'Vision', 'Strategy', 'Goals', 'Programs', 'Projects', 'Teams', 'Daily work'] });
  const [steps] = pyramid.arrangements;
  assert.deepEqual([steps.design, steps.align, steps.text, steps.nodes.length], ['opf', 'start', 'slide', 8]);
  assert.ok(steps.fontSize >= LIST_NOMINAL_SIZE - 1e-6, 'never below the floor');
  for (const [index, node] of steps.nodes.entries()) {
    assert.equal(node.beside, true);
    assert.ok(node.textBox.x >= node.box.x + node.box.width, 'the text beside its level');
    if (index) assert.ok(node.box.width > steps.nodes[index - 1].box.width, 'each level wider than the one above');
  }
  const long = ['Why we exist and who we serve', 'The few goals that matter this year', 'How teams plan, decide and ship', 'Feedback loops measured in days'];
  const matrix = compose({ layout: 'matrix', title: 'Four long', items: long });
  const [quadrants] = matrix.arrangements;
  assert.equal(quadrants.design, 'opf');
  assert.equal(quadrants.background, undefined);
  const area = matrix.regions.find(region => region.name === 'quadrants').box;
  near(quadrants.nodes[3].box.x + quadrants.nodes[3].box.width, area.x + area.width, 'the quadrants fill the region', .05);
});

test('nothing an arrangement does not draw, and nothing its designs cannot hold at the floor, is silent: the list stays with a finding', () => {
  for (const items of [['A', { text: 'B', level: 1 }], [{ text: 'A', description: 'more' }, 'B']]) {
    const result = compose({ layout: 'matrix', title: 'T', items });
    assert.equal(result.arrangements, undefined, JSON.stringify(items));
    assert.match(adapted(result)[0], /is drawn as a list/);
  }
  assert.match(adapted(compose({ layout: 'pyramid', title: 'T', items: ['A', 'B'], numbering: 'arabic' }))[0], /a numbered list/);
  const word = 'Supercalifragilisticexpialidocious';
  const tooLong = compose({ layout: 'matrix', title: 'Too long', items: [word, word, word, word] });
  assert.equal(tooLong.arrangements, undefined);
  assert.match(adapted(tooLong)[0], /do not fit its quadrants at the list's size/);
  assert.equal(composeSlide({ layout: 'list', title: 'T', items: ['A', 'B'] }, { layout: gallery.layouts.list }).arrangements, undefined, 'no arrangement region');
});

test('the paint: nodes in the primary outlined in the background, text readable on the primary, the diamond the primary lightened 80%', () => {
  const paint = arrangementPaint('#1F6FB2', '#FFFFFF', '#111111', colorContrast, applyColorTransform);
  assert.deepEqual([paint.fill.slot, paint.line.slot, paint.text.slot, paint.background.slot], ['accent1', 'bg1', 'bg1', 'accent1']);
  assert.deepEqual([paint.background.lumMod, paint.background.lumOff], [20000, 80000]);
  assert.equal(paint.background.hex, applyColorTransform('#1F6FB2', { lumMod: 20000, lumOff: 80000 }));
  assert.equal(arrangementPaint('#F5D547', '#FFFFFF', '#111111', colorContrast, applyColorTransform).text.slot, 'tx1', 'dark text on a light primary');
});

test('the SmartArt domain names why an instance stays native shapes', () => {
  const candidate = (extra = {}) => ({ kind: 'pyramid', count: 4, frame: { x: 0, y: 0, width: 1000, height: 500 }, rtl: false, nodes: Array.from({ length: 4 }, () => ({ lines: 1, stable: true })), ...extra });
  assert.equal(smartArtUnavailable(candidate()), undefined);
  // The domain the PowerPoint sweep passed (docs/smartart.md): up to 5 levels or 4 quadrants, the compared proportions, Latin text, at
  // most 2 lines an entry and 6 in all, and line breaks that hold.
  assert.deepEqual(SMART_ART_DOMAIN.count, { pyramid: 5, matrix: 4 });
  assert.match(smartArtUnavailable(candidate({ count: 6 })), /outside the compared 1 to 5/);
  assert.match(smartArtUnavailable(candidate({ frame: { x: 0, y: 0, width: 1500, height: 500 } })), /proportions \(3\.00 : 1\)/);
  assert.equal(smartArtUnavailable(candidate({ kind: 'matrix', frame: { x: 0, y: 0, width: 600, height: 560 } })), undefined);
  assert.match(smartArtUnavailable(candidate({ kind: 'matrix', frame: { x: 0, y: 0, width: 360, height: 600 } })), /proportions/);
  assert.match(smartArtUnavailable(candidate({ nodes: [{ lines: 1, stable: true }, { lines: 1, stable: false }] })), /entry 2 wraps too close/);
  assert.match(smartArtUnavailable(candidate({ nodes: [{ lines: 3, stable: true }] })), /entry 1 wraps to 3 lines/);
  assert.match(smartArtUnavailable(candidate({ nodes: Array.from({ length: 4 }, () => ({ lines: 2, stable: true })) })), /8 lines in all/);
  assert.match(smartArtUnavailable(candidate({ rtl: true })), /right-to-left/);
  assert.match(smartArtUnavailable(candidate({ script: 'cjk' })), /Japanese/);
  assert.match(smartArtUnavailable(candidate({ script: 'other' })), /script/);
});
