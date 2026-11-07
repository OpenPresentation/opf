// SH-19: OPF's own SmartArt layout definitions and OPF's interpreter of them (smart-art-layout.ts). The interpreter is checked against
// what PowerPoint drew for OPF-written definitions through COM (test/fixtures/sh-19-com.json, the SH-19 spike: composite placement with
// and without a full-frame child, shapes turned by `rot`, connectors between node centers, the closing transition), and every OPF design
// is checked to come back from its own definition at every count.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { gallery } from '@openpresentation/gallery';
import {
  OPF_LAYOUT_DESIGNS, OPF_LAYOUT_KIND, SMART_ART_OPF_DOMAIN, composeSlide, compositeLayoutDefinition, evaluateLayoutDefinition, layoutArrangement, opfLayoutGeometry,
  opfSmartArtUnavailable, presetTextRect, turnedShapeBox,
} from '../dist/composition.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/sh-19-com.json', import.meta.url), 'utf8'));
const PT = .75;

test('the interpreter draws what PowerPoint drew for OPF-written definitions (COM fixture), within 0.001 pt', () => {
  let shapes = 0;
  for (const { id, definition, steps } of fixture.cases) for (const { frame: [W, H], count, shapes: measured } of steps) {
    const drawn = evaluateLayoutDefinition(definition, { x: 0, y: 0, width: W / PT, height: H / PT }, count).filter(shape => !shape.hidden);
    assert.equal(drawn.length, measured.length, `${id} ${W}x${H} n=${count}: shapes`);
    drawn.forEach((shape, index) => {
      const [l, t, w, h, rot] = measured[index], box = [shape.box.x, shape.box.y, shape.box.width, shape.box.height].map(value => value * PT);
      [l, t, w, h].forEach((value, k) => { assert.ok(Math.abs(box[k] - value) <= .001, `${id} ${W}x${H} n=${count} shape ${index + 1}: ${box[k]} is not ${value}`); });
      assert.ok(Math.abs((((shape.rotation - rot) % 360) + 540) % 360 - 180) <= .001, `${id} shape ${index + 1}: rotation ${shape.rotation} is not ${rot}`);
      shapes += 1;
    });
  }
  assert.ok(shapes >= 177, `${shapes} shapes compared`);
});

test("a turned shape is the largest rectangle at its angle inside its box (PowerPoint's rule); a quarter turn keeps the box", () => {
  const box = { x: 0, y: 0, width: 44.641, height: 37.32 };
  const at30 = turnedShapeBox(box, 30);
  assert.ok(Math.abs(at30.width - 37.32) < .01 && Math.abs(at30.height - 21.547) < .01, JSON.stringify(at30));
  const square = turnedShapeBox({ x: 0, y: 0, width: 60, height: 60 }, 45);
  assert.ok(Math.abs(square.width - square.height) < 1e-6, 'at 45 degrees the rectangle is a square');
  assert.deepEqual(turnedShapeBox({ x: 1, y: 2, width: 30, height: 10 }, 90), { x: 11, y: -8, width: 10, height: 30 });
  assert.deepEqual(turnedShapeBox({ x: 1, y: 2, width: 30, height: 10 }, 180), { x: 1, y: 2, width: 30, height: 10 });
});

test("presetTextRect is DrawingML's text rectangle of a rounded rectangle, an ellipse and a chevron", () => {
  const round = presetTextRect('roundRect', { x: 0, y: 0, width: 186.7407 / PT, height: 118.8731 / PT }, 12300);
  assert.ok(Math.abs(round.x * PT - 54387 / 12700) < .001, `roundRect inset ${round.x * PT}`);
  const ellipse = presetTextRect('ellipse', { x: 0, y: 0, width: 100, height: 60 });
  assert.ok(Math.abs(ellipse.width - 100 * Math.SQRT1_2) < 1e-9 && Math.abs(ellipse.y - 30 * (1 - Math.SQRT1_2)) < 1e-9);
  assert.deepEqual(presetTextRect('chevron', { x: 0, y: 0, width: 200, height: 80 }, 50000), { x: 40, y: 0, width: 120, height: 80 });
});

