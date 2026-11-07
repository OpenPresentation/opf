// SH-18: a cycle (a layout region's `arrangement: "cycle"`) exports as live SmartArt of PowerPoint's Basic Cycle (cycle2) where it lies in
// core's SmartArt domain: the data model, OPF's colors and quick style (the arrows are the sibTrans2D1 label, the primary lightened 40%
// without an outline), a drawing from core's geometry (circles and turned rightArrow shapes), no layout part, and SH-16's fallback picture
// in an mc:AlternateContent. Outside the domain it is native shapes (OPF's ring or loop, or PowerPoint's geometry), with
// smartart-unavailable. A cycle OPF wrote imports back as its list on the cycle layout, from the mc:Choice, from the fallback picture
// alone and from its native shapes; a PowerPoint-style cycle2 data model imports its nodes, and no layout part is ever stored.
import assert from 'node:assert/strict';
import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';
import {XMLValidator} from 'fast-xml-parser';
import {fromPptx, toPptx} from './helpers/default-catalog.mjs';

const options = {seed: 1818, timestamp: '2026-11-06T00:00:00Z', zipDate: '2026-11-06T00:00:00Z'};
const short = ['Plan', 'Build', 'Ship', 'Learn'], long = ['Clear purpose', 'Shared goals', 'Team habits', 'Weekly reviews', 'Open roadmap'];
const deck = {slides: [{layout: 'cycle', title: 'The loop', items: short}, {layout: 'cycle', title: 'Two', items: ['Plan', 'Do']}]};
const exported = async (document, extra = {}) => {
  const diagnostics = [], bytes = new Uint8Array(await toPptx(document, {...options, ...extra, onDiagnostic: diagnostic => diagnostics.push(diagnostic)}));
  const entries = unzipSync(bytes);
  for (const [path, data] of Object.entries(entries)) if (/\.(xml|rels)$/.test(path)) assert.equal(XMLValidator.validate(strFromU8(data)), true, path);
  return {bytes, entries, diagnostics, text: path => strFromU8(entries[path])};
};
const itemsOf = slide => slide.items ?? slide.blocks?.[0]?.items;

