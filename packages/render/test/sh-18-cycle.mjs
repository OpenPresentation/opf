// SH-18: the preview draws core's cycles (geometry.arrangements) under their entries, as the PPTX export does: PowerPoint's Basic Cycle
// as circles in the primary with a background-colored outline and an arrow after each in the primary lightened 40%, OPF's own cycle as
// rounded rectangles with the same arrows, every entry centered on its node in the color that reads on the primary.
import assert from 'node:assert/strict';
import {gallery} from '@openpresentation/gallery';
import {applyColorTransform} from '@openpresentation/opf/composition';
import {resolvePresentation, toSvg} from '../src/svg.js';

const catalogs = [gallery];
const deck = {design: {colorScheme: {id: 'test', name: 'Test', dark1: '#111111', light1: '#FFFFFF', dark2: '#333333', light2: '#EEEEEE', accent1: '#1F6FB2', accent2: '#C0504D', accent3: '#9BBB59', accent4: '#8064A2', accent5: '#4BACC6', accent6: '#F79646', hyperlink: '#0563C1', followedHyperlink: '#954F72'}},
  slides: [{layout: 'cycle', title: 'The loop', items: ['Plan', 'Build', 'Ship', 'Learn']}, {layout: 'cycle', title: 'The loop', items: ['Clear purpose', 'Shared goals', 'Team habits', 'Weekly reviews', 'Open roadmap']}]};
const resolved = resolvePresentation(deck, {catalogs});
const primary = resolved.slides[0].design.colors.primary, background = resolved.slides[0].design.roles.background;
const arrow = applyColorTransform(primary, {lumMod: 60000, lumOff: 40000});

{
  const svg = toSvg(deck, 1, {catalogs, trace: true});
  assert.match(svg, /data-opf-arrangement="cycle" data-opf-arrangement-design="smartart"/);
  const circles = [...svg.matchAll(/<ellipse [^>]*data-opf-arrangement-path="slides\.0\.items\.(\d)"[^>]*>/g)];
  assert.deepEqual(circles.map(match => match[1]), ['0', '1', '2', '3']);
  for (const [circle] of circles) {
    assert.match(circle, new RegExp(`fill="${primary}"`, 'i'));
    assert.match(circle, new RegExp(`stroke="${background}"`, 'i'));
  }
  // Each arrow follows its circle (PowerPoint's stacking), a seven-point rightArrow in the lighter primary, no outline.
  const group = /<g [^>]*data-opf-arrangement="cycle"[^>]*>([\s\S]*?)<\/g>/.exec(svg)[1];
  const order = [...group.matchAll(/<(ellipse|path) [^>]*>/g)].map(match => match[1]);
  assert.deepEqual(order, ['ellipse', 'path', 'ellipse', 'path', 'ellipse', 'path', 'ellipse', 'path']);
  const arrows = [...group.matchAll(/<path [^>]*>/g)].map(match => match[0]);
  for (const path of arrows) {
    assert.match(path, new RegExp(`fill="${arrow}"`, 'i'));
    assert.doesNotMatch(path, /stroke=/);
    assert.equal(/ d="M([^"]+) Z"/.exec(path)[1].split(' L').length, 7);
  }
  for (const word of ['Plan', 'Build', 'Ship', 'Learn']) assert.match(svg, new RegExp(`<text[^>]*text-anchor="middle"[^>]*>(?:<tspan[^>]*>)?${word}<`), word);
  assert.ok(svg.indexOf('data-opf-arrangement="cycle"') < svg.indexOf('>Plan<'), 'the cycle is under the text');
}
{
  // Longer entries: OPF's own cycle, rounded rectangles (and their arrows) filling the region.
  const svg = toSvg(deck, 2, {catalogs, trace: true});
  assert.match(svg, /data-opf-arrangement="cycle" data-opf-arrangement-design="opf"/);
  const nodes = [...svg.matchAll(/<rect [^>]*data-opf-arrangement-path="slides\.1\.items\.\d"[^>]*>/g)].map(match => match[0]);
  assert.equal(nodes.length, 5);
  for (const rect of nodes) assert.match(rect, / rx="[^"]+"/);
  assert.equal([...svg.matchAll(new RegExp(`<path [^>]*fill="${arrow}"`, 'gi'))].length, 5, 'an arrow after every node');
}
console.log('SH-18 cycles passed: Basic Cycle circles with an arrow after each, and OPF\'s own cycle, in the primary under centered entries.');
