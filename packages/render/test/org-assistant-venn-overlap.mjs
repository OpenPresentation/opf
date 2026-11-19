// The preview draws an org chart's assistant and its elbow, and a Venn's overlap label as an opaque pill over the circles, from core's geometry.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {gallery} from '@openpresentation/gallery';
import {resolvePresentation, toSvg} from '../dist/index.js';

const geometryOf = deck => resolvePresentation(deck, {catalogs: [gallery]}).slides[0].geometry;
const n = value => String(Math.round(value * 100) / 100);

test('an assistant is a node of the org chart with its elbow from the line below its manager', () => {
  const deck = {language: 'en-US', slides: [{layout: 'org-chart', title: 'Give the pilot lead a chief of staff', items: [
    {text: 'Pilot lead', level: 0}, {text: 'Chief of staff', level: 1, assistant: true}, {text: 'Delivery', level: 1}, {text: 'Evidence', level: 1}]}]};
  const arrangement = geometryOf(deck).arrangements[0], svg = toSvg(deck, {catalogs: [gallery], trace: true})[0];
  assert.equal(arrangement.nodes.length, 4);
  for (const node of arrangement.nodes) assert.ok(svg.includes(`data-opf-arrangement-path="${node.path}"`), node.path);
  const elbow = arrangement.connectors.find(connector => connector.child === 1);
  assert.equal(elbow.points.length, 3);
  const paths = [...svg.matchAll(/<path[^>]*\bd="M([^"]+)"[^>]*fill="none"/g)].map(match => match[1].split(' L').map(point => point.split(' ').map(Number)));
  assert.ok(paths.some(points => points.length === 3 && points.every(([x, y], index) => Math.abs(x - elbow.points[index][0]) < .02 && Math.abs(y - elbow.points[index][1]) < .02)), 'the elbow is drawn');
  assert.ok(svg.includes('Chief of'), 'the assistant\'s text is drawn');
});

test('the overlap label is a pill in the background color with the primary outline, drawn after the circles', () => {
  const deck = {language: 'en-US', slides: [{layout: 'venn', title: 'Where the pilot earns its keep', items: ['Clear scope', 'Evidence', 'Shared goal', {text: 'Ready to scale', overlap: true}]}]};
  const arrangement = geometryOf(deck).arrangements[0], svg = toSvg(deck, {catalogs: [gallery], trace: true})[0];
  const pill = arrangement.nodes.at(-1);
  assert.equal(pill.overlap, true);
  const tag = svg.match(new RegExp(`<rect[^>]*data-opf-arrangement-path="${pill.path.replaceAll('.', '\\.')}"[^>]*>`))?.[0];
  assert.ok(tag, 'the pill is drawn');
  assert.ok(tag.includes(`rx="${n(pill.radius)}"`), 'fully rounded');
  assert.ok(!tag.includes('fill-opacity'), 'opaque, unlike the circles');
  const fill = tag.match(/ fill="([^"]+)"/)[1], stroke = tag.match(/ stroke="([^"]+)"/)[1];
  const circle = svg.match(/<ellipse[^>]*fill-opacity="0.5"[^>]*>/)[0];
  assert.equal(stroke, circle.match(/ fill="([^"]+)"/)[1], 'the outline is the circles\' primary');
  assert.equal(fill, circle.match(/ stroke="([^"]+)"/)[1], 'the fill is the background the circles are outlined in');
  assert.ok(svg.lastIndexOf('<ellipse') < svg.indexOf(tag), 'over the circles');
  assert.ok(svg.includes('Ready to scale'));
});
