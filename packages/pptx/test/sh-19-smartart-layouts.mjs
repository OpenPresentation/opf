// SH-19: OPF's own designs export as live SmartArt on OPF's own layout definitions (src/smart-art-layouts.js, core smart-art-layout.ts):
// a layout part written from ECMA-376 and OPF's design (a uniqueId in OPF's namespace, a title and description, a composite table per
// entry count, no Microsoft content), the data model naming it, SH-16's fallback picture, and native shapes where the definition cannot
// carry the design (a mirrored chevron) or with `smartArt: "shapes"`. A file OPF wrote imports back to the same arrangement from the
// mc:Choice, from the fallback alone, and from the data model of a file PowerPoint saved again (OPF's uniqueId, no tag).
import assert from 'node:assert/strict';
import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';
import {XMLValidator} from 'fast-xml-parser';
import {fromPptx, toPptx} from './helpers/default-catalog.mjs';
import {compositeLayoutDefinition, opfLayoutGeometry} from '@openpresentation/opf/composition';
import {OPF_LAYOUTS, OPF_LAYOUT_NAMESPACE, layoutDefinitionXml, opfLayoutKind} from '../src/smart-art-layouts.js';

const options = {seed: 1919, timestamp: '2026-11-07T00:00:00Z', zipDate: '2026-11-07T00:00:00Z'};
const short = ['Vision', 'Plan', 'Build', 'Ship', 'Learn', 'Grow', 'Scale', 'Serve'];
// OPF's designs inside SMART_ART_OPF_DOMAIN (the stepped pyramid, a card grid, snaking flow and chevron rows, the vertical flow's columns).
const slides = [
  {layout: 'pyramid', title: 'Levels', items: short.slice(0, 6)},
  {layout: 'matrix', title: 'Three', items: short.slice(0, 3)},
  {layout: 'flow', title: 'Steps', items: short.slice(0, 7)},
  {layout: 'chevrons', title: 'Stages', items: short.slice(0, 7)},
  {layout: 'vertical-flow', title: 'Steps', items: short.slice(0, 5)},
];
const exported = async (document, extra = {}) => {
  const diagnostics = [], bytes = new Uint8Array(await toPptx(document, {...options, ...extra, onDiagnostic: diagnostic => diagnostics.push(diagnostic)}));
  const entries = unzipSync(bytes);
  for (const [path, data] of Object.entries(entries)) if (/\.(xml|rels)$/.test(path)) assert.equal(XMLValidator.validate(strFromU8(data)), true, path);
  return {bytes, entries, diagnostics, text: path => strFromU8(entries[path])};
};
const itemsOf = slide => slide.items ?? slide.blocks?.[0]?.items;
const expected = {pyramid: /\/pyramid-steps\/[0-9a-f]{16}$/, matrix: /\/card-grid\/[0-9a-f]{16}$/, flow: /\/flow-rows\/[0-9a-f]{16}$/, chevrons: /\/chevron-rows\/[0-9a-f]{16}$/, 'vertical-flow': /\/vertical-flow-columns\/[0-9a-f]{16}$/};

