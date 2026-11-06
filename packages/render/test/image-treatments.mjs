// FA-23: the 15 pptx.gallery image treatments, written as 0.15 image backgrounds and image blocks, draw the same frames,
// outlines and pixels as the 0.14 renderer drew them as slide-level images (test/fixtures/image-treatments-0.14). Each
// document is self-contained (inline colour scheme, embedded asset), so no catalog is registered and none may be missing.
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { resolveSlideContext } from '@openpresentation/opf';
import { composeSlide } from '@openpresentation/opf/composition';
import { toSvg, toPng } from '../dist/index.js';
import { TREATMENTS, samplePicture, treatmentDocument } from './fixtures/image-treatments.mjs';

const directory = new URL('./fixtures/image-treatments-0.14/', import.meta.url);
const reference = JSON.parse(readFileSync(new URL('reference.json', directory), 'utf8'));
const picture = await samplePicture();
const failures = [];
let checked = 0;

// SH-02: outlines are SH-01's evaluated presets (L in place of 0.14's H and V), so a polygon is compared as the points it visits; an
// outline with arcs (SH-01 draws an ellipse as four quarter arcs, 0.14 as two halves) is checked by the pixels below.
function outlinePoints(d) {
  if (d === undefined) return undefined;
  if (/A/.test(d)) return 'arcs';
  const tokens = d.match(/[MLHVCSQTAZ]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) ?? [], points = [];
  let command = '', x = 0, y = 0;
  for (let at = 0; at < tokens.length;) {
    if (/^[MLHVCSQTAZ]$/i.test(tokens[at])) { command = tokens[at++]; if (command === 'Z') continue; }
    const read = () => Number(tokens[at++]);
    if (command === 'H') x = read(); else if (command === 'V') y = read();
    else if (command === 'A') { const arc = [read(), read(), read(), read(), read()]; x = read(); y = read(); points.push(...arc.slice(0, 2).map(value => (Math.round(value * 1000) / 1000 || 0))); }
    else { x = read(); y = read(); }
    points.push(Math.round(x * 1000) / 1000 || 0, Math.round(y * 1000) / 1000 || 0);
  }
  return points;
}

async function pixels(png) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, info };
}

for (const treatment of TREATMENTS) {
  const slug = treatment.slug, expected = reference.treatments[slug];
  const document = treatmentDocument(treatment, picture);
  // LH-02: the 0.14 renders predate core's automatic scrim behind text on a background picture without an overlay, so it is set aside here.
  for (const slide of document.slides) { const background = slide.design?.background; if (background && typeof background === 'object' && background.overlay === undefined) background.overlay = false; }
  // LH-164: a slide that is one short message takes the accent surface; these documents compare pixels with the 0.14 renders, which have the deck's own surface, stated here as the slide's variant.
  if (treatment.watermark) for (const slide of document.slides) slide.design = { variant: resolveSlideContext({ ...document, slides: [{ ...slide, subtitle: 'Plain surface' }] }, 0, {}).resolved.roles.variant, ...slide.design };
  const diagnostics = [];
  const svg = toSvg(document, 1, { onDiagnostic: entry => diagnostics.push(entry) });
  assert.deepEqual(diagnostics.filter(entry => entry.code.startsWith('unresolved-')).map(entry => entry.code), [], `${slug}: a self-contained treatment resolves everything`);

  // Geometry: the headings and the body compose in the same boxes, and the picture has the same frame and outlines.
  const context = resolveSlideContext(document, 0, {});
  const geometry = composeSlide(document.slides[0], context.options);
  const text = geometry.items.filter(item => item.field !== 'image').map(item => item.box);
  assert.deepEqual(text, expected.items.map(item => item.box), `${slug}: heading and body boxes`);
  if (treatment.block) {
    const image = geometry.items.find(item => item.field === 'image')?.image;
    assert.ok(image, `${slug}: image block geometry`);
    assert.deepEqual(image.region, expected.frame.region, `${slug}: band`);
    assert.deepEqual(image.box, expected.frame.box, `${slug}: frame`);
    assert.deepEqual(outlinePoints(image.shape.path), outlinePoints(expected.frame.shape), `${slug}: outline`);
    assert.deepEqual(outlinePoints(image.overlay?.shape.path), outlinePoints(expected.frame.overlay), `${slug}: overlay outline`);
    assert.equal(image.placement?.edge, treatment.placement.edge, `${slug}: placement edge`);
  } else if (treatment.background) {
    const background = geometry.backgroundImage;
    assert.ok(background, `${slug}: background image geometry`);
    assert.deepEqual(background.box, expected.frame.box, `${slug}: canvas frame`);
    assert.deepEqual(outlinePoints(background.overlay?.shape.path), outlinePoints(expected.frame.overlay), `${slug}: overlay outline`);
  }

  // Pixels: exactly the 0.14 render at the same scale, with the bundled fonts.
  const actual = await pixels(await toPng(svg, { scale: reference.scale }));
  const wanted = await pixels(readFileSync(new URL(`${slug}.png`, directory)));
  assert.deepEqual([actual.info.width, actual.info.height], [wanted.info.width, wanted.info.height], `${slug}: raster size`);
  let differing = 0, worst = 0;
  for (let index = 0; index < actual.data.length; index++) {
    const delta = Math.abs(actual.data[index] - wanted.data[index]);
    if (delta) { differing++; worst = Math.max(worst, delta); }
  }
  if (differing) {
    failures.push(`${slug}: ${differing} channel values differ (largest ${worst})`);
    const out = new URL('../artifacts/image-treatments/', import.meta.url);
    mkdirSync(out, { recursive: true });
    writeFileSync(new URL(`${slug}.0.15.png`, out), await toPng(svg, { scale: reference.scale }));
    writeFileSync(new URL(`${slug}.svg`, out), svg);
  }
  checked++;
}
assert.deepEqual(failures, [], `0.15 treatments differ from their 0.14 renders (see artifacts/image-treatments):\n${failures.join('\n')}`);
console.log(`image treatments: ${checked} treatments match their 0.14 frames and pixels`);
