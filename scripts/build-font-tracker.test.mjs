import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { CLASSES, FILES, ROOT, STATUSES, buildTracker, checkTracker, renderMarkdown, serialize } from "./build-font-tracker.mjs";

const read = (file) => JSON.parse(readFileSync(path.join(ROOT, file), "utf8"));
const policy = read(FILES.policy);
const overrides = read(FILES.overrides);
const committed = read(FILES.json);
const policyNames = policy.families.map((row) => row.family);

// A scratch copy of the inputs, outputs and script, so drift and error cases never touch the checkout.
function scratchCopy() {
  const dir = mkdtempSync(path.join(tmpdir(), "font-tracker-"));
  const files = [FILES.policy, FILES.overrides, FILES.json, FILES.markdown, overrides.manifestSnapshot, overrides.galleryFontsSnapshot, overrides.measurementReport, overrides.paritySource, ...Object.values(overrides.scriptCorpus), "scripts/build-font-tracker.mjs"];
  for (const file of files) {
    mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    cpSync(path.join(ROOT, file), path.join(dir, file));
  }
  return dir;
}

test("every policy family has exactly one record", () => {
  const names = committed.records.map((record) => record.family);
  assert.equal(new Set(names).size, names.length, "duplicate records");
  for (const name of policyNames) assert.ok(names.includes(name), `no record for policy family ${name}`);
  assert.equal(committed.records.filter((record) => record.inPolicy).length, policy.families.length);
});

test("no record references a family that is neither in the policy nor a declared shipped dependency", () => {
  const extras = new Set(overrides.extras.map((extra) => extra.family));
  const snapshot = read(overrides.manifestSnapshot);
  const shipped = new Set(snapshot.packages.flatMap((pkg) => pkg.faces.map((face) => face.family)));
  for (const record of committed.records) {
    if (record.inPolicy) {
      assert.ok(policyNames.includes(record.family), `${record.family} is not a policy family`);
      continue;
    }
    assert.ok(extras.has(record.family), `${record.family} is not declared in overrides.extras`);
    assert.ok(shipped.has(record.family), `${record.family} is not in the pinned render manifest snapshot`);
    assert.equal(record.status, "policy-gap");
  }
  for (const name of Object.keys(overrides.families)) assert.ok(policyNames.includes(name), `overrides name ${name}, which is not a policy family`);
  for (const name of [...overrides.classes.proprietaryScript, ...overrides.classes.special]) assert.ok(policyNames.includes(name), `class list names ${name}`);
});

const INTOS = ["Intos", "Intos Display", "Intos Narrow", "Intos Serif"];

test("the reviewed families split into the owner's four classes", () => {
  // 153 policy families and 7 shipped dependencies were reviewed; opf#166 added the four Intos rows.
  assert.equal(committed.summary.records, policy.families.length + overrides.extras.length);
  assert.equal(committed.summary.records - INTOS.length, 160, "the owner's 160 reviewed families plus the four Intos rows");
  for (const name of INTOS) assert.equal(committed.records.find((record) => record.family === name)?.class, "open", name);
  // The seven shipped script-font dependencies (Noto Sans Arabic, Lao, Myanmar, Sinhala, Syriac, Thaana, Noto Serif Tibetan) got policy rows in RR-17 (FF-44).
  assert.equal(overrides.extras.length, 0);
  for (const name of ["Noto Sans Arabic", "Noto Sans Lao", "Noto Sans Myanmar", "Noto Sans Sinhala", "Noto Sans Syriac", "Noto Sans Thaana", "Noto Serif Tibetan"]) assert.equal(committed.records.find((record) => record.family === name)?.inPolicy, true, name);
  const counts = Object.fromEntries(CLASSES.map((cls) => [cls, committed.records.filter((record) => record.class === cls).length]));
  assert.equal(CLASSES.reduce((sum, cls) => sum + counts[cls], 0), committed.summary.records);
  assert.deepEqual(committed.records.filter((record) => record.class === "special").map((record) => record.family).sort(), ["Cambria Math", "Segoe UI Emoji", "Symbol", "Webdings", "Wingdings"]);
  for (const record of committed.records.filter((item) => item.class === "special")) assert.equal(record.status, "needs-special-path");
  for (const record of committed.records.filter((item) => item.class === "open")) assert.equal(record.licenseClass, "open");
  for (const record of committed.records.filter((item) => item.class.startsWith("proprietary"))) assert.notEqual(record.licenseClass, "open");
});

