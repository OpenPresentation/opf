// Overlay sizes and their units through PPTX: a shape larger than the slide keeps its size both ways, and an anchored shape is sized
// by a fraction of its target (width, height) or by reference pixels (widthPx, heightPx), never by one number that means either.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { unzipSync, strFromU8 } from 'fflate';
import { toPptx, fromPptx } from '../dist/index.js';
const deck = (shapes) => ({ design: { fontScheme: 'roboto' }, slides: [{ title: 'Launch plan', blocks: [{ id: 'note', text: 'Three regions go live in March.' }], shapes }] });
const frames = (bytes) => [...strFromU8(unzipSync(bytes)['ppt/slides/slide1.xml']).matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map((m) => m[0]).filter((sp) => /name="[^"]*OPF overlay/.test(sp) || /name="[^"]*shapes\.\d+/.test(sp)).map((sp) => ({ cx: Number(/<a:ext cx="(-?\d+)"/.exec(sp)?.[1]), cy: Number(/<a:ext cx="-?\d+" cy="(-?\d+)"/.exec(sp)?.[1]), x: Number(/<a:off x="(-?\d+)"/.exec(sp)?.[1]) }));
const SLIDE = { width: 12192000, height: 6858000 };
test('a shape larger than the slide exports at its size and imports without being limited', async () => {
  const bleed = { shape: 'ellipse', x: -0.3, y: -0.5, width: 1.2, height: 1.6, fill: 'accent1', decorative: true, layer: 'back' };
  for (const provenance of ['full', false]) {
    const diagnostics = [], bytes = await toPptx(deck([bleed]), { provenance });
    const written = frames(bytes).find((frame) => frame.cx > SLIDE.width);
    assert.ok(written, 'the native shape is wider than the slide');
    assert.ok(Math.abs(written.cx - 1.2 * SLIDE.width) < 20 && Math.abs(written.cy - 1.6 * SLIDE.height) < 20 && Math.abs(written.x + 0.3 * SLIDE.width) < 20, JSON.stringify(written));
    const back = await fromPptx(bytes, { onDiagnostic: (d) => diagnostics.push(d) }), shape = back.slides[0].shapes.find((entry) => entry.shape === 'ellipse');
    assert.ok(shape, String(provenance));
    for (const [key, value] of [['x', -0.3], ['y', -0.5], ['width', 1.2], ['height', 1.6]]) assert.ok(Math.abs(shape[key] - value) < 1e-4, `${provenance}: ${key} ${shape[key]}`);
    assert.equal(diagnostics.some((d) => d.code === 'shape-property-dropped' && /larger than/.test(d.property ?? '')), false);
  }
});
test('anchored sizes keep their unit: a fraction of the target or reference pixels', async () => {
  const shapes = [
    { shape: 'roundRect', layer: 'back', decorative: true, at: { block: 'note', edge: 'center', width: 1.08, height: 1.08 } },
    { shape: 'rect', text: 'New', at: { block: 'note', edge: 'top', offset: 8, widthPx: 160, heightPx: 64 } },
  ];
  const bytes = await toPptx(deck(shapes), {}), native = frames(bytes);
  // 160 x 64 reference pixels on the default slide: 9525 EMU each.
  assert.ok(native.some((frame) => Math.abs(frame.cx - 160 * 9525) < 20 && Math.abs(frame.cy - 64 * 9525) < 20), JSON.stringify(native));
  // 1.08 is 8% larger than the block, not one pixel.
  assert.ok(native.every((frame) => frame.cx > 100 * 9525), JSON.stringify(native));
  const back = await fromPptx(bytes, {});
  assert.deepEqual(back.slides[0].shapes.map((entry) => entry.at), shapes.map((entry) => entry.at));
});
