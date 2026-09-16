/** Already-loaded catalog records by kind. No remote catalog URLs are fetched. */
export type JsonCatalogContext = Readonly<Record<string, readonly Record<string, unknown>[]>>;
export type JsonOptionValue = string | number | boolean;
export interface JsonFieldOption {
  value: JsonOptionValue;
  label: string;
  description?: string;
  source: 'Built-in catalog' | 'Loaded catalog' | 'Document catalog' | 'Schema' | 'Current value';
  suggested?: boolean;
  /** User-facing provenance; source remains stable for existing consumers. */
  sourceLabel?: string;
  sourceDescription?: string;
  layoutGroup?: 'Current layout' | 'Same placeholders' | 'Compatible placeholders' | 'Different counts' | 'Other layouts' | 'Unspecified placeholders';
  /** Declared placeholder types and counts, not a rendering guarantee. */
  placeholders?: string;
  /** Declared kinds in layout order, used to create missing blank content. */
  placeholderTypes?: string[];
  related?: boolean;
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
/** Replace the token and add missing layout payloads. Hosts must reject stale sources. */
export declare function replaceFieldOption(context: JsonFieldContext, value: JsonOptionValue): string;
/** Minimal single replacement for atomic source-editor undo. */
export declare function fieldOptionEdit(context: JsonFieldContext, value: JsonOptionValue): {from:number;to:number;insert:string};
