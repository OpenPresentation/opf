// SH-07: native Mermaid diagrams in PowerPoint (`diagrams: "shapes"`). The converter (src/diagram-shapes.js) turns the drawing the preview
// shows (core paintDiagram with pele's classes) into native shapes: presets where pele's outline is exactly one (checked against SH-01's
// geometry), custom geometry otherwise, flattened transforms, a:ln with the dash, cap and join, gradients, real text at pele's baselines,
// node labels as their shape's own text, straight edges as connectors glued to node sites and every other edge as its exact path with its
// arrowheads. A family in core's DIAGRAM_SHAPE_FAMILIES exports as one p:grpSp with the diagram's alt text and OPF_DIAGRAM_V1, so import
// reads the Mermaid source back; any other diagram stays a picture and reports diagram-shapes-unavailable.
import assert from 'node:assert/strict';
import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';
import {DIAGRAM_SHAPE_FAMILIES} from '@openpresentation/opf/composition';
import {DIAGRAM_BASELINE_SHARE, diagramShapes, parsePath, parseTransform, writeDiagramGroups} from '../dist/diagram-shapes.js';
import {fromPptx, toPptx} from './helpers/default-catalog.mjs';

const FIXED = {seed: 1, timestamp: '2026-01-01T00:00:00Z', zipDate: '2026-01-01T00:00:00Z'};
const EMU = 9525;
let checked = 0;
const measure = (text, size) => text.length * size * 0.5;
const font = (family, bold, italic) => ({fontFace: family, bold, italic});
const convert = (body, {box = {x: 100, y: 50, width: 200, height: 100}, viewBox = '0 0 200 100'} = {}) =>
  diagramShapes(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" font-family="Aptos, sans-serif" font-size="16" fill="#1F1F1F">${body}</svg>`, {box, name: 'OPF diagram 1', alt: '', measure, font, lang: 'en-US'});
const shapes = xml => [...xml.matchAll(/<p:(sp|cxnSp)>[\s\S]*?<\/p:\1>/g)].map(([part, kind]) => ({
  kind, part, name: /name="([^"]+)"/.exec(part)?.[1], preset: /<a:prstGeom prst="(\w+)"/.exec(part)?.[1], custom: part.includes('<a:custGeom>'),
  off: /<a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"/.exec(part)?.slice(1).map(value => Number(value) / EMU),
  text: [...part.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(match => match[1]),
}));
const near = (actual, expected, label, tolerance = 0.01) => assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} vs ${expected}`);

// ---- 1. Primitives: presets where the outline is exactly one, custom geometry otherwise, at the drawing's place on the slide.
{
  const result = convert(`
    <rect x="10" y="10" width="40" height="20" fill="#336699" stroke="#112233" stroke-width="2"/>
    <rect x="60" y="10" width="40" height="20" rx="5" fill="#336699"/>
    <rect x="110" y="10" width="40" height="20" rx="5" ry="2" fill="#336699"/>
    <circle cx="20" cy="60" r="10" fill="#FF0000" fill-opacity="0.5"/>
    <ellipse cx="60" cy="60" rx="15" ry="8" fill="#00FF00"/>
    <polygon points="100,45 115,60 100,75 85,60" fill="#0000FF"/>
    <polygon points="130,60 135,50 150,50 155,60 150,70 135,70" fill="#0000FF"/>
    <polygon points="160,50 190,55 170,75" fill="#0000FF"/>
    <path d="M10 90 h30 a5 5 0 0 1 5 5" fill="none" stroke="#000000" stroke-dasharray="4 2" stroke-linecap="round" stroke-linejoin="round"/>
    <line x1="150" y1="90" x2="190" y2="90" stroke="#000000"/>`);
  assert.equal(result.unsupported, undefined);
  const list = shapes(result.xml);
  assert.deepEqual(list.map(shape => shape.preset ?? (shape.custom ? 'custom' : '?')), ['rect', 'roundRect', 'custom', 'ellipse', 'ellipse', 'diamond', 'hexagon', 'custom', 'custom', 'custom']);
  // The viewBox (200 x 100) fills the box (200 x 100 at 100, 50): one unit is one pixel, offset by the box.
  near(list[0].off[0], 110, 'rect x'); near(list[0].off[1], 60, 'rect y'); near(list[0].off[2], 40, 'rect width'); near(list[0].off[3], 20, 'rect height');
  assert.match(list[0].part, /<a:ln w="19050" cap="flat"[\s\S]*?<a:srgbClr val="112233"\/?>[\s\S]*?<a:miter lim="400000"\/>/, 'the stroke as a:ln with SVG defaults');
  assert.match(list[1].part, /<a:gd name="adj" fmla="val 25000"\/>/, 'rx 5 on a 20 px tall rectangle is a quarter of the short side');
  assert.match(list[3].part, /<a:srgbClr val="FF0000"><a:alpha val="50000"\/><\/a:srgbClr>/, 'fill-opacity as a:alpha');
  assert.match(list[6].part, /<a:gd name="adj" fmla="val 25000"\/>/, 'the hexagon fitted to its inset');
  assert.match(list[8].part, /<a:cubicBezTo>/, 'an arc becomes cubic Béziers');
  // A round-capped dash of 4 and gap 2 at width 1: SVG caps reach half a width past each end, so the written dash is one width longer.
  assert.match(list[8].part, /cap="rnd"[\s\S]*<a:custDash><a:ds d="500000" sp="100000"\/><\/a:custDash><a:round\/>/);
  assert.match(list[8].part, /<a:path w="\d+" h="\d+" fill="none"|<a:noFill\/>/, 'an unfilled path has no fill');
  checked++;
}

// ---- 2. Transforms are flattened: nested translate, scale and rotate, and a nested svg viewport; a rotated preset keeps a:xfrm rot.
{
  assert.deepEqual(parseTransform('translate(10,20) scale(2)'), [2, 0, 0, 2, 10, 20]);
  const turned = parseTransform('rotate(90 10 10)').map(value => Math.round(value * 1e6) / 1e6);
  assert.deepEqual(turned, [0, 1, -1, 0, 20, 0]);
  assert.deepEqual(parsePath('M0 0l10 0v5H0z').map(segment => segment[0]), ['M', 'L', 'L', 'L', 'Z']);
  const result = convert(`<g transform="translate(50,20)"><g transform="rotate(90)"><rect x="0" y="0" width="20" height="10" fill="#000"/></g></g>
    <svg x="100" y="0" width="48" height="48" viewBox="0 0 24 24"><rect x="0" y="0" width="12" height="12" fill="#000"/></svg>`);
  const [rotated, nested] = shapes(result.xml);
  assert.equal(rotated.preset, 'rect');
  assert.match(rotated.part, /<a:xfrm rot="5400000">/, 'a quarter turn');
  // The rectangle 20 x 10 turned about (50, 20): its center is at (45, 30) in the drawing, (145, 80) on the slide.
  near(rotated.off[0] + rotated.off[2] / 2, 145, 'rotated center x'); near(rotated.off[1] + rotated.off[3] / 2, 80, 'rotated center y');
  near(nested.off[0], 200, 'nested viewport x'); near(nested.off[2], 24, 'nested viewport scale');
  checked++;
}

// ---- 3. Text: each line at pele's baseline (PowerPoint puts the first baseline of exactly spaced lines three quarters of the pitch below
// the top), its anchor as the alignment, its runs with their size, weight, style and color; no wrap, no autofit.
{
  const result = convert(`<text x="100" y="40" text-anchor="middle" font-size="20" font-weight="bold" fill="#FF0000">Hi <tspan font-style="italic" fill="#00FF00">there</tspan></text>
    <text text-anchor="start" xml:space="preserve"><tspan x="10" y="70">First line</tspan><tspan x="10" y="95">Second line</tspan></text>`);
  const [title, lines] = shapes(result.xml);
  assert.match(title.part, /<a:bodyPr wrap="none" lIns="0" tIns="0" rIns="0" bIns="0"[^>]*anchor="t"[^>]*><a:noAutofit\/>/);
  assert.match(title.part, /algn="ctr"/);
  assert.match(title.part, /<a:rPr lang="en-US" sz="1500" b="1" i="0"[^>]*><a:solidFill><a:srgbClr val="FF0000"\/?>/);
  assert.match(title.part, /<a:rPr lang="en-US" sz="1500" b="1" i="1"[^>]*><a:solidFill><a:srgbClr val="00FF00"\/?>/);
  assert.deepEqual(title.text, ['Hi ', 'there']);
  const pitch = Number(/spcPts val="(\d+)"/.exec(title.part)[1]) / 75;
  near(title.off[1] + DIAGRAM_BASELINE_SHARE * pitch, 50 + 40, 'the first baseline is pele\'s', 0.02);
  // Two lines 25 px apart at 16 px: one body, the pitch the lines' own, both baselines in place.
  assert.equal((lines.part.match(/<a:p>/g) ?? []).length, 2);
  assert.equal(Number(/spcPts val="(\d+)"/.exec(lines.part)[1]), 25 * 75);
  near(lines.off[1] + DIAGRAM_BASELINE_SHARE * 25, 50 + 70, 'two lines: the first baseline', 0.02);
  assert.match(lines.part, /algn="l"/);
  near(lines.off[0], 110, 'a start-anchored body starts at the anchor');
  checked++;
}

// ---- 4. Nodes and edges: a node's label is its shape's own text; a straight edge without arrowheads is a straightConnector1 glued to the
// node sites its ends touch; an edge with an arrowhead is one custom shape of its line and its arrowhead.
{
  const result = convert(`
    <g class="pele-edges" fill="none" stroke="#999999">
      <g class="pele-edge" data-id="AB"><path d="M40,30L120,30"/></g>
      <g class="pele-edge" data-id="BC"><path d="M160,30C170,30 170,70 172,70"/><path class="pele-marker" d="M180,70L172,73L172,67Z" fill="#999999" stroke="none"/></g>
    </g>
    <g class="pele-nodes">
      <g class="pele-node" data-id="A" transform="translate(20,30)"><rect x="-20" y="-15" width="40" height="30" fill="#EEEEEE" stroke="#333333"/><text class="pele-label" x="0" y="5" text-anchor="middle" font-size="12">A</text></g>
      <g class="pele-node" data-id="B" transform="translate(140,30)"><polygon points="0,-20 20,0 0,20 -20,0" fill="#EEEEEE"/><text class="pele-label" x="0" y="4" text-anchor="middle" font-size="10">B</text></g>
      <g class="pele-node" data-id="C" transform="translate(190,70)"><rect x="-10" y="-10" width="20" height="20" fill="#EEEEEE"/></g>
    </g>`);
  const list = shapes(result.xml);
  const [ab, bc] = list;
  assert.equal(ab.kind, 'cxnSp');
  assert.equal(ab.preset, 'straightConnector1');
  const nodeA = list.find(shape => shape.name === 'OPF diagram 1 node A'), nodeB = list.find(shape => shape.name === 'OPF diagram 1 node B');
  const idOf = shape => /<p:cNvPr id="([^"]+)"/.exec(shape.part)[1];
  // A's right site is index 3 of rect, B's left site index 1 of diamond (SH-01's cxnLst order).
  assert.match(ab.part, new RegExp(`<a:stCxn id="${idOf(nodeA).replace(/[{}]/g, '\\$&')}" idx="3"/><a:endCxn id="${idOf(nodeB).replace(/[{}]/g, '\\$&')}" idx="1"/>`));
  assert.equal(result.connectors, 1);
  assert.equal(result.bound, 2);
  assert.equal(bc.kind, 'sp');
  assert.ok(bc.custom);
  assert.match(bc.part, /<a:path w="\d+" h="\d+" fill="none">[\s\S]*<\/a:path><a:path w="\d+" h="\d+" stroke="0">/, 'the line, then the filled arrowhead');
  assert.match(bc.part, /<a:solidFill><a:srgbClr val="999999"\/?>[\s\S]*<a:ln /, 'the arrowhead fill and the line');
  assert.deepEqual(nodeA.text, ['A']);
  assert.equal(nodeB.preset, 'diamond');
  assert.deepEqual(nodeB.text, ['B'], 'the label is the node\'s own text');
  // The diamond's text rectangle is its inner quarter: the label's insets count from there.
  const ins = /tIns="(\d+)"/.exec(nodeB.part)[1] / EMU;
  near(nodeB.off[1] + nodeB.off[3] / 4 + ins + DIAGRAM_BASELINE_SHARE * Number(/spcPts val="(\d+)"/.exec(nodeB.part)[1]) / 75, 50 + 34, 'the node label baseline', 0.02);
  assert.equal(list.filter(shape => shape.name?.includes(' text ')).length, 0, 'no separate text boxes for the labels');
  checked++;
}

// ---- 5. Gradients become a:gradFill with the stops on the shape's box; what has no native form keeps the diagram a picture.
{
  const result = convert(`<defs><linearGradient id="g" gradientUnits="userSpaceOnUse" x1="0" x2="200"><stop offset="0" stop-color="#000000"/><stop offset="1" stop-color="#FFFFFF"/></linearGradient></defs>
    <rect x="50" y="0" width="100" height="50" fill="url(#g)"/>`);
  const [shape] = shapes(result.xml);
  // The gradient runs over 0..200; the box covers 50..150: its ends are a quarter and three quarters of the way.
  assert.match(shape.part, /<a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:srgbClr val="404040"\/?>[\s\S]*<a:gs pos="100000"><a:srgbClr val="BFBFBF"\/?>[\s\S]*<a:lin ang="0" scaled="0"\/>/);
  for (const [markup, reason] of [
    ['<clipPath id="c"><rect width="5" height="5"/></clipPath>', /clip path/],
    ['<rect width="5" height="5" filter="url(#f)"/>', /filter/],
    ['<image href="x.png" width="5" height="5"/>', /image/],
    ['<text x="0" y="10">שלום</text>', /right-to-left/],
  ]) assert.match(convert(markup).unsupported, reason);
  checked++;
}

// ---- 6. The export: by default a family in DIAGRAM_SHAPE_FAMILIES is one named group with its alt text, its shapes and OPF_DIAGRAM_V1;
// diagrams: "picture" opts out; a family that has not passed, and a drawing with no native form, stay pictures and say why.
const FLOW = {source: 'flowchart LR\n  A[Request] --> B{Approved?}\n  B -->|yes| C[Build]\n  B -->|no| D[Revise]\n  D --> A', alt: 'A request is approved or revised.'};
const deck = {name: 'Native diagrams', slides: [{title: 'Review', diagram: FLOW}, {diagram: 'info'}, {diagram: 'flowchart LR\n  A[שלום] --> B[עולם]'}]};
assert.equal(DIAGRAM_SHAPE_FAMILIES.length, 32);
for (const family of ['flowchart', 'sequence', 'class', 'state', 'er', 'gantt', 'pie', 'mindmap', 'sankey', 'wardley', 'agentflow']) assert.ok(DIAGRAM_SHAPE_FAMILIES.includes(family), family);
assert.ok(!DIAGRAM_SHAPE_FAMILIES.includes('info'));
await assert.rejects(toPptx(deck, {...FIXED, diagrams: 'native'}), error => error.code === 'invalid-diagrams-option');
const diagnostics = [];
const bytes = await toPptx(deck, {...FIXED, onDiagnostic: entry => diagnostics.push(entry)});
const entries = unzipSync(bytes);
{
  const xml = strFromU8(entries['ppt/slides/slide1.xml']);
  const group = /<p:grpSp><p:nvGrpSpPr><p:cNvPr id="(\d+)" name="OPF diagram 1" descr="A request is approved or revised."\/?>[\s\S]*?<\/p:grpSp>/.exec(xml)?.[0];
  assert.ok(group, 'one group named after the diagram, its description the alt text');
  assert.ok(!/<p:pic>/.test(xml), 'no picture');
  assert.match(group, /<p:custDataLst><p:tags r:id="[^"]+"\/><\/p:custDataLst>/, 'the group carries the diagram tag');
  const members = shapes(group);
  assert.deepEqual(members.filter(shape => /node/.test(shape.name)).map(shape => [shape.name, shape.preset, shape.text.join('')]),
    [['OPF diagram 1 node A', 'roundRect', 'Request'], ['OPF diagram 1 node B', 'diamond', 'Approved?'], ['OPF diagram 1 node C', 'roundRect', 'Build'], ['OPF diagram 1 node D', 'roundRect', 'Revise']]);
  assert.equal(members.filter(shape => /edge L_/.test(shape.name)).length, 4, 'four edges');
  const ids = [...xml.matchAll(/<p:cNvPr id="(\d+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'every shape id on the slide is unique');
  const tag = Object.entries(entries).find(([path, value]) => /^ppt\/tags\/opfDiagram\d+\.xml$/.test(path) && strFromU8(value).includes('OPF_DIAGRAM_V1'));
  assert.ok(tag, 'OPF_DIAGRAM_V1');
  // Shapes are the default (the export above passes no option); diagrams: "picture" writes the picture as before, with no finding.
  const pictureReports = [];
  const picture = strFromU8(unzipSync(await toPptx({slides: [{diagram: FLOW}]}, {...FIXED, diagrams: 'picture', onDiagnostic: entry => pictureReports.push(entry)}))['ppt/slides/slide1.xml']);
  assert.match(picture, /<p:pic>[\s\S]*name="OPF diagram 1"/);
  assert.ok(!/<p:grpSp>/.test(picture));
  assert.deepEqual(pictureReports.filter(entry => entry.code === 'diagram-shapes-unavailable'), []);
  const unavailable = diagnostics.filter(entry => entry.code === 'diagram-shapes-unavailable');
  assert.deepEqual(unavailable.map(entry => [entry.path, entry.family]), [['slides.1.diagram', 'info'], ['slides.2.diagram', 'flowchart']]);
  assert.match(unavailable[0].message, /not passed the comparison with the preview/);
  assert.match(unavailable[1].message, /right-to-left text/);
  for (const index of [2, 3]) assert.match(strFromU8(entries[`ppt/slides/slide${index}.xml`]), /<p:pic>[\s\S]*name="OPF diagram \d+"/, `slide ${index}: still a picture`);
  checked++;
}

// ---- 7. Import: the unchanged group is the diagram again (source and alt); an edited group, or one without the tag, imports as its shapes.
{
  const roundTrip = await fromPptx(bytes);
  assert.deepEqual(roundTrip.slides[0].diagram ?? roundTrip.slides[0].blocks?.find(block => block.diagram)?.diagram, FLOW);
  const edited = {...entries};
  edited['ppt/slides/slide1.xml'] = strToU8(strFromU8(entries['ppt/slides/slide1.xml']).replace('<a:t>Build</a:t>', '<a:t>Ship</a:t>'));
  const reports = [];
  const imported = await fromPptx(zipSync(edited), {onDiagnostic: entry => reports.push(entry)});
  assert.ok(reports.some(entry => entry.code === 'invalid-diagram-provenance'), 'an edited group reports invalid-diagram-provenance');
  const first = imported.slides[0];
  assert.ok(!first.diagram && !first.blocks?.some(block => block.diagram), 'an edited group is not the diagram');
  assert.ok(JSON.stringify(first).includes('Ship'), 'its shapes keep the edit');
  const untagged = await fromPptx(await toPptx({slides: [{diagram: FLOW}]}, {...FIXED, diagrams: 'shapes', provenance: false}));
  assert.ok(!untagged.slides[0].diagram && !untagged.slides[0].blocks?.some(block => block.diagram), 'without the tag the shapes are content');
  checked++;
}

// ---- 8. writeDiagramGroups numbers the group's shapes after the slide's own.
{
  const xml = '<p:spTree><p:sp><p:nvSpPr><p:cNvPr id="7" name="Title"/></p:nvSpPr></p:sp><p:sp><p:nvSpPr><p:cNvPr id="8" name="OPF diagram 1"/></p:nvSpPr></p:sp></p:spTree>';
  const written = writeDiagramGroups(xml, new Map([['OPF diagram 1', {xml: '<p:sp><p:nvSpPr><p:cNvPr id="{{id:1}}" name="x"/></p:nvSpPr></p:sp>', ids: 2, box: {x: 0, y: 0, width: 10, height: 10}, alt: 'Alt'}]]));
  assert.match(written, /<p:grpSp><p:nvGrpSpPr><p:cNvPr id="9" name="OPF diagram 1" descr="Alt"\/>[\s\S]*<p:cNvPr id="10" name="x"\/>/);
  assert.match(written, /<a:off x="0" y="0"\/><a:ext cx="95250" cy="95250"\/><a:chOff x="0" y="0"\/><a:chExt cx="95250" cy="95250"\/>/);
  checked++;
}

console.log(`SH-07 checks passed (${checked}): presets and custom geometry, flattened transforms, paint, text at pele's baselines, node labels, glued straight connectors, gradients, the picture fallback with its finding, the tagged group and its round trip.`);
