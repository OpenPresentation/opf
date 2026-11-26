// The viewer's data rewrites (scripts/app-data.mjs): @openpresentation/gallery's records and the renderer's bundled font
// manifest, written in the viewer as compact expressions instead of JSON text, are the same values, frozen the same way, and
// nothing else in either module changes.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import * as shippedGallery from "@openpresentation/gallery";
import { BUNDLED_FONT_MANIFEST } from "@openpresentation/opf-render/fonts-node";
import { compactFontManifestModule, compactGalleryModule } from "../scripts/app-data.mjs";

const require = createRequire(import.meta.url);
const distFile = (name, file) => require.resolve(name).replace(/[\\/]dist[\\/].*$/, `/dist/${file}`);
const gallerySource = readFileSync(distFile("@openpresentation/gallery", "index.js"), "utf8");
const manifestSource = readFileSync(distFile("@openpresentation/opf-render", "font-manifest.js"), "utf8");
const importText = (text) => import(`data:text/javascript;base64,${Buffer.from(text).toString("base64")}`);
const frameBytes = (text) => Buffer.byteLength(JSON.stringify(text));
const deepFrozen = (value, depth = Infinity) => depth === 0 || value === null || typeof value !== "object" || (Object.isFrozen(value) && Object.values(value).every((child) => deepFrozen(child, depth - 1)));

test("the rewritten gallery module exports the same values, frozen to the same depth", async () => {
	const rewritten = compactGalleryModule(gallerySource);
	assert.ok(frameBytes(rewritten) < frameBytes(gallerySource) - 100_000, "the rewrite saves frame bytes");
	const before = await importText(gallerySource);
	const after = await importText(rewritten);
	assert.deepEqual(Object.keys(after), Object.keys(shippedGallery));
	for (const name of Object.keys(before)) {
		assert.equal(JSON.stringify(after[name]), JSON.stringify(before[name]), name);
		assert.equal(JSON.stringify(after[name]), JSON.stringify(shippedGallery[name]), name);
	}
	for (const [name, depth] of [["gallery", 3], ["catalogDisplay", 3], ["catalogIndexes", 1], ["catalogManifest", 1]]) {
		assert.ok(deepFrozen(after[name], depth), `${name} is frozen to depth ${depth}`);
	}
	// Below that depth a record's values stay as mutable as JSON.parse made them.
	const nested = (module) => Object.values(Object.values(module.gallery.layouts)[0]).find((value) => value && typeof value === "object");
	assert.equal(Object.isFrozen(nested(after)), Object.isFrozen(nested(before)));
	assert.equal(Object.isFrozen(nested(after)), false);
	// Only the data line changes.
	const otherLines = (text) => text.split("\n").filter((line) => !line.startsWith("const data = "));
	assert.deepEqual(otherLines(rewritten), otherLines(gallerySource));
});

test("the rewritten font manifest module exports the same manifest, deeply frozen", async () => {
	const rewritten = compactFontManifestModule(manifestSource);
	assert.ok(frameBytes(rewritten) < frameBytes(manifestSource) - 15_000, "the rewrite saves frame bytes");
	const after = await importText(rewritten);
	assert.deepEqual(Object.keys(after), ["BUNDLED_FONT_MANIFEST"]);
	assert.equal(JSON.stringify(after.BUNDLED_FONT_MANIFEST), JSON.stringify(BUNDLED_FONT_MANIFEST));
	assert.ok(deepFrozen(after.BUNDLED_FONT_MANIFEST) && deepFrozen(BUNDLED_FONT_MANIFEST));
	// Only the manifest statement changes: the lines before it are the same.
	const head = (text) => text.slice(0, text.indexOf("export const BUNDLED_FONT_MANIFEST="));
	assert.equal(head(rewritten), head(manifestSource));
});

test("each rewrite stops unless its module has exactly one such value", () => {
	assert.throws(() => compactGalleryModule("export const a = 1;\n"), /found 0/);
	const line = 'const data = JSON.parse("{\\"a\\":1}");';
	assert.throws(() => compactGalleryModule(`${line}\n${line}\n`), /found 2/);
	assert.match(compactGalleryModule(`${line}\nexport { data };\n`), /^const data = \{"a":1\};$/m);
	assert.throws(() => compactFontManifestModule("export const BUNDLED_FONT_MANIFEST={};\n"), /found 0/);
	assert.match(compactFontManifestModule('export const BUNDLED_FONT_MANIFEST=freeze({\n  "a": 1\n});\n'), /^export const BUNDLED_FONT_MANIFEST=freeze\(\{"a":1\}\);$/m);
});
