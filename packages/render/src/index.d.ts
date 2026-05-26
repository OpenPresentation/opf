export declare const packageName = "@openpresentation/opf-render";

export declare const releaseLane: Readonly<{
  githubRepository: "OpenPresentation/opf-render";
  npmPackage: "@openpresentation/opf-render";
  compatibilityPackage: "@openpresentation/opf";
}>;

export declare const runtimePolicy: Readonly<{
  hostedServiceInCriticalPath: false;
  telemetry: false;
  commercialSdkInCriticalPath: false;
  requiredNetworkCalls: false;
  deterministicLocalExecution: true;
}>;

export declare const engineDefaults: Readonly<{
  catalogs: Readonly<Record<string, Readonly<{ source: string }>>>;
  theme: "minimal";
  colorScheme: "cool-horizon";
  language: "english";
  narrative: "classic-story";
  tone: "formal";
  audience: "executives";
  fontScheme: Readonly<{
    pptx: Readonly<{ latin: "aptos"; ea: "microsoft-yahei"; cs: "nirmala-ui" }>;
    google: Readonly<{ latin: "roboto"; ea: "noto-sans-sc"; cs: "noto-sans" }>;
  }>;
  chartTypes: readonly ["stacked-column-3x", "stacked-area-3x", "line-with-markers-3x"];
}>;

export interface RenderSvgOptions {
  slideIndex?: number;
  trace?: boolean;
  catalogs?: Record<string, { records?: unknown[] } | unknown[]>;
  catalogSources?: Record<string, { records?: unknown[] } | unknown[]>;
}

export interface SvgToPngOptions {
  scale?: number;
  background?: string;
  dpi?: number;
  useBundledFonts?: boolean;
  loadSystemFonts?: boolean;
  fontFiles?: string[];
  fontDirs?: string[];
  defaultFontFamily?: string;
  sansSerifFamily?: string;
  monospaceFamily?: string;
}

export interface SvgToPdfOptions extends SvgToPngOptions {}

export interface ResolvedPresentation {
  presentation: unknown;
  engineDefaults: typeof engineDefaults;
  slides: ResolvedSlide[];
}

export interface ResolvedSlide {
  index: number;
  path: string;
  slide: unknown;
  layout: unknown;
  design: {
    theme: unknown;
    colorScheme: unknown;
    fontScheme: unknown;
    dimensions: { width: number; height: number };
    background: unknown;
    backgroundColor: string | null;
    colors: Record<string, string>;
    fonts: Record<"heading" | "body" | "code", string>;
  };
  titleBindings: RenderBinding[];
  contentItems: RenderBinding[];
  blocks: RenderBinding[];
}

export interface RenderBinding {
  type: string;
  field?: string;
  slot?: string;
  value: unknown;
  path: string;
  placeholderIndex?: number;
  regionKey?: string;
}

export declare class OPFRenderError extends Error {
  readonly code: string;
  readonly details: Record<string, unknown>;
  readonly issues?: unknown[];
  readonly path?: string;
  constructor(code: string, message: string, details?: Record<string, unknown>);
}

export declare function resolvePresentation(input: unknown, options?: RenderSvgOptions): ResolvedPresentation;

export declare function renderSvg(input: unknown, options?: RenderSvgOptions): string;

export declare function renderSvgDeck(input: unknown, options?: RenderSvgOptions): string[];

export declare function svgToPng(svg: string | Uint8Array, options?: SvgToPngOptions): Promise<Uint8Array>;

export declare function svgToPdf(svgs: string | Uint8Array | Array<string | Uint8Array>, options?: SvgToPdfOptions): Promise<Uint8Array>;
