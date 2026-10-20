import type { EditorSession } from "./index.js";

export interface SlideNavigatorLabels {
  /** The accessible name of the control group. Default: "Slide navigation". */
  navigation?: string;
  /** Default: "Previous slide". */
  previous?: string;
  /** Default: "Next slide". */
  next?: string;
  /** The tooltip of the counter, for example "Slide 2 of 3". */
  position?: (index: number, count: number) => string;
}
export interface SlideNavigatorOptions {
  /** The editor session. The slide count follows it. */
  editor?: EditorSession;
  /** Without an editor: an OPF presentation, or a function returning the current one. Call `refresh()` after it changes. */
  presentation?: { slides?: unknown[] } | (() => { slides?: unknown[] });
  /** The slide shown first (0-based). Default 0. */
  slideIndex?: number;
  /** Called with the new index when the user moves, and when a shrinking deck clamps the index. Not called by `setSlide`. */
  onChange?: (index: number) => void;
  /** `"comfortable"` (32px controls, default) or `"touch"` (40px). */
  density?: "comfortable" | "touch";
  labels?: SlideNavigatorLabels;
  /** False to stop following the editor on its own; call `refresh()` yourself. Default true. */
  autoRefresh?: boolean;
}
export interface SlideNavigator {
  readonly element: HTMLElement;
  getSlide(): number;
  /** Show another slide (clamped to the deck) without calling `onChange`. */
  setSlide(index: number): void;
  /** Read the slide count again. */
  refresh(): void;
  /**
   * Page-level Left and Right arrows (default target: the document). They ignore typing in inputs, selects and editors, menus, dialogs, modified keys and
   * events another handler already handled. Returns a function that removes the listener; `destroy()` removes every one.
   */
  bindKeys(target?: Document | HTMLElement | Window): () => void;
  destroy(): void;
}
/** The counter text, for example "01 / 03": both numbers are zero-padded to two digits, or to the width of the slide count from 100 slides. */
export declare function formatSlideCounter(index: number, count: number): string;
export declare function createSlideNavigator(container: HTMLElement, options?: SlideNavigatorOptions): SlideNavigator;
