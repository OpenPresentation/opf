// SH-05: the shapes of a deck PowerPoint wrote import as OPF shapes. test/fixtures/powerpoint-shapes.pptx was built through PowerPoint's own
// object model (Shapes.AddShape over many MsoAutoShapeType values, adjustments, gradients, a pattern, dashes, arrowheads, shadow, glow, soft
// edge, reflection, 3-D, AddConnector with BeginConnect and EndConnect, a group, rotation and flips): free-positioned shapes become overlay
// shapes placed by fractions of the slide, connectors become connectors bound by id (a free end is a line shape), a group is flattened with its
// transform applied, and what OPF does not represent is reported (`shape-property-dropped`, naming the property) and dropped.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { unzipSync, zipSync } from 'fflate';
import { composeSlide } from '@openpresentation/opf/composition';
import { validate } from '@openpresentation/opf';
import { fromPptx, toPptx } from '../dist/index.js';
import { frameOnSlide, readColor, readCustomGeometry, shapeRole } from '../dist/shape-import.js';

const diagnostics = [];
const bytes = await readFile(new URL('fixtures/powerpoint-shapes.pptx', import.meta.url));
const imported = await fromPptx(bytes, { onDiagnostic: item => diagnostics.push(item) });
const [autoshapes, fills, effects, connectors] = imported.slides;
const near = (actual, expected, tolerance = 0.002) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);

// The fixture imports valid, composes, and exports again; no shape is a "PowerPoint shape:" text block.
assert.equal(validate(imported, { only: ['format'] }).valid, true);
assert.ok(!JSON.stringify(imported).includes('PowerPoint shape:'));
for (const [index, slide] of imported.slides.entries()) assert.ok(composeSlide(slide, { presentation: imported }).overlayShapes.length > 0, `slide ${index} draws its overlay`);
assert.ok((await toPptx(imported)).length > 0);
assert.deepEqual(diagnostics.filter(item => item.code === 'shape-property-dropped').map(item => [item.property, item.shape]), [['3-D format', 'Effect 3-D bevel']]);
assert.ok(!diagnostics.some(item => item.code === 'grouped-text-reflow'), 'a group of shapes is flattened, not a reflow risk');

// Slide 1: twenty autoshapes in a grid, placed by fractions; PowerPoint's default style is OPF's default (`moderate`), so a bare shape stays bare.
assert.deepEqual(autoshapes.shapes.map(shape => shape.shape), ['rect', 'roundRect', 'ellipse', 'triangle', 'diamond', 'hexagon', 'can', 'cube', 'rightArrow', 'chevron', 'star5', 'wedgeRectCallout', 'flowChartDecision', 'heart', 'donut', 'pie', 'blockArc', 'teardrop', 'cloud', 'smileyFace']);
assert.deepEqual(autoshapes.shapes[0], { x: 0.041667, y: 0.055556, width: 0.145833, height: 0.166667, shape: 'rect', text: 'Plan' });
assert.deepEqual(autoshapes.shapes[1].adjust, { adj: 0.3 });
assert.deepEqual(autoshapes.shapes[8].adjust, { adj1: 0.35, adj2: 0.6 });
assert.deepEqual(autoshapes.shapes[10].adjust, { adj: 0.35 });
assert.deepEqual(autoshapes.shapes[2].text, [{ text: 'Build', bold: true }]);
for (const shape of autoshapes.shapes) assert.ok(shape.style === undefined && shape.fill === undefined && shape.stroke === undefined, `${shape.shape} takes the theme style`);

