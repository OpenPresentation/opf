// `opf doctor [deck]` (RR-75): what this install can write, per format, and the one command that installs what is missing. It
// loads nothing: it finds the optional packages where the engine looks for them (core's install, then the working directory;
// opf-render's own fonts and converters from opf-render's install) and checks their versions against the ranges the CLI asks
// for. With a deck it also knows whether a PDF needs sharp (pictures), and it runs the script-font check opf convert runs: the
// Noto packages the deck's text needs that are not installed (an Arabic slide needs two) are named, with their versions.
import { Reporter, measuringFonts } from "@openpresentation/opf/internal/engine";
import type { Finding } from "@openpresentation/opf";
import { type CommandSpec, oneOf, parseArgs, printHelp } from "./args.js";
import { cliCatalogs } from "./catalogs.js";
import { deckFormatFlag } from "./deck.js";
import { FORMATS, type DoctorFormat, hasPictures, installCommand, installScope, packageFacts, packageManager, packageName, packagesFor } from "./install.js";
import { type Host, envelope, inputFact, printReport, readDeck } from "./runtime.js";

/** The formats that draw the deck's text, so need its script fonts. */
const DRAWN: readonly DoctorFormat[] = ["svg", "png", "pdf", "pdf-raster", "pptx"];

/** What the script-font check of a deck found: the packages missing as `name@version`, or why it could not run. */
interface ScriptFonts {
	checked: boolean;
	missing: string[];
	reason?: string;
}

/**
 * The check `opf convert` runs: prepare the fonts the deck draws with (opf-render's `loadFonts`, as validate and paginate do) and read
 * the `fonts/script-font-not-installed` findings it reports. Nothing is drawn. Without opf-render, or when the fonts cannot be
 * prepared, the check did not run and the report says why instead of claiming the deck is fine.
 */
async function checkScriptFonts(deck: unknown): Promise<{ result: ScriptFonts; findings: Finding[] }> {
	const reporter = new Reporter();
	try {
		const measuring = await measuringFonts(deck, { reporter, flags: true, catalogs: cliCatalogs(), reportInvalidDocument: true });
		measuring.release();
		if (measuring.estimated) return { result: { checked: false, missing: [], reason: `${(measuring.estimated.details as { package?: string } | undefined)?.package ?? "@openpresentation/opf-render"} is not installed, so the deck's fonts were not prepared.` }, findings: [] };
		if (measuring.invalidDocument) return { result: { checked: false, missing: [], reason: "The renderer does not accept the deck as written (run opf validate), so its fonts were not prepared." }, findings: [] };
	} catch (error) {
		return { result: { checked: false, missing: [], reason: (error as Error).message }, findings: [] };
	}
	const findings = reporter.findings.filter((finding) => finding.ruleId === "fonts/script-font-not-installed");
	const missing = [...new Set(findings.map((finding) => (typeof finding.package === "string" ? `${finding.package}${typeof finding.version === "string" ? `@${finding.version}` : ""}` : undefined)).filter((name): name is string => !!name))];
	return { result: { checked: true, missing }, findings };
}

export const spec: CommandSpec = {
	name: "doctor",
	usage: ["opf doctor [deck|-] [--from <format>] [--format <json|text>]"],
	summary: "Report which formats this install can write, and the one command that installs what is missing.",
	positional: [0, 1],
	values: ["from", "format"],
	help: `For each format (json, yaml, md, svg, png, pdf, pdf-raster, pptx, pptx-import) doctor says whether it is ready and which
packages it is missing. The packages are found where opf convert finds them; nothing is loaded. With a deck, a PDF of it needs
sharp when it has pictures, and the Noto script font packages its text needs (an Arabic slide needs two) are checked
as opf convert checks them: the missing ones are listed with their versions under scriptFonts and in missing and install, and
the formats that draw text are not ready until they are installed. Without a deck, ready says nothing about a deck's scripts.
Checking a deck's fonts prepares the bundled font pack (it needs opf-render); nothing is drawn. The install command matches the package manager that runs the CLI (npm, pnpm, yarn or bun) and
the way the CLI is installed (global, a project, or npx). --format json (the default) is the report { command, ok, input,
outputs, findings, counts, formats, packages, missing, install }; ok is true when every format is ready. text is for people.
The exit status is 0 unless the arguments are wrong.

Examples:
  opf doctor
  opf doctor deck.opf.md --format text`,
};

