// The bundle's installed dependency graph owns font resolution. Use a file URL for dynamic ESM import on every OS,
// including Windows, where a resolved drive-letter path is not an ESM URL.
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

export async function bundledFontFiles(directory) {
	const require = createRequire(path.join(directory, "package.json"));
	const fonts = await import(pathToFileURL(require.resolve("@openpresentation/opf-render/fonts-node")).href);
	const keep = new Set((await fonts.loadFonts({ pack: "office" })).fontFiles.map((file) => path.resolve(file)));
	const renderRequire = createRequire(require.resolve("@openpresentation/opf-render/package.json"));
	for (const pkg of fonts.scriptFontPackages("all")) {
		let root;
		try { root = path.dirname(renderRequire.resolve(`${pkg.name}/package.json`)); } catch { continue; }
		for (const face of pkg.faces) keep.add(path.resolve(root, face.file));
	}
	return [...keep];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	process.stdout.write(JSON.stringify(await bundledFontFiles(process.cwd())));
}
