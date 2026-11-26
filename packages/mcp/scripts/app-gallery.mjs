import { compactModuleExpression } from "../../javascript/scripts/compact-literal.mjs";

// The gallery package ships its records as `const data = JSON.parse("...")`: one string, which is the fastest form for its
// consumers to load. In the viewer's frame, a JSON-RPC string, every `"` of that JSON text costs two bytes. The viewer build
// writes the same data as the compact expression core's generator uses for its tables (packages/javascript/scripts/
// compact-literal.mjs: each repeated string named once, each repeated record shape built by a function), which is about 130 KB
// smaller in the frame. Nothing else in the module changes, and the expression must build the same value: the build stops
// when its JSON text differs from the string's, or when the module no longer has exactly one such line.

const DATA_LINE = /^const data = JSON\.parse\(("(?:[^"\\\n]|\\.)*")\);$/gm;

/** The gallery package's dist/index.js with its data written as a compact expression; throws unless the value is the same. */
export function compactGalleryModule(source) {
	const lines = [...source.matchAll(DATA_LINE)];
	if (lines.length !== 1) throw new Error(`app-gallery: expected one \`const data = JSON.parse("...")\` line in the gallery module, found ${lines.length}; review the viewer's gallery rewrite.`);
	const [line, literal] = lines[0];
	const text = JSON.parse(literal);
	const expression = compactModuleExpression(JSON.parse(text), "the gallery data", { typed: false });
	return source.replace(line, () => `const data = ${expression};`);
}

/** The esbuild plugin: rewrites @openpresentation/gallery's dist/index.js and counts the modules it rewrote. */
export function compactGalleryPlugin(counter) {
	return {
		name: "compact-gallery",
		setup(context) {
			context.onLoad({ filter: /[\\/]gallery[\\/]dist[\\/]index\.js$/ }, async (args) => {
				const { readFile } = await import("node:fs/promises");
				counter.rewritten += 1;
				return { contents: compactGalleryModule(await readFile(args.path, "utf8")), loader: "js" };
			});
		},
	};
}
