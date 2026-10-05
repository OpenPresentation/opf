// RR-17 (FF-44, FF-45): assemble the per-family host fixture evidence of the open script, emoji and math families that the font tracker reads.
//
// Each host repository has its own per-family script fixture that writes a JSON report (a failing family fails the test unless it is a
// recorded finding, which the report lists under `findings`; presence of a family in `report` is the pass):
//   node            opf-render   test/script-family-hosts.mjs           artifacts/script-family-hosts/node.json
//   browser         opf-render   test/script-family-hosts-browser.mjs   artifacts/script-family-hosts/browser.json  (Chromium, offline)
//   editor          opf-editor   test/font-gate-script-families.mjs     artifacts/script-family-hosts/editor.json   (the editor's font gate)
//   galleryEditor   pptx-gallery tests/editor-script-families.test.ts   SCRIPT_HOST_REPORT=<file> pnpm vitest run tests/editor-script-families.test.ts
//
//   node scripts/assemble-script-host-evidence.mjs --node <json> --browser <json> --editor <json> --gallery <json>
//        --render-commit <sha> --editor-commit <sha> --gallery-commit <sha> [--out <file>]
//
// The output mirrors the Latin evidence (assemble-latin-host-evidence.mjs): per host the source (repository, test, commit, runtime) and the
// families that passed with their route, package, files, bytes and samples; a host's recorded findings sit beside them, never among them.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DEFAULT_OUT = "docs/evidence/font-replacements-20260923/script-host-fixtures-20261002.json";
const MIB = 1048576;
const round = (value, digits = 3) => Math.round(value * 10 ** digits) / 10 ** digits;
const median = (values) => { const sorted = [...values].sort((a, b) => a - b); return sorted.length ? sorted[sorted.length >> 1] : 0; };

export function assemble({ node, browser, editor, gallery, commits, date = "2026-10-02" }) {
  const hosts = {
    node: { source: { repository: "OpenPresentation/opf-render", test: "test/script-family-hosts.mjs", commit: commits.render, runtime: `Node ${node.node}` }, report: node },
    browser: { source: { repository: "OpenPresentation/opf-render", test: "test/script-family-hosts-browser.mjs", commit: commits.render, runtime: `Node ${browser.node}, Chromium ${browser.browser}, offline` }, report: browser },
    editor: { source: { repository: "OpenPresentation/opf-editor", test: "test/font-gate-script-families.mjs", commit: commits.editor, runtime: `Node ${editor.node}, renderer ${editor.renderer}, the editor's createFontGate` }, report: editor },
    galleryEditor: { source: { repository: "Data-Advantage/pptx-gallery", test: "tests/editor-script-families.test.ts", commit: commits.gallery, runtime: `renderer ${gallery.renderer}, manifest public/opf-editor/script-fonts.json (renderer ${gallery.manifestVersion})` }, report: gallery },
  };
  const out = { schema: "opf-script-host-fixtures/v1", date, description: "Per-family host fixtures for the open script, emoji and math families (FF-44, FF-45): the 35 faces of the renderer's scripts pack. A family appears under a host's families only when that host's fixture passed for it: the family's package loaded, every style resolved to the family itself (exact; a missing bold is visual), a deck of samples of its script (original FF-44 corpus text; FF-45 emoji and math) was drawn strictly in the family's own pinned file with no glyph fallback, the pinned advances matched the face within 0.1 px, and, where a host draws, the glyphs painted. A family whose fixture failed a check is listed under the host's findings with the failure and its diagnosis, and the check was not relaxed. The gallery editor entry covers the files its committed manifest serves; the editor's gate code is the vendored opf-editor bundle, exercised by the editor entry.", hosts: {}, lazyBudget: {} };
  for (const [host, { source, report }] of Object.entries(hosts)) {
    const families = {};
    for (const row of report.report) families[row.family] = { route: row.route, package: row.package, scripts: row.scripts, files: row.files ?? [], lazyBytes: row.lazyBytes ?? 0, samples: row.samples ?? [], weights: row.weights ?? [], ...(row.raster ? { raster: row.raster } : {}) };
    const findings = Object.fromEntries((report.findings ?? []).map((item) => [item.family, { check: item.message, reason: item.reason }]));
    out.hosts[host] = { source, ...(host === "browser" ? { filesFetchedInTotal: report.filesFetchedInTotal, bytesFetchedInTotal: report.bytesFetchedInTotal } : {}), families, ...(Object.keys(findings).length ? { findings } : {}) };
    const sizes = Object.values(families).map((entry) => entry.lazyBytes);
    out.lazyBudget[host] = {
      families: sizes.length,
      packageBytesMedianMiB: round(median(sizes) / MIB), packageBytesMaxMiB: round(Math.max(...sizes, 0) / MIB),
      largestPackage: Object.entries(families).sort((a, b) => b[1].lazyBytes - a[1].lazyBytes)[0]?.[0] ?? null,
    };
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const option = (name) => { const at = args.indexOf(name); return at >= 0 ? args[at + 1] : undefined; };
  const need = (name) => { const value = option(name); if (!value) throw new Error(`${name} is required`); return value; };
  const read = (name) => JSON.parse(readFileSync(path.resolve(need(name)), "utf8"));
  const commit = (name) => { const value = need(name); if (!/^[0-9a-f]{40}$/.test(value)) throw new Error(`${name} must be a full 40-character commit`); return value; };
  const result = assemble({ node: read("--node"), browser: read("--browser"), editor: read("--editor"), gallery: read("--gallery"), commits: { render: commit("--render-commit"), editor: commit("--editor-commit"), gallery: commit("--gallery-commit") } });
  const out = path.join(ROOT, option("--out") ?? DEFAULT_OUT);
  writeFileSync(out, `${JSON.stringify(result, null, 1)}\n`);
  console.log(`Wrote ${path.relative(ROOT, out)}: ${Object.entries(result.hosts).map(([host, entry]) => `${host} ${Object.keys(entry.families).length}${entry.findings ? ` (+${Object.keys(entry.findings).length} finding)` : ""}`).join(", ")} families.`);
}