// Slide 2: gradients, a pattern, a lighter theme color, transparency, no fill, dashes, a compound line, arrowheads on a line and an open arc.
{
  const [linear, radial, pattern, lighter, transparent, dashed, compound, none, line, arc] = fills.shapes;
  near(linear.fill.gradient.angle, 26.565, 0.01);
  assert.deepEqual(linear.fill.gradient.stops, [{ color: '#1F5AA6', position: 0 }, { color: '#C0C8D0', position: 1 }]);
  assert.equal(radial.fill.gradient.type, 'rectangle');
  assert.deepEqual(pattern.fill.pattern, { preset: 'ltDnDiag', foregroundColor: '#1F5AA6', backgroundColor: '#FFFFFF' });
  assert.deepEqual(lighter.fill, { color: 'accent1', lighten: 0.4 });
  assert.deepEqual([transparent.fill, transparent.opacity], ['#B05A2A', 0.5]);
  assert.deepEqual([dashed.fill, dashed.stroke], ['none', { color: '#1F5AA6', width: 6, dash: 'dash' }]);
  assert.deepEqual(compound.stroke, { color: '#4A7A3A', width: 8, compound: 'double' });
  assert.equal(none.stroke, 'none');
  assert.equal(line.shape, 'line');
  assert.deepEqual(line.stroke, { color: '#101820', width: 4, start: { type: 'arrow' }, end: { type: 'triangle', length: 'large' } });
  assert.equal(arc.shape, 'arc');
  assert.equal(arc.stroke.end.type, 'triangle');
}

// Slide 3: effects in OPF's own units, rotation, flips, and 3-D reported and dropped.
{
  const [shadow, glow, softEdge, reflection, bevel, rotated, flipped, both] = effects.shapes;
  near(shadow.shadow.blur, 10.667, 0.01);
  near(shadow.shadow.angle, 45, 0.01);
  assert.equal(shadow.shadow.color, undefined, 'a black shadow at the default opacity states neither');
  assert.deepEqual(glow.glow, { color: '#FFD666', opacity: 0.5, radius: 16 });
  near(softEdge.softEdge, 13.333, 0.01);
  assert.ok(reflection.reflection.size > 0.5);
  assert.deepEqual(bevel, { x: 0.041667, y: 0.37037, width: 0.197917, height: 0.185185, shape: 'roundRect' });
  assert.equal(rotated.rotate, 30);
  assert.equal(flipped.flip, 'horizontal');
  assert.deepEqual([both.rotate, both.flip], [20, 'vertical']);
}

// Slide 4: connectors bound to the shapes their ends are connected to (the sites as PowerPoint numbers them, from 0), a free connector as a
// line shape, and a group of two shapes flattened with its scale and rotation.
{
  const [a, b, c, d, straight, curved, elbow, free, member1, member2] = connectors.shapes;
  assert.deepEqual([a.id, b.id, c.id, d.id], ['box-a', 'box-b', 'oval-c', 'diamond-d']);
  assert.deepEqual(straight.connector, { from: 'box-a', to: 'box-b', fromSite: 3, toSite: 1 });
  assert.deepEqual(straight.stroke, { color: 'accent1', width: 3, end: { type: 'triangle' } });
  // PowerPoint routed this one as curvedConnector4 (a loop, with adj1 and adj2): beyond OPF's three-segment connector, so it stays a shape that draws as it was.
  assert.deepEqual([curved.shape, curved.adjust, curved.flip], ['curvedConnector4', { adj1: 0.43613, adj2: 2.05061 }, 'vertical']);
  assert.deepEqual(elbow.connector, { from: 'box-a', to: 'diamond-d', route: 'elbow', fromSite: 2, toSite: 1 });
  assert.equal(elbow.stroke.dash, 'dash');
  assert.deepEqual([free.shape, free.stroke.end], ['straightConnector1', { type: 'diamond' }]);
  assert.deepEqual([member1.shape, member2.shape, member1.rotate, member2.rotate], ['rect', 'ellipse', 15, 15]);
  near(member1.width, 0.125);
  near(member1.height, 0.111111);
}

