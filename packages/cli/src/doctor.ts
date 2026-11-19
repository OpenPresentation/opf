// `opf doctor [deck]` (RR-75): what this install can write, per format, and the one command that installs what is missing. It
// finds the optional packages where the engine looks for them (core's install, then the working directory; opf-render's own fonts
// and converters from opf-render's install) and checks their versions against the ranges the CLI asks for. Font packages are per
// deck: opf-render loads only the faces a deck's fonts use. With a deck, doctor prepares those faces as opf convert does (nothing is
// drawn), so its answer is the deck's: the font packages this deck needs that are not installed (with the faces that need them),
// the Noto script packages its text needs, and sharp when a PDF of it has pictures. Font packages the deck does not use are listed
// apart and never make a format "missing".
import { RENDER_EXTRAS, Reporter, measuringFonts, missingFontPackages } from "@openpresentation/opf/internal/engine";
import type { Finding } from "@openpresentation/opf";
import { type CommandSpec, oneOf, parseArgs, printHelp } from "./args.js";
import { cliCatalogs } from "./catalogs.js";
import { deckFormatFlag } from "./deck.js";
import { fontPackageFinding, fontPackageSpecs } from "./font-packages.js";
import { FORMATS, type DoctorFormat, type PackageFact, hasPictures, installCommand, installScope, packageFacts, packageManager, packageName, packagesFor } from "./install.js";
import { type Host, envelope, inputFact, printReport, readDeck } from "./runtime.js";

/** The formats that draw the deck's text, so need its fonts. */
const DRAWN: readonly DoctorFormat[] = ["svg", "png", "pdf", "pdf-raster", "pptx"];
const FONT_PACKAGE = /^@expo-google-fonts\//;
/** The font packages of the base and office packs: each one is needed only by a deck whose fonts use its faces. */
const FONT_SPECS: readonly string[] = RENDER_EXTRAS.fonts;

/** What the script-font check of a deck found: the packages missing as `name@version`, or why it could not run. */
interface ScriptFonts {
	checked: boolean;
	missing: string[];
	reason?: string;
}

/** The faces of this deck: the font packages it draws with, the ones it needs that are not installed, and the faces that need them. */
interface DeckFonts {
	checked: boolean;
	/** Installed font packages the deck's faces were loaded from. */
	uses: string[];
	/** Font packages the deck's faces need that are not installed, as `name@version`. */
	missing: string[];
	/** The faces that need the missing packages. */
	faces: string[];
	reason?: string;
}

/** The package of a font file under `node_modules/@expo-google-fonts/<name>/`, else undefined (vendored faces, --fonts files). */
const packageOfFile = (file: string) => {
	const name = /[\\/]node_modules[\\/]@expo-google-fonts[\\/]([^\\/]+)[\\/]/.exec(file)?.[1];
	return name ? `@expo-google-fonts/${name}` : undefined;
};

/**
 * The check `opf convert` runs: prepare the fonts the deck draws with (opf-render's `loadFonts`, as validate and paginate do), so the
 * faces its fonts use are loaded, and read the `fonts/` findings it reports. Nothing is drawn. Without opf-render, or when the fonts
 * cannot be prepared, the check did not run and the report says why instead of claiming the deck is fine.
 */
