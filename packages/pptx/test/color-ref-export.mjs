import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { unzipSync } from "fflate";
import { XMLParser } from "fast-xml-parser";
import { catalogs } from "@openpresentation/opf";
import { resolveColorRefValue, resolveExportColor, colorContext } from "../dist/color-ref.js";
import { toPptx } from "../dist/index.js";

const forest = catalogs.colorSchemes.find((record) => record.id === "forest-green");
assert.ok(forest, "forest-green catalog record");

const ctx = colorContext({
  colorScheme: forest,
  colors: {
    background: "FFFFFF",
    text: "0F172A",
    mutedText: "475569",
    accent: "2874A6",
    surface: "F8FAFC",
    border: "CBD5E1",
  },
  variables: { risk: "#B42318", highlight: "#0F4C81" },
});

assert.equal(resolveColorRefValue("accent2", ctx), `#${forest.accent2.replace(/^#/, "").toUpperCase()}`);
assert.equal(resolveColorRefValue("textSecondary", ctx), "#475569");
assert.equal(resolveColorRefValue("surface", ctx), "#F8FAFC");
assert.equal(resolveColorRefValue("var:risk", ctx), "#B42318");
assert.equal(resolveColorRefValue("var:missing", ctx), undefined);
assert.equal(resolveExportColor("invalid", ctx, ctx.colors.text), ctx.colors.text);
assert.equal(resolveExportColor("#abc", ctx, ctx.colors.text), "AABBCC");

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "", parseTagValue: false });
const find = (value, key) => !value || typeof value !== "object" ? [] : Array.isArray(value)
  ? value.flatMap((item) => find(item, key))
  : Object.entries(value).flatMap(([name, child]) => name === key ? [child].flat() : find(child, key));
const cellText = (cell) => find(cell, "a:t").flatMap((node) => typeof node === "string" ? [node] : typeof node?.["a:t"] === "string" ? [node["a:t"]] : []);

const fixtureUrl = new URL("../../opf/docs/fixtures/color-references.opf.json", import.meta.url);
let fixture;
try {
  fixture = JSON.parse(await readFile(fixtureUrl, "utf8"));
} catch {
  fixture = null;
}

const exportDeck = fixture ?? {
  name: "Color References",
  design: { theme: "classic", colorScheme: "forest-green" },
  variables: { risk: "#B42318", highlight: "#0F4C81" },
  slides: [{
    title: "Scheme Names In Runs",
    text: [{ text: "theme-portable", color: "accent2", bold: true }],
  }, {
    table: {
      columns: ["Stage", "Status"],
      rows: [[
        "Rollout",
        { value: "At risk", style: { fill: "surface", color: "var:risk", borders: { bottom: { color: "accent1", width: 1 } } } },
      ]],
    },
  }],
};

const deck = structuredClone(exportDeck);
const bytes = await toPptx(deck);
const slideXmls = deck.slides.map((_, index) => new TextDecoder().decode(unzipSync(bytes)[`ppt/slides/slide${index + 1}.xml`]));
const xml = slideXmls.join("\n");
assert.doesNotMatch(xml, /srgbClr val="ACCENT/i);
assert.doesNotMatch(xml, /srgbClr val="SURFACE/i);

const runs = find(parser.parse(xml), "a:r");
const accentRun = runs.find((run) => run["a:t"] === "theme-portable");
assert.ok(accentRun, "accent2 run");
assert.equal(accentRun["a:rPr"]["a:solidFill"]["a:srgbClr"].val, forest.accent2.replace(/^#/, "").toUpperCase().slice(0, 6));

const cells = find(parser.parse(xml), "a:tc");
const styled = cells.find((cell) => cellText(cell).includes("At risk"));
assert.ok(styled, "styled cell");
const fill = styled["a:tcPr"]["a:solidFill"]["a:srgbClr"].val;
const expectedSurface = resolveExportColor("surface", colorContext({
  colorScheme: forest,
  colors: {
    background: "FFFFFF",
    text: forest.dark1.replace(/^#/, "").toUpperCase(),
    mutedText: forest.light2.replace(/^#/, "").toUpperCase(),
    accent: forest.accent1.replace(/^#/, "").toUpperCase(),
    surface: forest.light2.replace(/^#/, "").toUpperCase(),
    border: forest.accent5.replace(/^#/, "").toUpperCase(),
  },
  variables: { risk: "#B42318", highlight: "#0F4C81" },
}), forest.light2.replace(/^#/, "").toUpperCase()).slice(0, 6);
assert.equal(fill, expectedSurface);
const runFill = find(styled, "a:r").find((run) => (typeof run["a:t"] === "string" ? run["a:t"] : run["a:t"]?.["#text"]) === "At risk")["a:rPr"]["a:solidFill"]["a:srgbClr"].val;
assert.equal(runFill, "B42318");
const bottom = styled["a:tcPr"]["a:lnB"]["a:solidFill"]["a:srgbClr"].val;
assert.equal(bottom, forest.accent1.replace(/^#/, "").toUpperCase().slice(0, 6));

const slideTextDeck = {
  design: { colorScheme: { id: "cool-horizon", dark1: "#000000", light1: "#FFFFFF", accent2: "#ED7D31" } },
  slides: [{ text: [{ text: "named", color: "accent2" }, { text: "bad", color: "invalid" }] }],
};
const slideXml = new TextDecoder().decode(unzipSync(await toPptx(slideTextDeck))["ppt/slides/slide1.xml"]);
const slideRuns = find(parser.parse(slideXml), "a:r");
assert.equal(slideRuns.find((run) => run["a:t"] === "named")["a:rPr"]["a:solidFill"]["a:srgbClr"].val, "ED7D31");
const badRun = slideRuns.find((run) => run["a:t"] === "bad")["a:rPr"]["a:solidFill"]["a:srgbClr"].val;
assert.match(badRun, /^[0-9A-F]{6}$/);
assert.notEqual(badRun, "INVALID");

console.log("ColorRef export passed: scheme slots, roles, variables, styled cells, and invalid run soft-degrade.");
