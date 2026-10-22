import type { EditorChange, EditorSession, JsonPatchOperation } from "./index.js";

/** At most this many matches are collected; `truncated` says so. */
export declare const MAX_MATCHES: number;

/** One searchable piece of text: a string or a run array. */
export interface SearchField {
  /** JSON pointer of the string or the run array. */
  pointer: string;
  /** Dotted OPF path, as the canvas traces it (`slides.2.items.1`). */
  path: string;
  /** -1 for the deck (name, description, header and footer text). */
  slideIndex: number;
  /** For example `Title`, `List item 2`, `Table row 1, column 3`, `Speaker notes`. */
  label: string;
  kind: string;
  /** True for a run array (rich text). */
  runs: boolean;
  /** The text: a string field's value, or a run array's runs joined. */
  text: string;
}
export interface CollectOptions {
  /** Leave speaker notes out (default: searched). */
  notes?: boolean;
  /** Search one slide only (deck fields are then left out). */
  slideIndex?: number;
}
export interface SearchOptions extends CollectOptions {
  /** Default false. */
  matchCase?: boolean;
  /** The match is not touched by a letter, digit or underscore. Default false. */
  wholeWord?: boolean;
  /** Treat the query as a regular expression (`$1`, `$&`, `$<name>` work in the replacement). Default false: literal text. */
  regex?: boolean;
}
export interface SearchMatch {
  /** `<pointer>@<start>`: stable while the document does not change. */
  id: string;
  pointer: string;
  path: string;
  slideIndex: number;
  label: string;
  kind: string;
  runs: boolean;
  /** Offsets into the field's text. */
  start: number;
  end: number;
  text: string;
  groups: string[];
  named?: Record<string, string>;
  context: { before: string; match: string; after: string };
}
export interface SearchResult {
  matches: SearchMatch[];
  /** Fields with at least one match. */
  fieldCount: number;
  /** Slides (and the deck) with at least one match. */
  slideCount: number;
  truncated: boolean;
  /** A readable message for an invalid regular expression. */
  error?: string;
}
export interface ReplacePlan {
  patches: JsonPatchOperation[];
  count: number;
  fieldCount: number;
}
export interface ReplaceResult {
  count: number;
  fieldCount?: number;
  /** The session's change, or null when nothing changed. One undo reverses it. */
  change: EditorChange | null;
}
export interface TextEdit {
  start: number;
  end: number;
  replacement: string;
}

/** The plain text of a string or a run array. */
export declare function textOf(value: unknown): string;
/** Every searchable text field of a document, in reading order. */
export declare function collectSearchFields(presentation: unknown, options?: CollectOptions): SearchField[];
/** Compile a search into a global RegExp; `{ error }` for an invalid regular expression, `{ empty: true }` for an empty query. */
export declare function compileSearch(query: string, options?: SearchOptions): { regex?: RegExp; error?: string; empty?: boolean };
/** Search a document's text. */
export declare function findMatches(presentation: unknown, query: string, options?: SearchOptions): SearchResult;
/** Expand a replacement for one match (`$&`, `$1`, `$<name>`, `$$` in regex mode; literal otherwise). */
export declare function expandReplacement(template: string, match: SearchMatch, fieldText: string, regex?: boolean): string;
/**
 * Apply sorted, non-overlapping edits to a string or run array. A match inside one run keeps every run's formatting; a
 * match across runs takes the formatting of the run that holds its first character.
 */
export declare function applyTextEdits<T extends string | unknown[]>(value: T, edits: TextEdit[]): T;
/** The patches that replace the given matches. Throws `stale-match` when the text changed. */
export declare function planReplace(presentation: unknown, matches: SearchMatch[], replacement: string, options?: { regex?: boolean }): ReplacePlan;
/** Replace every match as one undoable session change. Throws `invalid-search` for a bad regular expression. */
export declare function replaceAll(editor: EditorSession, query: string, replacement: string, options?: SearchOptions): ReplaceResult;
/** Replace one match as one undoable change. Throws `stale-match` when it is no longer in the document. */
export declare function replaceMatch(editor: EditorSession, match: SearchMatch, query: string, replacement: string, options?: SearchOptions): ReplaceResult;
