// SH-09: a pyramid or matrix (a layout region's `arrangement`) exports as live SmartArt of PowerPoint's Basic Pyramid or Basic Matrix
// (the data model, OPF's colors and quick style, a drawing from core's geometry, and no layout part) where it lies in core's SmartArt
// domain, and as native shapes otherwise (`smartArt: "shapes"`, or the info diagnostic smartart-unavailable). A SmartArt OPF wrote imports
// back as its list on its layout; an edited one, and one PowerPoint wrote, import their data model's nodes.
import assert from 'node:assert/strict';
import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';
import {XMLValidator} from 'fast-xml-parser';
import {fromPptx, toPptx} from './helpers/default-catalog.mjs';

const options = {seed: 909, timestamp: '2026-11-06T00:00:00Z', zipDate: '2026-11-06T00:00:00Z'};
const pyramid = ['Vision', 'Goals', 'Programs', 'Teams'], matrix = ['North', 'South', 'East'];
const deck = {slides: [{layout: 'pyramid', title: 'Our strategy', items: pyramid}, {layout: 'matrix', title: 'Four markets', items: matrix}]};
const exported = async (document, extra = {}) => {
  const diagnostics = [], bytes = new Uint8Array(await toPptx(document, {...options, ...extra, onDiagnostic: diagnostic => diagnostics.push(diagnostic)}));
  const entries = unzipSync(bytes);
  for (const [path, data] of Object.entries(entries)) if (/\.(xml|rels)$/.test(path)) assert.equal(XMLValidator.validate(strFromU8(data)), true, path);
  return {bytes, entries, diagnostics, text: path => strFromU8(entries[path])};
};

