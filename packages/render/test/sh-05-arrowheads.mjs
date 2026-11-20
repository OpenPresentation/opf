// SH-05: arrowheads (`stroke.start`, `stroke.end`) are drawn on the open path of any preset shape, not only on connectors: the connector
// presets PowerPoint draws for a route (curvedConnector4, bentConnector4, straightConnector1), the open outlines of arc and the bracket and
// brace presets, and a line. Each has one head at each end of its open path, at the ends core evaluates, at PowerPoint's size.
import assert from 'node:assert/strict';
import { composeSlide } from '@openpresentation/opf/composition';
import { toSvg } from '../dist/index.js';

const presets = ['curvedConnector4', 'bentConnector4', 'straightConnector1', 'arc', 'leftBracket', 'rightBrace', 'line'];
const stroke = { color: '#101820', width: 3, start: { type: 'oval' }, end: { type: 'triangle' } };
for (const preset of presets) {
  const deck = { name: 'Heads', slides: [{ title: 'Heads', shapes: [{ shape: preset, x: 0.1, y: 0.3, width: 0.4, height: 0.3, fill: 'none', stroke }] }] };
  const [shape] = composeSlide(deck.slides[0], { presentation: deck }).overlayShapes;
  const open = shape.shape.paths.filter(path => path.open && path.stroke);
  assert.equal(open.length, 1, `${preset}: one open stroked path`);
  assert.ok(open[0].ends, `${preset}: core gives its ends`);
  const svg = await toSvg(deck, 1);
  // The triangle is 3 line widths wide and long (medium), the oval as large, each at its end of the path.
  const triangles = svg.match(/d="M0 0L-9 4\.5L-9 -4\.5Z"/g) ?? [], ovals = svg.match(/<ellipse[^>]*rx="4\.5"[^>]*ry="4\.5"/g) ?? [];
  assert.equal(triangles.length, 1, `${preset}: an arrowhead at the end`);
  assert.equal(ovals.length, 1, `${preset}: an arrowhead at the start`);
  const { start, end } = open[0].ends;
  const spots = [...svg.matchAll(/translate\(([-\d.]+) ([-\d.]+)\) rotate\(([-\d.]+)\)/g)].map(match => match.slice(1).map(Number));
  for (const [name, at] of [['start', start], ['end', end]]) assert.ok(spots.some(([x, y, angle]) => Math.abs(x - at.x) < 0.01 && Math.abs(y - at.y) < 0.01 && Math.abs(angle - at.angle) < 0.01), `${preset}: the ${name} head sits at the path's ${name}`);
  assert.ok(Number.isFinite(start.angle) && Number.isFinite(end.angle));
}
console.log('sh-05 arrowheads: ok');
