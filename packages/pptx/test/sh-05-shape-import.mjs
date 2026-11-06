// SH-05: the shapes the exporter writes import back as the OPF they came from. The reference decks (shapes, shape-effects, shape-overlays) are
// exported and imported again, and the slides are compared as they draw: every shape block and overlay shape composes to the same shape
// (frame, outline, fill, line, effects, text) and connectors keep their ends, route and sites. Authored values that equal what the theme style
// gives (an explicit `fill: "accent1"` on the default style) come back absent, so the comparison is of the drawing and not of the spelling;
// the exact fields that only the stored record can return (ids, anchors, names of colors) are asserted by value.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { composeSlide } from '@openpresentation/opf/composition';
import { fromPptx, toPptx } from '../dist/index.js';
import { normalizeEffects } from '../dist/effects.js';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const example = async name => JSON.parse((await readFile(new URL(`../../../examples/technical/${name}.opf.json`, import.meta.url), 'utf8')).replaceAll('./assets/cover.png', PNG));

// (A connector's line in the slide's text color is `text` or, on a dark slide, `light1`: the same color.)
// Numbers to a hundredth, so the EMU rounding of a frame is not a difference.
const settle = value => Array.isArray(value) ? value.map(settle) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, settle(item)]))
  : typeof value === 'number' ? Math.round(value * 100) / 100 : typeof value === 'string' && /^M[ \d]/.test(value) ? value.replace(/-?\d+\.?\d*/g, number => String(Math.round(Number(number)))) : value;
const textOf = item => item.text?.lines?.map(line => line.text ?? line).join('|') ?? item.text?.richLines?.map(line => line.fragments?.map(fragment => fragment.text).join('')).join('|');
const drawn = deck => deck.slides.map((slide, index) => {
  const composed = composeSlide(slide, { presentation: deck });
  // `custom` is the outline as authored (a path string or {d, viewBox}); `paths` is what it draws.
  // Effects with their defaults filled in, since an authored default is the same effect as an absent one.
  const shape = item => ({ path: item.path, shape: item.shape && (({ region, custom, effects, ...rest }) => ({ ...rest, ...(effects ? { effects: normalizeEffects(effects) } : {}) }))(item.shape), text: textOf(item) });
  return settle({
    shapes: composed.items.filter(item => item.shape && !item.path.includes('.shapes.')).map(shape),
    overlay: (composed.overlayShapes ?? []).map(entry => entry.kind === 'connector'
      ? { kind: 'connector', path: entry.path, route: entry.route, preset: entry.preset, from: [entry.from.ref, entry.from.site], to: [entry.to.ref, entry.to.site], box: entry.box, stroke: entry.stroke && { ...entry.stroke, color: entry.stroke.color === 'light1' ? 'text' : entry.stroke.color } }
      : { kind: 'shape', layer: entry.layer, ...shape(entry) }),
  });
});
const roundTrip = async (deck, diagnostics = []) => {
  const imported = await fromPptx(await toPptx(deck, { imageFormat: 'preserve' }), { onDiagnostic: item => diagnostics.push(item) });
  return imported;
};
const only = (list, code) => list.filter(item => item.code === code);

// 1. The reference decks draw the same after the round trip (their text and structure other than shapes are other suites').
for (const name of ['shapes', 'shape-effects', 'shape-overlays', 'shape-overlays-rtl']) {
  const deck = await example(name);
  const diagnostics = [];
  const imported = await roundTrip(deck, diagnostics);
  const before = drawn(deck), after = drawn(imported);
  for (const [index, slide] of before.entries()) {
    assert.equal(after[index].shapes.length, slide.shapes.length, `${name} slide ${index}: shape blocks`);
    assert.equal(after[index].overlay.length, slide.overlay.length, `${name} slide ${index}: overlay entries`);
    assert.deepEqual(after[index], slide, `${name} slide ${index} draws the same`);
  }
  assert.equal(only(diagnostics, 'shape-property-dropped').length, 0, `${name}: nothing the exporter wrote is reported as dropped`);
  assert.equal(only(diagnostics, 'content-structure-changed').length, 0, `${name}: the stored content form is rebuilt`);
}

