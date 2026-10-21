import type { EditorSession } from "./index.js";
import type { ToSvgOptions } from "@openpresentation/opf-render";
import type { EditorFonts } from "./canvas.js";

export interface PresenterLabels {
  /** The accessible name of the presenter dialog. Default: "Presentation". */
  dialog?: string;
  /** The accessible name and title of the exit button. Default: "Exit presentation". */
  exit?: string;
  /** Default: "Exit (Esc)". */
  exitTitle?: string;
  /** What the live region announces. Default: "Slide 3 of 12" (both numbers count the slides that are shown, not the hidden ones). */
  position?: (position: number, count: number) => string;
  /** Shown while the faces the deck needs load. Default: "Loading fonts…". */
  loading?: string;
  /** Shown when every slide is hidden. */
  empty?: string;
}

export interface PresenterOptions {
  /** The editor session. The presenter reads its current document and catalogs. */
  editor?: EditorSession;
  /** Without an editor: an OPF presentation, or a function returning the current one. Keep the object stable while presenting: slides are drawn once per object. */
  presentation?: { slides?: unknown[] } | (() => { slides?: unknown[] });
  /**
   * The renderer's fonts handle (`loadFonts()`), the one the canvas, the thumbnails and the exports use. With its `pending` and `ensure` the
   * presenter loads the faces a deck needs before it draws ("Loading fonts…" meanwhile).
   */
  fonts?: EditorFonts;
  /** Extra `toSvg` options, such as `catalogs` (merged after the session's). Slides draw with `text: "system"`, `trace: false` and their `{{variables}}` resolved. */
  renderOptions?: ToSvgOptions;
  /** The slide `start()` opens on (0-based deck index; default 0). A hidden slide opens the next one that is not hidden. */
  slideIndex?: number;
  /** The presentation closed, by any route (Esc, the exit button, leaving full screen, `stop()`, `destroy()`). `index` is the deck index of the slide it showed, so the host can return to it. */
  onExit?(index: number): void;
  /** The shown slide changed (deck index): by key, click, swipe or `next`, `previous` and `goTo`. Also once at start when a hidden slide was requested. */
  onSlideChange?(index: number): void;
  /** `"touch"` makes the exit button 40px. Default `"comfortable"` (32px). */
  density?: "comfortable" | "touch";
  /** Show hidden slides too (default false: they are skipped, as the exports skip them). */
  includeHidden?: boolean;
  labels?: PresenterLabels;
}

export interface Presenter {
  /** The root element, mounted in the container: `role="dialog"`, `aria-modal`, hidden until `start`. `data-mode` is `fullscreen` or `overlay`. */
  readonly element: HTMLElement;
  /**
   * Open the presentation on `slideIndex` (default: the `slideIndex` option) and ask the browser for full screen. Call it from a user gesture
   * (a click, a key press): browsers refuse full screen otherwise, and the presentation then fills the window as a fixed overlay. Resolves
   * with the mode once the browser answered. Calling it while open goes to that slide.
   */
  start(slideIndex?: number): Promise<"fullscreen" | "overlay">;
  /** Close the presentation, leave full screen, return focus to the element that was focused at `start`, and call `onExit(index)`. */
  stop(): void;
  /** Show the next slide that is not hidden. Returns false at the end. */
  next(): boolean;
  /** Show the previous slide that is not hidden. Returns false at the start. */
  previous(): boolean;
  /** Show a slide by its deck index (a hidden slide shows the next one that is not hidden). Returns false when the shown slide did not change. */
  goTo(index: number): boolean;
  /** The deck index of the shown slide; -1 when stopped or when every slide is hidden. */
  getSlide(): number;
  isRunning(): boolean;
  /** `stop()`, then remove the element. */
  destroy(): void;
}

/**
 * The presenter: full screen (or a fixed overlay), one slide at a time on black, drawn by the renderer, catalogs and fonts handle the canvas
 * uses. Right, Space, PageDown and Enter go forward; Left, PageUp and Backspace go back; Home and End jump; Esc exits. A click goes forward,
 * a click on the left third goes back, and a swipe on touch moves. A "03 / 12" counter shows on pointer move for 2 seconds.
 * CSS: `src/styles/presenter.css`, classes `opf-presenter-*`.
 */
export declare function createPresenter(container: HTMLElement, options: PresenterOptions): Presenter;

export interface PresentButtonOptions {
  /** The button was activated (not called while disabled). */
  onPresent?(event: MouseEvent): void;
  /** `true` disables with a default reason, a string with your own (it is the title). The button stays focusable (`aria-disabled`) and does nothing. */
  disabled?: boolean | string;
  /** `"touch"` makes the button 40px. Default `"comfortable"` (32px). */
  density?: "comfortable" | "touch";
  /** The accessible name (default "Present"). */
  label?: string;
}

export interface PresentButton {
  readonly element: HTMLButtonElement;
  setDisabled(reason?: boolean | string): void;
  setDensity(density: "comfortable" | "touch"): void;
  destroy(): void;
}

/** The icon-only Present button: a Lucide Presentation icon, `aria-label="Present"`, title "Present (F5)", styled like the Export trigger. */
export declare function createPresentButton(container: HTMLElement, options?: PresentButtonOptions): PresentButton;

/**
 * Bind F5 to `onPresent(event)` on `target` (default: the document); the browser's reload is suppressed when it fires. F5 is ignored while
 * typing in inputs, selects and editors, in menus and dialogs, and with a modifier key held. Returns a function that removes the listener.
 */
export declare function bindPresentShortcut(target: Document | HTMLElement | Window | undefined | null, onPresent: (event: KeyboardEvent) => void): () => void;
