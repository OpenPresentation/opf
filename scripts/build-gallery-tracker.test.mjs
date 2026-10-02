import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  FILES,
  GAP_CODES,
  ROOT,
  STATUS_DEFINITIONS,
  STATUSES,
  checkTracker,
  linkState,
  matchRule,
  nativeEvidenceIndex,
  nextAction,
  snapshotEditor,
  snapshotGallery,
} from "./build-gallery-tracker.mjs";

const read = (file) => JSON.parse(readFileSync(path.join(ROOT, file), "utf8"));
const overrides = read(FILES.overrides);
const snapshots = read(FILES.snapshots);
const committed = read(FILES.json);
const ALIASES = { "chart-types": "charts", "social-platforms": "socials" };

function writeFiles(dir, files) {
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    writeFileSync(path.join(dir, file), typeof text === "string" ? text : JSON.stringify(text));
  }
}

// A scratch copy of every input except the native evidence (replaced by an empty folder), so drift and error cases
// never touch the checkout.
function scratchCopy(mutateOverrides = (o) => o) {
  const dir = mkdtempSync(path.join(tmpdir(), "gallery-tracker-"));
  const { evidence, catalogs, ...files } = overrides.inputs;
  for (const file of [...Object.values(files).flat(), FILES.snapshots, FILES.json, FILES.markdown]) {
    mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    cpSync(path.join(ROOT, file), path.join(dir, file));
  }
  cpSync(path.join(ROOT, catalogs), path.join(dir, catalogs), { recursive: true });
  mkdirSync(path.join(dir, "docs/evidence-empty/native-none"), { recursive: true });
  const copy = mutateOverrides(structuredClone(overrides));
  copy.inputs.evidence = "docs/evidence-empty";
  writeFiles(dir, { [FILES.overrides]: copy });
  return dir;
}

test("every catalog record and every gallery item is exactly one record", () => {
  const keys = committed.records.map((r) => `${r.type}/${r.id}`);
  assert.equal(new Set(keys).size, keys.length, "duplicate records");
  const has = new Set(keys);
  const manifest = read(`${overrides.inputs.catalogs}/manifest.json`);
  for (const kind of Object.keys(manifest.kinds)) {
    const index = read(`${overrides.inputs.catalogs}/${kind}/index.json`);
    for (const entry of index.records) assert.ok(has.has(`${ALIASES[kind] ?? kind}/${entry.id}`), `no record for catalog ${kind}/${entry.id}`);
  }
  for (const [kind, g] of Object.entries(snapshots.gallery.kinds))
    for (const id of [...g.items, ...g.legacyItems]) assert.ok(has.has(`${kind}/${id}`), `no record for gallery ${kind}/${id}`);
  const fonts = read(overrides.inputs.fontTracker);
  assert.equal(committed.records.filter((r) => r.type === "fonts").length, fonts.records.length);
  const presets = read(overrides.inputs.schema).$defs.DimensionPreset.enum;
  assert.deepEqual(committed.records.filter((r) => r.type === "slide-sizes").map((r) => r.id), presets);
  assert.equal(committed.records.filter((r) => r.type === "gallery-teasers").length, snapshots.gallery.coming.length);
});

