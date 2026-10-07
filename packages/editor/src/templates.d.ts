import type { EditorSession } from "./index.js";

export type TemplateVariableKind = "color" | "text" | "number" | "date" | "image" | "url" | "list";
export type TemplateFieldStatus = "filled" | "default" | "unfilled" | "optional";

/** The form control each variable kind uses. */
export declare const TEMPLATE_INPUT_TYPES: Readonly<Record<TemplateVariableKind, TemplateVariableKind>>;

export interface TemplateVariableUse {
  id: string;
  /** JSON pointer of the string carrying the token or reference. */
  path: string;
  form: "token" | "reference";
}

export interface TemplateField {
  id: string;
  kind: TemplateVariableKind;
  input: TemplateVariableKind;
  /** The declaration's `label`, or the id as words. */
  label: string;
  description?: string;
  required: boolean;
  format?: string;
  example?: unknown;
  /** The effective value: a supplied value, else the declared one. */
  value?: unknown;
  /** The declaration's own value (its default), if any. */
  defaultValue?: unknown;
  /** What a form control shows for a supplied value (empty when only the default applies). */
  text: string;
  /** Placeholder text: the default value, else the example. */
  placeholder: string;
  /** True when the value is rich text (formatting is kept until the field is edited). */
  rich: boolean;
  /** "filled" (supplied), "default" (declared value), "unfilled" (required, no value) or "optional". */
  status: TemplateFieldStatus;
  uses: TemplateVariableUse[];
}

export interface TemplateStatus {
  template: boolean;
  fieldCount: number;
  requiredCount: number;
  filledRequiredCount: number;
  unfilled: string[];
  complete: boolean;
}

export interface TemplatePreview {
  presentation: Record<string, unknown>;
  diagnostics: { code: string; severity: "error" | "warning" | "info"; path: string; id: string; message: string }[];
  unfilled: string[];
  examplesUsed: string[];
  complete: boolean;
}

/** True when the core this editor runs on can resolve template variables. */
export declare function templatesAvailable(): boolean;
export declare function isTemplateDocument(document: unknown): boolean;
/** True when the document is a template or declares a variable that is not a color. */
export declare function hasTemplateVariables(document: unknown): boolean;
export declare function valueToFieldText(kind: TemplateVariableKind, value: unknown): string;
/** Parse a form control's text. A blank control clears the value. */
export declare function fieldTextToValue(kind: TemplateVariableKind, text: string): { ok: true; value: unknown } | { ok: false; message: string };
export declare function listTemplateFields(document: unknown, values?: Record<string, unknown>): TemplateField[];
export declare function templateStatus(document: unknown, values?: Record<string, unknown>): TemplateStatus;
/** The concrete deck for the values with each unfilled variable's example. Never throws for missing values. */
export declare function previewTemplate(document: unknown, values?: Record<string, unknown>): TemplatePreview;

export interface TemplateFillOptions {
  /** Extra session meta for the fill edit. */
  meta?: Record<string, unknown>;
}
export interface TemplateFillApplyResult {
  document: unknown;
  patches: unknown[];
  inversePatches: unknown[];
  validation: unknown;
  unfilled: string[];
  complete: boolean;
  diagnostics: TemplatePreview["diagnostics"];
}
export interface TemplateFill {
  readonly values: Record<string, unknown>;
  fields(): TemplateField[];
  status(): TemplateStatus;
  preview(): TemplatePreview;
  /** Set a typed value; `undefined` or `null` clears it. Throws on an unknown variable or a value of the wrong kind. */
  set(id: string, value: unknown): TemplateFill;
  /** Set from a form control's text. Returns `{ ok: false, message }` instead of throwing for bad text. */
  setText(id: string, text: string): { ok: true; value: unknown } | { ok: false; message: string };
  clear(id: string): TemplateFill;
  /** Drop values for variables the document no longer declares. */
  prune(): TemplateFill;
  reset(): TemplateFill;
  subscribe(listener: (fill: TemplateFill) => void): () => void;
  /**
   * Fill the document with the values as one undoable, validated edit. Unfilled required variables
   * refuse the fill (`unfilled-variables`) unless `partial` is set.
   */
  apply(options?: { partial?: boolean; meta?: Record<string, unknown> }): TemplateFillApplyResult;
}
export declare function createTemplateFill(editor: EditorSession, options?: TemplateFillOptions): TemplateFill;

/** The token for a declared variable id or a built-in name such as `speaker.name`. */
export declare function variableToken(id: string, format?: string): string;
/** One built-in variable of a document (core `listBuiltinVariables`). */
export interface BuiltinInfo {
  /** Dotted name, as written inside `{{...}}`. */
  name: string;
  kind: "text" | "image" | "list";
  label: string;
  /** The source value, when the document has one. */
  value?: unknown;
  available: boolean;
  uses: { id: string; path: string; form: "token" | "reference" }[];
}
/** The document's built-in variables, read-only; empty on a core without built-ins. */
export declare function listBuiltins(document: unknown): BuiltinInfo[];
export declare function suggestVariableId(document: unknown, label?: string): string;
/** Declare a variable as one undoable edit. */
export declare function declareVariable(editor: EditorSession, id: string, declaration: string | Record<string, unknown>, meta?: Record<string, unknown>): unknown;
/** Mark the document as a template, or as a normal deck with `false`, as one undoable edit. */
export declare function setTemplate(editor: EditorSession, enabled: boolean, meta?: Record<string, unknown>): unknown;
export interface InsertVariableTokenOptions {
  /** UTF-16 offsets into the string; a selection is replaced. Default: the end. */
  start?: number;
  end?: number;
  /** For a TextRun[] field: which run (default the last). */
  runIndex?: number;
  /** A one-off format: `{{id|format}}`. */
  format?: string;
  /** Declare the variable in the same edit when it is not declared yet. */
  declare?: string | Record<string, unknown>;
  meta?: Record<string, unknown>;
}
/** Insert a variable token into a text field as one undoable edit. */
export declare function insertVariableToken(editor: EditorSession, path: string, id: string, options?: InsertVariableTokenOptions): { token: string; document: unknown; patches: unknown[]; inversePatches: unknown[]; validation: unknown };
