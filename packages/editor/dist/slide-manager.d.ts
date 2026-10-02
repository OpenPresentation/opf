import type { EditorSession } from "./index.js";

/** The RR-26 split and merge functions (`@openpresentation/opf-editor/content-actions`), passed in to show those actions in the menu. */
export interface SlideContentActions {
  splitSlideByBlocks(editor: EditorSession, slideIndex: number, options?: { at?: number[]; each?: boolean; repeatHeadings?: boolean }, meta?: Record<string, unknown>): { changed: boolean; reason?: string; range?: { start: number; deleteCount: number }; slideCount?: number };
  mergeSlides(editor: EditorSession, start: number, count?: number, meta?: Record<string, unknown>): { changed: boolean; reason?: string; loss?: string[] };
}
export interface SlideManagerOptions {
  editor: EditorSession;
  /** The slide the host is showing. The manager keeps it in the selection. */
  getSlideIndex: () => number;
  /** Called when the user chooses or moves to a slide; the host shows it and calls `render()`. */
  setSlideIndex: (index: number) => void;
  /** The thumbnail of one slide as an HTML string (usually the renderer's SVG). Cache it: it is called for every card on every render. */
  renderThumbnail?: (document: unknown, index: number) => string;
  /** `"navigator"` (a vertical list, the default) or `"sorter"` (a grid with arrow keys in both directions). */
  variant?: "navigator" | "sorter";
  /** An element to fill with the Duplicate, Delete, Hide and More buttons. */
  toolbar?: HTMLElement;
  /** Show Split and Merge in the slide menu. */
  contentActions?: SlideContentActions;
  /** Layout choices for "Add slide with layout" (default: the layouts catalog, via `listSwitchOptions`). */
  layoutOptions?: (document: unknown) => { id: string; label: string; record?: Record<string, any> }[];
  /** Every message the manager announces in its live region, for a visual status line. */
  onStatus?: (message: string) => void;
  onError?: (error: unknown) => void;
  /** False to skip the first draw (a host that draws only after its fonts are loaded calls `render()` itself). */
  autoRender?: boolean;
}
export interface SlideManager {
  /** Redraw from the session. Call after every document change and when the current slide changes. */
  render(): void;
  /** The selected slide indices in order (always includes the current slide). */
  getSelection(): number[];
  setSelection(indices: number[]): void;
  focus(index: number): void;
  openLayoutPicker(): void;
  /** Collapse or expand a section (an index from `listSections`): view state only, nothing is written to the document. Returns false for an unknown section. */
  setSectionCollapsed(sectionIndex: number, collapsed?: boolean): boolean;
  /** Run an action on the selection: duplicate, delete, hide, move-up, move-down, move-start, move-end, split, merge, select-all. */
  run(action: "duplicate" | "delete" | "hide" | "move-up" | "move-down" | "move-start" | "move-end" | "split" | "merge" | "select-all"): void;
  destroy(): void;
}
export declare function createSlideManager(container: HTMLElement, options: SlideManagerOptions): SlideManager;
