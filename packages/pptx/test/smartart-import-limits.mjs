// RR-105: a SmartArt data model is untrusted input. Import reads each point once (a point that two parents reach, or a connection back to
// an ancestor, is placed under its first parent and reported), reads the outline as a tree at most SMART_ART_LIMITS deep and long (past
// that, a flat list with a finding), and a SmartArt part that cannot be read never fails the whole import. Hand-written parts in
// PowerPoint's form; the timing bounds are generous and only catch exponential or unbounded work.
import assert from 'node:assert/strict';
import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';
import {validate} from '@openpresentation/opf';
import {fromPptx, toPptx} from '../dist/index.js';
import {SMART_ART_LIMITS, hierarchyDiagram, outlineItems, outlineText, readSmartArtModel} from '../dist/smart-art-import.js';

const L = 'urn:microsoft.com/office/officeart/2005/8/layout/';
const DGM = 'http://schemas.openxmlformats.org/drawingml/2006/diagram', A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const DSP = 'http://schemas.microsoft.com/office/drawing/2008/diagram';
const count = roots => roots.reduce((sum, entry) => sum + 1 + count(entry.children), 0);
const depthOf = roots => roots.reduce((most, entry) => Math.max(most, 1 + depthOf(entry.children)), 0);
const timed = run => { const start = performance.now(); const value = run(); return {value, ms: performance.now() - start}; };