// 1. Live SmartArt: the frame, its parts and relationships, no layout part.
const live = await exported(deck);
{
  const {entries, text} = live;
  assert.equal(live.diagnostics.filter(item => item.code === 'smartart-unavailable').length, 0, 'both are in the domain');
  for (const kind of ['data', 'quickStyle', 'colors', 'drawing']) for (const number of [1, 2]) assert.ok(entries[`ppt/diagrams/${kind}${number}.xml`], `${kind}${number}`);
  assert.equal(Object.keys(entries).some(path => /^ppt\/diagrams\/layout/.test(path)), false, 'no layout definition is written');
  const types = text('[Content_Types].xml');
  assert.match(types, /PartName="\/ppt\/diagrams\/data1\.xml" ContentType="application\/vnd\.openxmlformats-officedocument\.drawingml\.diagramData\+xml"/);
  assert.match(types, /PartName="\/ppt\/diagrams\/drawing2\.xml" ContentType="application\/vnd\.ms-office\.drawingml\.diagramDrawing\+xml"/);
  const slide = text('ppt/slides/slide1.xml'), rels = text('ppt/slides/_rels/slide1.xml.rels');
  const frame = /<p:graphicFrame>(?:(?!<\/p:graphicFrame>)[\s\S])*?drawingml\/2006\/diagram[\s\S]*?<\/p:graphicFrame>/.exec(slide)?.[0];
  assert.ok(frame, 'a SmartArt graphic frame');
  assert.match(frame, /name="OPF smartart slides\.0\.items"/);
  assert.match(frame, /descr="Vision, Goals, Programs, Teams"/);
  assert.match(frame, /<dgm:relIds [^>]*r:dm="(rId\d+)" r:lo="" r:qs="(rId\d+)" r:cs="(rId\d+)"\/>/, 'an empty r:lo: no layout relationship');
  assert.match(frame, /<p:custDataLst><p:tags r:id="[^"]+"\/><\/p:custDataLst>/, 'the OPF_SMARTART_V1 tag (full provenance)');
  assert.doesNotMatch(rels, /diagramLayout/);
  for (const type of ['diagramData', 'diagramQuickStyle', 'diagramColors', '2007/relationships/diagramDrawing']) assert.match(rels, new RegExp(type));
  assert.doesNotMatch(slide, /OPF list slides\.0\.items line/, 'the entries are the nodes, not measured lines');
  // The data model: the layout, OPF's own quick style and colors, one point per entry with custT and core's size, cxn in entry order.
  const data = text('ppt/diagrams/data1.xml');
  assert.match(data, /loTypeId="urn:microsoft\.com\/office\/officeart\/2005\/8\/layout\/pyramid1"/);
  assert.match(data, /qsTypeId="urn:openpresentation\.org\/opf\/smartart\/quickstyle\/flat"/);
  assert.match(data, /csTypeId="urn:openpresentation\.org\/opf\/smartart\/colors\/primary"/);
  assert.equal((data.match(/<dgm:prSet custT="1"\/>/g) ?? []).length, 4);
  const sizes = [...data.matchAll(/<a:rPr lang="[^"]+" sz="(\d+)"/g)].map(match => match[1]);
  assert.equal(sizes.length, 4); assert.equal(new Set(sizes).size, 1, 'one size for every node');
  assert.match(data, /<a:pPr algn="ctr"><a:lnSpc><a:spcPts val="\d+"\/><\/a:lnSpc><a:spcBef><a:spcPts val="0"\/><\/a:spcBef><a:spcAft><a:spcPts val="0"\/><\/a:spcAft><a:buNone\/><\/a:pPr>/);
  assert.deepEqual([...data.matchAll(/<dgm:cxn [^>]*srcOrd="(\d+)"/g)].map(match => Number(match[1])), [0, 1, 2, 3]);
  assert.deepEqual([...data.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(match => match[1]), pyramid);
  assert.match(text('ppt/diagrams/data2.xml'), /layout\/matrix3"/);
  // OPF's colors and quick style cover every label the two layouts use, in the theme's colors.
  for (const part of ['colors1', 'quickStyle1']) for (const label of ['node0', 'node1', 'bgShp', 'revTx']) assert.match(text(`ppt/diagrams/${part}.xml`), new RegExp(`<dgm:styleLbl name="${label}">`), `${part} ${label}`);
  const colors = text('ppt/diagrams/colors2.xml');
  assert.match(colors, /<dgm:styleLbl name="node1"><dgm:fillClrLst meth="repeat"><a:schemeClr val="accent1"\/><\/dgm:fillClrLst><dgm:linClrLst meth="repeat"><a:schemeClr val="bg1"\/>/);
  assert.match(colors, /<dgm:styleLbl name="bgShp"><dgm:fillClrLst meth="repeat"><a:schemeClr val="accent1"><a:lumMod val="20000"\/><a:lumOff val="80000"\/><\/a:schemeClr>/);
  assert.match(text('ppt/diagrams/quickStyle1.xml'), /<dgm:styleLbl name="node1">[\s\S]*?<a:lnRef idx="3">/);
  // The drawing: core's geometry, a trapezoid per level with its adjustment, the matrix's diamond and four quadrants.
  const drawing = text('ppt/diagrams/drawing1.xml');
  assert.equal((drawing.match(/<a:prstGeom prst="trapezoid"><a:avLst><a:gd name="adj" fmla="val \d+"\/>/g) ?? []).length, 4);
  const quadrants = text('ppt/diagrams/drawing2.xml');
  assert.equal((quadrants.match(/prst="diamond"/g) ?? []).length, 1);
  assert.equal((quadrants.match(/prst="roundRect"/g) ?? []).length, 4, 'an empty quadrant is still drawn');
  assert.match(text('ppt/diagrams/data1.xml'), /<dsp:dataModelExt [^>]*relId="rId\d+"/);
}

// 2. The round trip: an unchanged SmartArt is its list again, on its layout.
{
  const back = await fromPptx(live.bytes);
  assert.deepEqual(back.slides.map(slide => [slide.layout, slide.items]), [['pyramid', pyramid], ['matrix', matrix]]);
}

// 3. A node edited in PowerPoint: the data model's text is read, with a smartart-edited diagnostic.
{
  const entries = unzipSync(live.bytes);
  entries['ppt/diagrams/data1.xml'] = strToU8(strFromU8(entries['ppt/diagrams/data1.xml']).replace('<a:t>Goals</a:t>', '<a:t>Goals for 2027</a:t>'));
  const diagnostics = [], back = await fromPptx(zipSync(entries), {onDiagnostic: diagnostic => diagnostics.push(diagnostic)});
  assert.deepEqual(back.slides[0].items ?? back.slides[0].blocks?.[0]?.items, ['Vision', 'Goals for 2027', 'Programs', 'Teams']);
  assert.ok(diagnostics.some(item => item.code === 'smartart-edited'));
}

// 4. Without provenance (and so as a PowerPoint-authored SmartArt reads): the data model's nodes, on the default catalog's layout.
{
  const bare = await exported(deck, {provenance: false});
  assert.doesNotMatch(bare.text('ppt/slides/slide1.xml'), /<p:custDataLst>/);
  const back = await fromPptx(bare.bytes);
  assert.deepEqual(back.slides.map(slide => [String(slide.layout).replace(/^default:/, ''), slide.items ?? slide.blocks?.[0]?.items]), [['pyramid', pyramid], ['matrix', matrix]]);
}

// 5. A PowerPoint-style data model: presentation points, cxn out of point order, a layout part that is never stored.
{
  const entries = unzipSync((await exported(deck, {provenance: false})).bytes);
  let data = strFromU8(entries['ppt/diagrams/data1.xml']);
  const connections = [...data.matchAll(/<dgm:cxn [^>]*\/>/g)].map(match => match[0]);
  data = data.replace(/<dgm:cxnLst>[\s\S]*<\/dgm:cxnLst>/, `<dgm:cxnLst>${[...connections].reverse().join('')}<dgm:cxn modelId="{F}" type="presOf" srcId="x" destId="y" srcOrd="0" destOrd="0"/></dgm:cxnLst>`)
    .replace('</dgm:ptLst>', '<dgm:pt modelId="{P}" type="pres"><dgm:prSet presName="level" presStyleLbl="node1"/><dgm:spPr/></dgm:pt></dgm:ptLst>')
    .replace('<a:t>Programs</a:t>', '<a:t>Pro</a:t></a:r><a:r><a:rPr lang="en-US" b="1"/><a:t>grams</a:t>');
  entries['ppt/diagrams/data1.xml'] = strToU8(data);
  entries['ppt/diagrams/layout1.xml'] = strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><dgm:layoutDef xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram" uniqueId="test"/>');
  const back = await fromPptx(zipSync(entries));
  const items = back.slides[0].items ?? back.slides[0].blocks?.[0]?.items;
  assert.deepEqual(items, ['Vision', 'Goals', [{text: 'Pro'}, {text: 'grams', bold: true}], 'Teams'], 'cxn order and run properties');
  assert.equal(JSON.stringify(back).includes('layoutDef'), false, 'the layout part is never stored');
}

// 6. Native shapes: smartArt "shapes" draws the nodes as presets under the measured lines; they import as the layout's drawing.
{
  const shapes = await exported(deck, {smartArt: 'shapes'});
  assert.equal(Object.keys(shapes.entries).some(path => path.startsWith('ppt/diagrams/')), false);
  const slide = shapes.text('ppt/slides/slide1.xml');
  const nodes = [...slide.matchAll(/<p:sp>(?:(?!<\/p:sp>)[\s\S])*?name="OPF arrangement slides\.0\.items node \d"[\s\S]*?<\/p:sp>/g)].map(match => match[0]);
  assert.equal(nodes.length, 4);
  for (const node of nodes) assert.match(node, /<a:prstGeom prst="trapezoid"><a:avLst><a:gd name="adj" fmla="val \d+"\/><\/a:avLst><\/a:prstGeom>/);
  assert.match(slide, /name="OPF list slides\.0\.items line 0"/, 'the entries are measured lines');
  const quadrants = shapes.text('ppt/slides/slide2.xml');
  assert.match(quadrants, /name="OPF arrangement slides\.1\.items background"[\s\S]*?prst="diamond"/);
  assert.equal((quadrants.match(/name="OPF arrangement slides\.1\.items node \d"/g) ?? []).length, 4);
  const back = await fromPptx(shapes.bytes);
  assert.deepEqual(back.slides.map(slide => [slide.layout, slide.items]), [['pyramid', pyramid], ['matrix', matrix]]);
}

// 7. Outside the domain (a frame narrower than the comparison covered): native shapes and an info smartart-unavailable with the reason.
{
  const tall = await exported({design: {dimensions: '9:16'}, slides: [{layout: 'matrix', title: 'Two', items: ['North', 'South']}]});
  const unavailable = tall.diagnostics.filter(item => item.code === 'smartart-unavailable');
  assert.equal(unavailable.length, 1);
  assert.equal(unavailable[0].path, 'slides.0.items');
  assert.match(unavailable[0].reason, /proportions/);
  assert.equal(Object.keys(tall.entries).some(path => path.startsWith('ppt/diagrams/')), false);
  assert.match(tall.text('ppt/slides/slide1.xml'), /name="OPF arrangement slides\.0\.items node 0"/);
}

// 8. The option is checked.
await assert.rejects(() => toPptx(deck, {...options, smartArt: 'picture'}), error => error.code === 'invalid-smart-art-mode');

console.log('SH-09 SmartArt passed: live Basic Pyramid and Basic Matrix (data model, OPF colors and quick style, drawing, no layout part), the round trip, an edited node, untagged and PowerPoint-style data models, native shapes, the domain fallback and the option check.');
