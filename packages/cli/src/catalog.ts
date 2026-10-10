// The lookup commands: `opf schemas`, `opf schema [name] [pointer]`, `opf catalogs` and `opf catalog <kind> [id]`, including
// `opf catalog examples [slug]` (RR-75: core's bundled example decks, which `opf create --example <slug>` copies). They print the
// data asked for, not a report.
import { catalogDisplayKinds, catalogKinds, schemaEntries } from "@openpresentation/opf";
import { catalogDisplay, gallery } from "@openpresentation/gallery";
import { getAtPointer } from "@openpresentation/opf/patch";
import { type CommandSpec, nearest, parseArgs, printHelp } from "./args.js";
import { usage } from "./errors.js";
import { json } from "./io.js";
import type { Host } from "./runtime.js";

const print = (value: unknown): void => void process.stdout.write(json(value));

export const schemasSpec: CommandSpec = { name: "schemas", usage: ["opf schemas"], summary: "List the OPF schemas.", positional: [0, 0], help: "Prints [{ name, file, id }] for every schema; opf schema <name> prints one." };
export const schemaSpec: CommandSpec = {
	name: "schema",
	usage: ["opf schema [name] [JSON-Pointer]"],
	summary: "Print a schema (presentation by default), or the part at a JSON Pointer.",
	positional: [0, 2],
	help: "Example:\n  opf schema presentation /properties/slides",
};
export const catalogsSpec: CommandSpec = { name: "catalogs", usage: ["opf catalogs"], summary: "List the catalog kinds of the default catalog, with counts.", positional: [0, 0], help: "Prints [{ kind, count, source }] for the record kinds, the display kinds and the bundled examples." };
export const catalogSpec: CommandSpec = {
	name: "catalog",
	usage: ["opf catalog <kind> [id]", "opf catalog examples [slug]"],
	summary: "List the records of a catalog kind (or the bundled example decks), or print one.",
	operands: ["<kind> (opf catalogs lists them)"],
	positional: [1, 2],
	help: `Kinds are spelled as opf catalogs lists them or with hyphens (color-schemes, chart-types). Records are keyed by id, as a deck
embeds them. examples lists core's bundled example decks ({ slug, name, category, gallery, file }); opf catalog examples <slug>
prints one deck, which opf create --example <slug> copies.

Examples:
  opf catalog layouts
  opf catalog layouts two-column
  opf catalog examples`,
};

export async function runSchemas(args: string[], _host: Host): Promise<void> {
	const parsed = parseArgs(schemasSpec, args);
	if (parsed === "help") return printHelp(schemasSpec);
	print(schemaEntries.map((entry) => ({ name: entry.name, file: entry.file, id: entry.schema.$id })));
}

export async function runSchema(args: string[], _host: Host): Promise<void> {
	const parsed = parseArgs(schemaSpec, args);
	if (parsed === "help") return printHelp(schemaSpec);
	const name = parsed.positional[0] ?? "presentation";
	const entry = schemaEntries.find((item) => item.name === name);
	if (!entry) {
		const guess = nearest(name, schemaEntries.map((item) => item.name));
		throw usage(`Unknown schema ${name}.${guess ? ` Did you mean ${guess}?` : ""} Run opf schemas.`, "unknown-schema");
	}
	print(getAtPointer(entry.schema, parsed.positional[1] ?? ""));
}

export async function runCatalogs(args: string[], _host: Host): Promise<void> {
	const parsed = parseArgs(catalogsSpec, args);
	if (parsed === "help") return printHelp(catalogsSpec);
	const { examples } = await import("@openpresentation/opf/examples");
	print([
		...catalogKinds.map((kind) => ({ kind, count: Object.keys(gallery[kind] ?? {}).length, source: gallery.source })),
		...catalogDisplayKinds.map((kind) => ({ kind, count: Object.keys(catalogDisplay[kind]).length, display: true })),
		{ kind: "examples", count: examples.length, examples: true },
	]);
}

export async function runCatalog(args: string[], _host: Host): Promise<void> {
	const parsed = parseArgs(catalogSpec, args);
	if (parsed === "help") return printHelp(catalogSpec);
	const [typed, id] = parsed.positional as [string, string | undefined];
	if (typed === "examples") {
		const { examples, getExample } = await import("@openpresentation/opf/examples");
		if (id === undefined) return print(examples.map((example) => ({ slug: example.slug, name: (example.deck as { name?: string }).name ?? null, category: example.category, gallery: example.gallery, file: example.file })));
		const example = getExample(id);
		if (!example) {
			const guess = nearest(id, examples.map((item) => item.slug));
			throw usage(`Unknown example ${id}.${guess ? ` Did you mean ${guess}?` : ""} Run opf catalog examples.`, "unknown-example");
		}
		return print(example.deck);
	}
	// `opf catalogs` lists camelCase kinds; the website spells them with hyphens (color-schemes, chart-types).
	const kind = typed.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
	const records = (catalogKinds as readonly string[]).includes(kind)
		? gallery[kind as (typeof catalogKinds)[number]]
		: (catalogDisplayKinds as readonly string[]).includes(kind)
			? catalogDisplay[kind as (typeof catalogDisplayKinds)[number]]
			: undefined;
	if (!records) {
		const guess = nearest(kind, [...catalogKinds, ...catalogDisplayKinds, "examples"]);
		throw usage(`Unknown catalog ${typed}.${guess ? ` Did you mean ${guess}?` : ""} Run opf catalogs.`, "unknown-catalog");
	}
	// Records are keyed by id, as a document embeds them; a listing gives each one with its id.
	if (id === undefined) return print(Object.entries(records).map(([key, record]) => ({ id: key, ...record })));
	if (!Object.hasOwn(records, id)) {
		const guess = nearest(id, Object.keys(records));
		throw usage(`Unknown ${kind} id: ${id}.${guess ? ` Did you mean ${guess}?` : ""} Run opf catalog ${typed}.`, "unknown-id");
	}
	print({ id, ...records[id] });
}