// A data model from points (id -> text) and parent-of connections [src, dest] in srcOrd order per parent.
function dataModel(layout, category, texts, connections, {drawingRelId} = {}) {
  const points = [`<dgm:pt modelId="doc" type="doc"><dgm:prSet loTypeId="${layout}" loCatId="${category}"/><dgm:spPr/><dgm:t><a:bodyPr/><a:p><a:endParaRPr lang="en-US"/></a:p></dgm:t></dgm:pt>`];
  for (const [id, text] of Object.entries(texts)) points.push(`<dgm:pt modelId="${id}"><dgm:prSet/><dgm:spPr/><dgm:t><a:bodyPr/><a:p><a:r><a:rPr lang="en-US"/><a:t>${text}</a:t></a:r></a:p></dgm:t></dgm:pt>`);
  const order = new Map();
  const cxns = connections.map(([src, dest], index) => {
    const at = order.get(src) ?? 0;
    order.set(src, at + 1);
    return `<dgm:cxn modelId="c${index}" srcId="${src}" destId="${dest}" srcOrd="${at}" destOrd="0"/>`;
  });
  const ext = drawingRelId ? `<dgm:extLst><a:ext uri="http://schemas.microsoft.com/office/drawing/2008/diagram"><dsp:dataModelExt xmlns:dsp="${DSP}" relId="${drawingRelId}" minVer="http://schemas.openxmlformats.org/drawingml/2006/diagram"/></a:ext></dgm:extLst>` : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><dgm:dataModel xmlns:dgm="${DGM}" xmlns:a="${A}"><dgm:ptLst>${points.join('')}</dgm:ptLst><dgm:cxnLst>${cxns.join('')}</dgm:cxnLst><dgm:bg/><dgm:whole/>${ext}</dgm:dataModel>`;
}
// k diamonds in a chain: j0 -> a0, b0 -> j1 -> a1, b1 -> j2 ... (every j after the first has two parents).
function diamonds(k, layout = `${L}orgChart1`) {
  const texts = {j0: 'j0'}, connections = [['doc', 'j0']];
  for (let i = 0; i < k; i++) {
    Object.assign(texts, {[`a${i}`]: `a${i}`, [`b${i}`]: `b${i}`, [`j${i + 1}`]: `j${i + 1}`});
    connections.push([`j${i}`, `a${i}`], [`j${i}`, `b${i}`], [`a${i}`, `j${i + 1}`], [`b${i}`, `j${i + 1}`]);
  }
  return dataModel(layout, 'hierarchy', texts, connections);
}
// A parent-of chain n points deep below the doc point.
function chain(n, layout = `${L}hierarchy1`) {
  const texts = {}, connections = [];
  for (let i = 0; i < n; i++) { texts[`p${i}`] = `Level ${i}`; connections.push([i ? `p${i - 1}` : 'doc', `p${i}`]); }
  return dataModel(layout, 'hierarchy', texts, connections);
}

// 1. Shared points: each imported once, under its first parent; the further parents counted. 30 diamonds (2^30 paths) read at once.
{
  const small = readSmartArtModel(diamonds(2));
  assert.equal(outlineText(small.roots), 'j0\n  a0\n    j1\n      a1\n        j2\n      b1\n  b0', 'j1 and j2 are under their first parent only');
  assert.equal(small.sharedConnections, 2);
  assert.equal(small.limited, undefined);
  for (const k of [18, 30]) {
    const {value: model, ms} = timed(() => readSmartArtModel(diamonds(k)));
    assert.equal(count(model.roots), 3 * k + 1, `${k} diamonds: one entry per point`);
    assert.equal(model.sharedConnections, k);
    assert.ok(ms < 2000, `${k} diamonds read in ${Math.round(ms)} ms`);
    assert.equal(hierarchyDiagram(model.roots, 'TD', 'Organization chart').source.split('\n').filter(line => line.includes('["')).length, 3 * k + 1);
  }
  // A connection back to an ancestor (a cycle) and a point's own parent loop end at once.
  const cycle = readSmartArtModel(dataModel(`${L}hierarchy1`, 'hierarchy', {a: 'A', b: 'B'}, [['doc', 'a'], ['a', 'b'], ['b', 'a'], ['b', 'b']]));
  assert.equal(outlineText(cycle.roots), 'A\n  B');
  assert.equal(cycle.sharedConnections, 2);
}

// 2. The depth limit: SMART_ART_LIMITS.depth points nest as a tree; one more, or 5,000 (a stack overflow before), is a flat list.
{
  assert.deepEqual(SMART_ART_LIMITS, {depth: 64, entries: 10000});
  const deepest = readSmartArtModel(chain(SMART_ART_LIMITS.depth));
  assert.equal(deepest.limited, undefined);
  assert.equal(depthOf(deepest.roots), SMART_ART_LIMITS.depth);
  const over = readSmartArtModel(chain(SMART_ART_LIMITS.depth + 1));
  assert.equal(over.limited, 'depth');
  assert.equal(over.roots.length, SMART_ART_LIMITS.depth + 1, 'every entry is kept, flat');
  assert.equal(depthOf(over.roots), 1);
  const {value: deep, ms} = timed(() => readSmartArtModel(chain(5000)));
  assert.equal(deep.limited, 'depth');
  assert.equal(deep.omitted, 0);
  assert.deepEqual(deep.roots.slice(0, 2).map(entry => entry.runs[0].text), ['Level 0', 'Level 1'], 'in the part\'s order');
  assert.equal(outlineItems(deep.roots).length, 5000);
  assert.deepEqual(deep.dropped, [], 'no entry is reported unreached: the flat list holds them');
  assert.ok(ms < 5000, `5,000 levels read in ${Math.round(ms)} ms`);
}

// 3. The entry limit: more than SMART_ART_LIMITS.entries entries is the first SMART_ART_LIMITS.entries, flat, the rest counted.
{
  const texts = {}, connections = [];
  for (let i = 0; i < SMART_ART_LIMITS.entries + 500; i++) { texts[`n${i}`] = `Entry ${i}`; connections.push(['doc', `n${i}`]); }
  const model = readSmartArtModel(dataModel(`${L}vList2`, 'list', texts, connections));
  assert.equal(model.limited, 'entries');
  assert.equal(model.roots.length, SMART_ART_LIMITS.entries);
  assert.equal(model.omitted, 500);
}

// 4. Whole files: the SmartArt frames on the slides of an exported deck, as a PowerPoint user's file.
const DIAGRAM_RELS = {data: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/diagramData', drawing: 'http://schemas.microsoft.com/office/2007/relationships/diagramDrawing'};
const TYPES = {data: 'application/vnd.openxmlformats-officedocument.drawingml.diagramData+xml', drawing: 'application/vnd.ms-office.drawingml.diagramDrawing+xml'};
async function withSmartArt(frames) {
  const deck = {slides: frames.map((_, index) => ({title: `SmartArt ${index + 1}`}))};
  const entries = unzipSync(new Uint8Array(await toPptx(deck, {seed: 105, timestamp: '2026-11-12T00:00:00Z', zipDate: '2026-11-12T00:00:00Z', provenance: false})));
  let types = strFromU8(entries['[Content_Types].xml']);
  frames.forEach(({data, drawing}, index) => {
    const number = index + 1, slide = `ppt/slides/slide${number}.xml`, rels = `ppt/slides/_rels/slide${number}.xml.rels`;
    entries[`ppt/diagrams/data${number}.xml`] = strToU8(data);
    types = types.replace('</Types>', `<Override PartName="/ppt/diagrams/data${number}.xml" ContentType="${TYPES.data}"/></Types>`);
    let relationships = strFromU8(entries[rels]).replace('</Relationships>', `<Relationship Id="rId90" Type="${DIAGRAM_RELS.data}" Target="../diagrams/data${number}.xml"/></Relationships>`);
    if (drawing) {
      entries[`ppt/diagrams/drawing${number}.xml`] = strToU8(drawing);
      types = types.replace('</Types>', `<Override PartName="/ppt/diagrams/drawing${number}.xml" ContentType="${TYPES.drawing}"/></Types>`);
      relationships = relationships.replace('</Relationships>', `<Relationship Id="rId9" Type="${DIAGRAM_RELS.drawing}" Target="../diagrams/drawing${number}.xml"/></Relationships>`);
    }
    entries[rels] = strToU8(relationships);
    const frame = `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="90" name="Diagram ${number}"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="609600" y="1600200"/><a:ext cx="5000000" cy="4200000"/></p:xfrm><a:graphic><a:graphicData uri="${DGM}"><dgm:relIds xmlns:dgm="${DGM}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:dm="rId90" r:lo="" r:qs="" r:cs=""/></a:graphicData></a:graphic></p:graphicFrame>`;
    entries[slide] = strToU8(strFromU8(entries[slide]).replace('</p:spTree>', `${frame}</p:spTree>`));
  });
  entries['[Content_Types].xml'] = strToU8(types);
  for (const path of Object.keys(entries).filter(name => /^ppt\/(slides|slideLayouts|slideMasters)\/[^/]+\.xml$|^ppt\/presentation\.xml$/.test(name)))
    entries[path] = strToU8(strFromU8(entries[path]).replace(/<p:custDataLst>[\s\S]*?<\/p:custDataLst>/g, ''));
  const diagnostics = [];
  const imported = await fromPptx(zipSync(entries), {onDiagnostic: diagnostic => diagnostics.push(diagnostic)});
  return {imported, diagnostics};
}
// A radial drawing (no OPF arrangement: imported as overlay shapes) whose one shape is nested deeper than the shape reader's XML parser
// allows (but within the archive's own XML depth limit, which rejects the file with an OPF error).
const nested = levels => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><dsp:drawing xmlns:dsp="${DSP}" xmlns:a="${A}"><dsp:spTree><dsp:nvGrpSpPr><dsp:cNvPr id="0" name=""/><dsp:cNvGrpSpPr/></dsp:nvGrpSpPr><dsp:grpSpPr/>${'<dsp:grpSp><dsp:nvGrpSpPr><dsp:cNvPr id="0" name=""/><dsp:cNvGrpSpPr/></dsp:nvGrpSpPr><dsp:grpSpPr/>'.repeat(levels)}<dsp:sp modelId="{s}"><dsp:nvSpPr><dsp:cNvPr id="0" name=""/><dsp:cNvSpPr/></dsp:nvSpPr><dsp:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1000000" cy="1000000"/></a:xfrm><a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom></dsp:spPr><dsp:txBody><a:bodyPr/><a:p><a:r><a:t>Hub</a:t></a:r></a:p></dsp:txBody></dsp:sp>${'</dsp:grpSp>'.repeat(levels)}</dsp:spTree></dsp:drawing>`;
{
  const start = performance.now();
  const {imported, diagnostics} = await withSmartArt([
    {data: diamonds(30, `${L}hierarchy2`)},
    {data: chain(3000)},
    {data: dataModel(`${L}radial1`, 'cycle', {hub: 'Hub', spoke: 'Spoke'}, [['doc', 'hub'], ['hub', 'spoke']], {drawingRelId: 'rId9'}), drawing: nested(120)},
    {data: `<dgm:dataModel xmlns:dgm="${DGM}">${'<dgm:x>'.repeat(200)}${'</dgm:x>'.repeat(200)}</dgm:dataModel>`},
  ]);
  assert.ok(performance.now() - start < 20000, 'the file imports in bounded time');
  assert.equal(validate(imported).valid, true, JSON.stringify(validate(imported).errors?.slice(0, 3)));
  assert.equal(imported.slides.length, 4, 'every slide imports');
  const blocks = slide => slide.blocks ?? (slide.items ? [{items: slide.items}] : slide.diagram ? [{diagram: slide.diagram}] : []);
  const [org, deep, radial, garbage] = imported.slides;
  const flowchart = blocks(org).find(block => block.diagram)?.diagram;
  assert.ok(flowchart, 'the shared-point organization chart is a Mermaid flowchart');
  assert.equal(flowchart.source.split('\n').filter(line => line.includes('["')).length, 91, 'one node per point');
  const items = blocks(deep).find(block => block.items)?.items;
  assert.equal(items?.length, 3000, 'the 3,000-level chain is a flat list of its entries');
  assert.equal(items[0], 'Level 0');
  assert.equal(deep.layout, 'default:list');
  assert.equal(JSON.stringify(radial).includes('Hub'), false, 'the unreadable drawing adds no shapes');
  assert.equal(garbage.title, 'SmartArt 4');
  const of = code => diagnostics.filter(item => item.code === code).map(item => item.path);
  assert.deepEqual(of('smartart-connection-dropped'), ['slides.0']);
  assert.match(diagnostics.find(item => item.code === 'smartart-connection-dropped').message, /30 connections to an entry that already has a parent/);
  assert.deepEqual(diagnostics.filter(item => item.code === 'smartart-limited').map(item => [item.path, item.limit]), [['slides.1', 'depth']]);
  assert.deepEqual(of('smartart-unreadable'), ['slides.2']);
}

console.log('SmartArt import limits: shared points once, 30 diamonds and 5,000 levels at once, the entry limit, unreadable parts never fail the import.');
