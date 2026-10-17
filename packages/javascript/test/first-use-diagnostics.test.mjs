// RR-93: the first-use diagnostics fixes in core: the best match of a union's schema errors, the stats source count, the reporter's
// dedupe key, the local-asset check and the no-hard-link publication.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { stats, validate } from "../dist/index.js";
import { Reporter, localAssetProblems, publishNew } from "../dist/node-engine.js";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/invalid-table-padding.opf.json", import.meta.url), "utf8"));
const schemaErrors = (deck) => validate(deck, { only: ["format"] }).findings.filter((finding) => finding.ruleId === "opf/schema");

describe("schema errors name the form the value chose", () => {
  test("padding: 12 in a table cell style is one error per cell, not one per rejected union branch", () => {
    const errors = schemaErrors(fixture);
    // 4 header cells and 12 body cells set padding: 12. Before RR-93 this deck reported about 100 errors, mostly "must be string".
    assert.equal(errors.length, 16);
    for (const error of errors) {
      assert.match(error.path, /^\/slides\/1\/table\/(columns\/\d|rows\/\d\/\d)\/style\/padding$/);
      assert.equal(error.message, "must be object");
    }
    assert.equal(errors.filter((error) => error.path.includes("/columns/")).length, 4);
    assert.equal(errors.some((error) => /must be (string|number|boolean|null|array)$/.test(error.message)), false);
  });

  test("the other forms ride along as one summary line in validation.alternatives", () => {
    const deck = { name: "One cell", slides: [{ table: { columns: ["A", "B"], rows: [[{ value: "1", style: { padding: 12 } }, "2"]] } }] };
    const [error, ...rest] = schemaErrors(deck);
    assert.equal(rest.length, 0);
    assert.equal(error.path, "/slides/0/table/rows/0/0/style/padding");
    assert.deepEqual(error.validation.alternatives, ["TableCellValue: must be string, number, boolean, null or array"]);
  });

  test("an object cell without 'value' names the styled form's missing field", () => {
    const deck = { name: "No value", slides: [{ table: { columns: ["A"], rows: [[{ style: { align: "right" } }]] } }] };
    const messages = schemaErrors(deck).map((error) => [error.path, error.message]);
    assert.deepEqual(messages, [["/slides/0/table/rows/0/0", "must have required property 'value'"]]);
  });

  test("a value that fits no form keeps the union, named by the types it accepts", () => {
    const [error, ...rest] = schemaErrors({ name: "Bad header", slides: [{ table: { columns: [5], rows: [["1"]] } }] });
    assert.equal(rest.length, 0);
    assert.equal(error.path, "/slides/0/table/columns/0");
    assert.equal(error.message, "must be string, array, object or null");
    assert.equal(error.validation.alternatives.length, 5);
  });

  test("two object forms that both miss are both reported, without the forms the type rules out", () => {
    const messages = schemaErrors({ name: "Old chart data", slides: [{ chart: { type: "line", data: { labels: ["Q1"] } } }] }).map((error) => error.message);
    assert.ok(messages.includes("must have required property 'columns'"));
    assert.equal(messages.some((message) => /must be string/.test(message)), false);
  });
});

describe("opf stats counts chart source metadata apart from where the data comes from", () => {
  test("inline rows with data.source are inline data with a recorded source", () => {
    const deck = {
      name: "Sources",
      slides: [
        { chart: { type: "column", data: { columns: ["Q", "R"], rows: [["Q1", 1]], source: { src: "./revenue.csv", retrieved: "2026-10-05" } } } },
        { chart: { type: "column", data: { columns: ["Q", "R"], rows: [["Q1", 1]] } } },
      ],
    };
    assert.deepEqual(stats(deck).charts.data, { inline: 2, dataset: 0, withSource: 1 });
  });
});

