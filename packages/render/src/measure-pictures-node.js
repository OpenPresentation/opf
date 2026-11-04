// LH-145: the Node entry's `measurePictures` (the browser entries have the canvas version of ./measure-pictures.js). The same function
// with a decoder that works without a DOM: sharp, an optional peer loaded the first time a picture is measured, as for PNG output
// (RR-63). Without sharp installed, or for a picture it cannot read, nothing is measured and the scrim keeps its worst case.
import { loadConverter } from "./converters.js";
import { measurePictures as measureWith } from "./measure-pictures.js";

/** Decodes any picture sharp reads (PNG, JPEG, WebP, GIF, SVG) to at most `maxSide` pixels, upright, as 8-bit sRGB with alpha. */
export async function decodeWithSharp(bytes, _mediaType, { maxSide }) {
  const { default: sharp } = await loadConverter("sharp");
  const { data, info } = await sharp(bytes, { limitInputPixels: 40_000_000, animated: false })
    .autoOrient()
    .resize({ width: maxSide, height: maxSide, fit: "inside", withoutEnlargement: true })
    .toColourspace("srgb")
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data, channels: info.channels };
}

export function measurePictures(deck, options = {}) {
  return measureWith(deck, { ...options, decode: options.decode ?? decodeWithSharp });
}
