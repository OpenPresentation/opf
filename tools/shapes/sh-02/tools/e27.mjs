const T = 'packages/javascript/test/image-blocks.test.mjs';
export default [
  [T, /test\('shape outlines follow the DrawingML preset formulas', \(\) => \{[\s\S]*?\n\}\);\n/, `test('shape outlines are SH-01\'s evaluated DrawingML presets, any of the 187', () => {
  const box = { x: 10, y: 20, width: 300, height: 200 };
  assert.deepEqual(imageShape('rect', box), { kind: 'rect', preset: 'rect', adjust: {}, path: 'M 10 20 L 310 20 L 310 220 L 10 220 Z' });
  // roundRect: radius = min(w,h) * adj (0.16667 by default), circular arcs; the block's adjust is written as DrawingML's avLst.
  const rounded = imageShape('roundRect', box);
  assert.deepEqual(rounded.adjust, {});
  assert.match(rounded.path, /^M 10 53\.33\d A33\.33\d 33\.33\d 0 0 1 43\.33\d 20 /);
  assert.deepEqual(imageShape('roundRect', box, { adj: 0.25 }).adjust, { adj: 25000 });
  assert.match(imageShape('ellipse', { x: 0, y: 0, width: 100, height: 100 }).path, /^M 0 50 A50 50 0 0 1 50 0 /);
  // hexagon (adj 0.25, vf 1.1547): x1 = ss*adj, dy1 = h/2 * vf * sin 60.
  const hexagon = imageShape('hexagon', { x: 0, y: 0, width: 100, height: 100 });
  const points = [...hexagon.path.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((match) => [Number(match[1]), Number(match[2])]);
  const dy1 = 50 * 1.1547 * Math.sin(Math.PI / 3);
  for (const [actual, expected] of points.map((point, index) => [point, [[0, 50], [25, 50 - dy1], [75, 50 - dy1], [100, 50], [75, 50 + dy1], [25, 50 + dy1]][index]])) {
    near(actual[0], expected[0], 'hexagon x'); near(actual[1], expected[1], 'hexagon y');
  }
  // Every preset is a mask.
  assert.equal(imageShape('chevron', box).preset, 'chevron');
});
`],
  [T, `  assert.deepEqual(image.border, { color: 'dark1', width: 18 });`, `  assert.deepEqual(image.stroke, { color: 'dark1', width: 18, dash: 'solid', cap: 'flat', join: 'miter', miterLimit: 8, compound: 'single', align: 'center' });`],
  [T, `{ opacity: 2 }, { stroke: { color: 'dark1' } },`, `{ opacity: 2 }, { stroke: { color: 'dark1', width: 70 } }, { border: { color: 'dark1', width: 2 } }, { cornerRadius: 0.1 },`],
  [T, `const frameOf = (image) => ({ fit: image.fit, box: image.box, shape: image.shape, ...(image.border ? { border: image.border } : {}), ...(image.opacity !== undefined ? { opacity: image.opacity } : {}),
  ...(image.recolor ? { recolor: image.recolor } : {}), ...(image.overlay ? { overlay: { color: image.overlay.color, opacity: image.overlay.opacity, box: image.overlay.box, shape: image.overlay.shape } } : {}) });`,
  `// SH-02: masks are SH-01's evaluated presets, so a frame's shape is compared by its preset and its non-default adjust values (0.14 wrote
// roundRect's and hexagon's defaults), and the picture's stroke (renamed from border) by its color and width.
const PRESET_DEFAULTS = { roundRect: { adj: 16667 }, hexagon: { adj: 25000, vf: 115470 } };
const shapeKey = (shape) => shape && { preset: shape.preset, adjust: Object.fromEntries(Object.entries(shape.adjust).filter(([name, value]) => PRESET_DEFAULTS[shape.preset]?.[name] !== value)) };
const frameOf = (image) => ({ fit: image.fit, box: image.box, shape: shapeKey(image.shape), ...(image.stroke ? { border: { color: image.stroke.color, width: image.stroke.width } } : {}), ...(image.opacity !== undefined ? { opacity: image.opacity } : {}),
  ...(image.recolor ? { recolor: image.recolor } : {}), ...(image.overlay ? { overlay: { color: image.overlay.color, opacity: image.overlay.opacity, box: image.overlay.box, shape: shapeKey(image.overlay.shape) } } : {}) });
const goldenFrame = (frame) => ({ ...frame, shape: shapeKey(frame.shape), ...(frame.overlay ? { overlay: { ...frame.overlay, shape: shapeKey(frame.overlay.shape) } } : {}) });`],
  [T, `    assert.deepEqual(overlay && { color: overlay.color, opacity: overlay.opacity, box: overlay.box, shape: overlay.shape }, expected.overlay, id);`,
    `    assert.deepEqual(overlay && { color: overlay.color, opacity: overlay.opacity, box: overlay.box, shape: shapeKey(overlay.shape) }, expected.overlay && { ...expected.overlay, shape: shapeKey(expected.overlay.shape) }, id);`],
  [T, `    assert.deepEqual(frameOf(item.image), frame, \`\${id} frame\`);`, `    assert.deepEqual(frameOf(item.image), goldenFrame(frame), \`\${id} frame\`);`],
  [T, `      const { box, shape, ...rest } = frameOf(item.image), { box: _box, shape: _shape, ...expectedRest } = frame;`, `      const { box, shape, ...rest } = frameOf(item.image), { box: _box, shape: _shape, ...expectedRest } = goldenFrame(frame);`],
  [T, `    } else assert.deepEqual(frameOf(item.image), frame, id);`, `    } else assert.deepEqual(frameOf(item.image), goldenFrame(frame), id);`],
];
