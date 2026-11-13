import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";

// RR-105 (coverage findings 05 and 22): `opf validate` reads the SVG files a deck's icons name from the folder `opf convert` reads them
// from, so both report the same icons: a nested list's first-level icons are drawn (no finding), its nested entries' icons are reported
// icon-dropped by both, file icons included.
const here = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.resolve(here, "../dist/index.js");
const dir = mkdtempSync(path.join(tmpdir(), "opf-file-icons-"));
after(() => rmSync(dir, { recursive: true, force: true }));
const run = (args) => spawnSync(process.execPath, [CLI, ...args], { cwd: dir, encoding: "utf8", timeout: 120000 });
const MARK = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M4 12l5 5L20 6" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
writeFileSync(path.join(dir, "mark.svg"), MARK);
const deck = {
	language: "en-US",
	icons: { brand: "./mark.svg" },
	slides: [
		{
			title: "Icons",
			items: [
				{ text: "Alpha", icon: "brand" },
				{ text: "Beta", level: 1, icon: "./mark.svg" },
				{ text: "Delta", icon: "./mark.svg" },
				{ text: "Epsilon", level: 1, icon: "brand" },
			],
		},
	],
};
writeFileSync(path.join(dir, "icons.opf.json"), JSON.stringify(deck));
const dropped = (report) => report.findings.filter((finding) => /\/icon-dropped$/.test(finding.ruleId)).map((finding) => finding.path);

test("validate and convert report the same dropped icons, SVG files included", () => {
	const validated = run(["validate", "icons.opf.json"]);
	assert.equal(validated.status, 0, validated.stderr);
	const converted = run(["convert", "icons.opf.json", "icons.pptx", "--force"]);
	assert.equal(converted.status, 0, converted.stderr);
	const expected = ["/slides/0/items/1/icon", "/slides/0/items/3/icon"];
	assert.deepEqual(dropped(JSON.parse(validated.stdout)), expected);
	assert.deepEqual(dropped(JSON.parse(converted.stdout)), expected);
});
