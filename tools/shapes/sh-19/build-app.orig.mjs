#!/usr/bin/env node
// Build the deck view (the MCP App behind show_deck, ui://opf/deck) into one HTML file: app-dist/deck-app.html. tsup then inlines
// it into dist as the text of the resource. Everything is in the file, because the host's sandbox loads nothing else: the
// script (app/main.ts with the OPF editor, renderer and validators), the editor's styles and the view's, and Roboto Regular.
//
// The sandbox's CSP has no 'unsafe-eval' and no 'wasm-unsafe-eval': the bundle takes core's precompiled validators (the `worker`
// condition of @openpresentation/opf's #schema-engine import) and loads no WASM (no subsetWasm or shapeWasm is given to the fonts).
// app-dist/deck-fonts.json lists the font files the view may ask read_font_file for; the tests check that opf-mcp serves each.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { build } from "esbuild";

const require = createRequire(import.meta.url);
const here = new URL("../", import.meta.url);
const out = new URL("app-dist/", here);
const manifest = JSON.parse(await readFile(new URL("package.json", here), "utf8"));

/** The file name read_font_file serves an eager Office face under (src/stdio.ts names them the same way). */
export const embeddedFontFile = (face) => `embedded/${face.family.replace(/[^A-Za-z0-9]+/g, "-")}-${face.weight}-${face.italic ? "italic" : "normal"}.ttf`;

// The fonts: Roboto Regular (the renderer's fallback face) in the page; the other eager faces of the Office pack by file and
// pinned SHA-256, so the view asks for one only when a deck draws it. The vendored faces (Intos, the open families) and the script
// faces are the renderer's own manifests, which the bundle already carries.
const renderFonts = await import("@openpresentation/opf-render/fonts-node");
const office = await renderFonts.loadFonts({ pack: "office" });
const isStartup = (face) => face.family === "Roboto" && face.weight === 400 && !face.italic;
const licenses = [];
const licenseIndex = (text) => {
	const at = licenses.indexOf(text);
	return at >= 0 ? at : licenses.push(text) - 1;
};
const fonts = { startup: [], extra: [], licenses };
for (const face of office.registry.embeddedFonts) {
	const data = face.dataUrl.slice(face.dataUrl.indexOf(",") + 1);
	if (isStartup(face)) fonts.startup.push({ family: face.family, weight: face.weight, italic: Boolean(face.italic), license: face.license, data });
	else fonts.extra.push({ family: face.family, weight: face.weight, italic: Boolean(face.italic), license: licenseIndex(face.license), sha256: createHash("sha256").update(Buffer.from(data, "base64")).digest("hex"), file: embeddedFontFile(face) });
}
if (fonts.startup.length !== 1) throw new Error("The Office font pack has no Roboto Regular face to start the deck view with.");

const bundle = await build({
	entryPoints: [new URL("app/main.ts", here).pathname],
	bundle: true,
	write: false,
	format: "esm",
	platform: "browser",
	// `worker` picks core's precompiled validators (no code generated at run time); `module` is esbuild's default for the browser.
	conditions: ["worker", "module"],
	target: "es2022",
	minify: true,
	legalComments: "eof",
	define: { MCP_VERSION: JSON.stringify(manifest.version), OPF_DECK_FONTS: JSON.stringify(fonts) },
	logLevel: "warning",
	// tsup's chunks of core are imported bare for their order only; they are pure, so dropping the bare import changes nothing.
	logOverride: { "ignored-bare-import": "silent" },
});
const script = bundle.outputFiles[0].text;
// The sandbox refuses code generated from strings: a bundle that calls the Function constructor or eval would break there.
for (const pattern of [/\bnew Function\(/, /\beval\(/]) {
	const found = pattern.exec(script);
	if (found) console.warn(`build-app: the bundle contains ${found[0]} (at ${found.index}); the deck view's CSP forbids it, so that code path must never run.`);
}

const styles = [await readFile(require.resolve("@openpresentation/opf-editor/styles.css"), "utf8"), await readFile(new URL("app/view.css", here), "utf8")].join("\n");
const template = await readFile(new URL("app/index.html", here), "utf8");
// Inline text must not close its element early.
const html = template.replace("/*OPF_CSS*/", () => styles.replaceAll("</style", "<\\/style")).replace("/*OPF_JS*/", () => script.replaceAll("</script", "<\\/script"));

await mkdir(out, { recursive: true });
await writeFile(new URL("deck-app.html", out), html);
await writeFile(new URL("deck-fonts.json", out), `${JSON.stringify({ extra: fonts.extra.map(({ license: _license, ...face }) => face) }, null, 2)}\n`);
const kib = (bytes) => `${Math.round(bytes / 1024)} KiB`;
console.log(`build-app: app-dist/deck-app.html ${kib(Buffer.byteLength(html))} (script ${kib(Buffer.byteLength(script))}, styles ${kib(Buffer.byteLength(styles))}, ${fonts.extra.length} faces on request)`);