async function checkDeckFonts(deck: unknown): Promise<{ deck: DeckFonts; scripts: ScriptFonts; findings: Finding[] }> {
	const reporter = new Reporter();
	const notChecked = (reason: string) => ({ deck: { checked: false, uses: [], missing: [], faces: [], reason }, scripts: { checked: false, missing: [], reason }, findings: [] });
	let uses: string[] = [];
	try {
		const measuring = await measuringFonts(deck, { reporter, flags: true, catalogs: cliCatalogs(), reportInvalidDocument: true });
		try {
			const files = (measuring.fonts as { fontFiles?: string[] } | undefined)?.fontFiles ?? [];
			uses = [...new Set(files.map(packageOfFile).filter((name): name is string => !!name))].sort();
		} finally {
			measuring.release();
		}
		const fontPackages = missingFontPackages(measuring.estimated);
		if (fontPackages) {
			// The deck's faces were not all prepared, so the script check did not run either.
			const reason = "the deck's fonts can be prepared once its font packages are installed";
			return { deck: { checked: true, uses: [], missing: fontPackageSpecs(fontPackages), faces: fontPackages.faces }, scripts: { checked: false, missing: [], reason }, findings: [fontPackageFinding(fontPackages)] };
		}
		if (measuring.estimated) return notChecked(`${(measuring.estimated.details as { package?: string } | undefined)?.package ?? "@openpresentation/opf-render"} is not installed, so the deck's fonts were not prepared.`);
		if (measuring.invalidDocument) return notChecked("The renderer does not accept the deck as written (run opf validate), so its fonts were not prepared.");
	} catch (error) {
		return notChecked((error as Error).message);
	}
	const findings = reporter.findings.filter((finding) => finding.ruleId === "fonts/script-font-not-installed");
	const missing = [...new Set(findings.map((finding) => (typeof finding.package === "string" ? `${finding.package}${typeof finding.version === "string" ? `@${finding.version}` : ""}` : undefined)).filter((name): name is string => !!name))];
	return { deck: { checked: true, uses, missing: [], faces: [] }, scripts: { checked: true, missing }, findings };
}

