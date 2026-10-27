/**
 * CE-20 (internal): the Studio's shell and controller. Hosts use `createOpfEditor(el, { layout: "studio" })` from
 * `@openpresentation/opf-editor/workspace`; the workspace calls these.
 */
import type { KitDom } from "./studio-kit/dom.js";
import type { OpfCommand, OpfCommandInfo, OpfEditorSlots, OpfStudioOptions, OpfStudioSelectionItem } from "./workspace.js";
import type { SlideAdapter } from "./slide-adapter.js";

export interface StudioShell {
  dom: KitDom;
  [element: string]: unknown;
}
export declare function buildStudioShell(root: HTMLElement, options: { parts: Record<string, boolean>; layout: "studio" | "playground"; labels?: Record<string, string>; studio?: OpfStudioOptions; slots?: OpfEditorSlots }): { slots: OpfEditorSlots & Record<string, HTMLElement>; controls: { undo: HTMLButtonElement; redo: HTMLButtonElement }; shell: StudioShell };
export interface Studio {
  readonly layout: "studio" | "playground";
  readonly selection: readonly OpfStudioSelectionItem[];
  readonly zoom: number;
  readonly adapter: SlideAdapter;
  readonly commands: { list(): OpfCommandInfo[]; run(id: string): boolean; register(command: OpfCommand): () => void };
  setLayout(layout: "studio" | "playground"): boolean;
  select(keys: string[], options?: { source?: string }): void;
  selectTargets(keysOrPaths: string | string[]): boolean;
  revealPath(path: string): boolean;
  setZoom(zoom: number): number;
  fit(mode?: "slide" | "width"): number;
  openLayout(layoutId?: string, options?: { slide?: number }): boolean;
  showTab(id: string, options?: { focus?: boolean }): boolean;
  refresh(): void;
  destroy(): void;
}
export declare function createStudio(context: Record<string, any>): Studio;
