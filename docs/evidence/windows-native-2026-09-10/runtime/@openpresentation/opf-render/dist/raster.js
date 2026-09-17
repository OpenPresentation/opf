import {prepareRasterImages} from './raster-images.js';
import {OPFRenderError,packageName} from './svg.js';
const DEFAULT_DIMENSIONS = { width: 1280, height: 720 };
const DEFAULT_RASTER_SCALE = 1;
const DEFAULT_RASTER_BACKGROUND = "#FFFFFF";
let bundledFontFilesCache=null;

export async function svgToPng(svg, options = {}) {
  const rendered = await rasterizeSvg(svg, options);
  return rendered.png;
}

export async function svgToPdf(svgs, options = {}) {
  const pdfInputs = normalizeSvgList(svgs);
  if (!pdfInputs.length) {
    throw new OPFRenderError("empty-pdf", "svgToPdf requires at least one SVG slide.");
  }

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

async function rasterizeSvg(svgInput, options) {
  const { Resvg } = await loadResvg();
  const svg = await prepareRasterImages(normalizeSvgInput(svgInput));
  const scale = positiveNumber(options.scale, "scale", DEFAULT_RASTER_SCALE);
  const fontFiles = [
    ...(options.useBundledFonts === false ? [] : await bundledFontFiles()),
    ...stringArray(options.fontFiles)
  ];
  const renderOptions = {
    fitTo: { mode: "zoom", value: scale },
    background: options.background ?? DEFAULT_RASTER_BACKGROUND,
    font: {
      loadSystemFonts: options.loadSystemFonts === true,
      fontFiles,
      fontDirs: stringArray(options.fontDirs),
      defaultFontFamily: options.defaultFontFamily ?? "Roboto",
      sansSerifFamily: options.sansSerifFamily ?? options.defaultFontFamily ?? "Roboto",
      monospaceFamily: options.monospaceFamily ?? "Roboto Mono"
    },
    logLevel: "off"
  };

  if (options.dpi !== undefined) renderOptions.dpi = positiveNumber(options.dpi, "dpi", 96);

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

async function loadResvg() {
  try {
    return await import("@resvg/resvg-js");
  } catch (error) {
    throw new OPFRenderError("png-renderer-unavailable", "PNG/PDF conversion requires the Node runtime dependency @resvg/resvg-js.", {
      cause: error instanceof Error ? error.message : String(error)
    });
  }
}

async function loadPdfLib() {
  try {
    return await import("pdf-lib");
  } catch (error) {
    throw new OPFRenderError("pdf-writer-unavailable", "PDF conversion requires the runtime dependency pdf-lib.", {
      cause: error instanceof Error ? error.message : String(error)
    });
  }
}

async function bundledFontFiles() {
  if (!bundledFontFilesCache) {
    bundledFontFilesCache = resolveBundledFontFiles();
  }
  return bundledFontFilesCache;
}

async function resolveBundledFontFiles() {
  try {
    const { createRequire } = await import("node:module");
    const path = await import("node:path");
    const require = createRequire(import.meta.url);
    const roboto = path.dirname(require.resolve("@expo-google-fonts/roboto/package.json"));
    const robotoMono = path.dirname(require.resolve("@expo-google-fonts/roboto-mono/package.json"));
    return [
      path.join(roboto, "400Regular/Roboto_400Regular.ttf"),
      path.join(roboto, "500Medium/Roboto_500Medium.ttf"),
      path.join(roboto, "700Bold/Roboto_700Bold.ttf"),
      path.join(roboto, "800ExtraBold/Roboto_800ExtraBold.ttf"),
      path.join(robotoMono, "400Regular/RobotoMono_400Regular.ttf"),
      path.join(robotoMono, "700Bold/RobotoMono_700Bold.ttf")
    ];
  } catch {
    return [];
  }
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