test('every OPF design comes back from its own definition at every count, both directions (but a mirrored chevron)', () => {
  const area = { x: 100, y: 150, width: 1080, height: 480 };
  for (const design of OPF_LAYOUT_DESIGNS) for (const rtl of [false, true]) for (const lines of [1, 2]) {
    const recipe = { design, area, gap: 24, radius: 12, rtl, lines, columns: 3 };
    const definition = compositeLayoutDefinition({ uniqueId: `urn:openpresentation.org/smartart/layout/${design}`, title: design, description: design, category: 'other' }, area, 8,
      k => opfLayoutGeometry(recipe, k), { node: 'node1', text: design === 'pyramid-steps' ? 'slide' : 'node', margins: [.2, .2, .2, .2], fontSize: 24 });
    if (design === 'chevron-rows' && rtl) { assert.match(definition.reason, /mirrored/); continue; }
    assert.equal(definition.reason, undefined, `${design}: ${definition.reason}`);
    // Every layout node and forEach name is unique (PowerPoint rejects a definition that repeats one).
    const names = [];
    const walk = items => { for (const item of items ?? []) { if (item.kind === 'choose') { names.push(item.name); item.branches.forEach(branch => { names.push(branch.name); walk(branch.children); }); } else { names.push(item.name); walk(item.children); } } };
    walk([definition.root]);
    assert.equal(new Set(names).size, names.length, `${design}: names repeat`);
    for (let k = 1; k <= 8; k++) {
      const want = opfLayoutGeometry(recipe, k);
      if (!want) continue;
      const got = layoutArrangement(evaluateLayoutDefinition(definition, area, k));
      assert.equal(got.nodes.length, k, `${design} ${k}: nodes`);
      assert.equal(got.arrows.length, want.arrows?.length ?? 0, `${design} ${k}: arrows`);
      const near = (a, b, what) => { for (const key of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(a[key] - b[key]) <= .01, `${design} ${k} ${what}: ${key} ${a[key]} is not ${b[key]}`); };
      want.nodes.forEach((node, i) => { near(got.nodes[i].box, node.box, `node ${i}`); near(got.nodes[i].textBox, node.textBox, `text ${i}`); assert.equal(got.nodes[i].preset, node.preset); });
      (want.arrows ?? []).forEach((arrow, i) => { near(got.arrows[i].box, arrow.box, `arrow ${i}`); assert.ok(Math.abs((((got.arrows[i].rotation - arrow.rotation) % 360) + 540) % 360 - 180) < .01); });
    }
    // More entries than the tables: the largest table again (nine entries draw the eight-entry design), so nothing fails to lay out.
    assert.equal(layoutArrangement(evaluateLayoutDefinition(definition, area, 9)).nodes.length, 8);
  }
});

test('a composed OPF design carries the recipe of its definition, and the domain names its limits', () => {
  const slide = { layout: 'cycle', title: 'How each round feeds the next', items: ['Customers who stay and refer others', 'Data everyone can see and trust', 'Feedback loops measured in days', 'Releases that land every single week', 'Reviews that keep plans honest'] };
  const arrangement = composeSlide(slide, { layout: gallery.layouts.cycle }).arrangements?.[0];
  assert.ok(arrangement, 'the cycle is drawn');
  assert.equal(arrangement.design, 'opf', "five long steps draw OPF's cycle");
  {
    assert.ok(arrangement.layout && OPF_LAYOUT_KIND[arrangement.layout.design] === 'cycle', JSON.stringify(arrangement.layout));
    const table = opfLayoutGeometry(arrangement.layout, arrangement.nodes.length);
    arrangement.nodes.forEach((node, i) => { assert.ok(Math.abs(node.box.x - table.nodes[i].box.x) < .01 && Math.abs(node.box.width - table.nodes[i].box.width) < .01, `node ${i} is the recipe's`); });
  }
  // The domain the COM sweep passed (SMART_ART_OPF_DOMAIN): the designs and counts that passed, Latin text, two lines an entry, stable
  // breaks and the text density limit.
  const ok = { design: 'pyramid-steps', count: 4, lines: [1, 2, 1, 1], stable: [true, true, true, true], ink: .05, rtl: false };
  assert.equal(opfSmartArtUnavailable(ok), undefined);
  assert.match(opfSmartArtUnavailable({ ...ok, design: 'cycle-ring' }), /did not pass/);
  assert.match(opfSmartArtUnavailable({ ...ok, compact: true }), /compact/);
  assert.match(opfSmartArtUnavailable({ ...ok, design: 'chevron-rows' }), /for 6 to 8 entries, not 4/);
  assert.match(opfSmartArtUnavailable({ ...ok, rtl: true }), /right-to-left/);
  assert.match(opfSmartArtUnavailable({ ...ok, script: 'cjk' }), /Japanese/);
  assert.match(opfSmartArtUnavailable({ ...ok, lines: [3, 1, 1, 1] }), /3 lines/);
  assert.match(opfSmartArtUnavailable({ ...ok, stable: [true, false, true, true] }), /entry 2 wraps too close/);
  assert.match(opfSmartArtUnavailable({ ...ok, ink: SMART_ART_OPF_DOMAIN.ink + .01 }), /covers 9% of the frame/);
});
