/**
 * `@openpresentation/opf-editor/exact-source`: the writer the editor uses to put a changed document back into the JSON text it was read from,
 * keeping the author's bytes. Only the tokens of values that changed are rewritten; indentation, key order, escapes (`"\/"`, `"é"`), line
 * endings and every unrelated value stay byte for byte. A memory of the texts it has seen brings an authored spelling back when a value returns
 * (Escape, Undo, Redo) instead of re-serializing it.
 */

/** Texts longer than this many characters are not remembered (edits still work; a returning value is then written normally). */
export declare const MAX_EXACT_SOURCE_LENGTH: number;

/** The memory of exact source texts, keyed by the parsed value. Give each document (each editor, each file) its own. */
export interface SourceMemory {
  /** True when the last source given was too long to remember (see `MAX_EXACT_SOURCE_LENGTH`): tell the author a returning value may be respelled. */
  limited: boolean;
  readonly limit: number;
  readonly maxBytes: number;
}

/** A new memory: at most `limit` texts (default 64) and `maxBytes` characters in total (default 8,000,000), the oldest evicted first. */
export declare function createSourceMemory(limit?: number, maxBytes?: number): SourceMemory;

/**
 * Write `document` into `source` (JSON text) and return the new text. Only the affected values change; everything else is kept byte for byte.
 * Throws when `source` is not valid JSON. The result always parses to `document`: when an edit in place cannot achieve that (the source
 * repeats a key, say), the whole document is written as JSON indented like `source`. Without `memory` a memory shared by the module is used.
 */
export declare function updateJsonSource(source: string, document: unknown, memory?: SourceMemory): string;

/** The first object key that JSON text repeats (which `JSON.parse` silently collapses to the last), as `{ key, path }`; null when there is none. */
export declare function findDuplicateKey(source: string): { key: string; path: (string | number)[] } | null;
