import { svgsToVectorPdf } from "./pdf-vector.js";
import { OPFRenderError, packageName, toSvg } from "./svg.js";
import { slideArguments, slideSources } from "./slide-sources.js";

// RR-23: PNG and PDF output in a browser. `toPng` and `toPdf` of the root entry need Node (resvg, sharp); this entry
// has the same two names for a page. It uses the same vector PDF converter as Node (fontkit, bidi-js and pako, all pure
// JavaScript) over the SVG the preview draws, so the text stays real text in the same embedded subsets. What differs from
// Node is only how pixels are made: a canvas decodes pictures and draws PNGs. No system font is read (a browser has no way
// to hand one over) and nothing is fetched: faces come from the SVG's own @font-face data (the `embeddedFonts` of the fonts handle
// `toSvg` was given), from the faces the `fonts` handle holds (`loadFonts` from `/fonts-browser`, so script faces the SVG does not
// embed reach the PDF too), or from `fontData`.
//
// RR-63: this entry imports no converter. The one optional piece is pdf-lib, for `raster: true` only (the default vector PDF
// needs nothing): the host imports it and passes it as `options.pdfLib`, so a bundler never has to resolve it.

const DEFAULT_DIMENSIONS = { width: 1280, height: 720 };
const MAX_PIXELS = 40_000_000;

/**
 * PNG with a canvas (RR-73): a deck drawn with `toSvg` (all slides, a slide number or a selection, as for the Node `toPng`) or SVG
 * the renderer drew; one PNG for a slide number or one SVG, a list otherwise. `scale` multiplies the SVG's own size; `background`
 * is a CSS colour (default white, `"transparent"` for none).
 */
export async function toPng(source, slides, options) {
  ({ slides, options } = slideArguments(slides, options));
  const { svgs, one } = slideSources(source, slides, options, toSvg);
  const pngs = [];
  for (const svg of svgs) pngs.push(await svgPng(svg, options));
  return one ? pngs[0] : pngs;
}

async function svgPng(svg, options = {}) {
  const text = svgText(svg);
  const size = pageSize(text);
  const scale = positive(options.scale, "scale", 1);
  const width = Math.max(1, Math.round(size.width * scale)), height = Math.max(1, Math.round(size.height * scale));
  if (width * height > MAX_PIXELS) throw new OPFRenderError("png-render-failed", `The PNG would be ${width} by ${height} pixels; the limit is ${MAX_PIXELS / 1e6} megapixels.`, { width, height });
  options.signal?.throwIfAborted?.();
  const image = await loadSvgImage(text, options.signal);
  const { canvas, context } = createCanvas(width, height);
  const background = options.background ?? "#FFFFFF";
  if (background && background !== "transparent" && background !== "none") { context.fillStyle = background; context.fillRect(0, 0, width, height); }
  context.drawImage(image, 0, 0, width, height);
  return canvasPng(canvas);
}

/**
 * One PDF (RR-73) of a deck drawn with `toSvg` (all slides or a selection) or of SVG slides, one slide per page (1 SVG pixel is 1
 * PDF point, as in Node). Vector by default (real text, paths, gradients and images); `raster: true` draws each slide as an image
 * (`scale`, default 2). Takes the options of the Node `toPdf` that make sense here (`metadata`, `tagged`, `strict`, `compress`,
 * `onDiagnostic`, the generic family names, `rasterFallbackScale`), `pdfLib` (`raster: true` only: `import * as pdfLib from "pdf-lib"`), `fonts` (the handle `loadFonts()` returns: every face it holds can be embedded), `fontData`
 * (`[{ data, family? }]`, extra face bytes without a handle), `signal` (an AbortSignal, checked between pages) and
 * `onProgress({ page, pages })`.
 */
