// Loaded only when a WebP needs a compatible static picture. Sharp receives
// bytes, never URLs or paths, and does not fetch external resources.
export async function webpToPng(bytes) {
  const { default: sharp } = await import('sharp');
  return new Uint8Array(await sharp(bytes, {limitInputPixels: 40_000_000, animated: false, failOn: 'warning'})
    .autoOrient().toColourspace('srgb').ensureAlpha()
    .png({compressionLevel: 9, adaptiveFiltering: false}).toBuffer());
}
