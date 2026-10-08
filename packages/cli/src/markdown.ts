import { CLI_CATALOGS } from "./catalogs.js";
// `opf from-md` and `opf to-md`: Markdown in the OPF dialect to and from an OPF document (RR-30). Own file so the
// commands stay independent of the other CLI commands; the dialect itself lives in core, `@openpresentation/opf/markdown`.
import { readFile, writeFile, lstat, link, rename, unlink } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { fromMarkdown, toMarkdown, OPFMarkdownError } from "@openpresentation/opf/markdown";
import { OPFYamlError } from "@openpresentation/opf/yaml";
import { FAIL_ON_MESSAGE, parseFailOn, reaches } from "./check.js";
import { DeckReadError, decode, inputFormatOf, outputFormatOf, serialize } from "./deck.js";

export const MARKDOWN_USAGE = `  opf from-md <deck.md|-> [output.opf.json|output.opf.yaml|-] [--split <rules|headings>] [--title <text>]
              [--format <json|yaml>] [--force] [--fail-on <level>]
  opf to-md <deck.opf.json|-> [output.md|-] [--drop-unsupported] [--force] [--fail-on <level>]`;

export const MARKDOWN_HELP = `from-md converts Markdown in the OPF dialect (YAML front matter, '---' between slides,
'#' title, '##' subtitle, lists, quotes, tables, images, chart/metric/timeline fences,
'Note:' speaker notes, <!-- slide: ... --> options) to a validated OPF document. The output
defaults to stdout; errors carry line and column and exit 1. --split headings starts a new
slide at every '# ' heading (outlines). --title sets the deck name unless the front matter does.
--fail-on <error|warning|info> picks the lowest finding severity that fails (default error). The document is
written as YAML for an output ending .yaml/.yml or --format yaml.
to-md writes an OPF document as Markdown that from-md reads back unchanged. A part with no
Markdown syntax (a design, regions that are not blocks, a styled table cell) is embedded as
YAML in an opf-slide or opf-block fence, so nothing is lost; --drop-unsupported leaves it out
and lists it as loss. For to-md, embedded and dropped parts count as warnings, so --fail-on warning
fails when anything had to be embedded or dropped.`;

