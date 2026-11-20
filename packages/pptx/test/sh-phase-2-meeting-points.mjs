// Shapes phase 2 integration: where SH-04 (overlay shapes and connectors), SH-05 (PPTX shape import) and SH-07 (native Mermaid
// diagrams) meet in the PPTX package.
// 1. A diagram written as shapes imports back as its diagram, also with its glued straight edges (p:cxnSp) and next to SH-04
//    overlays in front of and behind it; none of its members become SH-05 overlay shapes or connectors.
// 2. An edited diagram group falls back to SH-05's shapes and reports it (invalid-diagram-provenance).
// 3. SH-07's glued edges and SH-04's connectors are one writer's p:cxnSp: the same element shape, glued by native ids and core's sites.
import assert from 'node:assert/strict';
import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';
import {fromPptx, toPptx} from './helpers/default-catalog.mjs';

const FIXED = {seed: 1, timestamp: '2026-01-01T00:00:00Z', zipDate: '2026-01-01T00:00:00Z'};
// A straight edge without an arrowhead (A --- B) is a glued straightConnector1 (SH-07 decision 1); B --> C is custom geometry.
const FLOW = {source: 'flowchart LR\n  A[Request] --- B[Review]\n  B --> C[Build]', alt: 'A request is reviewed, then built.'};
const connectorsOf = xml => [...xml.matchAll(/<p:cxnSp>[\s\S]*?<\/p:cxnSp>/g)].map(match => match[0]);
const diagramOf = slide => slide.diagram ?? slide.blocks?.find(block => block.diagram)?.diagram;
let checked = 0;

// ---- 1. The diagram alone, then between a back-layer overlay and front overlays with a connector (both orders in the shape tree).
for (const [label, slide] of [
  ['alone', {title: 'Review', diagram: FLOW}],
  ['with overlays', {title: 'Review', blocks: [{id: 'note', text: 'Approved by the board.'}, {id: 'flow', diagram: FLOW}], shapes: [
    {shape: 'rect', layer: 'back', x: 0.02, y: 0.02, width: 0.2, height: 0.1, fill: 'accent2'},
    {id: 'badge', shape: 'ellipse', text: '1', x: 0.85, y: 0.05, width: 0.08, height: 0.12},
    {id: 'stamp', shape: 'roundRect', text: 'OK', x: 0.85, y: 0.3, width: 0.1, height: 0.08},
    {connector: {from: 'badge', to: 'stamp', route: 'straight'}}
  ]}]
]) {
  const bytes = await toPptx({slides: [slide]}, FIXED);
  const xml = strFromU8(unzipSync(bytes)['ppt/slides/slide1.xml']);
  const group = /<p:grpSp><p:nvGrpSpPr><p:cNvPr id="\d+" name="OPF diagram 1"[\s\S]*?<\/p:grpSp>/.exec(xml)?.[0];
  assert.ok(group, `${label}: the diagram is one native group`);
  assert.equal(connectorsOf(group).length, 1, `${label}: the straight edge without an arrowhead is a glued connector`);
  const reports = [];
  const back = (await fromPptx(bytes, {onDiagnostic: entry => reports.push(entry)})).slides[0];
  assert.deepEqual(diagramOf(back), FLOW, `${label}: the group imports as its Mermaid diagram`);
  assert.deepEqual(reports.filter(entry => ['invalid-diagram-provenance', 'grouped-text-reflow'].includes(entry.code)), [], `${label}: nothing to report`);
  const overlays = back.shapes ?? [];
  if (label === 'alone') assert.deepEqual(overlays, [], 'alone: no member of the diagram is an overlay shape or connector');
  else {
    assert.equal(overlays.length, 4, 'with overlays: the four overlays, and nothing of the diagram');
    assert.equal(overlays.filter(entry => entry.connector).length, 1, 'with overlays: one connector, the overlay\'s own');
    assert.equal(overlays.find(entry => !entry.connector && entry.layer === 'back')?.shape, 'rect', 'with overlays: the back shape keeps its layer');
  }
  checked++;
}

// ---- 2. An edited diagram group: its shapes, as SH-05 imports them, and the report.
{
  const bytes = await toPptx({slides: [{title: 'Review', diagram: FLOW}]}, FIXED);
  const entries = unzipSync(bytes);
  entries['ppt/slides/slide1.xml'] = strToU8(strFromU8(entries['ppt/slides/slide1.xml']).replace('<a:t>Build</a:t>', '<a:t>Ship</a:t>'));
  const reports = [];
  const back = (await fromPptx(zipSync(entries), {onDiagnostic: entry => reports.push(entry)})).slides[0];
  assert.ok(reports.some(entry => entry.code === 'invalid-diagram-provenance'), 'an edited group reports invalid-diagram-provenance');
  assert.equal(diagramOf(back), undefined, 'an edited group is not the diagram');
  const text = JSON.stringify(back);
  assert.ok(text.includes('Ship') && text.includes('Request'), 'its shapes keep their text and the edit');
  assert.ok(JSON.stringify([...(back.blocks ?? []), ...(back.shapes ?? [])]).includes('"shape"'), 'its nodes import as SH-05 shapes');
  checked++;
}

// ---- 3. One connector writer: an overlay connector and a glued diagram edge are the same p:cxnSp shape.
{
  const deck = {slides: [{title: 'Review', diagram: FLOW, shapes: [
    {id: 'a', shape: 'rect', x: 0.05, y: 0.8, width: 0.1, height: 0.1}, {id: 'b', shape: 'rect', x: 0.3, y: 0.8, width: 0.1, height: 0.1},
    {connector: {from: 'a', to: 'b'}}
  ]}]};
  const xml = strFromU8(unzipSync(await toPptx(deck, FIXED))['ppt/slides/slide1.xml']);
  const ids = new Set([...xml.matchAll(/<p:cNvPr id="(\d+)"/g)].map(match => match[1]));
  const form = cxn => cxn.replace(/"[^"]*"/g, '""').replace(/<a:ln\b[\s\S]*<\/a:ln>|<a:ln\b[^>]*\/>/, '<a:ln/>').replace(/<a:avLst>[\s\S]*?<\/a:avLst>/, '<a:avLst/>');
  const connectors = connectorsOf(xml);
  assert.equal(connectors.length, 2, 'the diagram edge and the overlay connector');
  for (const cxn of connectors) {
    for (const [, id] of cxn.matchAll(/<a:(?:stCxn|endCxn) id="(\d+)" idx="\d+"\/>/g)) assert.ok(ids.has(id), 'each end is glued to a native shape id of the slide');
    assert.match(cxn, /<a:stCxn id="\d+" idx="\d+"\/><a:endCxn id="\d+" idx="\d+"\/>/, 'both ends glued');
  }
  assert.equal(form(connectors[0]).replace('<a:effectLst/>', ''), form(connectors[1]).replace('<a:effectLst/>', ''), 'the same element shape');
  checked++;
}

console.log(`shapes phase 2 meeting points passed (${checked}): diagram groups import as diagrams beside overlays, edited groups as SH-05 shapes, one connector writer.`);
