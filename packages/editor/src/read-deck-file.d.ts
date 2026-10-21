import type { Catalog, Finding } from "@openpresentation/opf";

/** The `accept` value for a file input that opens a deck: `".json,.opf,.yaml,.yml,.md"`. */
export declare const DECK_FILE_ACCEPT: string;

/** The format a deck file was read as: `json` (canonical), `yaml` (`.opf.yaml`) or `md` (`.opf.md`). */
export type DeckFileFormat = "json" | "yaml" | "md";

/** A file, or a name and its text. A `File` or any object with `name` and `text()` works; `size` is checked against the 20 MB limit when present. */
export type DeckFileInput = { name: string; size?: number; text(): Promise<string> } | { name: string; text: string };

export interface ReadDeckFileOptions {
  /** The host's catalogs, for the references check of the YAML and Markdown conversion. Nothing is fetched. */
  catalogs?: readonly Catalog[];
}

/** A conversion finding. Core's `Finding`: `path` is a JSON Pointer into the deck when there is one, `location` the line and column in the text. */
export type DeckFileFinding = Finding & { location?: { offset: number; length: number; line: number; column: number } };

export interface DeckFile {
  /** The deck. Not validated for JSON; for YAML and Markdown the OPF errors are in `findings`. */
  document: any;
  /** The format that read it, which can differ from the one the extension suggests (see `readDeckFile`). */
  format: DeckFileFormat;
  /** The file name without `.opf.json`, `.opf.yaml`, `.opf.md` or its plain extension (`deck` when nothing is left). */
  name: string;
  /** The conversion findings of YAML and Markdown, in source order. Empty for JSON. */
  findings: DeckFileFinding[];
}

/**
 * Why a file could not be read:
 * `unreadable` (not a file, or reading it failed), `file-too-large` (over 20 MB), `empty-file`, `unsupported-file` (a binary file such as .pptx),
 * `invalid-json` (not JSON, YAML or Markdown with front matter), `invalid-yaml`, `invalid-markdown` (syntax errors, in `findings`) and
 * `not-a-deck` (JSON that has no `slides` list).
 */
export type DeckFileErrorCode = "unreadable" | "file-too-large" | "empty-file" | "unsupported-file" | "invalid-json" | "invalid-yaml" | "invalid-markdown" | "not-a-deck";

export declare class DeckFileError extends Error {
  readonly name: "DeckFileError";
  readonly code: DeckFileErrorCode;
  /** The format that was tried first (from the extension). */
  readonly format?: DeckFileFormat;
  readonly fileName?: string;
  /** The parser's findings for `invalid-yaml` and `invalid-markdown`. */
  readonly findings: DeckFileFinding[];
  constructor(code: DeckFileErrorCode, message: string, context?: { format?: DeckFileFormat; name?: string; findings?: DeckFileFinding[]; cause?: unknown });
}

/** The file name without its directory and its `.opf.json`, `.opf.yaml`, `.opf.md` or plain extension. */
export declare function deckFileName(fileName: string): string;
/** The format the extension suggests: `.yaml`/`.yml` YAML, `.md` Markdown, anything else JSON. */
export declare function deckFileFormat(fileName: string): DeckFileFormat;

/**
 * Read a deck file in any OPF source format. The extension picks the format; text that is not JSON falls back to YAML, and to Markdown when it
 * starts with front matter. YAML and Markdown go through core's `fromYaml` and `fromMarkdown` (loaded on first use). Throws `DeckFileError`.
 */
export declare function readDeckFile(file: DeckFileInput | File, options?: ReadDeckFileOptions): Promise<DeckFile>;
