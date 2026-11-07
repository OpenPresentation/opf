// SH-08: SmartArt that PowerPoint users made imports into OPF (src/smart-art-import.js). The data model's outline (the parOf tree from the
// doc point, in srcOrd order, with presentation points, transitions and placeholders as PowerPoint writes them) maps to an OPF arrangement
// for the pyramid, matrix, cycle, chevron and process families, to the list or process layout for the list and process families, to a
// Mermaid flowchart for hierarchies and organization charts, and otherwise to the drawing as overlay shapes with the outline as alt text.
// Text that none of these keeps is a finding. Hand-written ECMA-376 parts in PowerPoint's form; the PowerPoint-made fixture (built by
// fixtures/make-powerpoint-smartart.ps1 through COM) is read at the end when it is present.
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';
import {checkDiagram} from '@openpresentation/opf/composition';
import {validate} from '@openpresentation/opf';
import {fromPptx, toPptx} from './helpers/default-catalog.mjs';
import {drawingSlide, hierarchyDiagram, outlineItems, outlineText, readSmartArtModel, smartArtForm} from '../src/smart-art-import.js';

const L = 'urn:microsoft.com/office/officeart/2005/8/layout/';
const DGM = 'http://schemas.openxmlformats.org/drawingml/2006/diagram', A = 'http://schemas.openxmlformats.org/drawingml/2006/main';

