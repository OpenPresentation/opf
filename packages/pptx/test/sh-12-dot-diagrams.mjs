// SH-12: Graphviz DOT diagrams in PowerPoint. A DOT graph is drawn by pele's layered layout as a flowchart, so the export writes it the way
// SH-07 writes a flowchart: one group of native shapes (presets where pele's outline is one), glued connectors and text, with the authored
// DOT value in OPF_DIAGRAM_V1, so import reads the DOT source back. A graph whose layout OPF does not draw is the unavailable placeholder.
import assert from 'node:assert/strict';
import {strFromU8, unzipSync} from 'fflate';
import {fromPptx, toPptx, toSvg} from './helpers/default-catalog.mjs';

const FIXED = {seed: 1, timestamp: '2026-01-01T00:00:00Z', zipDate: '2026-01-01T00:00:00Z'};
let checked = 0;
const DOT = {
  source: 'digraph review {\n  rankdir=LR\n  Request [shape=box]\n  Approved [shape=diamond, label="Approved?"]\n  Build [shape=box, style=rounded]\n  Request -> Approved\n  Approved -> Build [label="yes"]\n  Approved -> Request [label="no", style=dashed]\n  Build -> Done\n}',
  syntax: 'dot',
  alt: 'A request is approved or sent back; approved work is built.',
};
const shapes = xml => [...xml.matchAll(/<p:(sp|cxnSp)>[\s\S]*?<\/p:\1>/g)].map(([part, kind]) => ({
  kind, part, name: /name="([^"]+)"/.exec(part)?.[1], preset: /<a:prstGeom prst="(\w+)"/.exec(part)?.[1], custom: part.includes('<a:custGeom>'),
  text: [...part.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(match => match[1]).join(''),
}));

const deck = {name: 'DOT diagrams', slides: [
  {title: 'Review', diagram: DOT},
  {title: 'Undirected', blocks: [{text: 'Teams that share an on-call rotation.'}, {diagram: {source: 'graph {\n  Web -- API -- Data\n  API -- Search\n}', syntax: 'dot'}}]},
  {title: 'Refused', diagram: {source: 'graph {\n  layout=neato\n  a -- b\n}', syntax: 'dot'}},
]};
const diagnostics = [];
const bytes = await toPptx(deck, {...FIXED, onDiagnostic: entry => diagnostics.push(entry)});
const entries = unzipSync(bytes);

// ---- 1. The export: a DOT diagram is one group of native shapes, nodes as presets with their labels, edges with their labels.
{
  const xml = strFromU8(entries['ppt/slides/slide1.xml']);
  const group = /<p:grpSp><p:nvGrpSpPr><p:cNvPr id="\d+" name="OPF diagram 1" descr="A request is approved or sent back; approved work is built."\/?>[\s\S]*?<\/p:grpSp>/.exec(xml)?.[0];
  assert.ok(group, 'one group named after the diagram, its description the alt text');
  assert.ok(!/<p:pic>/.test(xml), 'no picture');
  const members = shapes(group);
  assert.deepEqual(members.filter(shape => / node /.test(shape.name)).map(shape => [shape.name, shape.preset, shape.text]), [
    ['OPF diagram 1 node Request', 'roundRect', 'Request'],
    ['OPF diagram 1 node Approved', 'diamond', 'Approved?'],
    ['OPF diagram 1 node Build', 'roundRect', 'Build'],
    // DOT's default ellipse is pele's stadium: a fully rounded rectangle.
    ['OPF diagram 1 node Done', 'roundRect', 'Done'],
  ]);
  assert.match(members.find(shape => shape.name === 'OPF diagram 1 node Done').part, /<a:gd name="adj" fmla="val 50000"\/>/, 'the stadium is rounded to half its height');
  assert.equal(members.filter(shape => / edge L_/.test(shape.name)).length, 4, 'four edges');
  assert.ok(members.some(shape => shape.text === 'yes') && members.some(shape => shape.text === 'no'), 'the edge labels are text');
  assert.match(members.find(shape => / edge /.test(shape.name) && /prstDash|custDash/.test(shape.part))?.part ?? '', /<a:(prstDash|custDash)/, 'the dashed edge keeps its dash');
  assert.deepEqual(diagnostics.filter(entry => entry.code === 'diagram-shapes-unavailable' && entry.path !== 'slides.2.diagram'), [], 'DOT diagrams are written as shapes');
  const second = strFromU8(entries['ppt/slides/slide2.xml']);
  assert.match(second, /<p:grpSp><p:nvGrpSpPr><p:cNvPr id="\d+" name="OPF diagram \d+" descr="Graph: Web, API, Data, Search"/, 'the derived alt names a graph');
  checked++;
}

// ---- 2. A layout OPF does not draw: the unavailable placeholder, as the preview draws it, and the finding at the diagram.
{
  const xml = strFromU8(entries['ppt/slides/slide3.xml']);
  assert.match(xml, /name="OPF diagram placeholder \d+"/);
  assert.match(xml, /Diagram unavailable/);
  const drawn = await toSvg(deck, 3), svg = Array.isArray(drawn) ? drawn.join('') : String(drawn);
  assert.match(svg, /Diagram unavailable/, 'the preview draws the same placeholder');
  checked++;
}

// ---- 3. Import: the unchanged group is the DOT diagram again, syntax and all; the placeholder reads back too.
{
  const roundTrip = await fromPptx(bytes);
  assert.deepEqual(roundTrip.slides[0].diagram ?? roundTrip.slides[0].blocks?.find(block => block.diagram)?.diagram, DOT);
  assert.deepEqual(roundTrip.slides[1].blocks?.find(block => block.diagram)?.diagram, deck.slides[1].blocks[1].diagram);
  assert.deepEqual(roundTrip.slides[2].diagram ?? roundTrip.slides[2].blocks?.find(block => block.diagram)?.diagram, deck.slides[2].diagram);
  checked++;
}

// ---- 4. diagrams: "picture" writes the DOT diagram as one SVG picture, which imports back as the DOT diagram.
{
  const picture = await toPptx({slides: [{diagram: DOT}]}, {...FIXED, diagrams: 'picture'});
  assert.match(strFromU8(unzipSync(picture)['ppt/slides/slide1.xml']), /<p:pic>[\s\S]*name="OPF diagram 1"/);
  const back = await fromPptx(picture);
  assert.deepEqual(back.slides[0].diagram ?? back.slides[0].blocks?.find(block => block.diagram)?.diagram, DOT);
  checked++;
}

console.log(`SH-12 checks passed (${checked}): DOT diagrams as native shapes with presets and labels, the refused layout's placeholder, and the round trip of the DOT source.`);
