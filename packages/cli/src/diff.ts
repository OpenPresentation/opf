import { diffPresentations, formatDiffReport } from "@openpresentation/opf/diff";
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
  const diff = diffPresentations(a.value, b.value, { threshold: ratio(cli, options.threshold) });
  if (format === "patch") cli.print(diff.patch);
  else if (format === "json") cli.print({ equal: diff.equal, summary: diff.summary, slides: diff.slides, changes: diff.changes, patch: diff.patch });
  else process.stdout.write(formatDiffReport(diff));
  if (options["exit-code"] && !diff.equal) process.exitCode = 1;
}
