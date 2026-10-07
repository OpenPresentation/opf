import type { PdfDiagnostic, PdfMetadata, SvgToPdfOptions } from "./index.js";
import type { FontsHandle } from "./fonts.js";
export type { PdfDiagnostic, PdfMetadata } from "./index.js";

export interface BrowserSvgToPngOptions {
  /** Multiplies the SVG's own size (default 1). The result is limited to 40 megapixels. */
  scale?: number;
  /** A CSS colour painted first (default white); `"transparent"` keeps the alpha channel. */
  background?: string;
  signal?: AbortSignal;
}

export interface BrowserSvgToPdfOptions extends Pick<SvgToPdfOptions, "mode" | "background" | "serifFamily" | "metadata" | "tagged" | "compress" | "strict" | "rasterFallbackScale" | "defaultFontFamily" | "sansSerifFamily" | "monospaceFamily" | "onDiagnostic"> {
  /** Raster mode: pixel density of each page image (default 2). */
  scale?: number;
  /**
   * The browser fonts handle (`loadFonts` from `/fonts-browser`): every face it holds can be embedded in the PDF, including script faces
   * a standalone SVG does not carry. Faces an SVG embeds as `@font-face` data (the `embeddedFonts` of the handle `renderSvg` was given) need no entry.
   */
  fonts?: FontsHandle;
  /** Extra font faces as bytes (TrueType outlines) when there is no handle. */
  fontData?: Array<{ data: Uint8Array; family?: string }>;
  /** Checked between pages; an abort rejects with the signal's reason (an `AbortError`). */
  signal?: AbortSignal;
  /** Called after each page is written. */
  onProgress?: (progress: { page: number; pages: number }) => void;
}

export declare function svgToPng(svg: string | Uint8Array, options?: BrowserSvgToPngOptions): Promise<Uint8Array>;
export declare function svgToPdf(svgs: string | Uint8Array | Array<string | Uint8Array>, options?: BrowserSvgToPdfOptions): Promise<Uint8Array>;
/** Format of an embedded picture and, for a JPEG, its size, component count and EXIF orientation. */
export declare function sniffImage(bytes: Uint8Array): { format: "png" | "webp" | "gif" | "jpeg" | undefined; width?: number; height?: number; channels?: number; orientation?: number; space?: string };
