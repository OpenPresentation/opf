// RR-45 (opf#368, item 2): the native ink check agrees with the previous per-pixel loop, and leaked ink fails.
// sharp comes from the renderer checkout, as in scripts/test-metric-outline-browser.mjs.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import test from 'node:test';
import {insideRect, measureInk, outsideCell, referenceInk} from './metric-outline-ink.mjs';
const sharp = createRequire(new URL('../../opf-render/package.json', import.meta.url))('sharp');

// A deterministic pseudo-random generator, so a failure reproduces.
function random(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function blank(width, height, channels = 3) { return {data: Buffer.alloc(width * height * channels), width, height, channels}; }
function paint(image, x, y, rgb) { const at = (y * image.width + x) * image.channels; for (let i = 0; i < 3; i++) image.data[at + i] = rgb[i]; }

test('insideRect is exactly the pixels the previous predicate keeps', () => {
  const next = random(7);
  for (let i = 0; i < 400; i++) {
    const width = 1 + Math.floor(next() * 40), height = 1 + Math.floor(next() * 40);
    // Cells with fractional edges, edges exactly on pixel centers +- 0.1, and cells partly or wholly off the image.
    const edge = () => [next() * 50 - 5, Math.floor(next() * 40) + .5 - .1, Math.floor(next() * 40) + .4, Math.floor(next() * 40)][Math.floor(next() * 4)];
    const x = edge(), y = edge(), cell = {x, y, width: Math.max(0, edge() - x + next() * 20), height: Math.max(0, edge() - y + next() * 20)};
    const rect = insideRect(cell, width, height);
    for (let py = 0; py < height; py++) for (let px = 0; px < width; px++) {
      const inRect = Boolean(rect) && px >= rect.left && px < rect.left + rect.width && py >= rect.top && py < rect.top + rect.height;
      assert.equal(inRect, !outsideCell(cell, px, py), `pixel ${px},${py} of cell ${JSON.stringify(cell)}`);
    }
  }
});

test('measureInk gives the previous verdicts on random masks, regions and cells', async () => {
  const next = random(11);
  for (let i = 0; i < 300; i++) {
    const width = 8 + Math.floor(next() * 60), height = 8 + Math.floor(next() * 60), channels = next() < .5 ? 3 : 4;
    const image = blank(width, height, channels);
    const region = {left: Math.floor(next() * 4), top: Math.floor(next() * 4)};
    region.width = width - region.left - Math.floor(next() * 4); region.height = height - region.top - Math.floor(next() * 4);
    const dots = Math.floor(next() * 4);
    for (let d = 0; d < dots; d++) {
      const rgb = [0, 0, 0]; rgb[Math.floor(next() * 3)] = 1 + Math.floor(next() * 255);
      paint(image, Math.floor(next() * width), Math.floor(next() * height), rgb);
    }
    const cell = {x: next() * region.width * .6 - 2, y: next() * region.height * .6 - 2, width: next() * region.width, height: next() * region.height};
    const reference = referenceInk(image, region, cell), measured = await measureInk(sharp, image, region, cell);
    assert.equal(measured.ink, reference.pixels > 0, `ink, case ${i}`);
    assert.equal(measured.outside, reference.outside.length > 0, `outside ink, case ${i}`);
  }
});

test('ink that leaks past the cell by more than 0.1 px fails; ink within the tolerance passes', async () => {
  const image = blank(40, 30), region = {left: 0, top: 0, width: 40, height: 30};
  const cell = {x: 10, y: 10, width: 10, height: 5}; // pixel centers 9.5 .. 19.5 are 0.5 outside, so pixels 10..19 are inside
  for (let x = 10; x < 20; x++) for (let y = 10; y < 15; y++) paint(image, x, y, [255, 255, 255]);
  assert.deepEqual(await measureInk(sharp, image, region, cell).then(({ink, outside}) => ({ink, outside})), {ink: true, outside: false});
  for (const [x, y] of [[9, 12], [20, 12], [15, 9], [15, 15], [0, 0], [39, 29]]) {
    const leaked = {...image, data: Buffer.from(image.data)}; paint(leaked, x, y, [0, 0, 1]);
    assert.equal((await measureInk(sharp, leaked, region, cell)).outside, true, `leak at ${x},${y}`);
    assert.equal(referenceInk(leaked, region, cell).outside.length, 1, `reference leak at ${x},${y}`);
  }
  // A cell edge 0.1 px from a pixel center keeps that pixel inside; 0.1 px plus a hair does not.
  const edgeImage = blank(10, 10), edgeRegion = {left: 0, top: 0, width: 10, height: 10}; paint(edgeImage, 2, 5, [9, 9, 9]);
  assert.equal((await measureInk(sharp, edgeImage, edgeRegion, {x: 2.6, y: 0, width: 5, height: 10})).outside, false);
  assert.equal((await measureInk(sharp, edgeImage, edgeRegion, {x: 2.6001, y: 0, width: 5, height: 10})).outside, true);
  // A blank mask has no ink at all, and a cell entirely off the image leaves every inked pixel outside.
  assert.deepEqual(await measureInk(sharp, blank(5, 5), {left: 0, top: 0, width: 5, height: 5}, cell).then(({ink, outside}) => ({ink, outside})), {ink: false, outside: false});
  assert.equal((await measureInk(sharp, image, region, {x: 100, y: 100, width: 5, height: 5})).outside, true);
});

test('only the region of the part counts, not its neighbours in the screenshot', async () => {
  const image = blank(30, 10); paint(image, 25, 5, [255, 255, 255]); // ink in the right-hand neighbour
  const measured = await measureInk(sharp, image, {left: 0, top: 0, width: 15, height: 10}, {x: 2, y: 2, width: 3, height: 3});
  assert.deepEqual({ink: measured.ink, outside: measured.outside}, {ink: false, outside: false});
  const right = await measureInk(sharp, image, {left: 15, top: 0, width: 15, height: 10}, {x: 9, y: 4, width: 3, height: 3});
  assert.deepEqual({ink: right.ink, outside: right.outside}, {ink: true, outside: false});
});
