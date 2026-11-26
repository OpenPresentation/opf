import { readFile } from "node:fs/promises";
import { compactModuleExpression } from "../../javascript/scripts/compact-literal.mjs";

// Two data modules of the viewer's dependencies are written for fast loading as JSON text, which the viewer's frame (a
// JSON-RPC string, where every `"` costs two bytes) pays for twice:
//
// - @openpresentation/gallery's dist/index.js: `const data = JSON.parse("...")`, the records of the default catalog.
// - @openpresentation/opf-render's dist/font-manifest.js: `export const BUNDLED_FONT_MANIFEST=freeze({...})`, the pinned font
//   packages, written as indented JSON.
//
// The viewer build writes each value as the compact expression core's generator uses for its tables (packages/javascript/
// scripts/compact-literal.mjs: each repeated string named once, each repeated object shape built by a function). Nothing else
// in either module changes, and the expression must build the same value: the build stops when its JSON text differs from
// the original's, or when a module no longer has exactly one such value. Other consumers of both packages are unchanged.

const GALLERY_DATA = /^const data = JSON\.parse\(("(?:[^"\\\n]|\\.)*")\);$/gm;
const FONT_MANIFEST = /^export const BUNDLED_FONT_MANIFEST=freeze\((\{\n[\s\S]*?\n\})\);$/gm;

const only = (source, pattern, what) => {
	const found = [...source.matchAll(pattern)];
	if (found.length !== 1) throw new Error(`app-data: expected one ${what}, found ${found.length}; review the viewer's data rewrite.`);
	return found[0];
};

/** The gallery package's dist/index.js with its data written as a compact expression; throws unless the value is the same. */
export function compactGalleryModule(source) {
	const [line, literal] = only(source, GALLERY_DATA, '`const data = JSON.parse("...")` line in the gallery module');
	const expression = compactModuleExpression(JSON.parse(JSON.parse(literal)), "the gallery data", { typed: false });
	return source.replace(line, () => `const data = ${expression};`);
}

/** The renderer's dist/font-manifest.js with its manifest written as a compact expression; throws unless the value is the same. */
export function compactFontManifestModule(source) {
	const [statement, json] = only(source, FONT_MANIFEST, "`export const BUNDLED_FONT_MANIFEST=freeze({...});` statement in the font manifest");
	const expression = compactModuleExpression(JSON.parse(json), "the bundled font manifest", { typed: false });
	return source.replace(statement, () => `export const BUNDLED_FONT_MANIFEST=freeze(${expression});`);
}

const RULES = [
	{ name: "gallery", filter: /[\\/]gallery[\\/]dist[\\/]index\.js$/, rewrite: compactGalleryModule },
	{ name: "font manifest", filter: /[\\/]render[\\/]dist[\\/]font-manifest\.js$/, rewrite: compactFontManifestModule },
];

/** The esbuild plugin; `counts` records how often each rule rewrote a module (the build expects each exactly once). */
export function compactDataPlugin(counts) {
	return {
		name: "compact-data",
		setup(context) {
			for (const rule of RULES) {
				counts[rule.name] = 0;
				context.onLoad({ filter: rule.filter }, async (args) => {
					counts[rule.name] += 1;
					return { contents: rule.rewrite(await readFile(args.path, "utf8")), loader: "js" };
				});
			}
		},
	};
}
