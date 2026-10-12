// @openpresentation/gallery/previews: one SVG preview per layout, for layout pickers.
//
// Each preview is a self-contained <svg> element with a 16:9 viewBox, keyed by the layout id (`pillars`,
// `chart-beside`, ...): the layout drawn with sample content in every region by the @openpresentation/opf-render this
// package pins (scripts/render-previews.mjs), with the engine's default design. Scale it to any thumbnail; inline it in
// HTML or serve it as image/svg+xml.

/** One preview of the index. */
export interface LayoutPreviewRecord {
  /** The layout id. */
  readonly id: string;
  /** The file name the preview was rendered to. */
  readonly file: string;
  /** UTF-8 byte length of the SVG file. */
  readonly bytes: number;
}

/** The preview index (schema https://openpresentation.org/schema/opf-layout-preview-index/v1, version "2"). */
export interface LayoutPreviewIndex {
  readonly $schema: string;
  readonly version: string;
  readonly description: string;
  readonly records: readonly LayoutPreviewRecord[];
}

/** The SVG preview of each layout, keyed by the layout id. */
export declare const layoutPreviews: Readonly<Record<string, string>>;
/** The preview index, in catalog order. */
export declare const layoutPreviewIndex: LayoutPreviewIndex;
/** The id of every layout that ships a preview, sorted. */
export declare const layoutPreviewSlugs: readonly string[];
/** Whether a preview exists for the layout id. */
export declare function hasLayoutPreview(slug: string): boolean;
/** The SVG preview of a layout id, or undefined when none ships (fall back to a generic thumbnail). */
export declare function getLayoutPreview(slug: string): string | undefined;
