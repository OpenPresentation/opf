// The LibreOffice qualification corpus (docs/libreoffice.md, "Corpus"). Each case is an OPF deck exported by today's engines, or a
// retained PPTX that is checked as it is. `scope` says what a defect in it means:
//   baseline    the supported subset: a defect here is a LibreOffice compatibility defect of OPF's export.
//   advanced    features outside the baseline (chartex charts, which LibreOffice draws from their fallback pictures): defects are
//               recorded as known differences and never block.
//   regression  a retained artifact from an older exporter (opf#925): checked as it is, for diagnosis only.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const corpus = (name) => path.join(here, "corpus", name);

/** The cases of this checkout, in report order. */
export async function corpusCases() {
  const cases = [
    { id: "cover-and-text", group: "cover and text", scope: "baseline", input: corpus("cover-and-text.opf.json") },
    { id: "lists", group: "long and nested lists", scope: "baseline", input: corpus("lists.opf.json") },
    { id: "images", group: "images and crops", scope: "baseline", input: corpus("images.opf.json"), assetDir: path.join(here, "corpus") },
    { id: "tables", group: "tables", scope: "baseline", input: corpus("tables.opf.json") },
    { id: "charts", group: "common charts", scope: "baseline", input: corpus("charts.opf.json") },
    { id: "issue-925-rebuilt", group: "opf#925", scope: "baseline", input: corpus("long-text-925.opf.json"), note: "Slides 3 and 5 of the opf#925 report, rebuilt as OPF and exported by today's engines with the default options." },
    { id: "issue-925-rebuilt-safe", group: "opf#925", scope: "baseline", input: corpus("long-text-925.opf.json"), options: { typefaces: "safe" }, note: "The same deck exported with typefaces: safe." },
    { id: "issue-925-rebuilt-native", group: "opf#925", scope: "baseline", input: corpus("long-text-925.opf.json"), options: { bodyText: "native" }, note: "The same deck exported with bodyText: native (one wrapping body per region)." },
    { id: "issue-925-original", group: "opf#925", scope: "regression", pptx: path.join(root, "packages/pptx/test/fixtures/native-long-text/llmreference.pptx"), note: "The retained seven-slide artifact of the report (exported by opf-pptx 0.20.2), checked unchanged." },
    { id: "example-rich-text-runs", group: "cover and text", scope: "baseline", input: path.join(root, "examples/technical/rich-text-runs.opf.json"), assetDir: path.join(root, "examples/technical") },
    { id: "example-table-cell-types", group: "tables", scope: "baseline", input: path.join(root, "examples/technical/table-cell-types.opf.json"), assetDir: path.join(root, "examples/technical") },
  ];
  // The shared native-acceptance corpus (scripts/native-acceptance), the same decks the PowerPoint and Keynote runs open.
  const { loadFixtureSource } = await import("../native-acceptance/fixture-source.mjs");
  const source = await loadFixtureSource();
  for (const [name, deck] of Object.entries(source.decks)) {
    cases.push({
      id: `shared-${name}`,
      group: "shared native-acceptance corpus",
      scope: name.startsWith("chart-") ? "advanced" : "baseline",
      deck: { ...source.base, ...deck },
      ...(name.startsWith("chart-") ? { note: "A chartex chart: LibreOffice has no chartex reader and draws the fallback picture." } : {}),
    });
  }
  return cases;
}

/** `ids`: case ids or group names, comma separated; empty keeps every case. */
export function selectCases(cases, ids = []) {
  if (!ids.length) return cases;
  const wanted = new Set(ids);
  const selected = cases.filter((entry) => wanted.has(entry.id) || wanted.has(entry.group) || [...wanted].some((id) => id.endsWith("*") && entry.id.startsWith(id.slice(0, -1))));
  if (!selected.length) throw new Error(`no case matches ${ids.join(", ")}`);
  return selected;
}

/** The release qualification manifest (scripts/native-acceptance/qualification), or null in a checkout that does not have it yet. */
export function qualificationManifest() {
  const file = path.join(root, "scripts/native-acceptance/qualification/manifest.json");
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
}

// Decks whose default export carries live SmartArt or chartex charts: LibreOffice draws their fallback pictures, so they are outside the
// baseline (a defect there is a known difference).
const ADVANCED_QUALIFICATION = new Set(["smartart", "smartart-arabic", "smartart-japanese", "chart-type-sampler"]);

/**
 * The cases of a release qualification build (`node scripts/native-acceptance/qualification/build.mjs --out <dir>`): the very PPTX files
 * and previews the PowerPoint and Keynote streams open, read from `<dir>/build.json`. One case per deck and variant.
 */
export function qualificationCases(buildDir) {
  const build = JSON.parse(readFileSync(path.join(buildDir, "build.json"), "utf8"));
  const cases = [];
  for (const deck of build.decks) {
    for (const variant of deck.variants) {
      if (!variant.ok) continue;
      const suffix = variant.name === "default" ? "" : `~${variant.name}`;
      const previewDir = path.join(buildDir, "preview", deck.id);
      const previews = existsSync(previewDir) ? readdirSync(previewDir).filter((name) => /^slide-\d+\.png$/.test(name)).sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0])).map((name) => path.join(previewDir, name)) : [];
      cases.push({
        id: `q-${deck.id}${suffix}`,
        group: "release qualification corpus",
        scope: ADVANCED_QUALIFICATION.has(deck.id) && variant.name === "default" ? "advanced" : "baseline",
        pptx: path.join(buildDir, variant.pptx),
        previews,
        qualification: { deck: deck.id, variant: variant.name, sha256: variant.sha256, revision: build.revision },
      });
    }
  }
  return cases;
}
