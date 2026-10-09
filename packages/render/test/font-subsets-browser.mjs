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