// 1. Live SmartArt on OPF's own layouts.
const live = await exported({slides});
{
  const {entries, text, diagnostics} = live;
  assert.deepEqual(diagnostics.filter(item => item.code === 'smartart-unavailable'), [], 'every design is live');
  slides.forEach((slide, index) => {
    const number = index + 1, layout = text(`ppt/diagrams/layout${number}.xml`), data = text(`ppt/diagrams/data${number}.xml`), xml = text(`ppt/slides/slide${number}.xml`);
    const id = /uniqueId="([^"]+)"/.exec(layout)[1];
    assert.ok(id.startsWith(OPF_LAYOUT_NAMESPACE) && expected[slide.layout].test(id), `${slide.layout}: ${id}`);
    assert.equal(opfLayoutKind(id), slide.layout === 'matrix' ? 'matrix' : slide.layout);
    const design = id.slice(OPF_LAYOUT_NAMESPACE.length).split('/')[0];
    assert.match(layout, new RegExp(`<dgm:title val="${OPF_LAYOUTS[design].title}"/><dgm:desc val="${OPF_LAYOUTS[design].description.replace(/[.()]/g, '\\$&')}"/>`));
    assert.doesNotMatch(layout, /microsoft/i, 'no Microsoft content in OPF\'s definition');
    // Every layout node and forEach name once (PowerPoint rejects a repeated one); a composite branch per count; the hidden full-frame child.
    const names = [...layout.matchAll(/<dgm:(?:layoutNode|forEach|if|else|choose) name="([^"]+)"/g)].map(match => match[1]);
    assert.equal(new Set(names).size, names.length, `${design}: names repeat`);
    assert.ok((layout.match(/<dgm:if name="c\d" func="cnt" axis="ch" ptType="node" op="equ" val="\d"><dgm:alg type="composite"\/>/g) ?? []).length >= 4);
    assert.match(layout, /<dgm:shape type="rect" hideGeom="1">/);
    // The composed count's entries start where OPF's composition sets their first line (anchored at the top at that inset).
    assert.match(layout, /<dgm:alg type="tx"><dgm:param type="txAnchorVert" val="t"\/><\/dgm:alg>/);
    assert.match(data, new RegExp(`loTypeId="${id.replace(/[./]/g, '\\$&')}"`));
    assert.match(xml, /<mc:Choice [^>]*Requires="dgm1612"><p:graphicFrame>[\s\S]*?r:lo="rId\d+"[\s\S]*?<\/mc:Choice><mc:Fallback><p:pic>/, 'the frame names its layout part, the fallback stays');
    const rels = text(`ppt/slides/_rels/slide${number}.xml.rels`);
    assert.match(rels, new RegExp(`Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/diagramLayout" Target="../diagrams/layout${number}.xml"`));
    assert.match(text('[Content_Types].xml'), new RegExp(`PartName="/ppt/diagrams/layout${number}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.diagramLayout\\+xml"`));
    // Every node at OPF's one size (the run sz and the layout's primFontSz for a node added in PowerPoint).
    const sizes = [...data.matchAll(/<a:rPr lang="[^"]+" sz="(\d+)"/g)].map(match => Number(match[1]) / 100);
    assert.equal(new Set(sizes).size, 1);
    assert.ok([...layout.matchAll(/<dgm:constr type="primFontSz" val="([\d.]+)" op="equ"\/>/g)].every(match => Math.abs(Number(match[1]) - sizes[0]) < .01));
  });
  // The pyramid's entries beside their bars (text-only nodes on the slide), start-aligned; the cards in the card neutral with their border.
  assert.match(text('ppt/diagrams/layout1.xml'), /styleLbl="revTx"><dgm:varLst><dgm:bulletEnabled val="1"\/><\/dgm:varLst><dgm:alg type="tx"(?:\/>|>[\s\S]*?<\/dgm:alg>)<dgm:shape type="rect">/);
  assert.match(text('ppt/diagrams/data1.xml'), /<a:pPr algn="l">/);
  assert.match(text('ppt/diagrams/layout2.xml'), /styleLbl="alignNode1"/);
  assert.match(text('ppt/diagrams/colors2.xml'), /<dgm:styleLbl name="alignNode1"><dgm:fillClrLst meth="repeat"><a:srgbClr val="[0-9A-F]{6}"\/>/);
  assert.match(text('ppt/diagrams/data2.xml'), /<dgm:prSet custT="1"\/><dgm:spPr><a:ln w="\d+"><a:solidFill><a:srgbClr val="[0-9A-F]{6}"\/><\/a:solidFill><\/a:ln><\/dgm:spPr>/);
  // A flow's arrows: axis-aligned rightArrow shapes, turned 180 degrees in a row that runs back and 90 between two rows.
  assert.match(text('ppt/diagrams/layout3.xml'), /<dgm:shape type="rightArrow" rot="180">/);
  assert.match(text('ppt/diagrams/layout3.xml'), /<dgm:shape type="rightArrow" rot="90">/);
  assert.equal(Object.keys(entries).filter(path => /^ppt\/diagrams\/layout\d+\.xml$/.test(path)).length, 5);
  // Each distinct table has its own uniqueId (PowerPoint keeps the first definition of a uniqueId for its whole session); the same
  // export twice keeps them, another frame changes them.
  const idOf = (result, number) => /uniqueId="([^"]+)"/.exec(result.text(`ppt/diagrams/layout${number}.xml`))[1];
  const ids = slides.map((_, index) => idOf(live, index + 1));
  assert.equal(new Set(ids).size, ids.length);
  const twice = await exported({slides});
  assert.deepEqual(slides.map((_, index) => idOf(twice, index + 1)), ids);
  const other = await exported({design: {dimensions: '16:10'}, slides: [slides[0]]});
  assert.notEqual(idOf(other, 1), ids[0], 'another frame, another table, another uniqueId');
}

// 2. The serializer writes what the definition holds, shares of the frame and millimeters; a cycle's turned arrows are connectors
//    between two node centers, and its closing arrow keeps the last transition.
{
  const area = {x: 0, y: 0, width: 1000, height: 500}, recipe = {design: 'cycle-ring', area, gap: 24, radius: 12};
  const cycle = compositeLayoutDefinition({uniqueId: 'u', title: 'Ring', description: 'D', category: 'cycle'}, area, 8, k => opfLayoutGeometry(recipe, k), {node: 'node1', text: 'node', margins: [.2, .2, .2, .2], fontSize: 24});
  const ring = layoutDefinitionXml(cycle);
  assert.match(ring, /<dgm:alg type="conn"><dgm:param type="dim" val="2D"\/><dgm:param type="begPts" val="ctr"\/><dgm:param type="endPts" val="ctr"\/><dgm:param type="srcNode" val="n4_1"\/><dgm:param type="dstNode" val="n4_2"\/><\/dgm:alg>/);
  assert.match(ring, /<dgm:forEach name="s4_4" axis="followSib" ptType="sibTrans" cnt="1" hideLastTrans="0">/, 'the closing arrow');
  assert.match(ring, /<dgm:constr type="begPad" val="[\d.]+"\/><dgm:constr type="endPad" val="[\d.]+"\/><dgm:constr type="h" val="[\d.]+"\/>/, 'pads and thickness in millimeters');
  const xml = layoutDefinitionXml({uniqueId: `${OPF_LAYOUT_NAMESPACE}card-grid`, title: 'T & U', description: 'D', category: 'list', root: {kind: 'layoutNode', name: 'root', children: [{kind: 'choose', name: 'c', branches: [
    {name: 'c1', count: 1, alg: {type: 'composite'}, constraints: [{type: 'l', for: 'ch', forName: 'n', refType: 'w', fact: .25}], children: [{kind: 'forEach', name: 'f', axis: 'ch', ptType: 'node', st: 1, cnt: 1, children: [{kind: 'layoutNode', name: 'n', styleLbl: 'node1', alg: {type: 'tx'}, shape: {type: 'roundRect', adj: [16667]}, presOf: {axis: 'desOrSelf', ptType: 'node'}}]}]}]}]}});
  assert.match(xml, /<dgm:title val="T &amp; U"\/>/);
  assert.match(xml, /<dgm:constr type="l" for="ch" forName="n" refType="w" fact="0.25"\/>/);
  assert.match(xml, /<dgm:shape type="roundRect"><dgm:adjLst><dgm:adj idx="1" val="0.16667"\/><\/dgm:adjLst><\/dgm:shape>/);
}

