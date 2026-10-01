import type { EditorSession } from "./index.js";
import type { TemplateFill, TemplateFillApplyResult } from "./templates.js";

export interface TemplatePanelOptions {
  editor: EditorSession;
  /**
   * Draw the live preview: return the SVG of one slide of `document` with `variables` (the values typed so far)
   * as an SVG string, or a promise of one. Typically `renderSvg(document, { variables, slideIndex, ... })` from
   * `@openpresentation/opf-render` with the host's fonts. Omit for no preview.
   */
  renderPreview?: (input: { document: unknown; variables: Record<string, unknown>; slideIndex: number }) => string | Promise<string>;
  /** The slide the preview starts on. Call `refresh()` when it changes. */
  getSlideIndex?: () => number;
  /** The text field a variable token is inserted into: its OPF path and, optionally, the selection as UTF-16 offsets. Omit to hide the insert section. */
  getTarget?: () => { path: string; start?: number; end?: number } | undefined;
  /** Called with every status or error message the panel shows. */
  onStatus?: (message: string, info: { error: boolean }) => void;
  /** Called after the presentation was filled. */
  onApply?: (result: TemplateFillApplyResult) => void;
  /** Read an uploaded image as a data URL (default: a FileReader). */
  readFile?: (file: File) => string | Promise<string>;
}
export interface TemplatePanel {
  element: HTMLElement;
  /** The fill session behind the panel (values typed so far). */
  fill: TemplateFill;
  refresh(): void;
  destroy(): void;
}
/** Mount the Fill template panel: typed inputs for every variable, filled and unfilled state, a live preview, one undoable fill, and token insertion. */
export declare function createTemplatePanel(container: HTMLElement, options: TemplatePanelOptions): TemplatePanel;