test("every record carries the fields the owner asked for, with valid values", () => {
  const ranks = new Set();
  for (const record of committed.records) {
    const where = record.family;
    assert.equal(record.selectedNamePreservedInPptx, true, where);
    assert.ok(["metric", "visual", "real", "none"].includes(record.previewRoute.tier), where);
    assert.ok(Array.isArray(record.previewRoute.alternates), where);
    assert.equal(typeof record.bundled.yes, "boolean", where);
    assert.ok(Array.isArray(record.stylesRequired) && Array.isArray(record.stylesMissing), where);
    assert.ok(record.scripts.length > 0, where);
    assert.ok(record.measurements === null || typeof record.measurements.meanAbsWidthDelta === "number", where);
    for (const host of ["node", "browser", "editor", "galleryEditor", "galleryCards"]) assert.ok(["verified", "unverified", "NA"].includes(record.hostVerification[host]), `${where} ${host}`);
    assert.ok(["verified", "partial", "unverified", "NA"].includes(record.nativeVerification.status), where);
    assert.ok(STATUSES.includes(record.status), where);
    assert.ok([1, 2, 3, 4, 5].includes(record.phase), where);
    assert.ok(record.nextAction.length > 20, where);
    assert.ok(record.evidence.length > 0, where);
    assert.equal(record.paritySignals.totalValues, committed.inputs.parity.values, where);
    assert.equal(typeof record.acceptance.accepted, "boolean", where);
    if (record.acceptance.accepted) assert.ok(record.acceptance.date && record.acceptance.evidence.length > 0, `${where}: an acceptance record needs a date and evidence`);
    else assert.equal(record.acceptance.date, null, where);
    assert.ok(Number.isInteger(record.priority.rank), where);
    ranks.add(record.priority.rank);
    if (record.bundled.yes) for (const face of record.bundled.faces) assert.match(face.sha256, /^[0-9a-f]{64}$/, `${where} ${face.file}`);
    // An unbundled route must not claim styles, and a bundled one must list the styles it ships.
    if (!record.bundled.yes) assert.deepEqual(record.bundled.stylesAvailable, [], where);
    for (const evidence of record.evidence) {
      if (!/^https?:/.test(evidence.url)) assert.ok(existsSync(path.join(ROOT, evidence.url)), `${where}: missing evidence file ${evidence.url}`);
    }
  }
  assert.equal(ranks.size, committed.records.length, "priority ranks are unique");
});

test("records agree with the policy table and the pinned manifest", () => {
  const decisions = policy.provisionalDecisions.decisions;
  for (const row of policy.families) {
    const record = committed.records.find((item) => item.family === row.family);
    const replacement = row.replacement;
    if (!replacement) {
      assert.equal(record.previewRoute.family, row.licenseClass === "open" ? row.family : null, row.family);
      continue;
    }
    const decided = replacement.decision ? decisions[replacement.decision] : replacement;
    assert.equal(record.previewRoute.family, replacement.decision ? decided.replacement : replacement.family, row.family);
    assert.equal(record.previewRoute.tier, decided.compatibility, row.family);
  }
  const snapshot = read(overrides.manifestSnapshot);
  assert.match(snapshot.source.commit, /^[0-9a-f]{40}$/);
  assert.equal(snapshot.source.repository, "OpenPresentation/opf-render");
  assert.equal(committed.inputs.renderManifest.commit, snapshot.source.commit);
});

