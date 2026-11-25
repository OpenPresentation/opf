// FR-04: data sources and where a dataset came from. A root `datasources` map describes each place data lives once; a dataset or
// inline chart data names one with `datasource` and records what it took (`query`), when (`retrieved`), which snapshot (`version`),
// the hash of the file as retrieved (`sha256`) and who made it (`generator`). Engines never read, fetch or refresh a data source:
// this module only checks what the document says. Core has no clock, so staleness is checked as of a date the caller passes.
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
  refresh?: string;
  extensions?: Record<string, unknown>;
}
/** Who produced the data: a person or a model, and which. */
export interface DataGenerator { kind: 'human' | 'model'; name: string }
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
// Dates and durations

const DURATION = /^P(?=\d|T\d)(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?=\d)(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/;
const INSTANT = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/;

/** The milliseconds since the epoch of an ISO 8601 date or date-time (a date is midnight UTC, a date-time without an offset is UTC); undefined when the text is neither. */
export function parseInstant(text: unknown): number | undefined {
  if (typeof text !== 'string') return undefined;
  const match = INSTANT.exec(text.trim());
  if (!match) return undefined;
  const [, year, month, day, hour = '0', minute = '0', second = '0', zone] = match;
  const parts = [Number(year), Number(month), Number(day), Number(hour), Number(minute), Number(second)] as const;
  const ms = Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5]);
  const check = new Date(ms);
  // Date.UTC rolls an impossible date over (February 30); a date that is not the one written is not a date.
  if (check.getUTCFullYear() !== parts[0] || check.getUTCMonth() !== parts[1] - 1 || check.getUTCDate() !== parts[2] || parts[3] > 23 || parts[4] > 59 || parts[5] > 59) return undefined;
  if (zone === undefined || zone === 'Z') return ms;
  const sign = zone[0] === '-' ? -1 : 1;
  return ms - sign * (Number(zone.slice(1, 3)) * 60 + Number(zone.slice(4, 6))) * 60_000;
}

/** The instant an ISO 8601 duration after `start` (months and years by the calendar, in UTC, a day past the end of the month clamped to its last day); undefined for text that is no duration. */
export function addDuration(start: number, duration: unknown): number | undefined {
  if (typeof duration !== 'string') return undefined;
  const match = DURATION.exec(duration.trim());
  if (!match) return undefined;
  const [, years = '0', months = '0', weeks = '0', days = '0', hours = '0', minutes = '0', seconds = '0'] = match;
  const date = new Date(start);
  const total = date.getUTCFullYear() * 12 + date.getUTCMonth() + Number(years) * 12 + Number(months);
  const year = Math.floor(total / 12), month = total % 12;
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const moved = Date.UTC(year, month, Math.min(date.getUTCDate(), last), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds(), date.getUTCMilliseconds());
  return moved + ((Number(weeks) * 7 + Number(days)) * 24 * 60 * 60 + Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds)) * 1000;
}

// ---------------------------------------------------------------------------------------------------------------
// Credentials

const SECRET_NAME_TOKENS = new Set(['key', 'apikey', 'token', 'secret', 'password', 'passwd', 'pwd', 'signature', 'sig', 'auth', 'authorization', 'credential', 'credentials', 'bearer', 'sas']);

/** The words of a query parameter name: split on anything that is not a letter or digit and on camelCase boundaries, lowercased. */
function nameTokens(name: string): string[] {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/[^A-Za-z0-9]+/).filter(Boolean).map(token => token.toLowerCase());
}

/**
 * Why a data source `src` looks like it holds a credential, or undefined: a URL with a password in its user information
 * (`https://user:secret@host`), or a query parameter named like a key or a token (`?api_key=...`, `?access_token=...`). The reason never
 * repeats the secret. Paths and `asset:` references are never credentials.
 */
export function credentialInSrc(src: unknown): string | undefined {
  if (typeof src !== 'string') return undefined;
  const authority = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]*)/i.exec(src.trim());
  if (!authority) return undefined;
  const host = authority[1]!, userEnd = host.lastIndexOf('@');
  if (userEnd >= 0) {
    const separator = host.indexOf(':');
    if (separator >= 0 && separator < userEnd && host.slice(separator + 1, userEnd).length > 0) return 'a user and password';
  }
  const query = /\?([^#]*)/.exec(src)?.[1];
  if (query) {
    for (const pair of query.split('&')) {
      const raw = pair.split('=')[0]!;
      let name = raw;
      try { name = decodeURIComponent(raw.replaceAll('+', ' ')); } catch { /* keep the raw name */ }
      if (name && nameTokens(name).some(token => SECRET_NAME_TOKENS.has(token))) return `a query parameter named ${JSON.stringify(name)}`;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------------------------------------------
// Diagnostics

export interface DataSourceCheckOptions {
  /** The date the check is made as of (an ISO 8601 date or date-time). Without one no dataset is reported stale: core has no clock. */
  asOf?: string;
}

function credentialDiagnostics(source: unknown, path: string, diagnostics: DataDiagnostic[]): void {
  if (!record(source)) return;
  const reason = credentialInSrc(source.src);
  if (reason) diagnostics.push({ code: 'datasource-credentials', severity: 'warning', path: at(path, 'src'), message: `the data source's src carries ${reason}; a data source never holds credentials, so remove it and keep the secret in the host's own store` });
}

/**
 * The diagnostics of one dataset or one inline chart data object at `path`: a string `datasource` that names no entry of the document's
 * `datasources` (error `datasource-unknown`; only when a document is given), an inline data source with a credential in its `src`
 * (warning `datasource-credentials`), and a `retrieved` older than the data source's `refresh` as of `options.asOf` (warning
 * `dataset-stale`).
 */
export function provenanceDiagnostics(node: unknown, path: string, document: unknown, options: DataSourceCheckOptions = {}): DataDiagnostic[] {
  const diagnostics: DataDiagnostic[] = [];
  if (!record(node)) return diagnostics;
  const { datasource } = node;
  if (typeof datasource === 'string') {
    if (document !== undefined && DATA_SOURCE_ID.test(datasource) && !Object.hasOwn(dataSourcesOf(document), datasource)) {
      diagnostics.push({ code: 'datasource-unknown', severity: 'error', path: at(path, 'datasource'), message: `unknown data source '${datasource}'; add it to the top-level datasources map, or write the data source inline as an object such as { "src": "./data.csv" }` });
    }
  } else if (record(datasource)) credentialDiagnostics(datasource, at(path, 'datasource'), diagnostics);
  if (options.asOf !== undefined && typeof node.retrieved === 'string') {
    const source = resolveDataSource(datasource, document);
    const asOf = parseInstant(options.asOf), retrieved = parseInstant(node.retrieved);
    const due = source?.refresh !== undefined && retrieved !== undefined ? addDuration(retrieved, source.refresh) : undefined;
    if (asOf !== undefined && due !== undefined && due < asOf) {
      diagnostics.push({ code: 'dataset-stale', severity: 'warning', path: at(path, 'retrieved'), message: `retrieved ${node.retrieved}, and its data source refreshes every ${source!.refresh}, so as of ${options.asOf} the data is stale; take it from the data source again and update retrieved` });
    }
  }
  return diagnostics;
}

/** The diagnostics of the root `datasources` map itself: a credential in an entry's `src`. */
export function dataSourceDiagnostics(document: unknown): DataDiagnostic[] {
  const diagnostics: DataDiagnostic[] = [];
  for (const [id, source] of Object.entries(dataSourcesOf(document))) credentialDiagnostics(source, at('/datasources', id), diagnostics);
  return diagnostics;
}
