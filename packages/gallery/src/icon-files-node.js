// `#icon-files` under the `node` condition (RR-63): reads a file of this package's dist/icons/ folder, so in Node, Bun and Deno
// `galleryIconSets()` draws icons with no setup. The builtins load on the first read, and the folder is found at run time, which a
// bundler neither follows nor copies: a bundle that never draws an icon carries none of the data, and one that does reads the files
// of the package installed where it runs.
import { GALLERY_ICON_SETS } from "./icon-set-ids.js";

const ICON_FILE = /^[a-z][a-z0-9-]*(?:\.json|\.icons\.json|\.tags\.json|\/[a-z0-9][a-z0-9-]*\.json)$/;
const PACKAGE = "@openpresentation/gallery";

/** This runtime reads the installed files (`installedIconSets()` registers them). */
export const INSTALLED_ICON_FILES = true;

let root;

/**
 * The installed dist/icons/ folder: next to this module (the package as installed, or a bundle with the folder copied beside it as
 * icons/), else the `@openpresentation/gallery` installed for the working directory (a bundled server deployed with its node_modules).
 * A folder counts when it holds the first set's index. Rejects with the folders it tried and what to do.
 */
async function iconRoot() {
	if (root) return root;
	const [{ existsSync }, { dirname, join }, { fileURLToPath, pathToFileURL }, { createRequire }] = await Promise.all([
		import("node:fs"),
		import("node:path"),
		import("node:url"),
		import("node:module"),
	]);
	const holds = (dir) => existsSync(join(dir, `${GALLERY_ICON_SETS[0]}.json`));
	const tried = [];
	// A CommonJS bundle has no import.meta.url; webpack can rewrite it to the build machine's path, which then holds no files.
	const url = import.meta.url;
	if (typeof url === "string" && url.startsWith("file:")) {
		const here = join(dirname(fileURLToPath(url)), "icons");
		if (holds(here)) {
			root = here;
			return root;
		}
		tried.push(here);
	}
	let installed;
	try {
		installed = join(dirname(createRequire(pathToFileURL(join(process.cwd(), "/"))).resolve(`${PACKAGE}/package.json`)), "dist", "icons");
	} catch {
		tried.push(`${PACKAGE} installed for ${process.cwd()} (not found)`);
	}
	if (installed) {
		if (holds(installed)) {
			root = installed;
			return root;
		}
		tried.push(installed);
	}
	throw new Error(
		`The gallery icon files were not found (looked in ${tried.join("; ")}). Deploy the server with ${PACKAGE} installed (its node_modules) or copy its dist/icons/ next to the bundle as icons/, or register galleryIconSets(load) with a load of your own or the whole sets your bundle imports (galleryIconSets({ lucide }) with ${PACKAGE}/icons/lucide.icons.json).`,
	);
}

/** Read `file` (a path under dist/icons/, such as `lucide/truck.json`) and resolve with its JSON value. */
export async function readIcons(file) {
	if (typeof file !== "string" || !ICON_FILE.test(file)) throw new Error(`${JSON.stringify(file)} is not an icon file.`);
	const dir = await iconRoot();
	const [{ readFile }, { join }] = await Promise.all([import("node:fs/promises"), import("node:path")]);
	const target = join(dir, ...file.split("/"));
	let text;
	try {
		text = await readFile(target, "utf8");
	} catch (error) {
		throw new Error(`${target} could not be read: ${error?.code ?? error?.message ?? error}.`);
	}
	return JSON.parse(text);
}
