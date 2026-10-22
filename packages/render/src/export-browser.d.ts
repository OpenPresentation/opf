import type { PdfDiagnostic, PdfMetadata, SlideSelection, SvgSlide, ToPdfOptions, ToSvgOptions } from "./index.js";
import type { FontsHandle } from "./fonts.js";
export type { PdfDiagnostic, PdfMetadata } from "./index.js";

/** The options of `toPng` in a browser: the canvas's own, and the `toSvg` options that draw a deck (`fonts` is the browser handle). */
export interface BrowserToPngOptions extends ToSvgOptions {
  /** Multiplies the SVG's own size (default 1). The result is limited to 40 megapixels. */
  scale?: number;
  /** A CSS colour painted first (default white); `"transparent"` keeps the alpha channel. */
  background?: string;
  signal?: AbortSignal;
}

/** The options of `toPdf` in a browser: the PDF's own, and the `toSvg` options that draw a deck. */
export interface BrowserToPdfOptions extends Omit<ToSvgOptions, "fonts" | "onDiagnostic">, Pick<ToPdfOptions, "raster" | "background" | "serifFamily" | "metadata" | "tagged" | "compress" | "strict" | "rasterFallbackScale" | "defaultFontFamily" | "sansSerifFamily" | "monospaceFamily" | "onDiagnostic"> {
  /** `raster: true`: pixel density of each page image (default 2). */
  scale?: number;
  /**
   * `raster: true` only: the pdf-lib module (`import * as pdfLib from "pdf-lib"`), an optional peer of the renderer that this entry never imports itself, so a
   * bundle of it holds no PDF library. Without it a raster PDF tries to import "pdf-lib" by name and rejects with `OPFRenderError` `converter-missing`
   * when the page cannot. The default vector PDF needs no option.
   */
  pdfLib?: { PDFDocument: { create(options?: { updateMetadata?: boolean }): Promise<any> } };
  /**
   * The browser fonts handle (`loadFonts` from `/fonts-browser`): it draws a deck, and every face it holds can be embedded in the PDF, including
   * script faces a standalone SVG does not carry. Faces an SVG embeds as `@font-face` data (the `embeddedFonts` of the handle `toSvg` was given) need no entry.
   */
  fonts?: FontsHandle;
  /** Extra font faces as bytes (TrueType outlines) when there is no handle. */
  fontData?: Array<{ data: Uint8Array; family?: string }>;
  /** Checked between pages; an abort rejects with the signal's reason (an `AbortError`). */
  signal?: AbortSignal;
  /** Called after each page is written. */
  onProgress?: (progress: { page: number; pages: number }) => void;
}

/** PNG with a canvas (RR-73): the arguments and results of the Node `toPng`. */
export declare function toPng(svg: Uint8Array | `<${string}`, options?: BrowserToPngOptions): Promise<Uint8Array>;
export declare function toPng(svgs: readonly SvgSlide[], options?: BrowserToPngOptions): Promise<Uint8Array[]>;
export declare function toPng(deck: unknown, slide: number, options?: BrowserToPngOptions): Promise<Uint8Array>;
export declare function toPng(deck: unknown, slides: Exclude<SlideSelection, number>, options?: BrowserToPngOptions): Promise<Uint8Array[]>;
export declare function toPng(deck: object, options?: BrowserToPngOptions): Promise<Uint8Array[]>;
export declare function toPng(source: string, options?: BrowserToPngOptions): Promise<Uint8Array | Uint8Array[]>;
/** One PDF (RR-73), a page per slide, of a deck drawn with `toSvg` (every slide or a selection) or of SVG slides. */
export declare function toPdf(source: unknown, options?: BrowserToPdfOptions): Promise<Uint8Array>;
export declare function toPdf(deck: unknown, slides: SlideSelection, options?: BrowserToPdfOptions): Promise<Uint8Array>;
/** Format of an embedded picture and, for a JPEG, its size, component count and EXIF orientation. */
export declare function sniffImage(bytes: Uint8Array): { format: "png" | "webp" | "gif" | "jpeg" | undefined; width?: number; height?: number; channels?: number; orientation?: number; space?: string };
