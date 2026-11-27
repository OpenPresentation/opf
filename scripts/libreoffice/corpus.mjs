// The LibreOffice qualification corpus (docs/libreoffice.md, "Corpus"). Each case is an OPF deck exported by today's engines, or a
// retained PPTX that is checked as it is. `scope` says what a defect in it means:
//   baseline    the supported subset: a defect here is a LibreOffice compatibility defect of OPF's export.
//   advanced    features outside the baseline (chartex charts, which LibreOffice draws from their fallback pictures): defects are
//               recorded as known differences and never block.
//   regression  a retained artifact from an older exporter (opf#925): checked as it is, for diagnosis only.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { decksForTier, sourceDecks, sourcesForTier } from "../native-acceptance/qualification/tiers.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const corpus = (name) => path.join(here, "corpus", name);

/**
 * LibreOffice's own cases: the explicit list of what this runner opens besides the manifest's tiers, one line each saying why it is
 * not a corpus deck. They run in every tier (they are few and LibreOffice-specific); the retired ones are in docs/libreoffice.md.
 * `candidate` marks a case that should become a corpus deck later (nothing is moved here).
 */
export const LIBREOFFICE_CASES = [
  { id: "cover-and-text", group: "cover and text", scope: "baseline", input: corpus("cover-and-text.opf.json"), why: "Wrapped titles, two columns and explicit breaks written as containment stress for LibreOffice's text layout; coverage-text covers the feature keys, not these long lines.", candidate: true },
  { id: "lists", group: "long and nested lists", scope: "baseline", input: corpus("lists.opf.json"), why: "Wrapping bullets, three levels and nested numbering measured against LibreOffice's list layout; coverage-lists covers the keys, not long wrapping copy.", candidate: true },
  { id: "images", group: "images and crops", scope: "baseline", input: corpus("images.opf.json"), assetDir: path.join(here, "corpus"), why: "Cover and square crops, a contained picture, an ellipse, grayscale and SVG as LibreOffice draws them; its pictures are copies of the technical example assets.", candidate: true },
  { id: "tables", group: "tables", scope: "baseline", input: corpus("tables.opf.json"), why: "Numeric and long-prose cells and a table beside text, measured for row growth in LibreOffice; coverage-tables does not stress cell length.", candidate: true },
  { id: "charts", group: "common charts", scope: "baseline", input: corpus("charts.opf.json"), why: "The seven common chart types LibreOffice draws natively, graded as the baseline; coverage-charts also holds the chartex types it cannot.", candidate: true },
  { id: "issue-925-rebuilt", group: "opf#925", scope: "baseline", input: corpus("long-text-925.opf.json"), why: "Slides 3 and 5 of the opf#925 report (long text in LibreOffice), rebuilt as OPF and exported with the default options.", note: "Slides 3 and 5 of the opf#925 report, rebuilt as OPF and exported by today's engines with the default options." },
  { id: "issue-925-rebuilt-safe", group: "opf#925", scope: "baseline", input: corpus("long-text-925.opf.json"), options: { typefaces: "safe" }, why: "The same deck with the export option typefaces: safe, which no manifest variant sets.", note: "The same deck exported with typefaces: safe." },
  { id: "issue-925-rebuilt-native", group: "opf#925", scope: "baseline", input: corpus("long-text-925.opf.json"), options: { bodyText: "native" }, why: "The same deck with bodyText: native on a long-text deck (the manifest's native-body variants use other content).", note: "The same deck exported with bodyText: native (one wrapping body per region)." },
  { id: "issue-925-original", group: "opf#925", scope: "regression", pptx: path.join(root, "packages/pptx/test/fixtures/native-long-text/llmreference.pptx"), why: "The retained 0.20.2 artifact of the report, checked unchanged: a file today's exporter cannot produce, so it can never be a corpus deck.", note: "The retained seven-slide artifact of the report (exported by opf-pptx 0.20.2), checked unchanged." },
  { id: "example-chart-type-sampler-picture", group: "common charts", scope: "baseline", input: path.join(root, "examples/technical/chart-type-sampler.opf.json"), assetDir: path.join(root, "examples/technical"), options: { charts: "picture" }, why: "The chart-type-sampler with charts: picture (chartex types as columns LibreOffice draws); the corpus has the default export only.", note: "The same deck with charts: picture, which writes the chartex types as clustered column charts LibreOffice draws." },
  { id: "example-rich-text-runs", group: "cover and text", scope: "baseline", input: path.join(root, "examples/technical/rich-text-runs.opf.json"), assetDir: path.join(root, "examples/technical"), why: "Run-level formatting (mixed sizes, colors, links in one line) that LibreOffice re-flows; in no manifest deck.", candidate: true },
  { id: "example-table-cell-types", group: "tables", scope: "baseline", input: path.join(root, "examples/technical/table-cell-types.opf.json"), assetDir: path.join(root, "examples/technical"), why: "Typed table cells (numbers, dates, formats) as LibreOffice shows them; in no manifest deck.", candidate: true },
];

