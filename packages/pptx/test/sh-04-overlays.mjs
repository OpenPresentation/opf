// SH-04: the slide's overlay in the PPTX export: overlay shapes as native p:sp (the shape block writer), connectors as p:cxnSp with
// PowerPoint's own connector preset in core's frame (a:xfrm rot, flipH, flipV) with core's a:avLst and the shape line (arrowheads,
// dash), glued to the native shapes at their ends (a:stCxn, a:endCxn: the shapes' ids and core's site indexes), over everything else in
// array order. PowerPoint's own reading of the glue (ConnectorFormat, and a connector following a moved shape) is the COM evidence in
// the SH-04 pull request.
import assert from 'node:assert/strict';
import { unzipSync } from 'fflate';
import { composeSlide } from '@openpresentation/opf/composition';
import { toPptx } from '../dist/index.js';

const scheme = { name: 'Test', dark1: '#101820', light1: '#FFFFFF', dark2: '#2A3440', light2: '#E8E4DC', accent1: '#1F5AA6', accent2: '#4A7A3A', accent3: '#B05A2A', accent4: '#7A4A9A', accent5: '#C0C8D0', accent6: '#5A8A9A', hyperlink: '#1F5AA6', followedHyperlink: '#7A4A9A' };
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const slide = (shapes, blocks) => ({ title: 'Flow', blocks: blocks ?? [{ id: 'plan', shape: 'roundRect', text: 'Plan' }, { id: 'ship', shape: 'ellipse', text: 'Ship' }], shapes });
const deck = (shapes, blocks) => ({ name: 'Overlays', language: 'en-US', design: { colorScheme: scheme }, slides: [slide(shapes, blocks)] });
const decode = bytes => new TextDecoder().decode(bytes);
const emu = px => Math.round(px * 9525);
async function exported(shapes, blocks) {
  const entries = unzipSync(await toPptx(deck(shapes, blocks), { imageFormat: 'preserve' }));
  const xml = decode(entries['ppt/slides/slide1.xml']);
  const ids = new Map([...xml.matchAll(/<p:cNvPr\b[^>]*?\bid="(\d+)"[^>]*?\bname="([^"]*)"/g)].map(match => [match[2], match[1]]));
  const connectors = [...xml.matchAll(/<p:cxnSp>[\s\S]*?<\/p:cxnSp>/g)].map(match => match[0]);
  return { xml, ids, connectors };
}
const overlay = (shapes, blocks) => composeSlide(slide(shapes, blocks), { presentation: deck(shapes, blocks) }).overlayShapes;

// An elbow between two shape blocks: one p:cxnSp, core's frame and preset with its adj1, the line with its arrowhead, glued to both.
{
  const shapes = [{ id: 'link', connector: { from: 'plan', to: 'ship', route: 'elbow' }, stroke: { width: 3, dash: 'dash', end: { type: 'triangle' } } }];
  const [composed] = overlay(shapes);
  const { xml, ids, connectors } = await exported(shapes);
  assert.equal(connectors.length, 1);
  const [connector] = connectors;
  assert.match(connector, /name="OPF connector slides\.0\.shapes\.0"/);
  assert.ok(connector.includes(`<a:off x="${emu(composed.box.x)}" y="${emu(composed.box.y)}"/><a:ext cx="${emu(composed.box.width)}" cy="${emu(composed.box.height)}"/>`));
  assert.ok(connector.includes(`<a:prstGeom prst="${composed.preset}">`));
  if (composed.avLst.adj1 !== undefined) assert.ok(connector.includes(`<a:gd name="adj1" fmla="val ${composed.avLst.adj1}"/>`));
  assert.match(connector, /<a:ln w="28575"[^>]*>[\s\S]*<a:prstDash val="dash"\/>[\s\S]*<a:tailEnd type="triangle" w="med" len="med"\/>/);
  assert.ok(connector.includes(`<a:stCxn id="${ids.get('OPF shape slides.0.blocks.0.shape')}" idx="${composed.from.site}"/>`));
  assert.ok(connector.includes(`<a:endCxn id="${ids.get('OPF shape slides.0.blocks.1.shape')}" idx="${composed.to.site}"/>`));
  // No placeholder line is left, and the connector is drawn after the blocks.
  assert.ok(!/<p:sp>(?:(?!<\/p:sp>)[\s\S])*name="OPF connector /.test(xml));
  assert.ok(xml.indexOf('OPF connector slides.0.shapes.0') > xml.indexOf('OPF shape slides.0.blocks.1.shape'));
}

// A frame turned a quarter (an elbow that leaves its start vertically) and flipped (a line running left or up) keeps core's rot and flips.
{
  const blocks = [{ id: 'a', shape: 'rect', text: 'A' }, { id: 'b', shape: 'rect', text: 'B' }];
  for (const [route, fromSite, toSite] of [['elbow', 2, 2], ['straight', 1, 3], ['curved', 0, 2]]) {
    const shapes = [{ connector: { from: 'b', to: 'a', route, fromSite, toSite } }];
    const [composed] = overlay(shapes, blocks);
    const { connectors } = await exported(shapes, blocks);
    const attributes = `${composed.rotate ? ` rot="${composed.rotate * 60000}"` : ''}${composed.flipH ? ' flipH="1"' : ''}${composed.flipV ? ' flipV="1"' : ''}`;
    assert.ok(connectors[0].includes(`<a:xfrm${attributes}>`), `${route}: ${attributes}`);
    assert.ok(connectors[0].includes(`<a:prstGeom prst="${composed.preset}">`), route);
  }
}

// An overlay shape is a native shape named for its entry, drawn with the shape block writer; a connector glues to it, to a picture and to
// a block's card. A text block drawn as line boxes does not glue.
{
  const blocks = [{ id: 'photo', image: { src: PNG, alt: 'A picture' } }, { id: 'note', text: 'A line of text' }];
  const shapes = [
    { id: 'label', shape: 'roundRect', text: 'Label', x: 0.7, y: 0.1, width: 0.2, height: 0.1, style: 'subtle' },
    { connector: { from: 'label', to: 'photo', route: 'elbow' } },
    { connector: { from: 'label', to: 'note', route: 'straight' }, alt: 'Label to note' },
  ];
  const { xml, ids, connectors } = await exported(shapes, blocks);
  assert.match(xml, /<p:sp>(?:(?!<\/p:sp>)[\s\S])*name="OPF shape slides\.0\.shapes\.0"(?:(?!<\/p:sp>)[\s\S])*<a:prstGeom prst="roundRect">/);
  const picture = [...ids.keys()].find(name => /^OPF image \d+$/.test(name));
  assert.ok(picture);
  assert.ok(connectors[0].includes(`<a:stCxn id="${ids.get('OPF shape slides.0.shapes.0')}"`));
  assert.ok(connectors[0].includes(`<a:endCxn id="${ids.get(picture)}"`));
  assert.ok(connectors[1].includes('<a:stCxn ') && !connectors[1].includes('<a:endCxn '));
  assert.match(connectors[1], /descr="Label to note"/);
}

// A hidden or decorative connector, and a sketched one: hidden="1", the decorative extension, and the sketch's geometry in the frame.
{
  const shapes = [
    { connector: { from: 'plan', to: 'ship' }, hidden: true },
    { connector: { from: 'plan', to: 'ship' }, decorative: true },
    { connector: { from: 'plan', to: 'ship', route: 'curved' }, stroke: { sketch: 'curved' } },
  ];
  const { connectors } = await exported(shapes);
  assert.match(connectors[0], /<p:cNvPr id="\d+" name="[^"]+" hidden="1"/);
  assert.match(connectors[1], /decorative/);
  assert.match(connectors[2], /<ask:lineSketchStyleProps [^>]*sd="\d+"><a:custGeom>[\s\S]*<ask:lineSketchCurved\/>/);
}

// A slide without shapes has no connectors and the same shapes as before.
{
  const { connectors, xml } = await exported(undefined);
  assert.equal(connectors.length, 0);
  assert.ok(!xml.includes('slides.0.shapes.'));
}

console.log('sh-04 overlays (pptx): ok');

// The back layer is written before the content shapes, the front layer after them; a connector glued to a back shape keeps its glue.
{
  const shapes = [{ id: 'panel', layer: 'back', shape: 'rect', x: 0, y: 0.2, width: 1, height: 0.6 }, { connector: { from: 'panel', to: 'ship' } }, { id: 'badge', shape: 'ellipse', x: 0.1, y: 0.1, width: 0.05, height: 0.08 }];
  const { xml, ids, connectors } = await exported(shapes);
  const at = (name) => xml.indexOf(`name="${name}"`);
  assert.ok(at('OPF shape slides.0.shapes.0') < at('OPF shape slides.0.blocks.0.shape'));
  assert.ok(at('OPF shape slides.0.shapes.2') > at('OPF shape slides.0.blocks.1.shape'));
  assert.ok(connectors[0].includes(`<a:stCxn id="${ids.get('OPF shape slides.0.shapes.0')}"`));
  console.log('sh-04 overlay layers (pptx): ok');
}
