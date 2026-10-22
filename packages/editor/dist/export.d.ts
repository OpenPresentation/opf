import type { Catalog, ConvertResult, ConvertedFile, Finding, SlideSelection } from "@openpresentation/opf";
import type { ToSvgOptions } from "@openpresentation/opf-render";
import type { EditorFonts } from "./canvas.js";

/** Core's result types: `convert` resolves exactly what core's in-memory `convert` resolves. */
export type { ConvertResult, ConvertedFile };

export type ExportFormat = "pdf" | "png" | "svg";
export declare const EXPORT_FORMATS: Readonly<Record<ExportFormat, { extension: string; type: string; label: string }>>;
/** Largest PNG scale offered (4: a 1280 x 720 slide is 5120 x 2880 pixels). */
export declare const MAX_PNG_SCALE: 4;

/**
 * The file name: the deck's `filename` (a trailing .pptx, .pdf, .png or .svg dropped), else the slugified `name`, else "presentation",
 * then `suffix` and `.extension`.
 */
export declare function exportFileName(deck: { filename?: string; name?: string } | undefined, extension: string, suffix?: string): string;
/**
 * The slide numbers (one-based, ascending) a conversion covers: the `slides` selection (core's `parseSlideSelection`; hidden slides it
 * names are included), else every slide that is not hidden (every slide with `includeHidden`). `[]` for a deck without slides. A malformed
 * selection or a slide past the end throws core's `OPFApiError` `invalid-option`.
 */
export declare function slidesToConvert(deck: { slides?: Array<{ hidden?: boolean }> }, options?: { slides?: SlideSelection; includeHidden?: boolean }): number[];
/** The registry's faces marked to embed only where a slide draws them; a face with a non-permissive license text is left out (`onSkip` is told). */
export declare function embeddableFonts(registry: object | undefined, onSkip?: (face: { family: string; weight: number; italic?: boolean; license?: string }) => void): Array<Record<string, unknown>>;

export interface ConvertProgress {
  stage: "fonts" | "render" | "convert" | "archive" | "done";
  done: number;
  total: number;
  message?: string;
}
export interface ConvertOptions {
  format: ExportFormat;
  /** The slides, counted from 1: `3`, `"1-3"`, `"1,3-5"`, `"2-"`, `[1, 3]` (core's `SlideSelection`). Exactly those slides, hidden or not. Omitted: every slide that is not hidden. */
  slides?: SlideSelection;
  /** With `slides` omitted, hidden slides too. */
  includeHidden?: boolean;
  /** PDF only: each page an image of its slide (larger, text not selectable). Default: selectable text and vector shapes. */
  raster?: boolean;
  /**
   * Raster PDF only: the pdf-lib module (`import * as pdfLib from "pdf-lib"`). The renderer's `export-browser` entry imports no PDF library (opf-render 0.16), so the host passes it;
   * without it a `raster: true` PDF rejects with the renderer's `converter-missing`. Vector PDF, PNG and SVG need no option.
   */
  pdfLib?: { PDFDocument: { create(options?: { updateMetadata?: boolean }): Promise<any> } };
  /** PNG and SVG only: one ZIP archive of the slide files (its `entries` name them), even for one slide. Default: one file per slide. */
  zip?: boolean;
  /** The base name of the files (`name.pdf`, `name-001.png`, `name.zip`). Default: the deck's `filename`, else its slugified `name`, else "presentation". */
  name?: string;
  /** PNG pixel density (and the raster PDF's), 1 to 4; default 2. */
  scale?: number;
  /** The options the host draws its preview with (`catalogs`, `date`, ...); the fonts go in `fonts`. */
  renderOptions?: ToSvgOptions;
  /** Host catalogs (merged with `renderOptions.catalogs`). The deck is embedded first (core `embed`), like a saved file. */
  catalogs?: readonly Catalog[];
  /**
   * The renderer's fonts handle (`loadFonts()`): it measures the text, loads the faces the deck needs before anything is drawn, and its registry's faces are what gets embedded.
   * Create a browser handle with `loadFonts({ subsetWasm, shapeWasm })` (the URLs, bytes or compiled modules of harfbuzzjs's `harfbuzz-subset.wasm` and `harfbuzz.wasm`, which the host
   * serves) and `convert` uses them: an SVG embeds each face cut to the glyphs its slide draws (a few KB to tens of KB instead of whole faces of hundreds of KB to MBs), and
   * `renderOptions.text: "paths"` draws outlines shaped by HarfBuzz instead of fontkit. A Node handle (`/fonts-node`) always has both. Only SVG files are subset (a PNG is a picture, and a PDF cuts its own
   * subsets); a PNG takes the outlines, and a PDF is always drawn as selectable text (`text: "paths"` is ignored for it).
   */
  fonts?: EditorFonts;
  /** Faces to embed instead of the registry's. */
  embeddedFonts?: Array<Record<string, unknown>>;
  /** PDF document properties beyond the title and subject taken from the deck. */
  metadata?: Record<string, unknown>;
  /** The family the PDF uses when a requested one is missing; default "Roboto". */
  fallbackFamily?: string;
  /** Replace the renderer's `export-browser` entry (tests, or a host with its own converter). Each takes the SVG the renderer drew. */
  converters?: { toPdf(svgs: string[], options?: object): Promise<Uint8Array>; toPng(svg: string, options?: object): Promise<Uint8Array> };
  signal?: AbortSignal;
  onProgress?: (progress: ConvertProgress) => void;
  /** Each finding as it is made (also in the result's `findings`). */
  onFinding?: (finding: Finding) => void;
}
/**
 * Draw the deck with the renderer the preview uses and convert it, in memory: core's `convert(deck, { format })` for the editor.
 *
 * `files`: one PDF (`pages`, and the one-based `slides` it shows); one PNG or SVG per slide (`slide`, one-based, `id`, `width`, `height`);
 * or with `zip` one archive (`entries`). `findings`: core's Finding shape, `ruleId` `render/<code>` (the renderer), `pdf/<code>` (the PDF
 * converter) or `fonts/export-font-license` (a face left out under the license rule); `slide` on a finding is zero-based, as the Finding
 * schema defines it.
 *
 * Rejects with an error whose `code` is `export-aborted`, `export-fonts-unlicensed` (the license rule left the PDF converter no face for some text), `export-no-slides`,
 * `export-format`, `export-unavailable` (PDF and PNG need the renderer's `export-browser` entry), `fonts-unavailable`, `invalid-option` (a malformed slide selection or a
 * slide past the end, from core's `parseSlideSelection`; `zip` with PDF; `raster` with PNG or SVG) or a renderer code (`converter-missing` for a raster PDF without `pdfLib`).
 */
export declare function convert(deck: unknown, options: ConvertOptions): Promise<ConvertResult>;
