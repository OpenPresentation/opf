// SH-19: the preview of OPF's own designs is what OPF's interpreter draws from the design's SmartArt layout definition, which the PPTX
// export writes and PowerPoint lays out the same way: for each OPF design the slide's composed arrangement is turned into its composite
// definition (core compositeLayoutDefinition, the tables of its recipe), evaluated (core evaluateLayoutDefinition), and every node the
// SVG draws sits at the interpreter's box, within 0.01 px.
import assert from 'node:assert/strict';
import {gallery} from '@openpresentation/gallery';
import {compositeLayoutDefinition, evaluateLayoutDefinition, layoutArrangement, opfLayoutGeometry} from '@openpresentation/opf/composition';
import {toSvg} from '../src/svg.js';
import {composeSlide} from '@openpresentation/opf/composition';

const catalogs = [gallery];
const long = ['Why we exist and who we serve', 'The few goals that matter this year', 'How teams plan, decide and ship', 'The reviews that keep plans honest', 'Data everyone can see and trust'];
const slides = [
  {layout: 'cycle', title: 'The loop', items: long.slice(0, 5)},
  {layout: 'pyramid', title: 'Levels', items: long.slice(0, 4)},
  {layout: 'matrix', title: 'Four', items: long.slice(0, 4)},
  {layout: 'matrix', title: 'Three', items: long.slice(0, 3)},
  {layout: 'flow', title: 'Steps', items: long.slice(0, 4)},
  {layout: 'chevrons', title: 'Stages', items: long.slice(0, 5)},
  {layout: 'vertical-flow', title: 'Steps', items: long.slice(0, 4)},
];
const number = value => Number(value);
let checked = 0;
for (const [index, slide] of slides.entries()) {
  const arrangement = composeSlide(slide, {layout: gallery.layouts[slide.layout]}).arrangements?.[0];
  assert.ok(arrangement?.layout, `${slide.layout}: OPF's design with its recipe (${arrangement?.design})`);
  const count = arrangement.nodes.length, frame = arrangement.frame;
  const definition = compositeLayoutDefinition({uniqueId: 'urn:openpresentation.org/smartart/layout/test', title: 'T', description: 'D', category: 'other'}, frame, 8,
    k => k === count ? {nodes: arrangement.nodes, arrows: arrangement.arrows ?? []} : opfLayoutGeometry(arrangement.layout, k), {node: 'node1', text: arrangement.text, margins: [.2, .2, .2, .2], fontSize: 24});
  assert.equal(definition.reason, undefined, `${slide.layout}: ${definition.reason}`);
  const drawn = layoutArrangement(evaluateLayoutDefinition(definition, frame, count));
  const svg = toSvg({slides: [slide]}, 1, {catalogs, trace: true});
  const group = new RegExp(`<g [^>]*data-opf-arrangement="${slide.layout}"[^>]*>([\\s\\S]*?)</g>`).exec(svg)?.[1];
  assert.ok(group, `${slide.layout}: the preview draws the arrangement`);
  // Each node's shape: a rect (x, y, width, height) or a path whose bounds are the node's box.
  const shapes = [...group.matchAll(/<(rect|path) [^>]*data-opf-arrangement-path="[^"]*\.items\.(\d)"[^>]*>/g)].map(([tag, kind, entry]) => {
    if (kind === 'rect') { const attr = name => number(new RegExp(`\\s${name}="([^"]+)"`).exec(tag)[1]); return {entry: Number(entry), box: {x: attr('x'), y: attr('y'), width: attr('width'), height: attr('height')}}; }
    const points = [...(/\sd="([^"]+)"/.exec(tag)[1].matchAll(/(-?[\d.]+)[ ,](-?[\d.]+)/g))].map(match => [Number(match[1]), Number(match[2])]);
    const xs = points.map(point => point[0]), ys = points.map(point => point[1]);
    return {entry: Number(entry), box: {x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys)}};
  });
  assert.equal(shapes.length, count, `${slide.layout}: a shape per entry`);
  for (const shape of shapes) {
    const node = drawn.nodes[shape.entry];
    for (const key of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(shape.box[key] - node.box[key]) <= .01, `${slide.layout} ${index} entry ${shape.entry}: ${key} ${shape.box[key]} is not the interpreter's ${node.box[key]}`);
    checked += 1;
  }
  assert.equal(drawn.arrows.length, arrangement.arrows?.length ?? 0, `${slide.layout}: the arrows`);
}
console.log(`SH-19 OPF layouts passed: the preview of ${slides.length} OPF designs (${checked} nodes) is the interpreter's drawing of each design's layout definition.`);
