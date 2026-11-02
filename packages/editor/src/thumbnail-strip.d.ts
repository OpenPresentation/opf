import type { OpfIcons } from "./icons.js";
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
  /** The accessible name and tooltip of the "+" button (with `actions`). Default: "Add slide". */
  add?: string;
  /** The accessible name of the layout menu behind "+". Default: "Layouts". */
  layouts?: string;
  /** The accessible name of the thumbnail context menu. Default: "Slide actions". */
  slideActions?: string;
  /** Menu items. Defaults: "Duplicate slide", "Delete slide", "Hide in slide show", "Show in slide show". */
  duplicate?: string;
  delete?: string;
  hideSlide?: string;
  showSlide?: string;
  /** Move items: left and right in a horizontal strip, up and down in a vertical one. Defaults: "Move left", "Move right", "Move up", "Move down". */
  moveLeft?: string;
  moveRight?: string;
  moveUp?: string;
  moveDown?: string;
  /** Status lines (`onStatus` or the strip's live region). `{position}` and `{count}` are replaced. */
  statusAdded?: string;
  statusDuplicated?: string;
  statusDeleted?: string;
  statusHidden?: string;
  statusShown?: string;
  statusMoved?: string;
  /** Status lines for a move that has nowhere to go and for deleting the last slide. */
  atStart?: string;
  atEnd?: string;
  lastSlide?: string;
}
/** One layout the "+" menu offers: the shape `listSwitchOptions(presentation, "layouts")` returns. `id` is the layout reference written to the slide. */
export interface ThumbnailLayoutChoice {
  id: string;
  label?: string;
  /** The catalog record; its first tag groups the menu (as in the slide manager's layout picker). */
  record?: Record<string, any>;
  group?: string;
  origin?: string;
  [key: string]: unknown;
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
  /** With `actions`, replace the icon of the add button: `add` (`.opf-thumbs-add-icon`). See `OpfIcon`. */
  icons?: OpfIcons<"add">;
  /** A thumbnail cache to share with other views. Default: the strip's own. */
  cache?: ThumbnailCache;
  /** False to draw every thumbnail at once instead of those near the viewport. Default true; also off without IntersectionObserver. */
  lazy?: boolean;
  /** False to stop following the editor on its own; call `refresh()` yourself. Default true. */
  autoRefresh?: boolean;
  /** The document's faces could not be loaded, so no thumbnail was drawn. */
  onError?: (error: unknown) => void;
  /**
   * Slide management (default false, so existing hosts are unchanged). True adds a trailing "+" button (accessible name "Add slide") and a
   * context menu on every thumbnail (right-click, Shift+F10 or the ContextMenu key): Duplicate, Delete (disabled for the last slide), Hide or
   * Show in slide show, Move left and Move right (Move up and Move down in a vertical strip; mirrored in a right-to-left one). On a focused
   * thumbnail Alt+Arrow moves it and Delete deletes it. Each action is one undoable session change, the thumbnail follows the slide it
   * leaves current (the copy, the moved or new slide, the neighbour of a deleted one) and `onSelect` reports it.
   */
  actions?: boolean;
  /**
   * Layout choices for "Add slide with layout", as the slide manager takes them. When given and non-empty, "+" opens a menu of them and adds
   * the chosen layout after the current slide; without it "+" adds a plain slide there at once. Only used with `actions`.
   */
  layoutOptions?: (presentation: any) => ThumbnailLayoutChoice[];
  /** True: no "+" button and every menu item disabled, the keys do nothing. Change it with `setReadOnly`. Only used with `actions`. */
  readOnly?: boolean;
  /** A line for a screen reader after each action. Without it the strip speaks through its own polite live region. */
  onStatus?: (message: string) => void;
}
export interface ThumbnailStrip {
  readonly element: HTMLElement;
  getSlide(): number;
  /** Mark a slide as current (`aria-current`), scroll it into view and draw it. Does not call `onSelect`. */
  setSlide(index: number): void;
  /** Turn slide management off (true) or on again: removes or restores the "+" button and disables the menu items and keys. Does nothing visible without `actions`. */
  setReadOnly(readOnly: boolean): void;
  /** Redraw from the session now. Only slides whose content changed render again. `{ clear: true }` also drops the cache, for example after the host loaded fonts. */
  refresh(options?: { clear?: boolean }): void;
  destroy(): void;
}
export declare function createThumbnailStrip(container: HTMLElement, options: ThumbnailStripOptions): ThumbnailStrip;
