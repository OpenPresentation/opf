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
// not installed, and also when it is installed but its PNG converter (`@resvg/resvg-js`, an optional peer of opf-render
// 0.16) is not: opf-render's `converter-missing` error maps to the same code, with its install command on `install`.
//
// This is the one place the exporter calls the renderer. opf-render's toPng(svg, {fonts, scale, background}) takes the
// fonts handle for the faces it may draw with: here only the bundled ones, never the system's.
export async function svgToPng(svg, {scale, text}) {
  let render;
  try {
    ({toPng: render} = await import('@openpresentation/opf-render'));
  } catch (error) {
    const unavailable = new Error('SVG pictures need the optional peer @openpresentation/opf-render (or an options.svgRasterizer).', {cause: error});
    unavailable.code = 'svg-rasterizer-unavailable';
    throw unavailable;
  }
  try {
    return new Uint8Array(await render(svg, {fonts: {useBundledFonts: text === true, loadSystemFonts: false}, scale, background: 'rgba(0, 0, 0, 0)'}));
  } catch (error) {
    if (error?.code !== 'converter-missing') throw error;
    // opf-render 0.16: @resvg/resvg-js (the PNG converter) is an optional peer. Same path as a missing opf-render, keeping
    // opf-render's own message and install command.
    const install = typeof error.details?.install === 'string' ? error.details.install : undefined;
    const unavailable = new Error(`SVG pictures need the PNG converter of @openpresentation/opf-render (or an options.svgRasterizer): ${error.message}`, {cause: error});
    unavailable.code = 'svg-rasterizer-unavailable';
    if (install) unavailable.install = install;
    throw unavailable;
  }
}

// A local SVG file (a path source), read as bytes; PptxGenJS reads raster paths itself.
export async function readLocalFile(path) {
  const { readFile } = await import('node:fs/promises');
  return new Uint8Array(await readFile(path));
}

// Whether PptxGenJS will be able to read a local raster path (it reads the file itself, and fails the whole export when it cannot).
export async function localFileReadable(path) {
  const { stat } = await import('node:fs/promises');
  try { return (await stat(path)).isFile(); } catch { return false; }
}