// 3. Native shapes: `smartArt: "shapes"`; a design the domain leaves out (OPF's cycle loops held their entries only above its text
//    density); a design the definition cannot carry (a right-to-left row of chevrons points left).
{
  const cycle = await exported({slides: [{layout: 'cycle', title: 'Loop', items: ['Clear purpose', 'Shared goals', 'Team habits', 'Weekly reviews', 'Open roadmap', 'Fast feedback']}]});
  assert.match(cycle.diagnostics.find(item => item.code === 'smartart-unavailable')?.reason ?? '', /OPF's own layout does not hold it either: OPF's cycle-[\w-]+ layout did not pass PowerPoint's comparison/);
  assert.equal(Object.keys(cycle.entries).some(path => /^ppt\/diagrams\//.test(path)), false);
  const shapes = await exported({slides}, {smartArt: 'shapes'});
  assert.equal(Object.keys(shapes.entries).some(path => /^ppt\/diagrams\//.test(path)), false);
  const rtl = await exported({language: {bcp47: 'ar', name: 'Arabic', direction: 'rtl', script: 'Arab', fontScheme: 'noto-sans-arabic'}, slides: [{layout: 'chevrons', title: 'مراحل', items: ['الرؤية والأهداف الكبرى', 'الأهداف السنوية الواضحة', 'البرامج والمشروعات', 'الفرق والمنصة المشتركة']}]});
  const reason = rtl.diagnostics.find(item => item.code === 'smartart-unavailable');
  assert.ok(reason, 'a right-to-left row of chevrons stays native shapes');
  assert.equal(Object.keys(rtl.entries).some(path => /^ppt\/diagrams\/layout/.test(path)), false);
}

// 4. Import: from the mc:Choice; from the fallback picture alone; from the data model of a file PowerPoint saved again.
{
  const back = await fromPptx(live.bytes);
  assert.deepEqual(back.slides.map(slide => [slide.layout, itemsOf(slide)]), slides.map(slide => [slide.layout, slide.items]));
  const fallbackOnly = {...live.entries};
  for (const part of Object.keys(fallbackOnly).filter(path => /^ppt\/slides\/slide\d+\.xml$/.test(path)))
    fallbackOnly[part] = strToU8(strFromU8(fallbackOnly[part]).replace(/<mc:AlternateContent\b[\s\S]*?<mc:Fallback>([\s\S]*?)<\/mc:Fallback><\/mc:AlternateContent>/g, '$1'));
  for (const path of Object.keys(fallbackOnly)) if (/^ppt\/diagrams\//.test(path)) delete fallbackOnly[path];
  const pictures = await fromPptx(zipSync(fallbackOnly));
  assert.deepEqual(pictures.slides.map(slide => [slide.layout, itemsOf(slide)]), slides.map(slide => [slide.layout, slide.items]));
  // PowerPoint's save: the bare frame (no mc:AlternateContent, no tag); the layout part stays with OPF's uniqueId.
  const resaved = {...live.entries};
  for (const part of Object.keys(resaved).filter(path => /^ppt\/slides\/slide\d+\.xml$/.test(path)))
    resaved[part] = strToU8(strFromU8(resaved[part]).replace(/<mc:AlternateContent\b[^>]*><mc:Choice\b[^>]*>([\s\S]*?)<\/mc:Choice><mc:Fallback>[\s\S]*?<\/mc:Fallback><\/mc:AlternateContent>/g, '$1').replace(/<p:custDataLst><p:tags r:id="rIdOpfSmartArt\d+"\/><\/p:custDataLst>/g, ''));
  const again = await fromPptx(zipSync(resaved));
  assert.deepEqual(again.slides.map(slide => [slide.layout, itemsOf(slide)]), slides.map(slide => [slide.layout, slide.items]));
}
console.log('sh-19 smartart layouts: ok');
