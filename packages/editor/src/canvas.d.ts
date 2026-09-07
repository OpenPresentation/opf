import type { EditorSession } from "./index.js";
import type { RenderSvgOptions } from "@openpresentation/opf-render";
import type { SlideComposition } from "@openpresentation/opf/composition";
export interface CanvasEditorOptions {
  editor?: EditorSession;
  document?: unknown;
  slideIndex?: number;
  /** Show keyboard-accessible dividers for resizing composition tracks. */
  layoutEditing?: boolean;
  renderOptions?: RenderSvgOptions;
  /** Optional empty host for property forms; defaults to a floating canvas panel. */
  propertiesContainer?: HTMLElement;
  onSelect?: (selection: {
    path: string;
    value: unknown;
    element: Element | undefined;
    editor: EditorSession;
  }) => void;
  onDraft?: (draft: {
    document: unknown;
    path: string;
    value: unknown;
  }) => void;
  onCommit?: (event: { path: string; editor: EditorSession }) => void;
  onCancel?: (event: { path?: string }) => void;
  onError?: (error: Error) => void;
  onRender?: (event: {
    document: unknown;
    slideIndex: number;
    svg: SVGSVGElement;
    geometry: SlideComposition;
    draft: boolean;
  }) => void;
}
export interface CanvasEditor {
  editor: EditorSession;
  ready: Promise<void>;
  readonly slideIndex: number;
  readonly editingPath: string | null;
  readonly layoutEditing: boolean;
  setLayoutEditing(enabled: boolean): boolean;
  /** Open reorder and move-to-group controls for a complete block path. */
  openBlockMenu(path: string): void;
  /** Add starter content to a slide/group/region, converting implicit content when needed. */
  openInsertMenu(containerPath?: string,index?: number): void;
  select(path: string): void;
  beginEdit(path: string): void;
  /** Open structured controls, including rich run fields. */
  editProperties(path: string): boolean;
  commit(): boolean;
  cancel(): void;
  render(document?: unknown): void;
  setSlide(index: number): boolean;
  setRenderOptions(options: RenderSvgOptions): boolean;
  destroy(): void;
}
export declare function createCanvasEditor(
  container: HTMLElement,
  options: CanvasEditorOptions,
): CanvasEditor;
export declare function getEditableFields(
  value: unknown,
  path: string,
): {
  fields: { path: string; label: string; type: string; value: unknown }[];
  arrays: { path: string; label: string; length: number }[];
};
