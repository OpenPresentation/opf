// RR-23, RR-73: `convert(deck, { format })` turns the open deck into PDF, PNG or SVG files in the page, next to the PowerPoint
// export. It has the name and the result of core's in-memory `convert` (`{ files, findings }`, each PNG or SVG file carrying its
// one-based `slide`). The slides are drawn by the same renderer the preview uses (`toSvg`, with the fonts handle's text measurement),
// so a file is the preview, not a second layout. Fonts are the renderer's fonts handle's: the faces the document needs load through
// the handle first, and only faces its registry holds (bundled or hash-pinned, permissively licensed) are embedded, as @font-face
// data in each SVG and as subsets in the PDF. No system font is read and nothing is fetched at export time.
//
//   const { files, findings } = await convert(editor.presentation, { format: "pdf", fonts, renderOptions, signal, onProgress });
//   // files: one PDF; one PNG or SVG per slide; or, with `zip: true`, one archive of them.

import { parseSlideSelection } from "@openpresentation/opf";
import { pointerFromPath } from "@openpresentation/opf/patch";
import { toSvg } from "@openpresentation/opf-render/svg";
import { mergeCatalogs, prepareSave } from "./catalogs.js";
import { fontGate } from "./font-gate.js";
import { createZip } from "./zip.js";

export const EXPORT_FORMATS = Object.freeze({
  pdf: Object.freeze({ extension: "pdf", type: "application/pdf", label: "PDF" }),
  png: Object.freeze({ extension: "png", type: "image/png", label: "PNG" }),
  svg: Object.freeze({ extension: "svg", type: "image/svg+xml", label: "SVG" }),
});
const ZIP_TYPE = "application/zip";

/** Largest PNG scale offered; a 1280 x 720 slide at 4x is 5120 x 2880 pixels. */
export const MAX_PNG_SCALE = 4;

// Licenses a face may be embedded under (the repository's font policy: OFL-1.1, Apache-2.0, MIT, UFL-1.0). The registry's faces carry the
// face's own license text; a text that names none of these keeps the face out of the file.
const PERMISSIVE_LICENSE = /SIL OPEN FONT LICENSE|OPEN FONT LICENSE|\bOFL\b|APACHE LICENSE|\bMIT LICENSE\b|PERMISSION IS HEREBY GRANTED|UBUNTU FONT LICEN[SC]E|\bUFL\b/i;
// PDF converter codes that are warnings; every other `pdf-` code (embedded faces, page notes) is information. Renderer codes are warnings.
const PDF_WARNINGS = new Set([
  "pdf-font-substituted", "pdf-font-fallback", "pdf-glyph-missing", "pdf-raster-fallback", "pdf-image-skipped", "pdf-font-unreadable",
  "pdf-font-embedding-restricted", "pdf-font-unsupported-format", "pdf-expansion-limit", "pdf-font-unavailable",
]);

const yieldToHost = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * The file name: the deck's `filename` (a trailing .pptx, .pdf, .png or .svg is dropped), else the slugified `name`, else
 * "presentation", plus `suffix` and `.extension`. Characters a file system rejects are replaced, so the name is safe to save.
 */
export function exportFileName(deck, extension, suffix = "") {
  const clean = (value) => String(value ?? "").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "-").replace(/\s+/g, "-").replace(/-{2,}/g, "-").replace(/^[-.\s]+|[-.\s]+$/g, "");
  const strip = (value) => String(value ?? "").trim().replace(/\.(pptx|pdf|png|svg)$/i, "");
  const slug = (value) => String(value ?? "").replace(/[^\p{L}\p{N}_-]+/gu, "-").replace(/-{2,}/g, "-").replace(/^-|-$/g, "");
  const base = clean(strip(deck?.filename)) || slug(deck?.name) || "presentation";
  return `${base}${suffix}.${extension}`;
}

