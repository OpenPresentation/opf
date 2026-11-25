// RR-62: `opf ingest --into` is a pure function of its inputs. No clock, no randomness, no dependence on the working directory.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const executable = process.env.OPF_TEST_BIN ?? fileURLToPath(new URL("../dist/index.js", import.meta.url));
let temp, work, guard;
before(async () => {
	temp = await mkdtemp(path.join(tmpdir(), "opf-cli-rr62-"));
	work = path.join(temp, "work");
	await mkdir(path.join(work, "data"), { recursive: true });
	await writeFile(path.join(work, "data", "revenue.csv"), "Quarter,Revenue\nQ1,12\nQ2,18\n");
	await writeFile(path.join(work, "data", "costs.csv"), "Quarter,Cost\nQ1,4\nQ2,6\n");
	await writeFile(path.join(work, "deck.opf.json"), `${JSON.stringify({ name: "Deck", slides: [{ id: "intro", title: "Intro", text: "Hello" }] }, null, 2)}\n`);
	// Throws on any read of the clock or the random number generator, so a wall-clock or random value cannot reach the output.
	guard = path.join(temp, "no-clock.mjs");
	await writeFile(guard, `
const RealDate = globalThis.Date;
const fail = what => { throw new Error("clock or randomness read: " + what); };
globalThis.Date = new Proxy(RealDate, {
	construct: (target, args, newTarget) => (args.length === 0 ? fail("new Date()") : Reflect.construct(target, args, newTarget)),
	apply: () => fail("Date()"),
	get: (target, key) => (key === "now" ? () => fail("Date.now()") : Reflect.get(target, key)),
});
// pele, core's diagram engine, names the DOM ids of its own mount() once when it loads; OPF never mounts, so that value cannot
// reach any output. Only that read gets a constant; every other read still fails.
Math.random = () => (new Error().stack ?? "").includes("/pele/dist/") ? 0.5 : fail("Math.random()");
`);
});
after(async () => { await rm(temp, { recursive: true, force: true }); });

const run = (args, { cwd = work, input, status = 0, noClock = false } = {}) => {
	const node = noClock ? ["--import", pathToFileURL(guard).href] : [];
	const result = spawnSync(process.execPath, [...node, executable, ...args], { cwd, input, encoding: "utf8", timeout: 30000 });
	assert.equal(result.status, status, JSON.stringify({ args, stdout: result.stdout, stderr: result.stderr }));
	return result;
};
const read = file => readFile(path.join(work, file), "utf8");
const fresh = async name => { await writeFile(path.join(work, name), await read("deck.opf.json")); return name; };
const base = ["ingest", "data/revenue.csv", "--as", "chart", "--series", '["Revenue"]', "--dataset", "revenue"];

