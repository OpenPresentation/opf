import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {unzipSync} from 'fflate';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
import {toPptx} from './helpers/default-catalog.mjs';

// RR-59 (opf-pptx#214): text the engine generates asks for weights a font policy cannot always resolve: the "Image
// unavailable" label and the video caption at 600, core's metric value at 800, metric labels and timeline event text at
// 500. Under the default (metric) policy the office pack's Intos stands in for Aptos at 400 and 700 only, so 0.16.0 failed
// font-unavailable on any deck with an unresolved image. DrawingML has only a bold flag, so such a run is measured at the
// face PowerPoint draws it with (700 from 600, 400 below), and an export under the default policy equals the visual one.
const decoder = new TextDecoder();
const fonts = await loadFonts({pack: 'office'});
const visual = await loadFonts({pack: 'office', substitutionPolicy: 'visual'});
const slideXml = bytes => decoder.decode(unzipSync(bytes)['ppt/slides/slide1.xml']);
const shapes = xml => [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(([shape]) => ({
  name: shape.match(/<p:cNvPr\b[^>]*\bname="([^"]*)"/)?.[1] ?? '',
  text: [...shape.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(match => match[1]).join(''),
  bold: shape.match(/<a:rPr\b[^>]*\bb="(\d)"/)?.[1],
  typeface: shape.match(/<a:latin typeface="([^"]*)"/)?.[1],
}));
const exportDeck = async (slide, options = {}) => {
  const diagnostics = [];
  const bytes = await toPptx({name: 'Unresolved', slides: [{id: 's', title: 'Title', ...slide}]}, {fonts, onDiagnostic: diagnostic => diagnostics.push(diagnostic), ...options});
  return {bytes, xml: slideXml(bytes), diagnostics};
};
const unresolved = diagnostics => diagnostics.filter(diagnostic => diagnostic.code === 'unresolved-asset').map(diagnostic => diagnostic.path);
const remote = name => `https://example.invalid/${name}.png`;

// An unresolved image in an image block, a quote photo, a logo and a background: export succeeds under the default policy,
// with the unresolved-asset warning and the placeholder (a background falls back to the slide colour, as before).
{
  const {xml, diagnostics} = await exportDeck({image: {src: remote('chart'), alt: 'Quarterly chart'}});
  assert.deepEqual(unresolved(diagnostics), ['slides.0.image']);
  const label = shapes(xml).find(shape => shape.text === 'Image unavailable');
  assert.ok(shapes(xml).some(shape => shape.name === 'OPF image placeholder 1'), 'the dashed placeholder panel is written');
  assert.ok(label, 'the placeholder label is written');
  assert.equal(label.bold, '1', 'the label is bold, as in the preview');
  assert.equal(label.typeface, 'Aptos', 'the PPTX names the chosen family, not its replacement');
  assert.ok(shapes(xml).some(shape => shape.text === 'Quarterly chart'), 'the alt text is the second line');
}
{
  const {xml, diagnostics} = await exportDeck({quote: {text: 'Hello world', attribution: 'Ada', photo: {src: remote('ada'), alt: 'Ada'}}});
  assert.deepEqual(unresolved(diagnostics), ['slides.0.quote.photo']);
  assert.ok(shapes(xml).some(shape => shape.name === 'OPF image placeholder 1'), 'the quote photo exports as the placeholder');
}
{
  const {xml, diagnostics} = await exportDeck({text: 'Body', design: {logo: remote('logo'), footer: {left: {logo: true}, right: {slideNumber: true}}}});
  assert.deepEqual(unresolved(diagnostics), ['slides.0.design.footer.left.logo']);
  assert.ok(shapes(xml).some(shape => shape.name === 'OPF image placeholder 1'), 'the logo exports as the placeholder');
}
{
  const {xml, diagnostics} = await exportDeck({text: 'Body', design: {background: {type: 'image', src: remote('ships'), alt: 'Ships at dawn'}}});
  assert.deepEqual(unresolved(diagnostics), ['slides.0.design.background']);
  assert.doesNotMatch(xml, /<p:bg>[\s\S]*?<a:blip\b/, 'no picture background is written for an unresolved image');
}

// The captions: a video caption (600) and an image block's caption beside the placeholder.
{
  const {xml} = await exportDeck({video: {src: 'https://example.invalid/tour.mp4', title: 'Product tour', description: 'Two minute tour'}});
  const caption = shapes(xml).find(shape => /^OPF media slides\.0\.video caption line 0$/.test(shape.name));
  assert.ok(caption, 'the video caption is written');
  assert.equal(caption.bold, '1');
  assert.equal(caption.typeface, 'Aptos');
}
{
  const {xml, diagnostics} = await exportDeck({image: {src: remote('figure'), alt: 'Figure'}, caption: 'Figure 1. Caption'});
  assert.deepEqual(unresolved(diagnostics), ['slides.0.image']);
  assert.ok(shapes(xml).some(shape => shape.text === 'Figure 1. Caption'), 'the caption is written');
}