/**
 * The slide numbers (one-based, ascending) a conversion covers. `slides` is core's slide selection (`3`, `"1-3"`, `"1,3-5"`, `[1, 3]`;
 * `parseSlideSelection`): exactly those slides, hidden or not. Without it every slide that is not hidden, or every slide with
 * `includeHidden`. A deck without slides gives `[]`; a malformed selection or a slide past the end throws core's `OPFApiError`
 * (`invalid-option`).
 */
export function slidesToConvert(deck, { slides, includeHidden = false } = {}) {
  const list = Array.isArray(deck?.slides) ? deck.slides : [];
  if (!list.length) return [];
  if (slides !== undefined) return parseSlideSelection(slides, list.length);
  return list.map((slide, index) => (includeHidden || slide?.hidden !== true ? index + 1 : 0)).filter(Boolean);
}

/**
 * The faces a registry can embed, marked to embed only where a slide draws them (renderer `embed: "used"`). A face whose own license text is
 * not permissive is left out and reported through `onSkip`; a face with no license text is kept (the registry only holds reviewed faces).
 */
export function embeddableFonts(registry, onSkip) {
  const faces = typeof registry?.selectEmbeddedFonts === "function" ? registry.selectEmbeddedFonts(() => true) : registry?.embeddedFonts ?? [];
  const kept = [];
  for (const face of faces) {
    if (face.license && !PERMISSIVE_LICENSE.test(face.license)) { onSkip?.(face); continue; }
    kept.push({ ...face, embed: "used" });
  }
  return kept;
}

function exportError(code, message, cause) {
  const error = new Error(message, cause ? { cause } : undefined);
  error.code = code;
  return error;
}

// The faces a PDF may embed: the same permissive-license list as the SVG (`embeddableFonts`), as the bytes the converter reads. The fonts
// handle itself is never given to `toPdf`: it would embed every face the registry holds, whatever its license.
function pdfFontData(faces) {
  return faces.map((face) => {
    const text = String(face.dataUrl ?? "");
    const base64 = text.slice(text.indexOf(",") + 1);
    const binary = atob(base64);
    const data = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) data[index] = binary.charCodeAt(index);
    return { family: face.family, data };
  });
}

const fontLabel = (face) => `${face.family} ${face.weight}${face.italic ? " italic" : ""}`;
const scalar = (value) => value === null || ["string", "number", "boolean"].includes(typeof value);

// A renderer, PDF converter or editor note as core's Finding (finding.schema.json): `ruleId` is `<source>/<code>` and `category` the
// source, as core's conversion reports them (`render/`, `pdf/`, `fonts/`); `path` is a JSON Pointer (core's `pointerFromPath`); `slide`
// (zero-based, the Finding schema's convention) and `slideId` say which slide it belongs to; the note's own facts (font family, weight,
// glyph count, ...) are `measured`.
function findingOf(source, diagnostic, deck) {
  const { code: rawCode, message: rawMessage, path: where, severity: _severity, ...details } = diagnostic ?? {};
  const code = String(rawCode ?? "note").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^[^A-Za-z0-9]+/, "") || "note";
  let message = rawMessage ?? code;
  let severity = "warning";
  if (code === "pdf-font-embedded") {
    severity = "info";
    message = `Embedded ${details.family} ${details.weight}${details.italic ? " italic" : ""} (${details.embedding}, ${details.glyphs} glyphs).`;
  } else if (code === "pdf-font-substituted" || code === "pdf-font-fallback") {
    message = rawMessage ?? "A font was substituted in the PDF.";
  } else if (source === "pdf" && !PDF_WARNINGS.has(code) && !/^pdf-unsupported-/.test(code)) {
    severity = "info";
  }
  const path = typeof where === "string" && where ? pointerFromPath(where) : "";
  const slideMatch = /^\/slides\/(\d+)(?:\/|$)/.exec(path);
  const slide = slideMatch ? Number(slideMatch[1]) : undefined;
  const slideId = slide === undefined ? undefined : deck?.slides?.[slide]?.id;
  const measured = {};
  // A long text (an image's data URI) is cut: the finding names the fact, the deck holds the value.
  const short = (value) => (typeof value === "string" && value.length > 200 ? `${value.slice(0, 199)}…` : value);
  for (const [key, value] of Object.entries(details)) {
    if (scalar(value)) measured[key] = short(value);
    else if (Array.isArray(value) && value.length && value.every(scalar)) measured[key] = short(value.join(", "));
  }
  return {
    ruleId: `${source}/${code}`,
    severity,
    category: source,
    path,
    scope: "document",
    message: String(message),
    ...(slide === undefined ? {} : { slide }),
    ...(typeof slideId === "string" ? { slideId } : {}),
    ...(Object.keys(measured).length ? { measured } : {}),
  };
}

