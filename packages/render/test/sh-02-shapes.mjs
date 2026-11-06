// SH-02: shape blocks in the SVG preview, drawn from core's ComposedItem.shape: the evaluated preset paths with their fill modes, every
// stroke property (dash, cap, join, compound bands, inside alignment, arrowheads, gradient), gradients and patterns, rotation and flip,
// text inside the shape, accessibility and links; and the picture stroke (renamed from border).
import assert from 'node:assert/strict';
import { composeSlide } from '@openpresentation/opf/composition';
import { toSvg } from '../dist/index.js';
import { shadeColor, strokeElements, PRESET_DASHES } from '../dist/shapes.js';

const scheme = { name: 'Test', dark1: '#101820', light1: '#FFFFFF', dark2: '#2A3440', light2: '#E8E4DC', accent1: '#1F5AA6', accent2: '#4A7A3A', accent3: '#B05A2A', accent4: '#7A4A9A', accent5: '#C0C8D0', accent6: '#5A8A9A', hyperlink: '#1F5AA6', followedHyperlink: '#7A4A9A' };
const deck = (blocks) => ({ name: 'Shapes', language: 'en-US', design: { colorScheme: scheme }, slides: [{ title: 'Shapes', blocks }] });
const svgOf = (blocks, options = {}) => toSvg(deck(blocks), 1, options);
const item = (blocks) => composeSlide(deck(blocks).slides[0], { presentation: deck(blocks) }).items.find((entry) => entry.field === 'shape');

// A chevron with text: its outline is core's evaluated preset path, filled with accent1 (the moderate style) and lined with accent1
// 50% darker, and its text is drawn.
{
  const composed = item([{ shape: 'chevron', text: 'Plan' }]);
  const svg = svgOf([{ shape: 'chevron', text: 'Plan' }]);
  assert.ok(svg.includes(`d="${composed.shape.paths[0].d}"`), 'the chevron path is core\'s');
  assert.match(svg, /fill="#1F5AA6"/);
  assert.match(svg, /stroke="#102D53"/);
  assert.match(svg, />Plan</);
}

// Path fill modes shade the fill as PowerPoint does (sRGB tint and shade).
assert.equal(shadeColor('#2874A6', 'lighten'), '#7EACCA');
assert.equal(shadeColor('#2874A6', 'lightenLess'), '#5390B8');
assert.equal(shadeColor('#2874A6', 'darkenLess'), '#205D85');
assert.equal(shadeColor('#2874A6', 'norm'), '#2874A6');
{
  const svg = svgOf([{ shape: 'can', fill: '#2874A6' }]);
  assert.match(svg, /fill="#7EACCA"/, 'the can\'s top is the lighter fill');
}

