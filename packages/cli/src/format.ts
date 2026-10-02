import path from "node:path";
import { formatPresentation } from "@openpresentation/opf/format";
import type { CliContext } from "./context.js";

/** `opf format <file|->...`: canonical key order and layout. */
export async function formatCommand(args: string[], cli: CliContext): Promise<void> {
  const { positional, options } = cli.parse(args, ["check", "in-place", "output", "force", "indent", "eol"]);
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
  const results: Array<{ file: string; text: string; raw: string; changed: boolean }> = [];
  for (const file of positional) {
    const source = await cli.readJson(file);
    const text = formatPresentation(source.value, { indent, eol: eol === "preserve" ? (source.raw.includes("\r\n") ? "crlf" : "lf") : (eol as "lf" | "crlf") });
    results.push({ file, text, raw: source.raw, changed: text !== source.raw });
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
  const sameFile = only.file !== "-" && path.resolve(only.file) === path.resolve(output);
  await cli.saveText(output, only.text, !!options.force || sameFile, sameFile ? { file: only.file, raw: only.raw } : undefined);
  cli.print({ output: path.resolve(output), changed: only.changed, sha256: cli.hash(only.text) });
}
