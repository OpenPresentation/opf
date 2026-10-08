import {prepareRasterImages} from './raster-images.js';
import {OPFRenderError,packageName} from './svg.js';
import {separateLigatures} from './font-compatibility.js';
import {monochromeColorFonts,rasterFontFiles} from './color-fonts.js';
import {pinScriptClusters} from './raster-text.js';
import {loadConverter} from './converters.js';
const DEFAULT_DIMENSIONS = { width: 1280, height: 720 };
const DEFAULT_RASTER_SCALE = 1;
const DEFAULT_RASTER_BACKGROUND = "#FFFFFF";
// RR-12: PDF output is vector (selectable text, vector drawing) unless a caller asks for the raster-backed compatibility mode.
const DEFAULT_PDF_MODE = "vector";
let bundledFontFilesCache=null;

// The faces a raster or PDF conversion draws with, from the fonts handle (`loadFonts()` from `/fonts-node`): its `fontFiles`, and
// whether the bundled base faces are added (`useBundledFonts`, default true; a Node handle already holds its own, so it says false) and
// whether system fonts load (`loadSystemFonts`, default false). Without a handle the bundled base faces draw.
function fontSettings(options) {
  const fonts = options.fonts ?? {};
  return { fontFiles: stringArray(fonts.fontFiles), useBundledFonts: fonts.useBundledFonts !== false, loadSystemFonts: fonts.loadSystemFonts === true };
}

/**
 * Convert one SVG (the output of `renderSvg` or `renderSlideSvg`) to PNG bytes. `fonts` is the handle `loadFonts()` returns: the raster draws
 * with its font files, so the preview and the PNG use the same faces. Without it the bundled base faces draw.
 */
export async function svgToPng(svg, options = {}) {
  const rendered = await rasterizeSvg(svg, options);
  return rendered.png;
}

/** Convert SVG slides (the output of `renderSvg`) to a PDF, one page each. `fonts` is as for `svgToPng`; `mode` is `"vector"` (default) or `"raster"`. */
export async function svgToPdf(svgs, options = {}) {
  const pdfInputs = normalizeSvgList(svgs);
  if (!pdfInputs.length) {
    throw new OPFRenderError("empty-pdf", "svgToPdf requires at least one SVG slide.");
  }
  const mode = options.mode ?? DEFAULT_PDF_MODE;
  if (mode !== "vector" && mode !== "raster") {
    throw new OPFRenderError("invalid-conversion-option", 'mode must be "vector" or "raster".', { option: "mode", value: mode });
  }
  if (mode === "vector") return vectorPdf(pdfInputs, options);

  const { PDFDocument } = await loadPdfLib();
  const pdf = await PDFDocument.create({ updateMetadata: false });
  pdf.setCreator(packageName);
  pdf.setProducer(packageName);

  for (const input of pdfInputs) {
    const svg = normalizeSvgInput(input);
    const pageSize = svgPageSize(svg);
    const rendered = await rasterizeSvg(svg, options);
    const image = await pdf.embedPng(rendered.png);
    const page = pdf.addPage([pageSize.width, pageSize.height]);
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: pageSize.width,
      height: pageSize.height
    });
  }

  return pdf.save({ addDefaultPage: false, useObjectStreams: false });
}

async function vectorPdf(inputs, options) {
  const settings = fontSettings(options);
  if (settings.loadSystemFonts) {
    throw new OPFRenderError("pdf-system-fonts-unsupported", 'Vector PDF output embeds only the font files you supply: fonts.loadSystemFonts is not supported with mode "vector". Pass a fonts handle with fontFiles (and fontDirs), or use mode "raster".', { option: "fonts.loadSystemFonts" });
  }
  const scale = positiveNumber(options.rasterFallbackScale, "rasterFallbackScale", 2);
  const fontFiles = [
    ...(settings.useBundledFonts ? await bundledFontFiles() : []),
    ...settings.fontFiles
  ];
  const svgs = [];
  for (const input of inputs) svgs.push(await prepareRasterImages(normalizeSvgInput(input)));
  const {svgsToVectorPdf} = await import("./pdf-vector.js");
  return svgsToVectorPdf(svgs, {
    fontFiles,
    fontDirs: stringArray(options.fontDirs),
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
    imageCodec: sharpImageCodec(),
    onProgress: typeof options.onProgress === "function" ? options.onProgress : undefined,
    producer: packageName,
    ErrorClass: OPFRenderError,
    rasterize: (svg, factor) => rasterizeSvg(svg, { ...options, scale: factor, background: "rgba(0, 0, 0, 0)" })
  });
}

// The picture decoder of the Node vector export (the browser entry passes a canvas one). sharp loads on first use.
function sharpImageCodec() {
  let loaded;
  const sharp = () => (loaded ??= loadConverter("sharp").then((module) => module.default));
  return {
    metadata: async (bytes) => (await sharp())(bytes, { limitInputPixels: 40_000_000, animated: false }).metadata(),
    rgba: async (bytes, { orient }) => {
      const decoder = (await sharp())(bytes, orient ? { limitInputPixels: 40_000_000, animated: false } : undefined);
      return (orient ? decoder.autoOrient().toColourspace("srgb") : decoder).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    },
  };
}

