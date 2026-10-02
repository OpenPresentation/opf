import type { RenderSvgOptions } from "@openpresentation/opf-render";
import type { FontGate } from "./canvas.js";

export type ExportFormat = "pdf" | "png" | "svg";
export declare const EXPORT_FORMATS: Readonly<Record<ExportFormat, { extension: string; type: string; label: string }>>;
/** Largest PNG scale offered (4: a 1280 x 720 slide is 5120 x 2880 pixels). */
export declare const MAX_PNG_SCALE: 4;

/**
 * The download name: the deck's `filename` (a trailing .pptx, .pdf, .png or .svg dropped), else the slugified `name`, else "presentation",
 * then `suffix` and `.extension`.
 */
export declare function exportFileName(deck: { filename?: string; name?: string } | undefined, extension: string, suffix?: string): string;
/** Slide numbers (0-based) an export covers; hidden slides are skipped in an "all" export unless `includeHidden`. */
export declare function slidesToExport(deck: { slides?: Array<{ hidden?: boolean }> }, options?: { slides?: "current" | "all" | number[]; slideIndex?: number; includeHidden?: boolean }): number[];
/** The registry's faces marked to embed only where a slide draws them; a face with a non-permissive license text is left out (`onSkip` is told). */
export declare function embeddableFonts(registry: object | undefined, onSkip?: (face: { family: string; weight: number; italic?: boolean; license?: string }) => void): Array<Record<string, unknown>>;

export interface ExportDiagnostic {
  code: string;
  severity: "info" | "warning";
  message: string;
  /** 0-based slide number, when the note belongs to one slide. */
  slide?: number;
  path?: string;
  family?: string;
}
export declare function describeDiagnostic(diagnostic: { code?: string; message?: string; path?: string; family?: string; [key: string]: unknown }, source?: "render" | "pdf"): ExportDiagnostic;

export interface ExportProgress {
  stage: "fonts" | "render" | "convert" | "archive" | "done";
  done: number;
  total: number;
  message?: string;
}
export interface ExportFile { name: string; type: string; bytes: Uint8Array }
export interface ExportOptions {
  format: ExportFormat;
  /** "all" (default), "current" (with `slideIndex`) or slide numbers (0-based). */
  slides?: "current" | "all" | number[];
  slideIndex?: number;
  includeHidden?: boolean;
  /** "vector" (default): selectable text and vector shapes; "raster": an image per slide. */
  pdfMode?: "vector" | "raster";
  /** PNG pixel density (and the raster PDF's), 1 to 4; default 2. */
  scale?: number;
  /** The options the host draws its preview with (`textMeasurement`, `catalogs`, ...). */
  renderOptions?: RenderSvgOptions;
  /** A font gate: the faces the deck needs load before anything is drawn. */
  fonts?: Pick<FontGate, "pending" | "ensure">;
  /** The browser font registry; its faces are what gets embedded. */
  registry?: object;
  /** Faces to embed instead of the registry's. */
  embeddedFonts?: Array<Record<string, unknown>>;
  /** PDF document properties beyond the title and subject taken from the deck. */
  metadata?: Record<string, unknown>;
  /** The family the PDF uses when a requested one is missing; default "Roboto". */
  fallbackFamily?: string;
  /** Replace the renderer's `export-browser` entry (tests, or a host with its own converter). */
  convert?: { svgToPdf(svgs: string[], options?: object): Promise<Uint8Array>; svgToPng(svg: string, options?: object): Promise<Uint8Array> };
  signal?: AbortSignal;
  onProgress?: (progress: ExportProgress) => void;
  onDiagnostic?: (diagnostic: ExportDiagnostic) => void;
}
export interface ExportResult {
  /** One PDF, PNG or SVG, or a ZIP of several. */
  download: ExportFile;
  files: ExportFile[];
  diagnostics: ExportDiagnostic[];
  /** The slide numbers (0-based) exported. */
  slides: number[];
}
/**
 * Draw the deck with the renderer the preview uses and convert it. Rejects with an error whose `code` is `export-aborted`, `export-no-slides`,
 * `export-format`, `export-unavailable` (PDF and PNG need the renderer's `export-browser` entry), `fonts-unavailable` or a renderer code.
 */
export declare function exportDeck(deck: unknown, options: ExportOptions): Promise<ExportResult>;