class MarkdownCommandError extends Error {
  constructor(
    message: string,
    readonly code = 2,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
const hash = (text: string) => createHash("sha256").update(text).digest("hex");

const flags: Record<string, { value: boolean; commands: string[] }> = {
  split: { value: true, commands: ["from-md"] },
  title: { value: true, commands: ["from-md"] },
  format: { value: true, commands: ["from-md"] },
  "drop-unsupported": { value: false, commands: ["to-md"] },
  force: { value: false, commands: ["from-md", "to-md"] },
  "fail-on": { value: true, commands: ["from-md", "to-md"] },
};

function parseArgs(command: string, args: string[]) {
  const positional: string[] = [];
  const options: Record<string, string | boolean> = Object.create(null);
  let literal = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "--" && !literal) {
      literal = true;
      continue;
    }
    if (!literal && arg.startsWith("--")) {
      const key = arg.slice(2);
      const spec = flags[key];
      if (!spec || !spec.commands.includes(command) || key in options) throw new MarkdownCommandError(`Unknown or duplicate option: ${arg}`);
      if (spec.value) {
        const value = args[++i];
        if (value === undefined || value.startsWith("--")) throw new MarkdownCommandError(`${arg} needs a value.`);
        options[key] = value;
      } else options[key] = true;
    } else positional.push(arg);
  }
  if (positional.length < 1 || positional.length > 2) throw new MarkdownCommandError("Incorrect arguments. Run opf --help.");
  return { positional, options };
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

const readText = async (file: string): Promise<string> => (file === "-" ? readStdin() : readFile(file, "utf8"));

/** Write a text file atomically; an existing file needs `overwrite` and a symlink is never replaced. */
async function saveText(file: string, text: string, overwrite: boolean): Promise<void> {
  const output = path.resolve(file);
  const temporary = path.join(path.dirname(output), `.${path.basename(output)}.${randomUUID()}.tmp`);
  let mode: number | undefined;
  try {
    const stat = await lstat(output);
    if (!overwrite) throw new MarkdownCommandError(`Output already exists: ${file}. Use --force.`, 1);
    if (!stat.isFile()) throw new MarkdownCommandError("Refusing to replace a symlink or non-regular file.", 1);
    mode = stat.mode;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  try {
    await writeFile(temporary, text, { flag: "wx", mode });
    if (overwrite) await rename(temporary, output);
    else {
      try {
        await link(temporary, output);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new MarkdownCommandError(`Output already exists: ${file}.`, 1);
        throw error;
      }
    }
  } finally {
    await unlink(temporary).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
}

async function fromMarkdownCommand(positional: string[], options: Record<string, string | boolean>): Promise<void> {
  const [input, output = "-"] = positional as [string, string?];
  const split = options.split ?? "rules";
  if (split !== "rules" && split !== "headings") throw new MarkdownCommandError("--split takes rules or headings.");
  const source = await readText(input);
  const result = fromMarkdown(source, { split, catalogs: CLI_CATALOGS, ...(options.title !== undefined ? { defaults: { name: String(options.title) } } : {}) });
  const failOn = parseFailOn(options["fail-on"]);
  if (!failOn) throw new MarkdownCommandError(FAIL_ON_MESSAGE);
  if (reaches(result.findings, failOn)) throw new MarkdownCommandError("Markdown conversion failed.", 1, { markdown: { sha256: hash(source), counts: result.counts, findings: result.findings } });
  let text: string;
  try {
    text = serialize(result.presentation, outputFormatOf(output, options.format));
  } catch (error) {
    if (error instanceof DeckReadError) throw new MarkdownCommandError(error.message);
    if (error instanceof OPFYamlError) throw new MarkdownCommandError(error.message, error.code === "invalid-document" ? 1 : 2, { validation: error.details });
    throw error;
  }
  const summary = { valid: true, sha256: hash(text), slides: result.presentation.slides.length, counts: result.counts, findings: result.findings };
  if (output === "-") {
    process.stdout.write(text);
    process.stderr.write(json(summary));
  } else {
    await saveText(output, text, !!options.force);
    process.stdout.write(json({ ...summary, output: path.resolve(output) }));
  }
}

async function toMarkdownCommand(positional: string[], options: Record<string, string | boolean>): Promise<void> {
  const [input, output = "-"] = positional as [string, string?];
  const raw = await readText(input);
  let document: unknown;
  try {
    document = decode(raw, input, inputFormatOf(input)).value;
  } catch (error) {
    if (error instanceof DeckReadError) throw new MarkdownCommandError(error.message, 2, error.details ? { yaml: error.details } : undefined);
    throw error;
  }
  const failOn = parseFailOn(options["fail-on"]);
  if (!failOn) throw new MarkdownCommandError(FAIL_ON_MESSAGE);
  const { markdown, report } = toMarkdown(document, { unsupported: options["drop-unsupported"] ? "drop" : "embed" });
  const summary = { sha256: hash(markdown), lossless: report.lossless, native: report.native, embedded: report.embedded, loss: report.loss };
  // A part the dialect has no syntax for is a warning here, not an error: the Markdown is complete, only less plain.
  if (!report.native && reaches([{ severity: "warning" }], failOn)) throw new MarkdownCommandError(`Some content has no Markdown syntax (--fail-on ${failOn}).`, 1, { markdown: summary });
  if (output === "-") {
    process.stdout.write(markdown);
    process.stderr.write(json(summary));
  } else {
    await saveText(output, markdown, !!options.force);
    process.stdout.write(json({ ...summary, output: path.resolve(output) }));
  }
}

/** Run `from-md` or `to-md`. Prints JSON reports, and sets the exit code (0 success, 1 invalid content or conflict, 2 usage or I/O). */
export async function markdownCommand(command: "from-md" | "to-md", args: string[]): Promise<void> {
  try {
    const { positional, options } = parseArgs(command, args);
    if (command === "from-md") await fromMarkdownCommand(positional, options);
    else await toMarkdownCommand(positional, options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const details = error instanceof MarkdownCommandError ? error.details : error instanceof OPFMarkdownError ? { validation: error.details } : undefined;
    process.stderr.write(json({ error: message, ...(details ?? {}) }));
    process.exitCode = error instanceof MarkdownCommandError ? error.code : error instanceof OPFMarkdownError ? 1 : 2;
  }
}
