/** The host's catalogs (core `Catalog[]`): records offered after the document's embedded ones. */
export type JsonCatalogContext = readonly import("@openpresentation/opf").Catalog[];
export type JsonOptionValue = string | number | boolean;
export interface JsonFieldOption {
  value: JsonOptionValue;
  label: string;
  description?: string;
  source: 'Loaded catalog' | 'Document catalog' | 'Schema' | 'Current value';
  /** User-facing provenance; source remains stable for existing consumers. */
  sourceLabel?: string;
  sourceDescription?: string;
  layoutGroup?: 'Current layout' | 'Openers and closers' | 'Text' | 'Groups of items' | 'Numbers' | 'Visuals' | 'Mixed' | 'Custom layouts';
  /** Region names, accepted kinds and flow from the v2 template. */
  regions?: string;
}
export interface JsonFieldContext {
  source: string;
  path: (string | number)[];
  /** Original-source UTF-16 token range, including surrounding JSON quotes. */
  offset: number;
  length: number;
  value: JsonOptionValue;
  label: string;
  options: JsonFieldOption[];
  catalog?: string;
  unloadedSource: boolean;
}
/** Null for invalid JSON or a field with no categorical choices. */
export declare function getJsonFieldContext(source: string, position: number, loadedCatalogs?: JsonCatalogContext): JsonFieldContext | null;
/** Replace only the selected reference token, preserving content. Hosts must reject stale sources. */
export declare function replaceFieldOption(context: JsonFieldContext, value: JsonOptionValue): string;
/** Minimal single replacement for atomic source-editor undo. */
export declare function fieldOptionEdit(context: JsonFieldContext, value: JsonOptionValue): {from:number;to:number;insert:string};
export interface JsonCompletionOption {
  /** A key option's property name, or the JSON value to write. */
  value: JsonOptionValue;
  label: string;
  detail?: string;
  info?: string;
  /** CodeMirror ranking, -99 to 99. */
  boost: number;
}
export interface JsonCompletions {
  kind: 'key' | 'value';
  /** The text being typed: inside the quotes of a string, or the bare word. */
  from: number;
  to: number;
  quoted: boolean;
  /** Whether a closing quote follows the typed text. */
  closed: boolean;
  options: JsonCompletionOption[];
}
/** The property names and values to offer at `position` of a JSON draft (it need not parse); null when there are none. `explicit` also offers choices where nothing is typed yet. */
export declare function getJsonCompletions(source: string, position: number, loadedCatalogs?: JsonCatalogContext, options?: { explicit?: boolean }): JsonCompletions | null;
