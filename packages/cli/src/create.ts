// `opf create [output]`: a new deck, a one-slide starter or one of core's bundled examples (`--example <slug>`, RR-75; `opf
// catalog examples` lists them). It replaced `create --from`, which `opf convert` covers.
import { copyFile, lstat, mkdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { localAssetSources } from "@openpresentation/opf";
import { type CommandSpec, nearest, parseArgs, printHelp } from "./args.js";
import { deckFormatFlag } from "./deck.js";
import { CliError, usage } from "./errors.js";
import { type Host, type OutputFact, destinationOf, failOnOf, outputFact, writeDeck } from "./runtime.js";

export const spec: CommandSpec = {
	name: "create",
	usage: ["opf create [output|-] [--title <text> [--language <tag>] | --example <slug>] [--to <json|yaml|md>] [--schema-comment] [--force] [--fail-on <level>]"],
	summary: "Create a deck: a one-slide starter, or one of the bundled examples.",
	positional: [0, 1],
	values: ["title", "example", "language", "to", "fail-on"],
	flags: ["schema-comment", "force"],
	help: `Writes the deck to the output (its extension names the form: .json, .opf.yaml, .opf.md) or to stdout. --title names the
starter deck and its first slide; --language <tag> sets its BCP 47 language (default en-US). --example <slug> copies a bundled
example deck (opf catalog examples lists them) and the image files it names, into an assets/ folder next to the output (an
existing file is refused unless --force; with the deck on stdout no files are copied).
--to json|yaml|md picks the form for stdout; --schema-comment starts a YAML deck with its $schema line. The report
{ command, ok, input, outputs, findings, counts } goes to stdout, or to stderr when stdout carries the deck.

Examples:
  opf create deck.opf.json --title "Quarterly review"
  opf create deck.opf.md --example compliance-readiness-review
  opf create - --to yaml`,
};

export async function run(args: string[], _host: Host): Promise<void> {
	const parsed = parseArgs(spec, args);
	if (parsed === "help") return printHelp(spec);
	const { positional, options } = parsed;
	if (options.title !== undefined && options.example !== undefined) throw usage("Use --title or --example, not both.");
	if (options.language !== undefined && options.example !== undefined) throw usage("--language applies to the starter deck; an example keeps its own language.");
	const failOn = failOnOf(options);
	const to = deckFormatFlag("--to", options.to);
	const destination = destinationOf("create", "-", positional[0], options);
	let document: unknown;
	let exampleFolder: string | undefined;
	if (options.example !== undefined) {
		const { examples, getExample } = await import("@openpresentation/opf/examples");
		const slug = String(options.example);
		const example = getExample(slug);
		if (!example) {
			const guess = nearest(slug, examples.map((item) => item.slug));
			throw usage(`Unknown example ${slug}.${guess ? ` Did you mean ${guess}?` : ""} Run opf catalog examples for the list.`, "unknown-example", { example: slug });
		}
		document = structuredClone(example.deck);
		exampleFolder = path.posix.dirname(example.file.replace(/^examples\//, ""));
	} else {
		const title = options.title === undefined ? "Untitled presentation" : String(options.title);
		document = { $schema: "https://openpresentation.org/schema/opf/v1", name: title, language: options.language === undefined ? "en-US" : String(options.language), slides: [{ id: "slide-1", title }] };
	}
	const files = exampleFolder !== undefined && destination.file !== "-" ? await exampleFiles(document, exampleFolder, path.dirname(path.resolve(destination.file))) : [];
	if (!destination.overwrite) {
		for (const file of files) if (await lstat(file.to).then(() => true, () => false)) throw new CliError(`Output already exists: ${file.to}. Use --force to replace it.`, "output-exists", 1, { file: file.to });
	}
	await writeDeck("create", document, destination, { afterWrite: () => copyFiles(files),  to, schemaComment: options["schema-comment"] === true, failOn, ...(options.example !== undefined ? { extra: { example: String(options.example) } } : {}) });
}

interface ExampleFile {
	from: string;
	to: string;
}

/** The files an example deck names (./assets/logo.svg) that the package ships, with where they go next to the new deck. */
async function exampleFiles(document: unknown, folder: string, directory: string): Promise<ExampleFile[]> {
	const root = path.join(path.dirname(createRequire(import.meta.url).resolve("@openpresentation/opf/package.json")), "dist", "example-files", folder);
	const files: ExampleFile[] = [];
	for (const source of new Set(localAssetSources(document))) {
		if (!source.startsWith("./")) continue;
		const from = path.resolve(root, source);
		const to = path.resolve(directory, source);
		if (path.relative(root, from).startsWith("..") || path.relative(directory, to).startsWith("..")) continue;
		if (await lstat(from).then((stat) => stat.isFile(), () => false)) files.push({ from, to });
	}
	return files;
}

async function copyFiles(files: ExampleFile[]): Promise<OutputFact[]> {
	const facts: OutputFact[] = [];
	for (const file of files) {
		await mkdir(path.dirname(file.to), { recursive: true });
		await copyFile(file.from, file.to);
		const ext = path.extname(file.to).slice(1).toLowerCase();
		facts.push(outputFact(file.to, await readFile(file.to), ext === "svg" ? "image/svg+xml" : `image/${ext === "jpg" ? "jpeg" : ext}`));
	}
	return facts;
}
