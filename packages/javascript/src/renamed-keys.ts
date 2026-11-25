/**
 * OPF 0.37: the keys and values of 0.36 that were renamed for consistency, in one table that validation and `fix` both read. Before 1.0 OPF
 * keeps no alias, so a deck that still writes the old name fails its schema; validation says what the name became and offers the safe
 * fix that renames it (`rename-key`, `rename-value`). Nothing else in core accepts an old name. The PowerPoint importer passes the records
 * it restores through the same table (`renameRecordKeys`), so files written before 0.37 still import.
 *
 * Internal module (`renamedKeyRepair` in schema-fixes.ts, the unknown-key text in check-document.ts); `renameRecordKeys` is exported for
 * the importer.
 */
import { isRecord } from "./finding-text-util.js";

/** One renamed key: where it applies is decided by the segments of its path (several old names are also valid keys elsewhere). */
export interface KeyRename {
  /** The 0.36 name. */
  from: string;
  /** The 0.37 name. */
  to: string;
  /** Whether a key of this name at `segments` (the path of the key itself) is the renamed one. Absent: wherever the name appears. */
  at?: (segments: readonly string[]) => boolean;
  /** One line of what else changed with the key, appended to the finding's help. */
  note?: string;
}

/** The ten renames of OPF 0.37 (eight keys, listed in the migration note). */
export const KEY_RENAMES: readonly KeyRename[] = Object.freeze([
  { from: "languageFamily", to: "scriptGroup", note: 'Its values are "latin", "eastAsian" and "complexScript"; "ea" and "cs" are no longer accepted.' },
  { from: "verticalAlign", to: "anchor" },
  { from: "organizationId", to: "organization" },
  { from: "minFontSize", to: "minFontSizePx", note: "The numbers are unchanged: reference pixels." },
  { from: "maxFontSize", to: "maxFontSizePx", note: "The numbers are unchanged: reference pixels." },
  { from: "url", to: "link", at: (segments) => segments.at(-3) === "references", note: 'A reference link is an http or https address, a "mailto:" or a "tel:" link.' },
  { from: "tone", to: "appearance", at: (segments) => segments.at(-2) === "background" },
  { from: "line", to: "lineSeries", at: (segments) => segments.at(-2) === "chart" },
]);

/** The renamed key a key at `segments` (its own path) is, or `undefined`. */
export function renamedKeyAt(segments: readonly string[]): KeyRename | undefined {
  const name = segments.at(-1);
  return name === undefined ? undefined : KEY_RENAMES.find((entry) => entry.from === name && (entry.at === undefined || entry.at(segments)));
}

/** Subtrees that hold the author's own keys, never walked by `renameRecordKeys`: extension data and the rows of a dataset. */
const AUTHORED_KEYS: ReadonlySet<string> = new Set(["extensions", "rows", "datasets"]);

/** The 0.36 short values of a font scheme's `scriptGroup` and what they are written since 0.37. */
export const RENAMED_SCRIPT_GROUP_VALUES: Readonly<Record<string, string>> = Object.freeze({ ea: "eastAsian", cs: "complexScript" });

/** The new spelling of a font scheme's old short `scriptGroup` value, or `undefined` for any other value. */
export function renamedScriptGroupValue(value: unknown): string | undefined {
  return typeof value === "string" && Object.hasOwn(RENAMED_SCRIPT_GROUP_VALUES, value) ? RENAMED_SCRIPT_GROUP_VALUES[value] : undefined;
}

/** The finding text of a renamed key (the validator's message in place of the generic unknown-key text). */
export const renamedKeyMessage = (entry: KeyRename, bothPresent: boolean): string => `"${entry.from}" was renamed "${entry.to}" in OPF 0.37${bothPresent ? `, and this object has both: remove one` : ""}.`;

/** The finding text of an old short value of `scriptGroup`. */
export const renamedValueMessage = (from: string, to: string): string => `"${from}" is written "${to}" since OPF 0.37.`;

/** Looks like a host and path without its scheme (`acme.com/report`), so `Add https://` is a sensible offer. */
export const LOOKS_LIKE_HOST_AND_PATH = /^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+(:\d+)?([/?#]\S*)?$/;

/**
 * Applies the safe rewrites of the table to a record the importer restored: every renamed key of a record `value` (a whole record or any
 * part of one) is renamed in place of the old one unless the new key is already there, and a font scheme's short `scriptGroup` values
 * are written long. Returns the same object when nothing needs rewriting (nothing is copied), else a rewritten copy; the input is never
 * mutated. `segments` is the path of `value` inside its record, for the keys whose rename depends on where they sit.
 */
export function renameRecordKeys<T>(value: T, segments: readonly string[] = []): T {
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((entry, index) => {
      const rewritten = renameRecordKeys(entry, [...segments, String(index)]);
      if (rewritten !== entry) changed = true;
      return rewritten;
    });
    return (changed ? next : value) as T;
  }
  if (!isRecord(value)) return value;
  let changed = false;
  const entries: [string, unknown][] = [];
  for (const [key, child] of Object.entries(value)) {
    const path = [...segments, key];
    const rename = renamedKeyAt(path);
    const name = rename && !Object.hasOwn(value, rename.to) ? rename.to : key;
    let rewritten = AUTHORED_KEYS.has(key) ? child : renameRecordKeys(child, path);
    if (name === "scriptGroup") {
      const long = renamedScriptGroupValue(rewritten);
      if (long !== undefined) rewritten = long;
    }
    if (name !== key || rewritten !== child) changed = true;
    entries.push([name, rewritten]);
  }
  return (changed ? Object.fromEntries(entries) : value) as T;
}
