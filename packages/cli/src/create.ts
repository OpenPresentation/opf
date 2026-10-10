// `opf create [output]`: a new deck, a one-slide starter or one of core's bundled examples (`--example <slug>`, RR-75; `opf
// catalog examples` lists them). It replaced `create --from`, which `opf convert` covers.
import { type CommandSpec, nearest, parseArgs, printHelp } from "./args.js";
import { deckFormatFlag } from "./deck.js";
import { usage } from "./errors.js";
import { type Host, destinationOf, failOnOf, writeDeck } from "./runtime.js";

export const spec: CommandSpec = {
	name: "create",
	usage: ["opf create [output|-] [--title <text> | --example <slug>] [--to <json|yaml|md>] [--schema-comment] [--force] [--fail-on <level>]"],
	summary: "Create a deck: a one-slide starter, or one of the bundled examples.",
	positional: [0, 1],
	values: ["title", "example", "to", "fail-on"],
	flags: ["schema-comment", "force"],
	help: `Writes the deck to the output (its extension names the form: .json, .opf.yaml, .opf.md) or to stdout. --title names the
starter deck and its first slide. --example <slug> copies a bundled example deck (opf catalog examples lists them).
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
	const failOn = failOnOf(options);
	const to = deckFormatFlag("--to", options.to);
	const destination = destinationOf("create", "-", positional[0], options);
	let document: unknown;
	if (options.example !== undefined) {
		const { examples, getExample } = await import("@openpresentation/opf/examples");
		const slug = String(options.example);
		const example = getExample(slug);
		if (!example) {
			const guess = nearest(slug, examples.map((item) => item.slug));
			throw usage(`Unknown example ${slug}.${guess ? ` Did you mean ${guess}?` : ""} Run opf catalog examples for the list.`, "unknown-example", { example: slug });
		}
		document = structuredClone(example.deck);
	} else {
		const title = options.title === undefined ? "Untitled presentation" : String(options.title);
		document = { $schema: "https://openpresentation.org/schema/opf/v1", name: title, slides: [{ id: "slide-1", title }] };
	}
	await writeDeck("create", document, destination, { to, schemaComment: options["schema-comment"] === true, failOn, ...(options.example !== undefined ? { extra: { example: String(options.example) } } : {}) });
}
