// SH-17: a flow and a vertical flow (a layout region's `arrangement`) export as live SmartArt of PowerPoint's Basic Process (process1) and
// Vertical Process (process2) where they lie in core's SmartArt domain, each with SH-16's fallback picture, and as native shapes otherwise
// (chevrons, rounded boxes and turned rightArrows). C03 (the owner's choice of 2026-11-24): a short row of chevrons is drawn as OPF's own
// filled rows and exported as editable shapes, not as PowerPoint's thin Basic Chevron Process strip. Each imports back as its list on its
// layout: from OPF's frame, from the fallback picture alone, from native shapes and from a data model PowerPoint wrote.
import assert from 'node:assert/strict';
import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';
import {XMLValidator} from 'fast-xml-parser';
import {fromPptx, toPptx} from './helpers/default-catalog.mjs';

const options = {seed: 1717, timestamp: '2026-11-06T00:00:00Z', zipDate: '2026-11-06T00:00:00Z'};
// 0.35: the process layout draws a short list as Basic Process (it absorbed the flow layout); vertical-flow is vertical-process.
// VPR-1: three vertical steps fill their region as OPF's own design; two are still PowerPoint's Vertical Process.
const items = {chevrons: ['Plan', 'Build', 'Test', 'Ship'], process: ['Research', 'Design', 'Run', 'Review'], 'vertical-process': ['Sign up', 'Launch']};
const LAYOUTS = {process: 'process1', 'vertical-process': 'process2'};
// The live kinds: their slide and the number of their diagram parts (written in slide order).
const LIVE = [['process', 2, 1], ['vertical-process', 3, 2]];
const deck = {slides: Object.entries(items).map(([layout, list]) => ({layout, title: 'How we work', items: list}))};
const exported = async (document, extra = {}) => {
  const diagnostics = [], bytes = new Uint8Array(await toPptx(document, {...options, ...extra, onDiagnostic: diagnostic => diagnostics.push(diagnostic)}));
  const entries = unzipSync(bytes);
  for (const [path, data] of Object.entries(entries)) if (/\.(xml|rels)$/.test(path)) assert.equal(XMLValidator.validate(strFromU8(data)), true, path);
  return {bytes, entries, diagnostics, text: path => strFromU8(entries[path])};
};
const listOf = slide => slide.items ?? slide.blocks?.[0]?.items;