// 2. Exact fields of one slide: preset and adjust, a custom path, lighter and darker colors, effects (a shadow preset by name), rotation, flip,
// text, anchor, padding, direction, alt, decorative, hidden and the click link.
{
  const blocks = [
    { id: 'step', shape: 'roundRect', adjust: { adj: 0.3 }, text: 'Plan', fill: { color: 'accent1', lighten: 0.4 }, stroke: { color: { color: 'accent1', darken: 0.25 }, width: 3, dash: 'dash' }, shadow: 'hard', rotate: 10, flip: 'horizontal', anchor: 'top', padding: 12, textDirection: 'vertical', alt: 'The first step', link: 'https://example.com/plan' },
    { shape: 'pie', adjust: { adj1: 45, adj2: 180 }, hidden: true, style: 'subtle' },
    { path: 'M0 0 L1 0 L0.5 1 Z', decorative: true, fill: 'none', stroke: { color: 'accent3', width: 2, start: { type: 'oval' }, end: { type: 'stealth', width: 'large' } } },
    { shape: 'ellipse', glow: { radius: 12 }, innerShadow: { blur: 8 }, softEdge: 4, reflection: { size: 0.4 }, blur: 1 },
  ];
  const imported = await roundTrip({ name: 'Exact', slides: [{ title: 'Shapes', blocks }] });
  const [step, pie, triangle, ellipse] = imported.slides[0].blocks;
  const { text, ...rest } = step;
  assert.deepEqual(rest, { id: 'step', shape: 'roundRect', adjust: { adj: 0.3 }, fill: { color: 'accent1', lighten: 0.4 }, stroke: { color: { color: 'accent1', darken: 0.25 }, width: 3, dash: 'dash' }, shadow: 'hard', rotate: 10, flip: 'horizontal', anchor: 'top', padding: 12, textDirection: 'vertical', alt: 'The first step', link: 'https://example.com/plan' });
  assert.equal(text, 'Plan');
  assert.deepEqual(pie, { shape: 'pie', adjust: { adj1: 45, adj2: 180 }, hidden: true, style: 'subtle' });
  assert.equal(triangle.decorative, true);
  assert.equal(triangle.fill, 'none');
  assert.deepEqual(triangle.stroke, { color: 'accent3', width: 2, start: { type: 'oval' }, end: { type: 'stealth', width: 'large' } });
  assert.deepEqual({ glow: ellipse.glow, innerShadow: ellipse.innerShadow, softEdge: ellipse.softEdge, reflection: ellipse.reflection, blur: ellipse.blur }, { glow: { radius: 12 }, innerShadow: { blur: 8 }, softEdge: 4, reflection: { size: 0.4 }, blur: 1 });
}

// 3. Overlay shapes and connectors: fractions, ids, an anchor against a block, route and sites, arrowheads.
{
  const deck = {
    name: 'Overlay', slides: [{
      title: 'Flow',
      blocks: [{ id: 'plan', shape: 'roundRect', text: 'Plan' }, { id: 'ship', shape: 'ellipse', text: 'Ship' }],
      shapes: [
        { id: 'badge', shape: 'star5', text: 'New', x: 0.8, y: 0.1, width: 0.1, height: 0.16, fill: 'accent2' },
        { id: 'tag', shape: 'roundRect', text: 'Tag', at: { block: 'plan', edge: 'top', offset: -8, width: 72, height: 32 }, style: 'subtle' },
        { id: 'link', connector: { from: 'plan', to: 'ship', route: 'elbow', fromSite: 3, toSite: 1 }, stroke: { width: 3, end: { type: 'triangle' } } },
        { connector: { from: 'badge', to: 'ship', route: 'curved' }, stroke: { dash: 'dash' }, alt: 'Badge to ship' },
      ],
    }],
  };
  const imported = await roundTrip(deck);
  const [badge, tag, link, curved] = imported.slides[0].shapes;
  assert.deepEqual(badge, { id: 'badge', shape: 'star5', text: 'New', x: 0.8, y: 0.1, width: 0.1, height: 0.16, fill: 'accent2' });
  assert.deepEqual(tag, { id: 'tag', shape: 'roundRect', text: 'Tag', at: { block: 'plan', edge: 'top', offset: -8, width: 72, height: 32 }, style: 'subtle' });
  assert.deepEqual(link, { id: 'link', connector: { from: 'plan', to: 'ship', route: 'elbow', fromSite: 3, toSite: 1 }, stroke: { width: 3, end: { type: 'triangle' } } });
  assert.equal(curved.connector.from, 'badge');
  assert.equal(curved.connector.to, 'ship');
  assert.equal(curved.connector.route, 'curved');
  assert.deepEqual(curved.stroke, { dash: 'dash' });
  assert.equal(curved.alt, 'Badge to ship');
  assert.deepEqual(imported.slides[0].blocks.map(block => block.id), ['plan', 'ship']);
}

// 4. Without the stored record a connector keeps the route its native preset draws (adj1) as `adjust`; with it, the export's own route recomputes.
{
  const deck = { name: 'Route', slides: [{ title: 'Flow', shapes: [
    { id: 'a', shape: 'rect', x: 0.1, y: 0.3, width: 0.15, height: 0.1 },
    { id: 'b', shape: 'rect', x: 0.7, y: 0.6, width: 0.15, height: 0.1 },
    { connector: { from: 'a', to: 'b', route: 'elbow', fromSite: 3, toSite: 1 }, adjust: { adj1: 0.3 } },
  ] }] };
  const plain = await fromPptx(await toPptx(deck, { provenance: false }));
  const connector = plain.slides[0].shapes.find(entry => entry.connector);
  assert.equal(connector.connector.route, 'elbow');
  assert.ok(Math.abs(connector.adjust.adj1 - 0.3) < 0.001, 'the route is kept');
  const stored = await fromPptx(await toPptx(deck));
  assert.deepEqual(stored.slides[0].shapes.find(entry => entry.connector).adjust, { adj1: 0.3 }, 'an authored adjust is a stated value');
}

console.log('sh-05 shape import: ok');
