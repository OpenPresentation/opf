// SH-02: shape blocks export as native PowerPoint shapes: a:prstGeom with core's adjust values (or a:custGeom), the fill, a:ln with
// every stroke property, p:style for the theme style, the text in the shape's own p:txBody (anchor, insets, vert, never autofit),
// alt text, decorative, hidden and the click link; lighter and darker colors as a:lumMod and a:lumOff; and the picture stroke.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { unzipSync } from 'fflate';
import { composeSlide } from '@openpresentation/opf/composition';
import { toPptx } from '../dist/index.js';

const scheme = { name: 'Test', dark1: '#101820', light1: '#FFFFFF', dark2: '#2A3440', light2: '#E8E4DC', accent1: '#1F5AA6', accent2: '#4A7A3A', accent3: '#B05A2A', accent4: '#7A4A9A', accent5: '#C0C8D0', accent6: '#5A8A9A', hyperlink: '#1F5AA6', followedHyperlink: '#7A4A9A' };
const deck = (blocks) => ({ name: 'Shapes', language: 'en-US', design: { colorScheme: scheme }, slides: [{ title: 'Shapes', blocks }] });
const decode = bytes => new TextDecoder().decode(bytes);
async function exported(blocks) {
  const entries = unzipSync(await toPptx(deck(blocks), { imageFormat: 'preserve' }));
  const slide = decode(entries['ppt/slides/slide1.xml']);
  const shapes = [...slide.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(match => match[0]).filter(shape => /name="OPF shape /.test(shape));
  return { entries, slide, shapes, rels: decode(entries['ppt/slides/_rels/slide1.xml.rels']) };
}
const emu = px => Math.round(px * 9525);

// A preset with adjust values: one native shape at core's frame, the preset and its avLst in DrawingML units, the moderate style's fill,
// line and references, and the text in its own body: centered, middle-anchored, PowerPoint's insets, no autofit.
{
  const blocks = [{ shape: 'roundRect', adjust: { adj: 0.3 }, text: 'Plan' }];
  const item = composeSlide(deck(blocks).slides[0], { presentation: deck(blocks) }).items.find(entry => entry.field === 'shape');
  const { shapes } = await exported(blocks);
  assert.equal(shapes.length, 1);
  const [shape] = shapes;
  assert.match(shape, /name="OPF shape slides\.0\.blocks\.0\.shape"/);
  assert.ok(shape.includes(`<a:off x="${emu(item.shape.box.x)}" y="${emu(item.shape.box.y)}"/><a:ext cx="${emu(item.shape.box.width)}" cy="${emu(item.shape.box.height)}"/>`));
  assert.match(shape, /<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val 30000"\/><\/a:avLst><\/a:prstGeom>/);
  assert.match(shape, /<a:solidFill><a:schemeClr val="accent1"\/?>(<\/a:schemeClr>)?<\/a:solidFill>/);
  assert.match(shape, /<a:ln w="12700" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="accent1"><a:lumMod val="50000"\/><\/a:schemeClr><\/a:solidFill><a:prstDash val="solid"\/><a:miter lim="800000"\/><\/a:ln>/);
  assert.match(shape, /<a:effectLst\/>/);
  assert.match(shape, /<p:style><a:lnRef idx="2">[\s\S]*<a:fillRef idx="1">[\s\S]*<a:effectRef idx="0">[\s\S]*<a:fontRef idx="minor">/);
  assert.match(shape, /<a:bodyPr [^>]*vert="horz" wrap="square" lIns="91440" tIns="45720" rIns="91440" bIns="45720"[^>]*anchor="ctr"[^>]*><a:prstTxWarp prst="textNoShape"><a:avLst\/><\/a:prstTxWarp><a:noAutofit\/><\/a:bodyPr>/);
  assert.match(shape, /<a:pPr algn="ctr"/);
  assert.match(shape, /<a:t>Plan<\/a:t>/);
  assert.ok(!/txBox="1"/.test(shape), 'a shape, not a text box');
  assert.ok(!/normAutofit|spAutoFit/.test(shape));
}

// Every stroke property, a gradient fill, rotation and flip, the text anchor, insets and direction.
{
  const { shapes } = await exported([
    { shape: 'rect', style: 'none', rotate: 30, flip: 'both', fill: { gradient: { type: 'linear', angle: 45, stops: [{ color: 'accent1', position: 0 }, { color: '#FFFFFF80', position: 1 }] } },
      stroke: { color: 'accent2', width: 4, dash: 'longDashDot', cap: 'round', join: 'miter', miterLimit: 4, compound: 'thickThin', align: 'inside', sketch: 'freehand' },
      text: 'Up', anchor: 'bottom', padding: { top: 2, right: 3, bottom: 4, left: 5 }, textDirection: 'vertical270' },
    { shape: 'arc', fill: 'none', stroke: { color: 'accent3', width: 2, dash: [4, 2, 1], start: { type: 'oval', width: 'small' }, end: { type: 'stealth', length: 'large' } } },
  ]);
  const [rect, arc] = shapes;
  assert.match(rect, /<a:xfrm rot="1800000" flipH="1" flipV="1">/);
  assert.match(rect, /<a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="accent1"\/?>(<\/a:schemeClr>)?<\/a:gs><a:gs pos="100000"><a:srgbClr val="FFFFFF"><a:alpha val="50196"\/><\/a:srgbClr><\/a:gs><\/a:gsLst><a:lin ang="2700000" scaled="0"\/><\/a:gradFill>/);
  assert.match(rect, /<a:ln w="38100" cap="rnd" cmpd="thickThin" algn="in"><a:solidFill><a:schemeClr val="accent2"\/?>(<\/a:schemeClr>)?<\/a:solidFill><a:prstDash val="lgDashDot"\/><a:miter lim="400000"\/>/);
  assert.match(rect, /<ask:lineSketchStyleProps xmlns:ask="http:\/\/schemas.microsoft.com\/office\/drawing\/2018\/sketchyshapes" sd="\d+"><a:prstGeom prst="rect"><a:avLst\/><\/a:prstGeom><ask:type><ask:lineSketchFreehand\/><\/ask:type>/);
  assert.match(rect, /vert="vert270"[^>]*lIns="47625" tIns="19050" rIns="28575" bIns="38100"[^>]*anchor="b"/);
  assert.ok(!/<p:style>/.test(rect), 'style none writes no theme references');
  assert.match(arc, /<a:custDash><a:ds d="400000" sp="200000"\/><a:ds d="100000" sp="400000"\/><a:ds d="200000" sp="100000"\/><\/a:custDash>/);
  assert.match(arc, /<a:headEnd type="oval" w="sm" len="med"\/><a:tailEnd type="stealth" w="med" len="lg"\/>/);
}

// A custom path is a:custGeom in the frame's own units; a pattern fill is a:pattFill.
{
  const { shapes } = await exported([{ path: 'M0 0 L1 0 L0.5 1 Z', fill: { pattern: { preset: 'ltUpDiag', foregroundColor: 'accent1', backgroundColor: 'light1' } } }]);
  const [shape] = shapes;
  assert.match(shape, /<a:custGeom><a:avLst\/><a:gdLst\/><a:ahLst\/><a:cxnLst\/><a:rect l="l" t="t" r="r" b="b"\/><a:pathLst><a:path w="\d+" h="\d+"><a:moveTo><a:pt x="0" y="0"\/><\/a:moveTo><a:lnTo>/);
  assert.match(shape, /<a:close\/><\/a:path><\/a:pathLst><\/a:custGeom>/);
  assert.match(shape, /<a:pattFill prst="ltUpDiag"><a:fgClr><a:schemeClr val="accent1"\/?>(<\/a:schemeClr>)?<\/a:fgClr><a:bgClr>/);
}

// Accessibility and the click link: descr, the decorative extension, hidden, and a:hlinkClick with its external relationship.
{
  const { shapes, rels } = await exported([
    { shape: 'rect', alt: 'A box', link: 'https://example.com/pricing', text: 'Pricing' },
    { shape: 'ellipse', decorative: true },
    { shape: 'star5', hidden: true },
  ]);
  const [linked, decorative, hidden] = shapes;
  assert.match(linked, /descr="A box"/);
  const rid = linked.match(/<a:hlinkClick r:id="(rId\d+)"\/>/)?.[1];
  assert.ok(rid, 'the shape has a click link');
  assert.match(rels, new RegExp(`<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.com/pricing" TargetMode="External"/>`));
  assert.ok(!/<a:rPr[^>]*>[^]*?<a:hlinkClick/.test(linked.replace(/<p:nvSpPr>[\s\S]*?<\/p:nvSpPr>/, '')), 'the runs are not linked');
  assert.match(decorative, /<adec:decorative xmlns:adec="http:\/\/schemas.microsoft.com\/office\/drawing\/2017\/decorative" val="1"\/>/);
  assert.match(hidden, /<p:cNvPr [^>]*hidden="1"/);
}

// Lighter and darker colors: the base scheme color with a:lumMod and a:lumOff, also on a literal base.
{
  const { shapes } = await exported([
    { shape: 'rect', fill: { color: 'accent2', lighten: 0.4 }, stroke: { color: { color: '#0F4C81', darken: 0.25 }, width: 2 } },
  ]);
  assert.match(shapes[0], /<a:solidFill><a:schemeClr val="accent2"><a:lumMod val="60000"\/><a:lumOff val="40000"\/><\/a:schemeClr><\/a:solidFill>/);
  assert.match(shapes[0], /<a:srgbClr val="0F4C81"><a:lumMod val="75000"\/><\/a:srgbClr>/);
}

// A picture's stroke (renamed from border) is an a:ln with the same vocabulary, on its preset mask.
{
  const uri = `data:image/png;base64,${(await readFile(new URL('fixtures/images/square.png', import.meta.url))).toString('base64')}`;
  const { slide } = await exported([{ image: uri, shape: 'hexagon', stroke: { color: 'accent1', width: 3, dash: 'sysDash', join: 'round' } }]);
  const picture = slide.match(/<p:pic>[\s\S]*?<\/p:pic>/)[0];
  assert.match(picture, /<a:prstGeom prst="hexagon">/);
  assert.match(picture, /<a:ln w="28575" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="accent1"\/?>(<\/a:schemeClr>)?<\/a:solidFill><a:prstDash val="sysDash"\/><a:round\/><\/a:ln>/);
}

console.log('sh-02 shape blocks: ok');
