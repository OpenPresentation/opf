// opf#1438: an SVG picture's HSL gradient stops draw in the PNG as a browser draws them. resvg draws the slash-alpha form black and the
// number-only form not at all, so the PNG path converts the stops of its private copy to sRGB (core's svg-stop-colors, the conversion the
// PPTX export applies). Each form's band must match the same picture written with the converted colors; the SVG output is not touched.
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {svgHslStopsToSrgb} from '@openpresentation/opf/composition';
import {toPng} from '../dist/index.js';

const NS = 'xmlns="http://www.w3.org/2000/svg"';
const band = (id, y, stop) => `<linearGradient id="${id}"><stop offset="0" ${stop}/><stop offset="1" ${stop}/></linearGradient><rect y="${y}" width="90" height="30" fill="url(#${id})"/>`;
const picture = stops => `<svg ${NS} width="90" height="90">${stops.map((stop, index) => band(`g${index}`, index * 30, stop)).join('')}</svg>`;
const page = inner => `<svg ${NS} width="90" height="90" viewBox="0 0 90 90"><rect width="90" height="90" fill="#ffffff"/>`
  + `<image width="90" height="90" href="data:image/svg+xml;base64,${Buffer.from(inner).toString('base64')}"/></svg>`;
const pixels = async svg => (await sharp(await toPng(svg, {scale: 1})).removeAlpha().raw().toBuffer({resolveWithObject: true}));
const at = ({data, info}, x, y) => [...data.subarray((y * info.width + x) * info.channels, (y * info.width + x) * info.channels + 3)];

const forms = [
  // hsla(): legacy comma form with an alpha.
  {written: 'stop-color="hsla(120, 100%, 25%, 0.5)"', converted: 'stop-color="#008000" stop-opacity="0.5"', expected: [128, 192, 128]},
  // slash-alpha: modern space form, resvg draws it black.
  {written: 'stop-color="hsl(240 100% 50% / 0.5)"', converted: 'stop-color="#0000ff" stop-opacity="0.5"', expected: [128, 128, 255]},
  // number-only: modern form without percentages, resvg draws nothing.
  {written: 'stop-color="hsl(0 100 50)"', converted: 'stop-color="#ff0000"', expected: [255, 0, 0]},
];
const written = page(picture(forms.map(form => form.written)));
const reference = page(picture(forms.map(form => form.converted)));
const [actual, expected] = await Promise.all([pixels(written), pixels(reference)]);
assert.deepEqual([actual.info.width, actual.info.height], [expected.info.width, expected.info.height]);
for (const [index, form] of forms.entries()) {
  const y = index * 30 + 15;
  for (const x of [10, 45, 80]) {
    const got = at(actual, x, y), want = at(expected, x, y);
    for (let channel = 0; channel < 3; channel++) {
      assert.ok(Math.abs(got[channel] - want[channel]) <= 1, `${form.written} at ${x},${y}: ${got} vs converted ${want}`);
      assert.ok(Math.abs(got[channel] - form.expected[channel]) <= 2, `${form.written} at ${x},${y}: ${got} vs ${form.expected}`);
    }
  }
}

// The conversion is the shared one, and a form a browser does not draw stays as written.
assert.equal(svgHslStopsToSrgb(picture([forms[1].written])), picture(['stop-color="#0000ff" stop-opacity="0.5"']));
const invalid = picture(['stop-color="hsl(120, 100% 50%)"', 'stop-color="hsl(120, 100, 50)"']);
assert.equal(svgHslStopsToSrgb(invalid), invalid);

console.log('svg-image-hsl-png: 3 forms match their converted colors in the PNG; invalid forms kept');