// 1. Live SmartArt: Basic Cycle's data model, OPF's parts, the drawing with circles and arrows, the fallback picture, no layout part.
const live = await exported(deck);
{
  const {entries, text} = live;
  assert.equal(live.diagnostics.filter(item => item.code === 'smartart-unavailable').length, 0, 'both are in the domain');
  assert.equal(Object.keys(entries).some(path => /^ppt\/diagrams\/layout/.test(path)), false, 'no layout definition is written');
  const slide = text('ppt/slides/slide1.xml');
  assert.match(slide, /<mc:AlternateContent [^>]*><mc:Choice [^>]*Requires="dgm1612"><p:graphicFrame>[\s\S]*?r:lo=""[\s\S]*?<\/mc:Choice><mc:Fallback><p:pic>/);
  assert.match(slide, /descr="Cycle of 4 steps, clockwise from the top, the last leading back to the first:&#10;Plan&#10;Build&#10;Ship&#10;Learn"/, 'the outline as alt text');
  const data = text('ppt/diagrams/data1.xml');
  assert.match(data, /loTypeId="urn:microsoft\.com\/office\/officeart\/2005\/8\/layout\/cycle2" loCatId="cycle"/);
  assert.equal((data.match(/<dgm:prSet custT="1"\/>/g) ?? []).length, 4);
  const sizes = [...data.matchAll(/<a:rPr lang="[^"]+" sz="(\d+)"/g)].map(match => match[1]);
  assert.equal(sizes.length, 4); assert.equal(new Set(sizes).size, 1, 'one size for every node');
  assert.deepEqual([...data.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(match => match[1]), short);
  assert.equal((data.match(/type="sibTrans"/g) ?? []).length, 4, 'a transition after every node, the last one closing the loop');
  // The arrows' label: the primary lightened 40%, no outline.
  assert.match(text('ppt/diagrams/colors1.xml'), /<dgm:styleLbl name="sibTrans2D1"><dgm:fillClrLst meth="repeat"><a:schemeClr val="accent1"><a:lumMod val="60000"\/><a:lumOff val="40000"\/><\/a:schemeClr><\/dgm:fillClrLst><dgm:linClrLst meth="repeat"><a:schemeClr val="bg1"><a:alpha val="0"\/>/);
  assert.match(text('ppt/diagrams/quickStyle1.xml'), /<dgm:styleLbl name="sibTrans2D1">[\s\S]*?<a:lnRef idx="0">[\s\S]*?<a:fillRef idx="1">/);
  assert.match(text('ppt/diagrams/quickStyle1.xml'), /<dgm:styleLbl name="node1">[\s\S]*?<a:lnRef idx="3">/, 'the circles keep the 1.5 pt outline');
  // The drawing: four circles and four arrows, each arrow after its circle, turned along the cycle with PowerPoint's adjustments.
  const drawing = text('ppt/diagrams/drawing1.xml'), shapes = [...drawing.matchAll(/<dsp:sp\b[\s\S]*?<\/dsp:sp>/g)].map(match => match[0]);
  assert.deepEqual(shapes.map(shape => /prst="(\w+)"/.exec(shape)[1]), ['ellipse', 'rightArrow', 'ellipse', 'rightArrow', 'ellipse', 'rightArrow', 'ellipse', 'rightArrow']);
  assert.deepEqual(shapes.filter((_, index) => index % 2).map(shape => Number(/<a:xfrm rot="(\d+)"/.exec(shape)[1])), [2700000, 8100000, 13500000, 18900000]);
  for (const arrow of shapes.filter((_, index) => index % 2)) assert.match(arrow, /<a:gd name="adj1" fmla="val 60000"\/><a:gd name="adj2" fmla="val 50000"\/>[\s\S]*<a:ln><a:noFill\/><\/a:ln>/);
  // Two entries: left and right, the arrows over and under the gap, the lower one turned back.
  const two = [...text('ppt/diagrams/drawing2.xml').matchAll(/<dsp:sp\b[\s\S]*?<\/dsp:sp>/g)].map(match => match[0]);
  assert.equal(two.length, 4);
  assert.doesNotMatch(two[1], /rot="/); assert.match(two[3], /<a:xfrm rot="10800000">/);
}

// 2. The round trip: from the mc:Choice, and from the fallback picture alone (an app without SmartArt saved the file).
{
  const back = await fromPptx(live.bytes);
  assert.deepEqual(back.slides.map(slide => [slide.layout, itemsOf(slide)]), [['cycle', short], ['cycle', ['Plan', 'Do']]]);
  const entries = {...live.entries};
  for (const part of ['ppt/slides/slide1.xml', 'ppt/slides/slide2.xml']) entries[part] = strToU8(strFromU8(entries[part]).replace(/<mc:AlternateContent\b[\s\S]*?<mc:Fallback>([\s\S]*?)<\/mc:Fallback><\/mc:AlternateContent>/g, '$1'));
  for (const path of Object.keys(entries)) if (/^ppt\/diagrams\//.test(path)) delete entries[path];
  for (const path of Object.keys(entries).filter(path => /^ppt\/slides\/_rels\/slide\d+\.xml\.rels$/.test(path))) entries[path] = strToU8(strFromU8(entries[path]).replace(/<Relationship [^>]*Target="\.\.\/diagrams\/[^"]+"\/>/g, ''));
  entries['[Content_Types].xml'] = strToU8(strFromU8(entries['[Content_Types].xml']).replace(/<Override PartName="\/ppt\/diagrams\/[^"]+" ContentType="[^"]+"\/>/g, ''));
  const fallbackOnly = await fromPptx(zipSync(entries));
  assert.deepEqual(fallbackOnly.slides.map(slide => [slide.layout, itemsOf(slide)]), [['cycle', short], ['cycle', ['Plan', 'Do']]]);
}

// 3. A PowerPoint-style Basic Cycle (no OPF provenance, presentation points, cxn out of order, a layout part): its nodes, never the layout part.
{
  const entries = unzipSync((await exported(deck, {provenance: false})).bytes);
  let data = strFromU8(entries['ppt/diagrams/data1.xml']);
  const connections = [...data.matchAll(/<dgm:cxn [^>]*\/>/g)].map(match => match[0]);
  data = data.replace(/<dgm:cxnLst>[\s\S]*<\/dgm:cxnLst>/, `<dgm:cxnLst>${[...connections].reverse().join('')}<dgm:cxn modelId="{F}" type="presOf" srcId="x" destId="y" srcOrd="0" destOrd="0"/></dgm:cxnLst>`)
    .replace('</dgm:ptLst>', '<dgm:pt modelId="{P}" type="pres"><dgm:prSet presName="node" presStyleLbl="node1"/><dgm:spPr/></dgm:pt></dgm:ptLst>')
    .replace('<a:t>Ship</a:t>', '<a:t>Sh</a:t></a:r><a:r><a:rPr lang="en-US" i="1"/><a:t>ip</a:t>');
  entries['ppt/diagrams/data1.xml'] = strToU8(data);
  entries['ppt/diagrams/layout1.xml'] = strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><dgm:layoutDef xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram" uniqueId="test"/>');
  const back = await fromPptx(zipSync(entries));
  assert.equal(String(back.slides[0].layout).replace(/^default:/, ''), 'cycle');
  assert.deepEqual(itemsOf(back.slides[0]), ['Plan', 'Build', [{text: 'Sh'}, {text: 'ip', italic: true}], 'Learn'], 'cxn order and run properties');
  assert.equal(JSON.stringify(back).includes('layoutDef'), false, 'the layout part is never stored');
}

// 4. Native shapes ("shapes"): circles and turned rightArrow presets under the measured lines; they import as the layout's drawing.
{
  const shapes = await exported(deck, {smartArt: 'shapes'});
  assert.equal(Object.keys(shapes.entries).some(path => path.startsWith('ppt/diagrams/')), false);
  const slide = shapes.text('ppt/slides/slide1.xml');
  const named = role => [...slide.matchAll(new RegExp(`<p:sp>(?:(?!<\\/p:sp>)[\\s\\S])*?name="OPF arrangement slides\\.0\\.items ${role} \\d"[\\s\\S]*?<\\/p:sp>`, 'g'))].map(match => match[0]);
  assert.equal(named('node').length, 4);
  for (const node of named('node')) assert.match(node, /<a:prstGeom prst="ellipse">/);
  const arrows = named('arrow');
  assert.equal(arrows.length, 4);
  for (const arrow of arrows) assert.match(arrow, /<a:xfrm rot="\d+">[\s\S]*<a:prstGeom prst="rightArrow"><a:avLst><a:gd name="adj1" fmla="val 60000"\/><a:gd name="adj2" fmla="val 50000"\/><\/a:avLst><\/a:prstGeom>/);
  assert.ok(slide.indexOf('items node 0"') < slide.indexOf('items arrow 0"') && slide.indexOf('items arrow 0"') < slide.indexOf('items node 1"'), 'each arrow after its circle');
  const back = await fromPptx(shapes.bytes);
  assert.deepEqual(back.slides.map(slide => [slide.layout, itemsOf(slide)]), [['cycle', short], ['cycle', ['Plan', 'Do']]]);
}

// 5. Outside the domain: entries PowerPoint's circles do not hold are OPF's own cycle, native shapes, with smartart-unavailable; so is a
//    right-to-left deck (its cycle runs counterclockwise).
{
  const own = await exported({slides: [{layout: 'cycle', title: 'The loop', items: long}]});
  const [unavailable] = own.diagnostics.filter(item => item.code === 'smartart-unavailable');
  assert.match(unavailable.reason, /Basic Cycle[\s\S]*so OPF's own cycle is drawn/);
  assert.equal(Object.keys(own.entries).some(path => path.startsWith('ppt/diagrams/')), false);
  const slide = own.text('ppt/slides/slide1.xml');
  assert.equal((slide.match(/name="OPF arrangement slides\.0\.items node \d"/g) ?? []).length, 5);
  assert.equal((slide.match(/name="OPF arrangement slides\.0\.items arrow \d"/g) ?? []).length, 5);
  const back = await fromPptx(own.bytes);
  assert.deepEqual([back.slides[0].layout, itemsOf(back.slides[0])], ['cycle', long]);
  const rtl = await exported({language: {bcp47: 'ar', name: 'Arabic', direction: 'rtl', script: 'Arab'}, slides: [{layout: 'cycle', title: 'الدورة', items: ['خطة', 'بناء', 'إطلاق']}]});
  assert.match(rtl.diagnostics.find(item => item.code === 'smartart-unavailable').reason, /right-to-left/);
}

console.log('SH-18 SmartArt passed: live Basic Cycle (data model, arrow label, drawing with turned arrows, fallback picture, no layout part), the round trip from the choice and the fallback alone, a PowerPoint-style data model, native shapes and the domain fallback.');