export async function toPdf(source, slides, options) {
  ({ slides, options } = slideArguments(slides, options));
  const inputs = slideSources(source, slides, options, toSvg).svgs.map(svgText);
  if (!inputs.length) throw new OPFRenderError("empty-pdf", "toPdf needs at least one slide.");
  if (options.raster !== undefined && typeof options.raster !== "boolean") throw new OPFRenderError("invalid-conversion-option", "raster must be true or false.", { option: "raster", value: options.raster });
  if (options.raster === true) return rasterPdf(inputs, options);
  const scale = positive(options.rasterFallbackScale, "rasterFallbackScale", 2);
  const fontCss = fontFaceCss(inputs);
  return svgsToVectorPdf(inputs, {
    fontFiles: [], fontDirs: [],
    fontData: [...(options.fonts?.registry?.exportFaces?.() ?? []), ...(Array.isArray(options.fontData) ? options.fontData : [])],
    imageCodec: canvasImageCodec(),
    defaultFontFamily: options.defaultFontFamily ?? "Roboto",
    sansSerifFamily: options.sansSerifFamily ?? options.defaultFontFamily ?? "Roboto",
    monospaceFamily: options.monospaceFamily ?? "Roboto Mono",
    serifFamily: options.serifFamily,
    background: options.background,
    metadata: options.metadata,
    tagged: options.tagged,
    compress: options.compress,
    strict: options.strict === true,
    rasterFallbackScale: scale,
    onDiagnostic: typeof options.onDiagnostic === "function" ? options.onDiagnostic : undefined,
    signal: options.signal,
    onProgress: typeof options.onProgress === "function" ? options.onProgress : undefined,
    yieldToHost: () => new Promise((resolve) => setTimeout(resolve, 0)),
    producer: packageName,
    ErrorClass: OPFRenderError,
    // The element's own text has no fonts in a standalone SVG image: give it the faces the slides embed.
    rasterize: async (svg, factor) => ({ png: await svgPng(fontCss && /<text[\s>]/.test(svg) ? svg.replace(/(<svg\b[^>]*>)/, `$1<style>${fontCss}</style>`) : svg, { scale: factor, background: "transparent", signal: options.signal }) }),
  });
}

async function rasterPdf(inputs, options) {
  const { PDFDocument } = options.pdfLib ?? await importPdfLib();
  const pdf = await PDFDocument.create({ updateMetadata: false });
  pdf.setCreator(packageName);
  pdf.setProducer(packageName);
  const scale = positive(options.scale, "scale", 2);
  for (const [index, svg] of inputs.entries()) {
    options.signal?.throwIfAborted?.();
    const size = pageSize(svg);
    const png = await svgPng(svg, { scale, background: options.background ?? "#FFFFFF", signal: options.signal });
    const image = await pdf.embedPng(png);
    pdf.addPage([size.width, size.height]).drawImage(image, { x: 0, y: 0, width: size.width, height: size.height });
    options.onProgress?.({ page: index + 1, pages: inputs.length });
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return pdf.save({ addDefaultPage: false, useObjectStreams: false });
}

// pdf-lib for `raster: true` when the host did not pass it. The specifier is not a literal, so a browser bundler leaves it alone (and
// never fails for a host that does not install pdf-lib); it resolves where the page can import it by name, for example with an import map.
async function importPdfLib() {
  const name = "pdf-lib";
  try {
    return await import(/* webpackIgnore: true */ /* @vite-ignore */ name);
  } catch (error) {
    throw new OPFRenderError("converter-missing", 'A raster PDF (raster: true) needs pdf-lib, an optional peer dependency of @openpresentation/opf-render: run `npm install pdf-lib@^1.17.1` and pass it as the pdfLib option (import * as pdfLib from "pdf-lib"). The default vector PDF needs nothing.', { package: "pdf-lib", range: "^1.17.1", install: "npm install pdf-lib@^1.17.1", cause: error instanceof Error ? error.message : String(error) });
  }
}

// ---------------------------------------------------------------------------------------------------------------------------
// Canvas

function createCanvas(width, height) {
  const canvas = typeof OffscreenCanvas === "function" ? new OffscreenCanvas(width, height) : Object.assign(document.createElement("canvas"), { width, height });
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new OPFRenderError("png-renderer-unavailable", "The browser could not create a 2D canvas for this size.", { width, height });
  return { canvas, context };
}

async function canvasPng(canvas) {
  const blob = canvas.convertToBlob ? await canvas.convertToBlob({ type: "image/png" }) : await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new OPFRenderError("png-render-failed", "The browser could not encode the canvas as PNG.");
  return new Uint8Array(await blob.arrayBuffer());
}

async function loadSvgImage(text, signal) {
  const url = URL.createObjectURL(new Blob([text], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = new Image();
    image.decoding = "sync";
    const loaded = new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new OPFRenderError("png-render-failed", "The browser could not draw this SVG as an image."));
    });
    image.src = url;
    await loaded;
    signal?.throwIfAborted?.();
    // Fonts the SVG embeds as data: faces load with the image; decode() settles the picture before the first draw.
    try { await image.decode(); } catch { /* drawn below as the browser has it */ }
    return image;
  } finally {
    // The decoded image keeps its own copy; the URL is no longer needed once loaded.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

/** The picture decoder the vector converter uses in a browser (the Node default is sharp): see `imageCodec` in pdf-vector.js. */
function canvasImageCodec() {
  return {
    async metadata(bytes) { return sniffImage(bytes); },
    async rgba(bytes, { orient }) {
      const sniffed = sniffImage(bytes);
      const blob = new Blob([bytes], { type: sniffed.format ? `image/${sniffed.format}` : undefined });
      let bitmap;
      try { bitmap = await createImageBitmap(blob, { imageOrientation: orient ? "from-image" : "none", premultiplyAlpha: "none", colorSpaceConversion: "default" }); }
      catch (error) { throw new Error(`The browser could not decode this picture: ${error?.message ?? error}`); }
      try {
        if (bitmap.width * bitmap.height > MAX_PIXELS) throw new Error(`The picture is larger than ${MAX_PIXELS / 1e6} megapixels.`);
        const { context } = createCanvas(bitmap.width, bitmap.height);
        context.drawImage(bitmap, 0, 0);
        const { data, width, height } = context.getImageData(0, 0, bitmap.width, bitmap.height);
        return { data, info: { width, height } };
      } finally { bitmap.close?.(); }
    },
  };
}

/** Format, and for a JPEG its size, component count and EXIF orientation: the facts the PDF writer needs to pass a JPEG through. */
export function sniffImage(bytes) {
  const b = bytes;
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { format: "png" };
  if (b.length > 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP") return { format: "webp" };
  if (b.length > 6 && ascii(b, 0, 3) === "GIF") return { format: "gif" };
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return { format: undefined };
  let orientation, width, height, channels;
  let adobe = false;
  for (let position = 2; position + 4 <= b.length;) {
    if (b[position] !== 0xff) { position++; continue; }
    const marker = b[position + 1];
    if (marker === 0xff) { position++; continue; }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { position += 2; continue; }
    if (marker === 0xd9 || marker === 0xda) break;
    const length = (b[position + 2] << 8) | b[position + 3];
    const start = position + 4;
    if (marker === 0xe1 && ascii(b, start, start + 4) === "Exif") orientation = exifOrientation(b, start + 6, position + 2 + length) ?? orientation;
    if (marker === 0xee && ascii(b, start, start + 5) === "Adobe") adobe = true;
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      height = (b[start + 1] << 8) | b[start + 2]; width = (b[start + 3] << 8) | b[start + 4]; channels = b[start + 5];
    }
    position += 2 + length;
  }
  return { format: "jpeg", width, height, channels, orientation, space: channels === 4 || adobe ? "cmyk" : "srgb" };
}

function exifOrientation(b, tiff, end) {
  if (tiff + 8 > end) return undefined;
  const little = ascii(b, tiff, tiff + 2) === "II";
  const u16 = (at) => (little ? b[at] | (b[at + 1] << 8) : (b[at] << 8) | b[at + 1]);
  const u32 = (at) => (little ? (b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) | (b[at + 3] << 24)) >>> 0 : ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0);
  const directory = tiff + u32(tiff + 4);
  if (directory + 2 > end) return undefined;
  const entries = u16(directory);
  for (let index = 0; index < entries; index++) {
    const entry = directory + 2 + index * 12;
    if (entry + 12 > end) break;
    if (u16(entry) === 0x0112) return u16(entry + 8);
  }
  return undefined;
}

