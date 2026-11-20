import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { unzipSync } from "fflate";
import { BUNDLE_ZIP_DATE, packDirectory } from "../scripts/mcpb.mjs";

// RR-107: the Claude Desktop bundle is reproducible: its bytes (and so the published SHA-256) depend on its files only, never on
// the clock or on the files' own modification times.
test("packDirectory writes the same bytes for the same files, whenever they are packed", (t) => {
	const root = mkdtempSync(path.join(os.tmpdir(), "mcpb-pack-"));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	const directory = path.join(root, "stage");
	mkdirSync(path.join(directory, "server"), { recursive: true });
	writeFileSync(path.join(directory, "manifest.json"), '{"manifest_version":"0.3"}\n');
	writeFileSync(path.join(directory, "server", "index.js"), "export {};\n");
	writeFileSync(path.join(directory, "server", "index.js.map"), "{}");
	const first = path.join(root, "first.mcpb");
	const second = path.join(root, "second.mcpb");
	assert.equal(packDirectory(directory, first), 2, "source maps stay out, as with mcpb pack");
	utimesSync(path.join(directory, "manifest.json"), new Date(2030, 5, 1), new Date(2030, 5, 1));
	packDirectory(directory, second);
	assert.deepEqual(readFileSync(second), readFileSync(first));
	assert.deepEqual(Object.keys(unzipSync(readFileSync(first))).sort(), ["manifest.json", "server/index.js"]);
	assert.equal(BUNDLE_ZIP_DATE.getFullYear(), 1980);
	// The first local file header's DOS time and date: 00:00:00 on 1980-01-01 (date word 0x0021), not the time of packing.
	const bytes = readFileSync(first);
	assert.equal(bytes.readUInt32LE(0), 0x04034b50);
	assert.equal(bytes.readUInt16LE(10), 0);
	assert.equal(bytes.readUInt16LE(12), 0x0021);
});
