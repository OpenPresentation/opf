// RR-45 (opf#368, item 2): the ink containment check of scripts/test-metric-outline-browser.mjs, measured with sharp's
// native stats() instead of a JavaScript loop over every pixel. The rule is unchanged: a mask pixel has ink when any of
// its R, G or B values is nonzero; a pixel is outside the cell when its center lies more than `tolerance` (0.1 reference
// pixels) outside the cell box. scripts/metric-outline-ink.test.mjs proves this module agrees with the per-pixel loop
// (`referenceInk`, the previous implementation) on random masks and cells, and that leaked ink fails.

// The exact predicate of the previous loop: a pixel at (x, y) is outside when this is true.
export const outsideCell = (cell, x, y, tolerance = .1) =>
  Math.max(cell.x - (x + .5), cell.y - (y + .5), x + .5 - (cell.x + cell.width), y + .5 - (cell.y + cell.height)) > tolerance + 1e-9;

// The pixels whose centers are inside the cell (plus the tolerance) form one rectangle, because each bound is monotone
// in x or y. It is found with the same floating-point expressions as `outsideCell`, column by column and row by row,
// so the two can never disagree at an edge. Returns inclusive bounds, or null when no pixel center is inside.
export function insideRect(cell, width, height, tolerance = .1) {
  const limit = tolerance + 1e-9;
  const insideX = x => !(cell.x - (x + .5) > limit) && !(x + .5 - (cell.x + cell.width) > limit);
  const insideY = y => !(cell.y - (y + .5) > limit) && !(y + .5 - (cell.y + cell.height) > limit);
  let x0 = -1, x1 = -1, y0 = -1, y1 = -1;
  for (let x = 0; x < width; x++) if (insideX(x)) { if (x0 < 0) x0 = x; x1 = x; }
  for (let y = 0; y < height; y++) if (insideY(y)) { if (y0 < 0) y0 = y; y1 = y; }
  return x0 < 0 || y0 < 0 ? null : {left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1};
}

const maxInk = stats => Math.max(...stats.channels.slice(0, 3).map(channel => channel.max));

// image: {data, width, height, channels} raw pixels (3 or 4 channels; only R, G and B count, as before).
// region: where this part's mask sits in the image, in slide pixels at (0, 0). cell: the accepted cell box in slide pixels.
// sharp's stats() reads its input, not the result of extract() or composite(), so every step is materialised first.
export async function measureInk(sharp, image, region, cell, tolerance = .1) {
  const raw = {raw: {width: image.width, height: image.height, channels: image.channels}};
  // Only R, G and B count. Drop an alpha channel first: compositing would premultiply and zero transparent ink.
  const mask = await sharp(image.data, raw).extract(region).removeAlpha().raw().toBuffer();
  const regionRaw = {raw: {width: region.width, height: region.height, channels: 3}};
  const all = maxInk(await sharp(mask, regionRaw).stats());
  const inside = insideRect(cell, region.width, region.height, tolerance);
  let outside = all;
  if (inside && all) {
    // A black cover rect over the inside pixels leaves only the ink outside the cell.
    const cover = {input: {create: {width: inside.width, height: inside.height, channels: 3, background: {r: 0, g: 0, b: 0}}}, ...inside};
    const covered = await sharp(mask, regionRaw).composite([cover]).raw().toBuffer({resolveWithObject: true}), {width, height, channels} = covered.info;
    outside = maxInk(await sharp(covered.data, {raw: {width, height, channels}}).stats());
  }
  return {ink: all > 0, outside: outside > 0, maxInk: all, maxOutsideInk: outside, inside};
}

// The previous implementation, kept as the reference for the equivalence test.
export function referenceInk(image, region, cell, tolerance = .1) {
  let pixels = 0; const outside = [];
  for (let y = 0; y < region.height; y++) for (let x = 0; x < region.width; x++) {
    const at = ((region.top + y) * image.width + region.left + x) * image.channels;
    const coverage = Math.max(image.data[at], image.data[at + 1], image.data[at + 2]); if (!coverage) continue; pixels++;
    if (outsideCell(cell, x, y, tolerance)) outside.push({x, y, coverage});
  }
  return {pixels, outside};
}
