// `opf schemas`, `opf schema` and `opf --version` name the @openpresentation/opf version a schema came from (docs/schema-versioning.md), and
// the agent-facing chart and layout findings read through the CLI's text report.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const BIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist/index.js");
const run = (args) => spawnSync(process.execPath, [BIN, ...args], { encoding: "utf8" });
const core = JSON.parse(run(["--version"]).stdout);

test("--version names the schema id next to the core version", () => {
	assert.match(core.opf, /^\d+\.\d+\.\d+/);
	assert.equal(core.schema, "https://openpresentation.org/schema/opf/v1");
});

test("opf schemas lists the core version beside every schema id", () => {
	const result = run(["schemas"]);
	assert.equal(result.status, 0, result.stderr);
	const entries = JSON.parse(result.stdout);
	assert.ok(entries.length > 0);
	for (const entry of entries) {
		assert.equal(entry.version, core.opf, entry.name);
		assert.match(entry.id, /^https:\/\/openpresentation\.org\/schema\//);
	}
});

test("a whole schema names its release in $comment, a part of it is printed unchanged", () => {
	const whole = JSON.parse(run(["schema"]).stdout);
	assert.match(whole.$comment, /pre-1\.0 line/);
	assert.ok(whole.$comment.endsWith(`This copy is from @openpresentation/opf ${core.opf}.`), whole.$comment);
	assert.equal(whole.$id, "https://openpresentation.org/schema/opf/v1");
	const chart = JSON.parse(run(["schema", "presentation", "/$defs/Chart"]).stdout);
	assert.equal(chart.$comment, undefined);
	assert.match(chart.description, /"columns"/);
});

test("validate --format text shows the chart conversion and the nearest layouts as hints", async () => {
	const directory = await mkdtemp(path.join(tmpdir(), "opf-guidance-"));
	const chart = path.join(directory, "chart.opf.json");
	await writeFile(chart, JSON.stringify({ name: "t", language: "en-US", slides: [{ title: "Decks", chart: { type: "bar", categories: ["Q1", "Q2", "Q3"], series: [{ name: "Decks", values: [3, 8, 21] }] } }] }));
	const charted = run(["validate", chart, "--format", "text"]);
	assert.equal(charted.status, 1);
	assert.equal((charted.stdout.match(/opf\/schema/g) ?? []).length, 1, charted.stdout);
	assert.match(charted.stdout, /"columns": \["Category","Decks"\]/);
	assert.match(charted.stdout, /\[\["Q1",3\],\["Q2",8\],\["Q3",21\]\]/);
	const layout = path.join(directory, "layout.opf.json");
	await writeFile(layout, JSON.stringify({ name: "t", language: "en-US", slides: [{ title: "Hello", layout: "two-colum", text: "Body" }] }));
	assert.equal(run(["validate", layout]).status, 0, "a made-up layout id is a warning by default");
	const strict = run(["validate", layout, "--format", "text", "--fail-on", "warning"]);
	assert.equal(strict.status, 1, "--fail-on warning is the done check");
	assert.match(strict.stdout, /Did you mean 'two-column'\?/);
});
