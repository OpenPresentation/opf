// @openpresentation/gallery/previews: the static HTML layout previews pptx.gallery renders for pickers (RR-78).
//
// Each snippet is a self-contained Tailwind-styled fragment that fills a 16:9 thumbnail container. It uses the CSS
// variables --background, --foreground, --card, --muted, --muted-foreground, --accent and --border; set them on a parent
// element (or import the pptx.gallery design tokens).

/** One preview of the index. */
export interface LayoutPreviewRecord {
  /** The preview slug. */
  readonly id: string;
  /** The file name the preview was rendered to. */
  readonly file: string;
  /** UTF-8 byte length of the HTML. */
  readonly bytes: number;
}

/** The preview index (schema https://openpresentation.org/schema/opf-layout-preview-index/v1). */
export interface LayoutPreviewIndex {
  readonly $schema: string;
  readonly version: string;
  readonly description: string;
  readonly records: readonly LayoutPreviewRecord[];
}

/** Static HTML for each preview slug. */
export declare const layoutPreviews: Readonly<Record<string, string>>;
/** The preview index. */
export declare const layoutPreviewIndex: LayoutPreviewIndex;
/** Slugs of every layout that ships an HTML preview, sorted. */
export declare const layoutPreviewSlugs: readonly string[];
/** Whether an HTML preview exists for the slug. */
export declare function hasLayoutPreview(slug: string): boolean;
/** The HTML preview for a slug, or undefined when none ships (fall back to a generic thumbnail). */
export declare function getLayoutPreview(slug: string): string | undefined;
