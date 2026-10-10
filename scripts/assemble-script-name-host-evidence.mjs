// FF-46 (opf#362): assemble the per-name host fixture evidence of the proprietary script, emoji, math and code-table names that the font
// tracker reads. The open script faces have their own evidence (assemble-script-host-evidence.mjs), keyed by the route face; it does not
// transfer to a proprietary name, so these names have their own fixture in every host, keyed by the name:
//   node            opf-render   test/script-name-hosts.mjs           artifacts/script-name-hosts/node.json
//   browser         opf-render   test/script-name-hosts-browser.mjs   artifacts/script-name-hosts/browser.json  (Chromium, offline)
//   editor          opf-editor   test/font-gate-script-names.mjs     artifacts/script-name-hosts/editor.json   (the editor's font gate)
//   galleryEditor   pptx-gallery tests/editor-script-names.test.ts   SCRIPT_NAME_HOST_REPORT=<file> pnpm vitest run tests/editor-script-names.test.ts
// A failing name fails its test unless it is a recorded finding (the report lists it under `findings`); presence in `report` is the pass.
//
//   node scripts/assemble-script-name-host-evidence.mjs --node <json> --browser <json> --editor <json> --gallery <json>
//        --render-commit <sha> --editor-commit <sha> --gallery-commit <sha> [--date YYYY-MM-DD] [--out <file>]
//
// The output mirrors the script evidence: per host the source (repository, test, commit, runtime) and the names that passed with their
// route, kind, scripts (each with the face that draws it and its samples), files, bytes and the policy sizeAdjust.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DEFAULT_DATE = "2026-10-10";
export const defaultOut = (date) => `docs/evidence/font-replacements-20260923/script-name-host-fixtures-${date.replaceAll("-", "")}.json`;
const MIB = 1048576;
const round = (value, digits = 3) => Math.round(value * 10 ** digits) / 10 ** digits;
const median = (values) => { const sorted = [...values].sort((a, b) => a - b); return sorted.length ? sorted[sorted.length >> 1] : 0; };

export function assemble({ node, browser, editor, gallery, commits, date = DEFAULT_DATE }) {
  const hosts = {
    node: { source: { repository: "OpenPresentation/opf-render", test: "test/script-name-hosts.mjs", commit: commits.render, runtime: `Node ${node.node}` }, report: node },
    browser: { source: { repository: "OpenPresentation/opf-render", test: "test/script-name-hosts-browser.mjs", commit: commits.render, runtime: `Node ${browser.node}, Chromium ${browser.browser}, offline` }, report: browser },
    editor: { source: { repository: "OpenPresentation/opf-editor", test: "test/font-gate-script-names.mjs", commit: commits.editor, runtime: `Node ${editor.node}, renderer ${editor.renderer}, the editor's createFontGate` }, report: editor },
    galleryEditor: { source: { repository: "Data-Advantage/pptx-gallery", test: "tests/editor-script-names.test.ts", commit: commits.gallery, runtime: `renderer ${gallery.renderer}, manifest public/opf-editor/script-fonts.json (renderer ${gallery.manifestVersion})` }, report: gallery },
  };
  const out = {
    schema: "opf-script-name-host-fixtures/v1",
    date,
    description: "Per-name host fixtures for the proprietary script, emoji, math and code-table names (FF-46, opf#362): the names that pass the native visual comparison and are previewed through an open route face. The script host fixtures are keyed by the route faces and do not transfer to a proprietary name, so each name has its own fixture, keyed by the name. A name appears under a host's families only when that host's fixture passed for it: the name resolved to its policy route (core fontPolicyFor(name).replacement.family; a code table to the first face of its chain) as a visual substitute with the policy sizeAdjust, the route's packages loaded, every sample of each of its scripts (original FF-44 corpus text; FF-45 emoji and math; every code a symbol-font encoding maps) was drawn in the face of that script (the policy route, or the designated script face where the route lacks the script, which is then the only fallback; for a code table the chain face that has the code) with no other glyph fallback, and the drawn face was the route's pinned file. A name whose fixture failed a check is listed under the host's findings, and the check was not relaxed.",
    hosts: {},
    lazyBudget: {},
  };
  for (const [host, { source, report }] of Object.entries(hosts)) {
    const families = {};
    for (const row of report.report) {
      families[row.family] = { kind: row.kind, route: row.route, ...(row.sizeAdjust ? { sizeAdjust: row.sizeAdjust } : {}), scripts: row.scripts.map((script) => ({ script: script.script, route: script.route, via: script.via, samples: script.samples })), files: row.files ?? [], lazyBytes: row.lazyBytes ?? 0 };
    }
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
  const date = option("--date") ?? DEFAULT_DATE;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("--date must be YYYY-MM-DD");
  const result = assemble({ node: read("--node"), browser: read("--browser"), editor: read("--editor"), gallery: read("--gallery"), commits: { render: commit("--render-commit"), editor: commit("--editor-commit"), gallery: commit("--gallery-commit") }, date });
  const out = path.join(ROOT, option("--out") ?? defaultOut(date));
  writeFileSync(out, `${JSON.stringify(result, null, 1)}\n`);
  console.log(`Wrote ${path.relative(ROOT, out)}: ${Object.entries(result.hosts).map(([host, entry]) => `${host} ${Object.keys(entry.families).length}${entry.findings ? ` (+${Object.keys(entry.findings).length} finding)` : ""}`).join(", ")} names.`);
}
