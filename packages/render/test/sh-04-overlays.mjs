// SH-04: the slide's overlay in the SVG preview, drawn from core's geometry.overlayShapes: overlay shapes with the shape block drawing
// (outline, fill, text) and connectors as their route (core's evaluation of PowerPoint's connector preset) stroked with the shape stroke
// drawing (width, dash, arrowheads, sketch), over the content and the furniture in array order, with their accessibility.
import assert from 'node:assert/strict';
import { composeSlide } from '@openpresentation/opf/composition';
import { toSvg } from '../dist/index.js';

const scheme = { name: 'Test', dark1: '#101820', light1: '#FFFFFF', dark2: '#2A3440', light2: '#E8E4DC', accent1: '#1F5AA6', accent2: '#4A7A3A', accent3: '#B05A2A', accent4: '#7A4A9A', accent5: '#C0C8D0', accent6: '#5A8A9A', hyperlink: '#1F5AA6', followedHyperlink: '#7A4A9A' };
const slide = (shapes) => ({ title: 'Flow', blocks: [{ id: 'plan', shape: 'roundRect', text: 'Plan' }, { id: 'ship', shape: 'roundRect', text: 'Ship' }], shapes });
const deck = (shapes, extra = {}) => ({ name: 'Overlays', language: 'en-US', design: { colorScheme: scheme }, slides: [slide(shapes)], ...extra });
const svgOf = (shapes, options = {}) => toSvg(deck(shapes), 1, options);
const geometry = (shapes) => composeSlide(slide(shapes), { presentation: deck(shapes) });

// An overlay shape is drawn with the shape block drawing: core's outline and its text, named for its entry.
{
  const shapes = [{ id: 'note', shape: 'wedgeRectCallout', text: 'New', x: 0.7, y: 0.05, width: 0.2, height: 0.12 }];
  const [note] = geometry(shapes).overlayShapes;
  const svg = svgOf(shapes, { trace: true });
  assert.ok(svg.includes(`d="${note.shape.paths[0].d}"`), 'the callout outline is core\'s');
  assert.match(svg, /data-opf-path="slides\.0\.shapes\.0"/);
  assert.match(svg, />New</);
}

// A connector is its route stroked: core's path data, the stroke width and dash, an arrowhead at its end, after the furniture.
{
  const shapes = [{ connector: { from: 'plan', to: 'ship', route: 'elbow' }, stroke: { width: 3, dash: 'dash', color: 'accent2', end: { type: 'triangle' } } }];
  const [connector] = geometry(shapes).overlayShapes;
  const svg = svgOf(shapes, { trace: true });
  assert.ok(svg.includes(`d="${connector.paths[0].d}"`), 'the route is core\'s');
  const drawn = svg.slice(svg.indexOf('data-opf-path="slides.0.shapes.0"'));
  assert.match(drawn, /stroke="#4A7A3A"/);
  assert.match(drawn, /stroke-dasharray="/);
  // The triangle head is a filled polygon at the end of the line.
  assert.match(drawn, /<path[^>]*fill="#4A7A3A"/);
  // The overlay is the last thing the slide draws.
  assert.ok(svg.trimEnd().endsWith('</svg>') && drawn.trimEnd().endsWith('</svg>'));
  assert.ok(!/data-opf-path="slides\.0\.(title|blocks)/.test(drawn), 'nothing of the slide is drawn over it');
}

// Array order is draw order, and a hidden connector draws nothing.
{
  const shapes = [{ id: 'a', shape: 'rect', x: 0.1, y: 0.1, width: 0.1, height: 0.1 }, { connector: { from: 'plan', to: 'ship' }, hidden: true }, { id: 'b', shape: 'ellipse', x: 0.1, y: 0.1, width: 0.1, height: 0.1 }];
  const svg = svgOf(shapes, { trace: true });
  assert.ok(svg.indexOf('slides.0.shapes.0"') < svg.indexOf('slides.0.shapes.2"'));
  assert.ok(!svg.includes('slides.0.shapes.1"'));
}

// Accessibility: a connector with alt text is named, a decorative one and one without alt text are hidden from assistive technology.
{
  const named = svgOf([{ connector: { from: 'plan', to: 'ship' }, alt: 'Plan leads to ship' }]);
  assert.match(named, /aria-label="Plan leads to ship" role="img"/);
  const decorative = svgOf([{ connector: { from: 'plan', to: 'ship' }, decorative: true }], { trace: true });
  assert.match(decorative, /<g aria-hidden="true" data-opf-path="slides\.0\.shapes\.0"/);
}

// A sketched connector strokes core's sketched line.
{
  const shapes = [{ connector: { from: 'plan', to: 'ship', route: 'curved' }, stroke: { sketch: 'freehand' } }];
  const [connector] = geometry(shapes).overlayShapes;
  assert.ok(connector.stroke.sketched);
  assert.ok(svgOf(shapes).includes(`d="${connector.stroke.sketched.lines[0]}"`));
}

// A slide without shapes draws exactly as before.
{
  const plain = toSvg({ ...deck([]), slides: [{ title: 'Flow', blocks: [{ shape: 'rect', text: 'A' }] }] }, 1);
  const same = toSvg({ ...deck([]), slides: [{ title: 'Flow', blocks: [{ shape: 'rect', text: 'A' }], shapes: [] }] }, 1);
  assert.equal(same, plain);
}

console.log('sh-04 overlays: ok');
