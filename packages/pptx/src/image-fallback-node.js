// Loaded only when a WebP needs a compatible static picture. Sharp receives
// bytes, never URLs or paths, and does not fetch external resources.
export async function webpToPng(bytes) {
  const { default: sharp } = await import('sharp');
  return new Uint8Array(await sharp(bytes, {limitInputPixels: 40_000_000, animated: false, failOn: 'warning'})
    .autoOrient().toColourspace('srgb').ensureAlpha()
    .png({compressionLevel: 9, adaptiveFiltering: false}).toBuffer());
}

// The default rasterizer for the PNG fallback of an SVG picture: opf-render's resvg renderer (an optional peer), which
// is deterministic (no system fonts, no network or file access for the SVG's own references). `text` selects the
// bundled fonts; an SVG with no text needs none. Rejects with code `svg-rasterizer-unavailable` when opf-render is
// not installed.
//
// This is the one place the exporter calls the renderer. opf-render's svgToPng(svg, {fonts, scale, background}) takes the
// fonts handle for the faces it may draw with: here only the bundled ones, never the system's.
export async function svgToPng(svg, {scale, text}) {
  let render;
  try {
    ({svgToPng: render} = await import('@openpresentation/opf-render'));
  } catch (error) {
    const unavailable = new Error('SVG pictures need the optional peer @openpresentation/opf-render (or an options.svgRasterizer).', {cause: error});
    unavailable.code = 'svg-rasterizer-unavailable';
    throw unavailable;
  }
  return new Uint8Array(await render(svg, {fonts: {useBundledFonts: text === true, loadSystemFonts: false}, scale, background: 'rgba(0, 0, 0, 0)'}));
}

// A local SVG file (a path source), read as bytes; PptxGenJS reads raster paths itself.
export async function readLocalFile(path) {
  const { readFile } = await import('node:fs/promises');
  return new Uint8Array(await readFile(path));
}