test("every proprietary script family and open script face carries its script-corpus qualification (FF-44)", () => {
  const proprietary = committed.records.filter((record) => record.class === "proprietary-script");
  assert.equal(proprietary.length, 41);
  for (const record of proprietary) {
    const corpus = record.scriptCorpus;
    assert.ok(corpus, `${record.family} has a script corpus record`);
    assert.equal(corpus.face, record.previewRoute.family, record.family);
    assert.ok(corpus.faceSamples >= 8 || corpus.scripts.length > 0, record.family);
    assert.ok(corpus.equalToHarfBuzz + corpus.recordedFontkitLimits === corpus.faceSamples, record.family);
    assert.equal(record.status, "script-gap", record.family);
    assert.match(record.statusReason, /script corpus/, record.family);
    assert.match(record.nextAction, /Native PowerPoint comparison/, record.family);
    // The original is either measured in place (numbers) or recorded as not installed; nothing is claimed for an original that was not read.
    if (Array.isArray(corpus.original)) for (const style of corpus.original) assert.ok(Number.isFinite(style.meanWidthDelta) && Number.isFinite(style.maxAbsWidthDelta) && style.samples > 0, record.family);
    else assert.ok(corpus.original === null || corpus.original === "not installed on the measuring host", record.family);
    assert.equal(record.acceptance.accepted, false, `${record.family}: native acceptance is not claimed`);
    assert.equal(record.nativeVerification.status, "unverified", record.family);
  }
  const compact = committed.records.find((record) => record.family === "Arabic Typesetting").scriptCorpus.original[0];
  assert.ok(compact.meanWidthDelta > 0.5, "the measured Arabic Typesetting gap is recorded");
  for (const name of ["Noto Sans Thai", "Noto Sans Devanagari", "Noto Naskh Arabic", "Noto Sans JP", "Noto Sans Myanmar", "Noto Sans Mongolian"]) {
    const record = committed.records.find((item) => item.family === name);
    assert.ok(record.scriptCorpus, name);
    assert.equal(record.hostVerification.node, "verified", name);
    assert.equal(record.hostVerification.browser, "verified", name);
  }
  assert.deepEqual(committed.records.find((record) => record.family === "Noto Sans Mongolian").stylesRequired, ["400"]);
  assert.equal(committed.records.find((record) => record.family === "Noto Sans Mongolian").status, "baseline-needed");
  assert.ok(renderMarkdown(committed).includes("## Script corpus (FF-44)"));
});

