// The whitespace that ends a soft-wrapped line hangs at the wrap (core's TextLineSource.hang): an end-aligned or centered line keeps its
// text, whitespace included, and is drawn so that its glyphs are flush with the other lines, its anchor `hang` (or half of it) past
// theirs. The line's text and textLength are unchanged; a start-aligned line does not move. data-opf-anchor-x names the glyphs' anchor.
import assert from 'node:assert/strict';
import {resolvePresentation, toSvg} from './catalog-harness.mjs';
import {loadFonts} from '../dist/fonts-node.js';

const fonts = await loadFonts();
const heading = 'Scale the pilot to four teams in January.';
const body = 'A paragraph of body text that is long enough to wrap onto a second and a third line inside its text box, so that every wrapped line ends in a space that hangs at the wrap.';
const deck = {design: {fontScheme: 'roboto'}, slides: [
  {layout: 'statement', title: heading, design: {titleAlignment: 'end'}},
  {layout: 'statement', title: heading, design: {titleAlignment: 'center'}},
  {layout: 'statement', title: heading, design: {titleAlignment: 'start'}},
  {title: 'Right-aligned body', design: {titleAlignment: 'end', contentAlignment: 'end'}, blocks: [{text: body}]},
  {layout: 'statement', title: ['Scale the ', {text: 'pilot', bold: true}, ' to four teams in January.'], design: {titleAlignment: 'end'}},
]};
const attrs = node => Object.fromEntries([...node.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, name, value]) => [name, value]));
const lineNodes = (svg, path) => [...svg.matchAll(/<text\b([^>]*)>([^<]*)<\/text>/g)].map(([, raw, text]) => ({...attrs(raw), text})).filter(node => node['data-opf-path'] === path);
const near = (a, b, message, tolerance = .01) => assert.ok(Math.abs(a - b) <= tolerance, `${message}: ${a} against ${b}`);
let cases = 0;

// Measured (core placed every line): the drawn anchor is the placed text's anchor; its glyphs share the other lines' anchor.
{
  const resolved = resolvePresentation(deck, {fonts});
  for (const [slide, factor, anchor] of [[0, 1, 'end'], [1, .5, 'middle']]) {
    const svg = toSvg(deck, slide + 1, {fonts, trace: true}), path = `slides.${slide}.title`;
    const item = resolved.slides[slide].geometry.items.find(entry => entry.path === path), placed = item.text.placement.lines;
    const [first, second] = lineNodes(svg, path);
    assert.equal(first.text, 'Scale the pilot to four ', 'the first line keeps the space that hangs at its wrap');
    assert.equal(first['text-anchor'], anchor);
    assert.ok(placed[0].hang > 10, 'core records the hanging space');
    near(Number(first.textLength), placed[0].width, 'textLength still covers the text with its space');
    near(Number(first.x), placed[0].x + placed[0].width * factor, 'the drawn anchor');
    near(Number(first.x) - Number(first['data-opf-anchor-x']), placed[0].hang * factor, `the ${anchor} anchor is past the glyphs' by the hang`);
    // The glyphs of both lines share one anchor (core keeps their ink inside the box, which can move one a fraction of a pixel).
    near(Number(first['data-opf-anchor-x']), Number(second.x), 'the glyphs of the two lines are flush', .5);
    assert.equal(second['data-opf-anchor-x'], undefined, 'a line without a hanging space has no separate glyph anchor');
    cases++;
  }
  // Start aligned: both lines start on the box edge, as before.
  {
    const svg = toSvg(deck, 3, {fonts, trace: true}), [first] = lineNodes(svg, 'slides.2.title');
    const item = resolved.slides[2].geometry.items.find(entry => entry.path === 'slides.2.title');
    assert.equal(first['text-anchor'], 'start');
    assert.ok(item.text.placement.lines[0].hang > 0);
    near(Number(first.x), item.box.x, 'the hanging line starts on the box edge');
    near(Number(first.textLength), item.text.placement.lines[0].width, 'and keeps its advance');
    assert.equal(first['data-opf-anchor-x'], undefined);
    cases++;
  }
  // Body text: every wrapped line ends on the box edge by its glyphs.
  {
    const svg = toSvg(deck, 4, {fonts, trace: true}), lines = lineNodes(svg, 'slides.3.blocks.0.text');
    assert.ok(lines.length >= 3);
    const edges = lines.map(line => Number(line['data-opf-anchor-x'] ?? line.x));
    for (const edge of edges) near(edge, edges.at(-1), 'the body lines are flush', .5);
    assert.ok(lines.slice(0, -1).every(line => Number(line.x) > Number(line['data-opf-anchor-x']) + 5), 'the wrapped lines are anchored past their glyphs');
    cases++;
  }
  // Rich text: each line's runs start where core placed the line, its glyphs (not its space) ending on the edge.
  {
    const item = resolved.slides[4].geometry.items.find(entry => entry.path === 'slides.4.title'), [placed] = item.text.placement.lines;
    assert.ok(placed.hang > 0);
    near(placed.x + placed.width - placed.hang, item.text.placement.lines[1].x + item.text.placement.lines[1].width, 'rich lines are flush', .5);
    const svg = toSvg(deck, 5, {fonts, trace: true}), first = [...svg.matchAll(/<text\b([^>]*)>([^<]*)<\/text>/g)].map(([, raw, text]) => ({...attrs(raw), text})).find(node => node.text === 'Scale the ');
    near(Number(first.x), placed.x, 'the first run starts at the placed line');
    cases++;
  }
}

// Estimated widths (no fonts, nothing placed): the line is anchored past the box edge by core's estimated hang.
{
  const resolved = resolvePresentation(deck, {});
  for (const [slide, factor] of [[0, 1], [1, .5]]) {
    const path = `slides.${slide}.title`, item = resolved.slides[slide].geometry.items.find(entry => entry.path === path);
    const fit = item.text, hang = fit.sourceLines[0].hang, edge = item.box.x + item.box.width * factor;
    assert.equal(fit.placement, undefined);
    assert.ok(hang > 0);
    const [first, second] = lineNodes(toSvg(deck, slide + 1, {trace: true}), path);
    near(Number(first.x), edge + hang * factor, 'the hanging line is anchored past the edge');
    near(Number(first['data-opf-anchor-x']), edge, 'its glyph anchor is the edge');
    near(Number(second.x), edge, 'the last line is anchored on the edge');
    cases++;
  }
}
console.log(`aligned line hang: ${cases} cases`);