const ascii = (bytes, from, to) => String.fromCharCode(...bytes.subarray(from, to));

// ---------------------------------------------------------------------------------------------------------------------------
// SVG text helpers

function svgText(value) {
  if (typeof value === "string") return value;
  if (value instanceof Uint8Array) return new TextDecoder().decode(value);
  throw new OPFRenderError("invalid-svg-input", "SVG input must be a string or Uint8Array.");
}

function pageSize(svg) {
  const root = /<svg\s+([^>]*?)>/i.exec(svg);
  if (!root) throw new OPFRenderError("invalid-svg", "SVG input must contain a root <svg> element.");
  const attributes = {};
  for (const attribute of root[1].matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attributes[attribute[1]] = attribute[2] ?? attribute[3] ?? "";
  const box = String(attributes.viewBox ?? "").trim().split(/[\s,]+/).map(Number);
  const hasBox = box.length === 4 && box.every(Number.isFinite);
  const length = (value) => { const match = /^-?\d+(?:\.\d+)?/.exec(String(value ?? "").trim()); return match ? Number(match[0]) : null; };
  const dimension = (value, fallback) => (Number.isFinite(value) && value > 0 ? value : fallback);
  return {
    width: dimension(length(attributes.width) ?? (hasBox ? box[2] : null), DEFAULT_DIMENSIONS.width),
    height: dimension(length(attributes.height) ?? (hasBox ? box[3] : null), DEFAULT_DIMENSIONS.height),
  };
}

/** The distinct @font-face rules of the pages' own style sheets, as one CSS string. */
function fontFaceCss(svgs) {
  const rules = new Set();
  for (const svg of svgs) for (const rule of svg.matchAll(/@font-face\s*\{[^}]*\}/g)) rules.add(rule[0]);
  return [...rules].join("\n");
}

function positive(value, name, fallback) {
  if (value === undefined || value === null) return fallback;
  const number = Number(value);
  if (Number.isFinite(number) && number > 0) return number;
  throw new OPFRenderError("invalid-conversion-option", `${name} must be a positive finite number.`, { option: name, value });
}