// The parity run on the merged Intos mains (opf#175) passes all 704 Aptos and Aptos Display values, so the Aptos
// family no longer leads the priority queue; the queue follows the values that are still not pass.
test("the Aptos family is metric-measured with Intos bundled, and no longer leads the priority queue", () => {
  const intosOf = { Aptos: "Intos", "Aptos Display": "Intos Display", "Aptos Narrow": "Intos Narrow", "Aptos Serif": "Intos Serif" };
  for (const [name, intos] of Object.entries(intosOf)) {
    const record = committed.records.find((item) => item.family === name);
    assert.equal(record.status, "metric-measured", name);
    assert.equal(record.previewRoute.tier, "metric", name);
    assert.equal(record.previewRoute.family, intos, name);
    assert.equal(record.previewRoute.pendingBundle, null, name);
    assert.equal(record.bundled.yes, true, `${name}: ${intos} is in the pinned manifest`);
    assert.equal(record.bundled.packages[0].name, "intos", name);
    assert.deepEqual(record.bundled.stylesAvailable, ["400", "400i", "700", "700i"], name);
    assert.equal(record.stylesMissing.length, 0, name);
    assert.equal(record.hostVerification.node, "verified", name);
    assert.equal(record.hostVerification.browser, "verified", name);
    assert.equal(record.hostVerification.galleryEditor, "unverified", `${name}: the gallery editor waits for a release`);
    assert.match(record.hostLoading.galleryEditor, /pending a gallery editor release/, name);
    assert.match(record.hostLoading.browser, /lazy/, name);
    assert.equal(record.measurements.verticalMetricsMatch, true, name);
  }
  // The editor playground test exercises the Aptos scheme only: Aptos and Aptos Display.
  for (const name of ["Aptos", "Aptos Display", "Intos", "Intos Display"]) assert.equal(committed.records.find((item) => item.family === name).hostVerification.editor, "verified", name);
  for (const name of ["Aptos Narrow", "Aptos Serif", "Intos Narrow", "Intos Serif"]) assert.equal(committed.records.find((item) => item.family === name).hostVerification.editor, "unverified", name);
  for (const name of ["Aptos", "Aptos Display"]) {
    const record = committed.records.find((item) => item.family === name);
    assert.equal(record.paritySignals.valuesAffected, 704, name);
    assert.equal(record.paritySignals.fontResolution.pass, 704, name);
    assert.equal(record.priority.valuesOpen, 0, name);
    assert.equal(record.phase, 3, name);
    assert.ok(record.priority.rank > 100, `${name} passes every audited value, so it ranks low (rank ${record.priority.rank})`);
  }
  for (const name of INTOS) {
    const record = committed.records.find((item) => item.family === name);
    assert.equal(record.class, "open", name);
    assert.equal(record.bundled.yes, true, name);
    assert.equal(record.status, "baseline-needed", name);
  }
  assert.equal(committed.records.find((item) => item.family === "Aptos Mono").status, "visual-gap", "Aptos Mono has no measurement or candidate");
  // The queue now follows values that are still not pass.
  const top = [...committed.records].sort((a, b) => a.priority.rank - b.priority.rank).slice(0, 10);
  for (const record of top) assert.ok(record.priority.valuesOpen > 0, `${record.family} leads the queue with open values`);
  assert.equal(committed.inputs.parity.file.split("/").pop(), "parity-results-2026-09-30-gallery-font-host.json");
});

