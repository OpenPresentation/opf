// SH-02: shape blocks in core: the block kind, composition (frame, geometry, text fit), the fill, stroke and style vocabulary,
// lighter and darker ColorRefs, picture strokes and preset masks, and the validation findings.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyColorTransform, colorTransform, composeSlide, imageShape, resolveColorRef, resolveChartColors } from '../dist/composition.js';
import { validate } from '../dist/index.js';
import { presetGeometry } from '../dist/shape-geometry.js';

const deck = (blocks, extra = {}) => ({ name: 'Shapes', language: 'en-US', slides: [{ title: 'Shapes', blocks }], ...extra });
const shapes = (blocks) => composeSlide({ title: 'Shapes', blocks }, { presentation: deck(blocks) }).items.filter((item) => item.field === 'shape');
const ruleIds = (document) => validate(document).findings.filter((finding) => finding.ruleId !== 'opf/missing-language').map((finding) => [finding.ruleId, finding.path]);

test('a preset without an image, or a custom path, composes as one shape item with its text inside', () => {
  const [chevron, path] = shapes([{ shape: 'chevron', text: 'Plan' }, { path: 'M0 0 L1 0 L0.5 1 Z', text: 'Down' }]);
  assert.equal(chevron.path, 'slides.0.blocks.0.shape');
  assert.equal(chevron.type, 'shape');
  assert.equal(chevron.shape.preset, 'chevron');
  assert.equal(path.path, 'slides.0.blocks.1.path');
  assert.equal(path.shape.preset, undefined);
  assert.equal(path.shape.custom, 'M0 0 L1 0 L0.5 1 Z');
  // No text item of its own: the text is the shape's.
  assert.equal(composeSlide({ title: 'T', blocks: [{ shape: 'rect', text: 'x' }] }).items.filter((item) => item.field === 'text').length, 0);
  assert.ok(chevron.text && !chevron.text.overflow);
  assert.deepEqual(chevron.payload, { type: 'shape', shape: 'chevron', text: 'Plan' });
});

test('the frame takes the preset aspect (or aspectRatio) centered in the cell, and the paths are the preset at that frame', () => {
  const [arrow, circle, wide] = shapes([{ shape: 'rightArrow' }, { shape: 'ellipse' }, { shape: 'ellipse', aspectRatio: 3 }]);
  assert.ok(Math.abs(arrow.shape.box.width / arrow.shape.box.height - 2) < 1e-3);
  assert.ok(Math.abs(circle.shape.box.width - circle.shape.box.height) < 1e-3);
  assert.ok(Math.abs(wide.shape.box.width / wide.shape.box.height - 3) < 1e-3);
  const { box } = circle.shape;
  const local = presetGeometry('ellipse', box.width, box.height);
  assert.equal(circle.shape.paths.length, local.paths.length);
  assert.match(circle.shape.paths[0].d, /^M /);
  // The text rectangle is the preset's, moved to the frame.
  assert.ok(Math.abs(circle.shape.textRect.x - (box.x + local.textRect.x)) < 1e-3);
});

test('adjust values are OPF fractions and degrees, exported as DrawingML avLst; invalid ones fall back to the default', () => {
  const [round, pie, bad] = shapes([{ shape: 'roundRect', adjust: { adj: 0.3 } }, { shape: 'pie', adjust: { adj1: 0, adj2: 270 } }, { shape: 'roundRect', adjust: { adj: 0.9, adj7: 1 } }]);
  assert.deepEqual(round.shape.avLst, { adj: 30000 });
  assert.deepEqual(pie.shape.avLst, { adj1: 0, adj2: 16200000 });
  assert.deepEqual(bad.shape.adjust, {});
  assert.deepEqual(bad.shape.avLst, {});
});

test('the style decides what the shape leaves unset; an explicit fill or stroke wins', () => {
  const [moderate, subtle, intense, none, own] = shapes([{ shape: 'rect' }, { shape: 'rect', style: 'subtle' }, { shape: 'rect', style: 'intense' }, { shape: 'rect', style: 'none' },
    { shape: 'rect', fill: 'accent3', stroke: 'none', shadow: 'hard' }]);
  assert.equal(moderate.shape.style, 'moderate');
  assert.deepEqual(moderate.shape.fill, { type: 'solid', color: 'accent1' });
  assert.deepEqual(moderate.shape.stroke.color, { color: 'accent1', darken: 0.5 });
  assert.equal(moderate.shape.styleRef.line.idx, 2);
  assert.deepEqual(subtle.shape.fill.color, { color: 'accent1', lighten: 0.8 });
  assert.equal(intense.shape.stroke, undefined);
  assert.equal(intense.shape.textBold, true);
  assert.deepEqual(intense.shape.effects, { shadow: 'soft' });
  assert.deepEqual(none.shape.fill, { type: 'none' });
  assert.equal(none.shape.stroke, undefined);
  assert.equal(none.shape.styleRef, undefined);
  assert.deepEqual(own.shape.fill, { type: 'solid', color: 'accent3' });
  assert.equal(own.shape.stroke, undefined);
  assert.deepEqual(own.shape.effects, { shadow: 'hard' });
});

