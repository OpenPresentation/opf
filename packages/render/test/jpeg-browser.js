import {renderSvg} from '@openpresentation/opf-render';

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
function referenceSvg(svg, orientation, imageFill, png) {
  const tag = svg.match(/<image\b[^>]+\/>/)?.[0];
  if (!tag) throw new Error('Missing rendered image');
  const attribute = key => {
    const value = tag.match(new RegExp(` ${key}="([^"]+)"`))?.[1];
    if (value === undefined) throw new Error(`Missing image ${key}`);
    return value;
  };
  const aspect = `xMidYMid ${imageFill === 'fit' ? 'meet' : 'slice'}`;
  if (attribute('preserveAspectRatio') !== aspect) throw new Error('Incorrect fit/crop mode');
  // Keep sampling in the original pixel coordinates, as the JPEG decoder does.
  // Scaling an already-transposed PNG uses a different interpolation phase on
  // macOS Chromium. Native decode/orientation is separately checked against all
  // independent Pillow PNGs, without a scaling allowance.
  return svg.replace(tag, `<svg x="${attribute('x')}" y="${attribute('y')}" width="${attribute('width')}" height="${attribute('height')}" viewBox="0 0 ${orientation >= 5 ? '60 120' : '120 60'}" preserveAspectRatio="${aspect}" overflow="hidden"><image width="120" height="60" href="${png}" transform="${transforms[orientation - 1]}" /></svg>`);
}
try {
  const originalPng = await toUri('expected-1.png', 'image/png');
  for (let orientation = 1; orientation <= 8; orientation++) {
    const jpeg = await toUri(`orientation-${orientation}.jpg`, 'image/jpeg');
    const png = await toUri(`expected-${orientation}.png`, 'image/png');
    const decoded = difference(await pixels(jpeg, false), await pixels(png, false));
    report.decoded.push({orientation, ...decoded});
    if (decoded.max > 2) throw new Error(`Orientation ${orientation}: decoded pixels differ from Pillow`);
    for (const imageFill of ['fit', 'crop']) {
      const svg = renderSvg({design: {imageFill}, slides: [{image: jpeg}]});
      const actual = await pixels(svg);
      const expected = await pixels(referenceSvg(svg, orientation, imageFill, originalPng));
      const metric = difference(actual, expected);
      report.measurements.push({orientation, imageFill, ...metric});
      // Retain the original comparison as evidence of browser interpolation;
      // it no longer conflates sampling differences with EXIF orientation.
      report.preOrientedPngMeasurements.push({orientation, imageFill, ...difference(actual, await pixels(svg.replace(jpeg, png)))});
      if (!accepted(metric)) throw new Error(`Orientation ${orientation} ${imageFill}: excessive image mismatch`);
      const wrongJpeg = await toUri(`orientation-${orientation % 8 + 1}.jpg`, 'image/jpeg');
      const wrongOrientation = difference(await pixels(svg.replace(jpeg, wrongJpeg)), expected);
      const wrongFillSvg = svg.replace(/preserveAspectRatio="xMidYMid (meet|slice)"/, `preserveAspectRatio="xMidYMid ${imageFill === 'fit' ? 'slice' : 'meet'}"`);
      const wrongFill = difference(await pixels(wrongFillSvg), expected);
      report.controls.push({orientation, imageFill, wrongOrientation, wrongFill});
      if (accepted(wrongOrientation) || accepted(wrongFill)) throw new Error('Incorrect orientation or fit/crop control was accepted');
      report.cases++;
    }
  }
  report.passed = true;
  report.checks = 'All eight native decodes against independent Pillow PNGs; SVG fit/crop against explicit EXIF transforms; wrong orientation and fit/crop rejected in every case';
} catch (error) { report.error = error.stack; }
out.textContent = JSON.stringify(report, null, 2);
document.title = `${report.passed ? 'PASS' : 'FAIL'}: JPEG browser orientation`;
