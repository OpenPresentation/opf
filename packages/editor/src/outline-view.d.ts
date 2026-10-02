import type { EditorSession } from "./index.js";

export interface OutlineViewOptions {
  editor: EditorSession;
  /** Called when a row takes focus, so the host can show that slide in its inspector. */
  onSelectSlide?: (slideIndex: number) => void;
  getSlideIndex?: () => number;
  /** Every message the outline announces in its live region. */
  onStatus?: (message: string) => void;
}
export interface OutlineView {
  /** Redraw from the session; the host calls this after document changes. */
  render(): void;
  focusSlide(slideIndex: number): void;
  destroy(): void;
}
export declare function createOutlineView(container: HTMLElement, options: OutlineViewOptions): OutlineView;