test('fills and strokes take every form of the vocabulary', () => {
  const [gradient, pattern, stroked, open] = shapes([
    { shape: 'rect', fill: { gradient: { type: 'radial', stops: [{ color: 'light1', position: 1 }, { color: 'accent1', position: 0 }] } }, opacity: 0.5 },
    { shape: 'rect', fill: { pattern: { preset: 'ltUpDiag', foregroundColor: 'accent1' } } },
    { shape: 'rect', stroke: { color: 'text', width: 3, dash: [4, 2], cap: 'round', join: 'bevel', compound: 'double', align: 'inside', sketch: 'curved' } },
    { shape: 'arc', fill: 'none', stroke: { width: 2, start: { type: 'oval', width: 'small' }, end: {} } },
  ]);
  assert.equal(gradient.shape.fill.gradient.type, 'radial');
  assert.deepEqual(gradient.shape.fill.gradient.stops.map((stop) => stop.position), [0, 1]);
  assert.equal(gradient.shape.fill.opacity, 0.5);
  assert.deepEqual(pattern.shape.fill, { type: 'pattern', preset: 'ltUpDiag', foreground: 'accent1' });
  assert.deepEqual(stroked.shape.stroke, { color: 'text', width: 3, dash: [4, 2], cap: 'round', join: 'bevel', miterLimit: 8, compound: 'double', align: 'inside', sketch: 'curved' });
  assert.deepEqual(open.shape.stroke.start, { type: 'oval', width: 'small', length: 'medium' });
  assert.deepEqual(open.shape.stroke.end, { type: 'triangle', width: 'medium', length: 'medium' });
  const line = open.shape.paths.find((path) => path.stroke);
  assert.equal(line.open, true);
  assert.ok(line.ends.start && line.ends.end);
});

test('text fits inside the text rectangle by the measured fonts and never shrinks below the floor', () => {
  const [fits] = shapes([{ shape: 'ellipse', text: 'Ship' }]);
  assert.ok(fits.text.fontSize >= 16);
  const long = 'A long sentence that cannot fit inside a small star at a readable size, however it wraps, so it overflows. '.repeat(4);
  const composed = composeSlide({ title: 'T', blocks: [{ shape: 'star5', text: long }, { text: 'x' }, { text: 'y' }, { text: 'z' }] });
  const star = composed.items.find((item) => item.field === 'shape');
  assert.equal(star.text.overflow, true);
  assert.ok(star.text.fontSize >= 16 - 1e-9);
  assert.deepEqual(composed.diagnostics.filter((entry) => entry.code === 'text-overflow').map((entry) => entry.path), ['slides.0.blocks.0.text']);
  // The anchor places the fitted block in its rectangle.
  const [top, bottom] = shapes([{ shape: 'rect', text: 'a', anchor: 'top' }, { shape: 'rect', text: 'a', anchor: 'bottom' }]);
  assert.equal(top.shape.textArea.y, top.shape.textBox.y);
  assert.ok(bottom.shape.textArea.y > bottom.shape.textBox.y);
  // Vertical text is fitted in the box turned about its center.
  const [vertical] = shapes([{ shape: 'rect', aspectRatio: 0.5, text: 'Up', textDirection: 'vertical' }]);
  assert.ok(vertical.shape.textBox.width > vertical.shape.textBox.height);
});

test('rotate, flip, accessibility and link are carried for the engines', () => {
  const [shape] = shapes([{ shape: 'rect', rotate: -30, flip: 'both', alt: 'Box', decorative: true, hidden: true, link: 'https://example.com' }]);
  assert.equal(shape.shape.rotate, 330);
  assert.equal(shape.shape.flipH, true);
  assert.equal(shape.shape.flipV, true);
  assert.equal(shape.shape.alt, 'Box');
  assert.equal(shape.shape.decorative, true);
  assert.equal(shape.shape.hidden, true);
  assert.equal(shape.shape.link, 'https://example.com');
});

