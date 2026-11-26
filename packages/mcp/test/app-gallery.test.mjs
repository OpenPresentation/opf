// The viewer's gallery rewrite (scripts/app-gallery.mjs): @openpresentation/gallery's records, written in the viewer as a
// compact expression instead of a JSON string, are the same values, frozen to the same depth, and nothing else in the module
// changes.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import * as shipped from "@openpresentation/gallery";
import { compactGalleryModule } from "../scripts/app-gallery.mjs";

const require = createRequire(import.meta.url);
const galleryFile = require.resolve("@openpresentation/gallery").replace(/[\\/]dist[\\/].*$/, "/dist/index.js");
const source = readFileSync(galleryFile, "utf8");
const importText = (text) => import(`data:text/javascript;base64,${Buffer.from(text).toString("base64")}`);

test("the rewritten gallery module exports the same values, frozen to the same depth", async () => {
	const rewritten = compactGalleryModule(source);
	assert.ok(Buffer.byteLength(JSON.stringify(rewritten)) < Buffer.byteLength(JSON.stringify(source)) - 100_000, "the rewrite saves frame bytes");
	const before = await importText(source);
	const after = await importText(rewritten);
	assert.deepEqual(Object.keys(after), Object.keys(shipped));
	const depthFrozen = (value, depth) => depth === 0 || value === null || typeof value !== "object" || (Object.isFrozen(value) && Object.values(value).every((child) => depthFrozen(child, depth - 1)));
	for (const name of Object.keys(before)) {
		assert.equal(JSON.stringify(after[name]), JSON.stringify(before[name]), name);
		assert.equal(JSON.stringify(after[name]), JSON.stringify(shipped[name]), name);
	}
	for (const [name, depth] of [["gallery", 3], ["catalogDisplay", 3], ["catalogIndexes", 1], ["catalogManifest", 1]]) {
		assert.ok(depthFrozen(after[name], depth), `${name} is frozen to depth ${depth}`);
		// Below that depth the records' values stay as mutable as JSON.parse made them.
		assert.equal(Object.isFrozen(after[name]), Object.isFrozen(before[name]), name);
	}
	const layout = Object.values(after.gallery.layouts)[0];
	const nested = Object.values(layout).find((value) => value && typeof value === "object");
	assert.equal(Object.isFrozen(nested), Object.isFrozen(Object.values(Object.values(before.gallery.layouts)[0]).find((value) => value && typeof value === "object")));
	// Only the data line changes.
	const otherLines = (text) => text.split("\n").filter((line) => !line.startsWith("const data = "));
	assert.deepEqual(otherLines(rewritten), otherLines(source));
});

test("the rewrite stops unless the module has exactly one data line", () => {
	assert.throws(() => compactGalleryModule("export const a = 1;\n"), /found 0/);
	const line = 'const data = JSON.parse("{\\"a\\":1}");';
	assert.throws(() => compactGalleryModule(`${line}\n${line}\n`), /found 2/);
	assert.match(compactGalleryModule(`${line}\nexport { data };\n`), /^const data = \{"a":1\};$/m);
});
