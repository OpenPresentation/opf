// The OPF MCP server, transport-agnostic and edge-safe: tools, resources and prompts on the official MCP SDK. It imports no Node
// builtin and reads no file; docs, examples and skills arrive as data (`OpfMcpSources`, bundled at build time by ./data.ts), and
// validation runs the precompiled validators (`@openpresentation/opf/precompiled`), which never compile code at runtime, so it
// runs in a Cloudflare Worker as it does under `opf mcp` (the stdio wrapper in ./stdio.ts). Stateless: every tool is a pure function of
// its input and the bundled data.
import "@openpresentation/opf/precompiled";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GetPromptResult, ReadResourceResult, ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { catalogDisplay, gallery } from "@openpresentation/gallery";
import { type Catalog, type Finding, type FindingSeverity, type ValidateOptions, type ValidationReport, catalogDisplayKinds, catalogKinds, ensureDiagrams, ensureIcons, schemaEntries, stringify, validate } from "@openpresentation/opf";
import { fromMarkdown, toMarkdown } from "@openpresentation/opf/markdown";
import { getAtPointer } from "@openpresentation/opf/patch";
import { fromYaml } from "@openpresentation/opf/yaml";
import { z } from "zod";
import { createSearch, termsOf } from "./search.js";

export type DeckFormat = "json" | "yaml" | "markdown";

/** A documentation page: its slug (the file name without `.md`), its first heading and its Markdown. */
export interface DocPage {
	slug: string;
	title: string;
	markdown: string;
}

/** An example deck: its slug (the file name without `.opf.json`), its folder under examples/ and the deck. */
export interface ExamplePage {
	slug: string;
	category: string;
	gallery?: string | null;
	file: string;
	deck: unknown;
}

/** The data the server serves. `skills` maps a skill name to its files (`SKILL.md`, `references/...`), path to text. */
export interface OpfMcpSources {
	docs: readonly DocPage[];
	examples: readonly ExamplePage[];
	skills: Readonly<Record<string, Readonly<Record<string, string>>>>;
	/** The recent release notes, as text: `opf://docs/whats-new`. Left out when absent. */
	whatsNew?: string;
	/**
	 * LH-14: the icon sets `search_icons` searches and `validate_deck` checks icon names in: `galleryIconSets` of
	 * `@openpresentation/gallery/icon-sets` (each set a module loaded on first use). Left out of the lean server, which then names no icon set.
	 */
	iconSets?: Catalog;
}

/** Checks deck text as `opf validate` does and returns the report. The default is edge-safe (layout estimated); `opf mcp` supplies the measured one. */
export type CheckText = (raw: string, format: DeckFormat, options: ValidateOptions) => Promise<ValidationReport> | ValidationReport;

/** Reads a font file the deck view asks for (`embedded/...`, `fonts/...`, `script-fonts/...`); undefined when it has none. */
export type ReadFontFile = (file: string) => Promise<Uint8Array | undefined> | Uint8Array | undefined;

/** The deck view (an MCP App): the HTML of `ui://opf/deck`, which `show_deck` opens in a host that supports MCP Apps. */
export interface OpfDeckApp {
	/** The view's HTML: `DECK_APP_HTML` of `@openpresentation/mcp`. */
	html: string;
	/**
	 * Font files for the view (it fetches nothing itself). With it the app-only tool `read_font_file` is offered; without it the view
	 * draws faces it cannot get with Roboto and names the substitution. `opf-mcp` serves the installed `@openpresentation/opf-render`'s.
	 */
	readFontFile?: ReadFontFile;
}

export interface OpfMcpOptions {
	/** The version the server reports (the CLI's). */
	version: string;
	/** The version of core the checks run on. */
	opfVersion?: string;
	sources: OpfMcpSources;
	checkText?: CheckText;
	/** The deck view behind `show_deck`. Without it `show_deck` and `ui://opf/deck` are not offered. */
	deckApp?: OpfDeckApp;
	/**
	 * Whether the server reads and checks decks itself. Default true. A hosted server that should do no deck work passes false: then
	 * `validate_deck`, `convert` and the `fix_validation_findings` prompt are left out, and `show_deck` only opens the view, which
	 * checks the deck on the user's machine and sends its findings to the model as context.
	 */
	processDecks?: boolean;
}

/** A failure the tools report as `{ ok: false, code, error, ... }` with `isError`. */
export class McpToolError extends Error {
	constructor(
		message: string,
		readonly code: string,
		readonly details: Record<string, unknown> = {},
	) {
		super(message);
	}
}

const fail = (message: string, code: string, details: Record<string, unknown> = {}) => new McpToolError(message, code, details);

/** The name closest to `typed` (edit distance at most a third of its length, plus one), for "did you mean". */
function nearest(typed: string, names: readonly string[]): string | undefined {
	const target = typed.toLowerCase();
	let best: { name: string; distance: number } | undefined;
	for (const name of names) {
		const other = name.toLowerCase();
		if (other.includes(target) && target.length >= 3) return name;
		let previous = Array.from({ length: other.length + 1 }, (_, at) => at);
		for (let i = 1; i <= target.length; i++) {
			const row = [i];
			for (let j = 1; j <= other.length; j++) row[j] = Math.min((row[j - 1] as number) + 1, (previous[j] as number) + 1, (previous[j - 1] as number) + (target[i - 1] === other[j - 1] ? 0 : 1));
			previous = row;
		}
		const distance = previous[other.length] as number;
		if (!best || distance < best.distance) best = { name, distance };
	}
	return best && best.distance <= Math.floor(target.length / 3) + 1 ? best.name : undefined;
}
const didYouMean = (typed: string, names: readonly string[]) => {
	const guess = nearest(typed, names);
	return guess ? ` Did you mean ${guess}?` : "";
};

const RANK: Record<FindingSeverity, number> = { error: 3, warning: 2, info: 1 };
const reaches = (findings: readonly { severity: FindingSeverity }[], level: FindingSeverity) => findings.some((finding) => RANK[finding.severity] >= RANK[level]);

const countsOf = (findings: readonly { severity: FindingSeverity }[]) => {
	const counts = { error: 0, warning: 0, info: 0 };
	for (const finding of findings) counts[finding.severity] += 1;
	return counts;
};

// ---------------------------------------------------------------------------------------------------------------------
// Reading and checking deck text (the functions the CLI's validate and convert use, without the files)

const CATALOGS: readonly Catalog[] = [gallery];
const WRITE_CHECK: ValidateOptions = { only: ["format", "references"], catalogs: CATALOGS };

/** The YAML or Markdown deck read from its text, and its report. */
function readText(raw: string, format: "yaml" | "markdown", options: ValidateOptions): { presentation: unknown; report: ValidationReport } {
	const read = (format === "yaml" ? fromYaml(raw, { validate: options, catalogs: CATALOGS }) : fromMarkdown(raw, { validate: options, catalogs: CATALOGS })) as ValidationReport & { presentation: unknown; format?: string };
	const { presentation, format: _format, ...report } = read;
	return { presentation, report };
}

/**
 * The `readDeckReport` of core's node engine, by the public readers: the report of deck text in any of the three forms. In a Worker,
 * core loads each diagram type on first use, so the deck's diagram types are loaded first (`ensureDiagrams`) and its diagrams are
 * checked there as in Node, where every type is loaded and nothing is pending.
 */
async function readReport(raw: string, format: DeckFormat, options: ValidateOptions): Promise<ValidationReport> {
	if (format === "json") {
		let deck: unknown;
		try {
			deck = JSON.parse(raw);
		} catch {
			// validate reports the syntax error
		}
		if (deck !== undefined) {
			await ensureDiagrams(deck);
			// LH-14: the gallery icon sets load on first use; the ones the deck names load before the check, so unknown names are reported.
			await ensureIcons(deck, { catalogs: options.catalogs ?? CATALOGS });
		}
		return validate(raw, options);
	}
	// A YAML or Markdown deck's diagrams are known once it is read, so it is read again only when that loaded a diagram type.
	const first = readText(raw, format, options);
	const loaded = (await ensureDiagrams(first.presentation)).length + (await ensureIcons(first.presentation, { catalogs: options.catalogs ?? CATALOGS })).sets.length;
	return loaded > 0 ? readText(raw, format, options).report : first.report;
}

