// Shared CLI plumbing that command modules receive from index.ts, so a command
// can live in its own file without importing the entry point.
export type CliOptions = Record<string, string | boolean>;
export interface CliSource { raw: string; value: unknown }
export interface CliContext {
  parse(args: string[], allowed: string[]): { positional: string[]; options: CliOptions };
  arity(args: string[], min: number, max?: number): void;
  readJson(file: string): Promise<CliSource>;
  stdin(): Promise<string>;
  /** Validate and write a document (stdout for `-`/dry-run, a file otherwise) and print the JSON report. */
  emit(document: unknown, output: string, options: CliOptions, original?: { file: string; raw: string }, extra?: object): Promise<void>;
  /** Atomically write text to a file; `overwrite` must be true to replace an existing file. */
  saveText(file: string, text: string, overwrite: boolean, original?: { file: string; raw: string }): Promise<void>;
  print(value: unknown): void;
  hash(text: string): string;
  json(value: unknown): string;
  /** An error the CLI reports as JSON on stderr. Code 1 = invalid/conflict, 2 = usage/I-O. */
  fail(message: string, code?: number, details?: unknown): Error;
}

/** Parse an optional 0..1 option value. */
export function ratio(cli: CliContext, value: string | boolean | undefined, name = "--threshold"): number | undefined {
  if (value === undefined) return undefined;
  const number = Number(value);
  if (typeof value !== "string" || value.trim() === "" || !Number.isFinite(number) || number < 0 || number > 1) throw cli.fail(`${name} needs a number from 0 to 1.`);
  return number;
}