test("statuses, gaps and the addressed flag are consistent", () => {
  const sev = (code) => STATUS_DEFINITIONS[code].severity;
  for (const r of committed.records) {
    const where = `${r.type}/${r.id}`;
    assert.ok(STATUSES.includes(r.status), `${where}: status ${r.status}`);
    for (const gap of r.gaps) {
      assert.ok(GAP_CODES.includes(gap.code), `${where}: gap ${gap.code}`);
      assert.ok(gap.detail, `${where}: gap without detail`);
      assert.ok(nextAction(committed, gap), `${where}: gap without next action`);
      if (gap.descoped) assert.match(gap.link, /^https:\/\/github\.com\/.+\/issues\/\d+$/, `${where}: descoped without an issue`);
      if (gap.addressed && !gap.descoped) assert.ok(/^RR-\d{2}$/.test(gap.link) || /\/pull\/\d+$/.test(gap.link), `${where}: addressed without an RR item or PR`);
    }
    const live = r.gaps.filter((g) => !g.descoped);
    if (r.status === "deprecated") assert.equal(r.gaps.length, 0);
    else if (!r.gaps.length) assert.equal(r.status, "done", where);
    else if (!live.length) assert.equal(r.status, "descoped", where);
    else assert.equal(sev(r.status), Math.max(...live.map((g) => sev(g.code))), `${where}: status is not the worst gap`);
    assert.equal(r.addressed, r.gaps.every((g) => g.addressed), where);
    for (const column of ["spec", "compose", "preview", "export", "roundTrip", "parity", "editor", "gallery", "native", "fonts"]) assert.ok(r.columns[column], `${where}: column ${column}`);
  }
  const s = committed.summary;
  assert.equal(s.records, committed.records.length);
  assert.equal(s.addressed, committed.records.filter((r) => r.addressed).length);
  assert.equal(Object.values(s.byStatus).reduce((a, b) => a + b, 0), s.records);
});

test("columns use their documented values and unknown where nothing measured", () => {
  const allowed = {
    compose: ["pass", "fail", "unknown", "n/a"],
    preview: ["pass", "fail", "unknown", "n/a"],
    export: ["pass", "fail", "unknown", "n/a"],
    roundTrip: ["pass", "fail", "unknown", "n/a"],
    parity: ["perfect", "near", "mismatch", "unmeasured", "n/a"],
    editor: ["switch", "none", "n/a"],
    gallery: ["shown", "shown-no-preview", "json-only", "not-shown", "not-shown-deprecated", "coming", "n/a"],
    native: ["verified", "failed", "exercised", "unverified", "n/a"],
  };
  for (const r of committed.records) for (const [column, values] of Object.entries(allowed)) assert.ok(values.includes(r.columns[column]), `${r.type}/${r.id}: ${column} ${r.columns[column]}`);
  for (const r of committed.records.filter((x) => x.columns.compose === "unknown")) assert.ok(r.gaps.some((g) => g.code === "unknown"), `${r.type}/${r.id}: unknown column without an unknown gap`);
});

test("the committed tracker is fresh", () => {
  assert.deepEqual(checkTracker().drift, []);
});

test("rules match by gap, type, id and detail; links resolve against the burndown", () => {
  const rules = [
    { id: "a", gap: "parity-near", types: ["charts"], ids: ["world"], link: "RR-01" },
    { id: "b", gap: "parity-near", detail: "^fontResolution" },
    { id: "c", gap: "parity-near" },
  ];
  assert.equal(matchRule(rules, "charts", "world", { code: "parity-near", detail: "x" }).id, "a");
  assert.equal(matchRule(rules, "charts", "line", { code: "parity-near", detail: "fontResolution near" }).id, "b");
  assert.equal(matchRule(rules, "charts", "line", { code: "parity-near", detail: "text near" }).id, "c");
  assert.equal(matchRule(rules, "charts", "line", { code: "unknown", detail: "" }), undefined);
  const burndown = new Map([["RR-01", { status: "todo" }], ["RR-02", { status: "done" }]]);
  assert.deepEqual(linkState("RR-01", burndown), { kind: "rr", status: "todo", addressed: true });
  assert.deepEqual(linkState("RR-02", burndown), { kind: "rr", status: "done", addressed: false });
  assert.deepEqual(linkState("https://github.com/o/r/pull/3", burndown), { kind: "pr", addressed: true });
  assert.deepEqual(linkState("https://github.com/o/r/issues/3", burndown), { kind: "issue", addressed: false });
  assert.deepEqual(linkState(undefined, burndown), { kind: "none", addressed: false });
  assert.throws(() => linkState("RR-99", burndown), /unknown burndown item RR-99/);
  assert.throws(() => linkState("see the doc", burndown), /must be an RR id/);
});

