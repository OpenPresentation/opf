import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { CLASSES, FILES, ROOT, STATUSES, buildTracker, checkTracker, licensingSummary, renderMarkdown, serialize, snapshotFromSymbolFonts } from "./build-font-tracker.mjs";

const read = (file) => JSON.parse(readFileSync(path.join(ROOT, file), "utf8"));
const policy = read(FILES.policy);
const overrides = read(FILES.overrides);
const committed = read(FILES.json);
const policyNames = policy.families.map((row) => row.family);

// A scratch copy of the inputs, outputs and script, so drift and error cases never touch the checkout.
function scratchCopy() {
  // realpath: on macOS the temporary directory is a symlink, and the script only runs when its resolved path is the entry point.
  const dir = realpathSync(mkdtempSync(path.join(tmpdir(), "font-tracker-")));
  const files = [FILES.policy, FILES.overrides, FILES.json, FILES.markdown, overrides.manifestSnapshot, overrides.galleryFontsSnapshot, overrides.measurementReport, overrides.paritySource, overrides.qualificationReport, overrides.hostFixtureEvidence, overrides.scriptHostFixtureEvidence, overrides.symbolFontsSnapshot, overrides.symbolEncodings, ...overrides.nativeEvidence.map((run) => run.file), ...Object.values(overrides.scriptCorpus), "scripts/build-font-tracker.mjs"];
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
const FF45_FACES = ["Noto Color Emoji", "Noto Emoji", "STIX Two Math", "Noto Sans Math"];

test("the reviewed families split into the owner's four classes", () => {
  // 153 policy families and 7 shipped dependencies were reviewed; opf#166 added the four Intos rows and FF-45 the four emoji and math faces
  // (Noto Color Emoji, Noto Emoji, STIX Two Math, Noto Sans Math).
  assert.equal(committed.summary.records, policy.families.length + overrides.extras.length);
  assert.equal(committed.summary.records - INTOS.length - FF45_FACES.length, 160, "the owner's 160 reviewed families plus the Intos and FF-45 rows");
  for (const name of INTOS) assert.equal(committed.records.find((record) => record.family === name)?.class, "open", name);
  // The seven shipped script-font dependencies (Noto Sans Arabic, Lao, Myanmar, Sinhala, Syriac, Thaana, Noto Serif Tibetan) got policy rows in RR-17 (FF-44).
  assert.equal(overrides.extras.length, 0);
  for (const name of ["Noto Sans Arabic", "Noto Sans Lao", "Noto Sans Myanmar", "Noto Sans Sinhala", "Noto Sans Syriac", "Noto Sans Thaana", "Noto Serif Tibetan"]) assert.equal(committed.records.find((record) => record.family === name)?.inPolicy, true, name);
  const counts = Object.fromEntries(CLASSES.map((cls) => [cls, committed.records.filter((record) => record.class === cls).length]));
  assert.equal(CLASSES.reduce((sum, cls) => sum + counts[cls], 0), committed.summary.records);
  assert.deepEqual(committed.records.filter((record) => record.class === "special").map((record) => record.family).sort(), ["Symbol", "Webdings", "Wingdings"]);
  // FF-45: the three special families preview through the code-table route (opf-render#94), so none still needs a special path.
  for (const record of committed.records.filter((item) => item.class === "special")) assert.equal(record.status, "code-table", record.family);
  for (const record of committed.records.filter((item) => item.class === "open")) assert.equal(record.licenseClass, "open");
  for (const record of committed.records.filter((item) => item.class.startsWith("proprietary"))) assert.notEqual(record.licenseClass, "open");
});

test("every record carries the fields the owner asked for, with valid values", () => {
  const ranks = new Set();
  for (const record of committed.records) {
    const where = record.family;
    assert.equal(record.selectedNamePreservedInPptx, true, where);
    assert.ok(["metric", "visual", "real", "none", "code-table"].includes(record.previewRoute.tier), where);
    assert.ok(Array.isArray(record.previewRoute.alternates), where);
    assert.equal(typeof record.bundled.yes, "boolean", where);
    assert.ok(Array.isArray(record.stylesRequired) && Array.isArray(record.stylesMissing), where);
    assert.ok(record.scripts.length > 0, where);
    assert.ok(record.measurements === null || typeof record.measurements.meanAbsWidthDelta === "number", where);
    for (const host of ["node", "browser", "editor", "galleryEditor", "galleryCards"]) assert.ok(["verified", "unverified", "NA"].includes(record.hostVerification[host]), `${where} ${host}`);
    assert.ok(["verified", "partial", "failed", "unverified", "NA"].includes(record.nativeVerification.status), where);
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
    // Native status comes only from a committed native run that names the family (see the native evidence tests); the rest stay unverified.
    assert.equal(record.nativeVerification.status === "verified", Boolean(record.nativeVerification.runs?.length), record.family);
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
  // RR-17: the open script faces have their own fixture in every host (script-host-fixtures), so they are qualified.
  assert.equal(committed.records.find((record) => record.family === "Noto Sans Mongolian").status, "qualified");
  assert.ok(renderMarkdown(committed).includes("## Script corpus (FF-44)"));
});

// The parity run on the merged Intos mains (opf#175) passes all 704 Aptos and Aptos Display values, so the Aptos
// family no longer leads the priority queue; the queue follows the values that are still not pass.
test("the Aptos family is qualified with Intos bundled and fixtures in every host, and no longer leads the priority queue", () => {
  const intosOf = { Aptos: "Intos", "Aptos Display": "Intos Display", "Aptos Narrow": "Intos Narrow", "Aptos Serif": "Intos Serif" };
  for (const [name, intos] of Object.entries(intosOf)) {
    const record = committed.records.find((item) => item.family === name);
    assert.equal(record.status, "qualified", name);
    assert.equal(record.previewRoute.tier, "metric", name);
    assert.equal(record.previewRoute.family, intos, name);
    assert.equal(record.previewRoute.pendingBundle, null, name);
    assert.equal(record.bundled.yes, true, `${name}: ${intos} is in the pinned manifest`);
    assert.equal(record.bundled.packages[0].name, "intos", name);
    assert.deepEqual(record.bundled.stylesAvailable, ["400", "400i", "700", "700i"], name);
    assert.equal(record.stylesMissing.length, 0, name);
    assert.equal(record.hostVerification.node, "verified", name);
    assert.equal(record.hostVerification.browser, "verified", name);
    assert.equal(record.hostVerification.galleryEditor, "verified", `${name}: the gallery editor serves the Intos faces from its pinned manifest`);
    assert.match(record.hostLoading.galleryEditor, /same-origin/, name);
    assert.match(record.hostLoading.browser, /lazy/, name);
    assert.equal(record.measurements.verticalMetricsMatch, true, name);
  }
  // RR-17: the per-family editor fixture covers all four Aptos families and their Intos faces (Narrow and Serif included).
  for (const name of ["Aptos", "Aptos Display", "Aptos Narrow", "Aptos Serif", ...INTOS]) assert.equal(committed.records.find((item) => item.family === name).hostVerification.editor, "verified", name);
  for (const name of ["Aptos", "Aptos Display"]) {
    const record = committed.records.find((item) => item.family === name);
    assert.equal(record.paritySignals.valuesAffected, 704, name);
    assert.equal(record.paritySignals.fontResolution.pass, 704, name);
    assert.equal(record.priority.valuesOpen, 0, name);
    assert.equal(record.phase, 5, `${name}: only native verification is left`);
    // It ranks below every family that still has work before native verification (phases 1 to 4).
    assert.ok(record.priority.rank > committed.records.filter((item) => item.phase < 5).length, `${name} passes every audited value, so it ranks low (rank ${record.priority.rank})`);
  }
  for (const name of INTOS) {
    const record = committed.records.find((item) => item.family === name);
    assert.equal(record.class, "open", name);
    assert.equal(record.bundled.yes, true, name);
    assert.equal(record.status, "qualified", name);
  }
  // Aptos Mono (RR-17): measured against Aptos Mono 2.01; Cousine matches every width and wrap, the vertical metrics differ, so the tier stays visual.
  const mono = committed.records.find((item) => item.family === "Aptos Mono");
  assert.equal(mono.status, "documented-visual");
  assert.equal(mono.previewRoute.family, "Cousine");
  assert.equal(mono.previewRoute.tier, "visual");
  assert.equal(mono.measurements.meanAbsWidthDelta, 0);
  assert.equal(mono.measurements.maxAbsWidthDelta, 0);
  assert.equal(mono.qualification.lineBreaksIdenticalFraction, 1);
  assert.equal(mono.qualification.verticalMetricsEqual, false);
  // The queue now follows values that are still not pass.
  const top = [...committed.records].sort((a, b) => a.priority.rank - b.priority.rank).slice(0, 10);
  for (const record of top) assert.ok(record.priority.valuesOpen > 0, `${record.family} leads the queue with open values`);
  assert.equal(committed.inputs.parity.file.split("/").pop(), "parity-results-2026-10-02-published-0.12.json");
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
  assert.equal(roboto.priority.hostFactor, 0.25, "every applicable host has a per-family fixture since RR-17, so the factor sits at its floor");
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
  // Raleway is bundled since FF-43 (unmodified upstream statics): the editors draw it, and the gallery cards self-host their own copy, verified separately.
  const raleway = committed.records.find((record) => record.family === "Raleway");
  assert.equal(raleway.bundled.yes, true);
  assert.equal(raleway.hostVerification.galleryEditor, "verified");
  const raleighCard = gallery.families.find((entry) => entry.family === "Raleway");
  assert.equal(raleway.hostVerification.galleryCards, raleighCard.usedAs.includes("Raleway") && !raleighCard.coverageGaps ? "verified" : "unverified", "gallery cards are a different host, verified by pptx-gallery's own test");
  // Node: the default prepareNodeFonts pack is base; office faces need pack: 'office'.
  const carlito = committed.records.find((record) => record.family === "Carlito");
  assert.match(carlito.hostLoading.node, /pack: 'office'/);
  assert.match(carlito.hostLoading.node, /not in the default/);
  const roboto = committed.records.find((record) => record.family === "Roboto");
  assert.match(roboto.hostLoading.node, /default/);
});

test("metric routes are qualified only with four-style widths, line breaks and a fixture in every host", () => {
  assert.ok(!STATUSES.includes("metric-verified"));
  assert.ok(!STATUSES.includes("candidate-qualified-landing"), "the Intos policy is merged");
  const metric = committed.records.filter((record) => record.previewRoute.tier === "metric" && record.class === "proprietary-latin").map((record) => record.family).sort();
  assert.deepEqual(metric, ["Aptos", "Aptos Display", "Aptos Narrow", "Aptos Serif", "Arial", "Calibri", "Courier New", "Georgia", "Times New Roman"]);
  const floor = overrides.latinAcceptance.lineBreakFloor;
  for (const record of committed.records.filter((item) => item.status === "qualified" && item.previewRoute.tier === "metric")) {
    assert.equal(record.measurements.widthBarMet, true, record.family);
    assert.equal(record.measurements.lineBreaksMatch, true, record.family);
    assert.ok(record.qualification.lineBreaksIdenticalFraction >= floor, record.family);
    assert.ok(record.qualification.stylesMeasured >= 4, `${record.family}: four styles`);
    for (const host of overrides.latinAcceptance.hosts) assert.equal(record.hostVerification[host], "verified", `${record.family} ${host}`);
    if (record.nativeVerification.status === "verified") assert.ok(record.nativeVerification.runs.length > 0, `${record.family}: native verified only with a committed run`);
  }
  // Vertical metrics: only the Aptos family matches the real font's hhea, OS/2, x-height and cap-height; the established routes are recorded as differing.
  for (const name of ["Aptos", "Aptos Display", "Aptos Narrow", "Aptos Serif"]) assert.equal(committed.records.find((record) => record.family === name).measurements.verticalMetricsMatch, true, name);
  for (const name of ["Arial", "Calibri", "Georgia", "Courier New", "Times New Roman"]) assert.equal(committed.records.find((record) => record.family === name).measurements.verticalMetricsMatch, false, name);
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
    // Noto Emoji has a recorded browser finding, so nothing derives its acceptance; Arial's record does not transfer to it.
    const emoji = buildTracker({ root: dir }).tracker.records.find((record) => record.family === "Noto Emoji");
    assert.equal(emoji.acceptance.accepted, false, "acceptance never transfers to another family");

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

// RR-17: acceptance for a Latin family is derived from two committed evidence files, never by hand.
test("a Latin family is accepted only with a fixture in every host and a measurement against the real font", () => {
  const rules = overrides.latinAcceptance;
  const hostEvidence = read(overrides.hostFixtureEvidence);
  const qualification = read(overrides.qualificationReport);
  const measured = new Map(qualification.results.map((row) => [row.family, row]));
  // The script, emoji and math families derive theirs from their own evidence (the tests at the end of this file).
  for (const record of committed.records.filter((item) => item.scripts.every((script) => script === "Latin"))) {
    const fixtureHosts = rules.hosts.filter((host) => hostEvidence.hosts[host].families[record.family]);
    if (record.acceptance.accepted) {
      assert.deepEqual(fixtureHosts, rules.hosts, `${record.family}: accepted without a fixture in every host`);
      assert.ok(["qualified", "documented-visual"].includes(record.status), record.family);
      assert.equal(record.acceptance.date, rules.date, record.family);
      assert.ok(record.acceptance.evidence.length >= 2, record.family);
      if (record.class === "proprietary-latin" || record.previewRoute.kind === "alias") {
        assert.equal(measured.get(record.family)?.referenceAvailable, true, `${record.family}: accepted without a reference font`);
        assert.equal(record.status, record.previewRoute.tier === "metric" ? "qualified" : "documented-visual", record.family);
      }
    } else {
      assert.ok(!["qualified", "documented-visual"].includes(record.status), `${record.family} is not accepted`);
    }
  }
  // Didot is Apple-only: it was measured on macOS (RR-17 Mac checks, 2026-10-02) and entered the shared report as a documented look-alike. Its gaps are large and recorded, never hidden; the Microsoft 365 cloud fonts (Grandview, Seaford, Skeena and their Display cuts) were measured once Office cached them.
  for (const name of ["Didot"]) {
    const record = committed.records.find((item) => item.family === name);
    const row = measured.get(name);
    assert.equal(row.referenceAvailable, true, name);
    assert.equal(row.summary.stylesMeasured, 3, `${name}: macOS ships Regular, Bold and Italic only`);
    assert.equal(row.summary.widthBarMet, false, name);
    assert.equal(record.acceptance.accepted, true, name);
    assert.equal(record.status, "documented-visual", name);
    assert.match(record.acceptance.note, /Documented look-alike/, name);
    assert.match(record.appearance.caveat, /wrapping/, name);
  }
  // Liberation: the gallery editor pinned renderer 0.12.0, which carries the alias, so the fixture now passes in all four hosts and the metric alias is accepted.
  for (const name of ["Liberation Sans", "Liberation Serif", "Liberation Mono"]) {
    const record = committed.records.find((item) => item.family === name);
    assert.equal(record.previewRoute.tier, "metric", name);
    assert.deepEqual(rules.hosts.filter((host) => hostEvidence.hosts[host].families[name]), rules.hosts, name);
    assert.equal(record.acceptance.accepted, true, name);
    assert.equal(record.status, "qualified", name);
  }
});

test("the host fixtures name the same Latin families in every host and the qualification covers every Latin route", () => {
  const hostEvidence = read(overrides.hostFixtureEvidence);
  const qualification = read(overrides.qualificationReport);
  assert.equal(hostEvidence.schema, "opf-latin-host-fixtures/v1");
  const node = Object.keys(hostEvidence.hosts.node.families).sort();
  assert.equal(node.length, 87);
  assert.deepEqual(Object.keys(hostEvidence.hosts.browser.families).sort(), node);
  assert.deepEqual(Object.keys(hostEvidence.hosts.editor.families).sort(), node);
  for (const family of Object.keys(hostEvidence.hosts.galleryEditor.families)) assert.ok(node.includes(family), family);
  for (const [host, entry] of Object.entries(hostEvidence.hosts)) {
    assert.match(entry.source.commit, /^[0-9a-f]{40}$/, host);
    for (const family of Object.keys(entry.families)) assert.ok(committed.records.some((record) => record.family === family), `${host}: ${family} has a record`);
  }
  // Every proprietary Latin family has a qualification row, measured or marked unavailable.
  const rows = new Set(qualification.results.map((row) => row.family));
  // Cambria Math and Segoe UI Emoji left the special class in FF-45 (RR-17): their qualification is the FF-45 emoji and math corpus, not the Latin report.
  for (const record of committed.records.filter((item) => item.class === "proprietary-latin" && !["Cambria Math", "Segoe UI Emoji"].includes(item.family))) assert.ok(rows.has(record.family), `${record.family} is in the qualification report`);
  assert.deepEqual(qualification.results.filter((row) => !row.referenceAvailable).map((row) => row.family), []);
});

test("the decisions of RR-17 are recorded: Aptos Narrow and Serif route to Intos, Aptos Mono keeps Cousine, Liberation aliases the Croscore faces", () => {
  const route = (name) => committed.records.find((record) => record.family === name).previewRoute;
  assert.deepEqual([route("Aptos Narrow").family, route("Aptos Narrow").tier], ["Intos Narrow", "metric"]);
  assert.deepEqual([route("Aptos Serif").family, route("Aptos Serif").tier], ["Intos Serif", "metric"]);
  assert.deepEqual([route("Aptos Mono").family, route("Aptos Mono").tier, route("Aptos Mono").alternates], ["Cousine", "visual", ["Roboto Mono"]]);
  assert.deepEqual([route("Liberation Sans").family, route("Liberation Serif").family, route("Liberation Mono").family], ["Arimo", "Tinos", "Cousine"]);
  for (const name of ["Liberation Sans", "Liberation Serif", "Liberation Mono"]) assert.equal(route(name).tier, "metric", name);
});

// ---- 2026-10-02 upgrade: licensing summary, code-table route, native evidence, style rule, gallery cards -------------------------------

const record = (name) => committed.records.find((item) => item.family === name);

test("the summary answers the owner's four questions from the records", () => {
  const l = committed.summary.licensing;
  const recomputed = licensingSummary(committed.records, read(overrides.manifestSnapshot));
  assert.deepEqual(l, recomputed, "the committed summary is the function of the records");
  assert.equal(l.totalFamilies, committed.summary.records);
  assert.equal(l.openDirectlyUsable.total, committed.summary.byClass.open);
  assert.equal(l.openDirectlyUsable.drawnAsItself + l.openDirectlyUsable.openAlias + l.openDirectlyUsable.notBundled, l.openDirectlyUsable.total);
  assert.deepEqual(l.openDirectlyUsable.aliases, ["Liberation Mono", "Liberation Sans", "Liberation Serif", "Source Sans Pro"]);
  assert.equal(l.needsReplacement.total, committed.summary.byClass["proprietary-latin"] + committed.summary.byClass["proprietary-script"] + committed.summary.byClass.special);
  assert.deepEqual(l.needsReplacement.byClass, { "proprietary-latin": 53, "proprietary-script": 41, special: 3 });
  const found = l.replacementFound;
  assert.equal(found.metricCompatible + found.visualLookAlike + found.scriptFace + found.specialPath, found.total);
  assert.equal(found.total + l.noRoute.total, l.needsReplacement.total);
  assert.deepEqual([found.metricCompatible, found.visualLookAlike, found.scriptFace, found.specialPath], [9, 44, 41, 3]);
  assert.deepEqual(l.openDirectlyUsable.byLicense, { "OFL-1.1": 71 });
  assert.equal(l.openDirectlyUsable.drawnAsItself, 67);
  assert.equal(l.openDirectlyUsable.openAlias, 4);
  assert.equal(l.noRoute.total, 0);
  // Every bundled face is under a license the policy allows; the replacement routes use only OFL-1.1.
  const allowed = new Set(["OFL-1.1", "Apache-2.0", "MIT", "UFL-1.0"]);
  for (const license of Object.keys(l.bundledFaceLicenses.manifestPackagesByLicense)) assert.ok(allowed.has(license), license);
  assert.deepEqual(Object.keys(l.bundledFaceLicenses.replacementFacesByLicense), ["OFL-1.1"]);
  assert.equal(Object.values(l.bundledFaceLicenses.replacementRecordsByLicense).reduce((sum, count) => sum + count, 0), found.total);
  const md = renderMarkdown(committed);
  const top = md.slice(0, md.indexOf("## Summary"));
  assert.match(top, /How many fonts do we have\? \| 168 \|/);
  assert.match(top, /\| 97 \| 9 metric-compatible, 44 visual look-alike \(Latin\), 41 script face, 3 special path/);
  assert.doesNotMatch(md, /pptx\.gallery shows|support badge/i);
});

test("a proprietary family without a bundled route counts as no route, not as found", () => {
  const records = structuredClone(committed.records);
  const calibri = records.find((item) => item.family === "Calibri");
  calibri.bundled.yes = false;
  const l = licensingSummary(records, read(overrides.manifestSnapshot));
  assert.deepEqual(l.noRoute.families, ["Calibri"]);
  assert.equal(l.replacementFound.total, 96);
  assert.equal(l.replacementFound.metricCompatible, 8);
});

test("Symbol, Wingdings and Webdings carry the code-table route from the pinned symbol snapshot", () => {
  const snapshot = read(overrides.symbolFontsSnapshot);
  assert.match(snapshot.source.commit, /^[0-9a-f]{40}$/);
  assert.equal(snapshot.source.repository, "OpenPresentation/opf-render");
  assert.equal(snapshot.script, "Zsym");
  assert.equal(committed.inputs.symbolFonts.commit, snapshot.source.commit);
  const manifest = read(overrides.manifestSnapshot);
  const shipped = new Set(manifest.packages.flatMap((pkg) => pkg.faces.map((face) => face.family)));
  for (const name of ["Symbol", "Wingdings", "Webdings"]) {
    const item = record(name);
    assert.equal(item.previewRoute.kind, "code-table", name);
    assert.equal(item.previewRoute.tier, "code-table", name);
    assert.equal(item.previewRoute.family, null, name);
    assert.deepEqual(item.previewRoute.chain, snapshot.previewFaces[name], name);
    for (const face of item.previewRoute.chain) assert.ok(shipped.has(face), `${name}: ${face} is in the pinned render manifest`);
    assert.equal(item.bundled.yes, true, name);
    assert.equal(item.bundled.applies, "code-table", name);
    assert.equal(item.status, "code-table", name);
    assert.equal(item.licenseClass, "proprietary-standard", name);
    assert.equal(item.hostVerification.node, "verified", name);
    assert.equal(item.hostVerification.browser, "verified", name);
    assert.equal(item.hostVerification.editor, "unverified", name);
    // Nothing is claimed beyond what is verified: the FF-46 native run read the name back (not the glyph shapes), and acceptance stays pending.
    assert.equal(item.nativeVerification.status, "verified", name);
    assert.deepEqual(item.nativeVerification.runs.map((run) => run.run), ["ff-46-native-0.12-20261002"], name);
    assert.equal(item.acceptance.accepted, false, name);
    assert.match(item.statusReason, /native PowerPoint name read-back passed/, name);
    assert.match(item.nextAction, /no a:sym element/, name);
  }
  assert.deepEqual(snapshot.previewFaces.Wingdings, ["Noto Sans Symbols 2", "Noto Sans Symbols", "Noto Sans Math", "Noto Sans"]);
  assert.match(renderMarkdown(committed), /## Symbol-encoded families \(FF-45\)/);
  assert.equal(committed.summary.licensing.replacementFound.specialPath, 3);
});

test("a code-table route whose chain has an unbundled face falls back to needs-special-path", () => {
  const dir = scratchCopy();
  try {
    const file = path.join(dir, overrides.symbolFontsSnapshot);
    const edited = JSON.parse(readFileSync(file, "utf8"));
    edited.previewFaces.Webdings = ["Noto Sans Symbols 2", "Not A Bundled Face"];
    writeFileSync(file, JSON.stringify(edited));
    const webdings = buildTracker({ root: dir }).tracker.records.find((item) => item.family === "Webdings");
    assert.equal(webdings.status, "needs-special-path");
    assert.equal(webdings.bundled.yes, false);
    assert.match(webdings.statusReason, /Not A Bundled Face/);
    const summary = buildTracker({ root: dir }).tracker.summary.licensing;
    assert.deepEqual(summary.noRoute.families, ["Webdings"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the symbol snapshot is reduced from the renderer module and refuses a bad commit", () => {
  const snapshot = snapshotFromSymbolFonts({ SYMBOL_SCRIPT: "Zsym", SYMBOL_PLACEHOLDER: "□", SYMBOL_PREVIEW_FACES: Object.freeze({ Symbol: Object.freeze(["Noto Sans"]) }) }, { commit: "a".repeat(40), capturedAt: "2026-10-02" });
  assert.deepEqual(snapshot.previewFaces, { Symbol: ["Noto Sans"] });
  assert.equal(snapshot.source.path, "src/symbol-fonts.js");
  const run = spawnSync(process.execPath, [path.join(ROOT, "scripts/build-font-tracker.mjs"), "--snapshot-symbol-fonts", "x.js", "--commit", "abc"], { encoding: "utf8" });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /40-character/);
});

test("native verification comes from committed comparison output, and only for families the runs name", () => {
  const verified = committed.summary.nativeVerifiedFamilies;
  // FF-46 (2026-10-02): every deck of the 0.12.0 native run passes, and every family is named by one, so every record is verified by name read-back.
  assert.deepEqual([...verified].sort(), committed.records.map((item) => item.family).sort());
  assert.deepEqual(committed.summary.nativeVerification, { verified: committed.records.length, partial: 0, failed: 0, unverified: 0, NA: 0 });
  assert.deepEqual(committed.summary.nativeFailedFamilies, []);
  assert.equal(committed.summary.nativeVerification.verified, verified.length);
  assert.deepEqual(committed.inputs.nativeEvidence.map((run) => run.id), ["rr-05b-native-20261002", "rr-05-cjk-native-20261002", "ff-46-native-0.12-20261002"]);
  const runs = Object.fromEntries(committed.inputs.nativeEvidence.map((run) => [run.id, run]));
  assert.equal(runs["rr-05b-native-20261002"].decks, 4);
  assert.equal(runs["rr-05b-native-20261002"].decksPassing, 4);
  assert.equal(runs["rr-05-cjk-native-20261002"].decks, 9);
  assert.equal(runs["rr-05-cjk-native-20261002"].decksPassing, 8);
  assert.deepEqual(runs["rr-05-cjk-native-20261002"].failingChecks, [{ deck: "lang-ja-meiryo", failing: ["presentationFonts"], detail: ["presentation-fonts-extra"] }]);
  assert.equal(runs["ff-46-native-0.12-20261002"].decks, 43);
  assert.equal(runs["ff-46-native-0.12-20261002"].decksPassing, 43);
  assert.deepEqual(runs["ff-46-native-0.12-20261002"].failingChecks, []);
  for (const name of verified) {
    const item = record(name);
    assert.equal(item.nativeVerification.status, "verified", name);
    assert.ok(item.nativeVerification.runs.length > 0 && item.nativeVerification.basis.length > 0, name);
    for (const run of item.nativeVerification.runs) {
      assert.ok(existsSync(path.join(ROOT, run.file)) && existsSync(path.join(ROOT, run.readme)), `${name}: evidence files exist`);
      assert.ok(run.decks.every((deck) => deck.via.length > 0), `${name}: read back by a theme slot or Presentation.Fonts`);
    }
    assert.ok(item.evidence.some((entry) => entry.url.startsWith("docs/evidence/rr-05") || entry.url.startsWith("docs/evidence/ff-46")), name);
    assert.match(item.nextAction, /Native name read-back passed/, name);
  }
  // Which family came from which deck.
  assert.deepEqual(record("Arabic Typesetting").nativeVerification.runs.map((run) => run.run), ["rr-05b-native-20261002", "ff-46-native-0.12-20261002"]);
  assert.deepEqual(record("David").nativeVerification.runs[0].decks.map((deck) => deck.deck), ["lang-he", "rtl-structures-he"]);
  assert.deepEqual(record("Mangal").nativeVerification.runs[0].decks.map((deck) => deck.deck), ["lang-hi"]);
  assert.deepEqual(record("Aptos").nativeVerification.runs.map((run) => run.run).sort(), ["ff-46-native-0.12-20261002", "rr-05-cjk-native-20261002", "rr-05b-native-20261002"]);
  // lang-ja-meiryo failed only the Presentation.Fonts check (FF-05); Meiryo is verified by the decks that pass and the failure is a caveat.
  assert.deepEqual(record("Meiryo").nativeVerification.runs[0].decks.map((deck) => deck.deck), ["lang-ja", "size-4x3-japanese"]);
  assert.match(record("Meiryo").nativeVerification.caveat, /lang-ja-meiryo \(presentationFonts\)/);
  assert.match(record("Aptos").nativeVerification.caveat, /FF-05/);
  // Families only the FF-46 run names are verified by it alone, through their own slide (per-run names and Presentation.Fonts).
  for (const name of ["Calibri", "Arial", "Wingdings", "Noto Sans JP", "Aptos Narrow", "Cambria Math", "Segoe UI Emoji"]) {
    assert.deepEqual(record(name).nativeVerification.runs.map((run) => run.run), ["ff-46-native-0.12-20261002"], name);
  }
  assert.match(record("Arial").nativeVerification.note, /Passed in ff-46-native-0.12-20261002/);
  // Evidence is committed without absolute user paths.
  for (const run of overrides.nativeEvidence) for (const file of [run.file, path.join(path.dirname(run.file), "compare.md")]) assert.doesNotMatch(readFileSync(path.join(ROOT, file), "utf8"), /[A-Z]:\\Users|\/Users\/|micha/, file);
});

test("a deck that fails a gated check marks the families it reads back failed, and a family no deck names stays unverified", () => {
  const dir = scratchCopy();
  try {
    // The FF-46 run names every family; take it out so the RR-05 decks below are the only evidence being perturbed.
    const baseFile = path.join(dir, FILES.overrides);
    const base = JSON.parse(readFileSync(baseFile, "utf8"));
    base.nativeEvidence = base.nativeEvidence.filter((run) => run.id !== "ff-46-native-0.12-20261002");
    writeFileSync(baseFile, JSON.stringify(base));
    const cjk = path.join(dir, "docs/evidence/rr-05-cjk-native-20261002/compare.json");
    const report = JSON.parse(readFileSync(cjk, "utf8"));
    const deck = (id) => report.decks.find((item) => item.id === id);
    // Mangal: the only deck that names it fails the per-run fonts check.
    deck("lang-hi").checks.fonts.ok -= 1;
    // Microsoft YaHei: the fonts and theme slots match but Presentation.Fonts lists an extra family: partial, with the reason.
    deck("lang-zh-hans").checks.presentationFonts.ok = false;
    // Angsana New: a deck that never opened fails the fonts check (nothing was read), so the family is failed, not verified.
    deck("lang-th").opened = false;
    writeFileSync(cjk, JSON.stringify(report));
    const rebuilt = buildTracker({ root: dir }).tracker;
    const get = (name) => rebuilt.records.find((item) => item.family === name).nativeVerification;
    // A deck that reads the family back and fails a gated check marks the family failed, with the check, the deck and the evidence run.
    assert.equal(get("Mangal").status, "failed");
    assert.deepEqual(get("Mangal").failures.map((item) => [item.run, item.deck, item.failing]), [["rr-05-cjk-native-20261002", "lang-hi", ["fonts"]]]);
    assert.equal(get("Microsoft YaHei").status, "failed");
    assert.deepEqual(get("Microsoft YaHei").failures.map((item) => [item.deck, item.failing]), [["lang-zh-hans", ["presentationFonts"]]]);
    assert.match(get("Microsoft YaHei").note, /^FAILED in rr-05-cjk-native-20261002: lang-zh-hans \(presentationFonts/);
    assert.equal(get("Microsoft YaHei").runs[0].readme, "docs/evidence/rr-05-cjk-native-20261002/README.md");
    assert.equal(get("Angsana New").status, "failed");
    assert.deepEqual(get("Angsana New").failures.map((item) => [item.deck, item.failing]), [["lang-th", ["fonts"]]]);
    assert.equal(get("Malgun Gothic").status, "verified");
    assert.ok(!rebuilt.summary.nativeVerifiedFamilies.includes("Mangal"));
    assert.deepEqual(rebuilt.summary.nativePartialFamilies, []);
    assert.deepEqual([...rebuilt.summary.nativeFailedFamilies].sort(), ["Angsana New", "Mangal", "Microsoft YaHei"]);
    assert.equal(rebuilt.summary.nativeVerification.failed, 3);
    assert.match(rebuilt.records.find((item) => item.family === "Mangal").nextAction, /Native name read-back FAILED \(lang-hi: fonts\)/);
    // Drop the whole run: its families go back to unverified; Aptos stays verified through the other run.
    const overridesFile = path.join(dir, FILES.overrides);
    const edited = JSON.parse(readFileSync(overridesFile, "utf8"));
    edited.nativeEvidence = edited.nativeEvidence.filter((run) => run.id !== "rr-05-cjk-native-20261002");
    writeFileSync(overridesFile, JSON.stringify(edited));
    const without = buildTracker({ root: dir }).tracker;
    assert.equal(without.records.find((item) => item.family === "Meiryo").nativeVerification.status, "unverified");
    assert.equal(without.records.find((item) => item.family === "Aptos").nativeVerification.status, "verified");
    assert.equal(without.summary.nativeVerification.verified, 4, "Aptos, Aptos Display, Arabic Typesetting and David remain, from the Arabic and Hebrew run");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a failing FF-46 deck marks failed the families only that deck reads back, and a passing deck elsewhere keeps a family verified", () => {
  const dir = scratchCopy();
  try {
    const file = path.join(dir, "docs/evidence/ff-46-native-0.12-20261002/compare.json");
    const report = JSON.parse(readFileSync(file, "utf8"));
    const deck = report.decks.find((item) => item.id === "latin-03-tahoma");
    deck.checks.presentationFonts.ok = false;
    deck.checks.presentationFonts.extras = ["Aptos"];
    deck.mismatches = [{ kind: "presentation-fonts-extra", extras: ["Aptos"] }];
    writeFileSync(file, JSON.stringify(report));
    const rebuilt = buildTracker({ root: dir }).tracker;
    // Tahoma's slide is only in this deck: it reads the family back and a gated check fails, so Tahoma is failed with the check and the mismatch kind.
    const tahoma = rebuilt.records.find((item) => item.family === "Tahoma").nativeVerification;
    assert.equal(tahoma.status, "failed");
    assert.deepEqual(tahoma.failures.map((item) => [item.run, item.deck, item.failing, item.mismatchKinds, item.shapesFontsOk]), [["ff-46-native-0.12-20261002", "latin-03-tahoma", ["presentationFonts"], ["presentation-fonts-extra"], "53/53"]]);
    assert.ok(tahoma.failures[0].via.length > 0);
    assert.match(tahoma.note, /^FAILED in ff-46-native-0\.12-20261002: latin-03-tahoma \(presentationFonts; presentation-fonts-extra; 53\/53 shapes\)/);
    const failed = rebuilt.summary.nativeFailedFamilies;
    assert.ok(failed.includes("Tahoma"));
    assert.equal(rebuilt.summary.nativeVerification.failed, failed.length);
    assert.equal(rebuilt.summary.nativeVerification.verified + failed.length, committed.records.length);
    assert.deepEqual(rebuilt.inputs.nativeEvidence.find((run) => run.id === "ff-46-native-0.12-20261002").failingChecks.map((item) => item.deck), ["latin-03-tahoma"]);
    // A family that a passing deck also reads back stays verified, with the failing deck as a caveat.
    const ok = JSON.parse(readFileSync(file, "utf8"));
    const aptosDeck = ok.decks.find((item) => item.id === "latin-01-aptos");
    aptosDeck.checks.presentationFonts.native.push("Tahoma");
    aptosDeck.checks.presentationFonts.expected.push("Tahoma");
    writeFileSync(file, JSON.stringify(ok));
    const again = buildTracker({ root: dir }).tracker.records.find((item) => item.family === "Tahoma").nativeVerification;
    assert.equal(again.status, "verified");
    assert.match(again.caveat, /latin-03-tahoma \(presentationFonts\)/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a family whose real font ships one face has no style gap, and the rule rejects a declared list the measurement contradicts", () => {
  for (const name of ["Cambria Math", "Segoe UI Emoji", "STIX Two Math", "Noto Color Emoji"]) {
    const item = record(name);
    assert.notEqual(item.status, "style-gap", name);
    assert.deepEqual(item.stylesRequired, ["400"], name);
    assert.deepEqual(item.stylesMissing, [], name);
    assert.match(item.stylesBasis, /^declared:/, name);
  }
  assert.deepEqual(record("Cambria Math").replacementStylesRequired, ["400"]);
  assert.deepEqual(record("Segoe UI Emoji").replacementStylesRequired, ["400"]);
  assert.equal(committed.summary.byStatus["style-gap"], 0);
  assert.match(record("Cambria Math").stylesBasis, /cambria\.ttc/);
  assert.match(record("Segoe UI Emoji").stylesBasis, /seguiemj\.ttf/);
  const dir = scratchCopy();
  try {
    const file = path.join(dir, FILES.overrides);
    const edited = JSON.parse(readFileSync(file, "utf8"));
    // Without the declaration the four-style assumption returns, and the gap with it: the rule reads the real font's styles from the data.
    const cambria = edited.stylesRequired["Cambria Math"];
    delete edited.stylesRequired["Cambria Math"];
    writeFileSync(file, JSON.stringify(edited));
    assert.equal(buildTracker({ root: dir }).tracker.records.find((item) => item.family === "Cambria Math").status, "style-gap");
    // A declared list that disagrees with the styles measured on the real font is an error, not a silent override.
    edited.stylesRequired["Cambria Math"] = cambria;
    edited.stylesRequired.Calibri = { styles: ["400"], reason: "wrong" };
    writeFileSync(file, JSON.stringify(edited));
    assert.throws(() => buildTracker({ root: dir }), /stylesRequired for Calibri disagrees with the measured styles/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("gallery cards are verified for the families pptx-gallery's own preview-font test covers, from a current snapshot", () => {
  const gallery = read(committed.inputs.galleryPreviewFonts.file);
  assert.equal(committed.inputs.galleryPreviewFonts.commit, gallery.source.commit);
  assert.ok(gallery.source.capturedAt >= "2026-10-02", "the card snapshot is refreshed, not the 2026-09-29 pin");
  const cards = new Map(gallery.families.map((entry) => [entry.family, entry]));
  let verified = 0;
  for (const item of committed.records) {
    const card = item.previewRoute.family ? cards.get(item.previewRoute.family) : null;
    const expected = !card ? "NA" : card.usedAs.includes(item.family) && !card.coverageGaps ? "verified" : "unverified";
    assert.equal(item.hostVerification.galleryCards, expected, item.family);
    if (expected === "verified") verified += 1;
  }
  assert.equal(committed.summary.hostVerification.galleryCards.verified, verified);
  assert.ok(verified > 0, "the host is no longer recorded as 0 verified");
  assert.equal(record("Arial").hostVerification.galleryCards, "verified");
  assert.equal(record("Sylfaen").hostVerification.galleryCards, "unverified", "Noto Sans has a recorded Georgian coverage gap in the cards");
  assert.equal(record("Calibri Light").hostVerification.galleryCards, "unverified", "no font scheme uses Calibri Light");
});

// ---- RR-17 (FF-44, FF-45): the open script, emoji and math families derive acceptance from their own per-host fixture evidence ----------

const SCRIPT_HOSTS = overrides.scriptAcceptance.hosts;
const isLatinOnly = (rec) => rec.scripts.every((script) => script === "Latin");

test("an open script, emoji or math family is qualified only with a passing fixture in every host, and a recorded finding keeps it out", () => {
  const rules = overrides.scriptAcceptance;
  const evidence = read(overrides.scriptHostFixtureEvidence);
  assert.deepEqual(rules.hosts, ["node", "browser", "editor", "galleryEditor"]);
  const open = committed.records.filter((rec) => rec.class === "open" && !isLatinOnly(rec));
  assert.equal(open.length, 35, "the 35 faces of the scripts pack");
  for (const rec of open) {
    const passed = rules.hosts.filter((host) => evidence.hosts[host].families[rec.family]);
    const findings = rules.hosts.filter((host) => evidence.hosts[host].findings?.[rec.family]);
    // A family is under a host's families or its findings, never both.
    for (const host of findings) assert.ok(!evidence.hosts[host].families[rec.family], `${rec.family}: both passed and a finding in ${host}`);
    if (passed.length === rules.hosts.length) {
      assert.equal(rec.acceptance.accepted, true, rec.family);
      assert.equal(rec.status, "qualified", rec.family);
      assert.equal(rec.acceptance.date, rules.date, rec.family);
      assert.ok(rec.acceptance.evidence.length >= 2, rec.family);
      assert.match(rec.acceptance.note, /draws as itself in every host/, rec.family);
      for (const host of rules.hosts) assert.equal(rec.hostVerification[host], "verified", `${rec.family} ${host}`);
      assert.equal(rec.phase, 5, rec.family);
      assert.equal(rec.hostFixtureFindings, undefined, rec.family);
    } else {
      assert.equal(rec.acceptance.accepted, false, rec.family);
      assert.equal(rec.status, "baseline-needed", rec.family);
      assert.ok(findings.length > 0 || passed.length > 0, `${rec.family}: not accepted without a reason`);
      if (findings.length) {
        assert.deepEqual(Object.keys(rec.hostFixtureFindings), findings, rec.family);
        assert.match(rec.acceptance.note, /Not accepted: the fixture recorded a finding in/, rec.family);
        for (const host of findings) assert.notEqual(rec.hostVerification[host], "verified", `${rec.family} ${host}`);
      }
    }
  }
  // The one recorded finding: Chromium falls back for the emoji-presentation sequences of the monochrome Noto Emoji; the check was not relaxed.
  const emoji = committed.records.find((rec) => rec.family === "Noto Emoji");
  assert.equal(emoji.status, "baseline-needed");
  assert.deepEqual(Object.keys(emoji.hostFixtureFindings), ["browser"]);
  assert.deepEqual(rules.hosts.filter((host) => evidence.hosts[host].families["Noto Emoji"]), ["node", "editor", "galleryEditor"]);
  assert.match(emoji.hostFixtureFindings.browser.reason, /1\.0000? em|1\.000 em/);
  assert.equal(committed.records.find((rec) => rec.family === "Noto Color Emoji").status, "qualified");
  assert.equal(committed.summary.byStatus["baseline-needed"], open.filter((rec) => rec.status === "baseline-needed").length, "no other family is baseline-needed");
});

test("the script host fixtures name the same families in every host, every one of them in the scripts pack, and none is also a Latin fixture", () => {
  const evidence = read(overrides.scriptHostFixtureEvidence);
  const latin = read(overrides.hostFixtureEvidence);
  assert.equal(evidence.schema, "opf-script-host-fixtures/v1");
  const all = Object.keys(evidence.hosts.node.families).sort();
  assert.equal(all.length, 35);
  for (const host of SCRIPT_HOSTS) {
    const entry = evidence.hosts[host];
    assert.match(entry.source.commit, /^[0-9a-f]{40}$/, host);
    const names = [...Object.keys(entry.families), ...Object.keys(entry.findings ?? {})].sort();
    assert.deepEqual(names, all, `${host} accounts for every family (passed or a finding)`);
    for (const [family, value] of Object.entries(entry.families)) {
      assert.ok(committed.records.some((rec) => rec.family === family), `${host}: ${family} has a record`);
      assert.equal(value.route, family, `${host}: ${family} draws itself`);
      assert.ok(value.files.length >= 1 && value.samples.length >= 2 && value.lazyBytes > 0, `${host}: ${family} names its files and at least two samples`);
      assert.ok(!latin.hosts[host].families[family], `${family} is in both fixture files (${host})`);
    }
    for (const [family, finding] of Object.entries(entry.findings ?? {})) assert.ok(finding.check && finding.reason, `${host}: ${family} finding says what failed and why`);
  }
  assert.deepEqual(Object.keys(evidence.hosts.browser.findings), ["Noto Emoji"]);
});

test("the script rule leaves the Latin path alone: without it the Latin records are unchanged, and a family missing from one host is not accepted", () => {
  const dir = scratchCopy();
  try {
    const file = path.join(dir, FILES.overrides);
    const edited = JSON.parse(readFileSync(file, "utf8"));
    delete edited.scriptAcceptance;
    delete edited.scriptHostFixtureEvidence;
    writeFileSync(file, JSON.stringify(edited));
    const without = buildTracker({ root: dir }).tracker.records;
    // Every Latin-only record is identical except its global priority rank (the ranking counts the other families).
    const strip = (rec) => ({ ...rec, priority: { ...rec.priority, rank: 0 } });
    for (const rec of committed.records.filter(isLatinOnly)) {
      assert.deepEqual(strip(without.find((item) => item.family === rec.family)), strip(rec), rec.family);
    }
    // Without the script evidence the open script faces fall back to the authored host map and stay baseline-needed.
    for (const rec of without.filter((item) => item.class === "open" && !isLatinOnly(item))) assert.equal(rec.status, "baseline-needed", rec.family);

    // With the evidence, a family dropped from the gallery editor's fixture is not accepted and the note names the missing host.
    const again = JSON.parse(readFileSync(file, "utf8"));
    again.scriptAcceptance = overrides.scriptAcceptance;
    again.scriptHostFixtureEvidence = overrides.scriptHostFixtureEvidence;
    writeFileSync(file, JSON.stringify(again));
    const evidenceFile = path.join(dir, overrides.scriptHostFixtureEvidence);
    const evidence = JSON.parse(readFileSync(evidenceFile, "utf8"));
    delete evidence.hosts.galleryEditor.families["Noto Sans Hebrew"];
    writeFileSync(evidenceFile, JSON.stringify(evidence));
    const dropped = buildTracker({ root: dir }).tracker.records.find((item) => item.family === "Noto Sans Hebrew");
    assert.equal(dropped.status, "baseline-needed");
    assert.equal(dropped.acceptance.accepted, false);
    assert.match(dropped.acceptance.note, /the script fixture passes in node, browser, editor and is missing in galleryEditor/);
    assert.equal(dropped.hostVerification.galleryEditor, "unverified");

    // A family in both the Latin and the script evidence is an error: each family has one fixture model.
    const latin = JSON.parse(readFileSync(path.join(dir, overrides.hostFixtureEvidence), "utf8"));
    latin.hosts.node.families["Noto Sans Hebrew"] = latin.hosts.node.families.Arial;
    writeFileSync(path.join(dir, overrides.hostFixtureEvidence), JSON.stringify(latin));
    evidence.hosts.node.families["Noto Sans Hebrew"] = evidence.hosts.node.families["Noto Sans JP"];
    writeFileSync(evidenceFile, JSON.stringify(evidence));
    assert.throws(() => buildTracker({ root: dir }), /Noto Sans Hebrew is in both the Latin and the script host fixture evidence/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the assembler turns the four host reports into the evidence file, with a finding beside the families and never among them", async () => {
  const { assemble } = await import("./assemble-script-host-evidence.mjs");
  const row = (family) => ({ family, route: family, package: "noto-sans-x", scripts: ["Xxxx"], files: [`noto-sans-x/${family}.ttf`], lazyBytes: 1048576, samples: ["a", "b"], weights: [400] });
  const report = { node: "v26", browser: "1", renderer: "0.12.0", manifestVersion: "0.12.0", report: [row("A"), row("B")] };
  const commit = "0".repeat(40);
  const out = assemble({ node: report, browser: { ...report, report: [row("A")], findings: [{ family: "B", message: "advance differs", reason: "why" }] }, editor: report, gallery: report, commits: { render: commit, editor: commit, gallery: commit } });
  assert.deepEqual(Object.keys(out.hosts), ["node", "browser", "editor", "galleryEditor"]);
  assert.deepEqual(Object.keys(out.hosts.browser.families), ["A"]);
  assert.deepEqual(out.hosts.browser.findings, { B: { check: "advance differs", reason: "why" } });
  assert.equal(out.hosts.node.findings, undefined);
  assert.equal(out.lazyBudget.node.families, 2);
});
