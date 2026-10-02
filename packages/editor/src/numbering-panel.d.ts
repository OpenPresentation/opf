import type { EditorSession } from "./index.js";

export interface NumberingPanelOptions {
  editor: EditorSession;
  /** The path the host has selected (a list, an entry of one, or anything inside one); the panel numbers that list. */
  getTarget?: () => string | undefined;
  /** The slide whose lists the panel offers when nothing in a list is selected. */
  getSlideIndex?: () => number;
  /** Called with every status or error message the panel shows. */
  onStatus?: (message: string, info: { error: boolean }) => void;
}
export interface NumberingPanel {
  element: HTMLElement;
  /** Show another list (a path in it); with no argument, re-read the host's selection. */
  setTarget(path?: string): void;
  /** Redraw from the document (called on every document change). */
  refresh(): void;
  destroy(): void;
}
/** Mount the numbering control: number a list, pick the style, start and suffix, set them per level, and restart the count at an entry. Every change is one undoable edit. */
export declare function createNumberingPanel(container: HTMLElement, options: NumberingPanelOptions): NumberingPanel;