async function rasterizeSvg(svgInput, options) {
  const { Resvg } = await loadResvg();
  const scale = positiveNumber(options.scale, "scale", DEFAULT_RASTER_SCALE);
  // FF-45: resvg draws no COLRv1 or OT-SVG colour glyphs; the colour faces stay out of its font list (see color-fonts.js).
  const settings = fontSettings(options);
  const fontFiles = rasterFontFiles([
    ...(settings.useBundledFonts ? await bundledFontFiles() : []),
    ...settings.fontFiles
  ]);
  const font = {
    loadSystemFonts: settings.loadSystemFonts,
    fontFiles,
    fontDirs: stringArray(options.fontDirs),
    defaultFontFamily: options.defaultFontFamily ?? "Roboto",
    sansSerifFamily: options.sansSerifFamily ?? options.defaultFontFamily ?? "Roboto",
    monospaceFamily: options.monospaceFamily ?? "Roboto Mono"
  };
  const renderOptions = {
    fitTo: { mode: "zoom", value: scale },
    background: options.background ?? DEFAULT_RASTER_BACKGROUND,
    font,
    logLevel: "off"
  };

  if (options.dpi !== undefined) renderOptions.dpi = positiveNumber(options.dpi, "dpi", 96);

  // An SVG used as an image draws its text with these fonts: resvg gives the nested document none.
  const nestedSvg = async text => {
    const pinned = await pinScriptClusters(text, font);
    const probe = new Resvg(pinned, { font, logLevel: "off" });
    const zoom = Math.min(4, Math.max(1, 2048 / Math.max(probe.width, probe.height)));
    return new Resvg(pinned, { ...renderOptions, fitTo: { mode: "zoom", value: zoom }, background: "rgba(0, 0, 0, 0)" }).render().asPng();
  };
  // FF-31: resvg ignores the SVG's ligature properties, so separate the letters a Gelasio ligature would join.
  // FF-45: colour families (Noto Color Emoji) are drawn with their monochrome stand-in, which resvg can draw.
  // FF-44: resvg loses the advance of a vowel sign or space inside a complex-script cluster, so pin each cluster (raster-text.js).
  const svg = await pinScriptClusters(separateLigatures(monochromeColorFonts(await prepareRasterImages(normalizeSvgInput(svgInput), { nestedSvg }))), font);

  try {
    const image = new Resvg(svg, renderOptions).render();
    return {
      png: new Uint8Array(image.asPng()),
      width: image.width,
      height: image.height
    };
  } catch (error) {
    throw new OPFRenderError("png-render-failed", "SVG to PNG conversion failed.", {
      cause: error instanceof Error ? error.message : String(error)
    });
  }
}

const loadResvg = () => loadConverter("@resvg/resvg-js");
const loadPdfLib = () => loadConverter("pdf-lib");

async function bundledFontFiles() {
  if (!bundledFontFilesCache) {
    bundledFontFilesCache = resolveBundledFontFiles().catch(error => {
      bundledFontFilesCache = null;
      throw error;
    });
  }
  return bundledFontFilesCache;
}

async function resolveBundledFontFiles() {
  const {loadFonts} = await import('./fonts-node.js');
  return (await loadFonts()).fontFiles;
}

function normalizeSvgList(value) {
  if (Array.isArray(value)) return value;
  return [value];
}

function normalizeSvgInput(value) {
  if (typeof value === "string") return value;
  if (value instanceof Uint8Array) return new TextDecoder().decode(value);
  throw new OPFRenderError("invalid-svg-input", "SVG input must be a string or Uint8Array.");
}

function positiveNumber(value, name, fallback) {
  if (value === undefined || value === null) return fallback;
  const number = Number(value);
  if (Number.isFinite(number) && number > 0) return number;
  throw new OPFRenderError("invalid-conversion-option", `${name} must be a positive finite number.`, {
    option: name,
    value
  });
}

function stringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === "string");
}

function svgPageSize(svg) {
  const attrs = svgRootAttrs(svg);
  const viewBox = parseViewBox(attrs.viewBox);
  return {
    width: positiveDimension(parseSvgLength(attrs.width) ?? viewBox?.width, DEFAULT_DIMENSIONS.width),
    height: positiveDimension(parseSvgLength(attrs.height) ?? viewBox?.height, DEFAULT_DIMENSIONS.height)
  };
}

function svgRootAttrs(svg) {
  const match = svg.match(/<svg\s+([^>]*?)>/i);
  if (!match) {
    throw new OPFRenderError("invalid-svg", "SVG input must contain a root <svg> element.");
  }

  const attrs = {};
  const attrPattern = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  for (const attr of match[1].matchAll(attrPattern)) {
    attrs[attr[1]] = attr[2] ?? attr[3] ?? "";
  }
  return attrs;
}

function parseViewBox(value) {
  if (typeof value !== "string") return null;
  const parts = value.trim().split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) return null;
  return { width: parts[2], height: parts[3] };
}

function parseSvgLength(value) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const match = String(value).trim().match(/^-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const number = Number(match[0]);
  return Number.isFinite(number) ? number : null;
}

function positiveDimension(value, fallback) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
