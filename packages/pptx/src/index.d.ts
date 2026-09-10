import type { LayoutDiagnostic, TextMeasurement } from "@openpresentation/opf/composition";
export declare const packageName = "@openpresentation/opf-pptx";

export declare const releaseLane: Readonly<{
  githubRepository: "OpenPresentation/opf-pptx";
  npmPackage: "@openpresentation/opf-pptx";
  compatibilityPackage: "@openpresentation/opf";
  rendererPackage: "@openpresentation/opf-render";
}>;

export declare const runtimePolicy: Readonly<{
  hostedServiceInCriticalPath: false;
  telemetry: false;
  commercialSdkInCriticalPath: false;
  requiredAiDependency: false;
  requiredLibreOfficeDependency: false;
  requiredNetworkCalls: false;
  deterministicLocalExecution: true;
}>;

export type ImageResolverResult =
  | string
  | Uint8Array
  | {
      data?: string | Uint8Array;
      path?: string;
      mediaType?: string;
    };

export interface ImageResolverContext {
  asset: unknown;
  presentation: unknown;
  path: string;
}

export interface ToPptxOptions {
  /** Default compatible converts WebP to a static PNG. Preserve embeds original WebP bytes. */
  imageFormat?: "compatible" | "preserve";
  textMeasurement?: TextMeasurement;
  /** Match preview/pagination clearance around supplied vector text outlines; default 1. */
  textRasterPadding?: number;
  onDiagnostic?: (diagnostic: LayoutDiagnostic) => void;
  baseDir?: string;
  compressionLevel?: number;
  imageResolver?: (src: string, context: ImageResolverContext) => ImageResolverResult | Promise<ImageResolverResult | null | undefined> | null | undefined;
  seed?: number;
  strictAssets?: boolean;
  timestamp?: string;
  zipDate?: string | number | Date;
}

export interface FromPptxOptions {
  /** Reports native details that import cannot preserve, including code provenance fallback/reflow and grouped text transforms. Table paths identify native frame and row/cell indexes (including headers). */
  onDiagnostic?: (diagnostic: {code: string; path: string; message: string}) => void;
  fallbackName?: string;
  schema?: string;
}

export declare class OPFPptxError extends Error {
  readonly code: string;
  readonly details: Record<string, unknown>;
  readonly issues?: unknown[];
  readonly path?: string;
  constructor(code: string, message: string, details?: Record<string, unknown>);
}

export declare function toPptx(input: unknown, options?: ToPptxOptions): Promise<Uint8Array>;

export declare function fromPptx(input: Uint8Array | ArrayBuffer, options?: FromPptxOptions): Promise<Record<string, unknown>>;
