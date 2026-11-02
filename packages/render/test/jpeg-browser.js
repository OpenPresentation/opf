import {toSvg} from '@openpresentation/opf-render';

const out = document.querySelector('pre');
const report = {passed: false, cases: 0, decoded: [], measurements: [], controls: [], preOrientedPngMeasurements: []};
// EXIF's eight transforms in the 120 × 60 fixture's original coordinates.
// This reference does not use the renderer's orientation helpers.
const transforms = [
  'matrix(1 0 0 1 0 0)', 'matrix(-1 0 0 1 120 0)',
  'matrix(-1 0 0 -1 120 60)', 'matrix(1 0 0 -1 0 60)',
  'matrix(0 1 1 0 0 0)', 'matrix(0 1 -1 0 60 0)',
  'matrix(0 -1 -1 0 60 120)', 'matrix(0 -1 1 0 0 120)',
];
async function toUri(name, type) {
  const response = await fetch('/test/fixtures/jpeg/' + name);
  if (!response.ok) throw new Error(`Missing fixture ${name}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  return 'data:' + type + ';base64,' + btoa(String.fromCharCode(...bytes));
}
async function pixels(source, svg = true) {
  const url = svg ? URL.createObjectURL(new Blob([source], {type: 'image/svg+xml'})) : source;
  try {
    const image = new Image(); image.src = url; await image.decode();
    const canvas = new OffscreenCanvas(image.naturalWidth, image.naturalHeight);
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    return {width: canvas.width, height: canvas.height, data: context.getImageData(0, 0, canvas.width, canvas.height).data};
  } finally { if (svg) URL.revokeObjectURL(url); }
}
function difference(a, b) {
  if (a.width !== b.width || a.height !== b.height) throw new Error('Image dimensions differ');
  let max = 0, total = 0, large = 0;
  for (let i = 0; i < a.data.length; i++) {
    const delta = Math.abs(a.data[i] - b.data[i]);
    max = Math.max(max, delta); total += delta; if (delta > 10) large++;
  }
  return {max, mean: total / a.data.length, largePercent: large / a.data.length * 100};
}
// Preserve the original aggregate limits, including both required conditions.
const accepted = metric => metric.mean <= 1 && metric.largePercent <= 2;
// LH-84: a cover crop of a portrait picture into a wider frame keeps the point 30% down the picture in view (heads stay in
// frame) instead of centering it. The orientation decides what is portrait: EXIF 5 to 8 turn the 120 × 60 fixture into 60 × 120.
const PORTRAIT_FOCUS_Y = 0.3;
const attributes = tag => key => {
  const value = tag.match(new RegExp(` ${key}="([^"]+)"`))?.[1];
  if (value === undefined) throw new Error(`Missing image ${key}`);
  return value;
};
const near = (actual, expected) => Math.abs(Number(actual) - expected) < 0.01;
// Keep sampling in the original pixel coordinates, as the JPEG decoder does.
// Scaling an already-transposed PNG uses a different interpolation phase on
// macOS Chromium. Native decode/orientation is separately checked against all
// independent Pillow PNGs, without a scaling allowance.
const oriented = (orientation, png) => `<image width="120" height="60" href="${png}" transform="${transforms[orientation - 1]}" />`;
function referenceSvg(svg, orientation, imageFit, png, {focusY = PORTRAIT_FOCUS_Y, verify = true} = {}) {
  const shown = orientation >= 5 ? [60, 120] : [120, 60];
  // The fixture's frame is square (aspectRatio 1), so a portrait picture is narrower than its frame.
  if (imageFit === 'cover' && shown[0] < shown[1]) {
    // The frame clips a picture placed at its focus: an overflow-hidden viewport around an unscaled-aspect image.
    const nested = svg.match(/<svg\b[^>]* overflow="hidden"[^>]*>(<image\b[^>]+\/>)<\/svg>/);
    if (!nested) throw new Error('Incorrect fit/crop mode');
    const frame = attributes(nested[0].slice(0, nested[0].indexOf('>') + 1)), image = attributes(nested[1]);
    const side = Number(frame('width')), height = side * shown[1] / shown[0];
    const y = Math.max(side - height, side / 2 - focusY * height);
    if (verify && (image('preserveAspectRatio') !== 'none' || !near(frame('height'), side) || !near(image('x'), 0) || !near(image('width'), side) || !near(image('height'), height) || !near(image('y'), y))) throw new Error('Incorrect portrait focus');
    return svg.replace(nested[1], `<svg x="0" y="${y}" width="${side}" height="${height}" viewBox="0 0 ${shown.join(' ')}" preserveAspectRatio="none">${oriented(orientation, png)}</svg>`);
  }
  const tag = svg.match(/<image\b[^>]+\/>/)?.[0];
  if (!tag) throw new Error('Missing rendered image');
  const attribute = attributes(tag);
  const aspect = `xMidYMid ${imageFit === 'contain' ? 'meet' : 'slice'}`;
  if (attribute('preserveAspectRatio') !== aspect) throw new Error('Incorrect fit/crop mode');
  return svg.replace(tag, `<svg x="${attribute('x')}" y="${attribute('y')}" width="${attribute('width')}" height="${attribute('height')}" viewBox="0 0 ${shown.join(' ')}" preserveAspectRatio="${aspect}" overflow="hidden">${oriented(orientation, png)}</svg>`);
}
const deck = (jpeg, imageFit) => ({design: {imageFit}, slides: [{blocks: [{type: 'image', image: jpeg, aspectRatio: 1}]}]});
try {
  const originalPng = await toUri('expected-1.png', 'image/png');
  for (let orientation = 1; orientation <= 8; orientation++) {
    const jpeg = await toUri(`orientation-${orientation}.jpg`, 'image/jpeg');
    const png = await toUri(`expected-${orientation}.png`, 'image/png');
    const decoded = difference(await pixels(jpeg, false), await pixels(png, false));
    report.decoded.push({orientation, ...decoded});
    if (decoded.max > 2) throw new Error(`Orientation ${orientation}: decoded pixels differ from Pillow`);
    for (const imageFit of ['contain', 'cover']) {
      const svg = toSvg(deck(jpeg, imageFit), 1);
      const actual = await pixels(svg);
      const expected = await pixels(referenceSvg(svg, orientation, imageFit, originalPng));
      const metric = difference(actual, expected);
      report.measurements.push({orientation, imageFit, ...metric});
      // Retain the original comparison as evidence of browser interpolation;
      // it no longer conflates sampling differences with EXIF orientation.
      report.preOrientedPngMeasurements.push({orientation, imageFit, ...difference(actual, await pixels(svg.replace(jpeg, png)))});
      if (!accepted(metric)) throw new Error(`Orientation ${orientation} ${imageFit}: excessive image mismatch`);
      const wrongJpeg = await toUri(`orientation-${orientation % 8 + 1}.jpg`, 'image/jpeg');
      const wrongOrientation = difference(await pixels(svg.replace(jpeg, wrongJpeg)), expected);
      // The other fit mode, drawn by the renderer, must not match this mode's reference.
      const wrongFill = difference(await pixels(toSvg(deck(jpeg, imageFit === 'contain' ? 'cover' : 'contain'), 1)), expected);
      const control = {orientation, imageFit, wrongOrientation, wrongFill};
      // A portrait cover crop: the centered crop (no head focus) must not match either.
      if (imageFit === 'cover' && orientation >= 5) control.centeredCrop = difference(actual, await pixels(referenceSvg(svg, orientation, imageFit, originalPng, {focusY: 0.5, verify: false})));
      report.controls.push(control);
      if (accepted(wrongOrientation) || accepted(wrongFill) || (control.centeredCrop && accepted(control.centeredCrop))) throw new Error('Incorrect orientation, fit/crop or focus control was accepted');
      report.cases++;
    }
  }
  report.passed = true;
  report.checks = 'All eight native decodes against independent Pillow PNGs; SVG fit/crop against explicit EXIF transforms, portrait cover crops at the LH-84 head focus; wrong orientation, the other fit mode and a centered portrait crop rejected in every case';
} catch (error) { report.error = error.stack; }
out.textContent = JSON.stringify(report, null, 2);
document.title = `${report.passed ? 'PASS' : 'FAIL'}: JPEG browser orientation`;
