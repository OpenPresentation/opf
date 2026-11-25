// FR-04: data sources and where a dataset came from. A root `datasources` map describes each place data lives once; a dataset or
// inline chart data names one with `datasource` and records what it took (`query`), when (`retrieved`), which snapshot (`version`),
// the hash of the file as retrieved (`sha256`) and who made it (`generator`). Engines never read, fetch or refresh a data source:
// this module holds the types and the plain helpers. The checks on credentials and staleness are in data-source-checks.ts.
//
// Browser-safe and synchronous: no file access, no network, no system clock.
import type { DataDiagnostic } from './chart-data.js';

/** A place data comes from. It never holds credentials. Engines never read, fetch or refresh it. */
export interface DataSource {
  title?: string;
  description?: string;
  /** The kind of data source in the host's or author's words ('csv', 'xlsx', 'postgres'); engines do not interpret it. */
  connector?: string;
  /** An `asset:<id>` reference, a URL or a path. */
  src?: string;
  license?: string;
  /** An ISO 8601 duration. No engine acts on it. */
  refreshEvery?: string;
  extensions?: Record<string, unknown>;
}
/** Who produced the data: a person or a model, and which. */
export interface DataGenerator { type: 'human' | 'model'; name: string }
/** What a dataset or inline chart data says about where it came from. */
export interface DataProvenance {
  /** The id of an entry in the root `datasources` map (a string is always an id), or a data source written inline. */
  datasource?: string | DataSource;
  /** What was taken from the data source, in its own language ('FY26!A1:C13'). */
  query?: string;
  /** An ISO 8601 date or date-time. */
  retrieved?: string;
  /** A free string the source system gives the snapshot. */
  version?: string;
  /** The SHA-256 of the source file's bytes as retrieved, 64 lowercase hexadecimal digits. */
  sha256?: string;
  generator?: DataGenerator;
}

/** The six keys that say where a dataset or inline chart data came from, in the order the schema lists them. */
export const PROVENANCE_KEYS = ['datasource', 'query', 'retrieved', 'version', 'sha256', 'generator'] as const;

/** The id pattern of an entry of `datasources` (the `datasets` and `assets` id pattern). A string `datasource` that does not match it is a path or a URL, which the schema reports. */
export const DATA_SOURCE_ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

const record = (value: unknown): value is Record<string, any> => typeof value === 'object' && value !== null && !Array.isArray(value);
const segment = (key: string | number): string => String(key).replaceAll('~', '~0').replaceAll('/', '~1');
const at = (base: string, ...keys: (string | number)[]): string => `${base}${keys.map(key => `/${segment(key)}`).join('')}`;

/** The root `datasources` map of a document, or an empty one. */
export function dataSourcesOf(document: unknown): Record<string, unknown> {
  return record(document) && record(document.datasources) ? document.datasources : {};
}

/** A copy of the provenance keys a dataset or inline chart data holds (only those that are present). */
export function dataProvenance(value: unknown): DataProvenance {
  const out: Record<string, unknown> = {};
  if (record(value)) for (const key of PROVENANCE_KEYS) if (value[key] !== undefined) out[key] = structuredClone(value[key]);
  return out as DataProvenance;
}

/** The data source a `datasource` value names: the inline object, or the entry of `datasources` a string id names; undefined when there is none. */
export function resolveDataSource(datasource: unknown, document: unknown): DataSource | undefined {
  if (record(datasource)) return datasource as DataSource;
  if (typeof datasource !== 'string') return undefined;
  const sources = dataSourcesOf(document);
  const entry = Object.hasOwn(sources, datasource) ? sources[datasource] : undefined;
  return record(entry) ? (entry as DataSource) : undefined;
}

// ---------------------------------------------------------------------------------------------------------------
// Diagnostics

/** The `datasource-unknown` error of one dataset or one inline chart data object at `path`: a string `datasource` that names no entry of the document's `datasources` (only when a document is given, and only for a string that is an id: another string is the schema's finding). */
export function unknownDataSourceDiagnostics(node: unknown, path: string, document: unknown): DataDiagnostic[] {
  if (!record(node) || typeof node.datasource !== 'string' || document === undefined || !DATA_SOURCE_ID.test(node.datasource) || Object.hasOwn(dataSourcesOf(document), node.datasource)) return [];
  return [{ code: 'datasource-unknown', severity: 'error', path: at(path, 'datasource'), message: `unknown data source '${node.datasource}'; add it to the top-level datasources map, or write the data source inline as an object such as { "src": "./data.csv" }` }];
}
