// The font packages a deck's faces need (a Consolas design is drawn with Cousine, from @expo-google-fonts/cousine). They are optional
// peers of opf-render, so an install has only the ones its decks use. `opf validate` and `opf doctor` report one that is not installed
// as a `fonts/font-package-not-installed` finding, with the one command that installs it, instead of failing with an internal error.
import type { Finding } from "@openpresentation/opf";
import { installCommand } from "./install.js";

/** The rule of a font package that a face of the deck needs and that is not installed. */
export const FONT_PACKAGE_RULE = "fonts/font-package-not-installed";

/** What the measurement found missing (core's `missingFontPackages`). */
export interface MissingFontPackages {
	packages: string[];
	faces: string[];
	install?: string;
}

/** `name@version` for each missing package: from the renderer's `npm install` line, else the bare names. */
export function fontPackageSpecs(missing: MissingFontPackages): string[] {
	const pinned = (missing.install ?? "").split(/\s+/).filter((word) => /^@?[^@\s]+@\S+$/.test(word));
	return missing.packages.map((name) => pinned.find((spec) => spec.startsWith(`${name}@`)) ?? name);
}

const list = (items: readonly string[]) => (items.length <= 2 ? items.join(" and ") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`);

/**
 * The finding: a warning, as `fonts/script-font-not-installed` and `cli/asset-missing` are, because the deck is correct OPF and the
 * install is what is short; `--fail-on warning` makes it fail a run. It names the faces, the packages and the install command for
 * the package manager and the way the CLI is installed. Layout is not measured without the face: the report says it was estimated.
 */
export function fontPackageFinding(missing: MissingFontPackages): Finding {
	const specs = fontPackageSpecs(missing);
	const install = installCommand(specs);
	const one = specs.length === 1;
	const faces = missing.faces.length ? `the ${list(missing.faces)} font${missing.faces.length === 1 ? "" : "s"} this deck uses` : "the fonts this deck uses";
	return {
		ruleId: FONT_PACKAGE_RULE,
		severity: "warning",
		category: "fonts",
		scope: "document",
		path: "",
		message: `${list(missing.packages)}, which ${one ? "draws" : "draw"} ${faces}, ${one ? "is" : "are"} not installed: opf convert cannot draw this deck, and its layout was estimated rather than measured with ${missing.faces.length === 1 ? "that font" : "those fonts"}. Install ${one ? "it" : "them"}: ${install}`,
		help: `Run ${install} where the CLI runs, then run the command again. ${one ? "It is an optional peer" : "They are optional peers"} of @openpresentation/opf-render, so an install has only the font packages its decks use.`,
		packages: specs,
		faces: missing.faces,
		install,
	} as Finding;
}