test("native evidence counts only native or PowerPoint folders", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "gallery-native-"));
  try {
    writeFiles(dir, {
      "ev/windows-native-x/deck.opf.json": { design: { colorScheme: "boost", fontScheme: { id: "aptos" } }, slides: [{ layout: "agenda", chart: { type: "line" } }] },
      "ev/native-charts/classic/07-line.json": {},
      "ev/ci-run/deck.opf.json": { design: { colorScheme: "luxury" } },
      "ev/acceptance/native/notes.md": '"language": "japanese"',
    });
    const index = nativeEvidenceIndex(dir, "ev");
    assert.deepEqual(index["color-schemes"], { boost: ["ev/windows-native-x"] });
    assert.deepEqual(index["font-schemes"], { aptos: ["ev/windows-native-x"] });
    assert.deepEqual(index.layouts, { agenda: ["ev/windows-native-x"] });
    assert.deepEqual(index.charts, { line: ["ev/native-charts", "ev/windows-native-x"] });
    assert.deepEqual(index.languages, { japanese: ["ev/acceptance"] });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the gallery and editor snapshots read pages, previews, published ids, teasers and switch dimensions", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "gallery-snapshot-"));
  try {
    writeFiles(dir, {
      "data/layouts.json": { items: [{ id: "a" }, { id: "b", deprecation: { replacedBy: "a" } }] },
      "data/purposes.json": { items: [{ id: "p" }] },
      "data/font-schemes.json": { items: [{ id: "f" }], legacyItems: [{ id: "old" }] },
      "data/notes.json": { items: "not a list" },
      "app/layouts/[slug]/page.tsx": "",
      "app/font-schemes/[slug]/page.tsx": "",
      "public/layout-previews/a.svg": "<svg/>",
      "public/purposes/index.json": { records: [{ id: "p" }, { id: "q" }] },
      "components/home/catalog-section.tsx": 'const coming = [\n  { num: "15", title: "Motion", desc: "Later." },\n];',
      "src/switches.js": 'export const SWITCH_DIMENSIONS = Object.freeze([\n  "layouts",\n  "themes",\n]);',
      "package.json": { version: "9.9.9" },
    });
    const g = snapshotGallery(dir, { commit: "c", capturedAt: "d" });
    assert.deepEqual(Object.keys(g.kinds), ["font-schemes", "layouts", "purposes"]);
    assert.equal(g.kinds.layouts.page, true);
    assert.equal(g.kinds.purposes.page, false);
    assert.deepEqual(g.kinds.layouts.previewAssetsMissing, ["b"]);
    assert.deepEqual(g.kinds.layouts.deprecated, ["b"]);
    assert.deepEqual(g.kinds["font-schemes"].legacyItems, ["old"]);
    assert.deepEqual(g.publishedCatalog, { purposes: ["p", "q"] });
    assert.deepEqual(g.coming, [{ title: "Motion", description: "Later." }]);
    const e = snapshotEditor(dir, { commit: "c", capturedAt: "d" });
    assert.deepEqual(e.switchDimensions, ["layouts", "themes"]);
    assert.equal(e.source.version, "9.9.9");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a stale tracker, an unused rule and an unknown RR link fail the build", () => {
  // Without the native evidence, values the evidence named change status: both outputs drift.
  let dir = scratchCopy();
  try {
    const { drift } = checkTracker({ root: dir });
    assert.deepEqual(drift.sort(), [FILES.json, FILES.markdown].sort());
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  dir = scratchCopy((o) => ({ ...o, rules: [...o.rules, { id: "dead", gap: "broken", next: "x" }] }));
  try {
    assert.throws(() => checkTracker({ root: dir }), /rules match no gap: dead/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  dir = scratchCopy((o) => ({ ...o, rules: o.rules.map((r) => (r.link === "RR-17" ? { ...r, link: "RR-98" } : r)) }));
  try {
    assert.throws(() => checkTracker({ root: dir }), /unknown burndown item RR-98/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