export async function run(args: string[], host: Host): Promise<void> {
	const parsed = parseArgs(spec, args);
	if (parsed === "help") return printHelp(spec);
	const { positional, options } = parsed;
	const format = oneOf("--format", options.format, ["json", "text"] as const) ?? "json";
	const file = positional[0];
	const source = file === undefined ? undefined : await readDeck(file, { from: deckFormatFlag("--from", options.from) });
	const pictures = source ? hasPictures(source.value) : undefined;
	const all = [...new Set(FORMATS.flatMap((name) => packagesFor(name, { pictures: pictures ?? true })))];
	const facts = new Map(packageFacts(all).map((fact) => [fact.name, fact]));
	const formats = Object.fromEntries(
		FORMATS.map((name) => {
			const missing = packagesFor(name, { pictures: pictures ?? false }).filter((spec) => !facts.get(packageName(spec))?.ok);
			const optional = pictures === undefined && (name === "pdf" || name === "pdf-raster") ? packagesFor(name, { pictures: true }).filter((spec) => !facts.get(packageName(spec))?.ok && !missing.includes(spec)) : [];
			return [name, { ready: missing.length === 0, missing, ...(optional.length ? { forPictures: optional } : {}) }];
		}),
	) as Record<DoctorFormat, { ready: boolean; missing: string[]; forPictures?: string[] }>;
	const fonts = source ? await checkScriptFonts(source.value) : undefined;
	if (fonts?.result.missing.length) {
		for (const name of DRAWN) {
			const entry = formats[name];
			entry.missing = [...entry.missing, ...fonts.result.missing];
			entry.ready = false;
		}
	}
	const missing = [...new Set(Object.values(formats).flatMap((entry) => [...entry.missing, ...(entry.forPictures ?? [])]))];
	const scope = installScope();
	const manager = packageManager();
	const install = missing.length ? installCommand(missing, scope, manager) : null;
	const report = envelope("doctor", {
		ok: missing.length === 0,
		findings: fonts?.findings ?? [],
		input: source && file !== undefined ? inputFact(file, source.raw) : null,
		cli: host.cliVersion,
		opf: host.opfVersion,
		node: process.version,
		packageManager: manager,
		installed: scope,
		...(pictures === undefined ? {} : { pictures }),
		...(fonts ? { scriptFonts: fonts.result } : {}),
		formats,
		packages: [...facts.values()],
		missing,
		install,
	});
	if (format === "json") return printReport(report);
	const lines = [`opf ${host.cliVersion} (core ${host.opfVersion}), Node ${process.version}, ${manager}, ${scope} install`, ""];
	for (const name of FORMATS) {
		const entry = formats[name];
		const extra = entry.forPictures?.length ? `  (pictures also need ${entry.forPictures.map(packageName).join(", ")})` : "";
		const named = (spec: string) => {
			const fact = facts.get(packageName(spec));
			if (!fact) return spec;
			return fact.installed ? `${fact.name} (${fact.version} installed, needs ${fact.wanted})` : packageName(spec);
		};
		lines.push(`  ${name.padEnd(12)} ${entry.ready ? "ready" : `missing ${entry.missing.map(named).join(", ")}`}${extra}`);
	}
	if (fonts) lines.push("", fonts.result.checked ? (fonts.result.missing.length ? `Script fonts this deck needs: ${fonts.result.missing.join(", ")} (not installed)` : "Script fonts this deck needs: all installed.") : `Script fonts this deck needs: not checked (${fonts.result.reason})`);
	lines.push("", install ? `Install what is missing:\n  ${install}` : fonts ? (fonts.result.checked ? "Every format is ready for this deck." : "Every format is ready, but this deck's script fonts were not checked.") : "Every format is ready. A deck in another script (Arabic, Hebrew, Thai, Chinese and others) also needs its Noto script font packages: run opf doctor <deck> to check them.");
	process.stdout.write(`${lines.join("\n")}\n`);
}
