import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_BIN = path.resolve(__dirname, "../dist/index.js");
const TEMPLATE = path.resolve(__dirname, "fixtures/template.opf.json");

const run = (args, options = {}) => spawnSync(process.execPath, [CLI_BIN, ...args], { encoding: "utf8", ...options });
const temp = await mkdtemp(path.join(tmpdir(), "opf-fill-"));
after(() => rm(temp, { recursive: true, force: true }));
const file = async (name, text) => {
  const target = path.join(temp, name);
  await writeFile(target, text);
  return target;
};

describe("opf fill", () => {
  test("a template validates as incomplete, not invalid", () => {
    const result = run(["validate", TEMPLATE]);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.valid, true);
    assert.equal(report.template, true);
    assert.deepEqual(report.unfilledVariables, ["client", "revenue", "kickoff", "wins"]);
  });

  test("fills one JSON object into one deck on stdout", async () => {
    const data = await file("one.json", JSON.stringify({ client: "Globex", revenue: 1250000, kickoff: "2026-10-01", wins: ["Shipped v2", "Won renewal"] }));
    const result = run(["fill", TEMPLATE, "--data", data]);
    assert.equal(result.status, 0, result.stderr);
    const deck = JSON.parse(result.stdout);
    assert.equal("template" in deck, false);
    assert.equal(deck.slides[0].title, "Quarterly review: Globex");
    assert.equal(deck.slides[0].subtitle, "Kickoff October 1, 2026");
    assert.deepEqual(deck.slides[1].bullets, ["Revenue $1,250,000", "Shipped v2", "Won renewal"]);
    assert.equal(deck.slides[2].chart.data.rows[0][1], 1250000);
    const report = JSON.parse(result.stderr);
    assert.equal(report.valid, true);
    assert.equal(report.fill.complete, true);
  });

  test("an unfilled required variable fails, and --partial keeps the rest of the template", async () => {
    const data = await file("partial.json", JSON.stringify({ client: "Globex" }));
    const failed = run(["fill", TEMPLATE, "--data", data]);
    assert.equal(failed.status, 1);
    assert.match(JSON.parse(failed.stderr).error, /revenue/);
    const partial = run(["fill", TEMPLATE, "--data", data, "--partial"]);
    assert.equal(partial.status, 0, partial.stderr);
    const deck = JSON.parse(partial.stdout);
    assert.equal(deck.template, true);
    assert.deepEqual(Object.keys(deck.variables).sort(), ["kickoff", "revenue", "wins"]);
    assert.equal(deck.slides[0].title, "Quarterly review: Globex");
    assert.deepEqual(JSON.parse(partial.stderr).fill.unfilled, ["revenue", "kickoff", "wins"]);
  });

  test("--examples previews a template with no data", () => {
    const result = run(["fill", TEMPLATE, "--examples"]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).slides[0].title, "Quarterly review: Acme Corp");
  });

  test("one deck per CSV row with --out-dir, names from a column, blanks use the declared value", async () => {
    const csv = await file("rows.csv", ['client,revenue,kickoff,wins', 'Globex,1250000,2026-10-01,"Shipped v2\nWon renewal"', '"Initech, Inc.",980000.5,2026-11-15,"One"', ""].join("\n"));
    const outDir = path.join(temp, "decks");
    const result = run(["fill", TEMPLATE, "--data", csv, "--out-dir", outDir, "--name", "qbr-{client}"]);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.records, 2);
    assert.deepEqual((await readdir(outDir)).sort(), ["qbr-globex.opf.json", "qbr-initech-inc.opf.json"]);
    const second = JSON.parse(await readFile(path.join(outDir, "qbr-initech-inc.opf.json"), "utf8"));
    assert.equal(second.slides[0].title, "Quarterly review: Initech, Inc.");
    assert.deepEqual(second.slides[1].bullets, ["Revenue $980,000.5", "One"]);
    // Existing outputs are never replaced without --force.
    assert.equal(run(["fill", TEMPLATE, "--data", csv, "--out-dir", outDir, "--name", "qbr-{client}"]).status, 1);
    assert.equal(run(["fill", TEMPLATE, "--data", csv, "--out-dir", outDir, "--name", "qbr-{client}", "--force"]).status, 0);
  });

  test("several records need --out-dir or --combine; --combine joins the slides with unique ids", async () => {
    const csv = await file("combine.csv", ["client,revenue,kickoff,wins", "A,1,2026-01-01,x", "B,2,2026-01-02,y"].join("\n"));
    const refused = run(["fill", TEMPLATE, "--data", csv]);
    assert.equal(refused.status, 2);
    const combined = run(["fill", TEMPLATE, "--data", csv, "--combine", "--output", "-"]);
    assert.equal(combined.status, 0, combined.stderr);
    const deck = JSON.parse(combined.stdout);
    assert.equal(deck.slides.length, 6);
    assert.equal(new Set(deck.slides.map((slide) => slide.id)).size, 6);
    assert.deepEqual(deck.slides.map((slide) => slide.title).filter((title) => title.startsWith("Quarterly")), ["Quarterly review: A", "Quarterly review: B"]);
  });

  test("a bad value is reported with its variable and writes nothing", async () => {
    const csv = await file("bad.csv", ["client,revenue,kickoff,wins", "A,lots,2026-01-01,x"].join("\n"));
    const outDir = path.join(temp, "bad-decks");
    const result = run(["fill", TEMPLATE, "--data", csv, "--out-dir", outDir]);
    assert.equal(result.status, 1);
    const error = JSON.parse(result.stderr);
    assert.match(error.error, /revenue/);
    assert.equal(error.validation.errors[0].id, "revenue");
    await assert.rejects(readdir(outDir));
  });

  test("usage mistakes exit 2", () => {
    assert.equal(run(["fill"]).status, 2);
    assert.equal(run(["fill", TEMPLATE, "--name", "x"]).status, 2);
    assert.equal(run(["fill", TEMPLATE, "--combine"]).status, 2);
    assert.equal(run(["fill", TEMPLATE, "--out-dir", temp, "--output", "x.json"]).status, 2);
  });
});