describe("Reporter keeps findings that differ only in their details", () => {
  test("pdf-font-embedded for two faces is two findings; an exact repeat is still one", () => {
    const reporter = new Reporter();
    reporter.add("pdf", { code: "pdf-font-embedded", family: "Arimo", face: "Arimo-Regular" });
    reporter.add("pdf", { code: "pdf-font-embedded", family: "Arimo", face: "Arimo-Bold" });
    reporter.add("pdf", { code: "pdf-font-embedded", family: "Arimo", face: "Arimo-Regular" });
    assert.deepEqual(reporter.findings.map((finding) => finding.face), ["Arimo-Regular", "Arimo-Bold"]);
    const finding = { ruleId: "pdf/pdf-font-embedded", severity: "info", category: "pdf", path: "", message: "x", face: "Arimo-Bold" };
    reporter.addFinding(finding);
    reporter.addFinding({ ...finding });
    assert.equal(reporter.findings.length, 3);
  });
});

describe("localAssetProblems", () => {
  test("reports a relative image that does not resolve, with the rules convert reads files by", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "opf-assets-"));
    try {
      await fs.writeFile(path.join(dir, "ok.svg"), "<svg xmlns='http://www.w3.org/2000/svg'/>");
      await fs.writeFile(path.join(dir, "notes.txt"), "text");
      const deck = {
        name: "Assets",
        organization: { id: "pike", name: "Pike", logo: "assets/pike-logo.svg" },
        assets: { hero: { src: "missing/hero.png" } },
        slides: [
          { title: "A", image: { src: "ok.svg", alt: "ok" } },
          { title: "B", image: { src: "asset:hero", alt: "hero" } },
          { title: "C", image: { src: "https://example.com/a.png", alt: "remote" } },
          { title: "D", image: { src: "data:image/png;base64,iVBORw0KGgo=", alt: "inline" } },
          { title: "E", image: { src: "../outside.png", alt: "outside" } },
          { title: "F", image: { src: "notes.txt", alt: "text" } },
          { title: "G", chart: { type: "column", data: { columns: ["a", "b"], rows: [["x", 1]], source: { src: "./data.csv" } } } },
        ],
      };
      const problems = localAssetProblems(deck, dir).map(({ path: where, source, problem }) => [where, source, problem]);
      assert.deepEqual(problems, [
        ["/organization/logo", "assets/pike-logo.svg", "missing"],
        ["/assets/hero/src", "missing/hero.png", "missing"],
        ["/slides/4/image/src", "../outside.png", "missing"],
        ["/slides/5/image/src", "notes.txt", "blocked"],
      ]);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});

describe("publishNew without hard links", () => {
  const refuse = (code) => async () => {
    throw Object.assign(new Error(code), { code });
  };
  async function scratch(run) {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "opf-publish-"));
    try {
      await run(dir);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  }

  for (const code of ["EPERM", "ENOTSUP", "EXDEV"]) {
    test(`${code} from link falls back to an exclusive create and copy`, async () => {
      await scratch(async (dir) => {
        const temporary = path.join(dir, ".out.tmp");
        const output = path.join(dir, "out.json");
        await fs.writeFile(temporary, "staged bytes");
        await publishNew(temporary, output, refuse(code));
        assert.equal(await fs.readFile(output, "utf8"), "staged bytes");
      });
    });
  }

  test("an existing output is never replaced, with or without the link", async () => {
    await scratch(async (dir) => {
      const temporary = path.join(dir, ".out.tmp");
      const output = path.join(dir, "out.json");
      await fs.writeFile(temporary, "new");
      await fs.writeFile(output, "kept");
      await assert.rejects(publishNew(temporary, output, refuse("EPERM")), { code: "EEXIST" });
      await assert.rejects(publishNew(temporary, output), { code: "EEXIST" });
      assert.equal(await fs.readFile(output, "utf8"), "kept");
    });
  });

  test("another link error still fails", async () => {
    await scratch(async (dir) => {
      const temporary = path.join(dir, ".out.tmp");
      await fs.writeFile(temporary, "x");
      await assert.rejects(publishNew(temporary, path.join(dir, "o.json"), refuse("EIO")), { code: "EIO" });
      await assert.rejects(fs.stat(path.join(dir, "o.json")), { code: "ENOENT" });
    });
  });
});
