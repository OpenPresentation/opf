import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { reportStale } from "./tracker-staleness.mjs";
import {
  FILES,
  GAP_CODES,
  ROOT,
  STATUS_DEFINITIONS,
  STATUSES,
  checkTracker,
  buildTracker,
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
  if (overrides.inputs.inputLimitations) for (const item of read(overrides.inputs.inputLimitations).records) {
    mkdirSync(path.dirname(path.join(dir, item.evidence)), { recursive: true });
    cpSync(path.join(ROOT, item.evidence), path.join(dir, item.evidence));
  }
  cpSync(path.join(ROOT, catalogs), path.join(dir, catalogs), { recursive: true });
  const proof = read(`${catalogs}/proof.json`);
  mkdirSync(path.dirname(path.join(dir, proof.verification)), {recursive:true});
  cpSync(path.join(ROOT, proof.verification), path.join(dir, proof.verification));
  cpSync(path.join(ROOT, proof.publishedContent), path.join(dir, proof.publishedContent));
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
  const snapshot = read(`${overrides.inputs.catalogs}/snapshot.json`);
  const manifest = snapshot.files["manifest.json"];
  for (const kind of Object.keys(manifest.kinds)) {
    const index = snapshot.files[`${kind}/index.json`];
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
    editor: ["switch", "none", "unknown", "n/a"],
    gallery: ["unknown", "shown", "shown-no-preview", "json-only", "not-shown", "not-shown-deprecated", "coming", "n/a"],
    native: ["verified", "failed", "exercised", "unverified", "n/a"],
  };
  for (const r of committed.records) for (const [column, values] of Object.entries(allowed)) assert.ok(values.includes(r.columns[column]), `${r.type}/${r.id}: ${column} ${r.columns[column]}`);
  for (const r of committed.records.filter((x) => x.columns.compose === "unknown")) assert.ok(r.gaps.some((g) => g.code === "unknown"), `${r.type}/${r.id}: unknown column without an unknown gap`);
});

