// SH-03 wired into SH-02: a shape block's effects are drawn by effectsSvg around the shape's outline and text: the filter and the
// outer shadow from the block's keys, a lighter or darker theme color resolved as the fill's, the lengths at the canvas's scale, and a
// shape without effects drawn as before (no filter).
import assert from 'node:assert/strict';
import { composeSlide } from '@openpresentation/opf/composition';
import { toSvg } from '../dist/index.js';

const scheme = { name: 'Test', dark1: '#101820', light1: '#FFFFFF', dark2: '#2A3440', light2: '#E8E4DC', accent1: '#1F5AA6', accent2: '#4A7A3A', accent3: '#B05A2A', accent4: '#7A4A9A', accent5: '#C0C8D0', accent6: '#5A8A9A', hyperlink: '#1F5AA6', followedHyperlink: '#7A4A9A' };
const deck = (blocks, dimensions) => ({ name: 'Effects', language: 'en-US', design: { colorScheme: scheme, ...(dimensions ? { dimensions } : {}) }, slides: [{ title: 'Effects', blocks }] });
const shapeOf = (blocks, options = {}) => composeSlide(deck(blocks).slides[0], { presentation: deck(blocks), ...options }).items.find((entry) => entry.field === 'shape').shape;

// No effects: no filter, and core carries no effects (and no effect scale).
{
  const svg = toSvg(deck([{ shape: 'roundRect', text: 'Plain' }]), 1);
  assert.ok(!/<filter\b/.test(svg), 'a shape without effects has no filter');
  assert.equal(shapeOf([{ shape: 'roundRect' }]).effects, undefined);
  assert.equal(shapeOf([{ shape: 'roundRect' }]).effectScale, undefined);
}

// Every effect draws: the inner shadow, soft edge, blur and glow as the outline's filter, the outer shadow and reflection around it, and
// the text inside the shadowed group (a shape's text casts the shadow too).
{
  const blocks = [{ shape: 'roundRect', text: 'All', fill: 'accent1', shadow: 'soft', innerShadow: { opacity: 0.5 }, glow: { color: { color: 'accent2', lighten: 0.4 }, radius: 10 }, softEdge: 4, reflection: { opacity: 0.4, size: 0.5 }, blur: 2 }];
  const svg = toSvg(deck(blocks), 1);
  assert.match(svg, /<filter id="[^"]*-fx-body"/);
  assert.match(svg, /<filter id="[^"]*-fx-shadow"/);
  assert.match(svg, /<mask id="[^"]*-fx-reflection-mask"/);
  assert.match(svg, /feFlood flood-color="#8ABF79"/, 'the glow takes accent2 40% lighter (lumMod 60%, lumOff 40% of its luminance)');
  const core = svg.match(/<g id="[^"]*-fx-core">([\s\S]*?)<\/g><\/g>/);
  assert.ok(core && />All</.test(svg.slice(svg.indexOf('-fx-core"'))), 'the text is drawn inside the shadowed group');
}

// The lengths are reference pixels at the canvas's scale: a canvas twice the reference size (a 15-inch short edge) doubles the glow's spread.
{
  const blocks = [{ shape: 'ellipse', glow: { radius: 12 } }];
  assert.equal(shapeOf(blocks).effectScale, 1);
  assert.equal(shapeOf(blocks, { width: 2560, height: 1440 }).effectScale, 2);
  const radius = (svg) => Number(svg.match(/feMorphology[^>]*operator="dilate" radius="([\d.]+)"/)[1]);
  const one = radius(toSvg(deck(blocks), 1)), two = radius(toSvg(deck(blocks, { widthInches: 80 / 3, heightInches: 15 }), 1));
  assert.ok(Math.abs(two - 2 * one) < 0.01, `glow spread ${one} at 1280 x 720, ${two} at 2560 x 1440`);
}

// A rotated shape's shadow keeps its direction (the effects wrap the turned outline; the filter region covers the turned bounds).
{
  const svg = toSvg(deck([{ shape: 'rightArrow', rotate: 30, shadow: 'hard' }]), 1);
  assert.match(svg, /feOffset in="shadow-shape" dx="5\.657" dy="5\.657"/, 'the hard shadow is 8 px at 45 degrees, unrotated');
}
console.log('shape-block-effects: ok');
