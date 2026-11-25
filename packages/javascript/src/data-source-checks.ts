// FR-04: the checks `validate` makes on data sources: a credential in a `src` and data older than its data source's `refreshEvery`.
// They live apart from data-sources.ts so the browser-safe `data` entry (chart and table data) does not carry them.
// Core has no clock, so staleness is checked as of a date the caller passes.
//
// Browser-safe and synchronous: no file access, no network, no system clock.
import type { DataDiagnostic } from './chart-data.js';
import { dataSourcesOf, resolveDataSource } from './data-sources.js';

const record = (value: unknown): value is Record<string, any> => typeof value === 'object' && value !== null && !Array.isArray(value);
const segment = (key: string | number): string => String(key).replaceAll('~', '~0').replaceAll('/', '~1');
const at = (base: string, ...keys: (string | number)[]): string => `${base}${keys.map(key => `/${segment(key)}`).join('')}`;

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
 * The checks of one dataset or one inline chart data object at `path`: an inline data source with a credential in its `src`
 * (warning `datasource-credentials`), and a `retrieved` older than the data source's `refreshEvery` as of `options.asOf` (warning
 * `dataset-stale`).
 */
export function provenanceDiagnostics(node: unknown, path: string, document: unknown, options: DataSourceCheckOptions = {}): DataDiagnostic[] {
  const diagnostics: DataDiagnostic[] = [];
  if (!record(node)) return diagnostics;
  const { datasource } = node;
  if (record(datasource)) credentialDiagnostics(datasource, at(path, 'datasource'), diagnostics);
  if (options.asOf !== undefined && typeof node.retrieved === 'string') {
    const source = resolveDataSource(datasource, document);
    const asOf = parseInstant(options.asOf), retrieved = parseInstant(node.retrieved);
    const due = source?.refreshEvery !== undefined && retrieved !== undefined ? addDuration(retrieved, source.refreshEvery) : undefined;
    if (asOf !== undefined && due !== undefined && due < asOf) {
      diagnostics.push({ code: 'dataset-stale', severity: 'warning', path: at(path, 'retrieved'), message: `retrieved ${node.retrieved}, and its data source refreshes every ${source!.refreshEvery}, so as of ${options.asOf} the data is stale; take it from the data source again and update retrieved` });
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