test("the committed tracker follows the configured freshness policy", () => {
  const { drift } = checkTracker();
  // RR-46 deliberately warns on PRs; the unit runner must use the same policy as the CLI below it.
  // The default remains strict for local, main and release checks.
  if (drift.length) assert.equal(reportStale(`Gallery tracker is stale: ${drift.join(', ')}`), false);
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


test("Pareto limitation preserves measured verdicts and remains an open data-preservation gap", () => {
  const dir = scratchCopy();
  try {
    const { tracker: current } = buildTracker({ root: dir });
    const row = current.records.find((r) => r.type === "charts" && r.id === "pareto");
    const config = read(FILES.overrides);
    delete config.inputs.inputLimitations;
    config.inputs.evidence = "docs/evidence-empty";
    config.rules = config.rules.filter((r) => r.id !== "pareto-multi-series-loss");
    writeFiles(dir, { [FILES.overrides]: config });
    const historical = buildTracker({ root: dir }).tracker.records.find((r) => r.type === "charts" && r.id === "pareto");
    assert.deepEqual(row.columns, historical.columns, "measured historical verdicts changed");
    assert.match(row.evidenceScope, /single-series/);
    const gap = row.gaps.find((g) => g.rule === "pareto-multi-series-loss");
    assert.equal(gap.code, "missing-export");
    assert.equal(gap.link, "https://github.com/OpenPresentation/opf-pptx/issues/246");
    assert.equal(gap.addressed, false);
    assert.equal(gap.descoped, undefined);
    const proof = read("docs/evidence/rr-20-pareto-series-scope/reproduction.json");
    assert.equal(proof.input.slides[0].chart.data.columns.length, 4);
    assert.equal(proof.imported.slides[0].chart.data.columns.length, 2);
    assert.ok(proof.export.diagnostics.some((d) => d.code === "chart-data-adapted" && d.adaptation === "series-dropped"));
    assert.equal(proof.nativeExecution, false);
    assert.equal(proof.historicalNativeInput.sampleData.rows.length, 1);
    assert.equal(proof.historicalNativeInput.opfDataColumns.length, 2);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("input limitations reject unknown records, duplicate scopes and missing evidence", () => {
  for (const [kind, pattern] of [["unknown", /names no active record/], ["duplicate", /duplicate input limitation/], ["missing", /missing input limitation evidence/]]) {
    const dir = scratchCopy();
    try {
      const file = overrides.inputs.inputLimitations;
      const data = read(file);
      if (kind === "unknown") data.records[0].id = "does-not-exist";
      if (kind === "duplicate") data.records.push(structuredClone(data.records[0]));
      if (kind === "missing") data.records[0].evidence = "missing.json";
      writeFiles(dir, { [file]: data });
      assert.throws(() => buildTracker({ root: dir }), pattern);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }
});

test("offline catalog snapshot rejects missing and modified evidence", () => {
  const dir = scratchCopy();
  try {
    const file = path.join(dir, overrides.inputs.catalogs, 'snapshot.json');
    writeFileSync(file, readFileSync(file, 'utf8').replace('Agenda', 'Tampered'));
    assert.throws(() => buildTracker({root:dir}), /snapshot identity or bytes mismatch/);
    rmSync(file);
    assert.throws(() => buildTracker({root:dir}), /ENOENT/);
  } finally { rmSync(dir, {recursive:true, force:true}); }
});

test("v2 layout identity never inherits historical same-name measurements", () => {
  const {tracker} = buildTracker({root:ROOT});
  for (const id of ['agenda','comparison','dashboard','faq','timeline','two-column']) {
    const record = tracker.records.find(r => r.type === 'layouts' && r.id === id);
    assert.match(record.evidenceScope, /historical v1/);
    for (const column of ['compose','preview','export','roundTrip','editor','gallery']) assert.equal(record.columns[column], 'unknown', `${id}/${column}`);
    assert.equal(record.columns.parity, 'unmeasured');
    assert.equal(record.columns.native, 'unverified');
    assert.equal(record.nativeEvidence, undefined);
  }
});

 test("offline snapshot rejects wrong integrity, version and gitHead", () => {
  for (const [field, value] of [['integrity','sha512-wrong'],['version','2.0.1'],['gitHead','0'.repeat(40)]]) {
    const dir = scratchCopy();
    try {
      const file = path.join(dir, overrides.inputs.catalogs, 'proof.json');
      const proof = JSON.parse(readFileSync(file,'utf8')); proof[field] = value;
      writeFileSync(file,JSON.stringify(proof));
      assert.throws(() => buildTracker({root:dir}), /snapshot identity or bytes mismatch/);
    } finally {rmSync(dir,{recursive:true,force:true});}
  }
});

test("old passing and failing audit/native channels cannot certify any schema2 layout", () => {
  const baseline = buildTracker().tracker;
  const ids = baseline.records.filter(r => r.type === 'layouts' && r.evidenceScope?.startsWith('opf-layout/v2')).map(r=>r.id);
  assert.equal(ids.length,28);
  for (const pass of [true,false]) {
    const dir = scratchCopy(o=>{o.inputs.nativeRuns=['docs/evidence-empty/native-old/values.json'];return o;});
    try {
      for (const key of ['auditA','auditB','parity']) {
        const file=path.join(dir,overrides.inputs[key]);const data=JSON.parse(readFileSync(file,'utf8'));
        data.results=data.results.filter(r=>r.dimension!=='layouts');
        for (const id of ids) data.results.push(key==='auditA'?{dimension:'layouts',id,class:pass?'works':'fails',checks:{schema:{pass},render:{pass},export:{pass},reimport:{pass}}}:key==='auditB'?{dimension:'layouts',id,schemaValid:pass,catalogResolves:pass,preview:{hostFonts:pass},export:{default:pass},classification:pass?'works':'fails',reasons:pass?[]:['reimport failed']}:{dimension:'layouts',id,variant:'published',class:pass?'perfect':'mismatch',checks:{text:pass?'pass':'fail'},fontResolution:{Roboto:{}}});
        writeFileSync(file,JSON.stringify(data));
      }
      writeFiles(dir,{'docs/evidence-empty/native-old/values.json':{values:ids.map(id=>({type:'layouts',id,pass,failingChecks:['old'],failing:[{detail:'old v1'}]}))},'docs/evidence-empty/native-old/offline.json':{slides:ids.map(layout=>({layout}))}});
      const after=buildTracker({root:dir}).tracker;
      for(const id of ids){const r=after.records.find(r=>r.type==='layouts'&&r.id===id);for(const key of ['compose','preview','export','roundTrip','editor','gallery'])assert.equal(r.columns[key],'unknown');assert.equal(r.columns.parity,'unmeasured');assert.equal(r.columns.native,'unverified');assert.equal(r.columns.fonts,'n/a');assert.equal(r.nativeEvidence,undefined);}
      // Native evidence was intentionally replaced in this scratch tree; other pipeline/parity/font columns remain exact.
      for(const r of baseline.records.filter(r=>['charts','font-schemes'].includes(r.type))){const actual=after.records.find(a=>a.type===r.type&&a.id===r.id);for(const key of ['compose','preview','export','roundTrip','parity','fonts'])assert.equal(actual.columns[key],r.columns[key],`${r.type}/${r.id}/${key}`);}
    } finally {rmSync(dir,{recursive:true,force:true});}
  }
});