// Core's engine weights: the metric value (800) and labels (500), timeline event text (500).
for (const slide of [
  {metric: {value: '42%', unit: 'pts', label: 'Growth', description: 'Year over year', delta: '+3', trend: 'up'}},
  {timeline: {name: 'Plan', events: [{when: 'Q1', what: 'Start', status: 'current', description: 'Kickoff'}, {when: 'Q2', what: 'Ship'}]}},
]) await exportDeck(slide);

// Measured at the face PowerPoint draws: the default-policy export is the visual-policy export, part for part.
for (const slide of [
  {image: {src: remote('chart'), alt: 'Quarterly chart'}},
  {video: {src: 'https://example.invalid/tour.mp4', title: 'Product tour'}},
  {metric: {value: '42%', label: 'Growth'}},
]) {
  const metric = unzipSync((await exportDeck(slide)).bytes), drawn = unzipSync((await exportDeck(slide, {fonts: visual})).bytes);
  assert.deepEqual(Object.keys(metric).sort(), Object.keys(drawn).sort());
  for (const part of Object.keys(metric)) assert.equal(Buffer.compare(Buffer.from(metric[part]), Buffer.from(drawn[part])), 0, `${part} matches the visual-policy export`);
}

// The error names the family, weight and style that are missing, and the ones that are loaded.
const require = createRequire(import.meta.url);
const intos = path.join(path.dirname(require.resolve('@openpresentation/opf-render/package.json')), 'fonts/intos');
const face = async (family, file, weight) => ({family, weight, italic: false, data: new Uint8Array(await readFile(path.join(intos, file)))});
const regularOnly = await loadFonts({pack: 'none', substitutionPolicy: 'metric', faces: [await face('Intos', 'Intos-Regular.ttf', 400)]});
await assert.rejects(
  toPptx({name: 'Bold', design: {fontScheme: {heading: 'Aptos', body: 'Aptos'}}, slides: [{id: 's', title: 'Title', text: 'Body'}]}, {fonts: regularOnly}),
  error => {
    assert.equal(error.code, 'font-unavailable');
    assert.equal(error.name, 'OPFFontError', 'the provider error class is kept');
    assert.equal(error.message, "No local font face for 'Aptos' at weight 700 upright under substitutionPolicy 'metric'. 'Aptos' resolves only at weight 400 upright (Intos). Load its replacement 'Intos' or licensed 'Aptos' files at weight 700 upright (loadFonts({faces})).");
    assert.deepEqual([error.details.fontFamily, error.details.fontWeight, error.details.italic, error.details.loadedStyles], ['Aptos', 700, false, [{weight: 400, italic: false}]]);
    assert.match(error.details.cause, /None of its replacements/, 'the provider message stays available');
    return true;
  });
// The placeholder label (600) whose bold face (700) is missing names both.
const displayBold = await loadFonts({pack: 'none', substitutionPolicy: 'metric', faces: [
  await face('Intos', 'Intos-Regular.ttf', 400), await face('Intos Display', 'IntosDisplay-Regular.ttf', 400), await face('Intos Display', 'IntosDisplay-Bold.ttf', 700),
]});
await assert.rejects(
  toPptx({name: 'Label', design: {fontScheme: {heading: 'Aptos Display', body: 'Aptos', code: 'Aptos'}}, slides: [{id: 's', image: {src: remote('chart'), alt: 'Chart'}}]}, {fonts: displayBold}),
  error => {
    assert.equal(error.code, 'font-unavailable');
    assert.equal(error.message, "No local font face for 'Aptos' at weight 600 upright under substitutionPolicy 'metric', nor at weight 700 upright, the face PowerPoint draws the run with. 'Aptos' resolves only at weight 400 upright (Intos). Load its replacement 'Intos' or licensed 'Aptos' files at weight 700 upright (loadFonts({faces})).");
    assert.equal(error.details.path, 'slides.0.image');
    return true;
  });
// A family that resolves at no weight keeps the provider's own message (here: a visual-only replacement under metric).
await assert.rejects(
  toPptx({name: 'Code', design: {fontScheme: {heading: 'Consolas', body: 'Consolas'}}, slides: [{id: 's', title: 'Title'}]}, {fonts}),
  error => error.code === 'font-unavailable' && /Its declared replacement Cousine is visual only/.test(error.message) && error.details.fontWeight === undefined);

console.log('Engine-generated text: unresolved image, quote photo, logo and background placeholders, captions, metric and timeline weights export under the default policy, measured at the drawn face; a missing weight names family, weight and style.');
