import type { PaginationOptions, PaginationResult } from "@openpresentation/opf/pagination";
import type { Composition, ComposeSlideOptions, SlideComposition } from "@openpresentation/opf/composition";
import type { Catalog, Fonts, PresentationStats, SlideContextDiagnostic, StatsOptions, ValidationReport } from "@openpresentation/opf";
export * from "./catalogs.js";
/**
 * What the editor adds to the options of `composeSlide` and `paginateSlide`: `fonts` is the renderer's fonts handle (`loadFonts()`), whose
 * `textMeasurement` measures the text; `catalogs` are host catalogs for this call (merged after the session's registered ones);
 * `onDiagnostic` hears every diagnostic of core's `resolveSlideContext` (`unresolved-reference`). Any other
 * option overrides the resolved one.
 */
export interface EditorDiagnosticOptions {
  fonts?: Fonts;
  catalogs?: readonly Catalog[];
  onDiagnostic?: (diagnostic: SlideContextDiagnostic) => void;
}
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

/** RFC 6902 operations, executed by core's `@openpresentation/opf/patch`. Paths are JSON Pointers or dotted OPF paths. */
export type JsonPatchOperation =
  | { op: "add"; path: string; value: unknown }
  | { op: "replace"; path: string; value: unknown }
  | { op: "remove"; path: string }
  | { op: "move"; from: string; path: string }
  | { op: "copy"; from: string; path: string }
  | { op: "test"; path: string; value: unknown };

export interface EditorSnapshot {
  presentation: unknown;
  validation: ValidationReport;
  canUndo: boolean;
  canRedo: boolean;
  undoDepth: number;
  redoDepth: number;
}

export interface EditorChange {
  presentation: unknown;
  patches: JsonPatchOperation[];
  inversePatches?: JsonPatchOperation[];
  redoPatches?: JsonPatchOperation[];
  validation: ValidationReport;
}

export interface EditorEvent {
  /** `catalogs`: the registered catalogs changed (`setCatalogs`); the document did not. */
  type: "patch" | "undo" | "redo" | "restore" | "catalogs";
  patches: JsonPatchOperation[];
  inversePatches?: JsonPatchOperation[];
  redoPatches?: JsonPatchOperation[];
  validation: ValidationReport;
  meta?: Record<string, unknown>;
  snapshot: EditorSnapshot;
}

export interface EditorHistoryEntry { patches: JsonPatchOperation[]; inversePatches: JsonPatchOperation[]; meta?: Record<string, unknown> }
export interface EditorHistory { undo: EditorHistoryEntry[]; redo: EditorHistoryEntry[] }

export interface EditorSession {
  paginateSlide(slideIndex: number, options?: PaginationOptions & EditorDiagnosticOptions, meta?: Record<string, unknown>): { change: EditorChange | null; pagination: PaginationResult };
  /** Composes the slide with `{{slide.number}}`, `{{slide.section}}` and `{{deck.slideCount}}` substituted for `options.slideNumber` and `options.slideCount` (default: its place in the open deck and the deck's slide count); the document keeps the tokens. */
  composeSlide(slideIndex: number, options?: ComposeSlideOptions & EditorDiagnosticOptions): SlideComposition;
  setComposition(slideIndex: number, composition: Composition, meta?: Record<string, unknown>): EditorChange;
  readonly presentation: unknown;
  /** The `format` report of the document plus the catalog reference rules, checked against the registered catalogs. */
  readonly validation: ValidationReport;
  /** The host's registered catalogs, frozen; the first is the host default. */
  readonly catalogs: readonly Catalog[];
  /** Replace the registered catalogs: re-validates the document and emits one `catalogs` event. */
  setCatalogs(catalogs: readonly Catalog[] | undefined, meta?: Record<string, unknown>): readonly Catalog[];
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  snapshot(): EditorSnapshot;
  subscribe(listener: (event: EditorEvent) => void): () => void;
  get(path: string | string[], fallback?: unknown): unknown;
  set(path: string | string[], value: unknown, meta?: Record<string, unknown>): EditorChange;
  setGroupComposition(path: string, composition: Composition, meta?: Record<string, unknown>): EditorChange;
  setCatalog(path: string | string[], catalogKind: string, id: string, meta?: Record<string, unknown>): EditorChange;
  applyPatch(operations: JsonPatchOperation[], meta?: Record<string, unknown>): EditorChange;
  /** The undo and redo stacks as plain data (oldest entry first), for hosts that persist work. */
  exportHistory(): EditorHistory;
  /** Replace the document and, optionally, the history in one step (one `restore` event). A history that does not replay against the document throws `invalid-history` before anything changes. */
  restoreState(state: { presentation: unknown; undo?: EditorHistoryEntry[]; redo?: EditorHistoryEntry[] }, meta?: Record<string, unknown>): EditorChange;
  undo(meta?: Record<string, unknown>): EditorChange | null;
  redo(meta?: Record<string, unknown>): EditorChange | null;
}

export interface CreateEditorSessionOptions {
  /** Refuse every edit whose result has an error finding (the default per edit is `meta.rejectInvalid`). */
  rejectInvalid?: boolean;
  /** The host's catalogs (for example `[defaultCatalog]` from `@openpresentation/opf/catalog`): resolution, validation, pickers, embedding. */
  catalogs?: readonly Catalog[];
}

export interface CatalogOption {
  /** The reference to write: `id` or `name:id`. */
  id: string;
  reference: string;
  label: string;
  description?: string;
  record: Record<string, unknown>;
  /** The catalog group the record resolves in (`custom`, `default` or a named group). */
  group: string;
  source?: string;
  origin: "document" | "host";
}

export interface CatalogOptionsInput {
  presentation?: { catalogs?: Record<string, unknown> } | Record<string, unknown>;
  /** Host catalogs, merged after `editor`'s registered ones. */
  catalogs?: readonly Catalog[];
  editor?: EditorSession;
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
  onError?: (error: Error) => void;
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

export declare function getValueAtPath(presentation: unknown, path: string | string[], fallback?: unknown): unknown;

export declare function hasValueAtPath(presentation: unknown, path: string | string[]): boolean;

export declare function createValuePatch(presentation: unknown, path: string | string[], value: unknown): JsonPatchOperation[];

export declare function applyJsonPatch(presentation: unknown, operations: JsonPatchOperation[]): unknown;

export declare function invertJsonPatch(presentation: unknown, operations: JsonPatchOperation[]): JsonPatchOperation[];

/** Core's `stats` of the session's document: neutral facts (counts, words, notes coverage, images and alt text, speaking time), never severities. Reads the JSON only. */
export declare function deckStats(editor: EditorSession, options?: StatsOptions): PresentationStats;

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
