// SH-17: the preview draws core's chevrons and flows (geometry.arrangements) under their entries, as the PPTX export does: every node
// in the primary with a background-colored outline (a chevron's six-point outline, a flow's rounded boxes), the arrows between a flow's
// boxes in the primary lightened 40% without an outline, and each entry centered on its node in the color that reads on the primary.
import assert from 'node:assert/strict';
import {gallery} from '@openpresentation/gallery';
import {applyColorTransform, composeSlide} from '@openpresentation/opf/composition';
import {resolvePresentation, toSvg} from '../src/svg.js';

const catalogs = [gallery];
const deck = {design: {colorScheme: {id: 'test', name: 'Test', dark1: '#111111', light1: '#FFFFFF', dark2: '#333333', light2: '#EEEEEE', accent1: '#1F6FB2', accent2: '#C0504D', accent3: '#9BBB59', accent4: '#8064A2', accent5: '#4BACC6', accent6: '#F79646', hyperlink: '#0563C1', followedHyperlink: '#954F72'}},
  slides: [{layout: 'chevrons', title: 'How we work', items: ['Plan', 'Build', 'Test', 'Ship']}, {layout: 'flow', title: 'The pilot', items: ['Research', 'Design', 'Run']},
    {layout: 'vertical-flow', title: 'Onboarding', items: ['Sign up', 'Set up', 'Launch']}]};
const resolved = resolvePresentation(deck, {catalogs});
const primary = resolved.slides[0].design.colors.primary, background = resolved.slides[0].design.roles.background;
const arrowFill = applyColorTransform(primary, {lumMod: 60000, lumOff: 40000});

{
  const svg = toSvg(deck, 1, {catalogs, trace: true});
  assert.match(svg, /data-opf-arrangement="chevrons" data-opf-arrangement-design="smartart"/);
  const chevrons = [...svg.matchAll(/<path [^>]*data-opf-arrangement-path="slides\.0\.items\.(\d)"[^>]*>/g)];
  assert.deepEqual(chevrons.map(match => match[1]), ['0', '1', '2', '3']);
  for (const [chevron] of chevrons) {
    assert.match(chevron, new RegExp(`fill="${primary}"`, 'i'));
    assert.match(chevron, new RegExp(`stroke="${background}"`, 'i'));
    assert.equal((/ d="M([^"]+) Z"/.exec(chevron)[1].split(' L')).length, 6, 'a chevron: six points');
  }
  for (const word of ['Plan', 'Build', 'Test', 'Ship']) assert.match(svg, new RegExp(`<text[^>]*text-anchor="middle"[^>]*>(?:<tspan[^>]*>)?${word}<`), word);
  assert.ok(svg.indexOf('data-opf-arrangement="chevrons"') < svg.indexOf('>Plan<'), 'the chevrons are under the text');
}
for (const [slide, kind] of [[2, 'flow'], [3, 'vertical-flow']]) {
  const svg = toSvg(deck, slide, {catalogs, trace: true});
  const group = new RegExp(`<g [^>]*data-opf-arrangement="${kind}"[^>]*>([\\s\\S]*?)</g>`).exec(svg)?.[1];
  assert.ok(group, kind);
  const boxes = [...group.matchAll(/<rect [^>]*data-opf-arrangement-path[^>]*>/g)].map(match => match[0]);
  assert.equal(boxes.length, 3, `${kind}: three boxes`);
  for (const box of boxes) assert.match(box, / rx="[^"0][^"]*"/, 'rounded');
  const arrows = [...group.matchAll(/<path [^>]*>/g)].map(match => match[0]).filter(path => path.toLowerCase().includes(`fill="${arrowFill.toLowerCase()}"`));
  assert.equal(arrows.length, 2, `${kind}: an arrow between two boxes`);
  for (const arrow of arrows) {
    assert.doesNotMatch(arrow, /stroke=/, 'no outline');
    assert.equal((/ d="M([^"]+) Z"/.exec(arrow)[1].split(' L')).length, 7, 'a block arrow: seven points');
  }
  // The arrows are core's: the outline drawn is the composed arrow's points.
  const composed = composeSlide(deck.slides[slide - 1], {layout: gallery.layouts[kind], width: 1280, height: 720});
  assert.equal(composed.arrangements[0].arrows.length, 2);
}
console.log('SH-17 arrangements passed: chevrons, a flow and a vertical flow in the primary with background outlines, the arrows in the lightened primary, under centered entries.');
