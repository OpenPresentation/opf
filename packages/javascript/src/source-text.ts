import type { FindingLocation } from "./generated/types/finding.js";

/**
 * A range of source text in the `Finding.location` convention: UTF-16 offset and length, 1-based line and column (a line break is
 * `\r\n`, `\r` or `\n`). `exact: false` marks a range that is the nearest ancestor of a node the text does not have.
 */
export type TextRange = FindingLocation & { exact?: boolean };

/** A replacement of `length` characters at `offset` by `insert`, in the offsets of the text it applies to. */
export interface TextEdit {
  offset: number;
  length: number;
  insert: string;
}

export type SourceFormat = "json" | "yaml" | "md" | "markdown";

/** Line starts of a text, and the `{ offset, length, line, column }` of any range in it. */
export function createLocator(text: string): (offset: number, length: number) => TextRange {
  const lineStarts = [0];
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    if (code === 13) {
      if (text.charCodeAt(index + 1) === 10) index++;
      lineStarts.push(index + 1);
    } else if (code === 10) lineStarts.push(index + 1);
  }
  return (offset, length) => {
    let low = 0;
    let high = lineStarts.length;
    while (low + 1 < high) {
      const middle = (low + high) >> 1;
      if ((lineStarts[middle] ?? 0) <= offset) low = middle;
      else high = middle;
    }
    return { offset, length, line: low + 1, column: offset - (lineStarts[low] ?? 0) + 1 };
  };
}

/** Apply edits (offsets in the original text, non-overlapping) and return the new text. */
export function applyTextEdits(text: string, edits: readonly TextEdit[]): string {
  const ordered = edits.map((edit, index) => ({ edit, index })).sort((a, b) => a.edit.offset - b.edit.offset || a.index - b.index);
  let result = "";
  let cursor = 0;
  for (const { edit } of ordered) {
    if (edit.offset < cursor) throw new RangeError("Text edits overlap.");
    result += text.slice(cursor, edit.offset) + edit.insert;
    cursor = edit.offset + edit.length;
  }
  return result + text.slice(cursor);
}

/**
 * A function of one text, remembering its last answers (the newest `size`, compared by value): an editor asks several questions of one text
 * (the range of each of its findings, the path under the caret) and the parse behind each answer is the same. The answers must not be
 * changed by their callers.
 */
export function rememberByText<T>(read: (text: string) => T, size = 2): (text: string) => T {
  const kept: { text: string; value: T }[] = [];
  return (text) => {
    const at = kept.findIndex((entry) => entry.text === text);
    if (at >= 0) {
      const [entry] = kept.splice(at, 1);
      kept.unshift(entry as { text: string; value: T });
      return (entry as { text: string; value: T }).value;
    }
    const value = read(text);
    kept.unshift({ text, value });
    if (kept.length > size) kept.pop();
    return value;
  };
}
