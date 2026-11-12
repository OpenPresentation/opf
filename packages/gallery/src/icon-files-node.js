// `#icon-files` under the `node` condition (RR-63): reads a file of this package's dist/icons/ folder, so in Node, Bun and Deno
// `galleryIconSets()` draws icons with no setup. The builtins load on the first read, and the path is the installed folder, which a
// bundler neither follows nor copies: a bundle that never draws an icon carries none of the data.
const ICON_FILE = /^[a-z][a-z0-9-]*(?:\.json|\.tags\.json|\/[a-z0-9][a-z0-9-]*\.json)$/;

let root;

/** Read `file` (a path under dist/icons/, such as `lucide/truck.json`) and resolve with its JSON value. */
export async function readIcons(file) {
	if (typeof file !== "string" || !ICON_FILE.test(file)) throw new Error(`${JSON.stringify(file)} is not an icon file.`);
	const [{ readFile }, { dirname, join }, { fileURLToPath }] = await Promise.all([import("node:fs/promises"), import("node:path"), import("node:url")]);
	root ??= join(dirname(fileURLToPath(import.meta.url)), "icons");
	return JSON.parse(await readFile(join(root, ...file.split("/")), "utf8"));
}
