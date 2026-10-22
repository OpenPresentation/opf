import type { EditorSession } from "./index.js";
import type { CanvasEditor } from "./canvas.js";
import type { SearchMatch } from "./find-replace.js";

export interface FindPanelOptions {
  editor: EditorSession;
  /** Matches are shown and selected on this canvas. */
  canvas?: CanvasEditor | (() => CanvasEditor | undefined);
  /** A host that owns slide navigation shows the slide (return a promise to wait for its fonts); defaults to `canvas.setSlide`. */
  goToSlide?: (slideIndex: number) => void | Promise<void>;
  /** Called after a go to, with the path the canvas selected (null for speaker notes and deck fields: the host puts them in view here; move focus only for `via: "list"`, so Enter keeps stepping). */
  onGoTo?: (match: SearchMatch, selectedPath: string | null, details: { via: "list" | "step" }) => void;
  /** The slide "This slide only" searches. Defaults to the canvas's slide. */
  getSlideIndex?: () => number;
  /** Seeds the find field when the panel opens (a single-line selection of at most 200 characters). */
  getSelectionText?: () => string | undefined;
  /** Finish an inline edit before the document is replaced; return false to stop. Defaults to `canvas.commit`. */
  commit?: () => boolean;
  onStatus?: (message: string, details: { error: boolean }) => void;
  onClose?: () => void;
}
export interface FindPanel {
  readonly element: HTMLElement;
  readonly isOpen: boolean;
  readonly matches: SearchMatch[];
  /** Index of the current match, or -1. */
  readonly current: number;
  /** Show the panel (`replace: true` also shows the replace field), focus the find field and select its text. `query` seeds the search. */
  open(options?: { replace?: boolean; query?: string }): void;
  close(): void;
  /** Set the search programmatically. */
  set(values: { query?: string; replacement?: string; matchCase?: boolean; wholeWord?: boolean; regex?: boolean; thisSlide?: boolean }): void;
  next(): Promise<void> | undefined;
  previous(): Promise<void> | undefined;
  goTo(index: number, options?: { focusResult?: boolean; via?: "list" | "step" }): Promise<void>;
  replaceOne(): void;
  replaceAll(): void;
  refresh(): void;
  destroy(): void;
}
/** Mount the find and replace panel in `container`; it is hidden until `open()`. */
export declare function createFindPanel(container: HTMLElement, options: FindPanelOptions): FindPanel;
/** Ctrl/Cmd+F opens find, Ctrl/Cmd+H and Ctrl/Cmd+Shift+H open find and replace. Returns a function that removes the listener. */
export declare function installFindShortcuts(panel: Pick<FindPanel, "open" | "element">, options?: { document?: Document; isEnabled?: () => boolean }): () => void;