describe("opf ingest is deterministic", () => {
	test("the same inputs write identical bytes from any working directory, and src is relative to the deck", async () => {
		run([...base, "--into", "deck.opf.json", "one.json", "--force"]);
		run([...base, "--into", "deck.opf.json", "one.json", "--force"], { noClock: true });
		const first = await read("one.json");
		// Another working directory: every path is spelled differently, absolute and relative to the parent.
		const parent = temp;
		run(["ingest", "work/data/revenue.csv", "--as", "chart", "--series", '["Revenue"]', "--dataset", "revenue", "--into", "work/deck.opf.json", "work/two.json"], { cwd: parent, noClock: true });
		run(["ingest", path.join(work, "data", "revenue.csv"), "--as", "chart", "--series", '["Revenue"]', "--dataset", "revenue", "--into", path.join(work, "deck.opf.json"), path.join(work, "three.json")], { cwd: parent, noClock: true });
		assert.equal(await read("two.json"), first);
		assert.equal(await read("three.json"), first);
		const deck = JSON.parse(first);
		assert.deepEqual(deck.datasets.revenue.datasource, { src: "data/revenue.csv" });
			assert.equal(deck.datasets.revenue.sha256, createHash("sha256").update(await readFile(path.join(work, "data", "revenue.csv"))).digest("hex"), "sha256 is the hash of the data file's bytes");
			assert.equal(deck.datasets.revenue.source, undefined, "the nested source object is gone");
		assert.match(deck.slides[1].id, /^data-[0-9a-f]{8}$/);
		// stdout carries the same document
		assert.equal(run([...base, "--into", "deck.opf.json"], { cwd: work, noClock: true }).stdout, first);
	});

	test("src is deck-relative, with forward slashes, for a deck in another folder", async () => {
		await mkdir(path.join(work, "decks"), { recursive: true });
		await writeFile(path.join(work, "decks", "d.opf.json"), await read("deck.opf.json"));
		run([...base, "--into", "decks/d.opf.json", "--in-place"]);
		const deck = JSON.parse(await read("decks/d.opf.json"));
		assert.equal(deck.datasets.revenue.datasource.src, "../data/revenue.csv");
		assert.equal(deck.datasets.revenue.retrieved, undefined);
	});

	test("a second import of different data into the same deck gets a different id", async () => {
		const deck = await fresh("different.json");
		run(["ingest", "data/revenue.csv", "--as", "table", "--into", deck, "--in-place"]);
		run(["ingest", "data/costs.csv", "--as", "table", "--into", deck, "--in-place"]);
		const ids = JSON.parse(await read(deck)).slides.map(slide => slide.id);
		assert.equal(ids.length, 3);
		assert.equal(new Set(ids).size, 3);
		assert.match(ids[1], /^data-[0-9a-f]{8}$/);
		assert.match(ids[2], /^data-[0-9a-f]{8}$/);
		assert.doesNotMatch(ids[2], /-\d$/);
	});

	test("the import options and line endings: options change the id, CRLF does not", async () => {
		const deck = await fresh("options.json");
		const idOf = args => JSON.parse(run(["ingest", ...args, "--into", deck]).stdout).slides[1].id;
		const table = idOf(["data/revenue.csv", "--as", "table"]);
		assert.notEqual(table, idOf(["data/revenue.csv", "--as", "chart"]));
		await writeFile(path.join(work, "data", "revenue-crlf.csv"), "Quarter,Revenue\r\nQ1,12\r\nQ2,18\r\n");
		assert.equal(idOf(["data/revenue-crlf.csv", "--as", "table"]), table);
	});

	test("an id collision gets a numeric suffix", async () => {
		const deck = await fresh("collide.json");
		const args = ["ingest", "data/revenue.csv", "--as", "table", "--into", deck, "--in-place"];
		run(args); run(args); run(args);
		const ids = JSON.parse(await read(deck)).slides.map(slide => slide.id);
		assert.equal(ids[0], "intro");
		assert.match(ids[1], /^data-[0-9a-f]{8}$/);
		assert.equal(ids[2], `${ids[1]}-2`);
		assert.equal(ids[3], `${ids[1]}-3`);
	});

	test("--id names the slide, and a duplicate --id fails without writing", async () => {
		const deck = await fresh("named.json");
		run(["ingest", "data/revenue.csv", "--as", "table", "--into", deck, "--in-place", "--id", "revenue-table"]);
		assert.deepEqual(JSON.parse(await read(deck)).slides.map(slide => slide.id), ["intro", "revenue-table"]);
		const before = await read(deck);
		const failed = run(["ingest", "data/costs.csv", "--as", "table", "--into", deck, "--in-place", "--id", "revenue-table"], { status: 1 });
		assert.match(JSON.parse(failed.stderr).error, /already has a slide with id "revenue-table"/);
		run(["ingest", "data/costs.csv", "--as", "table", "--into", deck, "--in-place", "--id", "intro"], { status: 1 });
		assert.equal(await read(deck), before);
		run(["ingest", "data/costs.csv", "--as", "table", "--into", deck, "--path", "/slides/1/table", "--in-place", "--id", "x"], { status: 2 });
		assert.equal(JSON.parse(run(["ingest", "data/costs.csv", "--as", "table", "--id", "solo"]).stdout).slides[0].id, "solo");
	});

	test("--date sets retrieved; without it there is no retrieved field and a re-import drops an old one", async () => {
		const deck = await fresh("dated.json");
		const dated = JSON.parse(run([...base, "--into", deck, "--date", "2026-10-05"], { noClock: true }).stdout);
		assert.deepEqual(dated.datasets.revenue.datasource, { src: "data/revenue.csv" });
		assert.equal(dated.datasets.revenue.retrieved, "2026-10-05");
		const again = JSON.parse(run([...base, "--into", deck], { noClock: true }).stdout);
		assert.deepEqual(again.datasets.revenue.datasource, { src: "data/revenue.csv" });
		assert.equal(again.datasets.revenue.retrieved, undefined);
		// A re-import of the same file keeps the inline data source's other keys and the query; what described the old data goes.
		const old = { columns: ["a"], rows: [], datasource: { src: "data/revenue.csv", connector: "xlsx", description: "Finance export" }, query: "S!A1:B2", retrieved: "2020-01-01", version: "r1", sha256: "0".repeat(64), generator: { kind: "model", name: "m" }, title: "Kept" };
		await writeFile(path.join(work, "stale.json"), JSON.stringify({ name: "Stale", datasets: { revenue: old }, slides: [{ title: "T", table: { dataset: "revenue" } }] }));
		const kept = JSON.parse(run([...base, "--into", "stale.json"], { noClock: true }).stdout).datasets.revenue;
		assert.deepEqual(kept.datasource, { src: "data/revenue.csv", connector: "xlsx", description: "Finance export" });
		assert.equal(kept.query, "S!A1:B2");
		assert.equal(kept.title, "Kept");
		assert.deepEqual([kept.retrieved, kept.version, kept.generator], [undefined, undefined, undefined]);
		assert.match(kept.sha256, /^[0-9a-f]{64}$/);
		assert.notEqual(kept.sha256, old.sha256);
		// A different file: the data source describes the new origin only, and the old query does not apply to it.
		await writeFile(path.join(work, "other.json"), JSON.stringify({ name: "Other", datasets: { revenue: { ...old, datasource: { src: "data/costs.csv", connector: "xlsx" } } }, slides: [{ title: "T", table: { dataset: "revenue" } }] }));
		const moved = JSON.parse(run([...base, "--into", "other.json"], { noClock: true }).stdout).datasets.revenue;
		assert.deepEqual(moved.datasource, { src: "data/revenue.csv" });
		assert.equal(moved.query, undefined);
		// A data source named by id is the author's own description of the place: it stays, with its query.
		await writeFile(path.join(work, "named.json"), JSON.stringify({ name: "Named", datasources: { warehouse: { connector: "csv" } }, datasets: { revenue: { ...old, datasource: "warehouse" } }, slides: [{ title: "T", table: { dataset: "revenue" } }] }));
		const named = JSON.parse(run([...base, "--into", "named.json"], { noClock: true }).stdout);
		assert.equal(named.datasets.revenue.datasource, "warehouse");
		assert.equal(named.datasets.revenue.query, "S!A1:B2");
		assert.deepEqual(named.datasources, { warehouse: { connector: "csv" } });
		// no --dataset: there is no data source record to date
		assert.equal(JSON.parse(run(["ingest", "data/revenue.csv", "--as", "table", "--into", deck], { noClock: true }).stdout).datasets, undefined);
	});

	test("--date must be a real calendar date and goes with --dataset", () => {
		run([...base, "--date", "2026-02-30"], { status: 2 });
		run([...base, "--date", "yesterday"], { status: 2 });
		run([...base, "--date"], { status: 2 });
		run(["ingest", "data/revenue.csv", "--as", "table", "--date", "2026-10-05"], { status: 2 });
	});

	test("the clock guard really trips on a clock read", () => {
		const probe = spawnSync(process.execPath, ["--import", pathToFileURL(guard).href, "-e", "new Date()"], { encoding: "utf8" });
		assert.notEqual(probe.status, 0);
		assert.match(probe.stderr, /clock or randomness read/);
		const withArgs = spawnSync(process.execPath, ["--import", pathToFileURL(guard).href, "-e", "console.log(new Date('2026-10-05T00:00:00Z').toISOString())"], { encoding: "utf8" });
		assert.equal(withArgs.status, 0);
	});
});

describe("opf import-data was removed in 0.18", () => {
	test("import-data is a usage error that names ingest (no alias) and the help names ingest", () => {
		const result = run(["import-data", "data/revenue.csv", "--as", "table"], { status: 2 });
		assert.match(result.stderr, /import-data was renamed opf ingest/);
		assert.equal(JSON.parse(result.stderr).code, "removed-command");
		assert.equal(result.stdout, "");
		const usage = run(["--help"]).stdout;
		assert.match(usage, /opf ingest </);
		assert.doesNotMatch(usage, /import-data/);
	});
});