// Strokes: preset dashes in line widths, custom dashes, caps and joins; compound and inside lines as masked bands; arrowheads.
{
  const svg = svgOf([{ shape: 'rect', style: 'none', stroke: { color: 'accent2', width: 4, dash: 'longDashDot', cap: 'round', join: 'bevel' } }]);
  assert.match(svg, /stroke-dasharray="32 12 4 12"/);
  assert.match(svg, /stroke-linecap="round"/);
  assert.match(svg, /stroke-linejoin="bevel"/);
  assert.deepEqual(PRESET_DASHES.sysDashDot, [3, 1, 1, 1]);
  const custom = svgOf([{ shape: 'rect', style: 'none', stroke: { color: 'accent2', width: 2, dash: [4, 2] } }]);
  assert.match(custom, /stroke-dasharray="8 4"/);
  const double = svgOf([{ shape: 'rect', style: 'none', stroke: { color: 'accent2', width: 12, compound: 'double' } }]);
  assert.equal((double.match(/<mask /g) ?? []).length >= 2, true, 'one mask per band of a compound line');
  const inside = svgOf([{ shape: 'rect', style: 'none', stroke: { color: 'accent2', width: 8, align: 'inside' } }]);
  assert.match(inside, /<clipPath/);
  const arrows = svgOf([{ shape: 'arc', fill: 'none', stroke: { color: 'accent2', width: 4, start: { type: 'oval' }, end: { type: 'triangle', width: 'large' } } }]);
  assert.match(arrows, /<ellipse[^>]*rx="6"[^>]*ry="6"/, 'a medium oval is 3 line widths');
  assert.match(arrows, /M0 0L-12 10L-12 -10Z/, 'a large-width, medium-length triangle');
  assert.match(arrows, /<mask /, 'the line stops under the triangle');
  // A picture's line takes the same vocabulary.
  const lines = strokeElements({ color: '#000000', width: 2, dash: 'dot', cap: 'flat', join: 'miter', miterLimit: 8, compound: 'single', align: 'center' }, 'M0 0H10V10H0Z', 'x',
    { box: { x: 0, y: 0, width: 10, height: 10 }, closed: true, helpers: { tag: (name, attrs, children = '') => `<${name} ${Object.entries(attrs).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}="${v}"`).join(' ')}>${children}</${name}>`, resolveColorRef: (value, fallback) => value ?? fallback, colors: { border: '#888888' } } });
  assert.match(lines.elements, /stroke-dasharray="2 6"/);
}

// Fills: gradients sampled as PowerPoint mixes them, patterns, opacity, and lighter colors.
{
  const linear = svgOf([{ shape: 'rect', fill: { gradient: { type: 'linear', angle: 0, stops: [{ color: '#000000', position: 0 }, { color: '#FFFFFF', position: 1 }] } } }]);
  assert.match(linear, /<linearGradient/);
  // Halfway through, smoothstep in linear light is 50% light: sRGB #BCBCBC.
  assert.match(linear, /offset="0.5" stop-color="#BCBCBC"/);
  const radial = svgOf([{ shape: 'ellipse', fill: { gradient: { type: 'radial', stops: [{ color: 'light1', position: 0 }, { color: 'accent1', position: 1 }] } } }]);
  assert.match(radial, /<radialGradient/);
  const pattern = svgOf([{ shape: 'rect', fill: { pattern: { preset: 'smGrid', foregroundColor: 'accent1', backgroundColor: 'light1' } } }]);
  assert.match(pattern, /<pattern [^>]*width="8"/);
  // Any other set of stops mixes straight in sRGB: at 0.5 of a black-to-white gradient that ends at 0.9, #8E8E8E (0.5 / 0.9 of the way).
  const inner = svgOf([{ shape: 'rect', fill: { gradient: { type: 'linear', angle: 0, stops: [{ color: '#000000', position: 0 }, { color: '#FFFFFF', position: 0.9 }] } } }]);
  assert.match(inner, /offset="0.5" stop-color="#8E8E8E"/);
  const twoStops = { stops: [{ color: 'light1', position: 0 }, { color: 'accent1', position: 1 }] };
  // A rectangle gradient is a fan of linear gradients from the center of the bounds, clipped to the path and drawn without antialiasing.
  const rectangle = svgOf([{ shape: 'rect', fill: { gradient: { type: 'rectangle', ...twoStops } } }]);
  assert.match(rectangle, /<clipPath id="[^"]+-fill-0-clip"/);
  assert.match(rectangle, /shape-rendering="crispEdges"/);
  assert.equal((rectangle.match(/<linearGradient [^>]*id="[^"]+-fan-\d+"/g) ?? []).length, 4);
  // A shape gradient follows the outline, centered on the filled paths' bounds: an arc's drawn quarter, not its frame.
  const arc = item([{ shape: 'arc', fill: { gradient: { type: 'shape', ...twoStops } } }]).shape;
  assert.equal(arc.shapeGradient, 'outline');
  assert.ok(Math.abs(arc.gradientBox.width - arc.box.width / 2) < 1 && Math.abs(arc.gradientBox.x - (arc.box.x + arc.box.width / 2)) < 1);
  assert.ok(arc.paths[0].gradientOutline[0].length > 3);
  // PowerPoint draws the shape gradient of the arrows (and of a custom path) as its circle gradient.
  assert.equal(item([{ shape: 'rightArrow', fill: { gradient: { type: 'shape', ...twoStops } } }]).shape.shapeGradient, 'circle');
  assert.match(svgOf([{ shape: 'rightArrow', fill: { gradient: { type: 'shape', ...twoStops } } }]), /<radialGradient/);
  // The action buttons, bevel and cube shade every part along the whole outline: each part's contour polygon is the same.
  const cube = item([{ shape: 'cube', fill: { gradient: { type: 'shape', ...twoStops } } }]).shape;
  assert.deepEqual(cube.paths[0].gradientOutline, cube.paths[1].gradientOutline);
  const faded = svgOf([{ shape: 'rect', fill: { color: 'accent1', lighten: 0.4 }, opacity: 0.5 }]);
  assert.match(faded, /fill-opacity="0.5"/);
  assert.match(faded, /fill="#6199E1"/);
}

// Rotation and flip turn the outline about the frame's center; the text turns but is not mirrored.
{
  const svg = svgOf([{ shape: 'rightArrow', rotate: 30, flip: 'horizontal', text: 'Go' }]);
  assert.match(svg, /transform="rotate\(30 [\d.]+ [\d.]+\) translate\([\d.]+ [\d.]+\) scale\(-1 1\)/);
  const vertical = svgOf([{ shape: 'rect', aspectRatio: 0.5, textDirection: 'vertical', text: 'Up' }]);
  assert.match(vertical, /rotate\(90 /);
}

// Accessibility and links: alt names the shape, decorative hides it, a hidden shape is not drawn, a link wraps it.
{
  assert.match(svgOf([{ shape: 'rect', alt: 'A box' }]), /role="img"[^>]*aria-label="A box"|aria-label="A box"[^>]*role="img"/);
  const hidden = svgOf([{ shape: 'star5', hidden: true, fill: '#ABCDEF' }]);
  assert.ok(!hidden.includes('#ABCDEF'));
  assert.match(svgOf([{ shape: 'rect', link: 'https://example.com', text: 'Go' }]), /<a href="https:\/\/example.com">/);
}

// A picture's stroke (renamed from border) draws along its preset mask with every stroke property.
{
  const photo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9V3iWggAAAAASUVORK5CYII=';
  const svg = svgOf([{ image: photo, shape: 'hexagon', stroke: { color: 'accent1', width: 3, dash: 'dash' } }]);
  assert.match(svg, /<clipPath[^>]*><path d="M[\d.]+ [\d.]+L/);
  assert.match(svg, /stroke-dasharray="12 9"/);
  assert.match(svg, /stroke="#1F5AA6"/);
}

console.log('sh-02 shapes: ok');
