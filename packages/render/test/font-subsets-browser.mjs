// RR-65: a browser draws an SVG whose embedded faces are glyph subsets exactly like the same SVG with whole faces. Every slide
// of a spread of core example decks (Latin, and the script faces embedded too) is screenshotted both ways in a real browser and
// must be pixel-identical; a subset the browser's font sanitizer refused would fall back to another font and differ.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { examples } from '@openpresentation/opf/examples';
import { loadFonts } from '../dist/fonts-node.js';
import { toSvg } from './catalog-harness.mjs'; // FA-23: registers the gallery snapshot (the examples name gallery records)

const fonts = await loadFonts({ pack: 'office', substitutionPolicy: 'visual', scripts: 'all', embedScriptFonts: true });
const decks = examples.filter((example, index) => index % 6 === 0 || /arabic|japanese|hindi|chinese|korean|thai|hebrew|rtl|cjk/i.test(example.file));
const browser = await chromium.launch({ channel: process.platform === 'win32' && !process.env.CI ? 'msedge' : undefined });
let slides = 0, faces = 0;
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const shot = async (svg) => {
    await page.setContent(`<!doctype html><style>body{margin:0}</style>${svg}`);
    await page.evaluate(() => document.fonts.ready);
    return page.screenshot({ clip: { x: 0, y: 0, width: 1280, height: 720 } });
  };
  // Neither scaler reference character is authored here. Small regular text exposed the macOS regression;
  // include fractional sizes, larger controls and all office weights/styles rather than relying on one cover slide.
  const sample = 'Revenue 12% — affine';
  assert.ok(!/[Xo]/.test(sample));
  for (const face of fonts.embeddedFonts.filter(face => ['Intos', 'Intos Display'].includes(face.family))) {
    const subset = fonts.subsets.subsetDataUrl(face, [...sample].map(character => character.codePointAt(0)));
    for (const size of [12, 14.4, 16, 25, 54]) {
      const svg = data => `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><style>@font-face{font-family:"${face.family}";font-weight:${face.weight};font-style:${face.italic ? 'italic' : 'normal'};src:url("${data}")}</style><text x="31.25" y="80.5" font-family="${face.family}" font-weight="${face.weight}" font-style="${face.italic ? 'italic' : 'normal'}" font-size="${size}">${sample}</text></svg>`;
      assert.ok((await shot(svg(subset))).equals(await shot(svg(face.dataUrl))), `${face.family} ${face.weight} ${face.italic ? 'italic' : 'normal'} ${size}px: unadjusted subset text matches the whole face`);
    }
  }
  for (const { file, deck } of decks) {
    const whole = toSvg(deck, { fonts, subsetFonts: false }), cut = toSvg(deck, { fonts });
    for (const [index, svg] of cut.entries()) {
      faces += (svg.match(/@font-face/g) ?? []).length;
      assert.ok(svg.length <= whole[index].length, `${file}#${index}: the subset SVG is not larger`);
      assert.ok((await shot(svg)).equals(await shot(whole[index])), `${file}#${index}: the browser draws the subset faces like the whole faces`);
      slides++;
    }
  }
} finally {
  await browser.close();
}
assert.ok(slides > 100 && faces > slides, `${slides} slides, ${faces} embedded faces`);
console.log(`Font subsets in the browser: ${slides} example slides (${faces} embedded faces) draw identically with subset and whole faces.`);
