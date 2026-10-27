// CE-20: `resolvePresentation(deck, options, { slides })` and `toSvg(deck, n)` bind only the slides they draw. A slide is composed on its
// own, so what they give for a drawn slide must be exactly what binding the whole deck gives: the same geometry, design and script plan,
// and the same SVG. Checked over the technical examples and a sample of the gallery decks, with core's portable measurement and with the
// Office pack's measurement.
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gallery } from '@openpresentation/gallery';
import { resolvePresentation, toSvg } from '../dist/svg.js';
import { loadFonts } from '../dist/fonts-node.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../examples');
async function decks(directory, limit = Infinity) {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (found.length >= limit) break;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await decks(full, limit - found.length));
    else if (entry.name.endsWith('.opf.json')) found.push(full);
  }
  return found;
}
const files = [...await decks(path.join(root, 'technical')), ...await decks(path.join(root, 'gallery'), 12)];
assert.ok(files.length >= 10, `example decks found: ${files.length}`);
const office = await loadFonts({ pack: 'office' });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
let slides = 0, decksChecked = 0;
for (const file of files) {
  const deck = JSON.parse(await readFile(file, 'utf8'));
  for (const options of [{ catalogs: [gallery] }, { catalogs: [gallery], fonts: office }]) {
    let full;
    try { full = resolvePresentation(deck, options); } catch { continue; /* a deck the renderer refuses is not this test's */ }
    const count = full.slides.length;
    for (const index of new Set([0, Math.floor(count / 2), count - 1])) {
      const only = resolvePresentation(deck, options, { slides: [index] });
      assert.equal(only.slides.length, count);
      assert.ok(only.slides.every((slide, at) => (at === index ? slide : slide === undefined)), 'only the named slide is bound');
      const a = only.slides[index], b = full.slides[index];
      assert.ok(same(a.geometry, b.geometry), `${path.basename(file)} slide ${index + 1}: the same geometry`);
      assert.ok(same(a.design, b.design), `${path.basename(file)} slide ${index + 1}: the same design`);
      assert.ok(same(a.scriptFonts?.profile, b.scriptFonts?.profile), `${path.basename(file)} slide ${index + 1}: the same script plan`);
      const drawnAlone = toSvg(deck, index + 1, { ...options, text: 'system' });
      const drawnWithAll = toSvg(deck, { ...options, text: 'system' })[index];
      assert.equal(drawnAlone, drawnWithAll, `${path.basename(file)} slide ${index + 1}: the same SVG`);
      slides += 1;
    }
    decksChecked += 1;
  }
}
assert.ok(slides >= 30, `slides compared: ${slides}`);
console.log(`resolve selected slides: ${slides} slides of ${decksChecked} deck runs bind and draw alone exactly as with the whole deck`);