/** The shared native-acceptance fixtures (scripts/native-acceptance), the PowerPoint packet cases. Not LibreOffice-specific and not in the manifest. */
export async function sharedFixtureCases() {
  const { loadFixtureSource } = await import("../native-acceptance/fixture-source.mjs");
  const source = await loadFixtureSource();
  return Object.entries(source.decks).map(([name, deck]) => ({
    id: `shared-${name}`,
    group: "shared native-acceptance corpus",
    scope: name.startsWith("chart-") ? "advanced" : "baseline",
    deck: { ...source.base, ...deck },
    why: "A packet case of the older native-acceptance corpus that no manifest deck repeats; kept until its content is a corpus deck.",
    ...(name.startsWith("chart-") ? { note: "A chartex chart: LibreOffice has no chartex reader and draws the fallback picture." } : {}),
  }));
}

/**
 * The cases that are not manifest decks: LIBREOFFICE_CASES in every tier, the shared fixtures in `release` and `full` (a `smoke`
 * pull-request run is the manifest's smoke decks and LibreOffice's own cases).
 */
export async function corpusCases({ tier = "release" } = {}) {
  return [...LIBREOFFICE_CASES.map(({ why, candidate, ...entry }) => entry), ...(tier === "smoke" ? [] : await sharedFixtureCases())];
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

// Decks whose default export carries live SmartArt (LibreOffice draws its drawing part, not its own layout) or chartex types LibreOffice
// may lack (treemap, sunburst, map): outside the baseline, so a defect there is a known difference.
const ADVANCED_QUALIFICATION = new Set(["smartart", "chart-type-sampler"]);

/**
 * The qualification part of the list, read from the manifest's tiers the way the Keynote runner reads them: `decksForTier` says which
 * decks and variants a tier runs, and the build (`node scripts/native-acceptance/qualification/build.mjs --out <dir>`) supplies the
 * very PPTX files and previews the PowerPoint and Keynote streams open, read from `<dir>/build.json`. One case per deck and variant of
 * the tier, in the tier's order. A tier entry the build lacks throws; a variant that did not export (`ok: false`) is left out and listed
 * in `failed`. A source that is a group of manifest decks (gallery-layouts, languages) is in `decksForTier`'s list already;
 * `sources` are the tier's other named sources (native-fragments, examples), which this runner does not resolve.
 */
export function qualificationSelection(buildDir, { tier = "release", manifest = qualificationManifest() } = {}) {
  if (!manifest) throw new Error("the qualification manifest is not in this checkout");
  const build = JSON.parse(readFileSync(path.join(buildDir, "build.json"), "utf8"));
  const built = new Map(build.decks.map((deck) => [deck.id, deck]));
  const cases = [], failed = [];
  for (const { deck: id, variants } of decksForTier(manifest, tier)) {
    const deck = built.get(id);
    if (!deck) throw new Error(`tier ${tier}: deck ${id} is not in ${path.join(buildDir, "build.json")}`);
    for (const name of variants) {
      const variant = deck.variants.find((entry) => entry.name === name);
      if (!variant) throw new Error(`tier ${tier}: deck ${id} has no built variant "${name}"`);
      if (!variant.ok) { failed.push(`${id}~${name}`); continue; }
      const suffix = name === "default" ? "" : `~${name}`;
      const previewDir = path.join(buildDir, "preview", id);
      const previews = existsSync(previewDir) ? readdirSync(previewDir).filter((file) => /^slide-\d+\.png$/.test(file)).sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0])).map((file) => path.join(previewDir, file)) : [];
      cases.push({
        id: `q-${id}${suffix}`,
        group: "release qualification corpus",
        scope: ADVANCED_QUALIFICATION.has(id) && name === "default" ? "advanced" : "baseline",
        pptx: path.join(buildDir, variant.pptx),
        previews,
        qualification: { deck: id, variant: name, sha256: variant.sha256, revision: build.revision },
        // The deck itself, so the control can measure OPF's own PDF of it.
        source: path.join(root, deck.source),
        assetDir: path.dirname(path.join(root, deck.source)),
      });
    }
  }
  return { cases, failed, sources: sourcesForTier(manifest, tier).filter((source) => sourceDecks(manifest, source).length === 0) };
}

export const qualificationCases = (buildDir, options) => qualificationSelection(buildDir, options).cases;