test('ColorRef takes a lighter or darker form, resolved as PowerPoint\'s lumMod and lumOff', () => {
  assert.deepEqual(colorTransform({ color: 'accent1', lighten: 0.4 }), { color: 'accent1', lumMod: 60000, lumOff: 40000 });
  assert.deepEqual(colorTransform({ color: 'accent1', darken: 0.25 }), { color: 'accent1', lumMod: 75000, lumOff: 0 });
  assert.equal(colorTransform({ color: 'accent1' }), undefined);
  assert.equal(colorTransform({ color: 'accent1', lighten: 0.2, darken: 0.2 }), undefined);
  const options = { colorScheme: { accent1: '#4472C4' }, fallback: '#000000' };
  assert.equal(resolveColorRef({ color: 'accent1', lighten: 0.4 }, options), '#8FAADC');
  assert.equal(resolveColorRef({ color: 'accent1', darken: 0.25 }, options), '#2F5597');
  assert.equal(resolveColorRef({ color: { color: '#FFFFFF', darken: 0.5 }, lighten: 0.5 }, options), '#C0C0C0');
  assert.equal(applyColorTransform('#FFFFFF80', { lumMod: 50000, lumOff: 0 }), '#80808080');
  assert.deepEqual(resolveChartColors([{ color: 'accent1', lighten: 0.4 }], { accent1: '#4472C4' }), ['#8FAADC']);
  const valid = validate(deck([{ shape: 'rect', fill: { color: 'accent1', lighten: 0.4 }, text: [{ text: 'x', color: { color: 'text', darken: 0.2 } }] }],
    { design: { background: { type: 'solid', color: { color: 'light1', darken: 0.05 } } } }));
  assert.equal(valid.valid, true);
  // An undeclared variable inside the lighter form is still found.
  assert.deepEqual(ruleIds(deck([{ shape: 'rect', fill: { color: 'var:brand', lighten: 0.2 } }])).filter(([rule]) => rule === 'opf/variable-reference-unknown'), []);
  assert.deepEqual(ruleIds(deck([{ table: { columns: ['A'], rows: [[{ value: 'x', style: { fill: { color: 'var:brand', lighten: 0.2 } } }]] } }])),
    [['opf/variable-reference-unknown', '/slides/0/blocks/0/table/rows/0/0/style/fill/color']]);
});

test('an image block takes stroke (renamed from border), every preset as its mask, and adjust for the corner', () => {
  const photo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9V3iWggAAAAASUVORK5CYII=';
  const image = composeSlide({ title: 'T', blocks: [{ image: photo, shape: 'roundRect', adjust: { adj: 0.25 }, stroke: { color: 'accent1', width: 3, dash: 'dash' } }] })
    .items.find((item) => item.field === 'image').image;
  assert.equal(image.shape.preset, 'roundRect');
  assert.deepEqual(image.shape.adjust, { adj: 25000 });
  assert.equal(image.stroke.width, 3);
  assert.equal(image.stroke.dash, 'dash');
  assert.equal(image.stroke.join, 'miter');
  assert.equal(image.border, undefined);
  const star = imageShape('star5', { x: 0, y: 0, width: 100, height: 100 });
  assert.equal(star.preset, 'star5');
  assert.match(star.path, /^M ?0 /);
  // The old names are not presets: no alias.
  assert.ok(ruleIds(deck([{ image: photo, shape: 'circle' }])).some(([rule]) => rule === 'opf/schema'));
  assert.ok(ruleIds(deck([{ image: photo, border: { color: 'accent1', width: 2 } }])).some(([rule]) => rule === 'opf/schema'));
});

test('validation: shape findings and shape-only keys', () => {
  assert.deepEqual(ruleIds(deck([{ shape: 'roundRect', adjust: { adj1: 0.3, adj: 0.9 } }])),
    [['opf/shape-adjust-unknown', '/slides/0/blocks/0/adjust/adj1'], ['opf/shape-adjust-range', '/slides/0/blocks/0/adjust/adj']]);
  assert.deepEqual(ruleIds(deck([{ path: 'M0 0 L1 1', adjust: { adj: 0.2 } }])), [['opf/shape-adjust-unknown', '/slides/0/blocks/0/adjust/adj']]);
  assert.deepEqual(ruleIds(deck([{ shape: 'rect', hidden: true, link: 'https://example.com' }])), [['opf/shape-link-hidden', '/slides/0/blocks/0/link']]);
  assert.deepEqual(ruleIds(deck([{ text: 'x', fill: 'accent1', rotate: 10 }])),
    [['opf/shape-option-unsupported-payload', '/slides/0/blocks/0/fill'], ['opf/shape-option-unsupported-payload', '/slides/0/blocks/0/rotate']]);
  assert.ok(ruleIds(deck([{ shape: 'roundedRectangle' }])).some(([rule]) => rule === 'opf/schema'));
  assert.ok(ruleIds(deck([{ type: 'shape', text: 'x' }])).some(([rule]) => rule === 'opf/schema'));
  // A shape with bullets beside it mixes two kinds.
  assert.ok(ruleIds(deck([{ shape: 'rect', bullets: ['a'] }])).length > 0);
  assert.deepEqual(ruleIds(deck([{ shape: 'chevron', text: 'Plan', style: 'subtle', rotate: 5, flip: 'vertical', anchor: 'top', padding: 4, textDirection: 'vertical', alt: 'Plan', link: 'mailto:a@b.c' }])), []);
});