// The readers: a frame carried out of a group (scale, flips and a turn), a color's transforms, a custom outline with an arc, which shape is what.
{
  const group = { x: 1000, y: 1000, cx: 2000, cy: 1000, rot: 0, flipH: false, flipV: false, child: { x: 0, y: 0, cx: 1000, cy: 1000 } };
  const scaled = frameOnSlide({ x: 100, y: 200, cx: 300, cy: 400, rot: 0, flipH: false, flipV: false }, [group]);
  assert.deepEqual([scaled.x, scaled.y, scaled.cx, scaled.cy], [1200, 1200, 600, 400]);
  const mirrored = frameOnSlide({ x: 100, y: 200, cx: 300, cy: 400, rot: 600000, flipH: false, flipV: false }, [{ ...group, flipH: true }]);
  assert.deepEqual([mirrored.x, mirrored.flipH, mirrored.rot], [2200, true, 21000000]);
  const turned = frameOnSlide({ x: 0, y: 0, cx: 1000, cy: 1000, rot: 0, flipH: false, flipV: false }, [{ ...group, cx: 1000, rot: 5400000 }]);
  assert.deepEqual([Math.round(turned.x), Math.round(turned.y), turned.rot], [1000, 1000, 5400000]);
  const color = (xml, mapping = { tx1: 'dk1', bg1: 'lt1' }) => readColor(xml, { mapping });
  assert.deepEqual(color({ 'a:schemeClr': { val: 'accent2', 'a:lumMod': { val: '75000' } } }).ref, { color: 'accent2', darken: 0.25 });
  assert.deepEqual(color({ 'a:schemeClr': { val: 'tx1', 'a:lumMod': { val: '65000' }, 'a:lumOff': { val: '35000' } } }).ref, { color: 'dark1', lighten: 0.35 });
  assert.deepEqual(color({ 'a:srgbClr': { val: '0f4c81', 'a:alpha': { val: '50000' } } }), { ref: '#0F4C81', alpha: 0.5, dropped: [] });
  assert.deepEqual(color({ 'a:schemeClr': { val: 'accent1', 'a:shade': { val: '15000' } } }).dropped, ['shade']);
  const custom = readCustomGeometry({ 'a:pathLst': { 'a:path': { w: '100', h: '100', 'a:moveTo': { 'a:pt': { x: '0', y: '50' } }, 'a:arcTo': { wR: '50', hR: '50', stAng: '10800000', swAng: '10800000' }, 'a:close': {} } } }, { cx: 100, cy: 100 });
  assert.match(custom.path, /^M0 0\.5 C0 0\.22386 0\.22386 0 0\.5 0 C/);
  assert.equal(custom.path.endsWith('Z'), true);
  const node = (name, extra = {}) => ({ props: { 'p:nvSpPr': { 'p:cNvPr': { name }, 'p:cNvSpPr': extra.txBox ? { txBox: '1' } : {}, 'p:nvPr': extra.ph ? { 'p:ph': {} } : {} }, 'p:spPr': extra.spPr ?? {} }, frame: { x: 0, y: 0, cx: 1, cy: 1 } });
  assert.equal(shapeRole(node('OPF shape slides.0.blocks.1.shape')), 'block');
  assert.equal(shapeRole(node('OPF shape slides.0.shapes.2')), 'overlay');
  assert.equal(shapeRole(node('OPF card slides.0.blocks.1.text')), 'text');
  assert.equal(shapeRole(node('TextBox 1', { txBox: true }), { hasText: true }), 'text');
  assert.equal(shapeRole(node('Title 1', { ph: true })), 'text');
  assert.equal(shapeRole(node('Rectangle 1', { spPr: { 'a:solidFill': { 'a:srgbClr': { val: 'FF0000' } } } }), { hasText: true }), 'overlay');
  assert.equal(shapeRole(node('Rectangle 2'), { hasText: true }), 'text');
}

