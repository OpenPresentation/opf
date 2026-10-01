export declare class GridTextError extends Error {
  readonly code: "unclosed-quote" | "invalid-delimiter" | "invalid-text";
  readonly details: Record<string, unknown>;
}
export type GridDelimiter = "\t" | ";" | ",";
/** The delimiter of pasted text: a tab when there is one, else the semicolon or comma that splits every line the same way, else a tab. */
export declare function detectDelimiter(text: string): GridDelimiter;
/** Read TSV or CSV text (RFC 4180 quoting) into rows of text. Rows keep their own lengths. Throws `GridTextError`. */
export declare function parseDelimited(text: string, options?: { delimiter?: GridDelimiter }): { rows: string[][]; delimiter: GridDelimiter };
/** Pad ragged rows with empty text to the longest row. */
export declare function rectangular(rows: string[][]): { rows: string[][]; width: number };
/** Write rows as TSV (default) or another delimiter, quoting fields that hold the delimiter, a quote or a line break. */
export declare function toDelimited(rows: ReadonlyArray<ReadonlyArray<unknown>>, options?: { delimiter?: string; newline?: string }): string;

export interface NumberFormat {
  readonly decimal: "." | ",";
  /** "1,234.56" or "1.234,56" */
  readonly label: string;
}
export declare const NUMBER_FORMATS: Readonly<Record<"." | ",", NumberFormat>>;
/** "." or "," as given, or "auto" for the locale's decimal separator (a point when the locale is unknown). */
export declare function resolveNumberFormat(format?: "auto" | "." | ",", locale?: string): NumberFormat;
export type GridNumberResult = { empty: true; value?: undefined; error?: undefined } | { value: number; empty?: undefined; error?: undefined } | { error: string; empty?: undefined; value?: undefined };
/**
 * Read one number in a number format. Blank text is `{ empty: true }`, never 0. Accepts a sign, accounting parentheses, one currency symbol,
 * grouping in threes, the format's decimal separator and an exponent; refuses percent signs, the other format's separators and letters
 * with a reason in `error`.
 */
export declare function parseGridNumber(input: unknown, options?: { decimal?: "." | "," }): GridNumberResult;
/** A number as the shortest text that reads back the same, with the format's decimal separator and no grouping. */
export declare function formatGridNumber(value: number, options?: { decimal?: "." | "," }): string;
/** Whether `text` is how JavaScript writes the number it reads as, so storing it as a number changes nothing visible. */
export declare function isCanonicalNumber(text: string): boolean;
