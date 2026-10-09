// RR-66: Windows path bugs in the opf command, checked on every OS in a working folder whose name has a space.
// - Two names for one file: commands compared resolved path strings, so on a case-insensitive file system (Windows, macOS by
//   default) `out.opf.json` and `OUT.opf.json` were "different" files, and so were two hard links to one file. merge --report
//   then overwrote the merged deck, and format --output <the input in another case> refused to write without --force.
// - Data formats by extension: import-data and fill read `.json`/`.tsv` case-sensitively, so a `DATA.TSV` was parsed as CSV.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { link, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

const executable = process.env.OPF_TEST_BIN ?? fileURLToPath(new URL("../dist/index.js", import.meta.url));
let work, caseInsensitive;
before(async () => {
	work = await mkdtemp(path.join(tmpdir(), "opf cli rr66 "));
	await writeFile(path.join(work, "probe-case"), "");
	caseInsensitive = existsSync(path.join(work, "PROBE-CASE"));
});
after(() => rm(work, { recursive: true, force: true }));

const opf = (...args) => spawnSync(process.execPath, [executable, ...args], { cwd: work, encoding: "utf8" });
const deck = (title) => `${JSON.stringify({ name: "Deck", slides: [{ id: "s1", title }] }, null, 2)}\n`;

test("merge refuses a --report that is the merged output under another name", async () => {
	await writeFile(path.join(work, "base.opf.json"), deck("Base"));
	await writeFile(path.join(work, "ours.opf.json"), deck("Ours"));
	await writeFile(path.join(work, "theirs.opf.json"), deck("Base"));
	await writeFile(path.join(work, "merged.opf.json"), deck("Earlier"));
	// A hard link names the same file on every OS (NTFS, APFS, ext4) without symlink privileges.
	await link(path.join(work, "merged.opf.json"), path.join(work, "merged-link.json"));
	const linked = opf("merge", "base.opf.json", "ours.opf.json", "theirs.opf.json", "--output", "merged.opf.json", "--force", "--report", "merged-link.json");
	assert.equal(linked.status, 2, linked.stdout + linked.stderr);
	assert.match(JSON.parse(linked.stderr).error, /--report must be a file different from the merged output/);
	assert.equal(await readFile(path.join(work, "merged.opf.json"), "utf8"), deck("Earlier"), "nothing is written");
	if (caseInsensitive) {
		const cased = opf("merge", "base.opf.json", "ours.opf.json", "theirs.opf.json", "--output", "merged.opf.json", "--force", "--report", "MERGED.opf.json");
		assert.equal(cased.status, 2, cased.stdout + cased.stderr);
		assert.match(JSON.parse(cased.stderr).error, /--report must be a file different/);
	}
	// Different files are still fine.
	const fine = opf("merge", "base.opf.json", "ours.opf.json", "theirs.opf.json", "--output", "merged.opf.json", "--force", "--report", "merge-report.json");
	assert.equal(fine.status, 0, fine.stderr);
	assert.equal(JSON.parse(await readFile(path.join(work, "merged.opf.json"), "utf8")).slides[0].title, "Ours");
});

test("format --output naming its input in another case rewrites it as the same file", async (t) => {
	if (!caseInsensitive) return t.skip("case-sensitive file system: Deck.json and deck.json are two files here");
	await writeFile(path.join(work, "format-me.opf.json"), JSON.stringify({ slides: [{ title: "Compact" }], name: "Deck" }));
	const result = opf("format", "format-me.opf.json", "--output", "FORMAT-ME.opf.json");
	assert.equal(result.status, 0, result.stderr);
	assert.equal(JSON.parse(result.stdout).changed, true);
	assert.match(await readFile(path.join(work, "format-me.opf.json"), "utf8"), /\n {2}"name": "Deck"/);
});

test("a data file's extension names its format in any case", async () => {
	await writeFile(path.join(work, "DATA.TSV"), "Quarter\tRevenue\nQ1\t12\nQ2\t18\n");
	const imported = opf("import-data", "DATA.TSV", "--as", "table");
	assert.equal(imported.status, 0, imported.stderr);
	const table = JSON.parse(imported.stdout).slides.at(-1).table;
	assert.deepEqual(table.columns, ["Quarter", "Revenue"]);
	assert.deepEqual(table.rows, [["Q1", "12"], ["Q2", "18"]]);
	await writeFile(path.join(work, "template.opf.json"), JSON.stringify({ name: "T", variables: { who: { type: "text" } }, slides: [{ id: "s1", title: "Hello {{who}}" }] }));
	await writeFile(path.join(work, "PEOPLE.TSV"), "who\tnote\nAda, Countess\tfirst\n");
	const filled = opf("fill", "template.opf.json", "--data", "PEOPLE.TSV");
	assert.equal(filled.status, 0, filled.stderr);
	assert.equal(JSON.parse(filled.stdout).slides[0].title, "Hello Ada, Countess");
});