/** The form of the text a tool was given: the `format` argument; else JSON for an object or text that starts with `{` or `[`. */
function inputOf(document: string | Record<string, unknown>, format: DeckFormat | undefined): { raw: string; format: DeckFormat } {
	if (typeof document !== "string") {
		if (format !== undefined && format !== "json") throw fail(`document is an object, which is JSON; format ${format} needs the text of a ${format} deck.`, "invalid-input", { argument: "format" });
		return { raw: `${JSON.stringify(document, null, 2)}\n`, format: "json" };
	}
	if (format) return { raw: document, format };
	if (/^[\s﻿]*[[{]/.test(document)) return { raw: document, format: "json" };
	throw fail("Cannot tell the form of the document: JSON starts with { or [. Pass format: \"yaml\" or \"markdown\" (or \"json\").", "unknown-input-format", { argument: "format" });
}

const documentSchema = z.union([z.string(), z.record(z.string(), z.unknown())]).describe("The deck: a JSON object, or the text of a deck in JSON, YAML or OPF Markdown (then pass format unless it is JSON).");
const formatSchema = z.enum(["json", "yaml", "markdown"]);
const findingSchema = z.object({ ruleId: z.string(), severity: z.enum(["error", "warning", "info"]), path: z.string(), message: z.string(), help: z.string().optional() }).passthrough();
const countsSchema = z.object({ error: z.number(), warning: z.number(), info: z.number() });

// ---------------------------------------------------------------------------------------------------------------------
// Schemas, catalog records and URIs

const DEFAULT_SCHEMA = "presentation";
const kebab = (kind: string) => kind.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
const camel = (kind: string) => kind.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());

const SCHEMA_NAMES = schemaEntries.map((entry) => entry.name);
const defsOf = (schema: unknown): string[] => Object.keys(((schema as { $defs?: Record<string, unknown> }).$defs ?? {}) as Record<string, unknown>);
const escapePointer = (token: string) => token.replace(/~/g, "~0").replace(/\//g, "~1");

export interface ResolvedSchema {
	name: string;
	pointer: string;
	id?: string;
	schema: unknown;
}

/**
 * A schema, or the part of one. `name` is a schema (`opf schemas` lists them) or a `$defs` name (`Chart`, found in the presentation
 * schema first); `pointer` is a JSON Pointer into the schema, or a `$defs` name. Like `opf schema`, `$ref`s are left as written.
 */
export function resolveSchema(name?: string, pointer?: string, opfVersion?: string): ResolvedSchema {
	let entry = schemaEntries.find((item) => item.name === (name ?? DEFAULT_SCHEMA));
	let at = (pointer ?? "").replace(/^#/, "");
	if (!entry) {
		const typed = name as string;
		const owner = [...schemaEntries].sort((a, b) => Number(b.name === DEFAULT_SCHEMA) - Number(a.name === DEFAULT_SCHEMA)).find((item) => defsOf(item.schema).includes(typed));
		if (!owner) {
			const every = [...new Set([...SCHEMA_NAMES, ...schemaEntries.flatMap((item) => defsOf(item.schema))])];
			throw fail(`Unknown schema or $defs name ${typed}.${didYouMean(typed, every)} Schemas: ${SCHEMA_NAMES.join(", ")}.`, "unknown-schema", { schemas: SCHEMA_NAMES });
		}
		entry = owner;
		at = `/$defs/${escapePointer(typed)}${at}`;
	} else if (at && !at.startsWith("/")) {
		if (!defsOf(entry.schema).includes(at)) throw fail(`Schema ${entry.name} has no $defs entry ${at}.${didYouMean(at, defsOf(entry.schema))} A pointer starts with /.`, "unknown-schema-pointer", { schema: entry.name });
		at = `/$defs/${escapePointer(at)}`;
	}
	let schema: unknown;
	try {
		schema = getAtPointer(entry.schema, at);
	} catch {
		throw fail(`Schema ${entry.name} has nothing at ${at}.`, "unknown-schema-pointer", { schema: entry.name, pointer: at });
	}
	const id = (entry.schema as { $id?: string }).$id;
	// A whole schema names the release it came from in its `$comment` (a validator ignores it), as `opf schema` prints it; a part is as it is.
	if (at === "" && opfVersion && typeof schema === "object" && schema !== null) {
		const comment = (schema as { $comment?: unknown }).$comment;
		schema = { ...(schema as Record<string, unknown>), $comment: `${typeof comment === "string" ? `${comment} ` : ""}This copy is from @openpresentation/opf ${opfVersion}.` };
	}
	return { name: entry.name, pointer: at, ...(id ? { id } : {}), schema };
}

type Records = Record<string, Record<string, unknown>>;

/** The record kinds, in the spelling the resource URIs use (`color-schemes`), then `examples`. */
const KINDS = [...catalogKinds, ...catalogDisplayKinds].map(kebab);

function recordsOf(typed: string): { kind: string; records: Records } {
	const kind = camel(typed);
	const records = (catalogKinds as readonly string[]).includes(kind)
		? (gallery as unknown as Record<string, Records | undefined>)[kind]
		: (catalogDisplayKinds as readonly string[]).includes(kind)
			? (catalogDisplay as unknown as Record<string, Records>)[kind]
			: undefined;
	if (!records) throw fail(`Unknown catalog kind ${typed}.${didYouMean(typed, [...KINDS, "examples"])} Kinds: ${[...KINDS, "examples"].join(", ")}.`, "unknown-catalog", { kinds: [...KINDS, "examples"] });
	return { kind, records };
}

const text = (value: unknown, max = 280): string | undefined => (typeof value === "string" && value ? (value.length > max ? `${value.slice(0, max - 3)}...` : value) : undefined);

/** The short form of a record that a search returns: its id, name, summary, description and tags. The record has the rest. */
function brief(id: string, record: Record<string, unknown>): Record<string, unknown> {
	const tags = Array.isArray(record.tags) ? record.tags.filter((tag): tag is string => typeof tag === "string") : undefined;
	return { id, ...(text(record.name, 120) ? { name: text(record.name, 120) } : {}), ...(text(record.summary) ? { summary: text(record.summary) } : {}), ...(text(record.description) ? { description: text(record.description) } : {}), ...(tags?.length ? { tags } : {}) };
}

function matches(query: string | undefined, fields: readonly unknown[]): number {
	const terms = (query ?? "").toLowerCase().split(/\s+/).filter(Boolean);
	if (!terms.length) return 1;
	const haystack = fields.flatMap((field) => (Array.isArray(field) ? field : [field])).filter((field): field is string => typeof field === "string").map((field) => field.toLowerCase());
	let score = 0;
	for (const term of terms) {
		const best = haystack.reduce((top, field, at) => (field === term ? Math.max(top, 10) : field.startsWith(term) ? Math.max(top, 6) : field.includes(term) ? Math.max(top, at < 2 ? 4 : 2) : top), 0);
		if (!best) return 0;
		score += best;
	}
	return score;
}

const URI = {
	doc: (slug: string) => `opf://docs/${slug}`,
	schema: (name: string, rest = "") => `opf://schema/${name}${rest}`,
	example: (slug: string) => `opf://examples/${slug}`,
	record: (kind: string, id: string) => `opf://catalog/${kind}/${id}`,
	skill: (path: string) => `opf://skills/${path}`,
};

const mimeOf = (path: string) => (path.endsWith(".md") ? "text/markdown" : path.endsWith(".json") ? "application/json" : path.endsWith(".yaml") || path.endsWith(".yml") ? "application/yaml" : "text/plain");
const skillTitle = (name: string, files: Readonly<Record<string, string>>) => {
	const description = /^description:\s*"?(.*?)"?\s*$/m.exec(files["SKILL.md"] ?? "")?.[1];
	return description ? `${name}: ${description}` : name;
};

const READ_ONLY: ToolAnnotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

const INSTRUCTIONS = `OPF (Open Presentation Format) is a JSON format for slide decks. This server teaches it and checks it; it keeps no state and reads no files.
Call start_here (with your goal) for a path through the docs, skills, examples and catalog; or start with the resource opf://docs/format-card (the whole authoring surface on one page) and opf://docs/index (every page). Look up exact fields with get_schema (or the opf://schema/<name> resources), default design records (layouts, themes, color and font schemes, ...) with search_catalog and get_catalog_record, worked decks with list_examples (opf://examples/<slug>), and prose with search_docs. Skills are resources too: opf://skills/<name>.
To author a deck: write JSON (or YAML or Markdown), call validate_deck, fix the findings (each has a rule id, a JSON Pointer path and a hint), repeat until ok. convert changes a deck between JSON, YAML and Markdown. Validation is not proof of how a deck looks: it does not render.`;

const INSTRUCTIONS_SHOW = "To show the user a deck, call show_deck: in a client that supports MCP Apps it opens the OPF viewer (Preview, Source and Both), where the user can edit it; their edits come back to you as context, and you continue from that version.";
const INSTRUCTIONS_VIEWER = `OPF (Open Presentation Format) is a JSON format for slide decks. This server teaches it and opens decks in the OPF viewer; it keeps no state and reads no files.
Call start_here (with your goal) for a path through the docs, skills, examples and catalog; or start with the resource opf://docs/format-card (the whole authoring surface on one page) and opf://docs/index (every page). Look up exact fields with get_schema (or the opf://schema/<name> resources), default design records (layouts, themes, color and font schemes, ...) with search_catalog and get_catalog_record, worked decks with list_examples (opf://examples/<slug>), and prose with search_docs. Skills are resources too: opf://skills/<name>.
To author a deck: write JSON (or YAML or Markdown) and open it with show_deck. The viewer checks it on the user's machine and sends you its findings (each has a rule id, a JSON Pointer path and a message) as context; fix them and call show_deck again. The user can edit the deck in the viewer; their edits come back to you as context.`;

export { type SiteFontsOptions, deckFontFile, siteFontFiles } from "./site-fonts.js";

/** The `ui://` resource of the deck view and the MIME type of an MCP App (SEP-1865). */
export const DECK_APP_URI = "ui://opf/deck";
export const MCP_APP_MIME_TYPE = "text/html;profile=mcp-app";

/** The most of a font file one read_font_file call returns (the PDF viewer of ext-apps reads in pieces of the same size). */
const FONT_CHUNK = 512 * 1024;

/** Bytes as base64, without Buffer (edge-safe). */
function base64Of(bytes: Uint8Array): string {
	let binary = "";
	for (let at = 0; at < bytes.length; at += 0x8000) binary += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
	return btoa(binary);
}


/** Build the server. Connect it to a transport (`server.connect(...)`): stdio for `opf mcp`, Streamable HTTP for a hosted one. */
export function createOpfMcpServer(options: OpfMcpOptions): McpServer {
	const { sources, version, deckApp } = options;
	// A server that does no deck work (a thin hosted one) leaves the checks to the deck view.
	const processDecks = options.processDecks !== false;
	if (!processDecks && !deckApp) throw new TypeError("processDecks: false needs deckApp: without the deck view nothing would check a deck.");
	// LH-14: a deck's icons resolve in the icon sets the server was given, besides the gallery.
	const checkCatalogs: readonly Catalog[] = sources.iconSets ? [...CATALOGS, sources.iconSets] : CATALOGS;
	const opfVersion = options.opfVersion;
	const check: CheckText = options.checkText ?? readReport;
	const instructions = processDecks ? (deckApp ? `${INSTRUCTIONS}\n${INSTRUCTIONS_SHOW}` : INSTRUCTIONS) : INSTRUCTIONS_VIEWER;
	const server = new McpServer({ name: "opf", title: "OpenPresentation (OPF)", version }, { instructions });
	// The tool that checks a deck: validate_deck, or the viewer when the server does no deck work.
	const checkTool = processDecks ? "validate_deck" : "show_deck";

	const docs = sources.docs;
	const docIndex = (): string =>
		`# OPF documentation\n\nEvery page is a resource: opf://docs/<slug>. Search them with the search_docs tool; start_here gives a path for a goal.\n\n${sources.whatsNew ? `- [What's new](${URI.doc("whats-new")}): the most recent release notes\n` : ""}${docs.map((doc) => `- [${doc.title}](${URI.doc(doc.slug)}) (${doc.slug})`).join("\n")}\n\n## Skills\n\n${Object.entries(sources.skills)
			.map(([name, files]) => `- [${name}](${URI.skill(name)}): ${/^description:\s*"?(.*?)"?\s*$/m.exec(files["SKILL.md"] ?? "")?.[1] ?? ""}`)
			.join("\n")}\n\nRendering, PPTX export, AI generation and hosting are available from services such as pptx.dev.\n`;
	const search = createSearch([
		...docs.map((doc) => ({ uri: URI.doc(doc.slug), kind: "doc" as const, title: doc.title, text: doc.markdown })),
		...Object.entries(sources.skills).flatMap(([name, files]) =>
			Object.entries(files)
				.filter(([path]) => path.endsWith(".md"))
				.map(([path, body]) => ({ uri: URI.skill(path === "SKILL.md" ? name : `${name}/${path}`), kind: "skill" as const, title: path === "SKILL.md" ? `Skill ${name}` : `Skill ${name}: ${path}`, text: body })),
		),
	]);

	const SKILL_WORDS: Record<string, { words: readonly string[]; use: string }> = {
		"opf-author": { words: ["author", "create", "write", "draft", "make", "build", "new", "deck", "presentation", "slides", "slide", "brief", "outline", "story", "content", "update", "report", "pitch", "chart", "table"], use: "write the deck: content shapes, narrative, a starter deck" },
		"opf-layout": { words: ["layout", "overflow", "overflowing", "paginate", "pagination", "composition", "compose", "group", "groups", "nested", "region", "regions", "fit", "spacing", "split", "columns"], use: "place content: composition, groups, overflow and pagination" },
		"opf-presets": { words: ["theme", "themes", "font", "fonts", "color", "colour", "colors", "palette", "design", "style", "brand", "catalog", "gallery", "preset", "presets", "template", "narrative", "tone", "audience"], use: "choose and embed catalog records: themes, colors, fonts, layouts" },
		"opf-edit": { words: ["edit", "patch", "change", "modify", "revise", "undo", "redo", "replace", "rename", "move", "reorder", "editor"], use: "change an existing deck precisely with JSON Patch" },
		"opf-export": { words: ["export", "render", "pdf", "pptx", "powerpoint", "png", "svg", "image", "images", "asset", "assets", "preview", "convert", "keynote", "slides"], use: "render and export: assets, fonts, PDF, PPTX, PNG, SVG" },
		"opf-inspect": { words: ["validate", "validation", "error", "errors", "finding", "findings", "fix", "invalid", "schema", "field", "fields", "inspect", "check", "warning", "warnings", "accessibility", "contrast", "debug"], use: "look up exact fields and fix validation findings" },
	};
	const STOP = new Set(["the", "and", "for", "with", "that", "this", "from", "into", "about", "need", "want", "have", "some", "make", "using", "use", "can", "how", "what", "give", "please", "slide", "slides", "deck", "presentation", "decks"]);
	/** How many of the goal's words occur in the fields (a word counts once; an exact word weighs more than a substring). */
	const looseScore = (words: readonly string[], fields: readonly unknown[]): number => {
		const parts = fields.flatMap((field) => (Array.isArray(field) ? field : [field])).filter((field): field is string => typeof field === "string").map((field) => field.toLowerCase());
		const joined = parts.join(" \n ");
		let score = 0;
		for (const word of words) {
			if (parts.includes(word) || new RegExp(`\\b${word.replace(/[^\p{L}\p{N}]/gu, "")}`, "u").test(joined)) score += 2;
			else if (word.length > 3 && joined.includes(word.slice(0, -1))) score += 1;
		}
		return score;
	};
	const startHere = (goal: string | undefined) => {
		const asked = goal?.trim() ? goal.trim() : undefined;
		const words = asked ? termsOf(asked).filter((word) => word.length > 2 && !STOP.has(word)) : [];
		// Skills: the one or two whose area the goal names; the authoring skill when none does (or with no goal).
		const ranked = Object.entries(SKILL_WORDS)
			.filter(([name]) => sources.skills[name])
			.map(([name, { words: area, use }]) => ({ name, use, score: words.filter((word) => area.includes(word)).length }))
			.sort((a, b) => b.score - a.score);
		const picked = !asked || !ranked[0] || ranked[0].score === 0 ? ranked.filter((item) => item.name === "opf-author") : ranked.filter((item) => item.score > 0 && item.score === (ranked[0] as { score: number }).score).slice(0, 2);
		const skills = picked.map((item) => ({ uri: URI.skill(item.name), name: item.name, use: item.use }));
		// Documentation: the format card always, how OPF works for the general path, then the best pages for the goal.
		const base = ["format-card", ...(asked ? [] : ["how-opf-works"])].filter((slug) => docs.some((doc) => doc.slug === slug));
		// Each word of the goal searches on its own, so a long sentence is not held to every word at once; a page that several words reach ranks first.
		const reach = new Map<string, { hit: ReturnType<ReturnType<typeof createSearch>>["hits"][number]; score: number }>();
		for (const word of words.slice(0, 6)) {
			for (const hit of search(word, 6).hits) {
				if (hit.kind !== "doc" || base.some((slug) => hit.uri === URI.doc(slug))) continue;
				const seen = reach.get(hit.uri);
				reach.set(hit.uri, { hit: seen?.hit ?? hit, score: (seen?.score ?? 0) + hit.score });
			}
		}
		const found = [...reach.values()]
			.sort((a, b) => b.score - a.score || a.hit.uri.localeCompare(b.hit.uri))
			.slice(0, 3)
			.map((item) => item.hit);
		const docList = [...base.map((slug) => ({ uri: URI.doc(slug), title: docs.find((doc) => doc.slug === slug)?.title ?? slug })), ...found.map((hit) => ({ uri: hit.uri, title: hit.title }))];
		// Examples, layouts and themes from the goal's words; a small default set when nothing matches.
		const exampleOf = (example: ExamplePage) => ({ uri: URI.example(example.slug), slug: example.slug, name: ((example.deck as { name?: string }).name as string | undefined) ?? null, category: example.category });
		let examples = words.length
			? sources.examples
					.map((example) => ({ example, score: looseScore(words, [example.slug, (example.deck as { name?: string }).name, example.category, example.gallery]) }))
					.filter((item) => item.score > 0)
					.sort((a, b) => b.score - a.score)
					.slice(0, 3)
					.map((item) => exampleOf(item.example))
			: [];
		if (examples.length < 2) {
			const preferred = ["full-feature-tour", "columns", "rows-chart"].flatMap((slug) => sources.examples.find((example) => example.slug === slug) ?? []);
			examples = [...examples, ...preferred.map(exampleOf).filter((item) => !examples.some((have) => have.slug === item.slug))].slice(0, 3);
		}
		const pick = (kind: string, count: number, fallback: readonly string[]) => {
			const records = Object.entries(recordsOf(kind).records);
			const scored = words.length ? records.map(([id, record]) => ({ id, record, score: looseScore(words, [id, record.name, record.summary, record.tags, record.description]) })).filter((item) => item.score > 0).sort((a, b) => b.score - a.score) : [];
			const chosen = scored.length ? scored.slice(0, count).map((item) => ({ id: item.id, record: item.record })) : fallback.flatMap((id) => (records.find(([key]) => key === id) ? [{ id, record: (records.find(([key]) => key === id) as [string, Record<string, unknown>])[1] }] : []));
			return chosen.map((item): Record<string, unknown> => ({ ...brief(item.id, item.record), uri: URI.record(kebab(kind), item.id) }));
		};
		const layouts = pick("layouts", 3, ["title", "two-column", "chart"]);
		const themes = pick("themes", 2, Object.keys(recordsOf("themes").records).slice(0, 2));
		const validateArguments: Record<string, unknown> = processDecks ? { document: "<your deck: a JSON object, or its text>", failOn: "warning" } : { document: "<your deck: a JSON object, or its text>" };
		let step = 0;
		const steps: Record<string, unknown>[] = [
			{ step: ++step, action: "Read the format card: the whole authoring surface on one page.", why: "Every later step assumes its vocabulary.", uri: URI.doc("format-card") },
			...skills.map((skill) => ({ step: ++step, action: `Read the ${skill.name} skill: ${skill.use}.`, why: "It says how to do this well, and where OPF and its renderers differ.", uri: skill.uri })),
			...found.map((hit) => ({ step: ++step, action: `Read ${hit.title}.`, why: hit.snippet, uri: hit.uri })),
			...(asked ? [] : [{ step: ++step, action: "Read how OPF works: the document model, content shapes, catalog resolution and validation.", why: "The mental model behind the format card.", uri: URI.doc("how-opf-works") }]),
			...(examples.length ? [{ step: ++step, action: `Open ${examples.length === 1 ? "an example deck" : "the example decks"} closest to the goal (${examples.map((example) => example.slug).join(", ")}) and copy their shapes.`, why: "Every example is valid OPF; the fastest way to see a working shape.", uri: (examples[0] as { uri: string }).uri }] : []),
			{ step: ++step, action: `Choose layouts and a theme from the default catalog${layouts.length ? ` (suggested: ${layouts.map((layout) => layout.id).join(", ")}; theme ${themes.map((theme) => theme.id).join(" or ")})` : ""}. Read a layout's regions to see what it accepts.`, why: "A deck refers to catalog records by id; layouts bind content by kind.", tool: "search_catalog", arguments: { kind: "layouts", ...(words.length ? { query: words.slice(0, 3).join(" ") } : {}) } },
			{ step: ++step, action: "Look up any field you are unsure of in the schema instead of guessing.", why: "The schema is authoritative; unknown keys are findings.", tool: "get_schema", arguments: { name: "Chart" } },
			processDecks
				? { step: ++step, action: "Write the deck (JSON; YAML or Markdown also work), then validate it and fix every finding until ok. Repeat.", why: "failOn warning also asks you to fix contrast, alt text and layout warnings, not only errors.", tool: "validate_deck", arguments: validateArguments }
				: { step: ++step, action: "Write the deck (JSON; YAML or Markdown also work) and open it with show_deck. The viewer checks it and sends you its findings as context; fix them and show it again.", why: "The viewer draws the deck and checks it on the user's machine, contrast, alt text and layout included.", tool: "show_deck", arguments: validateArguments },
			...(processDecks ? [{ step: ++step, action: `Hand the deck over as JSON, YAML or Markdown${deckApp ? ", or show it with show_deck so the user can see and edit it" : ""}; rendering and PPTX need the local opf command (opf convert).`, why: "Validation checks the file; it does not show how the deck looks.", tool: "convert", arguments: { document: "<your deck>", to: "yaml" } }] : []),
		];
		return {
			goal: asked ?? null,
			summary: processDecks
				? asked
					? `A path for: ${asked}. Read, look at examples, choose layouts, write, then validate with failOn "warning" until ok.`
					: "The general path into OPF: read the format card and how OPF works, open an example, choose layouts and a theme, write the deck, then validate with failOn \"warning\" until ok."
				: asked
					? `A path for: ${asked}. Read, look at examples, choose layouts, write, then open the deck with show_deck and fix what the viewer finds.`
					: "The general path into OPF: read the format card and how OPF works, open an example, choose layouts and a theme, write the deck, then open it with show_deck and fix what the viewer finds.",
			steps,
			docs: docList,
			skills,
			examples,
			layouts,
			themes,
			validate: processDecks
				? { tool: "validate_deck", arguments: validateArguments, note: "ok is false when a finding is at or above failOn. Fix errors first, then warnings; validation does not render the deck." }
				: { tool: "show_deck", arguments: validateArguments, note: "This server does no deck work: the viewer checks the deck on the user's machine and sends its findings to you as context. Fix errors first, then warnings." },
		};
	};

	/** A tool result: the structured content, and the same JSON as text for clients that read only text. */
	const ok = (result: Record<string, unknown>) => ({ content: [{ type: "text" as const, text: JSON.stringify(result) }], structuredContent: result });
	const respond = async (work: () => Record<string, unknown> | Promise<Record<string, unknown>>) => {
		try {
			return ok(await work());
		} catch (error) {
			const report = error instanceof McpToolError ? { ok: false, code: error.code, error: error.message, ...error.details } : { ok: false, code: "internal-error", error: error instanceof Error ? error.message : String(error) };
			// No structuredContent: a client checks it against the tool's output schema, which an error does not match.
			return { isError: true, content: [{ type: "text" as const, text: JSON.stringify(report) }] };
		}
	};

	// -------------------------------------------------------------------------------------------------------------------
	// Tools

	server.registerTool(
		"start_here",
		{
			title: "Start here: a guided path into OPF",
			description:
				"Begin here. Given the goal you are working on (for example \"a board update with a revenue chart\", \"fix the validation errors in my deck\", \"change a theme\"), returns a short ordered path: which documentation pages and skill to read, two or three relevant example decks, layout and theme suggestions from the default catalog, and the validate step (validate_deck with failOn \"warning\"). With no goal it returns the general learning path. Everything it names is a resource URI or a tool you can call next.",
			inputSchema: { goal: z.string().optional().describe("What you are trying to do, in your own words. Omit for the general path.") },
			outputSchema: {
				goal: z.string().nullable(),
				summary: z.string(),
				steps: z.array(z.object({ step: z.number(), action: z.string(), why: z.string(), uri: z.string().optional(), tool: z.string().optional(), arguments: z.record(z.string(), z.unknown()).optional() })),
				docs: z.array(z.object({ uri: z.string(), title: z.string() })),
				skills: z.array(z.object({ uri: z.string(), name: z.string(), use: z.string() })),
				examples: z.array(z.object({ uri: z.string(), slug: z.string(), name: z.string().nullable(), category: z.string() })),
				layouts: z.array(z.record(z.string(), z.unknown())),
				themes: z.array(z.record(z.string(), z.unknown())),
				validate: z.object({ tool: z.string(), arguments: z.record(z.string(), z.unknown()), note: z.string() }),
			},
			annotations: { ...READ_ONLY, title: "Start here: a guided path into OPF" },
		},
		({ goal }) => respond(() => startHere(goal)),
	);

	// Left out when the server does no deck work: the deck view checks the deck instead.
	if (processDecks)
		server.registerTool(
		"validate_deck",
		{
			title: "Validate an OPF deck",
			description:
				"Check a deck as `opf validate` does: format (JSON syntax, schema), references, policy, accessibility, layout and content. Returns { ok, findings[] }; each finding has ruleId, severity, category, path (a JSON Pointer), message, help and sometimes fixes, and a line and column when the text is JSON, YAML or Markdown. Only format, references and policy findings are errors by default, so a valid deck can still carry warnings. Reads nothing but the document; images are not fetched or looked up. Passing validation is not proof of how the deck looks.",
			inputSchema: { document: documentSchema, format: formatSchema.optional().describe("The form of the document text. Default: JSON for an object or text that starts with { or [."), failOn: z.enum(["error", "warning", "info"]).optional().describe("ok is false when a finding is at or above this severity. Default error.") },
			outputSchema: { ok: z.boolean(), valid: z.boolean(), schemaValid: z.boolean().nullable(), failOn: z.string(), format: formatSchema, counts: countsSchema, findings: z.array(findingSchema), checks: z.record(z.string(), z.string()), hint: z.string().optional(), opfVersion: z.string().optional() },
			annotations: { ...READ_ONLY, title: "Validate an OPF deck" },
		},
		({ document, format, failOn }) =>
			respond(async () => {
				const input = inputOf(document, format);
				const report = await check(input.raw, input.format, { catalogs: checkCatalogs });
				const level = failOn ?? "error";
				const { findings, counts, valid, schemaValid, checks, ...rest } = report;
				return { ok: !reaches(findings, level), valid, schemaValid, failOn: level, format: input.format, counts, findings, checks, ...(typeof (rest as { hint?: string }).hint === "string" ? { hint: (rest as { hint: string }).hint } : {}), ...(opfVersion ? { opfVersion } : {}) };
			}),
	);

	server.registerTool(
		"get_schema",
		{
			title: "Get an OPF JSON Schema",
			description: `Return a schema, or part of one, like \`opf schema\`. name is a schema (${SCHEMA_NAMES.join(", ")}; default presentation) or a $defs name such as Chart, Slide, Design. pointer is a JSON Pointer into the schema (/properties/slides) or a $defs name. $refs stay as written (look them up in $defs). A whole schema names the @openpresentation/opf release it came from in its $comment. The whole presentation schema is large: ask for a $defs name or a pointer.`,
			inputSchema: { name: z.string().optional().describe("A schema name, or a $defs name (Chart). Default presentation."), pointer: z.string().optional().describe("A JSON Pointer into the schema, or a $defs name.") },
			outputSchema: { name: z.string(), pointer: z.string(), id: z.string().optional(), schema: z.unknown(), opfVersion: z.string().optional() },
			annotations: { ...READ_ONLY, title: "Get an OPF JSON Schema" },
		},
		({ name, pointer }) => respond(() => ({ ...resolveSchema(name, pointer, opfVersion), ...(opfVersion ? { opfVersion } : {}) })),
	);

	const kindsText = `${KINDS.join(", ")}, examples`;
	server.registerTool(
		"search_catalog",
		{
			title: "Search the default catalog",
			description: `Search the default design catalog (@openpresentation/gallery) by kind: ${kindsText}. Matches id, name, summary, description and tags (every word must match); with no query it lists the kind. Returns short records; get_catalog_record returns one in full. A deck refers to a record by id (layout: "two-column").`,
			inputSchema: { kind: z.string().describe(`One of: ${kindsText}.`), query: z.string().optional(), limit: z.number().int().min(1).max(200).optional().describe("At most this many records. Default 25.") },
			outputSchema: { kind: z.string(), query: z.string().optional(), total: z.number(), returned: z.number(), records: z.array(z.record(z.string(), z.unknown())) },
			annotations: { ...READ_ONLY, title: "Search the default catalog" },
		},
		({ kind, query, limit }) =>
			respond(() => {
				const max = limit ?? 25;
				const scored =
					camel(kind) === "examples"
						? sources.examples.map((example) => ({ score: matches(query, [example.slug, (example.deck as { name?: string }).name, example.category, example.gallery]), record: { id: example.slug, name: (example.deck as { name?: string }).name, category: example.category } as Record<string, unknown> }))
						: (() => {
								const { records } = recordsOf(kind);
								return Object.entries(records).map(([id, record]) => ({ score: matches(query, [id, record.name, record.summary, record.tags, record.description]), record: brief(id, record) }));
							})();
				const found = scored.filter((item) => item.score > 0).sort((a, b) => b.score - a.score);
				return { kind: camel(kind) === "examples" ? "examples" : kebab(recordsOf(kind).kind), ...(query ? { query } : {}), total: found.length, returned: Math.min(found.length, max), records: found.slice(0, max).map((item) => item.record) };
			}),
	);

	server.registerTool(
		"get_catalog_record",
		{
			title: "Get a catalog record",
			description: "Return one record of the default catalog in full, by kind and id (an example deck for kind examples, by slug), like `opf catalog <kind> <id>`.",
			inputSchema: { kind: z.string().describe(`One of: ${kindsText}.`), id: z.string() },
			outputSchema: { kind: z.string(), id: z.string(), uri: z.string(), record: z.unknown() },
			annotations: { ...READ_ONLY, title: "Get a catalog record" },
		},
		({ kind, id }) =>
			respond(() => {
				if (camel(kind) === "examples") {
					const example = sources.examples.find((item) => item.slug === id);
					if (!example) throw fail(`Unknown example ${id}.${didYouMean(id, sources.examples.map((item) => item.slug))} Run list_examples.`, "unknown-example");
					return { kind: "examples", id, uri: URI.example(id), record: example.deck };
				}
				const found = recordsOf(kind);
				if (!Object.hasOwn(found.records, id)) throw fail(`Unknown ${found.kind} id: ${id}.${didYouMean(id, Object.keys(found.records))} Run search_catalog.`, "unknown-id");
				return { kind: kebab(found.kind), id, uri: URI.record(kebab(found.kind), id), record: { id, ...found.records[id] } };
			}),
	);

	// LH-14: the icon sets of the gallery, each a module of its own, loaded on the first search that needs it.
	type IconSet = { name: string; license: string; copyright: string; version?: string; icons: Record<string, unknown>; tags?: Record<string, readonly string[]> };
	const iconSets = (sources.iconSets?.iconSets ?? {}) as Record<string, () => Promise<IconSet>>;
	const setNames = Object.keys(iconSets);
	server.registerTool(
		"search_icons",
		{
			title: "Search the icon sets",
			description: `Find icons for an \`icon\` field (a list entry, a metric or a group) in the gallery's icon sets: ${setNames.join(", ")} (Lucide is the default). Matches the icon name and the source package's keywords (every word must match; a name match ranks first). Each result's \`icon\` is the value to write, such as "lucide:truck". Never invent a name: an unknown one is the finding opf/icon-unknown. A deck can also define its own SVG once in its top-level \`icons\` map and name it by its bare key.`,
			inputSchema: {
				query: z.string().describe('Words to match, such as "delivery truck" or "security".'),
				set: z.string().optional().describe(`Only this set: ${setNames.join(" or ")}.`),
				limit: z.number().int().min(1).max(100).optional().describe("At most this many icons. Default 20."),
			},
			outputSchema: {
				query: z.string(),
				total: z.number(),
				returned: z.number(),
				icons: z.array(z.object({ icon: z.string(), set: z.string(), name: z.string(), tags: z.array(z.string()) })),
				sets: z.array(z.object({ id: z.string(), name: z.string(), license: z.string(), copyright: z.string(), version: z.string().optional(), icons: z.number() })),
			},
			annotations: { ...READ_ONLY, title: "Search the icon sets" },
		},
		({ query, set, limit }) =>
			respond(async () => {
				if (!setNames.length) throw fail("This server bundles no icon sets (the lean @openpresentation/mcp/server): pass sources.iconSets, galleryIconSets of @openpresentation/gallery/icon-sets.", "unknown-id");
				const ids = set === undefined ? setNames : [set];
				for (const id of ids) if (!Object.hasOwn(iconSets, id)) throw fail(`Unknown icon set ${id}.${didYouMean(id, setNames)} Sets: ${setNames.join(", ")}.`, "unknown-id");
				const loaded = await Promise.all(ids.map(async (id) => [id, await iconSets[id]!()] as const));
				const words = query.toLowerCase().split(/[\s,]+/).filter(Boolean);
				const found: { score: number; icon: { icon: string; set: string; name: string; tags: string[] } }[] = [];
				for (const [id, record] of loaded)
					for (const name of Object.keys(record.icons)) {
						const tags = [...(record.tags?.[name] ?? [])];
						const hay = [name, ...tags].join(" ").toLowerCase();
						if (!words.every((word) => hay.includes(word))) continue;
						// A whole name first, then a word of the name, then part of it, then a keyword; the default set breaks ties.
						const score = words.reduce((sum, word) => sum + (name === word ? 8 : name.split("-").includes(word) ? 4 : name.includes(word) ? 2 : 1), 0) - name.length / 100 + (id === "lucide" ? 0.5 : 0);
						found.push({ score, icon: { icon: `${id}:${name}`, set: id, name, tags } });
					}
				found.sort((a, b) => b.score - a.score || a.icon.icon.localeCompare(b.icon.icon));
				const max = limit ?? 20;
				return {
					query,
					total: found.length,
					returned: Math.min(max, found.length),
					icons: found.slice(0, max).map((item) => item.icon),
					sets: loaded.map(([id, record]) => ({ id, name: record.name, license: record.license, copyright: record.copyright, ...(record.version ? { version: record.version } : {}), icons: Object.keys(record.icons).length })),
				};
			}),
	);

	// Left out when the server does no deck work: the deck view checks the deck instead.
	if (processDecks)
		server.registerTool(
		"convert",
		{
			title: "Convert a deck between JSON, YAML and Markdown",
			description:
				"Change a deck between the three text forms (JSON is canonical; YAML and OPF Markdown are authoring forms), like `opf convert`. The deck must be valid (format and references) or nothing is converted and the findings are returned. Text formats only: PDF, PPTX and images need the local opf command. Returns the converted text.",
			inputSchema: { document: documentSchema, from: formatSchema.optional().describe("The form of the document text. Default: JSON for an object or text that starts with { or [."), to: formatSchema },
			outputSchema: { ok: z.boolean(), from: formatSchema, to: formatSchema, text: z.string(), counts: countsSchema, findings: z.array(findingSchema), markdown: z.record(z.string(), z.unknown()).optional(), opfVersion: z.string().optional() },
			annotations: { ...READ_ONLY, title: "Convert a deck between JSON, YAML and Markdown" },
		},
		({ document, from, to }) =>
			respond(() => {
				const input = inputOf(document, from);
				let report: ValidationReport & { presentation?: unknown };
				if (input.format === "markdown") report = fromMarkdown(input.raw, { catalogs: CATALOGS, validate: WRITE_CHECK }) as typeof report;
				else if (input.format === "yaml") report = fromYaml(input.raw, { catalogs: CATALOGS, validate: WRITE_CHECK, aliases: false }) as typeof report;
				else {
					report = validate(input.raw, WRITE_CHECK) as typeof report;
					if (report.schemaValid !== null) report.presentation = JSON.parse(input.raw.replace(/^﻿/, ""));
				}
				const syntax = input.format === "json" ? report.schemaValid === null : report.findings.some((found) => found.severity === "error" && /^(yaml|markdown)\//.test(found.ruleId));
				const broken = syntax ? report.findings.filter((found) => found.severity === "error" && (input.format === "json" || /^(yaml|markdown)\//.test(found.ruleId))) : [];
				if (syntax) throw fail(`The ${input.format} text does not parse: ${broken[0]?.message ?? "syntax error"}${broken.length > 1 ? ` (and ${broken.length - 1} more)` : ""}`, `invalid-${input.format}`, { findings: broken, counts: countsOf(broken) });
				if (!report.valid) throw fail("The document is not valid OPF; nothing was converted.", "invalid-document", { findings: report.findings, counts: countsOf(report.findings) });
				let findings: Finding[] = report.findings;
				let markdown: Record<string, unknown> | undefined;
				let out: string;
				if (to === "markdown") {
					const written = toMarkdown(report.presentation as never, { unsupported: "embed" });
					out = written.markdown;
					markdown = { lossless: written.report.lossless, native: written.report.native, embedded: written.report.embedded, loss: written.report.loss };
					if (!written.report.native)
						findings = [...findings, { ruleId: "markdown/embedded", severity: "warning", category: "format", path: "", scope: "document", message: `${written.report.embedded.length} part(s) have no Markdown syntax and are embedded as YAML in opf-slide or opf-block fences (nothing is lost).`, help: "See markdown.embedded in the result." } as Finding];
				} else out = stringify(report.presentation, { format: to });
				return { ok: true, from: input.format, to, text: out, counts: countsOf(findings), findings, ...(markdown ? { markdown } : {}), ...(opfVersion ? { opfVersion } : {}) };
			}),
	);

	server.registerTool(
		"search_docs",
		{
			title: "Search the OPF documentation",
			description: "Ranked text search over the bundled documentation pages and skills. Returns the best pages with a snippet, the heading it sits under and the resource URI to read the page (opf://docs/<slug>, opf://skills/<name>). Words are matched in titles, headings and text; a page with every word ranks first.",
			inputSchema: { query: z.string().min(1), limit: z.number().int().min(1).max(25).optional().describe("At most this many pages. Default 8.") },
			outputSchema: { query: z.string(), total: z.number(), results: z.array(z.object({ uri: z.string(), kind: z.string(), title: z.string(), heading: z.string().optional(), score: z.number(), snippet: z.string() })) },
			annotations: { ...READ_ONLY, title: "Search the OPF documentation" },
		},
		({ query, limit }) =>
			respond(() => {
				const found = search(query, limit ?? 8);
				return { query, total: found.total, results: found.hits };
			}),
	);

	server.registerTool(
		"list_examples",
		{
			title: "List the example decks",
			description: "List the bundled example decks (valid OPF, from small to a tour of every feature) with their slug, name, category and resource URI. Read one with the resource opf://examples/<slug> or get_catalog_record { kind: \"examples\", id }.",
			inputSchema: { category: z.string().optional().describe("Only this folder of examples/ (technical, markdown, gallery, ...)."), query: z.string().optional().describe("Words that must match the slug, name or category.") },
			outputSchema: { total: z.number(), categories: z.array(z.string()), examples: z.array(z.object({ slug: z.string(), name: z.string().nullable(), category: z.string(), slides: z.number().nullable(), uri: z.string() })) },
			annotations: { ...READ_ONLY, title: "List the example decks" },
		},
		({ category, query }) =>
			respond(() => {
				const categories = [...new Set(sources.examples.map((example) => example.category))].sort();
				if (category && !categories.includes(category)) throw fail(`Unknown example category ${category}.${didYouMean(category, categories)} Categories: ${categories.join(", ")}.`, "unknown-category", { categories });
				const found = sources.examples
					.filter((example) => !category || example.category === category)
					.filter((example) => matches(query, [example.slug, (example.deck as { name?: string }).name, example.category, example.gallery]) > 0)
					.map((example) => {
						const deck = example.deck as { name?: string; slides?: unknown[] };
						return { slug: example.slug, name: deck.name ?? null, category: example.category, slides: Array.isArray(deck.slides) ? deck.slides.length : null, uri: URI.example(example.slug) };
					});
				return { total: found.length, categories, examples: found };
			}),
	);

	// -------------------------------------------------------------------------------------------------------------------
	// The deck view (an MCP App, SEP-1865): show_deck opens ui://opf/deck in a host that supports MCP Apps. The view gets the deck
	// from the tool's arguments, which the host hands it, and does the deck's work on the user's machine: the editor, the renderer
	// and the checks. The server hands over the page and, through the app-only read_font_file, font files.

	if (deckApp) {
		const view = z.enum(["preview", "source", "both"]);
		const outlineSchema = z.array(z.object({ slide: z.number(), title: z.string().nullable() }));
		/** The deck's name and slide titles, read without checking it. */
		const outlineOf = (input: { raw: string; format: DeckFormat }) => {
			let deck: unknown;
			try {
				deck = input.format === "json" ? JSON.parse(input.raw.replace(/^\uFEFF/, "")) : readText(input.raw, input.format, WRITE_CHECK).presentation;
			} catch {
				return { name: null, slides: null, outline: [] };
			}
			const slides = Array.isArray((deck as { slides?: unknown })?.slides) ? ((deck as { slides: unknown[] }).slides as { title?: unknown; id?: unknown }[]) : [];
			const name = typeof (deck as { name?: unknown })?.name === "string" ? ((deck as { name: string }).name as string) : null;
			return { name, slides: slides.length, outline: slides.map((slide, index) => ({ slide: index + 1, title: typeof slide?.title === "string" ? slide.title : typeof slide?.id === "string" ? slide.id : null })) };
		};
		const summaryOf = (result: { name: string | null; slides: number | null; outline: { slide: number; title: string | null }[]; counts: { error: number; warning: number; info: number }; findings: Finding[] }) =>
			[
				`Opened ${result.name ? `"${result.name}"` : "the deck"} in the OPF viewer${result.slides === null ? "" : ` (${result.slides} slide${result.slides === 1 ? "" : "s"})`}. In a client that supports MCP Apps the user sees it there and can edit it; their edits come back to you as context.`,
				...(result.outline.length ? [`Slides: ${result.outline.map((item) => `${item.slide}. ${item.title ?? "(untitled)"}`).join("; ")}.`] : []),
				`Checks: ${result.counts.error} errors, ${result.counts.warning} warnings, ${result.counts.info} notes.`,
				...result.findings.filter((finding) => finding.severity !== "info").slice(0, 10).map((finding) => `- ${finding.severity} ${finding.ruleId} at ${finding.path || "/"}: ${finding.message}`),
			].join("\n");

		server.registerTool(
			"show_deck",
			{
				title: "Show a deck in the OPF viewer",
				description: processDecks
					? "Show the user a deck. In a client that supports MCP Apps (Claude on the web and desktop) it opens the OPF viewer in the conversation: the slides (Preview), the deck's text (Source), or both side by side, and the user can edit it there. Their edits come back to you as context: continue from that version. Also checks the deck as validate_deck does and returns its name, slide titles and findings as text, so a client without MCP Apps still gets an answer."
					: "Show the user a deck. In a client that supports MCP Apps (Claude on the web and desktop) it opens the OPF viewer in the conversation: the slides (Preview), the deck's text (Source), or both side by side, and the user can edit it there. The viewer checks the deck on the user's machine and sends you its findings, and the user's edits, as context: fix the findings and continue from the user's version. This server does no deck work itself, so a client without MCP Apps gets no check.",
				inputSchema: {
					document: documentSchema,
					format: formatSchema.optional().describe("The form of the document text. Default: JSON for an object or text that starts with { or [."),
					view: view.optional().describe("What the viewer shows first: preview (the slides, the default), source (the text) or both."),
					slide: z.number().int().min(1).optional().describe("The slide to open on, from 1."),
				},
				outputSchema: {
					opened: z.boolean(),
					checked: z.boolean(),
					view,
					slide: z.number().optional(),
					format: formatSchema.optional(),
					name: z.string().nullable().optional(),
					slides: z.number().nullable().optional(),
					outline: outlineSchema.optional(),
					valid: z.boolean().optional(),
					counts: countsSchema.optional(),
					findings: z.array(findingSchema).optional(),
				},
				annotations: { ...READ_ONLY, title: "Show a deck in the OPF viewer" },
				// SEP-1865: the view that renders this tool's results; the flat key is the older spelling some hosts still read.
				_meta: { ui: { resourceUri: DECK_APP_URI }, "ui/resourceUri": DECK_APP_URI },
			},
			async ({ document, format, view: first, slide }) => {
				const opened = { opened: true, view: first ?? "preview", ...(slide ? { slide } : {}) };
				if (!processDecks) {
					// No deck work here: the view reads and checks the deck. Only the shape of the arguments is looked at.
					const result = { ...opened, checked: false, ...(format ? { format } : typeof document === "string" ? {} : { format: "json" as const }) };
					return { content: [{ type: "text" as const, text: "Opened the deck in the OPF viewer. In a client that supports MCP Apps the user sees it there and can edit it; the viewer checks it on the user's machine and sends you its findings, and the user's edits, as context. This server does not check decks itself." }], structuredContent: result };
				}
				try {
					const input = inputOf(document, format);
					const report = await check(input.raw, input.format, { catalogs: checkCatalogs });
					const deck = outlineOf(input);
					const result = { ...opened, checked: true, format: input.format, ...deck, valid: report.valid, counts: report.counts, findings: report.findings.slice(0, 20) };
					return { content: [{ type: "text" as const, text: summaryOf({ ...deck, counts: report.counts, findings: report.findings }) }], structuredContent: result };
				} catch (error) {
					// A deck the server cannot read still opens: the view shows the text and its syntax error in Source.
					const message = error instanceof Error ? error.message : String(error);
					return { content: [{ type: "text" as const, text: `Opened the deck in the OPF viewer, but it could not be read: ${message}` }], structuredContent: { ...opened, checked: false, ...(format ? { format } : {}) } };
				}
			},
		);

		server.registerResource(
			"deck-view",
			DECK_APP_URI,
			{ title: "OPF deck viewer", description: "The OPF viewer that show_deck opens: Preview, Source and Both, with editing and checks, in one HTML page (an MCP App).", mimeType: MCP_APP_MIME_TYPE, _meta: { ui: { prefersBorder: false } } },
			(uri) => ({ contents: [{ uri: uri.href, mimeType: MCP_APP_MIME_TYPE, text: deckApp.html, _meta: { ui: { prefersBorder: false } } }] }),
		);

		const readFontFile = deckApp.readFontFile;
		if (readFontFile) {
			// Hosts relay tool results through the conversation, so a file goes in pieces (a script face can be 6 MB); the view asks
			// for the next piece until it has the whole file, and the renderer then checks it against its pinned SHA-256.
			const recent = new Map<string, Uint8Array>();
			const bytesOf = async (file: string) => {
				const kept = recent.get(file);
				if (kept) return kept;
				const bytes = await readFontFile(file);
				if (bytes) {
					recent.set(file, bytes);
					if (recent.size > 4) recent.delete(recent.keys().next().value as string);
				}
				return bytes;
			};
			server.registerTool(
				"read_font_file",
				{
					title: "Read a font file for the OPF viewer",
					description: `Used by the OPF viewer only (it cannot fetch): a piece of a font file the renderer's font manifest names, at most ${FONT_CHUNK / 1024} KiB, base64. Do not call it yourself.`,
					inputSchema: {
						file: z.string().min(1).max(200).describe("A path from the renderer's font manifest: embedded/..., fonts/... or script-fonts/...."),
						offset: z.number().int().min(0).optional().describe("Where the piece starts, in bytes. Default 0."),
					},
					outputSchema: { file: z.string(), offset: z.number(), total: z.number(), bytes: z.string() },
					annotations: { ...READ_ONLY, title: "Read a font file for the OPF viewer" },
					// SEP-1865: callable by the view, hidden from the model.
					_meta: { ui: { visibility: ["app"] } },
				},
				async ({ file, offset }) => {
					try {
						const bytes = await bytesOf(file);
						if (!bytes) throw fail(`No font file ${file}: it is not in the renderer's font manifest, or @openpresentation/opf-render is not installed beside this server.`, "unknown-font", { file });
						const from = Math.min(offset ?? 0, bytes.length);
						const piece = bytes.subarray(from, from + FONT_CHUNK);
						const result = { file, offset: from, total: bytes.length, bytes: base64Of(piece) };
						// The bytes go to the view only: the text says what the piece is.
						return { content: [{ type: "text" as const, text: `Font file ${file}: bytes ${from} to ${from + piece.length} of ${bytes.length}.` }], structuredContent: result };
					} catch (error) {
						const report = error instanceof McpToolError ? { ok: false, code: error.code, error: error.message, ...error.details } : { ok: false, code: "internal-error", error: error instanceof Error ? error.message : String(error) };
						return { isError: true, content: [{ type: "text" as const, text: JSON.stringify(report) }] };
					}
				},
			);
		}
	}

	// -------------------------------------------------------------------------------------------------------------------
	// Resources

	const one = (uri: string | URL, body: string, mimeType: string): ReadResourceResult => ({ contents: [{ uri: String(uri), mimeType, text: body }] });
	const missing = (what: string, uri: string | URL, names: readonly string[], typed: string) => new Error(`Unknown ${what} ${typed} (${String(uri)}).${didYouMean(typed, names)}`);
	const variable = (value: string | string[] | undefined): string => decodeURIComponent(Array.isArray(value) ? value.join("/") : (value ?? ""));

	server.registerResource("docs-index", "opf://docs/index", { title: "OPF documentation index", description: "Every documentation page and skill, with its resource URI.", mimeType: "text/markdown" }, (uri) => one(uri, docIndex(), "text/markdown"));
	if (sources.whatsNew !== undefined) {
		const whatsNew = sources.whatsNew;
		server.registerResource("docs-whats-new", "opf://docs/whats-new", { title: "What's new in OPF", description: "The most recent release notes (the last few versions), as text.", mimeType: "text/markdown" }, (uri) => one(uri, whatsNew, "text/markdown"));
	}
	server.registerResource(
		"docs",
		new ResourceTemplate("opf://docs/{slug}", { list: () => ({ resources: docs.map((doc) => ({ uri: URI.doc(doc.slug), name: `docs-${doc.slug}`, title: doc.title, mimeType: "text/markdown" })) }) }),
		{ title: "OPF documentation page", description: "A documentation page by slug (format-card, how-opf-works, validate, ...). opf://docs/index lists them.", mimeType: "text/markdown" },
		(uri, variables) => {
			const slug = variable(variables.slug);
			const doc = docs.find((item) => item.slug === slug);
			if (!doc) throw missing("documentation page", uri, docs.map((item) => item.slug), slug);
			return one(uri, doc.markdown, "text/markdown");
		},
	);

	server.registerResource(
		"schema",
		new ResourceTemplate("opf://schema/{+name}", { list: () => ({ resources: schemaEntries.map((entry) => ({ uri: URI.schema(entry.name), name: `schema-${entry.name}`, title: `${entry.name} JSON Schema`, mimeType: "application/schema+json" })) }) }),
		{ title: "OPF JSON Schema", description: "A schema by name (opf://schema/presentation), or the part at a $defs name or JSON Pointer after #: opf://schema/presentation#Chart, opf://schema/presentation#/properties/slides, opf://schema/Chart.", mimeType: "application/schema+json" },
		(uri, variables) => {
			const [name, ...rest] = variable(variables.name).split("#");
			const found = resolveSchema(name || undefined, rest.length ? rest.join("#") : undefined, opfVersion);
			return one(uri, JSON.stringify(found.schema, null, 2), "application/schema+json");
		},
	);

	server.registerResource(
		"examples",
		new ResourceTemplate("opf://examples/{slug}", { list: () => ({ resources: sources.examples.map((example) => ({ uri: URI.example(example.slug), name: `example-${example.slug}`, title: `${(example.deck as { name?: string }).name ?? example.slug} (${example.category})`, mimeType: "application/json" })) }) }),
		{ title: "OPF example deck", description: "A valid example deck as JSON, by slug. list_examples lists them.", mimeType: "application/json" },
		(uri, variables) => {
			const slug = variable(variables.slug);
			const example = sources.examples.find((item) => item.slug === slug);
			if (!example) throw missing("example", uri, sources.examples.map((item) => item.slug), slug);
			return one(uri, JSON.stringify(example.deck, null, 2), "application/json");
		},
	);

	server.registerResource(
		"catalog",
		new ResourceTemplate("opf://catalog/{kind}/{id}", {
			list: () => ({
				resources: KINDS.flatMap((kind) => Object.entries(recordsOf(kind).records).map(([id, record]) => ({ uri: URI.record(kind, id), name: `catalog-${kind}-${id}`, title: `${kind}: ${text(record.name, 80) ?? id}`, mimeType: "application/json" }))),
			}),
		}),
		{ title: "Default catalog record", description: `A record of the default catalog (@openpresentation/gallery) by kind (${KINDS.join(", ")}) and id.`, mimeType: "application/json" },
		(uri, variables) => {
			const kind = variable(variables.kind);
			const id = variable(variables.id);
			const found = recordsOf(kind);
			if (!Object.hasOwn(found.records, id)) throw missing(`${kebab(found.kind)} record`, uri, Object.keys(found.records), id);
			return one(uri, JSON.stringify({ id, ...found.records[id] }, null, 2), "application/json");
		},
	);

	const skillFiles = Object.entries(sources.skills).flatMap(([name, files]) => Object.keys(files).map((path) => ({ name, path })));
	server.registerResource(
		"skills",
		new ResourceTemplate("opf://skills/{+path}", {
			list: () => ({
				resources: skillFiles.map(({ name, path }) => ({ uri: URI.skill(path === "SKILL.md" ? name : `${name}/${path}`), name: `skill-${name}${path === "SKILL.md" ? "" : `-${path.replace(/[^A-Za-z0-9]+/g, "-")}`}`, title: path === "SKILL.md" ? skillTitle(name, sources.skills[name] ?? {}) : `${name}: ${path}`, mimeType: mimeOf(path) })),
			}),
		}),
		{ title: "OPF agent skill", description: "A skill entrypoint (opf://skills/opf-author) or one of its references and assets (opf://skills/opf-author/references/content.md). Skills: opf-author, opf-layout, opf-presets, opf-edit, opf-export, opf-inspect.", mimeType: "text/markdown" },
		(uri, variables) => {
			const [name = "", ...rest] = variable(variables.path).split("/");
			const files = sources.skills[name];
			if (!files) throw missing("skill", uri, Object.keys(sources.skills), name);
			const path = rest.length ? rest.join("/") : "SKILL.md";
			const body = files[path];
			if (body === undefined) throw missing(`file of skill ${name}`, uri, Object.keys(files), path);
			return one(uri, body, mimeOf(path));
		},
	);

	// -------------------------------------------------------------------------------------------------------------------
	// Prompts

	const resourceMessage = (uri: string, body: string | undefined, mimeType: string): GetPromptResult["messages"] => (body === undefined ? [] : [{ role: "user", content: { type: "resource", resource: { uri, mimeType, text: body } } }]);
	const userText = (body: string): GetPromptResult["messages"][number] => ({ role: "user", content: { type: "text", text: body } });
	const formatCard = docs.find((doc) => doc.slug === "format-card")?.markdown;
	const skill = (name: string) => sources.skills[name]?.["SKILL.md"];

	server.registerPrompt(
		"learn_opf",
		{ title: "Learn OPF", description: "Orient an agent that has not used OPF: what it is and which resources, tools and skills to use for what." },
		() => ({
			description: "Orientation to OPF.",
			messages: [
				userText(`I want to work with OPF (Open Presentation Format) presentation files. Orient yourself first: read the format card below, then use opf://docs/index to find the page for what I ask. Use search_docs for questions, get_schema for exact fields, search_catalog and get_catalog_record for layouts, themes, color and font schemes, list_examples for worked decks, and ${processDecks ? "validate_deck on every deck you write" : "show_deck to open every deck you write in the viewer, which checks it"}${processDecks && deckApp ? " (show_deck shows it to me)" : ""}. Then wait for my task.`),
				...resourceMessage(URI.doc("format-card"), formatCard, "text/markdown"),
			],
		}),
	);

	server.registerPrompt(
		"author_deck",
		{
			title: "Author a deck",
			description: "Write a new OPF deck from a brief, then validate and fix it.",
			argsSchema: { brief: z.string().describe("What the deck is about and what it must achieve."), audience: z.string().optional().describe("Who will see it."), slides: z.string().optional().describe("How many slides, or a rough structure.") },
		},
		({ brief, audience, slides }) => ({
			description: "Author an OPF deck.",
			messages: [
				userText(
					[
						"Author an OPF presentation from this brief. Write ordinary JSON (a presentation is { \"name\", \"slides\": [...] }), preserve the facts I give you and invent none, and keep to the format card and authoring skill below.",
						`Brief: ${brief}`,
						...(audience ? [`Audience: ${audience}`] : []),
						...(slides ? [`Length or structure: ${slides}`] : []),
						`Steps: (1) pick layouts with search_catalog { kind: \"layouts\" } and read the ones you use with get_catalog_record; (2) look at a similar deck with list_examples if it helps; (3) write the deck; ${processDecks ? `(4) call validate_deck, fix every error and every warning you can, and call it again until ok; (5) give me the deck${deckApp ? " (show it with show_deck)" : ""} and say what you chose and what the validator could not check (it does not render).` : "(4) open it with show_deck; the viewer checks it and sends you its findings as context: fix every error and every warning you can and show it again until it is clean; (5) say what you chose."}`,
					].join("\n\n"),
				),
				...resourceMessage(URI.doc("format-card"), formatCard, "text/markdown"),
				...resourceMessage(URI.skill("opf-author"), skill("opf-author"), "text/markdown"),
			],
		}),
	);

	if (processDecks)
		server.registerPrompt(
		"fix_validation_findings",
		{
			title: "Fix validation findings",
			description: "Repair a deck that does not validate, changing as little as possible.",
			argsSchema: { document: z.string().describe("The deck text (JSON, or YAML or OPF Markdown)."), format: z.enum(["json", "yaml", "markdown"]).optional().describe("The form of the text. Default json.") },
		},
		({ document, format }) => ({
			description: "Fix the findings of validate_deck.",
			messages: [
				userText(
					[
						`Make this OPF deck pass validation with the smallest change that keeps its content and meaning. Call validate_deck${format && format !== "json" ? ` with format "${format}"` : ""}, read each finding (rule id, path, message, help and any fixes), fix the errors first, then the warnings that have an exact fix, and call it again until ok. Do not delete content to silence a finding. For a field you are unsure of, call get_schema with its $defs name. Report what you changed, by finding, and what you left (and why).`,
						`Deck:\n\n${document}`,
					].join("\n\n"),
				),
				...resourceMessage(URI.skill("opf-inspect"), skill("opf-inspect"), "text/markdown"),
			],
		}),
	);

	server.registerPrompt(
		"choose_layout",
		{
			title: "Choose a layout",
			description: "Pick the layout (and design options) for a slide from the content it has to carry.",
			argsSchema: { content: z.string().describe("What the slide has to say or show: the points, the chart, the image, the numbers."), intent: z.string().optional().describe("What the slide is for: persuade, compare, report, close, ...") },
		},
		({ content, intent }) => ({
			description: "Choose an OPF layout.",
			messages: [
				userText(
					[
						`Choose the layout for one slide. List the layouts with search_catalog { kind: \"layouts\" }, read the two or three that fit with get_catalog_record (their regions say what they accept), and choose by the kinds of content the slide carries, not by taste. Say which layout, why, how each piece of content binds to a region, and what the runner-up would cost. Then write the slide as JSON and check it with ${checkTool}.`,
						`Content: ${content}`,
						...(intent ? [`Purpose: ${intent}`] : []),
					].join("\n\n"),
				),
				...resourceMessage(URI.skill("opf-layout"), skill("opf-layout"), "text/markdown"),
			],
		}),
	);

	return server;
}
