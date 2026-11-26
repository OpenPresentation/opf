// FR-05: typed dataset columns in the CLI. `opf ingest --dataset` declares the type and role of the dataset columns it writes from their cells and
// stores the cells as that type, `opf fix --audits` stores a mismatched cell in its declared type, and `opf validate` reports data-cell-type.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const executable = process.env.OPF_TEST_BIN ?? fileURLToPath(new URL("../dist/index.js", import.meta.url));
let temp;
before(async () => { temp = await mkdtemp(path.join(tmpdir(), "opf-cli-fr05-")); });
after(async () => { await rm(temp, { recursive: true, force: true }); });

const run = (args, { input, status = 0 } = {}) => {
	const result = spawnSync(process.execPath, [executable, ...args], { cwd: temp, input, encoding: "utf8", timeout: 60000 });
	assert.equal(result.status, status, JSON.stringify({ args, stdout: result.stdout, stderr: result.stderr }));
	return result;
};

describe("opf ingest --dataset", () => {
	test("a new column declares the type and role its cells say, and typed cells are stored as that type", async () => {
		await writeFile(path.join(temp, "sales.csv"), "Month,Region,Revenue,On plan,Notes\n2026-09,EMEA,11500,true,\n2026-10,APAC,12100,false,\n2026-11,EMEA,,true,\n");
		const deck = JSON.parse(run(["ingest", "sales.csv", "--as", "table", "--dataset", "sales"]).stdout);
		assert.deepEqual(deck.datasets.sales.columns, [
			{ name: "Month", type: "date", role: "dimension" },
			{ name: "Region", type: "text", role: "dimension" },
			{ name: "Revenue", type: "number", role: "measure" },
			{ name: "On plan", type: "boolean", role: "dimension" },
			"Notes",
		]);
		assert.deepEqual(deck.datasets.sales.rows, [["2026-09", "EMEA", 11500, true, ""], ["2026-10", "APAC", 12100, false, ""], ["2026-11", "EMEA", null, true, ""]]);
		await writeFile(path.join(temp, "sales.opf.json"), JSON.stringify(deck));
		const report = JSON.parse(run(["validate", "sales.opf.json"]).stdout);
		assert.equal(report.findings.some((finding) => finding.ruleId === "opf/data-cell-type"), false, "a typed column ingest writes never warns");
	});

	test("a re-import keeps what the dataset already declares, and a plain string column stays a plain string", async () => {
		const before = { name: "Sales", language: "en-US", datasets: { sales: { columns: ["Month", { name: "Revenue", format: "$#,##0", type: "number", unit: "USD" }], rows: [["old", 1]] } }, slides: [{ title: "Sales", table: { dataset: "sales" } }] };
		await writeFile(path.join(temp, "before.opf.json"), JSON.stringify(before));
		await writeFile(path.join(temp, "again.csv"), "Month,Revenue,Region\n2026-09,11500,EMEA\n");
		const after = JSON.parse(run(["ingest", "again.csv", "--as", "table", "--dataset", "sales", "--into", "before.opf.json"]).stdout);
		assert.deepEqual(after.datasets.sales.columns, ["Month", { name: "Revenue", format: "$#,##0", type: "number", unit: "USD" }, { name: "Region", type: "text", role: "dimension" }]);
		assert.deepEqual(after.datasets.sales.rows, [["2026-09", 11500, "EMEA"]]);
	});

	test("inline chart data stays plain strings", () => {
		const deck = JSON.parse(run(["ingest", "-", "--as", "chart"], { input: "Quarter,Revenue\nQ1,12\nQ2,18\n" }).stdout);
		assert.deepEqual(deck.slides[0].chart.data.columns, ["Quarter", "Revenue"]);
	});
});

describe("data-cell-type", () => {
	const broken = { name: "Typed", language: "en-US", datasets: { d: { columns: [{ name: "Month", type: "date" }, { name: "Revenue", type: "number" }], rows: [["2026-09", 11500], ["2026-10", "12100"], ["2026-11", "12%"]] } }, slides: [{ title: "Revenue", table: { dataset: "d" } }] };

	test("validate warns at the cell and fix --audits stores the convertible one, leaving the other", async () => {
		await writeFile(path.join(temp, "broken.opf.json"), JSON.stringify(broken));
		const report = JSON.parse(run(["validate", "broken.opf.json"]).stdout);
		const found = report.findings.filter((finding) => finding.ruleId === "opf/data-cell-type");
		assert.deepEqual(found.map((finding) => finding.path), ["/datasets/d/rows/1/1", "/datasets/d/rows/2/1"]);
		run(["fix", "broken.opf.json", "plain.opf.json"]);
		assert.equal(JSON.parse(await readFile(path.join(temp, "plain.opf.json"), "utf8")).datasets.d.rows[1][1], "12100", "a repair-only fix never restyles content");
		run(["fix", "broken.opf.json", "fixed.opf.json", "--audits"]);
		const fixed = JSON.parse(await readFile(path.join(temp, "fixed.opf.json"), "utf8"));
		assert.deepEqual(fixed.datasets.d.rows, [["2026-09", 11500], ["2026-10", 12100], ["2026-11", "12%"]]);
		assert.deepEqual(fixed.datasets.d.columns, broken.datasets.d.columns);
	});
});