// The picture size in pixels: the SVG's width and height attributes, a PNG's IHDR.
const svgSize = (svg) => {
  const tag = /<svg\b[^>]*>/.exec(svg)?.[0] ?? "";
  const width = Number(/\bwidth="([\d.]+)"/.exec(tag)?.[1]);
  const height = Number(/\bheight="([\d.]+)"/.exec(tag)?.[1]);
  return Number.isFinite(width) && Number.isFinite(height) ? { width, height } : {};
};
const pngSize = (bytes) => {
  if (!(bytes instanceof Uint8Array) || bytes.length < 24) return {};
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
};

async function loadConverters(options) {
  if (options.converters) return options.converters;
  try {
    return await import("@openpresentation/opf-render/export-browser");
  } catch (cause) {
    throw exportError("export-unavailable", "PDF and PNG output need @openpresentation/opf-render with its export-browser entry. SVG works without it.", cause);
  }
}

/**
 * Convert the deck's slides to PDF, PNG or SVG files, in memory. The name and the result are core's in-memory `convert`.
 *
 * `options`:
 * - `format`: "pdf", "png" or "svg" (required).
 * - `slides`: core's slide selection, counted from 1 (`3`, `"1-3"`, `"1,3-5"`, `[1, 3]`): exactly those slides, hidden or not. Omitted:
 *   every slide that is not hidden, or every slide with `includeHidden`.
 * - `raster`: PDF only; each page an image of its slide instead of selectable text and vector shapes.
 * - `pdfLib`: for `raster: true` only, the pdf-lib module (`import * as pdfLib from "pdf-lib"`). The renderer's `export-browser` entry
 *   imports no PDF library (RR-63, opf-render 0.16), so a host that offers the raster PDF imports pdf-lib itself; without it a raster
 *   PDF rejects with the renderer's `converter-missing` (its `details.install` names the package). Vector PDF, PNG and SVG need no option.
 * - `zip`: PNG and SVG only; one ZIP archive of the slides instead of one file per slide (even for one slide).
 * - `name`: the base name of the files (`name.pdf`, `name-001.png`, `name.zip`). Omitted: the deck's `filename`, else its slugified `name`.
 * - `scale`: PNG pixel density, 1 to 4 (default 2); also the raster PDF's density.
 * - `renderOptions`: the render options the host draws with (`catalogs`, `date`, ...), the same as its preview.
 * - `catalogs`: the host's registered catalogs (`Catalog[]`, merged with `renderOptions.catalogs`). The deck is embedded first (core's
 *   `embed`), so what is drawn is the self-contained document a save writes.
 * - `fonts`: the renderer's fonts handle (`loadFonts()` from `@openpresentation/opf-render/fonts-browser`), the one the preview uses. Its
 *   `textMeasurement` lays the slides out, the faces the deck needs load through its `ensure` before anything is drawn, and its registry's
 *   faces are what gets embedded: the SVG carries the faces its slides draw, and the PDF embeds the registry's faces (script faces included).
 *   Both apply the same license rule (OFL-1.1, Apache-2.0, MIT or UFL-1.0): a face whose license text names none of them is left out of the SVG
 *   and the PDF and reported once as `fonts/export-font-license`. Text that needed it is drawn with another face the registry holds and
 *   reported by the converter (`pdf/pdf-font-substituted`, `pdf/pdf-glyph-missing`); when no face is left at all the PDF rejects with
 *   `export-fonts-unlicensed` (the converter's error is its `cause`).
 * - `converters`: `{ toPdf, toPng }` in place of the renderer's `export-browser` entry (tests, or a host with its own converter).
 * - `signal`, `onProgress({ stage, done, total, message })`, `onFinding(finding)`.
 * Resolves `{ files, findings }`. Rejects with an error whose `code` is `export-aborted`, `export-fonts-unlicensed`, `export-format`,
 * `export-no-slides`, `export-unavailable`, `fonts-unavailable`, `invalid-option` (core's, for a malformed slide selection or a slide past
 * the end; the editor's, for `zip` or `raster` with a format they do not apply to) or a renderer code (`converter-missing` for a raster
 * PDF without `pdfLib`).
 */
