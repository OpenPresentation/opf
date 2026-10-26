import type { EditorSession } from "./index.js";
import type { LayoutEditor, LayoutEditorDensity } from "./layout-editor.js";

export interface LayoutStudioOptions {
  session: EditorSession;
  toSvg?: (...args: any[]) => string;
  fonts?: unknown;
  renderOptions?: Record<string, unknown> | (() => Record<string, unknown>);
  getSlideIndex: () => number;
  onStatus?: (message: string) => void;
  density?: LayoutEditorDensity;
  readOnly?: boolean;
  labels?: Partial<Record<"layout" | "pick" | "fresh" | "save" | "apply", string>>;
}
/** Layout Studio inside the workspace: the layout editor over the deck's own custom layouts, with a bar to pick, save and apply. */
export interface LayoutStudio {
  element: HTMLElement;
  editor: LayoutEditor;
  pick: HTMLSelectElement;
  save: HTMLButtonElement;
  apply: HTMLButtonElement;
  status: HTMLElement;
  /** Re-read the deck's custom layouts into the picker. */
  refresh(): void;
  /** Edit the deck's layout `id`, or a new layout for `""`. */
  load(id: string): void;
  setReadOnly(readOnly: boolean): void;
  setDensity(density: LayoutEditorDensity): void;
  destroy(): void;
}
export declare function createLayoutStudio(container: HTMLElement, options: LayoutStudioOptions): LayoutStudio;
