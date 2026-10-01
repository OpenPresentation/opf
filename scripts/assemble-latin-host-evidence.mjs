// RR-17 (FF-41): assemble the per-family host fixture evidence the font tracker reads.
//
// Each host repository has its own per-family fixture that writes a JSON report when it passes (a failing family fails the test, so
// presence of a family in a report is the pass):
//   node            opf-render  test/latin-family-hosts.mjs          artifacts/latin-family-hosts/node.json
//   browser         opf-render  test/latin-family-hosts-browser.mjs  artifacts/latin-family-hosts/browser.json  (Chromium, offline)
//   editor          opf-editor  test/font-gate-latin-families.mjs    artifacts/latin-family-hosts/editor.json   (the editor's font gate)
//   galleryEditor   pptx-gallery tests/editor-latin-families.test.ts  LATIN_HOST_REPORT=<file> pnpm vitest run tests/editor-latin-families.test.ts
//
//   node scripts/assemble-latin-host-evidence.mjs --node <json> --browser <json> --editor <json> --gallery <json>
//        --render-commit <sha> --editor-commit <sha> --gallery-commit <sha> [--out <file>]
//
// The output also carries the lazy-load budget per host: what a deck of each family fetches (face level) and the totals.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DEFAULT_OUT = "docs/evidence/font-replacements-20260923/latin-host-fixtures-20261001.json";
const MIB = 1048576;
const round = (value, digits = 3) => Math.round(value * 10 ** digits) / 10 ** digits;
const median = (values) => { const sorted = [...values].sort((a, b) => a - b); return sorted.length ? sorted[sorted.length >> 1] : 0; };

export function assemble({ node, browser, editor, gallery, commits, date = "2026-10-01" }) {
  const hosts = {
    node: { source: { repository: "OpenPresentation/opf-render", test: "test/latin-family-hosts.mjs", commit: commits.render, runtime: `Node ${node.node}` }, report: node },
    browser: { source: { repository: "OpenPresentation/opf-render", test: "test/latin-family-hosts-browser.mjs", commit: commits.render, runtime: `Node ${browser.node}, Chromium-based browser ${browser.browser}, offline` }, report: browser },
    editor: { source: { repository: "OpenPresentation/opf-editor", test: "test/font-gate-latin-families.mjs", commit: commits.editor, runtime: `Node ${editor.node}, renderer ${editor.renderer}, the editor's createFontGate` }, report: editor },
    galleryEditor: { source: { repository: "Data-Advantage/pptx-gallery", test: "tests/editor-latin-families.test.ts", commit: commits.gallery, runtime: `renderer ${gallery.renderer}, manifest public/opf-editor/lazy-fonts.json (renderer ${gallery.manifestVersion})` }, report: gallery },
  };
  const out = { schema: "opf-latin-host-fixtures/v1", date, description: "Per-family host fixtures for the Latin families (FF-41, FF-43). A family appears under a host only when that host's fixture passed for it: the route face resolved for each of the four styles (no unintended fallback), the face's own advances within 0.1 px, the files fetched or served matched what the deck draws, and, where a host draws, the faces painted as themselves. The gallery editor entry covers the files its committed manifest serves; the editor's gate code is the vendored opf-editor bundle, exercised by the editor entry.", hosts: {}, lazyBudget: {} };
  for (const [host, { source, report }] of Object.entries(hosts)) {
    const families = {};
    for (const row of report.report) families[row.family] = { route: row.route, files: row.files ?? [], lazyBytes: row.lazyBytes ?? 0, ...(row.gaps?.length ? { styleGaps: row.gaps } : {}) };
    out.hosts[host] = { source, ...(host === "browser" ? { filesFetchedInTotal: report.filesFetchedInTotal, bytesFetchedInTotal: report.bytesFetchedInTotal } : {}), families };
    const sizes = Object.values(families).map((entry) => entry.lazyBytes);
    out.lazyBudget[host] = {
      families: sizes.length,
      deckBytesMedianMiB: round(median(sizes) / MIB), deckBytesMaxMiB: round(Math.max(...sizes, 0) / MIB),
      largestDeck: Object.entries(families).sort((a, b) => b[1].lazyBytes - a[1].lazyBytes)[0]?.[0] ?? null,
      familiesWithoutLazyFiles: Object.values(families).filter((entry) => entry.lazyBytes === 0).length,
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
  console.log(`Wrote ${path.relative(ROOT, out)}: ${Object.entries(result.hosts).map(([host, entry]) => `${host} ${Object.keys(entry.families).length}`).join(", ")} families.`);
}