test("a pendingBundle override for a family whose route face is bundled is stale and fails the build", () => {
  const dir = scratchCopy();
  try {
    const file = path.join(dir, FILES.overrides);
    const edited = JSON.parse(readFileSync(file, "utf8"));
    edited.pendingBundle = { Aptos: { prs: ["opf-render#54"], note: "stale" } };
    writeFileSync(file, JSON.stringify(edited));
    assert.throws(() => buildTracker({ root: dir }), /pendingBundle for Aptos is stale/);
    edited.pendingBundle = { "No Such Family": { prs: ["opf-render#1"], note: "x" } };
    writeFileSync(file, JSON.stringify(edited));
    assert.throws(() => buildTracker({ root: dir }), /No Such Family/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the committed tracker matches a fresh build", () => {
  const { drift } = checkTracker();
  assert.deepEqual(drift, [], "run node scripts/build-font-tracker.mjs and commit the result");
  const { tracker } = buildTracker();
  assert.equal(serialize(tracker), readFileSync(path.join(ROOT, FILES.json), "utf8"));
  assert.equal(renderMarkdown(tracker), readFileSync(path.join(ROOT, FILES.markdown), "utf8"));
});

test("--check detects drift in the tracker files and passes after a rebuild", () => {
  const dir = scratchCopy();
  try {
    const script = path.join(dir, "scripts/build-font-tracker.mjs");
    const run = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
    assert.equal(run("--check").status, 0, "fresh copy is current");

    writeFileSync(path.join(dir, FILES.markdown), `${readFileSync(path.join(dir, FILES.markdown), "utf8")}\nhand edit\n`);
    const markdownDrift = run("--check");
    assert.equal(markdownDrift.status, 1);
    assert.match(markdownDrift.stderr, /font-tracker\.md/);

    const rebuilt = run();
    assert.equal(rebuilt.status, 0, rebuilt.stderr);
    assert.equal(run("--check").status, 0, "rebuild clears the drift");

    // Editing a derived input (the policy) without rebuilding is drift too.
    const policyFile = path.join(dir, FILES.policy);
    const edited = JSON.parse(readFileSync(policyFile, "utf8"));
    edited.families.find((row) => row.family === "Calibri").replacement.compatibility = "visual";
    writeFileSync(policyFile, JSON.stringify(edited, null, 2));
    const policyDrift = run("--check");
    assert.equal(policyDrift.status, 1);
    assert.match(policyDrift.stderr, /font-tracker\.json/);

    // A deleted tracker file is drift, not a crash.
    rmSync(path.join(dir, FILES.json));
    assert.equal(run("--check").status, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a policy family without an override, or an override without a policy family, fails the build", () => {
  const dir = scratchCopy();
  try {
    const policyFile = path.join(dir, FILES.policy);
    const original = readFileSync(policyFile, "utf8");
    const withNew = JSON.parse(original);
    withNew.families.push({ ...withNew.families.find((row) => row.family === "Calibri"), family: "Brand New Face" });
    writeFileSync(policyFile, JSON.stringify(withNew));
    assert.throws(() => buildTracker({ root: dir }), /no nextAction for Brand New Face/);

    const withoutRow = JSON.parse(original);
    withoutRow.families = withoutRow.families.filter((row) => row.family !== "Wingdings");
    writeFileSync(policyFile, JSON.stringify(withoutRow));
    assert.throws(() => buildTracker({ root: dir }), /Wingdings/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a declared shipped dependency that the policy already has must leave overrides.extras", () => {
  const dir = scratchCopy();
  try {
    const file = path.join(dir, FILES.overrides);
    const edited = JSON.parse(readFileSync(file, "utf8"));
    // Noto Sans Arabic got its policy row in RR-17 (FF-44): declaring it as an extra again is an error.
    edited.extras = [{ family: "Noto Sans Arabic", scripts: ["Arabic"], nextAction: "stale" }];
    writeFileSync(file, JSON.stringify(edited));
    assert.throws(() => buildTracker({ root: dir }), /Noto Sans Arabic is in the policy/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("priority counts only values that are not already pass, and discounts verified hosts", () => {
  const roboto = committed.records.find((record) => record.family === "Roboto Mono");
  assert.equal(roboto.paritySignals.valuesAffected, 848);
  assert.equal(roboto.paritySignals.fontResolution.pass, 848);
  assert.equal(roboto.priority.valuesOpen, 0);
  assert.ok(roboto.priority.rank > 100, `Roboto Mono is already real and pass in every value, so it must not rank high (rank ${roboto.priority.rank})`);
  assert.equal(roboto.hostVerification.node, "verified");
  assert.equal(roboto.priority.hostFactor, 0.5, "two of five hosts are verified");
  for (const record of committed.records) {
    assert.equal(record.priority.valuesOpen, record.paritySignals.valuesAffected - record.paritySignals.fontResolution.pass, record.family);
    assert.ok(record.priority.hostFactor >= 0.25 && record.priority.hostFactor <= 1, record.family);
  }
});

test("gallery cards are recorded separately from the gallery editor, and Node names its default pack", () => {
  const gallery = read(committed.inputs.galleryPreviewFonts.file);
  assert.match(gallery.source.commit, /^[0-9a-f]{40}$/);
  const cardFamilies = new Set(gallery.families.map((entry) => entry.family));
  for (const name of ["Anton", "Barlow", "Bitter", "EB Garamond", "Figtree", "Libre Caslon Text", "Work Sans", "Playfair Display", "Raleway", "Open Sans", "Montserrat"]) assert.ok(cardFamilies.has(name), name);
  for (const record of committed.records) {
    assert.ok("galleryEditor" in record.hostLoading && "galleryCards" in record.hostLoading && !("gallery" in record.hostLoading), record.family);
    const target = record.previewRoute.family;
    const hosted = target ? cardFamilies.has(target) : false;
    assert.equal(record.hostVerification.galleryCards === "NA", !hosted, `${record.family} galleryCards`);
    assert.match(record.hostLoading.galleryCards, hosted ? /self-hosted preview webfont/ : /no self-hosted card preview|no route/, record.family);
  }
  // Raleway is not bundled by opf-render (variable-only upstream, resvg ignores the weight axis) while the gallery cards self-host it.
  const raleway = committed.records.find((record) => record.family === "Raleway");
  assert.equal(raleway.bundled.yes, false, "Raleway is not bundled by opf-render");
  assert.equal(raleway.hostVerification.galleryCards, "unverified", "but gallery cards self-host it");
  assert.equal(raleway.hostVerification.galleryEditor, "NA");
  // Node: the default prepareNodeFonts pack is base; office faces need pack: 'office'.
  const carlito = committed.records.find((record) => record.family === "Carlito");
  assert.match(carlito.hostLoading.node, /pack: 'office'/);
  assert.match(carlito.hostLoading.node, /not in the default/);
  const roboto = committed.records.find((record) => record.family === "Roboto");
  assert.match(roboto.hostLoading.node, /default/);
});

test("metric routes are measured, not verified, until vertical metrics and line breaks are recorded", () => {
  assert.ok(!STATUSES.includes("metric-verified"));
  assert.ok(!STATUSES.includes("candidate-qualified-landing"), "the Intos policy is merged");
  const measured = committed.records.filter((record) => record.status === "metric-measured").map((record) => record.family).sort();
  assert.deepEqual(measured, ["Aptos", "Aptos Display", "Aptos Narrow", "Aptos Serif", "Arial", "Calibri", "Courier New", "Georgia", "Times New Roman"]);
  for (const record of committed.records.filter((item) => item.status === "metric-measured")) {
    assert.equal(record.measurements.lineBreaksMatch, null, record.family);
    // Only the Aptos family has recorded vertical metrics (opf#166); the established routes do not.
    assert.equal(record.measurements.verticalMetricsMatch, record.family.startsWith("Aptos") ? true : null, record.family);
  }
});

test("a measurement source override reaches the record (Georgia comes from the opf#163 re-run)", () => {
  const georgia = committed.records.find((record) => record.family === "Georgia");
  assert.equal(georgia.measurements.date, "2026-09-29");
  assert.match(georgia.measurements.sourceNote, /opf#163/);
  const arial = committed.records.find((record) => record.family === "Arial");
  assert.equal(arial.measurements.sourceNote, null);
});

test("per-family acceptance records come from overrides, with fixture, date and evidence", () => {
  const dir = scratchCopy();
  try {
    const file = path.join(dir, FILES.overrides);
    const edited = JSON.parse(readFileSync(file, "utf8"));
    edited.acceptance = { Arial: { fixture: "packages/javascript/test/arial-fixture.test.mjs", accepted: true, date: "2026-10-01", evidence: ["measurement"], note: "four styles, Node" } };
    writeFileSync(file, JSON.stringify(edited));
    const arial = buildTracker({ root: dir }).tracker.records.find((record) => record.family === "Arial");
    assert.equal(arial.acceptance.accepted, true);
    assert.equal(arial.acceptance.date, "2026-10-01");
    assert.equal(arial.acceptance.evidence.length, 1);
    const calibri = buildTracker({ root: dir }).tracker.records.find((record) => record.family === "Calibri");
    assert.equal(calibri.acceptance.accepted, false, "acceptance never transfers to another family");

    edited.acceptance.Arial.date = null;
    writeFileSync(file, JSON.stringify(edited));
    assert.throws(() => buildTracker({ root: dir }), /needs fixture, date and evidence/);

    edited.acceptance = { "No Such Family": { accepted: false } };
    writeFileSync(file, JSON.stringify(edited));
    assert.throws(() => buildTracker({ root: dir }), /No Such Family/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
