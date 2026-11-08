import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { loadFonts } from "@openpresentation/opf-render/fonts-node";

// Run the exact bundle pruning entry point against the installed renderer. This exercises a native Windows drive path
// (and POSIX paths on other runners), instead of merely asserting that a file-URL helper appears in the source.
test("the bundle font subprocess imports its installed renderer and keeps every Office font", async () => {
	const script = fileURLToPath(new URL("../scripts/mcpb-font-files.mjs", import.meta.url));
	const directory = fileURLToPath(new URL("../", import.meta.url));
	const files = JSON.parse(execFileSync(process.execPath, [script], { cwd: directory, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }));
	const expected = (await loadFonts({ pack: "office" })).fontFiles;
	assert.ok(expected.length > 0);
	assert.equal(new Set(files).size, files.length);
	assert.ok(files.every((file) => path.isAbsolute(file) && existsSync(file)));
	for (const file of expected) assert.ok(files.includes(path.resolve(file)), file);
});
