// RR-23: download a deck as PDF, PNG or SVG from the editor, next to the PowerPoint export. Everything runs in the page:
// the slides are drawn by the same renderer the preview uses (`renderSvg`, with the fonts handle's text measurement), so
// a download is the preview, not a second layout. Fonts are the renderer's fonts handle's: the faces the document needs load through
// the handle first, and only faces its registry holds (bundled or hash-pinned, permissively licensed) are embedded, as
// @font-face data in each SVG and as subsets in the PDF. No system font is read and nothing is fetched at export time.
//
//   const result = await exportDeck(editor.presentation, { format: "pdf", fonts, renderOptions, signal, onProgress });
//   // result.download is { name, type, bytes }: one PDF, one PNG or SVG, or a ZIP of the slides.

import { renderSvg } from "@openpresentation/opf-render/svg";
import { fontGate } from "./font-gate.js";
import { createZip } from "./zip.js";

export const EXPORT_FORMATS = Object.freeze({
  pdf: Object.freeze({ extension: "pdf", type: "application/pdf", label: "PDF" }),
  png: Object.freeze({ extension: "png", type: "image/png", label: "PNG" }),
  svg: Object.freeze({ extension: "svg", type: "image/svg+xml", label: "SVG" }),
});

/** Largest PNG scale offered; a 1280 x 720 slide at 4x is 5120 x 2880 pixels. */
export const MAX_PNG_SCALE = 4;

// Licenses a face may be embedded under (the repository's font policy: OFL-1.1, Apache-2.0, MIT, UFL-1.0). The registry's faces carry the
// face's own license text; a text that names none of these keeps the face out of the download.
const PERMISSIVE_LICENSE = /SIL OPEN FONT LICENSE|OPEN FONT LICENSE|\bOFL\b|APACHE LICENSE|\bMIT LICENSE\b|PERMISSION IS HEREBY GRANTED|UBUNTU FONT LICEN[SC]E|\bUFL\b/i;
const FONT_WARNINGS = new Set([
  "pdf-font-substituted", "pdf-font-fallback", "pdf-glyph-missing", "pdf-raster-fallback", "pdf-image-skipped", "pdf-font-unreadable",
  "pdf-font-embedding-restricted", "pdf-font-unsupported-format", "pdf-expansion-limit", "pdf-font-unavailable",
]);

const yieldToHost = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * The download file name: the deck's `filename` (a trailing .pptx, .pdf, .png or .svg is dropped), else the slugified `name`, else
 * "presentation", plus `suffix` and `.extension`. Characters a file system rejects are replaced, so the name is safe to save.
 */
export function exportFileName(deck, extension, suffix = "") {
  const clean = (value) => String(value ?? "").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "-").replace(/\s+/g, "-").replace(/-{2,}/g, "-").replace(/^[-.\s]+|[-.\s]+$/g, "");
  const strip = (value) => String(value ?? "").trim().replace(/\.(pptx|pdf|png|svg)$/i, "");
  const slug = (value) => String(value ?? "").replace(/[^\p{L}\p{N}_-]+/gu, "-").replace(/-{2,}/g, "-").replace(/^-|-$/g, "");
  const base = clean(strip(deck?.filename)) || slug(deck?.name) || "presentation";
  return `${base}${suffix}.${extension}`;
}

