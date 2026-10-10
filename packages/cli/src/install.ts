// The exact install line (RR-75): which optional packages a format needs (opf-render, its fonts and converters, opf-pptx), which
// of them are missing where the engine looks, and the one command that installs them with the package manager in use
// (`npm_config_user_agent`: npm, pnpm, yarn or bun) for the way the CLI is installed (global, a project, or an npx run).
// `opf doctor` reports the same facts per format.
import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PEER_RANGES, PPTX_PACKAGE, RENDER_EXTRAS, RENDER_PACKAGE, locatePackage } from "@openpresentation/opf/internal/engine";

export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";
export type InstallScope = "global" | "project" | "npx";

/** The formats `opf doctor` reports: the deck forms need nothing; `pdf-raster` is `--raster`, `pptx-import` reading a .pptx. */
export const FORMATS = ["json", "yaml", "md", "svg", "png", "pdf", "pdf-raster", "pptx", "pptx-import"] as const;
export type DoctorFormat = (typeof FORMATS)[number];

/** The package manager that runs the CLI: from `npm_config_user_agent` (`pnpm/9.0.0 npm/? node/v24 ...`), npm when it says none. */
export function packageManager(env: NodeJS.ProcessEnv = process.env): PackageManager {
	const agent = env.npm_config_user_agent ?? "";
	return agent.startsWith("pnpm/") ? "pnpm" : agent.startsWith("yarn/") ? "yarn" : agent.startsWith("bun/") ? "bun" : "npm";
}

