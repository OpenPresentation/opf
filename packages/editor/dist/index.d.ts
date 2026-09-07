import type { PaginationOptions, PaginationResult } from "@openpresentation/opf/pagination";
import type { Composition, ComposeSlideOptions, SlideComposition } from "@openpresentation/opf/composition";
export declare const packageName = "@openpresentation/opf-editor";

export declare const releaseLane: Readonly<{
  githubRepository: "OpenPresentation/opf-editor";
  npmPackage: "@openpresentation/opf-editor";
  compatibilityPackage: "@openpresentation/opf";
  rendererPackage: "@openpresentation/opf-render";
}>;

export declare const runtimePolicy: Readonly<{
  hostedServiceInCriticalPath: false;
  telemetry: false;
  commercialSdkInCriticalPath: false;
  requiredNetworkCalls: false;
  deterministicLocalExecution: true;
}>;

export type JsonPatchOperation =
  | { op: "add"; path: string; value: unknown }
  | { op: "replace"; path: string; value: unknown }
  | { op: "remove"; path: string }
  | { op: "test"; path: string; value: unknown };

export interface OPFValidationSummary {
  valid: boolean;
  errors: unknown[];
  result: unknown;
}

export interface EditorSnapshot {
  document: unknown;
  validation: OPFValidationSummary;
  canUndo: boolean;
  canRedo: boolean;
  undoDepth: number;
  redoDepth: number;
}

export interface EditorChange {
  document: unknown;
  patches: JsonPatchOperation[];
  inversePatches?: JsonPatchOperation[];
  redoPatches?: JsonPatchOperation[];
  validation: OPFValidationSummary;
}

export interface EditorEvent {
  type: "patch" | "undo" | "redo";
  patches: JsonPatchOperation[];
  inversePatches?: JsonPatchOperation[];
  redoPatches?: JsonPatchOperation[];
  validation: OPFValidationSummary;
  meta?: Record<string, unknown>;
  snapshot: EditorSnapshot;
}

export interface EditorSession {
  paginateSlide(slideIndex: number, options?: PaginationOptions, meta?: Record<string, unknown>): { change: EditorChange | null; pagination: PaginationResult };
  composeSlide(slideIndex: number, options?: ComposeSlideOptions): SlideComposition;
  setComposition(slideIndex: number, composition: Composition, meta?: Record<string, unknown>): EditorChange;
  readonly document: unknown;
  readonly validation: OPFValidationSummary;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  snapshot(): EditorSnapshot;
  subscribe(listener: (event: EditorEvent) => void): () => void;
  get(path: string | string[], fallback?: unknown): unknown;
  set(path: string | string[], value: unknown, meta?: Record<string, unknown>): EditorChange;
  setGroupComposition(path: string, composition: Composition, meta?: Record<string, unknown>): EditorChange;
  setCatalog(path: string | string[], catalogKind: string, id: string, meta?: Record<string, unknown>): EditorChange;
  applyPatch(operations: JsonPatchOperation[], meta?: Record<string, unknown>): EditorChange;
  undo(meta?: Record<string, unknown>): EditorChange | null;
  redo(meta?: Record<string, unknown>): EditorChange | null;
}

export interface CreateEditorSessionOptions {
  validate?: (document: unknown) => unknown;
  rejectInvalid?: boolean;
}

export interface CatalogOption {
  id: string;
  label: string;
  record: Record<string, unknown>;
}

export interface CatalogOptionsInput {
  presentation?: { catalogs?: Record<string, unknown> } | Record<string, unknown>;
  catalogs?: Record<string, unknown>;
  catalogSources?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface SvgTraceBinding {
  elements: unknown[];
  getPath(element: unknown): string;
  getValue(elementOrPath: unknown, fallback?: unknown): unknown;
  select(element: unknown, sourceEvent?: unknown): SvgTraceSelection;
  commit(elementOrPath: unknown, value: unknown, meta?: Record<string, unknown>): EditorChange;
  destroy(): void;
}

export interface SvgTraceSelection {
  path: string;
  pointer: string;
  value: unknown;
  element: unknown;
  editor: EditorSession;
  sourceEvent?: unknown;
}

export interface SvgTraceBindingOptions {
  selector?: string;
  interactive?: boolean;
  onSelect?: (selection: SvgTraceSelection) => void;
}

export interface TextInputOptions {
  path: string;
  label?: string;
  multiline?: boolean;
  type?: string;
  document?: { createElement(tagName: string): any };
}

export interface CatalogSelectOptions extends CatalogOptionsInput {
  path: string;
  catalogKind: string;
  label?: string;
  document?: { createElement(tagName: string): any };
}

export declare class OPFEditorError extends Error {
  readonly code: string;
  readonly details: Record<string, unknown>;
  readonly path?: unknown;
  readonly issues?: unknown[];
  constructor(code: string, message: string, details?: Record<string, unknown>);
}

export declare function splitOpfPath(path: string | string[]): string[];

export declare function opfPathToJsonPointer(path: string | string[]): string;

export declare function jsonPointerToOpfPath(pointer: string): string;

export declare function getValueAtPath(document: unknown, path: string | string[], fallback?: unknown): unknown;

export declare function hasValueAtPath(document: unknown, path: string | string[]): boolean;

export declare function createValuePatch(document: unknown, path: string | string[], value: unknown): JsonPatchOperation[];

export declare function applyJsonPatch(document: unknown, operations: JsonPatchOperation[]): unknown;

export declare function invertJsonPatch(document: unknown, operations: JsonPatchOperation[]): JsonPatchOperation[];

export declare function validateOpfDocument(document: unknown, validator?: (document: unknown) => unknown): OPFValidationSummary;

export declare function createEditorSession(input: unknown, options?: CreateEditorSessionOptions): EditorSession;

export declare function createSvgTraceBinding(
  root: { querySelectorAll(selector: string): Iterable<unknown>; matches?: (selector: string) => boolean },
  editor: EditorSession,
  options?: SvgTraceBindingOptions
): SvgTraceBinding;

export declare function getCatalogRecords(catalogKind: string, options?: CatalogOptionsInput): Record<string, unknown>[];

export declare function getCatalogOptions(catalogKind: string, options?: CatalogOptionsInput): CatalogOption[];

export declare function assertCatalogId(catalogKind: string, id: string, options?: CatalogOptionsInput): string;

export declare function setCatalogId(
  editor: EditorSession,
  path: string | string[],
  catalogKind: string,
  id: string,
  meta?: CatalogOptionsInput
): EditorChange;

export declare function createTextInput(editor: EditorSession, options: TextInputOptions): any;

export declare function createCatalogSelect(editor: EditorSession, options: CatalogSelectOptions): any;
