/** Already-loaded catalog records by kind. No remote catalog URLs are fetched. */
export type JsonCatalogContext = Readonly<Record<string, readonly Record<string, unknown>[]>>;
export type JsonOptionValue = string | number | boolean;
export interface JsonFieldOption {
  value: JsonOptionValue;
  label: string;
  description?: string;
  source: 'Built-in catalog' | 'Loaded catalog' | 'Document catalog' | 'Schema' | 'Current value';
  suggested?: boolean;
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
/** Replace only the token. Hosts must reject a context whose source is stale. */
export declare function replaceFieldOption(context: JsonFieldContext, value: JsonOptionValue): string;