// What OPF does not represent is reported, each by its property, and dropped; the shape itself still imports.
{
  const exported = unzipSync(await toPptx({ name: 'Findings', slides: [{ title: 'T', shapes: [{ id: 'one', shape: 'rect', x: 0.1, y: 0.2, width: 0.3, height: 0.2, fill: 'accent2', text: 'Hi' }] }] }));
  const slide = new TextDecoder().decode(exported['ppt/slides/slide1.xml']);
  const edit = (replace, ...rest) => {
    const xml = replace(slide);
    assert.notEqual(xml, slide, 'the edit applies');
    return { ...exported, 'ppt/slides/slide1.xml': new TextEncoder().encode(xml) };
  };
  const inShape = change => xml => xml.replace(/<p:sp><p:nvSpPr><p:cNvPr id="\d+" name="OPF shape slides\.0\.shapes\.0"[\s\S]*?<\/p:sp>/, change);
  const cases = {
    '3-D format': inShape(shape => shape.replace('</p:spPr>', '<a:scene3d><a:camera prst="orthographicFront"/><a:lightRig rig="threePt" dir="t"/></a:scene3d><a:sp3d><a:bevelT w="63500"/></a:sp3d></p:spPr>')),
    'preset shadow': inShape(shape => shape.replace('<a:effectLst/>', '<a:effectLst><a:prstShdw prst="shdw1"><a:srgbClr val="000000"/></a:prstShdw></a:effectLst>')),
    'fill overlay': inShape(shape => shape.replace('<a:effectLst/>', '<a:effectLst><a:fillOverlay blend="mult"><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill></a:fillOverlay></a:effectLst>')),
    'text wrapping': inShape(shape => shape.replace('wrap="square"', 'wrap="none"')),
    'text columns': inShape(shape => shape.replace('numCol="1"', 'numCol="2"')),
    autofit: inShape(shape => shape.replace('<a:noAutofit/>', '<a:normAutofit fontScale="90000"/>')),
    'alternative text title': inShape(shape => shape.replace(/<p:cNvPr id="(\d+)" name="([^"]+)"/, '<p:cNvPr id="$1" name="$2" title="A title"')),
    'hover link': inShape(shape => shape.replace(/<p:cNvPr id="(\d+)" name="([^"]+)"\/>/, '<p:cNvPr id="$1" name="$2"><a:hlinkHover r:id="rId9" action="ppaction://noaction"/></p:cNvPr>')),
    locks: inShape(shape => shape.replace('<p:cNvSpPr/>', '<p:cNvSpPr><a:spLocks noChangeAspect="1"/></p:cNvSpPr>')),
    'black-and-white mode': inShape(shape => shape.replace('<p:spPr>', '<p:spPr bwMode="gray">')),
    'custom data': inShape(shape => shape.replace('<p:nvPr></p:nvPr>', '<p:nvPr><p:custDataLst><p:custData r:id="rId9"/></p:custDataLst></p:nvPr>').replace('<p:nvPr/>', '<p:nvPr><p:custDataLst><p:custData r:id="rId9"/></p:custDataLst></p:nvPr>')),
  };
  for (const [property, change] of Object.entries(cases)) {
    const reported = [];
    const back = await fromPptx(zipSync(edit(change)), { onDiagnostic: item => reported.push(item) });
    assert.deepEqual(reported.filter(item => item.code === 'shape-property-dropped').map(item => item.property), [property], property);
    assert.match(reported.find(item => item.code === 'shape-property-dropped').message, new RegExp(property.replace(/[-]/g, '.')), property);
    assert.equal(back.slides[0].shapes.length, 1, `${property}: the shape imports`);
    assert.equal(back.slides[0].shapes[0].text, 'Hi');
  }
  // A shape PowerPoint drew behind the title is an overlay in the back layer.
  {
    const behind = zipSync(edit(xml => xml.replace('</p:grpSpPr>', '</p:grpSpPr><p:sp><p:nvSpPr><p:cNvPr id="90" name="Rectangle 9"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="500000" y="2900000"/><a:ext cx="6000000" cy="1000000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="FFCC00"/></a:solidFill></p:spPr></p:sp>')));
    const reported = [];
    const back = await fromPptx(behind, { onDiagnostic: item => reported.push(item) });
    assert.equal(back.slides[0].shapes.length, 2);
    // Behind the title and over nothing else: the back layer expresses it, so nothing is reported.
    assert.deepEqual(reported.filter(item => item.code === 'shape-covers-content'), []);
    assert.equal(back.slides[0].shapes.find(shape => shape.fill === '#FFCC00').layer, 'back');
    assert.equal(back.slides[0].shapes.find(shape => shape.text === 'Hi').layer, undefined);
  }
  // A shape across the whole slide is a background, not an overlay.
  const full = zipSync(edit(inShape(shape => shape.replace(/<a:off x="\d+" y="\d+"\/><a:ext cx="\d+" cy="\d+"\/>/, '<a:off x="0" y="0"/><a:ext cx="12192000" cy="6858000"/>'))));
  const reported = [];
  const back = await fromPptx(full, { onDiagnostic: item => reported.push(item) });
  assert.equal(back.slides[0].shapes, undefined);
  assert.equal(reported.filter(item => item.code === 'shape-not-imported').length, 1);
}

console.log('sh-05 powerpoint shapes: ok');
