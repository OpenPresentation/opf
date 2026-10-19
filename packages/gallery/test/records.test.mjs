// Every record of catalog/ is valid against the companion schema of the PUBLISHED @openpresentation/opf this repository pins
// (devDependencies), every index against the catalog index schema, and every kind hashes to its index and the manifest. No
// Gallery 2.0.0 CI injects immutable merged v2 engine tarballs before these same gates run.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { validateCatalogRecord } from "@openpresentation/opf";
import { isColorVariant, isLayoutTemplate, layoutTemplateIssues, normalizeColorVariant } from "@openpresentation/opf/composition";
import { SNAPSHOT_KINDS, readSnapshotKind, stripExtensions, verifySnapshot } from "../scripts/catalog-snapshot.mjs";
import { licenseProblems } from "../scripts/check-license.mjs";
import { loadValidators } from "../scripts/sync-gallery-catalog.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogRoot = path.join(root, "catalog");

/** The built-in layouts of OPF 0.19 (the 0.19 layouts design, section 6), in picker order. */
const LAYOUT_IDS = [
  "cover", "section", "agenda", "statement", "closing",
  "text", "list", "quote", "two-column",
  "pillars", "comparison", "process", "timeline", "faq",
  "metrics", "scorecard",
  "image", "image-beside", "gallery", "chart", "chart-beside", "table", "table-beside", "code",
  "hero", "dashboard", "team", "logos",
];

test("every record is valid against the published core's companion schema", async () => {
  let count = 0;
  for (const { kind, catalogKey, recordSchemaId } of SNAPSHOT_KINDS) {
    const { records } = await readSnapshotKind(catalogRoot, kind);
    for (const record of records) {
      assert.equal(record.$schema, recordSchemaId, `${kind}/${record.id}.json $schema`);
      const result = validateCatalogRecord(catalogKey, record);
      assert.equal(result.valid, true, `${kind}/${record.id}.json: ${JSON.stringify(result.findings ?? result.errors ?? result)}`);
      count += 1;
    }
  }
  assert.ok(count > 300, `${count} records`);
});

test("the layouts are the 28 OPF 0.19 intent templates, in six groups, each passing core's template rules", async () => {
  const { index, records } = await readSnapshotKind(catalogRoot, "layouts");
  assert.deepEqual(records.map((record) => record.id), LAYOUT_IDS);
  for (const record of records) {
    assert.ok(record.description?.trim(), `${record.id}: usage description`);
    assert.equal(record.preview?.vectorSrc, `https://www.pptx.gallery/layout-previews/${record.id}.svg`, `${record.id}: published SVG preview`);
  }
  assert.deepEqual([...new Set(index.records.map((entry) => entry.group))], ["Openers and closers", "Text", "Groups of items", "Numbers", "Visuals", "Mixed"]);
  for (const record of records) {
    const entry = index.records.find((candidate) => candidate.id === record.id);
    assert.deepEqual([entry.name, entry.summary, entry.group], [record.name, record.summary, record.tags[0]], `${record.id}: index entry`);
    assert.ok(isLayoutTemplate(record), `${record.id} is a grid template`);
    assert.deepEqual(layoutTemplateIssues(record), [], `${record.id}: opf/layout-template and opf/layout-region`);
    assert.ok(record.areas.some((row) => row.includes("title")), `${record.id} has a title area`);
    assert.equal(record.placeholders, undefined, `${record.id} carries no 0.18 placeholders`);
  }
});

test("every index is valid against the catalog index schema, and the manifest against its schema", async () => {
  const validators = await loadValidators();
  for (const { kind } of SNAPSHOT_KINDS) {
    const { index } = await readSnapshotKind(catalogRoot, kind);
    assert.equal(validators.index(stripExtensions(index)), true, `${kind}/index.json: ${JSON.stringify(validators.index.errors)}`);
  }
  const manifest = JSON.parse(readFileSync(path.join(catalogRoot, "manifest.json"), "utf8"));
  assert.equal(validators.manifest(manifest), true, `manifest.json: ${JSON.stringify(validators.manifest.errors)}`);
});

test("every kind hashes to the value its index and the manifest record", async () => {
  assert.deepEqual(await verifySnapshot(catalogRoot), []);
});

test("the repository and the package are MIT", () => {
  const license = readFileSync(path.join(root, "LICENSE"), "utf8");
  const manifest = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  assert.deepEqual(licenseProblems(license, manifest), []);
  assert.deepEqual(licenseProblems("Apache License\n", { license: "Apache-2.0", files: ["dist"] }).length, 6);
});

test("every theme offers its variants: light and dark maps over its one color scheme", async () => {
  const { records } = await readSnapshotKind(catalogRoot, "themes");
  assert.deepEqual(records.map((record) => record.id), ["minimal", "classic", "bold"], "the dark theme is a variant of each theme");
  const accents = ["accent1", "accent2", "accent3", "accent4", "accent5", "accent6"];
  for (const theme of records) {
    const { variants } = theme;
    assert.ok(Array.isArray(variants) && variants.length >= 4, `${theme.id}: variants`);
    assert.equal(new Set(variants.map((variant) => variant.id)).size, variants.length, `${theme.id}: variant ids are unique`);
    for (const variant of variants) {
      assert.match(variant.id, /^[a-z][a-z0-9-]*$/, `${theme.id}/${variant.id}: id`);
      assert.ok(variant.name?.trim(), `${theme.id}/${variant.id}: name`);
      assert.deepEqual(Object.keys(variant).sort(), ["id", "name", "variant"], `${theme.id}/${variant.id}: members`);
      // The value of design.variant, checked by core 0.23.0's own ColorVariant rules: a background slot, or { background, accents? }
      // with a permutation of the six accent slots.
      const normalized = normalizeColorVariant(variant.variant);
      assert.ok(isColorVariant(variant.variant) && normalized, `${theme.id}/${variant.id}: ${JSON.stringify(variant.variant)} is a valid ColorVariant`);
      if (typeof variant.variant === "object") {
        assert.deepEqual(Object.keys(variant.variant).sort(), ["accents", "background"], `${theme.id}/${variant.id}: object members`);
        assert.deepEqual([...normalized.accents].sort(), accents, `${theme.id}/${variant.id}: accents are a permutation of the six slots`);
      }
    }
    const backgrounds = variants.map((variant) => normalizeColorVariant(variant.variant).background);
    assert.ok(backgrounds.some((slot) => slot.startsWith("light")) && backgrounds.some((slot) => slot.startsWith("dark")), `${theme.id}: a light and a dark variant`);
    assert.ok(backgrounds.includes(theme.background.slot), `${theme.id}: one variant is the theme's own background ${theme.background.slot}`);
  }
});
