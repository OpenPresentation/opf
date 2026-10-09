// RR-73: what `toPng` and `toPdf` draw. They take a deck (an object, or JSON text) and draw it with `toSvg`, or SVG the renderer
// already drew (a string or bytes starting with `<`, or a list of them). The second argument is a slide selection for a deck (`3`
// or `"1-3"`, slides counting from 1) or the options, told apart by type, as for `toSvg`.
import { parseSlideSelection } from "@openpresentation/opf";
import { OPFRenderError } from "./svg.js";

/** The slide numbers (from 1) a selection names: a list of numbers or text such as "1,3-5"; core's parser, with the renderer's error. */
export function selectSlides(slides, count) {
  try {
    return parseSlideSelection(slides, count, "slides");
  } catch (error) {
    throw new OPFRenderError("invalid-slide-selection", error.message, { option: "slides", slideCount: count, cause: error });
  }
}

// The 0.17 option names (RR-73, RR-74): pre-v1 there is no alias, but a call that still passes one fails with the new name.
const RENAMED = { embedFonts: "text: \"system\" (embedFonts: false)", textAsPaths: "text: \"paths\"", mode: "raster: true (vector is the default)", fontDirs: "fonts: a font folder or a list of them" };

/** Throws for an option of 0.17 that 0.18 renamed, naming its replacement. */
export function rejectRenamedOptions(options, code) {
  for (const name of Object.keys(RENAMED)) {
    if (options?.[name] !== undefined) throw new OPFRenderError(code, `The ${name} option was replaced by ${RENAMED[name]}.`, { option: name });
  }
}

/** `(slides, options)` with the options moved into place when the second argument is the options object. */
export function slideArguments(slides, options) {
  if (slides !== null && typeof slides === "object" && !Array.isArray(slides)) return { slides: undefined, options: slides };
  return { slides, options: options ?? {} };
}

const isSvg = (value) => value instanceof Uint8Array || (typeof value === "string" && /^\s*</.test(value));

/**
 * The SVG slides to convert, and whether the caller asked for one (a slide number, or one SVG): `draw` is `toSvg`, called with the
 * conversion options for a deck (they carry the fonts handle and the drawing options).
 */
export function slideSources(source, slides, options, draw) {
  rejectRenamedOptions(options, "invalid-conversion-option");
  if (Array.isArray(source) || isSvg(source)) {
    if (slides !== undefined) throw new OPFRenderError("invalid-conversion-option", "A slide selection applies to a deck; SVG input is already drawn, so pass the slides you want.", { option: "slides" });
    if (Array.isArray(source) && !source.every(isSvg)) throw new OPFRenderError("invalid-svg-input", "A list must hold SVG slides (strings or bytes starting with <).");
    return { svgs: Array.isArray(source) ? source : [source], one: !Array.isArray(source) };
  }
  const drawn = draw(source, slides, options);
  return typeof drawn === "string" ? { svgs: [drawn], one: true } : { svgs: drawn, one: false };
}
