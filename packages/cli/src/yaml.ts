// `opf from-yaml` and `opf to-yaml`: OPF as YAML (RR-56) to and from the canonical JSON form. They follow the conventions of
// `opf from-md` and `opf to-md`: the output defaults to stdout, a JSON report goes on stderr when stdout carries the document
// and on stdout otherwise, exit 1 is invalid content, a conflict or a --strict failure, exit 2 is usage, a read error or I/O.
// The dialect itself lives in core, `@openpresentation/opf/yaml`.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { OPFYamlError, toYaml, fromYaml } from "@openpresentation/opf/yaml";
import type { CliContext } from "./context.js";
import { commentWarning, decode, inputFormatOf, isYamlName } from "./deck.js";

export const YAML_USAGE = `  opf from-yaml <deck.yaml|-> [output.opf.json|-] [--aliases] [--force] [--strict]
  opf to-yaml <deck.opf.json|-> [output.opf.yaml|-] [--schema-comment] [--force]`;

export const YAML_HELP = `from-yaml converts a deck written as YAML to a validated OPF JSON document. The YAML is JSON-compatible
YAML 1.2: one document, a mapping at the root, no custom tags, no duplicate keys, finite numbers, and no
anchors, aliases or merge keys unless --aliases expands them (at most 100 aliases). Errors carry line and
column and exit 1; nothing is written. The output defaults to stdout; --strict also fails on warnings.
to-yaml writes a deck as canonical YAML (schema key order, two-space block style, ambiguous strings such as
"yes" and "2026-10-01" quoted) that from-yaml reads back to the same deck. --schema-comment adds the
'# yaml-language-server: $schema=...' line that gives editors validation and completion.
Every command that reads a deck also reads a file ending .yaml or .yml; commands that write a deck write YAML
for an output ending .yaml/.yml or --format yaml. Rewriting a YAML file does not preserve its comments.`;

const readText = async (cli: CliContext, file: string): Promise<string> => (file === "-" ? cli.stdin() : readFile(file, "utf8"));

async function runFromYaml(cli: CliContext, args: string[]): Promise<void> {
  const { positional, options } = cli.parse(args, ["aliases", "force", "strict"]);
  cli.arity(positional, 1, 2);
  const [input, output = "-"] = positional as [string, string?];
  if (output !== "-" && isYamlName(output)) throw cli.fail("from-yaml writes JSON. To write YAML use opf to-yaml, or opf format for a canonical YAML file.");
  const source = await readText(cli, input);
  const result = fromYaml(source, { aliases: !!options.aliases });
  const failing = result.counts.error > 0 || (!!options.strict && result.counts.warning > 0);
  if (failing) throw cli.fail("YAML conversion failed.", 1, { sha256: cli.hash(source), counts: result.counts, diagnostics: result.diagnostics }, "yaml");
  const text = cli.json(result.document);
  const summary = { valid: true, sha256: cli.hash(text), slides: result.document.slides.length, counts: result.counts, diagnostics: result.diagnostics };
  if (output === "-") {
    process.stdout.write(text);
    process.stderr.write(cli.json(summary));
  } else {
    await cli.saveText(output, text, !!options.force);
    process.stdout.write(cli.json({ ...summary, output: path.resolve(output) }));
  }
}

async function runToYaml(cli: CliContext, args: string[]): Promise<void> {
  const { positional, options } = cli.parse(args, ["schema-comment", "force"]);
  cli.arity(positional, 1, 2);
  const [input, output = "-"] = positional as [string, string?];
  const raw = await readText(cli, input);
  const source = decode(raw, input, inputFormatOf(input));
  const warning = commentWarning(source, input);
  if (warning) process.stderr.write(warning);
  let yaml: string;
  try {
    ({ yaml } = toYaml(source.value, { schemaComment: !!options["schema-comment"] && source.yaml?.modeline === undefined }));
    if (source.yaml?.modeline !== undefined) yaml = `${source.yaml.modeline}
${yaml}`;
  } catch (error) {
    if (error instanceof OPFYamlError) throw cli.fail(error.message, error.code === "invalid-document" ? 1 : 2, error.details);
    throw error;
  }
  const summary = { sha256: cli.hash(yaml), schemaComment: yaml.startsWith("# yaml-language-server:"), bytes: Buffer.byteLength(yaml) };
  if (output === "-") {
    process.stdout.write(yaml);
    process.stderr.write(cli.json(summary));
  } else {
    await cli.saveText(output, yaml, !!options.force);
    process.stdout.write(cli.json({ ...summary, output: path.resolve(output) }));
  }
}

/** Run `from-yaml` or `to-yaml`. Prints JSON reports and sets the exit code (0 success, 1 invalid content or conflict, 2 usage, read or I/O). */
export async function yamlCommand(command: "from-yaml" | "to-yaml", args: string[], cli: CliContext): Promise<void> {
  if (command === "from-yaml") await runFromYaml(cli, args);
  else await runToYaml(cli, args);
}