/** The slide numbers (0-based) an export covers. Hidden slides are skipped in an "all" export unless `includeHidden`; one chosen slide is always exported. */
export function slidesToExport(deck, { slides = "all", slideIndex = 0, includeHidden = false } = {}) {
  const count = deck?.slides?.length ?? 0;
  if (Array.isArray(slides)) return slides.filter((index) => Number.isInteger(index) && index >= 0 && index < count);
  if (slides === "current") return slideIndex >= 0 && slideIndex < count ? [slideIndex] : [];
  return deck.slides.map((slide, index) => (includeHidden || slide?.hidden !== true ? index : -1)).filter((index) => index >= 0);
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
// handle itself is never given to `svgToPdf`: it would embed every face the registry holds, whatever its license.
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

function slideOf(path) {
  const match = /^slides\.(\d+)(?:\.|$)/.exec(String(path ?? ""));
  return match ? Number(match[1]) : undefined;
}

/** A renderer or converter diagnostic as `{ code, severity, message, slide?, path? }` (`slide` is 0-based). */
export function describeDiagnostic(diagnostic, source = "render") {
  const code = diagnostic.code ?? `${source}-note`;
  let message = diagnostic.message ?? code;
  let severity = "warning";
  if (code === "pdf-font-embedded") {
    severity = "info";
    message = `Embedded ${diagnostic.family} ${diagnostic.weight}${diagnostic.italic ? " italic" : ""} (${diagnostic.embedding}, ${diagnostic.glyphs} glyphs).`;
  } else if (code === "pdf-font-substituted" || code === "pdf-font-fallback") {
    message = diagnostic.message ?? "A font was substituted in the PDF.";
  } else if (source === "pdf" && !FONT_WARNINGS.has(code) && !/^pdf-unsupported-/.test(code)) {
    severity = "info";
  }
  const slide = slideOf(diagnostic.path);
  return { code, severity, message, ...(slide === undefined ? {} : { slide }), ...(diagnostic.path ? { path: diagnostic.path } : {}), ...(diagnostic.family ? { family: diagnostic.family } : {}) };
}

async function loadConverters(options) {
  if (options.convert) return options.convert;
  try {
    return await import("@openpresentation/opf-render/export-browser");
  } catch (cause) {
    throw exportError("export-unavailable", "PDF and PNG export need @openpresentation/opf-render with its export-browser entry. SVG export works without it.", cause);
  }
}

/**
 * Convert the deck's slides to a download.
 *
 * `options`:
 * - `format`: "pdf", "png" or "svg" (required).
 * - `slides`: "current" (with `slideIndex`), "all" (default; hidden slides only with `includeHidden`) or an array of slide numbers.
 * - `pdfMode`: "vector" (default: selectable text, vector shapes) or "raster" (each slide an image).
 * - `scale`: PNG pixel density, 1 to 4 (default 2); also the raster PDF's density.
 * - `renderOptions`: the render options the host draws with (`catalogs`, `date`, ...), the same as its preview.
 * - `fonts`: the renderer's fonts handle (`loadFonts()` from `@openpresentation/opf-render/fonts-browser`), the one the preview uses. Its
 *   `textMeasurement` lays the slides out, the faces the deck needs load through its `ensure` before anything is drawn, and its registry's
 *   faces are what gets embedded: the SVG carries the faces its slides draw, and the PDF embeds the registry's faces (script faces included).
 *   Both apply the same license rule (OFL-1.1, Apache-2.0, MIT or UFL-1.0): a face whose license text names none of them is left out of the SVG
 *   and the PDF and reported once as `export-font-license`. Text that needed it is drawn with another face the registry holds and
 *   reported by the converter (`pdf-font-substituted`, `pdf-glyph-missing`); when no face is left at all the PDF rejects with
 *   `export-fonts-unlicensed` (the converter's error is its `cause`).
 * - `signal`, `onProgress({ stage, done, total, message })`, `onDiagnostic(diagnostic)`.
 * Resolves `{ download, files, diagnostics, slides }`. Rejects with an error whose `code` is `export-aborted`,
 * `export-fonts-unlicensed`, `export-no-slides`, `export-unavailable`, `fonts-unavailable` or a renderer code.
 */
export async function exportDeck(deck, options = {}) {
  const format = EXPORT_FORMATS[options.format];
  if (!format) throw exportError("export-format", `Choose a format: ${Object.keys(EXPORT_FORMATS).join(", ")}.`);
  const { signal } = options;
  const diagnostics = [];
  const note = (diagnostic) => { diagnostics.push(diagnostic); options.onDiagnostic?.(diagnostic); };
  const progress = (stage, done, total, message) => options.onProgress?.({ stage, done, total, message });
  const check = () => { if (signal?.aborted) throw exportError("export-aborted", "The export was cancelled."); };
  const indexes = slidesToExport(deck, options);
  if (!indexes.length) throw exportError("export-no-slides", "There are no slides to export.");
  const selected = new Set(indexes);
  const keep = (diagnostic) => diagnostic.slide === undefined || selected.has(diagnostic.slide);
  const scale = Math.min(MAX_PNG_SCALE, Math.max(1, Number(options.scale) || 2));
  const renderOptions = options.renderOptions ?? {};

  check();
  const gate = fontGate(options.fonts);
  if (gate?.pending(deck, renderOptions).length) {
    progress("fonts", 0, 1, "Loading fonts…");
    try { await gate.ensure(deck, { signal, renderOptions }); }
    catch (error) { if (signal?.aborted) throw exportError("export-aborted", "The export was cancelled."); throw error; }
  }
  check();
  const converters = format.extension === "svg" ? null : await loadConverters(options);

  const dropped = [];
  const embeddedFonts = options.embeddedFonts ?? embeddableFonts(options.fonts?.registry, (face) => { dropped.push(face); note({ code: "export-font-license", severity: "warning", message: `${fontLabel(face)} is not embedded: its license is not one of OFL-1.1, Apache-2.0, MIT or UFL-1.0.`, family: face.family }); });
  progress("render", 0, indexes.length, "Drawing slides…");
  await yieldToHost();
  const rendered = renderSvg(deck, {
    ...renderOptions,
    fonts: { textMeasurement: options.fonts?.textMeasurement, embeddedFonts },
    // The PDF reports problems by element path; the SVG and PNG are the plain drawing.
    trace: format.extension === "pdf",
    onDiagnostic: (diagnostic) => {
      const described = describeDiagnostic(diagnostic, "render");
      if (keep(described)) note(described);
      renderOptions.onDiagnostic?.(diagnostic);
    },
  });
  check();
  const svgs = indexes.map((index) => rendered[index]);
  progress("render", indexes.length, indexes.length, "Slides drawn");

  const digits = Math.max(2, String(deck.slides.length).length);
  const numbered = (index, extension) => exportFileName(deck, extension, `-${String(index + 1).padStart(digits, "0")}`);
  let files;
  if (format.extension === "svg") {
    const header = '<?xml version="1.0" encoding="UTF-8"?>\n';
    files = svgs.map((svg, position) => ({ name: numbered(indexes[position], "svg"), type: format.type, bytes: new TextEncoder().encode(header + svg) }));
  } else if (format.extension === "png") {
    files = [];
    for (const [position, svg] of svgs.entries()) {
      check();
      progress("convert", position, svgs.length, `Slide ${indexes[position] + 1} of ${deck.slides.length}`);
      let bytes;
      try { bytes = await converters.svgToPng(svg, { scale, signal }); }
      catch (error) { if (signal?.aborted) throw exportError("export-aborted", "The export was cancelled."); throw error; }
      files.push({ name: numbered(indexes[position], "png"), type: format.type, bytes });
      await yieldToHost();
    }
    progress("convert", svgs.length, svgs.length, "Images ready");
  } else {
    const metadata = { ...(deck.name ? { title: String(deck.name) } : {}), ...(deck.description ? { subject: String(deck.description) } : {}), ...(options.metadata ?? {}) };
    let bytes;
    try {
      bytes = await converters.svgToPdf(svgs, {
        mode: options.pdfMode === "raster" ? "raster" : "vector",
        scale,
        metadata,
        signal,
        fontData: pdfFontData(embeddedFonts),
        ...(options.fallbackFamily ? { defaultFontFamily: options.fallbackFamily } : {}),
        onDiagnostic: (diagnostic) => { const described = describeDiagnostic(diagnostic, "pdf"); if (keep(described)) note(described); },
        onProgress: ({ page, pages }) => progress("convert", page, pages, `Page ${page} of ${pages}`),
      });
    } catch (error) {
      if (signal?.aborted) throw exportError("export-aborted", "The export was cancelled.");
      // The license rule can leave the converter with no face for some text (every face of a family was dropped): say why, not only what.
      if (dropped.length && /font face/i.test(String(error?.message))) {
        throw exportError("export-fonts-unlicensed", `The PDF could not be written: ${dropped.map(fontLabel).join(", ")} ${dropped.length === 1 ? "is" : "are"} not embedded because the license is not one of OFL-1.1, Apache-2.0, MIT or UFL-1.0, and no other face is available. ${error.message}`, error);
      }
      throw error;
    }
    files = [{ name: exportFileName(deck, "pdf"), type: format.type, bytes }];
  }

  check();
  let download = files[0];
  if (files.length > 1) {
    progress("archive", 0, files.length, "Packing files…");
    const bytes = await createZip(files.map(({ name, bytes: data }) => ({ name, bytes: data })), { signal });
    download = { name: exportFileName(deck, "zip", `-${format.extension}`), type: "application/zip", bytes };
  }
  progress("done", 1, 1, "Ready");
  // One note per kind: a deck of 200 slides reports one substituted font once, not 200 times.
  const unique = [];
  const seen = new Set();
  for (const diagnostic of diagnostics) {
    const key = `${diagnostic.code}|${diagnostic.message}|${diagnostic.path ?? ""}`;
    if (!seen.has(key)) { seen.add(key); unique.push(diagnostic); }
  }
  return { download, files, diagnostics: unique, slides: indexes };
}
