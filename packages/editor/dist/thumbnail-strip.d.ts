import type { EditorSession } from "./index.js";
import type { ThumbnailCache } from "./thumbnail-cache.js";

export interface ThumbnailStripLabels {
  /** The accessible name of the `nav`. Default: "Slides". */
  navigation?: string;
  /** The title shown for a slide without one. Default: "Untitled". */
  untitled?: string;
  /** Read after the title of a hidden slide. Default: "hidden". */
  hidden?: string;
  /** Shown in place of a thumbnail the renderer could not draw. Default: "Preview unavailable". */
  unavailable?: string;
}
export interface ThumbnailStripOptions {
  /** The editor session. Required. */
  editor: EditorSession;
  /** The renderer's fonts handle, the one the canvas and the export use. Thumbnails wait for the faces the document needs. */
  fonts?: unknown;
  /** Extra `toSvg` options, for example `catalogs`. Thumbnails always draw with `text: "system"` and `trace: false`. */
  renderOptions?: Record<string, any>;
  /** The current slide (0-based). Default 0. */
  slideIndex?: number;
  /** The user chose a slide (click, Enter or Space). Call `setSlide` yourself if you want the strip to follow. Not called by `setSlide`. */
  onSelect?: (index: number) => void;
  /** `"comfortable"` (default) or `"touch"`: larger gaps, 40px-high items and 104px thumbnails. */
  density?: "comfortable" | "touch";
  /** Thumbnail width in pixels. Default 128 (104 for touch). */
  size?: number;
  /** `"horizontal"` (default) scrolls sideways; `"vertical"` scrolls down. */
  orientation?: "horizontal" | "vertical";
  labels?: ThumbnailStripLabels;
  /** A thumbnail cache to share with other views. Default: the strip's own. */
  cache?: ThumbnailCache;
  /** False to draw every thumbnail at once instead of those near the viewport. Default true; also off without IntersectionObserver. */
  lazy?: boolean;
  /** False to stop following the editor on its own; call `refresh()` yourself. Default true. */
  autoRefresh?: boolean;
  /** The document's faces could not be loaded, so no thumbnail was drawn. */
  onError?: (error: unknown) => void;
}
export interface ThumbnailStrip {
  readonly element: HTMLElement;
  getSlide(): number;
  /** Mark a slide as current (`aria-current`), scroll it into view and draw it. Does not call `onSelect`. */
  setSlide(index: number): void;
  /** Redraw from the session now. Only slides whose content changed render again. `{ clear: true }` also drops the cache, for example after the host loaded fonts. */
  refresh(options?: { clear?: boolean }): void;
  destroy(): void;
}
export declare function createThumbnailStrip(container: HTMLElement, options: ThumbnailStripOptions): ThumbnailStrip;
