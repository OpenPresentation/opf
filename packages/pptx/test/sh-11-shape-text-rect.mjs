// SH-11: shape text measures alike in the preview and in PowerPoint. PowerPoint wraps a shape's text in the preset's own text rectangle
// (`a:rect` of its geometry, evaluated at the shape's size with its `a:avLst`) less the body insets, at the run size the file names. The
// export must hand PowerPoint exactly the rectangle core fitted the text in (`shape.textBox`) and the size core chose, for every preset:
// the frame (`a:xfrm`), the adjust values and the insets read back from the file give core's textBox, and every run carries the fitted
// `sz`, with PowerPoint's wrap on and its autofit off. PowerPoint's own reading of the same files (font size, lines, line breaks, through
// COM) is the evidence in the SH-11 pull request.
import assert from 'node:assert/strict';
import { unzipSync } from 'fflate';
import { composeSlide } from '@openpresentation/opf/composition';
import { PRESET_SHAPES, adjustFromDrawingML, presetGeometry } from '@openpresentation/opf/shape-geometry';
import { toPptx } from '../dist/index.js';

const decode = bytes => new TextDecoder().decode(bytes);
const PER_SLIDE = 24;
const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 0.01, `${label}: ${actual} vs ${expected}`);

// Every preset as an overlay shape with short text, plus presets with adjust values, padding and vertical text, on slides of 24.
const entries = [
  ...PRESET_SHAPES.map(shape => ({ shape, text: 'Plan the launch' })),
  { shape: 'roundRect', adjust: { adj: 0.4 }, text: 'Go' },
  { shape: 'chevron', adjust: { adj: 0.7 }, text: 'Next step' },
  { shape: 'wedgeRectCallout', adjust: { adj1: 0.3, adj2: 0.8 }, text: 'Every team reviews the plan.' },
  { shape: 'hexagon', padding: 0, text: 'Ship it' },
  { shape: 'ellipse', padding: { top: 2, right: 20, bottom: 6, left: 4 }, text: 'Ask' },
  { shape: 'rect', textDirection: 'vertical', text: 'Turned text' },
  { shape: 'triangle', anchor: 'bottom', text: 'Base' },
];
const slides = [];
for (let start = 0; start < entries.length; start += PER_SLIDE) {
  slides.push({ title: 'Shapes', shapes: entries.slice(start, start + PER_SLIDE).map((entry, index) => ({ ...entry, x: 0.01 + (index % 6) * 0.165, y: 0.2 + Math.floor(index / 6) * 0.2, width: 0.12 + (index % 3) * 0.02, height: 0.15 })) });
}
const deck = { name: 'SH-11', language: 'en-US', slides };
const files = unzipSync(await toPptx(deck));
let checked = 0;
for (const [slideIndex, slide] of slides.entries()) {
  const xml = decode(files[`ppt/slides/slide${slideIndex + 1}.xml`]);
  const shapes = new Map([...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(match => [match[0].match(/<p:cNvPr\b[^>]*\bname="([^"]+)"/)?.[1], match[0]]));
  const composed = composeSlide(slide, { presentation: deck, slideIndex }).overlayShapes.filter(entry => entry.kind === 'shape');
  assert.equal(composed.length, slide.shapes.length);
  for (const entry of composed) {
    const label = `${entry.path} ${entry.shape.preset}`, shape = shapes.get(`OPF shape ${entry.path}`);
    assert.ok(shape, `${label}: exported`);
    const number = (pattern) => Number(shape.match(pattern)?.[1]);
    const box = { x: number(/<a:off x="(-?\d+)"/) / 9525, y: number(/<a:off x="-?\d+" y="(-?\d+)"/) / 9525, width: number(/<a:ext cx="(\d+)"/) / 9525, height: number(/<a:ext cx="\d+" cy="(\d+)"/) / 9525 };
    const preset = shape.match(/<a:prstGeom prst="([^"]+)">/)?.[1];
    assert.equal(preset, entry.shape.preset, `${label}: preset`);
    const avLst = Object.fromEntries([...(shape.match(/<a:prstGeom\b[\s\S]*?<\/a:prstGeom>/)?.[0] ?? '').matchAll(/<a:gd name="([^"]+)" fmla="val (-?\d+)"\/>/g)].map(([, name, value]) => [name, Number(value)]));
    const bodyPr = shape.match(/<a:bodyPr\b[^>]*>/)?.[0] ?? '';
    const inset = side => Number(bodyPr.match(new RegExp(`\\b${side}Ins="(\\d+)"`))?.[1]) / 9525;
    // PowerPoint's text rectangle: the preset's a:rect at the written frame and adjust values, less the written insets.
    const rect = presetGeometry(preset, box.width, box.height, adjustFromDrawingML(preset, avLst)).textRect;
    const inner = { x: box.x + rect.x + inset('l'), y: box.y + rect.y + inset('t'), width: rect.width - inset('l') - inset('r'), height: rect.height - inset('t') - inset('b') };
    const vertical = entry.shape.textDirection === 'vertical' || entry.shape.textDirection === 'vertical270';
    const textBox = entry.shape.textBox, expected = vertical ? { x: textBox.x + (textBox.width - textBox.height) / 2, y: textBox.y + (textBox.height - textBox.width) / 2, width: textBox.height, height: textBox.width } : textBox;
    for (const key of ['x', 'y', 'width', 'height']) near(inner[key], expected[key], `${label}: text rectangle ${key}`);
    // PowerPoint wraps there itself, at the size core fitted, and never autofits.
    assert.match(bodyPr, /\bwrap="square"/, `${label}: wrap`);
    assert.match(shape, /<a:noAutofit\/><\/a:bodyPr>/, `${label}: no autofit`);
    assert.ok(!/normAutofit|spAutoFit|fontScale/.test(shape), `${label}: no PowerPoint autofit`);
    const sizes = [...shape.matchAll(/<a:rPr\b[^>]*\bsz="(\d+)"/g)].map(match => Number(match[1]));
    assert.ok(sizes.length > 0, `${label}: runs carry sz`);
    for (const size of sizes) assert.equal(size, Math.round(entry.text.fontSize * 75), `${label}: run size`);
    checked++;
  }
}
assert.equal(checked, entries.length);
console.log(`SH-11 shape text rectangle: ${checked} shapes (${PRESET_SHAPES.length} presets) export core's textBox and size`);