// A data model as PowerPoint writes one: the doc point, every node with its parTrans and sibTrans points, presentation points tied to
// their nodes by presOf, connections in no particular order. A node: {t (string or runs XML), c (children), asst, pres (presentation
// text), edge (parTrans text), sib (sibTrans text), empty (a placeholder)}.
function dataModel(layout, category, nodes, {orphan, drawingRelId = 'rId9'} = {}) {
  const points = [], connections = [];
  let next = 0;
  const id = () => `{00000000-0000-4000-8000-${String(++next).padStart(12, '0')}}`;
  const text = value => value === undefined ? '<a:p><a:endParaRPr lang="en-US"/></a:p>' : value.startsWith('<') ? value : `<a:p><a:r><a:rPr lang="en-US" dirty="0"/><a:t>${value}</a:t></a:r></a:p>`;
  const doc = id();
  points.push(`<dgm:pt modelId="${doc}" type="doc"><dgm:prSet loTypeId="${layout}" loCatId="${category}" qsTypeId="urn:microsoft.com/office/officeart/2005/8/quickstyle/simple1" qsCatId="simple" csTypeId="urn:microsoft.com/office/officeart/2005/8/colors/accent1_2" csCatId="accent1" phldr="1"/><dgm:spPr/><dgm:t><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></dgm:t></dgm:pt>`);
  const add = (parent, list) => list.forEach((node, order) => {
    const me = id(), par = id(), sib = id(), cxn = id();
    points.push(`<dgm:pt modelId="${me}"${node.asst ? ' type="asst"' : ''}><dgm:prSet phldrT="[Text]"${node.empty ? ' phldr="1"' : ''}/><dgm:spPr/><dgm:t><a:bodyPr/><a:lstStyle/>${text(node.empty ? undefined : node.t)}</dgm:t></dgm:pt>`,
      `<dgm:pt modelId="${par}" type="parTrans" cxnId="${cxn}"><dgm:prSet/><dgm:spPr/><dgm:t><a:bodyPr/><a:lstStyle/>${text(node.edge)}</dgm:t></dgm:pt>`,
      `<dgm:pt modelId="${sib}" type="sibTrans" cxnId="${cxn}"><dgm:prSet/><dgm:spPr/><dgm:t><a:bodyPr/><a:lstStyle/>${text(node.sib)}</dgm:t></dgm:pt>`);
    connections.unshift(`<dgm:cxn modelId="${cxn}" srcId="${parent}" destId="${me}" srcOrd="${order}" destOrd="0" parTransId="${par}" sibTransId="${sib}"/>`);
    const pres = id();
    points.push(`<dgm:pt modelId="${pres}" type="pres"><dgm:prSet presAssocID="${me}" presName="node" presStyleLbl="node1" presStyleIdx="${order}" presStyleCnt="1"${node.pres ? ' custT="1"' : ''}/><dgm:spPr/>${node.pres ? `<dgm:t><a:bodyPr/><a:lstStyle/>${text(node.pres)}</dgm:t>` : ''}</dgm:pt>`);
    connections.push(`<dgm:cxn modelId="${id()}" type="presOf" srcId="${me}" destId="${pres}" srcOrd="0" destOrd="0" presId="${layout}"/>`);
    add(me, node.c ?? []);
  });
  add(doc, nodes);
  if (orphan) points.push(`<dgm:pt modelId="${id()}"><dgm:prSet/><dgm:spPr/><dgm:t><a:bodyPr/><a:lstStyle/>${text(orphan)}</dgm:t></dgm:pt>`);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><dgm:dataModel xmlns:dgm="${DGM}" xmlns:a="${A}"><dgm:ptLst>${points.join('')}</dgm:ptLst><dgm:cxnLst>${connections.join('')}</dgm:cxnLst><dgm:bg/><dgm:whole/><dgm:extLst><a:ext uri="http://schemas.microsoft.com/office/drawing/2008/diagram"><dsp:dataModelExt xmlns:dsp="http://schemas.microsoft.com/office/drawing/2008/diagram" relId="${drawingRelId}" minVer="http://schemas.openxmlformats.org/drawingml/2006/diagram"/></a:ext></dgm:extLst></dgm:dataModel>`;
}
const N = (t, c = [], extra = {}) => ({t, c, ...extra});

// 1. The data model: the outline in srcOrd order, placeholders give their place to their children, assistants, presentation text as a
// detail, line breaks, fields and run formatting; transitions, unreached nodes and loose presentation text are listed as dropped.
{
  const bold = '<a:p><a:r><a:rPr lang="en-US" b="1"/><a:t>Ana</a:t></a:r><a:r><a:rPr lang="en-US"/><a:t> Ruiz</a:t></a:r></a:p>';
  const broken = '<a:p><a:r><a:rPr lang="en-US"/><a:t>Run</a:t></a:r><a:br><a:rPr lang="en-US"/></a:br><a:r><a:rPr lang="en-US"/><a:t>the pilot</a:t></a:r></a:p>';
  const field = '<a:p><a:r><a:rPr lang="en-US"/><a:t>Slide </a:t></a:r><a:fld id="{1}" type="slidenum"><a:rPr lang="en-US"/><a:t>3</a:t></a:fld></a:p>';
  const xml = dataModel(`${L}orgChart1`, 'hierarchy', [
    N(bold, [N('Sam Lee', [], {asst: true}), N('Kai Chen', [N('Platform'), N('Apps')], {pres: 'Technology', edge: 'reports'}), N('', [N('Promoted')], {empty: true}), N(broken), N(field, [], {sib: 'next'})]),
  ], {orphan: 'Loose'});
  const model = readSmartArtModel(xml);
  assert.equal(model.layoutId, `${L}orgChart1`);
  assert.equal(model.category, 'hierarchy');
  assert.equal(model.drawingRelId, 'rId9');
  assert.deepEqual(outlineItems(model.roots), [
    [{text: 'Ana', bold: true}, {text: ' Ruiz'}],
    {text: 'Sam Lee', level: 1}, {text: 'Kai Chen', description: 'Technology', level: 1}, {text: 'Platform', level: 2}, {text: 'Apps', level: 2},
    {text: 'Promoted', level: 1}, {text: 'Run\nthe pilot', level: 1}, {text: 'Slide 3', level: 1},
  ]);
  assert.equal(model.roots[0].children[0].assistant, true);
  assert.deepEqual(model.dropped.map(({role, text, used}) => [role, text, used]), [['transition', 'reports', true], ['transition', 'next', false], ['node', 'Loose', undefined]]);
  assert.equal(outlineText(model.roots), 'Ana Ruiz\n  Sam Lee\n  Kai Chen, Technology\n    Platform\n    Apps\n  Promoted\n  Run the pilot\n  Slide 3');
  // The org chart as Mermaid: dotted to the assistant, the parent connection's text as its label, a detail on a second line.
  const diagram = hierarchyDiagram(model.roots, 'TD', 'Organization chart');
  assert.equal(diagram.source, ['flowchart TD', '  n1["Ana Ruiz"]', '  n2["Sam Lee"]', '  n1 -.-> n2', '  n3["Kai Chen<br/>Technology"]', '  n1 -->|"reports"| n3',
    '  n4["Platform"]', '  n3 --> n4', '  n5["Apps"]', '  n3 --> n5', '  n6["Promoted"]', '  n1 --> n6', '  n7["Run<br/>the pilot"]', '  n1 --> n7', '  n8["Slide 3"]', '  n1 --> n8'].join('\n'));
  assert.equal(diagram.formatted, true);
  assert.deepEqual(checkDiagram(diagram.source), {ok: true, type: 'flowchart'});
  assert.match(hierarchyDiagram([{runs: [{text: 'Say "hi" <now> #1'}], children: []}], 'LR', 'Hierarchy').source, /n1\["Say #quot;hi#quot; #lt;now#gt; #35;1"\]/);
  assert.equal(readSmartArtModel('<p:sld/>'), undefined);
}

// 2. Which OPF form: the layouts OPF writes exactly, each family by its id, then by the doc point's category.
{
  const forms = {
    [`${L}pyramid1`]: {arrangement: 'pyramid', exact: true}, [`${L}pyramid3`]: {arrangement: 'pyramid'}, [`${L}matrix1`]: {arrangement: 'matrix'},
    [`${L}cycle1`]: {arrangement: 'cycle'}, [`${L}chevron2`]: {arrangement: 'chevrons'}, [`${L}hChevron3`]: {arrangement: 'chevrons'},
    [`${L}process1`]: {arrangement: 'flow', exact: true}, [`${L}process2`]: {arrangement: 'vertical-flow', exact: true},
    [`${L}orgChart1`]: {hierarchy: 'TD'}, [`${L}hierarchy1`]: {hierarchy: 'TD'}, [`${L}hierarchy2`]: {hierarchy: 'LR'},
    'urn:microsoft.com/office/officeart/2008/layout/NameandTitleOrganizationalChart': {hierarchy: 'TD'},
    'urn:microsoft.com/office/officeart/2009/3/layout/HorizontalOrganizationChart': {hierarchy: 'LR'},
    [`${L}venn1`]: {drawing: true}, [`${L}radial1`]: {drawing: true}, [`${L}target1`]: {drawing: true},
  };
  for (const [id, form] of Object.entries(forms)) assert.deepEqual(smartArtForm(id, 'list'), form, id);
  assert.deepEqual(smartArtForm(`${L}vList2`, 'list'), {layout: 'list'});
  assert.deepEqual(smartArtForm(`${L}default`, 'list'), {layout: 'list'});
  assert.deepEqual(smartArtForm(`${L}process3`, 'process'), {layout: 'process'});
  assert.deepEqual(smartArtForm('urn:example/layout/unknown', 'relationship'), {drawing: true});
  assert.deepEqual(smartArtForm('urn:example/layout/unknown', 'hierarchy'), {hierarchy: 'TD'});
}

// A Basic Venn drawing (dsp:drawing) as PowerPoint writes it: two half-transparent circles, each with its text in a box across the overlap.
const circle = (x, label, textX) => `<dsp:sp modelId="{${label}}"><dsp:nvSpPr><dsp:cNvPr id="0" name=""/><dsp:cNvSpPr/></dsp:nvSpPr><dsp:spPr><a:xfrm><a:off x="${x}" y="0"/><a:ext cx="3000000" cy="3000000"/></a:xfrm><a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom><a:solidFill><a:schemeClr val="accent1"><a:alpha val="50000"/><a:hueOff val="0"/><a:satOff val="0"/><a:lumOff val="0"/><a:alphaOff val="0"/></a:schemeClr></a:solidFill><a:ln w="19050"><a:solidFill><a:schemeClr val="lt1"><a:hueOff val="0"/></a:schemeClr></a:solidFill></a:ln><a:effectLst/><a:sp3d/></dsp:spPr><dsp:style><a:lnRef idx="2"><a:scrgbClr r="0" g="0" b="0"/></a:lnRef><a:fillRef idx="1"><a:scrgbClr r="0" g="0" b="0"/></a:fillRef><a:effectRef idx="0"><a:scrgbClr r="0" g="0" b="0"/></a:effectRef><a:fontRef idx="minor"><a:schemeClr val="tx1"/></a:fontRef></dsp:style><dsp:txBody><a:bodyPr spcFirstLastPara="0" vert="horz" wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" numCol="1" spcCol="1270" anchor="ctr" anchorCtr="0"><a:noAutofit/></a:bodyPr><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="en-US" sz="4000" kern="1200"/><a:t>${label}</a:t></a:r></a:p></dsp:txBody><dsp:txXfrm><a:off x="${textX}" y="400000"/><a:ext cx="1600000" cy="2200000"/></dsp:txXfrm></dsp:sp>`;
// A box whose text sits in its own text rectangle, inset (a block list's node), its text in the second accent.
const box = `<dsp:sp modelId="{box}"><dsp:nvSpPr><dsp:cNvPr id="0" name=""/><dsp:cNvSpPr/></dsp:nvSpPr><dsp:spPr><a:xfrm><a:off x="0" y="3200000"/><a:ext cx="2000000" cy="1000000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></dsp:spPr><dsp:style><a:lnRef idx="2"><a:scrgbClr r="0" g="0" b="0"/></a:lnRef><a:fillRef idx="1"><a:scrgbClr r="0" g="0" b="0"/></a:fillRef><a:effectRef idx="0"><a:scrgbClr r="0" g="0" b="0"/></a:effectRef><a:fontRef idx="minor"><a:schemeClr val="accent2"/></a:fontRef></dsp:style><dsp:txBody><a:bodyPr lIns="38100" tIns="38100" rIns="38100" bIns="38100" anchor="ctr"><a:noAutofit/></a:bodyPr><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" b="1"/><a:t>Both</a:t></a:r></a:p></dsp:txBody><dsp:txXfrm><a:off x="95250" y="3295250"/><a:ext cx="1809500" cy="809500"/></dsp:txXfrm></dsp:sp>`;
const vennDrawing = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><dsp:drawing xmlns:dgm="${DGM}" xmlns:dsp="http://schemas.microsoft.com/office/drawing/2008/diagram" xmlns:a="${A}"><dsp:spTree><dsp:nvGrpSpPr><dsp:cNvPr id="0" name=""/><dsp:cNvGrpSpPr/></dsp:nvGrpSpPr><dsp:grpSpPr/>${circle(0, 'People', 400000)}${circle(2000000, 'Process', 3000000)}${box}</dsp:spTree></dsp:drawing>`;

// 3. The drawing as a slide part SH-05 reads: in a group at the frame, every shape named, its text and PowerPoint's text box kept aside.
{
  const slide = drawingSlide(vennDrawing, {x: 100, y: 200, cx: 5000000, cy: 4200000}, 'Diagram 1');
  assert.match(slide.xml, /<p:grpSpPr><a:xfrm><a:off x="100" y="200"\/><a:ext cx="5000000" cy="4200000"\/><a:chOff x="0" y="0"\/><a:chExt cx="5000000" cy="4200000"\/><\/a:xfrm><\/p:grpSpPr>/);
  assert.equal(slide.xml.includes('dsp:'), false);
  assert.equal(slide.xml.includes('hueOff'), false, 'no-op color transforms are left out');
  assert.equal(slide.xml.includes('sp3d'), false, 'an empty 3-D shape is left out');
  assert.deepEqual([...slide.xml.matchAll(/<p:cNvPr id="(\d+)" name="([^"]*)"\/>/g)].slice(2).map(match => match[2]), ['Diagram 1 0', 'Diagram 1 1', 'Diagram 1 2']);
  assert.deepEqual(slide.bodies.map(body => [body.paragraphs.flat().map(run => run.text).join(''), body.box?.x]), [['People', 400000], ['Process', 3000000], ['Both', 95250]]);
}

// 4. Whole files: SmartArt frames PowerPoint wrote, put on the slides of an exported deck, import as OPF with their findings.
const DIAGRAM_RELS = {data: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/diagramData', drawing: 'http://schemas.microsoft.com/office/2007/relationships/diagramDrawing'};
const TYPES = {data: 'application/vnd.openxmlformats-officedocument.drawingml.diagramData+xml', drawing: 'application/vnd.ms-office.drawingml.diagramDrawing+xml'};
async function withSmartArt(frames) {
  const deck = {slides: frames.map((_, index) => ({title: `SmartArt ${index + 1}`}))};
  const entries = unzipSync(new Uint8Array(await toPptx(deck, {seed: 808, timestamp: '2026-11-07T00:00:00Z', zipDate: '2026-11-07T00:00:00Z', provenance: false})));
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
  // As a PowerPoint user's file: none of OPF's tags (the slide layouts' among them).
  for (const path of Object.keys(entries).filter(name => /^ppt\/(slides|slideLayouts|slideMasters)\/[^/]+\.xml$|^ppt\/presentation\.xml$/.test(name)))
    entries[path] = strToU8(strFromU8(entries[path]).replace(/<p:custDataLst>[\s\S]*?<\/p:custDataLst>/g, ''));
  const diagnostics = [];
  const imported = await fromPptx(zipSync(entries), {onDiagnostic: diagnostic => diagnostics.push(diagnostic)});
  return {imported, diagnostics};
}
{
  const {imported, diagnostics} = await withSmartArt([
    {data: dataModel(`${L}pyramid3`, 'pyramid', [N('Leads'), N('Prospects'), N('Customers')])},
    {data: dataModel(`${L}vList2`, 'list', [N('Goals', [N('Grow revenue'), N('Enter two markets')]), N('Risks', [N('Hiring')])])},
    {data: dataModel(`${L}process3`, 'process', [N('Discover', [N('Interviews')]), N('Define'), N('Deliver')], {})},
    {data: dataModel(`${L}hierarchy2`, 'hierarchy', [N('Company', [N('Sales'), N('Engineering')])])},
    {data: dataModel(`${L}venn1`, 'relationship', [N('People'), N('Process')]), drawing: vennDrawing},
    {data: dataModel(`${L}radial1`, 'cycle', [N('Customer', [N('Sales'), N('Support')], {})], {}).replace(/<a:ext uri="http:\/\/schemas\.microsoft\.com\/office\/drawing\/2008\/diagram">[\s\S]*?<\/a:ext>/, '')},
    {data: dataModel(`${L}chevron1`, 'process', [N('Plan', [], {sib: 'then'}), N('Build')])},
    {data: dataModel(`${L}default`, 'list', [N('', [], {empty: true})])},
  ]);
  assert.equal(validate(imported).valid, true, JSON.stringify(validate(imported).errors?.slice(0, 3)));
  const [pyramid, list, process, hierarchy, venn, radial, chevrons, empty] = imported.slides;
  const blocks = slide => slide.blocks ?? (slide.items ? [{items: slide.items}] : []);
  const listOf = slide => blocks(slide).find(block => block.items)?.items;
  assert.equal(pyramid.layout, 'default:pyramid');
  assert.deepEqual(listOf(pyramid), ['Leads', 'Prospects', 'Customers']);
  assert.equal(list.layout, 'default:list');
  assert.deepEqual(listOf(list), ['Goals', {text: 'Grow revenue', level: 1}, {text: 'Enter two markets', level: 1}, 'Risks', {text: 'Hiring', level: 1}]);
  assert.equal(process.layout, 'default:process');
  assert.deepEqual(listOf(process), ['Discover', {text: 'Interviews', level: 1}, 'Define', 'Deliver']);
  const flowchart = blocks(hierarchy).find(block => block.diagram)?.diagram;
  assert.deepEqual(flowchart, {source: 'flowchart LR\n  n1["Company"]\n  n2["Sales"]\n  n1 --> n2\n  n3["Engineering"]\n  n1 --> n3', alt: 'Hierarchy, top level first:\nCompany\n  Sales\n  Engineering'});
  // Venn: two circles (half transparent) and their text as text-only overlays where PowerPoint set it; the box keeps its own text, white,
  // with the inset as padding; the first shape carries the outline.
  assert.equal(blocks(venn).length, 0);
  assert.deepEqual(venn.shapes.map(shape => [shape.shape, shape.text ?? null, shape.style ?? null]), [['ellipse', null, null], ['rect', 'People', 'none'], ['ellipse', null, null], ['rect', 'Process', 'none'], ['rect', [{text: 'Both', bold: true, color: 'accent2'}], null]]);
  assert.equal(venn.shapes[0].opacity, 0.5);
  assert.equal(venn.shapes[0].alt, 'SmartArt (venn1):\nPeople\nProcess');
  assert.ok(venn.shapes[4].padding > 0, 'the text box inset is the padding');
  // A layout with no OPF form and no drawing: its outline as a list.
  assert.deepEqual(listOf(radial), ['Customer', {text: 'Sales', level: 1}, {text: 'Support', level: 1}]);
  assert.equal(chevrons.layout, 'default:chevrons');
  assert.deepEqual(listOf(chevrons), ['Plan', 'Build']);
  assert.deepEqual(blocks(empty), [], 'a SmartArt with only placeholders imports nothing');
  assert.equal(JSON.stringify(imported).includes('PowerPoint object'), false, 'no SmartArt is an unknown object');
  const of = code => diagnostics.filter(item => item.code === code).map(item => [item.path, item.layout, item.form ?? item.text]);
  assert.deepEqual(of('smartart-adapted'), [['slides.0', 'pyramid3', 'pyramid'], ['slides.1', 'vList2', 'list'], ['slides.2', 'process3', 'process'], ['slides.3', 'hierarchy2', 'diagram'],
    ['slides.4', 'venn1', 'shapes'], ['slides.5', 'radial1', 'list'], ['slides.7', 'default', 'list']]);
  assert.deepEqual(of('smartart-text-dropped'), [['slides.6', 'chevron1', 'then']]);
  assert.equal(diagnostics.some(item => item.code === 'shape-property-dropped'), false, 'PowerPoint\'s no-op transforms and empty 3-D are not reported');
}

// 5. The PowerPoint-made fixture (fixtures/make-powerpoint-smartart.ps1): every slide's SmartArt imports with every node's text.
const fixture = new URL('./fixtures/powerpoint-smartart.pptx', import.meta.url), manifestUrl = new URL('./fixtures/powerpoint-smartart.json', import.meta.url);
if (existsSync(fixture) && existsSync(manifestUrl)) {
  const manifest = JSON.parse(readFileSync(manifestUrl, 'utf8').replace(/^﻿/, ''));
  const diagnostics = [];
  const imported = await fromPptx(readFileSync(fixture), {onDiagnostic: diagnostic => diagnostics.push(diagnostic)});
  assert.equal(validate(imported).valid, true);
  const json = JSON.stringify(imported).replace(/\\n/g, ' ');
  for (const slide of manifest.filter(entry => !entry.error)) {
    for (const node of [slide.nodes].flat()) {
      const text = String(node.text).replace(/[\v\r]/g, ' ').trim();
      if (text) assert.ok(json.includes(JSON.stringify(text).slice(1, -1).split(' ')[0]), `${slide.name}: ${text}`);
    }
  }
  assert.equal(json.includes('PowerPoint object'), false);
}