/** How the CLI is installed: an npx (or dlx) run, a global install, or a project's dependency (a checkout counts as a project). */
export function installScope(file = fileURLToPath(import.meta.url)): InstallScope {
	let real = file;
	try {
		real = realpathSync(file);
	} catch {
		// keep the path as given
	}
	const text = real.split(path.sep).join("/");
	if (/\/_npx\/|\/dlx-[^/]*\/|\/\.pnpm-store\/.*\/dlx|\/bunx-/.test(text)) return "npx";
	const modules = text.lastIndexOf("/node_modules/");
	if (modules < 0) return "project";
	const root = text.slice(0, modules);
	// npm: <prefix>/lib/node_modules (POSIX) or <prefix>/node_modules beside node.exe and npm.cmd (Windows); pnpm, yarn and bun keep a global folder of their own.
	if (/\/lib$/.test(root) && !/\/node_modules\//.test(root)) return "global";
	if (/\/(pnpm\/global\/\d+|\.pnpm-global|yarn\/global|\.config\/yarn\/global|\.bun\/install\/global)$/.test(root)) return "global";
	if (process.platform === "win32" && /\/(AppData\/Roaming\/npm|nodejs)$/i.test(root)) return "global";
	return "project";
}

/** The command that installs `packages` with `manager` for `scope`. */
export function installCommand(packages: readonly string[], scope: InstallScope = installScope(), manager: PackageManager = packageManager()): string {
	const list = packages.join(" ");
	if (scope === "npx") {
		const run = ["@openpresentation/cli", ...packages];
		if (manager === "pnpm") return `pnpm ${run.map((name) => `--package=${name}`).join(" ")} dlx opf <command>`;
		return `npx ${run.map((name) => `-p ${name}`).join(" ")} opf <command>`;
	}
	const global = scope === "global";
	if (manager === "pnpm") return `pnpm add${global ? " -g" : ""} ${list}`;
	if (manager === "yarn") return global ? `yarn global add ${list}` : `yarn add ${list}`;
	if (manager === "bun") return `bun add${global ? " -g" : ""} ${list}`;
	return `npm install${global ? " -g" : ""} ${list}`;
}

const RENDER = `${RENDER_PACKAGE}@${PEER_RANGES[RENDER_PACKAGE]}`;
const PPTX = `${PPTX_PACKAGE}@${PEER_RANGES[PPTX_PACKAGE]}`;
const SHARP = RENDER_EXTRAS.pdfPictures;

/** The packages (with their versions) a format needs. `pictures`: the deck has images, which a PDF converts with sharp. */
export function packagesFor(format: DoctorFormat, options: { pictures?: boolean } = {}): string[] {
	const drawing = [RENDER, ...RENDER_EXTRAS.fonts];
	switch (format) {
		case "json":
		case "yaml":
		case "md":
			return [];
		case "svg":
			return drawing;
		case "png":
			return [...drawing, ...RENDER_EXTRAS.png];
		case "pdf":
			return [...drawing, ...(options.pictures ? SHARP : [])];
		case "pdf-raster":
			return [...drawing, ...RENDER_EXTRAS.pdfRaster, ...(options.pictures ? SHARP : [])];
		case "pptx":
			return [PPTX, ...drawing];
		case "pptx-import":
			return [PPTX];
	}
}

/** `name@range` to `name`. */
export const packageName = (spec: string) => spec.replace(/^(@?[^@]+)@.*$/, "$1");

/** The install facts of a package: installed or not, its version, and whether the version is in the range the CLI asks for. */
export interface PackageFact {
	name: string;
	wanted: string;
	installed: boolean;
	version?: string;
	ok: boolean;
}

/** `0.18.3` against `^0.18.0`: the caret rule, and an exact or `x`-free version otherwise. */
export function satisfies(version: string, range: string): boolean {
	const parse = (text: string) => text.replace(/^[\^~=v]+/, "").split(/[.+-]/).slice(0, 3).map(Number);
	const [major, minor, patch] = parse(version);
	const [wantMajor, wantMinor, wantPatch] = parse(range);
	if ([major, minor, patch, wantMajor, wantMinor, wantPatch].some((value) => value === undefined || Number.isNaN(value))) return false;
	if (!range.startsWith("^")) return version.replace(/^v/, "") === range.replace(/^[=v]/, "");
	if (major !== wantMajor) return false;
	if (wantMajor === 0 && minor !== wantMinor) return false;
	if ((minor as number) !== (wantMinor as number)) return (minor as number) > (wantMinor as number);
	return (patch as number) >= (wantPatch as number);
}

/** Where opf-render is installed: the base its own optional packages (fonts, converters) resolve from. */
function renderBase(): string | undefined {
	return locatePackage(RENDER_PACKAGE)?.manifest;
}

/** The facts of every package `packages` names, resolved as the engine resolves them. */
export function packageFacts(packages: readonly string[]): PackageFact[] {
	const base = renderBase();
	return packages.map((spec) => {
		const name = packageName(spec);
		const wanted = spec.slice(name.length + 1);
		const found = locatePackage(name, name === RENDER_PACKAGE || name === PPTX_PACKAGE ? undefined : base);
		return { name, wanted, installed: !!found, ...(found ? { version: found.version } : {}), ok: !!found && satisfies(found.version, wanted) };
	});
}

/** The packages of `packages` that are missing or outside their range, as `name@range`. */
export function missingOf(packages: readonly string[]): string[] {
	const facts = packageFacts(packages);
	return packages.filter((_, index) => !facts[index]?.ok);
}

/** Whether a deck has pictures (images anywhere, backgrounds, logos, watermarks): a PDF of it needs sharp. A cheap scan of the decoded deck. */
export function hasPictures(deck: unknown): boolean {
	let found = false;
	const visit = (value: unknown, key: string, depth: number) => {
		if (found || depth > 40) return;
		if (typeof value === "string") {
			if (/^(image|src|logo|watermark|background|full|icon|stacked|wordmark|onLight|onDark)$/.test(key) && /\.(png|jpe?g|gif|webp|bmp|tiff?)(\?|#|$)|^data:image\/(?!svg)/i.test(value)) found = true;
			return;
		}
		if (Array.isArray(value)) for (const item of value) visit(item, key, depth + 1);
		else if (value && typeof value === "object") for (const [name, item] of Object.entries(value)) visit(item, name, depth + 1);
	};
	visit(deck, "", 0);
	return found;
}

/** The install message for a missing peer: what is missing for `format`, and the one command. Undefined when nothing is missing. */
export function installHint(format: DoctorFormat, options: { pictures?: boolean } = {}): { message: string; install: string; missing: string[] } | undefined {
	const missing = missingOf(packagesFor(format, options));
	if (!missing.length) return undefined;
	const install = installCommand(missing);
	return { message: `${format === "pptx-import" ? "Reading a .pptx" : `Writing ${format === "pdf-raster" ? "a raster pdf" : format}`} needs ${missing.map(packageName).join(", ")}, which ${missing.length === 1 ? "is" : "are"} not installed where the CLI looks. Install with:\n  ${install}`, install, missing };
}

/** Where core resolves from: the CLI's core, so a doctor run checks the packages the engine will load. */
export function coreManifest(): string | undefined {
	try {
		return createRequire(import.meta.url).resolve("@openpresentation/opf/package.json");
	} catch {
		return undefined;
	}
}
