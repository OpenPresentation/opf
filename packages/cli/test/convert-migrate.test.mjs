// OPF 0.19 (RR-79): `opf convert <deck> -i --migrate` moves a deck to the 0.19 layouts: every slide that names a removed 0.18
// layout id takes its replacement and design settings (core's migrate()), and the report lists the changes.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const executable = process.env.OPF_TEST_BIN ?? fileURLToPath(new URL("../dist/index.js", import.meta.url));
const temp = await realpath(await mkdtemp(path.join(tmpdir(), "opf-convert-migrate-")));
after(() => rm(temp, { recursive: true, force: true }));

function run(args, status = 0) {
  const result = spawnSync(process.execPath, [executable, ...args], { cwd: temp, encoding: "utf8", timeout: 120000, env: { ...process.env, npm_config_user_agent: "" } });
  assert.equal(result.status, status, JSON.stringify({ args, stdout: result.stdout.slice(0, 2000), stderr: result.stderr.slice(0, 2000) }));
  const parse = (text) => {
    try {
      return JSON.parse(text.slice(Math.max(0, text.indexOf("{"))));
    } catch {
      return undefined;
    }
  };
  return { report: parse(result.stdout), error: parse(result.stderr) };
}

const deck = {
  name: "Old layouts",
  slides: [
    { layout: "title", title: "Kickoff" },
    { layout: "list-3x-box-vertical", title: "Points", blocks: [{ items: ["a"] }, { items: ["b"] }, { items: ["c"] }] },
    { layout: "blank" },
  ],
};

describe("opf convert --migrate", () => {
  test("-i rewrites the deck in place and reports every change", async () => {
    const file = path.join(temp, "deck.opf.json");
    await writeFile(file, `${JSON.stringify(deck, null, 2)}\n`);
    const { report } = run(["convert", "deck.opf.json", "-i", "--migrate"]);
    assert.equal(report.ok, true);
    assert.deepEqual(report.migration.map((change) => change.code), ["layout-migrated", "layout-migrated", "layout-migrated"]);
    const migrated = JSON.parse(await readFile(file, "utf8"));
    assert.deepEqual(migrated.slides.map((slide) => slide.layout), ["cover", "list", undefined]);
    assert.deepEqual(migrated.slides[1].design, { contentBox: true, contentDirection: "vertical" });
  });

  test("to another file, in another form", async () => {
    await writeFile(path.join(temp, "other.opf.json"), JSON.stringify(deck));
    const { report } = run(["convert", "other.opf.json", "other.opf.yaml", "--migrate"]);
    assert.equal(report.migration.length, 3);
    assert.match(await readFile(path.join(temp, "other.opf.yaml"), "utf8"), /layout: cover/);
  });

  test("-i needs --migrate and no output; stdin cannot be rewritten in place", async () => {
    await writeFile(path.join(temp, "plain.opf.json"), JSON.stringify(deck));
    assert.equal(run(["convert", "plain.opf.json", "-i"], 2).error.code, "option-not-applicable");
    run(["convert", "plain.opf.json", "copy.opf.json", "-i", "--migrate"], 2);
    run(["convert", "-", "-i", "--migrate"], 2);
  });
});
