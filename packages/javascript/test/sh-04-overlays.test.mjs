// SH-04: overlay shapes and connectors in core: the slide `shapes` format, validation (placements, unknown ids, site ranges, the two new
// findings), the composed overlay (placement by fractions and by `at`, right to left included, the automatic connection sites) and the
// connector routes as PowerPoint's straightConnector1, bentConnector2/3 and curvedConnector2/3 with their frames and adjust values.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chooseConnectorSites, composeSlide, connectorRoute, frameToSlide, rectSites, shapeSites } from '../dist/composition.js';
import { validate } from '../dist/index.js';
import { presetGeometry } from '../dist/shape-geometry.js';

const deck = (slide) => ({ name: 'Overlays', language: 'en-US', slides: [slide] });
const findings = (slide) => validate(deck(slide)).findings.filter((finding) => finding.ruleId !== 'opf/missing-language').map((finding) => [finding.ruleId, finding.path]);
const near = (a, b, tolerance = 1e-3) => Math.abs(a - b) <= tolerance;
const nearPoint = (a, b, tolerance = 1e-3) => near(a.x, b.x, tolerance) && near(a.y, b.y, tolerance);
const points = (d) => [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map(Number).reduce((out, value, index, all) => (index % 2 ? out : [...out, { x: value, y: all[index + 1] }]), []);
const flow = {
  title: 'Flow',
  blocks: [{ id: 'plan', shape: 'roundRect', text: 'Plan' }, { id: 'build', shape: 'ellipse', text: 'Build' }, { id: 'note', text: 'Ship it to every region' }],
};
const compose = (shapes, options = {}, slide = flow) => composeSlide({ ...slide, shapes }, { width: 1280, height: 720, ...options });

test('the overlay is drawn over the composed slide and never moves content', () => {
  const plain = composeSlide(flow, { width: 1280, height: 720 });
  const over = compose([
    { id: 'callout', shape: 'wedgeRectCallout', text: 'New', x: 0.7, y: 0.05, width: 0.2, height: 0.1 },
    { connector: { from: 'plan', to: 'build', route: 'elbow' } },
  ]);
  assert.deepEqual(over.items.map((item) => [item.path, item.box]), plain.items.map((item) => [item.path, item.box]));
  assert.equal(plain.overlayShapes, undefined);
  assert.deepEqual(over.overlayShapes.map((entry) => [entry.kind, entry.path, entry.index]), [['shape', 'slides.0.shapes.0', 0], ['connector', 'slides.0.shapes.1', 1]]);
});

test('an overlay shape is a shape block item: SH-02 geometry, style and fitted text at fractions of the slide', () => {
  const [callout] = compose([{ id: 'callout', shape: 'wedgeRectCallout', text: 'New this quarter', x: 0.6, y: 0.1, width: 0.3, height: 0.15, style: 'subtle' }]).overlayShapes;
  assert.equal(callout.field, 'shape');
  assert.equal(callout.type, 'shape');
  assert.equal(callout.id, 'callout');
  assert.deepEqual(callout.box, { x: 768, y: 72, width: 384, height: 108 });
  assert.deepEqual(callout.shape.box, callout.box);
  assert.equal(callout.shape.preset, 'wedgeRectCallout');
  assert.equal(callout.shape.style, 'subtle');
  assert.equal(callout.shape.paths.length, presetGeometry('wedgeRectCallout', 384, 108).paths.length);
  assert.ok(callout.text && !callout.text.overflow && callout.shape.textArea);
  assert.ok(callout.textStyle.fontFamily);
  // Never below the readability floor (16 reference pixels at 720).
  assert.ok(callout.text.fontSize >= 16);
});

test('x counts from the right edge in a right-to-left deck', () => {
  const [ltr] = compose([{ shape: 'rect', x: 0.1, y: 0.2, width: 0.25, height: 0.1 }]).overlayShapes;
  const [rtl] = compose([{ shape: 'rect', x: 0.1, y: 0.2, width: 0.25, height: 0.1 }], { direction: 'rtl' }).overlayShapes;
  assert.deepEqual(ltr.box, { x: 128, y: 144, width: 320, height: 72 });
  assert.deepEqual(rtl.box, { x: 832, y: 144, width: 320, height: 72 });
});

test('at places the shape outside an edge of the composed block, centered along it, and start and end follow the direction', () => {
  const slide = composeSlide(flow, { width: 1280, height: 720 });
  const plan = slide.items.find((item) => item.path === 'slides.0.blocks.0.shape').shape.box;
  const short = 0.15 * Math.min(plan.width, plan.height);
  const [top, bottom, start, end, center] = compose([
    { shape: 'ellipse', at: { block: 'plan', edge: 'top' } },
    { shape: 'rect', at: { block: 'plan', edge: 'bottom', offset: 10, width: 0.5, height: 40 } },
    { shape: 'rightArrow', at: { block: 'plan', edge: 'start' } },
    { shape: 'rect', at: { block: 'plan', edge: 'end', offset: -20, width: 100 } },
    { shape: 'star5', at: { block: 'plan', edge: 'center' } },
  ]).overlayShapes;
  // The preset's natural proportions with the shorter side at 15% of the block's shorter side.
  assert.ok(near(top.box.width, short) && near(top.box.height, short));
  assert.ok(near(top.box.y + top.box.height, plan.y) && near(top.box.x + top.box.width / 2, plan.x + plan.width / 2));
  assert.deepEqual(top.attachedTo, { id: 'plan', ref: 'slides.0.blocks.0.shape', edge: 'top' });
  // A fraction is of the block's side, a larger number reference pixels; the offset is reference pixels.
  assert.ok(near(bottom.box.y, plan.y + plan.height + 10) && near(bottom.box.width, plan.width / 2) && near(bottom.box.height, 40));
  assert.ok(near(start.box.width, 2 * short) && near(start.box.x + start.box.width, plan.x) && start.attachedTo.edge === 'left');
  assert.ok(near(end.box.x, plan.x + plan.width - 20) && near(end.box.width, 100) && near(end.box.height, 100 / 1.5));
  assert.ok(near(center.box.x + center.box.width / 2, plan.x + plan.width / 2) && near(center.box.y + center.box.height / 2, plan.y + plan.height / 2));
  const rtl = compose([{ shape: 'rect', at: { block: 'plan', edge: 'start' } }], { direction: 'rtl' });
  const mirrored = rtl.items.find((item) => item.path === 'slides.0.blocks.0.shape').shape.box;
  assert.equal(rtl.overlayShapes[0].attachedTo.edge, 'right');
  assert.ok(near(rtl.overlayShapes[0].box.x, mirrored.x + mirrored.width));
});

test('at follows the block wherever composition puts it, groups included', () => {
  const grouped = { title: 'G', blocks: [{ text: 'Intro' }, { id: 'pair', blocks: [{ id: 'left', text: 'A' }, { id: 'right', text: 'B' }] }] };
  const result = compose([{ shape: 'ellipse', at: { block: 'pair', edge: 'center' } }, { shape: 'rect', at: { block: 'right', edge: 'top' } }], {}, grouped);
  const pair = result.groups.find((group) => group.path === 'slides.0.blocks.1').box;
  const right = result.items.find((item) => item.path === 'slides.0.blocks.1.blocks.1.text').box;
  assert.equal(result.overlayShapes[0].attachedTo.ref, 'slides.0.blocks.1');
  assert.ok(near(result.overlayShapes[0].box.x + result.overlayShapes[0].box.width / 2, pair.x + pair.width / 2));
  assert.ok(near(result.overlayShapes[1].box.y + result.overlayShapes[1].box.height, right.y));
});

test('an entry with a missing block, both placements or none is not drawn', () => {
  const result = compose([
    { shape: 'rect', at: { block: 'nowhere', edge: 'top' } },
    { shape: 'rect', at: { block: 'plan', edge: 'top' }, x: 0, y: 0, width: 0.1, height: 0.1 },
    { shape: 'rect' },
    { connector: { from: 'plan', to: 'nowhere' } },
    { shape: 'rect', x: 0, y: 0, width: 0.1, height: 0.1 },
  ]);
  assert.deepEqual(result.overlayShapes.map((entry) => entry.index), [4]);
});

test('connection sites: a preset its own, turned and flipped with the shape; a block that is not a shape the rectangle four', () => {
  assert.deepEqual(rectSites({ x: 0, y: 0, width: 200, height: 100 }), [{ x: 100, y: 0, angle: 270 }, { x: 0, y: 50, angle: 180 }, { x: 100, y: 100, angle: 90 }, { x: 200, y: 50, angle: 0 }]);
  const base = { box: { x: 100, y: 100, width: 200, height: 100 }, preset: 'chevron', adjust: {} };
  const own = presetGeometry('chevron', 200, 100).connectionSites;
  assert.deepEqual(shapeSites(base), own.map((site) => ({ x: site.x + 100, y: site.y + 100, angle: site.angle })));
  // Flipped horizontally: the point mirrors about the center and the direction with it.
  const flipped = shapeSites({ ...base, flipH: true });
  assert.ok(nearPoint(flipped[3], { x: 100, y: 150 }) && flipped[3].angle === 180);
  // Turned 90 degrees clockwise about the center (200, 150): the right site points down.
  const turned = shapeSites({ ...base, rotate: 90 });
  assert.ok(nearPoint(turned[3], { x: 200, y: 250 }) && turned[3].angle === 90);
});

test('straight: straightConnector1 between the facing sites, its frame flipped for a line that runs left or up', () => {
  const route = connectorRoute('straight', { x: 300, y: 100, angle: 180 }, { x: 100, y: 200, angle: 0 });
  assert.equal(route.preset, 'straightConnector1');
  assert.deepEqual(route.frame, { box: { x: 100, y: 100, width: 200, height: 100 }, rotate: 0, flipH: true, flipV: false });
  assert.deepEqual(route.avLst, {});
  assert.deepEqual(points(route.d), [{ x: 300, y: 100 }, { x: 100, y: 200 }]);
  assert.ok(route.proper);
  assert.equal(route.ends.end.x, 100);
});

test('elbow: bentConnector3 halfway between sites on one axis, beyond 0 to 1 for a U; bentConnector2 between perpendicular sites', () => {
  // Right of one shape to left of the other: a Z, its middle halfway (adj1 0.5).
  const z = connectorRoute('elbow', { x: 100, y: 100, angle: 0 }, { x: 300, y: 200, angle: 180 });
  assert.equal(z.preset, 'bentConnector3');
  assert.deepEqual(z.avLst, { adj1: 50000 });
  assert.deepEqual(z.adjust, { adj1: 0.5 });
  assert.deepEqual(points(z.d), [{ x: 100, y: 100 }, { x: 200, y: 100 }, { x: 200, y: 200 }, { x: 300, y: 200 }]);
  // Both sites facing right: a U that runs CONNECTOR_STANDOFF (24 reference pixels) past the farther site.
  const u = connectorRoute('elbow', { x: 100, y: 100, angle: 0 }, { x: 300, y: 200, angle: 0 });
  assert.deepEqual(u.avLst, { adj1: 112000 });
  assert.deepEqual(points(u.d), [{ x: 100, y: 100 }, { x: 324, y: 100 }, { x: 324, y: 200 }, { x: 300, y: 200 }]);
  assert.equal(u.bounds.width, 224);
  // Leaving downwards: the frame turns a quarter, as PowerPoint writes a vertical elbow, and the path still runs from site to site.
  const down = connectorRoute('elbow', { x: 100, y: 100, angle: 90 }, { x: 300, y: 300, angle: 270 });
  assert.equal(down.frame.rotate === 90 || down.frame.rotate === 270, true);
  assert.deepEqual(points(down.d), [{ x: 100, y: 100 }, { x: 100, y: 200 }, { x: 300, y: 200 }, { x: 300, y: 300 }]);
  assert.ok(nearPoint(frameToSlide(down.frame, 0, 0), { x: 100, y: 100 }) && nearPoint(frameToSlide(down.frame, down.frame.box.width, down.frame.box.height), { x: 300, y: 300 }));
  // Perpendicular sites: an L through the corner.
  const l = connectorRoute('elbow', { x: 100, y: 100, angle: 0 }, { x: 300, y: 300, angle: 270 });
  assert.equal(l.preset, 'bentConnector2');
  assert.deepEqual(points(l.d), [{ x: 100, y: 100 }, { x: 300, y: 100 }, { x: 300, y: 300 }]);
  assert.ok(l.proper);
});

test('curved: curvedConnector3 through the elbow middle, tangent to the sites; curvedConnector2 between perpendicular ones', () => {
  const curve = connectorRoute('curved', { x: 100, y: 100, angle: 0 }, { x: 300, y: 200, angle: 180 });
  assert.equal(curve.preset, 'curvedConnector3');
  assert.deepEqual(curve.avLst, { adj1: 50000 });
  // PowerPoint's curvedConnector3: M l t C x1 t, x2 h/4, x2 vc C x2 3h/4, x3 b, r b, with x2 = w adj1 and x1, x3 halfway to it.
  assert.equal(curve.d, 'M 100 100 C 150 100 200 125 200 150 C 200 175 250 200 300 200');
  const corner = connectorRoute('curved', { x: 100, y: 100, angle: 0 }, { x: 300, y: 300, angle: 270 });
  assert.equal(corner.preset, 'curvedConnector2');
  assert.equal(corner.d, 'M 100 100 C 200 100 300 200 300 300');
});

test('the automatic sites face each other with the shortest proper route; fromSite and toSite override it', () => {
  const left = rectSites({ x: 0, y: 0, width: 100, height: 100 }), right = rectSites({ x: 300, y: 50, width: 100, height: 100 });
  const chosen = chooseConnectorSites('straight', left, right);
  assert.deepEqual([chosen.from, chosen.to], [3, 1]);
  const below = rectSites({ x: 0, y: 300, width: 100, height: 100 });
  assert.deepEqual((({ from, to }) => [from, to])(chooseConnectorSites('elbow', left, below)), [2, 0]);
  assert.deepEqual((({ from, to }) => [from, to])(chooseConnectorSites('elbow', left, right, { fromSite: 2, toSite: 0 })), [2, 0]);
  // An index out of range is ignored here (validation reports it) and the choice is automatic.
  assert.deepEqual((({ from, to }) => [from, to])(chooseConnectorSites('straight', left, right, { fromSite: 9 })), [3, 1]);
});

test('a composed connector: its ends, preset, frame and the route as one open path with ends for SH-02 stroke drawing', () => {
  const result = compose([
    { id: 'badge', shape: 'ellipse', text: '1', x: 0.02, y: 0.02, width: 0.06, height: 0.1 },
    { id: 'link', connector: { from: 'plan', to: 'build', route: 'elbow' }, stroke: { width: 3, dash: 'dash', end: { type: 'triangle' } }, alt: 'Plan leads to build' },
    { connector: { from: 'badge', to: 'plan', route: 'curved' } },
  ]);
  const plan = result.items.find((item) => item.path === 'slides.0.blocks.0.shape'), build = result.items.find((item) => item.path === 'slides.0.blocks.1.shape');
  const [, link, curve] = result.overlayShapes;
  assert.equal(link.kind, 'connector');
  assert.equal(link.id, 'link');
  assert.equal(link.alt, 'Plan leads to build');
  assert.equal(link.route, 'elbow');
  assert.equal(link.preset, 'bentConnector3');
  assert.deepEqual([link.from.ref, link.from.target, link.from.site], ['slides.0.blocks.0.shape', 'block', 3]);
  assert.deepEqual([link.to.ref, link.to.target, link.to.site], ['slides.0.blocks.1.shape', 'block', 2]);
  // The ends are the shapes' own sites: the roundRect's right and the ellipse's left.
  assert.ok(nearPoint(link.from.point, shapeSites(plan.shape)[3]) && nearPoint(link.to.point, shapeSites(build.shape)[2]));
  assert.equal(link.paths.length, 1);
  assert.equal(link.paths[0].open, true);
  assert.equal(link.paths[0].fill, 'none');
  assert.ok(nearPoint(points(link.paths[0].d)[0], link.from.point) && nearPoint(points(link.paths[0].d).at(-1), link.to.point));
  assert.equal(link.paths[0].ends.end.angle, 0);
  assert.equal(link.stroke.width, 3);
  assert.equal(link.stroke.dash, 'dash');
  assert.deepEqual(link.stroke.end, { type: 'triangle', width: 'medium', length: 'medium' });
  // The default line: 2 reference pixels in the slide's text color, no arrowheads.
  assert.deepEqual([curve.stroke.color, curve.stroke.width, curve.stroke.end], ['text', 2, undefined]);
  assert.equal(curve.from.target, 'shape');
  assert.equal(curve.from.ref, 'slides.0.shapes.0');
});

test('a connector between blocks that are not shapes, and a sketched connector', () => {
  const slide = { title: 'T', blocks: [{ id: 'a', text: 'First' }, { id: 'b', text: 'Second' }] };
  const [connector] = compose([{ connector: { from: 'a', to: 'b' }, stroke: { sketch: 'freehand' } }], {}, slide).overlayShapes;
  assert.equal(connector.preset, 'straightConnector1');
  assert.equal(connector.from.ref, 'slides.0.blocks.0.text');
  assert.ok(connector.stroke.sketched && typeof connector.stroke.sketched.lines[0] === 'string');
});

test('validation: placements, unknown ids, site ranges and duplicate ids', () => {
  const blocks = [{ id: 'a', text: 'a' }, { id: 'e', shape: 'ellipse' }];
  assert.deepEqual(findings({ title: 'x', blocks, shapes: [{ id: 's', shape: 'rect', x: 0, y: 0, width: 0.1, height: 0.1 }, { connector: { from: 'a', to: 's', route: 'elbow', fromSite: 3, toSite: 0 } }] }), []);
  assert.deepEqual(findings({ title: 'x', blocks, shapes: [
    { shape: 'rect', x: 0, y: 0, width: 0.1, height: 0.1, at: { block: 'a', edge: 'top' } },
    { shape: 'rect' },
    { shape: 'rect', x: 0.1 },
    { shape: 'rect', at: { block: 'zz', edge: 'top' } },
    { id: 'c', connector: { from: 'a', to: 'nowhere' } },
    { connector: { from: 'c', to: 'a' } },
    { connector: { from: 'a', to: 'e', fromSite: 4, toSite: 8 } },
    { id: 'a', shape: 'rect', x: 0, y: 0, width: 0.1, height: 0.1 },
  ] }), [
    ['opf/schema', '/slides/0/shapes/7/id'],
    ['opf/schema', '/slides/0/shapes/0'],
    ['opf/schema', '/slides/0/shapes/1'],
    ['opf/schema', '/slides/0/shapes/2'],
    ['opf/schema', '/slides/0/shapes/6/connector/fromSite'],
    ['opf/schema', '/slides/0/shapes/6/connector/toSite'],
    ['opf/shape-anchor-missing', '/slides/0/shapes/3/at/block'],
    ['opf/connector-end-missing', '/slides/0/shapes/4/connector/to'],
    ['opf/connector-end-missing', '/slides/0/shapes/5/connector/from'],
  ]);
  // The ellipse has eight sites (0 to 7): 8 is out of range, 7 is not.
  assert.deepEqual(findings({ title: 'x', blocks, shapes: [{ connector: { from: 'a', to: 'e', toSite: 7 } }] }), []);
});

test('validation: one error for a typo, shape keys on a connector, and the SH-02 checks of overlay shapes', () => {
  const report = (shapes) => validate(deck({ title: 'x', blocks: [{ id: 'a', text: 'a' }, { id: 'b', text: 'b' }], shapes })).findings.map((finding) => [finding.ruleId, finding.path, finding.severity]);
  assert.deepEqual(report([{ shape: 'ellipse', colour: 'red', x: 0, y: 0, width: 0.1, height: 0.1 }]), [['opf/schema', '/slides/0/shapes/0/colour', 'error']]);
  assert.deepEqual(report([{ connector: { from: 'a', to: 'b', route: 'zigzag' } }]), [['opf/schema', '/slides/0/shapes/0/connector/route', 'error']]);
  assert.deepEqual(report([{ connector: { from: 'a', to: 'b' }, text: 'x', colur: 1 }]), [['opf/schema', '/slides/0/shapes/0/colur', 'error'], ['opf/schema', '/slides/0/shapes/0/text', 'error']]);
  assert.deepEqual(report([{ shape: 'roundRect', adjust: { adj: 0.9 }, x: 0, y: 0, width: 0.1, height: 0.1, hidden: true, link: 'https://example.com' }]), [
    ['opf/shape-adjust-range', '/slides/0/shapes/0/adjust/adj', 'warning'],
    ['opf/shape-link-hidden', '/slides/0/shapes/0/link', 'warning'],
  ]);
});

test('the new findings are in the registry with their plain-words text', () => {
  const missing = validate(deck({ title: 'x', blocks: [{ id: 'photo', text: 'a' }], shapes: [{ shape: 'ellipse', at: { block: 'phot', edge: 'top' } }, { connector: { from: 'photo', to: 'phot' } }] })).findings;
  const anchor = missing.find((finding) => finding.ruleId === 'opf/shape-anchor-missing'), end = missing.find((finding) => finding.ruleId === 'opf/connector-end-missing');
  assert.equal(anchor.severity, 'error');
  assert.equal(anchor.category, 'format');
  assert.equal(end.severity, 'error');
});

test('pagination: fraction shapes on every page, an at shape on its block page, a connector only where both ends are', async () => {
  const { paginate } = await import('../dist/index.js');
  const para = (count) => Array.from({ length: count }, (_, index) => `Sentence number ${index + 1} explains one more detail of the plan in plain words.`).join(' ');
  const result = paginate({ name: 'P', language: 'en-US', slides: [{ title: 'Long', blocks: [{ id: 'first', text: para(14) }, { id: 'second', text: para(14) }, { id: 'third', text: para(4) }], shapes: [
    { id: 'stamp', shape: 'rect', text: 'Draft', x: 0.8, y: 0.02, width: 0.15, height: 0.06 },
    { id: 'pin', shape: 'ellipse', at: { block: 'third', edge: 'top' } },
    { connector: { from: 'first', to: 'second' } },
    { connector: { from: 'stamp', to: 'pin' } },
  ] }] });
  const slides = result.presentation.slides;
  assert.equal(slides.length, 3);
  // Ids take their page's id, and the references follow them.
  assert.deepEqual(slides.map((slide) => slide.shapes.map((entry) => entry.id ?? `${entry.connector.from}>${entry.connector.to}`)), [['stamp'], ['stamp--2'], ['stamp--3', 'pin', 'stamp--3>pin']]);
  assert.deepEqual(result.pages.map((page) => (page.diagnostics ?? []).map((entry) => [entry.code, entry.path])), [[['connector-split', 'slides.0.shapes.2']], [], []]);
  // Every page validates: no reference names a block of another page.
  assert.equal(validate(result.presentation).findings.filter((finding) => finding.severity === 'error').length, 0);
});

test('layer: an overlay shape is front by default or back; a connector takes no layer', () => {
  const [front, back] = compose([{ shape: 'rect', x: 0, y: 0, width: 0.1, height: 0.1 }, { shape: 'rect', layer: 'back', x: 0, y: 0, width: 0.1, height: 0.1 }]).overlayShapes;
  assert.deepEqual([front.layer, back.layer], ['front', 'back']);
  assert.deepEqual(findings({ title: 'x', blocks: [{ id: 'a', text: 'a' }, { id: 'b', text: 'b' }], shapes: [{ connector: { from: 'a', to: 'b' }, layer: 'back' }] }), [['opf/schema', '/slides/0/shapes/0/layer']]);
});

test('a connector adjust replaces the automatic middle of a three-segment route and is checked against its preset', () => {
  const route = (adjust) => compose([{ connector: { from: 'plan', to: 'build', route: 'elbow' }, ...(adjust ? { adjust } : {}) }]).overlayShapes[0];
  const automatic = route(), kept = route({ adj1: 0.25 });
  assert.equal(automatic.preset, 'bentConnector3');
  assert.deepEqual(kept.avLst, { adj1: 25000 });
  assert.deepEqual([kept.from.site, kept.to.site, kept.box], [automatic.from.site, automatic.to.site, automatic.box]);
  const [start, bend] = points(kept.paths[0].d);
  assert.ok(near(bend.x - start.x, 0.25 * kept.box.width, 1e-2));
  const blocks = [{ id: 'a', text: 'a' }, { id: 'b', text: 'b' }];
  assert.deepEqual(findings({ title: 'x', blocks, shapes: [{ connector: { from: 'a', to: 'b', route: 'elbow' }, adjust: { adj1: 1.4 } }] }), []);
  assert.deepEqual(findings({ title: 'x', blocks, shapes: [{ connector: { from: 'a', to: 'b' }, adjust: { adj1: 0.5 } }, { connector: { from: 'a', to: 'b', route: 'curved' }, adjust: { adj2: 0.5 } }] }), [
    ['opf/shape-adjust-unknown', '/slides/0/shapes/0/adjust/adj1'],
    ['opf/shape-adjust-unknown', '/slides/0/shapes/1/adjust/adj2'],
  ]);
});
