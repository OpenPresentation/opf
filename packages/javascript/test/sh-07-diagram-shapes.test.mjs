// SH-07: what core gives the PPTX export for native diagrams: the family allowlist, the painted drawing with pele's classes kept (the same
// drawing otherwise), the preset geometry loaded for a deck whose diagrams become shapes, and the `diagrams` export option.
import test from 'node:test';
import assert from 'node:assert/strict';
import {DIAGRAM_SHAPE_FAMILIES, diagramPalette, layoutDiagram, paintDiagram, shapesPending} from '../dist/composition.js';
import {resolveExportOptions} from '../dist/node-engine.js';

const measure = (text, size) => Array.from(text).length * size * 0.52;
const FLOW = 'flowchart LR\n  A[Request] --> B{Approved?}\n  B -->|yes| C[Build]';

test('DIAGRAM_SHAPE_FAMILIES names the 32 built-in families by their pele type, frozen', () => {
  assert.equal(DIAGRAM_SHAPE_FAMILIES.length, 32);
  assert.ok(Object.isFrozen(DIAGRAM_SHAPE_FAMILIES));
  for (const family of ['flowchart', 'sequence', 'class', 'state', 'er', 'gantt', 'pie', 'quadrantChart', 'mindmap', 'timeline', 'journey', 'xychart', 'sankey', 'gitGraph', 'c4', 'block', 'architecture', 'kanban', 'packet', 'radar', 'treemap', 'venn', 'ishikawa', 'requirement', 'wardley', 'treeView', 'eventmodeling', 'railroad', 'cynefin', 'usecase', 'swimlane', 'agentflow']) assert.ok(DIAGRAM_SHAPE_FAMILIES.includes(family), family);
  assert.ok(!DIAGRAM_SHAPE_FAMILIES.includes('info'));
});

test('paintDiagram keeps pele\'s classes with { classes: true } and draws the same drawing', () => {
  const diagram = layoutDiagram(FLOW, {width: 800, height: 400, nominal: 24, floor: 16, measure, idPrefix: 'd'});
  const palette = diagramPalette({surface: '#FFFFFF', text: '#1F1F1F', fonts: {body: 'Aptos', code: 'Consolas'}});
  const plain = paintDiagram(diagram, palette, {width: 400, height: 200});
  const classed = paintDiagram(diagram, palette, {width: 400, height: 200}, {classes: true});
  assert.ok(!/\sclass="/.test(plain), 'the picture has no classes');
  assert.match(classed, /<g class="pele-node pele-shape-diam" data-id="B"/);
  assert.match(classed, /class="pele-edge" data-id="L_A_B_0"/);
  assert.equal(classed.replace(/\sclass="[^"]*"/g, ''), plain, 'only the classes differ');
});

test('a deck whose diagrams become shapes needs the preset geometry; the diagrams option is a pptx option', () => {
  const deck = {slides: [{diagram: FLOW}]};
  // Node loads the geometry with core: nothing is ever pending here, with or without the option.
  assert.deepEqual(shapesPending(deck, {diagrams: true}), []);
  assert.equal(resolveExportOptions({format: 'pptx', diagrams: 'shapes'}).diagrams, 'shapes');
  assert.throws(() => resolveExportOptions({format: 'pptx', diagrams: 'native'}), /diagrams/);
  assert.throws(() => resolveExportOptions({format: 'png', diagrams: 'shapes'}), /charts, diagrams, provenance, images, bodyText, smartArt, slideNumbers, typefaces and as apply to format pptx/);
  assert.throws(() => resolveExportOptions({format: 'pptx', as: 'images', diagrams: 'shapes'}), /do not apply to as: "images"/);
});
