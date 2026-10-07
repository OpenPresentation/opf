import { diff, formatDiffReport } from "@openpresentation/opf/diff";
import { ratio, type CliContext } from "./context.js";

/** `opf diff <a|-> <b|->`: what changed between two OPF documents. */
export async function diffCommand(args: string[], cli: CliContext): Promise<void> {
  const { positional, options } = cli.parse(args, ["format", "exit-code", "threshold"]);
  cli.arity(positional, 2);
  const [fileA, fileB] = positional as [string, string];
  if (fileA === "-" && fileB === "-") throw cli.fail("stdin can supply only one input.");
  const format = String(options.format ?? "text");
  if (!["text", "json", "patch"].includes(format)) throw cli.fail("--format must be text, json or patch.");
  const a = await cli.readDeck(fileA), b = await cli.readDeck(fileB);
  const result = diff(a.value, b.value, { threshold: ratio(cli, options.threshold) });
  if (format === "patch") cli.print(result.patch);
  else if (format === "json") cli.print({ equal: result.equal, summary: result.summary, slides: result.slides, changes: result.changes, patch: result.patch });
  else process.stdout.write(formatDiffReport(result));
  if (options["exit-code"] && !result.equal) process.exitCode = 1;
}
