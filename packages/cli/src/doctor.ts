// `opf doctor [deck]` (RR-75): what this install can write, per format, and the one command that installs what is missing. It
// loads nothing: it finds the optional packages where the engine looks for them (core's install, then the working directory;
// opf-render's own fonts and converters from opf-render's install) and checks their versions against the ranges the CLI asks
// for. With a deck it also knows whether a PDF needs sharp (pictures).
import { type CommandSpec, oneOf, parseArgs, printHelp } from "./args.js";
import { deckFormatFlag } from "./deck.js";
import { FORMATS, type DoctorFormat, hasPictures, installCommand, installScope, packageFacts, packageManager, packageName, packagesFor } from "./install.js";
import { type Host, envelope, inputFact, printReport, readDeck } from "./runtime.js";

export const spec: CommandSpec = {
	name: "doctor",
	usage: ["opf doctor [deck|-] [--from <format>] [--format <json|text>]"],
	summary: "Report which formats this install can write, and the one command that installs what is missing.",
	positional: [0, 1],
	values: ["from", "format"],
	help: `For each format (json, yaml, md, svg, png, pdf, pdf-raster, pptx, pptx-import) doctor says whether it is ready and which
packages it is missing. The packages are found where opf convert finds them; nothing is loaded. With a deck, a PDF of it needs
sharp when it has pictures. The install command matches the package manager that runs the CLI (npm, pnpm, yarn or bun) and
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
	const missing = [...new Set(Object.values(formats).flatMap((entry) => [...entry.missing, ...(entry.forPictures ?? [])]))];
	const scope = installScope();
	const manager = packageManager();
	const install = missing.length ? installCommand(missing, scope, manager) : null;
	const report = envelope("doctor", {
		ok: missing.length === 0,
		input: source && file !== undefined ? inputFact(file, source.raw) : null,
		cli: host.cliVersion,
		opf: host.opfVersion,
		node: process.version,
		packageManager: manager,
		installed: scope,
		...(pictures === undefined ? {} : { pictures }),
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
			return fact?.installed ? `${fact.name} (${fact.version} installed, needs ${fact.wanted})` : packageName(spec);
		};
		lines.push(`  ${name.padEnd(12)} ${entry.ready ? "ready" : `missing ${entry.missing.map(named).join(", ")}`}${extra}`);
	}
	lines.push("", install ? `Install what is missing:\n  ${install}` : "Every format is ready.");
	process.stdout.write(`${lines.join("\n")}\n`);
}
