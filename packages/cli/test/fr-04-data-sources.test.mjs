// FR-04: data sources and a flat dataset in the CLI. `opf fix` rewrites a 0.36 `source` into the new keys, `opf validate --as-of` checks
// data freshness against a date the caller gives (the CLI never reads the clock for it), and `opf stats` counts data sources.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const executable = process.env.OPF_TEST_BIN ?? fileURLToPath(new URL("../dist/index.js", import.meta.url));
let temp;
before(async () => { temp = await mkdtemp(path.join(tmpdir(), "opf-cli-fr04-")); });
after(async () => { await rm(temp, { recursive: true, force: true }); });

const run = (args, { input, status = 0 } = {}) => {
	const result = spawnSync(process.execPath, [executable, ...args], { cwd: temp, input, encoding: "utf8", timeout: 60000 });
	assert.equal(result.status, status, JSON.stringify({ args, stdout: result.stdout, stderr: result.stderr }));
	return result;
};
const columns = ["Quarter", "Revenue"], rows = [["Q1", 12], ["Q2", 18]];
const deck = (extra) => ({ name: "Data", language: "en-US", slides: [{ id: "chart", title: "Revenue", chart: { type: "column", alt: "Revenue by quarter", data: { dataset: "revenue" } } }], ...extra });

describe("opf fix rewrites a 0.36 source", () => {
	test("a dataset's source becomes datasource, query and retrieved; fields is dropped and the fix says so", async () => {
		const old = deck({ datasets: { revenue: { columns, rows, source: { src: "./data/revenue.csv", sheet: "Q3 plan", range: "A1:B9", fields: ["Quarter", "Revenue"], retrieved: "2026-10-05" } } } });
		await writeFile(path.join(temp, "old.opf.json"), JSON.stringify(old));
		run(["validate", "old.opf.json"], { status: 1 });
		const result = JSON.parse(run(["fix", "old.opf.json", "fixed.opf.json"]).stdout);
		assert.equal(result.ok, true, JSON.stringify(result));
		const fixed = JSON.parse(await readFile(path.join(temp, "fixed.opf.json"), "utf8"));
		assert.deepEqual(fixed.datasets.revenue.datasource, { src: "./data/revenue.csv" });
		assert.equal(fixed.datasets.revenue.query, "'Q3 plan'!A1:B9");
		assert.equal(fixed.datasets.revenue.retrieved, "2026-10-05");
		assert.equal(fixed.datasets.revenue.source, undefined);
		assert.match(JSON.stringify(result), /fields is dropped/);
		run(["validate", "fixed.opf.json"]);
	});
});

describe("opf validate --as-of", () => {
	const withRefresh = deck({ datasources: { warehouse: { refreshEvery: "P1D" } }, datasets: { revenue: { columns, rows, datasource: "warehouse", retrieved: "2026-01-01" } } });
	const findings = (report) => JSON.parse(report.stdout).findings.map((finding) => finding.ruleId);

	test("without a date nothing is stale; with one a dataset older than its refreshEvery is a warning", async () => {
		await writeFile(path.join(temp, "stale.opf.json"), JSON.stringify(withRefresh));
		assert.equal(findings(run(["validate", "stale.opf.json", "--only", "content"])).includes("opf/dataset-stale"), false);
		assert.equal(findings(run(["validate", "stale.opf.json", "--only", "content", "--as-of", "2026-11-25"])).includes("opf/dataset-stale"), true);
		assert.equal(findings(run(["validate", "stale.opf.json", "--only", "content", "--as-of", "2026-01-01T12:00:00Z"])).includes("opf/dataset-stale"), false);
		run(["validate", "stale.opf.json", "--only", "content", "--as-of", "2026-11-25", "--fail-on", "warning"], { status: 1 });
	});

	test("the date must be an ISO 8601 date or date-time, and the config file may hold asOf", async () => {
		run(["validate", "stale.opf.json", "--as-of", "yesterday"], { status: 2 });
		run(["validate", "stale.opf.json", "--as-of", "2026-02-30"], { status: 2 });
		await writeFile(path.join(temp, "config.json"), JSON.stringify({ asOf: "2026-11-25" }));
		assert.equal(findings(run(["validate", "stale.opf.json", "--only", "content", "--config", "config.json"])).includes("opf/dataset-stale"), true);
	});

	test("an unknown data source is an error and a credential is a warning, without a date", async () => {
		const bad = deck({ datasources: { warehouse: { src: "https://analyst:hunter2@data.example.com/a.csv" } }, datasets: { revenue: { columns, rows, datasource: "wharehouse" } } });
		await writeFile(path.join(temp, "bad.opf.json"), JSON.stringify(bad));
		const report = run(["validate", "bad.opf.json", "--only", "format,content"], { status: 1 });
		const ids = findings(report);
		assert.ok(ids.includes("opf/datasource-unknown"), ids.join());
		assert.ok(ids.includes("opf/datasource-credentials"), ids.join());
		assert.doesNotMatch(report.stdout, /hunter2/, "the report never repeats the secret");
	});
});

describe("opf stats", () => {
	test("counts the datasets and charts that name a data source", () => {
		const document = deck({ datasources: { warehouse: {} }, datasets: { revenue: { columns, rows, datasource: "warehouse" } } });
		const stats = JSON.parse(run(["stats", "-"], { input: JSON.stringify(document) }).stdout).stats;
		assert.equal(stats.datasets.withDatasource, 1);
		assert.equal(stats.datasets.items[0].datasource, "warehouse");
		assert.match(run(["stats", "-", "--format", "text"], { input: JSON.stringify(document) }).stdout, /^Datasets {5,}1, 1 with a data source$/m);
	});
});
