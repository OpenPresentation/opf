/** The renderer's `toSvg(presentation, slides, options)`: one SVG string for a slide number, or an array for a list of slide numbers (1-based). */
export type ThumbnailRenderer = (presentation: any, slides: number | number[], options: any) => string | string[];

export interface ThumbnailCacheOptions {
  /** The renderer's `toSvg` from `@openpresentation/opf-render/svg`. */
  toSvg: ThumbnailRenderer;
  /** The render options for every thumbnail (`catalogs`, `fonts`, `text: "system"`, `trace: false`, ...). The `fonts` handle is not part of the cache context. */
  getOptions: () => Record<string, any>;
}

export interface ThumbnailCache {
  /**
   * Render the thumbnails that are not cached yet, in one `toSvg` call so the renderer resolves the deck once, and drop entries no slide uses.
   * Pass `indices` (0-based) to render only those slides, for example the visible ones; without it every missing slide renders.
   * A change of deck metadata, section context, catalogs or render settings clears the whole cache, because inherited furniture changes.
   */
  prepare(presentation: any, indices?: number[]): void;
  /** The SVG markup (or the text "Preview unavailable") of one slide. Entries are keyed by the slide's index, the slide count and the slide's own content. */
  html(presentation: any, index: number): string;
  /** Forget everything, for example after fonts load. */
  clear(): void;
}

/** A cache of slide thumbnails that renders only the slides whose content changed. */
export declare function createThumbnailCache(options: ThumbnailCacheOptions): ThumbnailCache;