export const spec: CommandSpec = {
	name: "doctor",
	usage: ["opf doctor [deck|-] [--from <format>] [--format <json|text>]"],
	summary: "Report which formats this install can write, and the one command that installs what is missing.",
	positional: [0, 1],
	values: ["from", "format"],
	help: `For each format (json, yaml, md, svg, png, pdf, pdf-raster, pptx, pptx-import) doctor says whether it is ready and which
packages it is missing. The packages are found where opf convert finds them. Font packages are per deck: opf-render loads only
the faces a deck's fonts use. Without a deck, ready covers the renderer and the converters, and the font packages are listed apart
under fontPackages (a deck needs only the ones its fonts use). With a deck, doctor prepares the deck's fonts as opf convert does
(it needs opf-render; nothing is drawn) and answers for this deck: the font packages its faces need that are not installed
(deckFonts, and a fonts/font-package-not-installed finding naming the faces), the Noto script packages its text needs
(scriptFonts; an Arabic slide needs two) and sharp when a PDF of it has pictures are added to the drawn formats' missing, to
missing and to install. The other font packages are listed apart under fontPackages.others (unusedByDeck is true when the deck's
faces were all prepared, so it needs none of them) and never make a format missing. The install command matches the package manager that runs the CLI (npm, pnpm, yarn or bun) and the way the CLI is
installed (global, a project, or npx). --format json (the default) is the report { command, ok, input, outputs, findings, counts,
formats, packages, deckFonts, scriptFonts, fontPackages, missing, install }; ok is true when every format is ready. text is for
people. The exit status is 0 unless the arguments are wrong, in both formats: doctor reports, and ok (or the text) is the verdict.

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
	// The renderer and the converters per format; the font packages are the deck's (below).
	const engines = (name: DoctorFormat, options: { pictures?: boolean }) => packagesFor(name, options).filter((spec) => !FONT_PACKAGE.test(spec));
	const all = [...new Set([...FORMATS.flatMap((name) => engines(name, { pictures: pictures ?? true })), ...FONT_SPECS])];
	const facts = new Map(packageFacts(all).map((fact) => [fact.name, fact]));
	const formats = Object.fromEntries(
		FORMATS.map((name) => {
			const missing = engines(name, { pictures: pictures ?? false }).filter((spec) => !facts.get(packageName(spec))?.ok);
			const optional = pictures === undefined && (name === "pdf" || name === "pdf-raster") ? engines(name, { pictures: true }).filter((spec) => !facts.get(packageName(spec))?.ok && !missing.includes(spec)) : [];
			return [name, { ready: missing.length === 0, missing, ...(optional.length ? { forPictures: optional } : {}) }];
		}),
	) as Record<DoctorFormat, { ready: boolean; missing: string[]; forPictures?: string[] }>;
	const fonts = source ? await checkDeckFonts(source.value) : undefined;
	const deckNeeds = fonts ? [...fonts.deck.missing, ...fonts.scripts.missing] : [];
	if (deckNeeds.length) {
		for (const name of DRAWN) {
			const entry = formats[name];
			entry.missing = [...entry.missing, ...deckNeeds];
			entry.ready = false;
		}
	}
	// The font packages this deck does not use (all of them without a deck): installed or not, they change no format's readiness.
	const deckPackages = new Set([...(fonts?.deck.uses ?? []), ...deckNeeds.map(packageName)]);
	const otherFonts = FONT_SPECS.map((spec) => facts.get(packageName(spec))).filter((fact): fact is PackageFact => !!fact && !deckPackages.has(fact.name));
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
		...(fonts ? { deckFonts: fonts.deck, scriptFonts: fonts.scripts } : {}),
		formats,
		packages: [...facts.values()],
		// `unusedByDeck`: the deck's faces were all prepared, so `others` are known not to be needed by it.
		fontPackages: { unusedByDeck: !!fonts && fonts.deck.checked && !fonts.deck.missing.length, others: otherFonts },
		missing,
		install,
	});
	if (format === "json") return printReport(report);
	const lines = [`opf ${host.cliVersion} (core ${host.opfVersion}), Node ${process.version}, ${manager}, ${scope} install`, ""];
	if (fonts) lines.push(`For ${file === "-" ? "this deck" : file}:`);
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
	if (fonts) {
		const deck = fonts.deck;
		lines.push(
			"",
			!deck.checked
				? `Font packages this deck uses: not checked (${deck.reason})`
				: deck.missing.length
					? `Font packages this deck uses: ${deck.missing.join(", ")} (not installed)${deck.faces.length ? ` for ${deck.faces.join(", ")}` : ""}`
					: `Font packages this deck uses: ${deck.uses.length ? `${deck.uses.join(", ")} (installed)` : "none (its faces ship inside opf-render)"}`,
		);
		lines.push(fonts.scripts.checked ? (fonts.scripts.missing.length ? `Script fonts this deck needs: ${fonts.scripts.missing.join(", ")} (not installed)` : "Script fonts this deck needs: all installed.") : `Script fonts this deck needs: not checked (${fonts.scripts.reason})`);
	}
	if (otherFonts.length) {
		lines.push("", fonts?.deck.missing.length ? "Other font packages (this deck's other faces are known once the packages above are installed):" : fonts?.deck.checked ? "Font packages this deck does not use (only decks whose fonts use them need them):" : fonts ? "Font packages (not checked for this deck):" :"Font packages (a deck needs only the ones its fonts use; run opf doctor <deck> to check one):");
		for (const fact of otherFonts) lines.push(`  ${fact.name.padEnd(36)} ${fact.ok ? `${fact.version} installed` : fact.installed ? `${fact.version} installed, needs ${fact.wanted}` : "not installed"}`);
	}
	lines.push(
		"",
		install
			? `Install what is missing:\n  ${install}`
			: fonts
				? fonts.deck.checked && fonts.scripts.checked
					? "Every format is ready for this deck."
					: "Every format is ready, but this deck's fonts were not checked."
				: "Every format is ready. A deck also needs the font packages its fonts use, and a deck in another script (Arabic, Hebrew, Thai, Chinese and others) its Noto script font packages: run opf doctor <deck> to check them.",
	);
	process.stdout.write(`${lines.join("\n")}\n`);
}
