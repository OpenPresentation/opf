import path from "node:path";
import { format } from "@openpresentation/opf/format";
import { OPFMarkdownError } from "@openpresentation/opf/markdown";
import { OPFYamlError } from "@openpresentation/opf/yaml";
import type { CliContext } from "./context.js";
import { type DeckFormat, fenceWarning, formatNamed, outputFormatOf, serialize } from "./deck.js";
import { samePath } from "./io.js";

/**
 * `opf format <file|->...`: canonical key order and layout. JSON gets the formatter's layout; YAML gets the canonical YAML
 * (schema key order, two-space block style) and loses its comments; Markdown gets the canonical Markdown of the dialect
 * (`toMarkdown(fromMarkdown(text))`). `--format` converts between the three.
 */
export async function formatCommand(args: string[], cli: CliContext): Promise<void> {
  const { positional, options } = cli.parse(args, ["check", "in-place", "output", "force", "indent", "eol", "format"]);
  if (!positional.length) throw cli.fail("format needs at least one file (or - for stdin).");
  const modes = [options.check, options["in-place"], options.output !== undefined].filter(Boolean).length;
  if (modes > 1) throw cli.fail("Use only one of --check, --in-place and --output.");
  if (positional.includes("-") && (positional.length > 1 || options["in-place"])) throw cli.fail("stdin can be formatted alone, and not in place.");
  if (positional.length > 1 && !options.check && !options["in-place"]) throw cli.fail("Several files need --check or --in-place.");
  if (options.force && options.output === undefined) throw cli.fail("--force applies to --output.");
  let indent: number | undefined;
  if (options.indent !== undefined) {
    if (!/^[0-8]$/.test(String(options.indent))) throw cli.fail("--indent needs an integer from 0 to 8.");
    indent = Number(options.indent);
  }
  const eol = options.eol === undefined ? "lf" : String(options.eol);
  if (!["lf", "crlf", "preserve"].includes(eol)) throw cli.fail("--eol must be lf, crlf or preserve.");
  if (options.format !== undefined && !formatNamed(options.format)) throw cli.fail("--format takes json, yaml or markdown (md).");
  const results: Array<{ file: string; text: string; raw: string; changed: boolean; format: DeckFormat }> = [];
  for (const file of positional) {
    const source = await cli.readDeck(file, !options.check);
    // The written format: --format, else the --output name, else the format of the file being formatted.
    const outFormat = outputFormatOf(options.output === undefined ? "-" : String(options.output), options.format, source);
    const lineEnding = eol === "preserve" ? (source.raw.includes("\r\n") ? "crlf" : "lf") : (eol as "lf" | "crlf");
    let text: string;
    if (outFormat === "json") text = format(source.value, { indent, eol: lineEnding });
    else {
      if (indent !== undefined) throw cli.fail("--indent applies to JSON; YAML and Markdown are written in one layout.");
      try {
        text = serialize(source.value, outFormat, { modeline: source.yaml?.modeline });
      } catch (error) {
        if (error instanceof OPFYamlError || error instanceof OPFMarkdownError) throw cli.fail(`Cannot format ${file === "-" ? "stdin" : file} as ${outFormat === "yaml" ? "YAML" : "Markdown"}: ${error.message}`, 1, error.details);
        throw error;
      }
      if (lineEnding === "crlf") text = text.replaceAll("\n", "\r\n");
      const fences = outFormat === "markdown" && !options.check ? fenceWarning(text, source, file === "-" ? "the output" : file) : undefined;
      if (fences) process.stderr.write(fences);
    }
    results.push({ file, text, raw: source.raw, changed: text !== source.raw, format: outFormat });
  }
  const changed = results.filter(result => result.changed).map(result => result.file);
  if (options.check) {
    cli.print({ checked: results.length, formatted: results.length - changed.length, unformatted: changed });
    if (changed.length) process.exitCode = 1;
    return;
  }
  if (options["in-place"]) {
    for (const result of results) if (result.changed) await cli.saveText(result.file, result.text, true, { file: result.file, raw: result.raw });
    cli.print({ checked: results.length, rewritten: changed, unchanged: results.filter(result => !result.changed).map(result => result.file) });
    return;
  }
  const only = results[0]!;
  const output = String(options.output ?? "-");
  if (output === "-") { process.stdout.write(only.text); return; }
  const sameFile = only.file !== "-" && samePath(only.file, output);
  await cli.saveText(output, only.text, !!options.force || sameFile, sameFile ? { file: only.file, raw: only.raw } : undefined);
  cli.print({ output: path.resolve(output), changed: only.changed, sha256: cli.hash(only.text) });
}