export async function convert(input, options = {}) {
  const format = EXPORT_FORMATS[options?.format];
  if (!format) throw exportError("export-format", `Choose a format: ${Object.keys(EXPORT_FORMATS).join(", ")}.`);
  if (options.zip && format.extension === "pdf") throw exportError("invalid-option", "zip applies to format png and svg.");
  if (options.raster && format.extension !== "pdf") throw exportError("invalid-option", "raster applies to format pdf.");
  const { signal } = options;
  const findings = [];
  const seen = new Set();
  // One finding per rule, place and message: a deck of 200 slides reports one substituted font once, not 200 times.
  const note = (finding) => {
    const key = JSON.stringify([finding.ruleId, finding.path, finding.message]);
    if (seen.has(key)) return;
    seen.add(key);
    findings.push(finding);
    options.onFinding?.(finding);
  };
  const progress = (stage, done, total, message) => options.onProgress?.({ stage, done, total, message });
  const aborted = () => exportError("export-aborted", "The export was cancelled.");
  const check = () => { if (signal?.aborted) throw aborted(); };
  const numbers = slidesToConvert(input, options);
  if (!numbers.length) throw exportError("export-no-slides", "There are no slides to export.");
  // A note about a slide that is not converted is left out (finding slides are zero-based).
  const selected = new Set(numbers.map((number) => number - 1));
  const scale = Math.min(MAX_PNG_SCALE, Math.max(1, Number(options.scale) || 2));
  const catalogs = mergeCatalogs(options.catalogs, options.renderOptions?.catalogs);
  const renderOptions = { ...(options.renderOptions ?? {}), catalogs };
  const deck = prepareSave(input, { catalogs }).document;
  const record = (source, diagnostic) => {
    const finding = findingOf(source, diagnostic, deck);
    if (finding.slide === undefined || selected.has(finding.slide)) note(finding);
  };

  check();
  const gate = fontGate(options.fonts);
  if (gate?.pending(deck, renderOptions).length) {
    progress("fonts", 0, 1, "Loading fonts…");
    try { await gate.ensure(deck, { signal, renderOptions }); }
    catch (error) { if (signal?.aborted) throw aborted(); throw error; }
  }
  check();
  const converters = format.extension === "svg" ? null : await loadConverters(options);

  const dropped = [];
  const embeddedFonts = options.embeddedFonts ?? embeddableFonts(options.fonts?.registry, (face) => {
    dropped.push(face);
    const detail = { family: face.family, weight: face.weight, ...(face.italic ? { italic: true } : {}) };
    note(findingOf("fonts", { code: "export-font-license", message: `${fontLabel(face)} is not embedded: its license is not one of OFL-1.1, Apache-2.0, MIT or UFL-1.0.`, ...detail }, deck));
  });
  progress("render", 0, numbers.length, "Drawing slides…");
  await yieldToHost();
  const svgs = toSvg(deck, numbers, {
    ...renderOptions,
    fonts: { textMeasurement: options.fonts?.textMeasurement, embeddedFonts },
    // The PDF reports problems by element path; the SVG and PNG are the plain drawing.
    trace: format.extension === "pdf",
    onDiagnostic: (diagnostic) => {
      record("render", diagnostic);
      renderOptions.onDiagnostic?.(diagnostic);
    },
  });
  check();
  progress("render", numbers.length, numbers.length, "Slides drawn");

  const named = (extension, suffix = "") => exportFileName(options.name === undefined ? deck : { filename: String(options.name) }, extension, suffix);
  // Slide files are numbered as core numbers them: three digits at least (`-001`), more for a longer deck.
  const digits = Math.max(3, String(deck.slides.length).length);
  const numbered = (number, extension) => named(extension, `-${String(number).padStart(digits, "0")}`);
  const facts = (number) => {
    const id = deck.slides[number - 1]?.id;
    return { slide: number, ...(typeof id === "string" ? { id } : {}) };
  };
  let files;
  if (format.extension === "svg") {
    const header = '<?xml version="1.0" encoding="UTF-8"?>\n';
    files = svgs.map((svg, position) => ({ name: numbered(numbers[position], "svg"), type: format.type, bytes: new TextEncoder().encode(header + svg), ...facts(numbers[position]), ...svgSize(svg) }));
  } else if (format.extension === "png") {
    files = [];
    for (const [position, svg] of svgs.entries()) {
      check();
      progress("convert", position, svgs.length, `Slide ${numbers[position]} of ${deck.slides.length}`);
      let bytes;
      try { bytes = await converters.toPng(svg, { scale, signal }); }
      catch (error) { if (signal?.aborted) throw aborted(); throw error; }
      files.push({ name: numbered(numbers[position], "png"), type: format.type, bytes, ...facts(numbers[position]), ...pngSize(bytes) });
      await yieldToHost();
    }
    progress("convert", svgs.length, svgs.length, "Images ready");
  } else {
    const metadata = { ...(deck.name ? { title: String(deck.name) } : {}), ...(deck.description ? { subject: String(deck.description) } : {}), ...(options.metadata ?? {}) };
    let bytes;
    try {
      bytes = await converters.toPdf(svgs, {
        ...(options.raster ? { raster: true } : {}),
        scale,
        metadata,
        signal,
        fontData: pdfFontData(embeddedFonts),
        // RR-63: the renderer's browser entry imports no pdf-lib; a raster PDF takes the module the host imported.
        ...(options.raster && options.pdfLib ? { pdfLib: options.pdfLib } : {}),
        ...(options.fallbackFamily ? { defaultFontFamily: options.fallbackFamily } : {}),
        onDiagnostic: (diagnostic) => record("pdf", diagnostic),
        onProgress: ({ page, pages }) => progress("convert", page, pages, `Page ${page} of ${pages}`),
      });
    } catch (error) {
      if (signal?.aborted) throw aborted();
      // The license rule can leave the converter with no face for some text (every face of a family was dropped): say why, not only what.
      if (dropped.length && /font face/i.test(String(error?.message))) {
        throw exportError("export-fonts-unlicensed", `The PDF could not be written: ${dropped.map(fontLabel).join(", ")} ${dropped.length === 1 ? "is" : "are"} not embedded because the license is not one of OFL-1.1, Apache-2.0, MIT or UFL-1.0, and no other face is available. ${error.message}`, error);
      }
      throw error;
    }
    files = [{ name: named("pdf"), type: format.type, bytes, pages: numbers.length, slides: numbers }];
  }

  check();
  if (options.zip) {
    progress("archive", 0, files.length, "Packing files…");
    const bytes = await createZip(files.map(({ name, bytes: data }) => ({ name, bytes: data })), { signal });
    files = [{ name: named("zip"), type: ZIP_TYPE, bytes, entries: files.map((file) => file.name) }];
  }
  progress("done", 1, 1, "Ready");
  return { files, findings };
}