// 1. Live SmartArt with its fallback picture: the layouts, OPF's parts, no layout part.
const live = await exported(deck);
{
  const {entries, text} = live;
  // C03: the short row of chevrons is OPF's own design, exported as its four chevron shapes with the reason; the two flows are live.
  const unavailable = live.diagnostics.filter(item => item.code === 'smartart-unavailable');
  assert.equal(unavailable.length, 1, 'only the chevrons leave the domain');
  assert.match(unavailable[0].reason, /^PowerPoint's Basic Chevron Process covers under half of the region at this count; OPF's own design fills it, so OPF's own row of chevrons is drawn/);
  assert.equal(Object.keys(entries).filter(path => /^ppt\/diagrams\/data\d+\.xml$/.test(path)).length, 2, 'two live diagrams');
  assert.equal((text('ppt/slides/slide1.xml').match(/<a:prstGeom prst="chevron"><a:avLst><a:gd name="adj" fmla="val 50000"\/>/g) ?? []).length, 4, 'four chevron shapes');
  assert.equal(Object.keys(entries).some(path => /^ppt\/diagrams\/layout/.test(path)), false, 'no layout definition is written');
  for (const [kind, number, part] of LIVE) {
    const slide = text(`ppt/slides/slide${number}.xml`), data = text(`ppt/diagrams/data${part}.xml`);
    assert.match(slide, /<mc:AlternateContent [^>]*><mc:Choice xmlns:dgm1612="http:\/\/schemas\.microsoft\.com\/office\/drawing\/2016\/12\/diagram" Requires="dgm1612"><p:graphicFrame>/, `${kind}: SH-16's wrapper`);
    assert.match(slide, /<mc:Fallback><p:pic>/, `${kind}: the fallback picture`);
    assert.match(data, new RegExp(`loTypeId="urn:microsoft\\.com/office/officeart/2005/8/layout/${LAYOUTS[kind]}" loCatId="process"`), kind);
    assert.equal((data.match(/<dgm:prSet custT="1"\/>/g) ?? []).length, items[kind].length);
    assert.equal(new Set([...data.matchAll(/<a:rPr lang="[^"]+" sz="(\d+)"/g)].map(match => match[1])).size, 1, `${kind}: one size for every node`);
    assert.deepEqual([...data.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(match => match[1].replace(/ /g, ' ')), items[kind]);
    // The drawing: core's shapes, with the arrows of a flow (rightArrows, turned 90 degrees in a vertical flow).
    const drawing = text(`ppt/diagrams/drawing${part}.xml`);
    {
      assert.equal((drawing.match(/<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val 10000"\/>/g) ?? []).length, items[kind].length);
      const arrows = [...drawing.matchAll(/<a:xfrm( rot="5400000")?>(?:(?!<\/a:xfrm>)[\s\S])*<\/a:xfrm><a:prstGeom prst="rightArrow"><a:avLst><a:gd name="adj1" fmla="val 60000"\/><a:gd name="adj2" fmla="val 50000"\/>/g)];
      assert.equal(arrows.length, items[kind].length - 1, `${kind}: an arrow between two boxes`);
      assert.ok(arrows.every(match => Boolean(match[1]) === (kind === 'vertical-process')), `${kind}: arrow rotation`);
    }
    // OPF's colors: the arrows (sibTrans2D1) in the primary lightened 40%, without an outline; the nodes as SH-09's.
    const colors = text(`ppt/diagrams/colors${part}.xml`);
    assert.match(colors, /<dgm:styleLbl name="sibTrans2D1"><dgm:fillClrLst meth="repeat"><a:schemeClr val="accent1"><a:lumMod val="60000"\/><a:lumOff val="40000"\/><\/a:schemeClr><\/dgm:fillClrLst><dgm:linClrLst meth="repeat"><a:schemeClr val="bg1"><a:alpha val="0"\/>/);
    assert.match(text(`ppt/diagrams/quickStyle${part}.xml`), /<dgm:styleLbl name="sibTrans2D1">[\s\S]*?<a:lnRef idx="0">/);
  }
  // The fallback picture's alt text is the outline, in order.
  assert.match(text('ppt/slides/slide3.xml'), /descr="Vertical flow of 2 steps, top to bottom:&#10;Sign up&#10;Launch"/);
}

// 2. The round trip: each unchanged SmartArt is its list again, on its layout; a fallback picture alone too.
{
  const back = await fromPptx(live.bytes);
  assert.deepEqual(back.slides.map(slide => [slide.layout, listOf(slide)]), Object.entries(items));
  const entries = unzipSync(live.bytes);
  for (const part of Object.keys(entries).filter(path => /^ppt\/slides\/slide\d+\.xml$/.test(path)))
    entries[part] = strToU8(strFromU8(entries[part]).replace(/<mc:AlternateContent\b[\s\S]*?<mc:Fallback>([\s\S]*?)<\/mc:Fallback><\/mc:AlternateContent>/g, '$1'));
  const pictures = await fromPptx(zipSync(entries));
  assert.deepEqual(pictures.slides.map(slide => [slide.layout, listOf(slide)]), Object.entries(items), 'fallback-only');
}

// 3. As PowerPoint writes and edits it: no OPF tag, presentation points, a reversed cxn list, a layout part never stored, an edited node.
{
  const entries = unzipSync((await exported(deck, {provenance: false})).bytes);
  for (const number of [1, 2]) {
    let data = strFromU8(entries[`ppt/diagrams/data${number}.xml`]);
    const connections = [...data.matchAll(/<dgm:cxn [^>]*\/>/g)].map(match => match[0]);
    data = data.replace(/<dgm:cxnLst>[\s\S]*<\/dgm:cxnLst>/, `<dgm:cxnLst>${[...connections].reverse().join('')}<dgm:cxn modelId="{F}" type="presOf" srcId="x" destId="y" srcOrd="0" destOrd="0"/></dgm:cxnLst>`)
      .replace('</dgm:ptLst>', '<dgm:pt modelId="{P}" type="pres"><dgm:prSet presName="node" presStyleLbl="node1"/><dgm:spPr/></dgm:pt></dgm:ptLst>');
    entries[`ppt/diagrams/data${number}.xml`] = strToU8(data);
    entries[`ppt/diagrams/layout${number}.xml`] = strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><dgm:layoutDef xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram" uniqueId="test"/>');
  }
  entries['ppt/diagrams/data1.xml'] = strToU8(strFromU8(entries['ppt/diagrams/data1.xml']).replace('<a:t>Run</a:t>', '<a:t>Run the pilot</a:t>'));
  const back = await fromPptx(zipSync(entries));
  // The chevrons are shapes here (C03), which without OPF's tags are no SmartArt to read: the data models are the two flows.
  assert.deepEqual(back.slides.slice(1).map(slide => [String(slide.layout).replace(/^default:/, ''), listOf(slide)]),
    [['process', ['Research', 'Design', 'Run the pilot', 'Review']], ['vertical-process', items['vertical-process']]]);
  assert.equal(JSON.stringify(back).includes('layoutDef'), false, 'the layout part is never stored');
}

// 4. Native shapes: chevrons with core's adjustment, rounded boxes and rightArrows (turned in a vertical flow), consumed on import.
{
  const shapes = await exported(deck, {smartArt: 'shapes'});
  assert.equal(Object.keys(shapes.entries).some(path => path.startsWith('ppt/diagrams/')), false);
  const shape = (slide, role) => [...shapes.text(`ppt/slides/slide${slide}.xml`).matchAll(new RegExp(`<p:sp>(?:(?!</p:sp>)[\\s\\S])*?name="OPF arrangement slides\\.${slide - 1}\\.items ${role} \\d"[\\s\\S]*?</p:sp>`, 'g'))].map(match => match[0]);
  const chevrons = shape(1, 'node');
  assert.equal(chevrons.length, 4);
  for (const node of chevrons) assert.match(node, /<a:prstGeom prst="chevron"><a:avLst><a:gd name="adj" fmla="val 50000"\/><\/a:avLst><\/a:prstGeom>/);
  assert.equal(shape(2, 'node').length, 4);
  const arrows = shape(2, 'arrow');
  assert.equal(arrows.length, 3);
  for (const arrow of arrows) assert.match(arrow, /<a:prstGeom prst="rightArrow"><a:avLst><a:gd name="adj1" fmla="val 60000"\/><a:gd name="adj2" fmla="val 50000"\/><\/a:avLst><\/a:prstGeom>/);
  assert.ok(shape(3, 'arrow').every(arrow => /<a:xfrm rot="5400000"/.test(arrow)), 'a vertical flow\'s arrows point down');
  const back = await fromPptx(shapes.bytes);
  assert.deepEqual(back.slides.map(slide => [slide.layout, listOf(slide)]), Object.entries(items));
}

// 5. Outside the domain: OPF's own design as native shapes with smartart-unavailable, and a right-to-left deck's chevrons point left.
{
  const long = await exported({slides: [{layout: 'chevrons', title: 'Long', items: ['Research the whole market first', 'Design the pilot with two teams', 'Run it']}]});
  const [unavailable] = long.diagnostics.filter(item => item.code === 'smartart-unavailable');
  assert.match(unavailable.message, /^The row of chevrons is exported as native shapes, not live SmartArt: .*so OPF's own row of chevrons is drawn; OPF's own layout does not hold it either: .+\.$/);
  assert.equal(Object.keys(long.entries).some(path => path.startsWith('ppt/diagrams/')), false);
  const arabic = await exported({language: {bcp47: 'ar', name: 'Arabic', direction: 'rtl', script: 'Arab'}, slides: [{layout: 'chevrons', title: 'المراحل', items: ['الرؤية', 'الأهداف', 'البرامج']}]});
  assert.match(arabic.diagnostics.find(item => item.code === 'smartart-unavailable').reason, /right-to-left/);
  const slide = arabic.text('ppt/slides/slide1.xml');
  assert.equal((slide.match(/<a:xfrm flipH="1">(?:(?!<\/a:xfrm>)[\s\S])*<\/a:xfrm><a:prstGeom prst="chevron">/g) ?? []).length, 3, 'mirrored chevrons');
}

// 6. List blocks are the entries: cards with arrows as native shapes, never live (a SmartArt node holds no list), with the reason.
{
  // A region whose arrangement is process (the 0.34 flow layout's record) draws list blocks on cards.
  const basicProcess = {name: 'Basic process', direction: 'column', regions: [{name: 'title'}, {name: 'body', accepts: ['list'], max: 1, arrangement: 'process'}]};
  const blocks = await exported({catalogs: {custom: {layouts: {'basic-process': basicProcess}}}, slides: [{layout: 'basic-process', title: 'Workstreams', blocks: [{items: ['Interview users', 'Map the journey']}, {items: ['Prototype', 'Test']}, {items: ['Decide', 'Plan']}]}]});
  assert.match(blocks.diagnostics.find(item => item.code === 'smartart-unavailable')?.reason ?? '', /lists, which a SmartArt node does not hold/);
  assert.equal(Object.keys(blocks.entries).some(path => path.startsWith('ppt/diagrams/')), false);
  const slide = blocks.text('ppt/slides/slide1.xml');
  assert.equal((slide.match(/name="OPF arrangement slides\.0\.blocks\.0\.items node \d"/g) ?? []).length, 3, 'one card per block');
  assert.equal((slide.match(/name="OPF arrangement slides\.0\.blocks\.0\.items arrow \d"/g) ?? []).length, 2, 'an arrow between two cards');
}

console.log('SH-17 SmartArt passed: a short row of chevrons as OPF\'s own shapes (C03), live Basic Process and Vertical Process with fallback pictures (data model, OPF colors with the arrows, drawing, no layout part), the round trip from the frame and from the picture alone, PowerPoint-style data models and an edited node, native shapes, the domain fallback, mirrored chevrons and list blocks as cards.');
