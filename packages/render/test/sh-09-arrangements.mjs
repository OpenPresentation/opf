// SH-09: the preview draws core's pyramids and matrices (geometry.arrangements) under their entries, as the PPTX export does: the
// matrix's diamond in the primary lightened 80%, every node in the primary with a background-colored outline, and each entry centered on
// its node in the color that reads on the primary.
import assert from 'node:assert/strict';
import {gallery} from '@openpresentation/gallery';
import {applyColorTransform} from '@openpresentation/opf/composition';
import {resolvePresentation, toSvg} from '../src/svg.js';

const catalogs = [gallery];
const deck = {design: {colorScheme: {id: 'test', name: 'Test', dark1: '#111111', light1: '#FFFFFF', dark2: '#333333', light2: '#EEEEEE', accent1: '#1F6FB2', accent2: '#C0504D', accent3: '#9BBB59', accent4: '#8064A2', accent5: '#4BACC6', accent6: '#F79646', hyperlink: '#0563C1', followedHyperlink: '#954F72'}},
  slides: [{layout: 'pyramid', title: 'Our strategy', items: ['Vision', 'Goals', 'Programs', 'Teams']}, {layout: 'matrix', title: 'Four markets', items: ['North', 'South', 'East']}]};
const resolved = resolvePresentation(deck, {catalogs});
const primary = resolved.slides[0].design.colors.primary, background = resolved.slides[0].design.roles.background;

{
  const svg = toSvg(deck, 1, {catalogs, trace: true});
  assert.match(svg, /data-opf-arrangement="pyramid"/);
  const levels = [...svg.matchAll(/<path [^>]*data-opf-arrangement-path="slides\.0\.items\.(\d)"[^>]*>/g)];
  assert.deepEqual(levels.map(match => match[1]), ['0', '1', '2', '3']);
  for (const [level] of levels) {
    assert.match(level, new RegExp(`fill="${primary}"`, 'i'));
    assert.match(level, new RegExp(`stroke="${background}"`, 'i'));
    assert.equal((/ d="M([^"]+) Z"/.exec(level)[1].split(' L')).length, 4, 'a trapezoid (the apex a triangle with a point top)');
  }
  // The entries: centered (text-anchor middle), no bullet, drawn after the levels.
  for (const word of ['Vision', 'Goals', 'Programs', 'Teams']) assert.match(svg, new RegExp(`<text[^>]*text-anchor="middle"[^>]*>(?:<tspan[^>]*>)?${word}<`), word);
  assert.ok(svg.indexOf('data-opf-arrangement="pyramid"') < svg.indexOf('>Vision<'), 'the levels are under the text');
  assert.doesNotMatch(svg, />•</, 'no bullet');
}
{
  const svg = toSvg(deck, 2, {catalogs, trace: true});
  assert.match(svg, /data-opf-arrangement="matrix"/);
  assert.match(svg, new RegExp(`<path [^>]*fill="${applyColorTransform(primary, {lumMod: 20000, lumOff: 80000})}"`, 'i'), 'the diamond, the primary lightened 80%');
  const quadrants = [...svg.matchAll(/<rect [^>]*data-opf-arrangement-path[^>]*>|<rect [^>]*>/g)].map(match => match[0])
    .filter(rect => / rx="[^"]+"/.test(rect) && rect.toLowerCase().includes(`fill="${primary.toLowerCase()}"`));
  assert.equal(quadrants.length, 4, 'four quadrants, one of them empty');
}
console.log('SH-09 arrangements passed: pyramid levels and matrix quadrants with the diamond, in the primary with background outlines, under centered entries.');
