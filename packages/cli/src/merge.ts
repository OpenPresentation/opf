import { merge } from "@openpresentation/opf/diff";
import { ratio, type CliContext } from "./context.js";
import { samePath } from "./io.js";

/** `opf merge <base> <ours> <theirs>`: three-way merge with conflict reporting. */
export async function mergeCommand(args: string[], cli: CliContext): Promise<void> {
  const { positional, options } = cli.parse(args, ["output", "in-place", "force", "prefer", "report", "dry-run", "threshold", "format", "fail-on"]);
  cli.arity(positional, 3);
  const [baseFile, oursFile, theirsFile] = positional as [string, string, string];
  if (positional.filter(file => file === "-").length > 1) throw cli.fail("stdin can supply only one input.");
  if (options["in-place"] && (oursFile === "-" || options.output !== undefined || options.force)) throw cli.fail("--in-place rewrites the ours file; it cannot combine with --output, --force or stdin for ours.");
  if (options.prefer !== undefined && options.prefer !== "ours" && options.prefer !== "theirs") throw cli.fail("--prefer must be ours or theirs.");
  const output = options["in-place"] ? oursFile : String(options.output ?? "-");
  const report = options.report === undefined ? undefined : String(options.report);
  if (report !== undefined && (report === "-" || (output !== "-" && samePath(report, output)))) throw cli.fail("--report must be a file different from the merged output.");

  const base = await cli.readDeck(baseFile, true), ours = await cli.readDeck(oursFile, true), theirs = await cli.readDeck(theirsFile, true);
  const result = merge(base.value, ours.value, theirs.value, { prefer: options.prefer as "ours" | "theirs" | undefined, threshold: ratio(cli, options.threshold) });
  const summary = { clean: result.clean, conflicts: result.conflicts, applied: result.applied, ...(result.clean ? {} : { resolvedWith: options.prefer ?? null }) };
  // The report is a scratch artifact, so it may replace an earlier one.
  if (report !== undefined) await cli.saveText(report, cli.json(summary), true);

  if (!result.clean && options.prefer === undefined) {
    // Never write a document that silently took one side: report and stop.
    const count = result.conflicts.length;
    process.stderr.write(cli.json({ error: `Merge has ${count} conflict${count === 1 ? "" : "s"}. Resolve them, or pass --prefer ours|theirs to take a side (conflicts are still reported).`, merge: summary }));
    process.exitCode = 1;
    return;
  }
  const sameFile = oursFile !== "-" && output !== "-" && samePath(oursFile, output);
  await cli.emit(result.merged, output, options, sameFile ? { file: oursFile, raw: ours.raw } : undefined, { merge: summary }, ours);
}
