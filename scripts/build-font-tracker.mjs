// FF-40: build the per-font fidelity tracker.
//
//   node scripts/build-font-tracker.mjs            write font-tracker.json and font-tracker.md
//   node scripts/build-font-tracker.mjs --check    fail when either file differs from a fresh build (drift)
//   node scripts/build-font-tracker.mjs --snapshot-manifest <opf-render>/src/font-manifest.js --commit <sha>
//                                                  refresh the pinned render-manifest snapshot, then rebuild
//   node scripts/build-font-tracker.mjs --snapshot-gallery-fonts <pptx-gallery>/data/preview-fonts.json --commit <sha>
//                                                  refresh the pinned gallery preview-font (cards) snapshot, then rebuild
//   node scripts/build-font-tracker.mjs --snapshot-symbol-fonts <opf-render>/src/symbol-fonts.js --commit <sha>
//                                                  refresh the pinned symbol preview-face (code-table route) snapshot, then rebuild
//
// Derived data (never hand edited): spec/reference/font-policy.json, the measurement report, the pinned
// opf-render font manifest snapshot, the pinned opf-render symbol-font snapshot, the pinned pptx.gallery preview-font snapshot, the committed
// native PowerPoint comparison output (overrides.nativeEvidence) and the committed parity results. Authored data:
// docs/programs/font-fidelity-everywhere/font-tracker.overrides.json (owner plan text, reconciled next
// actions, evidence keys, classes, scripts, style rules and in-flight candidates).
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { reportStale } from "./tracker-staleness.mjs";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = "docs/programs/font-fidelity-everywhere";
export const FILES = {
  json: `${DIR}/font-tracker.json`,
  markdown: `${DIR}/font-tracker.md`,
  overrides: `${DIR}/font-tracker.overrides.json`,
  policy: "spec/reference/font-policy.json",
};
export const SCHEMA = "opf-font-tracker/v1";
export const CLASSES = ["proprietary-latin", "proprietary-script", "open", "special"];
export const STATUSES = [
  "loading-gap",
  "style-gap",
  "policy-gap",
  "needs-special-path",
  "code-table",
  "visual-gap",
  "script-gap",
  "baseline-needed",
  "metric-measured",
  "documented-visual",
  "qualified",
];
const HOSTS = ["node", "browser", "editor", "galleryEditor", "galleryCards"];
const FOUR = ["400", "400i", "700", "700i"];
const TWO = ["400", "700"];

const readJson = (root, file) => JSON.parse(readFileSync(path.join(root, file), "utf8"));
const styleKey = (weight, italic) => `${weight}${italic ? "i" : ""}`;
const styleOrder = (a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10) || a.length - b.length;
const sortStyles = (styles) => [...new Set(styles)].sort(styleOrder);
const round = (value, digits = 4) => Math.round(value * 10 ** digits) / 10 ** digits;
const ratio = (value) => (value === null || value === undefined ? "n/a" : `${value}x`);
const pct = (value) => (value === null || value === undefined ? "-" : `${round(value * 100, 2)}%`);

// ---- render manifest snapshot -----------------------------------------------------------------

/** Reduce the opf-render BUNDLED_FONT_MANIFEST to what the tracker reads, tagged with its source commit. */
export function snapshotFromManifest(manifest, { commit, capturedAt }) {
  return {
    description:
      "Pinned snapshot of the opf-render bundled font manifest (src/font-manifest.js, BUNDLED_FONT_MANIFEST), reduced to the fields the font tracker reads. Refresh with: node scripts/build-font-tracker.mjs --snapshot-manifest <opf-render>/src/font-manifest.js --commit <sha>. Core tests read this file so they never need the sibling repository.",
    source: { repository: "OpenPresentation/opf-render", commit, path: "src/font-manifest.js", capturedAt, manifestVersion: manifest.version },
    packages: manifest.packages.map((pkg) => ({
      name: pkg.name,
      version: pkg.version,
      pack: pkg.pack,
      vendored: pkg.vendored ?? null,
      source: pkg.source,
      license: pkg.license,
      licenseSha256: pkg.licenseSha256,
      reservedFontNames: pkg.reservedFontNames,
      faces: pkg.faces.map((face) => ({ file: face.file, family: face.family, weight: face.weight, italic: face.italic, sha256: face.sha256 })),
    })),
  };
}

/** Reduce pptx.gallery's data/preview-fonts.json (the self-hosted webfonts behind gallery cards) to what the tracker reads. */
export function gallerySnapshotFromPreviewFonts(previewFonts, { commit, capturedAt }) {
  return {
    description:
      `Pinned snapshot of pptx.gallery's self-hosted preview webfonts (data/preview-fonts.json, contract ${previewFonts.contract}), reduced to the fields the font tracker reads. These serve gallery cards, not the gallery editor (a vendored opf-editor bundle). Refresh with: node scripts/build-font-tracker.mjs --snapshot-gallery-fonts <pptx-gallery>/data/preview-fonts.json --commit <sha>.`,
    source: { repository: "Data-Advantage/pptx-gallery", commit, path: "data/preview-fonts.json", capturedAt, contract: previewFonts.contract },
    families: previewFonts.families.map((family) => ({
      family: family.family,
      package: family.package ?? family.repository ?? null,
      version: family.version,
      kind: family.kind,
      license: family.license,
      weights: family.weights,
      usedAs: family.usedAs ?? [],
      faces: family.faces.length,
      coverageGaps: family.coverageGaps || null,
    })),
  };
}

const WEIGHT_NAMES = /^(Thin|ExtraLight|Light|Medium|SemiBold|Bold|ExtraBold|Black)$/;

function bundleIndex(snapshot) {
  const byFamily = new Map();
  for (const pkg of snapshot.packages) {
    const base = pkg.faces.find((face) => face.weight === 400 && !face.italic)?.family ?? pkg.faces[0].family;
    for (const face of pkg.faces) {
      // Weight-named faces of one package (Roboto Medium, Roboto SemiBold) belong to the package's family.
      const suffix = face.family.startsWith(`${base} `) ? face.family.slice(base.length + 1) : null;
      const family = face.family === base || (suffix && WEIGHT_NAMES.test(suffix)) ? base : face.family;
      const entry = byFamily.get(family) ?? { family, packages: new Map(), faces: [] };
      entry.packages.set(pkg.name, pkg);
      entry.faces.push({ style: styleKey(face.weight, face.italic), file: face.file, sha256: face.sha256, package: pkg.name });
      byFamily.set(family, entry);
    }
  }
  return byFamily;
}

function bundledRecord(index, family, applies) {
  const entry = family ? index.get(family) : null;
  if (!entry) return { yes: false, applies, family: family ?? null, packages: [], faces: [], stylesAvailable: [], pack: null };
  const packages = [...entry.packages.values()];
  return {
    yes: true,
    applies,
    family,
    pack: packages[0].pack,
    packages: packages.map((pkg) => ({
      name: pkg.name,
      version: pkg.version,
      pack: pkg.pack,
      source: pkg.source,
      vendored: pkg.vendored,
      license: pkg.license,
      reservedFontNames: pkg.reservedFontNames,
    })),
    faces: entry.faces.map((face) => ({ style: face.style, file: face.file, sha256: face.sha256 })).sort((a, b) => styleOrder(a.style, b.style)),
    stylesAvailable: sortStyles(entry.faces.map((face) => face.style)),
  };
}

/**
 * Reduce opf-render's symbol-font module (src/symbol-fonts.js: SYMBOL_PREVIEW_FACES, SYMBOL_SCRIPT, SYMBOL_PLACEHOLDER) to the code-table
 * route the tracker reads (FF-45): the open faces a symbol-encoded family previews with, in the order a code tries them.
 */
export function snapshotFromSymbolFonts(symbolFonts, { commit, capturedAt }) {
  return {
    description:
      "Pinned snapshot of opf-render's symbol-font preview route (src/symbol-fonts.js, SYMBOL_PREVIEW_FACES), reduced to the fields the font tracker reads. Symbol, Wingdings, Wingdings 2, Wingdings 3 and Webdings are not text fonts: their codes map to Unicode through core's spec/reference/symbol-font-encodings.json and draw with the first loaded open face of the chain. Refresh with: node scripts/build-font-tracker.mjs --snapshot-symbol-fonts <opf-render>/src/symbol-fonts.js --commit <sha>.",
    source: { repository: "OpenPresentation/opf-render", commit, path: "src/symbol-fonts.js", capturedAt },
    script: symbolFonts.SYMBOL_SCRIPT,
    placeholder: symbolFonts.SYMBOL_PLACEHOLDER,
    previewFaces: Object.fromEntries(Object.entries(symbolFonts.SYMBOL_PREVIEW_FACES).map(([family, faces]) => [family, [...faces]])),
  };
}

/** The code-table route of a symbol-encoded family: no look-alike family, an ordered chain of open faces, one glyph per code. */
function codeTableRoute(family, symbols) {
  return { family: null, tier: "code-table", kind: "code-table", chain: symbols.previewFaces[family], decision: null, source: symbols.source.path, disabledFeatures: [] };
}

/** The bundled record of a code-table route: every chain face must be in the pinned manifest; faces and packages are listed per chain entry. */
function codeTableBundled(index, chain) {
  const entries = chain.map((name) => bundledRecord(index, name, "code-table"));
  const packages = [];
  for (const entry of entries) for (const pkg of entry.packages) if (!packages.some((item) => item.name === pkg.name)) packages.push(pkg);
  return {
    yes: entries.every((entry) => entry.yes),
    applies: "code-table",
    family: null,
    chain: entries.map((entry) => ({ family: entry.family, bundled: entry.yes, pack: entry.pack, stylesAvailable: entry.stylesAvailable, license: entry.packages[0]?.license ?? null })),
    pack: "scripts",
    packages,
    faces: entries.flatMap((entry) => entry.faces),
    stylesAvailable: sortStyles(entries.flatMap((entry) => entry.stylesAvailable)),
  };
}

/** The code counts of core's symbol-font encoding table (spec/reference/symbol-font-encodings.json), per family. */
function loadSymbolEncodings(root, file) {
  const encodings = readJson(root, file);
  return new Map(encodings.families.map((entry) => [entry.family, { codes: entry.summary.codes, mapped: entry.summary.mapped, unmapped: entry.summary.unmapped, verifiedAgainst: `${entry.verifiedAgainst.file} ${entry.verifiedAgainst.version}` }]));
}

// ---- native PowerPoint evidence ---------------------------------------------------------------

const NATIVE_BASIS =
  "Native name read-back: supervisor-run PowerPoint 365 read the family's selected name from every run (latin, East Asian, complex script) and from the theme slots of a saved deck that names it, and the names matched the export. It does not accept the preview face's look or metrics against the real font (image scores are reported, not gated).";

/**
 * Per-family native verification from the committed comparison output of supervisor-run PowerPoint checks (RR-05 compare.json). A deck passes when
 * every shape's per-run font names match (fonts), the theme slots match (themeSlots) and Presentation.Fonts lists only the chosen families
 * (presentationFonts). A family is evidenced by a deck that names it in a theme slot, or lists it in the deck's native Presentation.Fonts;
 * a family the deck only names in its export has no native read-back of its own. Families no run names stay unverified.
 * A family named by a deck that fails a gated check, with no passing deck that reads it back, is `failed`: the failing checks, deck and mismatch
 * kinds are recorded (`failures`) so the failure can be triaged into an item or an issue instead of hiding as "unverified".
 */
function loadNativeEvidence(root, runs) {
  const lc = (value) => String(value ?? "").trim().toLowerCase();
  const families = new Map();
  const summary = [];
  for (const run of runs) {
    const report = readJson(root, run.file);
    const entry = { id: run.id, label: run.label, file: run.file, readme: run.readme, date: run.date, host: run.host, decks: report.decks.length, decksPassing: 0, failingChecks: [] };
    for (const deck of report.decks) {
      const checks = deck.checks ?? {};
      const fontsOk = Boolean(deck.opened) && !deck.truncated && checks.fonts?.shapes > 0 && checks.fonts.ok === checks.fonts.shapes && checks.shapesMissing === 0;
      const themeOk = checks.themeSlots?.ok === true;
      const listOk = checks.presentationFonts?.ok === true;
      const pass = fontsOk && themeOk && listOk;
      if (pass) entry.decksPassing += 1;
      else entry.failingChecks.push({ deck: deck.id, failing: [!fontsOk && "fonts", !themeOk && "themeSlots", !listOk && "presentationFonts"].filter(Boolean), detail: (deck.mismatches ?? []).map((item) => item.kind).filter((kind, at, all) => all.indexOf(kind) === at) });
      const via = new Map();
      const note = (name, how) => {
        if (!lc(name)) return;
        via.set(lc(name), { family: String(name).trim(), via: [...(via.get(lc(name))?.via ?? []), how] });
      };
      for (const slot of checks.themeSlots?.slots ?? []) if (slot.ok && lc(slot.expected) && lc(slot.expected) === lc(slot.native)) note(slot.expected, `theme ${slot.slot}`);
      const nativeList = new Set((checks.presentationFonts?.native ?? []).map(lc));
      for (const name of checks.presentationFonts?.expected ?? []) if (nativeList.has(lc(name))) note(name, "Presentation.Fonts");
      for (const name of checks.presentationFonts?.expected ?? []) if (!via.has(lc(name))) via.set(lc(name), { family: String(name).trim(), via: [] });
      for (const [key, item] of via) {
        const record = families.get(key) ?? { family: item.family, decks: [] };
        const failing = [!fontsOk && "fonts", !themeOk && "themeSlots", !listOk && "presentationFonts"].filter(Boolean);
        const detail = (deck.mismatches ?? []).map((entry) => entry.kind).filter((kind, at, all) => all.indexOf(kind) === at);
        record.decks.push({ run: run.id, deck: deck.id, pass, fontsOk, themeOk, listOk, failing, detail, shapes: `${checks.fonts?.ok ?? 0}/${checks.fonts?.shapes ?? 0}`, via: item.via });
        families.set(key, record);
      }
    }
    summary.push(entry);
  }
  const byFamily = new Map();
  for (const [key, record] of families) {
    const named = record.decks.filter((deck) => deck.via.length > 0);
    const passing = named.filter((deck) => deck.pass);
    const failing = record.decks.filter((deck) => !deck.pass);
    if (passing.length) byFamily.set(key, { status: "verified", decks: passing, others: record.decks.filter((deck) => !passing.includes(deck)) });
    // A deck that reads the family back and fails a gated check, or a family whose only decks fail: failed (not hidden as partial or unverified).
    else if (failing.some((deck) => deck.via.length > 0) || !record.decks.some((deck) => deck.pass)) byFamily.set(key, { status: "failed", decks: failing, others: record.decks.filter((deck) => deck.pass), failures: failing });
    else if (record.decks.some((deck) => deck.pass)) byFamily.set(key, { status: "partial", decks: record.decks.filter((deck) => deck.pass), others: [], reason: "named in the export and every run matched, but no theme slot or Presentation.Fonts entry reads it back on its own" });
  }
  return { byFamily, runs: summary };
}

/**
 * FF-46 / RR-17 (opf#323 section 3): the per-family outcome of the native visual comparison (compare.json `families`, written by the
 * scratch comparison tool from the supervisor's native read and the in-place measurements). Only the run's own outcome is read: `pass`
 * when the tool found no reason to hold the family, `unmeasured` when the real font was not installed on the native host (PowerPoint drew
 * a substitute, so the real face was not compared), else `finding` with the reasons. Nothing is reinterpreted here.
 */
function loadVisualEvidence(root, rules) {
  for (const key of ["id", "label", "file", "readme", "date", "fixture"]) if (!rules[key]) throw new Error(`overrides.visualAcceptance needs ${key}`);
  if (!Array.isArray(rules.hosts) || !rules.hosts.length || !Array.isArray(rules.statuses) || !rules.statuses.length) throw new Error("overrides.visualAcceptance needs hosts and statuses");
  const report = readJson(root, rules.file);
  const byFamily = new Map();
  for (const entry of report.families ?? []) {
    const outcome = entry.proposal === "documented-visual candidate" && !(entry.reasons ?? []).length ? "pass" : entry.installedOnNativeHost === false ? "unmeasured" : "finding";
    byFamily.set(entry.family, {
      run: rules.id,
      file: rules.file,
      readme: rules.readme,
      date: rules.date,
      outcome,
      installedOnNativeHost: entry.installedOnNativeHost ?? null,
      inkWidthRatio: entry.ink?.longMedianRatio ?? null,
      lineBoxes: entry.lines?.boxes ?? 0,
      singleLineBoxes: entry.lines?.singleLine ?? 0,
      fontOverflowBoxes: entry.lines?.fontOverflow ?? 0,
      compositionOverflowBoxes: entry.compositionOverflow?.boxes ?? 0,
      previewSizeAdjust: entry.previewSizeAdjust?.factor ?? null,
      images: entry.images ?? null,
      reasons: entry.reasons ?? [],
      notes: entry.notes ?? [],
    });
  }
  return byFamily;
}

// ---- script corpus (FF-44) --------------------------------------------------------------------

/**
 * The committed script-corpus evidence (qualification of every bundled script face, and the installed originals measured in place) as
 * per-family lookups. Both reports are written by opf-render's scripts/script-corpora.mjs and scripts/measure-script-references.mjs.
 */
function loadScriptCorpus(root, spec) {
  const qualification = readJson(root, spec.qualification);
  const references = readJson(root, spec.references);
  const corpus = readJson(root, spec.corpus);
  const faces = new Map();
  for (const face of qualification.faces) {
    if (face.italic) continue;
    const entry = faces.get(face.family) ?? { family: face.family, weights: [], scripts: [], samples: 0, equal: 0, limited: 0, regular: null };
    entry.weights.push(face.weight);
    if (face.weight === 400) entry.regular = face;
    for (const group of face.groups) {
      if (!entry.scripts.includes(group.script)) entry.scripts.push(group.script);
      for (const sample of group.samples) {
        entry.samples += 1;
        if (Math.abs(sample.widthDelta) <= 0.011) entry.equal += 1;
        else entry.limited += 1;
      }
    }
    faces.set(face.family, entry);
  }
  const originals = new Map();
  for (const entry of references.families) originals.set(entry.family, [...(originals.get(entry.family) ?? []), entry]);
  return { id: corpus.id, spec, faces, originals, notInstalled: new Set(references.notInstalled), measuredAt: references.measuredAt, samples: corpus.groups.reduce((sum, group) => sum + group.samples.length, 0), scripts: corpus.groups.length };
}

/** The record's corpus qualification: the face(s) it previews with, and (for a proprietary family) its installed original. */
function scriptCorpusRecord(corpus, family, route, row) {
  const names = [route.family, ...(row.alternates ?? [])].filter(Boolean);
  const qualified = names.map((name) => corpus.faces.get(name)).filter(Boolean);
  if (!qualified.length) return null;
  const first = qualified[0];
  const coverage = first.regular.coverage;
  const own = coverage.scripts.length ? Math.min(...coverage.scripts.map((item) => item.bmpCovered / item.bmpAssigned)) : null;
  const charset = coverage.charsets.find((item) => item.charset === OWN_CHARSETS[first.scripts[0]]);
  const original = corpus.originals.get(family)?.flatMap((entry) =>
    entry.styles.filter((style) => style.samples > 0).map((style) => ({
      script: entry.script, weight: style.weight, file: style.file, version: style.version, samples: style.samples,
      meanWidthDelta: style.meanSignedDelta, maxAbsWidthDelta: style.maxAbsDelta,
      lineHeightEm: { original: lineHeight(style.lineMetrics), replacement: lineHeight(style.replacementLineMetrics) },
    })),
  );
  return {
    corpus: corpus.id,
    face: first.family,
    weights: first.weights.sort((a, b) => a - b),
    scripts: first.scripts,
    faceSamples: first.samples,
    equalToHarfBuzz: first.equal,
    recordedFontkitLimits: first.limited,
    ownScriptBmpCoverage: own === null ? null : round(own, 3),
    ...(charset ? { nationalCharset: { charset: charset.charset, covered: charset.covered, size: charset.size } } : {}),
    lineHeightEm: lineHeight(first.regular.lineMetrics),
    original: original?.length ? original : corpus.notInstalled.has(family) ? "not installed on the measuring host" : null,
  };
}
const OWN_CHARSETS = { Jpan: "JIS X 0208", Hans: "GB 2312", Hant: "Big5 levels 1 and 2", Kore: "KS X 1001" };
const lineHeight = (metrics) => (metrics ? round(metrics.hhea.ascent - metrics.hhea.descent + metrics.hhea.lineGap, 2) : null);

// ---- policy routes ----------------------------------------------------------------------------

function routeOf(row, decisions) {
  const replacement = row.replacement;
  if (!replacement) {
    return row.licenseClass === "open"
      ? { family: row.family, tier: "real", kind: "self", decision: null, source: null, disabledFeatures: [] }
      : { family: null, tier: "none", kind: "none", decision: null, source: null, disabledFeatures: [] };
  }
  const decided = replacement.decision ? decisions[replacement.decision] : null;
  return {
    family: decided ? decided.replacement : replacement.family,
    tier: decided ? decided.compatibility : replacement.compatibility,
    kind: row.licenseClass === "open" ? "alias" : "replacement",
    decision: replacement.decision ?? null,
    source: replacement.source ?? null,
    disabledFeatures: replacement.disabledFeatures ?? [],
  };
}

// ---- parity -----------------------------------------------------------------------------------

function parityUsage(parity) {
  const usage = new Map();
  for (const result of parity.results) {
    for (const [family, value] of Object.entries(result.fontResolution ?? {})) {
      const entry = usage.get(family) ?? { values: 0, verdicts: { pass: 0, near: 0, fail: 0 }, statuses: {}, resolved: new Set(), pptxNamed: 0, byDimension: {} };
      entry.values += 1;
      if (value.verdict in entry.verdicts) entry.verdicts[value.verdict] += 1;
      entry.statuses[value.status] = (entry.statuses[value.status] ?? 0) + 1;
      if (value.resolved) entry.resolved.add(value.resolved);
      if (value.pptx?.named === true) entry.pptxNamed += 1;
      entry.byDimension[result.dimension] = (entry.byDimension[result.dimension] ?? 0) + 1;
      usage.set(family, entry);
    }
  }
  return usage;
}

/**
 * The per-family fixture evidence of every host as one lookup: the Latin families', the open script, emoji and math families' and (FF-46)
 * the proprietary script, emoji, math and code-table names'. A family in two files is an error (each family has one fixture model). Only
 * a family a host's fixture passed for appears under that host.
 */
export function mergeHostEvidence(latin, script, scriptName) {
  const hosts = {};
  const owner = new Map();
  for (const [label, evidence] of [["Latin", latin], ["script", script], ["script name", scriptName]]) {
    for (const [host, entry] of Object.entries(evidence?.hosts ?? {})) {
      hosts[host] ??= { families: {} };
      for (const [family, value] of Object.entries(entry.families)) {
        const key = `${host}|${family}`;
        if (owner.has(key)) throw new Error(`${family} is in both the ${owner.get(key)} and the ${label} host fixture evidence (${host})`);
        owner.set(key, label);
        hosts[host].families[family] = value;
      }
    }
  }
  return { hosts };
}

// Mirror of the host verification defaults, so priority can be computed before the record is assembled.
function hostVerificationOf(family, host, target, cards, overrides, hostEvidence) {
  // RR-17: per-family fixtures in a host (the evidence file assembled from the host tests) decide verified; the authored map covers the rest.
  if (hostEvidence?.hosts?.[host]?.families?.[family]) return "verified";
  const set = overrides.hostVerification[family]?.[host];
  if (set) return set;
  if (host === "galleryCards") return cardVerification(family, cards);
  return target.yes || overrides.pendingBundle[family] ? "unverified" : "NA";
}

/**
 * Gallery cards: a family's card face is verified when pptx.gallery's tests/preview-fonts.test.ts covers it. That test resolves every font
 * scheme's stack to a bundled, hash-pinned, licensed self-hosted face (the face's `usedAs` lists the selected families), checks the weight
 * and the glyph coverage of the scheme text, and records the gaps. A face with a recorded coverage gap stays unverified.
 */
function cardVerification(family, cards) {
  if (!cards) return "NA";
  return cards.usedAs.includes(family) && !cards.coverageGaps ? "verified" : "unverified";
}

function expectedStatus(route, targetBundled) {
  if (route.kind === "code-table") return targetBundled ? "code-table" : "missing";
  if (route.tier === "none") return "missing";
  if (route.kind === "self") return targetBundled ? "real" : "missing";
  return route.tier === "metric" && targetBundled ? "metric-substitute" : "visual-substitute";
}

// ---- build ------------------------------------------------------------------------------------

/** The appearance note: the authored description of both faces and its caveat; the measured figures are the record's `qualification`. */
function appearanceOf(note) {
  if (!note) return null;
  return { description: `${note.original} ${note.replacement}`, ...(note.caveat ? { caveat: note.caveat } : {}) };
}

/** An accepted Latin family's next action is the native verification that remains; its authored action stays for every other family. */
/** The sample ids the script fixture drew for a family (the same list in every host that recorded it). */
function scriptSampleList(evidence, family) {
  const found = Object.values(evidence.hosts).map((entry) => entry.families?.[family]?.samples).find((list) => list?.length);
  return (found ?? []).join(", ");
}

function derivedNextAction(acceptance, status, authored, rules) {
  if (!acceptance.accepted || !rules.nextActions[status]) return authored;
  return rules.nextActions[status];
}

function resolveEvidence(keys, dictionary) {
  const out = [];
  const seen = new Set();
  for (const key of keys) {
    const items = typeof key === "string" ? [].concat(dictionary[key] ?? (() => { throw new Error(`unknown evidence key ${key}`); })()) : [key];
    for (const item of items) {
      if (seen.has(item.url)) continue;
      seen.add(item.url);
      out.push({ label: item.label, url: item.url });
    }
  }
  return out;
}

/** The record's native verification: derived from the committed native comparison output where a run names the family, else the authored status. */
function nativeRecordOf(evidence, runs, family, authored) {
  const derived = evidence.byFamily.get(family.toLowerCase());
  if (!derived) return authored ? { status: authored.status, note: authored.note } : { status: "unverified", note: "No native PowerPoint check recorded for this family in docs/evidence." };
  const byRun = new Map();
  for (const deck of derived.decks) byRun.set(deck.run, [...(byRun.get(deck.run) ?? []), deck]);
  const runRecords = [...byRun].map(([id, decks]) => {
    const run = runs.find((item) => item.id === id);
    return { run: id, label: run.label, readme: run.readme, file: run.file, date: run.date, decks: decks.map((deck) => ({ deck: deck.deck, shapesFontsOk: deck.shapes, via: deck.via })) };
  });
  const deckList = derived.decks.map((deck) => `${deck.deck} (${deck.shapes} shapes; ${[...new Set(deck.via)].join(", ") || "export names only"})`);
  const listed = deckList.length > 4 ? `${deckList.slice(0, 4).join("; ")}; and ${deckList.length - 4} more` : deckList.join("; ");
  const failing = derived.status === "failed" ? [] : derived.others.filter((deck) => !deck.pass);
  const failedNote = failing.length
    ? `Decks that name it but fail a check: ${failing.map((deck) => `${deck.deck} (${[!deck.fontsOk && "fonts", !deck.themeOk && "themeSlots", !deck.listOk && "presentationFonts"].filter(Boolean).join(", ")})`).join(", ")}.`
    : "";
  const caveat = [authored?.caveat, failedNote].filter(Boolean).join(" ");
  if (derived.status === "failed") {
    const failures = derived.failures.map((deck) => ({ run: deck.run, deck: deck.deck, failing: deck.failing, mismatchKinds: deck.detail, shapesFontsOk: deck.shapes, via: deck.via }));
    return {
      status: "failed",
      basis: NATIVE_BASIS,
      note: `FAILED in ${[...new Set(failures.map((item) => item.run))].join(", ")}: ${failures.map((item) => `${item.deck} (${item.failing.join(", ")}${item.mismatchKinds.length ? `; ${item.mismatchKinds.join(", ")}` : ""}; ${item.shapesFontsOk} shapes)`).join("; ")}. Triage into an item or an issue.`,
      ...(caveat ? { caveat } : {}),
      failures,
      runs: runRecords,
    };
  }
  return {
    status: derived.status,
    basis: NATIVE_BASIS,
    note: `${derived.status === "verified" ? "Passed" : "Partial"} in ${runRecords.map((run) => run.run).join(", ")}: ${listed}.${derived.reason ? ` ${derived.reason}.` : ""}`,
    ...(caveat ? { caveat } : {}),
    runs: runRecords,
    reason: derived.reason,
  };
}

/**
 * The owner's four questions, answered from the records (never typed): how many fonts, how many are licensed for direct use (open), how many
 * need a replacement (proprietary), how many have a bundled replacement, and what licence the bundled faces carry. A replacement is found when
 * its route face (or, for a code-table route, every face of its chain) is in the pinned opf-render manifest.
 */
export function licensingSummary(records, snapshot) {
  const open = records.filter((rec) => rec.class === "open");
  const needs = records.filter((rec) => rec.class !== "open");
  const found = needs.filter((rec) => rec.bundled.yes && (rec.previewRoute.family || rec.previewRoute.kind === "code-table"));
  const noRoute = needs.filter((rec) => !found.includes(rec));
  const countBy = (list, key) => Object.fromEntries([...new Set(list.map(key))].sort().map((value) => [value, list.filter((item) => key(item) === value).length]));
  const faceLicenses = (rec) => (rec.previewRoute.kind === "code-table" ? rec.bundled.chain.map((face) => face.license) : rec.bundled.packages.slice(0, 1).map((pkg) => pkg.license));
  const distinct = new Map();
  for (const rec of found) {
    const names = rec.previewRoute.kind === "code-table" ? rec.previewRoute.chain : [rec.previewRoute.family];
    const licenses = faceLicenses(rec);
    for (const [at, name] of names.entries()) distinct.set(name, licenses[at]);
  }
  const manifestPackages = snapshot.packages;
  const self = open.filter((rec) => rec.previewRoute.kind === "self" && rec.bundled.yes);
  const alias = open.filter((rec) => rec.previewRoute.kind === "alias" && rec.bundled.yes);
  return {
    totalFamilies: records.length,
    openDirectlyUsable: {
      total: open.length,
      drawnAsItself: self.length,
      openAlias: alias.length,
      notBundled: open.length - self.length - alias.length,
      aliases: alias.map((rec) => rec.family).sort(),
      byLicense: countBy(open, (rec) => rec.license),
    },
    needsReplacement: { total: needs.length, byClass: countBy(needs, (rec) => rec.class) },
    replacementFound: {
      total: found.length,
      metricCompatible: found.filter((rec) => rec.class === "proprietary-latin" && rec.previewRoute.tier === "metric").length,
      visualLookAlike: found.filter((rec) => rec.class === "proprietary-latin" && rec.previewRoute.tier === "visual").length,
      scriptFace: found.filter((rec) => rec.class === "proprietary-script").length,
      specialPath: found.filter((rec) => rec.class === "special").length,
      specialPathKinds: countBy(found.filter((rec) => rec.class === "special"), (rec) => rec.previewRoute.kind),
    },
    noRoute: { total: noRoute.length, families: noRoute.map((rec) => rec.family).sort() },
    bundledFaceLicenses: {
      replacementRecordsByLicense: countBy(found, (rec) => [...new Set(faceLicenses(rec))].sort().join(" + ")),
      replacementFacesByLicense: countBy([...distinct], ([, license]) => license),
      replacementFaces: distinct.size,
      manifestPackagesByLicense: countBy(manifestPackages, (pkg) => pkg.license),
      manifestFacesByLicense: Object.fromEntries(Object.entries(countBy(manifestPackages.flatMap((pkg) => pkg.faces.map(() => pkg)), (pkg) => pkg.license))),
      manifestPackages: manifestPackages.length,
      manifestFaces: manifestPackages.reduce((sum, pkg) => sum + pkg.faces.length, 0),
    },
  };
}

export function buildTracker({ root = ROOT } = {}) {
  const policy = readJson(root, FILES.policy);
  const overrides = readJson(root, FILES.overrides);
  const snapshot = readJson(root, overrides.manifestSnapshot);
  const report = readJson(root, overrides.measurementReport);
  const galleryFonts = readJson(root, overrides.galleryFontsSnapshot);
  const galleryCardsByFamily = new Map(galleryFonts.families.map((entry) => [entry.family, entry]));
  const parity = readJson(root, overrides.paritySource);
  const qualReport = readJson(root, overrides.qualificationReport);
  const qualByFamily = new Map(qualReport.results.map((row) => [row.family, row]));
  const hostEvidence = readJson(root, overrides.hostFixtureEvidence);
  // RR-17 (FF-44, FF-45): the script, emoji and math families have their own per-host fixture evidence; the Latin evidence is untouched.
  const scriptEvidence = overrides.scriptHostFixtureEvidence ? readJson(root, overrides.scriptHostFixtureEvidence) : null;
  const scriptRules = overrides.scriptAcceptance ?? null;
  if (scriptEvidence && !scriptRules) throw new Error("overrides.scriptHostFixtureEvidence needs overrides.scriptAcceptance");
  // FF-46 (opf#362): the proprietary script, emoji, math and code-table names have their own per-host fixtures, keyed by the name (the
  // script evidence is keyed by the open route face and does not transfer).
  const scriptNameEvidence = overrides.scriptNameHostFixtureEvidence ? readJson(root, overrides.scriptNameHostFixtureEvidence) : null;
  const hostFixtureView = mergeHostEvidence(hostEvidence, scriptEvidence, scriptNameEvidence);
  const symbolSnapshot = readJson(root, overrides.symbolFontsSnapshot);
  const symbolEncodings = loadSymbolEncodings(root, overrides.symbolEncodings);
  const nativeEvidence = loadNativeEvidence(root, overrides.nativeEvidence);
  // FF-46 / RR-17: the native visual comparison of the script, visual and code-table families (opf#323 section 3). A family whose run
  // outcome passes still needs its own fixture in every host before it is documented-visual; a finding keeps its status.
  const visualRules = overrides.visualAcceptance ?? null;
  const visualByFamily = visualRules ? loadVisualEvidence(root, visualRules) : new Map();
  const acceptRules = overrides.latinAcceptance;
  const decisions = policy.provisionalDecisions?.decisions ?? {};
  const corpus = overrides.scriptCorpus ? loadScriptCorpus(root, overrides.scriptCorpus) : null;
  const index = bundleIndex(snapshot);
  const usage = parityUsage(parity);
  const policyNames = new Set(policy.families.map((row) => row.family));
  const reportByFamily = new Map(report.results.map((row) => [row.family, row]));

  for (const list of [overrides.classes.proprietaryScript, overrides.classes.special]) {
    for (const name of list) if (!policyNames.has(name)) throw new Error(`overrides.classes names ${name}, which is not a policy family`);
  }
  for (const name of Object.keys(overrides.pendingBundle)) if (!policyNames.has(name)) throw new Error(`overrides.pendingBundle names ${name}, which is not a policy family`);
  for (const name of Object.keys(overrides.acceptance)) if (!policyNames.has(name) && !overrides.extras.some((extra) => extra.family === name)) throw new Error(`overrides.acceptance names ${name}, which has no record`);
  for (const name of Object.keys(overrides.families)) if (!policyNames.has(name)) throw new Error(`overrides.families names ${name}, which is not a policy family`);
  for (const name of visualByFamily.keys()) if (!policyNames.has(name)) throw new Error(`the native visual comparison names ${name}, which is not a policy family`);
  for (const extra of overrides.extras) {
    if (policyNames.has(extra.family)) throw new Error(`${extra.family} is in the policy; remove it from overrides.extras`);
    if (!index.has(extra.family)) throw new Error(`${extra.family} is not in the pinned render manifest snapshot`);
  }
  const scriptClass = new Set(overrides.classes.proprietaryScript);
  const specialClass = new Set(overrides.classes.special);

  const classOf = (row) => (specialClass.has(row.family) ? "special" : scriptClass.has(row.family) ? "proprietary-script" : row.licenseClass === "open" ? "open" : "proprietary-latin");

  // First pass: everything derived from one policy row.
  // FF-45: a special family that opf-render previews through a code table has that route (a chain of open faces), not a look-alike family.
  const rows = policy.families.map((row) => {
    const cls = classOf(row);
    const codeTable = cls === "special" && symbolSnapshot.previewFaces[row.family];
    return { row, cls, inPolicy: true, route: codeTable ? codeTableRoute(row.family, symbolSnapshot) : routeOf(row, decisions) };
  });
  for (const extra of overrides.extras) {
    rows.push({
      row: { family: extra.family, licenseClass: "open", license: "OFL-1.1", availability: [], embeddableByOpf: true, replacement: null, alternates: [] },
      cls: "open",
      inPolicy: false,
      route: { family: extra.family, tier: "real", kind: "self", decision: null, source: null, disabledFeatures: [] },
      extra,
    });
  }

  const records = rows.map((item) => {
    const { row, cls, inPolicy, route } = item;
    const family = row.family;
    const applies = route.kind === "code-table" ? "code-table" : route.kind === "self" ? "self" : route.family ? "route-target" : "none";
    const bundled = route.kind === "code-table" ? codeTableBundled(index, route.chain) : bundledRecord(index, route.family, applies);

    // Measurements: the policy aggregate plus per-style detail from the report while both still describe the routed face.
    const measured = row.replacement?.measured ?? null;
    const reported = reportByFamily.get(family);
    const reportMatches = reported && measured && reported.replacement === measured.replacement && measured.replacement === route.family;
    const perStyle = reportMatches && reported.detail
      ? reported.detail.map((entry) => ({
          style: styleKey(entry.weight, entry.italic),
          replacementStyle: styleKey(entry.replacementWeight, entry.italic),
          strings: entry.strings,
          meanAbsWidthDelta: entry.meanAbs,
          meanWidthDelta: entry.mean,
          maxAbsWidthDelta: entry.maxAbs,
        }))
      : null;
    for (const name of Object.keys(overrides.measurementSources)) if (!policyNames.has(name)) throw new Error(`overrides.measurementSources names ${name}, which is not a policy family`);
    const bar = overrides.metricBar;
    const widthBarMet = measured
      ? (perStyle ? perStyle.length : measured.styles) >= bar.styles &&
        (perStyle ?? [measured]).every((entry) => entry.meanAbsWidthDelta < bar.meanBelow && entry.maxAbsWidthDelta <= bar.maxAtMost)
      : false;
    const measurements = measured
      ? {
          replacement: measured.replacement,
          reference: measured.reference,
          meanAbsWidthDelta: measured.meanAbsWidthDelta,
          meanWidthDelta: measured.meanWidthDelta,
          maxAbsWidthDelta: measured.maxAbsWidthDelta,
          stylesMeasured: measured.styles,
          perStyle,
          corpus: { strings: report.corpus.strings, sha256: report.corpus.sha256, script: "Latin", scriptSpecific: false },
          date: overrides.measurementDates[family] ?? overrides.measurementDates.default,
          source: overrides.measurementSources[family]?.source ?? "docs/evidence/font-replacements-20260923/README.md",
          sourceNote: overrides.measurementSources[family]?.note ?? null,
          verticalMetricsMatch: qualByFamily.get(family)?.summary?.verticalMetricsEqual ?? overrides.measurementDetails[family]?.verticalMetricsMatch ?? null,
          verticalMetricsNote: overrides.measurementDetails[family]?.note ?? null,
          lineBreaksMatch: qualByFamily.get(family)?.summary ? qualByFamily.get(family).summary.lineBreaksIdenticalFraction >= acceptRules.lineBreakFloor : null,
          widthBarMet,
        }
      : null;

    // Styles.
    const fixed = overrides.stylesRequired[family];
    const scripts = item.extra?.scripts ?? overrides.scripts[family] ?? ["Latin"];
    let stylesRequired;
    let replacementStylesRequired = null;
    let stylesBasis;
    if (cls === "special") {
      stylesRequired = [];
      stylesBasis = route.kind === "code-table" ? "not applicable: code table (one glyph per code; a bold or italic request draws the same glyph)" : "not applicable: dedicated path";
    } else if (cls !== "open" && fixed?.styles) {
      // A proprietary family whose declared style list is the real font's own (checked on the measuring host): an original that ships one face has no
      // bold or italic to match, so the rule never demands the four styles of a Latin family from it or from the face that replaces it.
      if (perStyle && sortStyles(perStyle.map((entry) => entry.style)).join() !== sortStyles(fixed.styles).join()) throw new Error(`overrides.stylesRequired for ${family} disagrees with the measured styles of the real font`);
      stylesRequired = fixed.styles;
      replacementStylesRequired = sortStyles(fixed.styles);
      stylesBasis = `declared: ${fixed.reason}`;
    } else if (cls === "open") {
      stylesRequired = fixed ? fixed.styles : scripts.includes("Latin") ? FOUR : TWO;
      stylesBasis = fixed ? `declared: ${fixed.reason}` : "assumed: four styles for Latin faces, regular and bold for script faces";
    } else if (perStyle) {
      stylesRequired = sortStyles(perStyle.map((entry) => entry.style));
      replacementStylesRequired = sortStyles(perStyle.map((entry) => entry.replacementStyle));
      stylesBasis = "measured: styles the real font has on the measuring host";
    } else {
      stylesRequired = cls === "proprietary-script" ? TWO : FOUR;
      stylesBasis = "assumed: real font not measured; four styles for Latin, regular and bold for script families";
    }
    if (cls !== "open" && replacementStylesRequired === null) replacementStylesRequired = cls === "special" ? [] : stylesRequired;
    const approximateStyles = perStyle ? perStyle.filter((entry) => entry.style !== entry.replacementStyle).map((entry) => entry.style) : [];
    return {
      item,
      family,
      cls,
      inPolicy,
      route,
      bundled,
      measurements,
      scripts,
      stylesRequired: sortStyles(stylesRequired),
      replacementStylesRequired,
      approximateStyles,
      stylesBasis,
      explicitGaps: fixed?.explicitGaps ?? [],
      perStyle,
    };
  });

  // Role requirements: an open replacement face must carry the styles of every family routed to it.
  const roles = new Map();
  for (const rec of records) {
    if (rec.cls === "special" || !rec.route.family || rec.route.kind === "self") continue;
    const entry = roles.get(rec.route.family) ?? {};
    for (const style of rec.replacementStylesRequired ?? rec.stylesRequired) entry[style] = [...(entry[style] ?? []), rec.family];
    roles.set(rec.route.family, entry);
  }

  const paritySource = path.basename(overrides.paritySource);
  const hostModel = overrides.hostLoading;
  const out = records.map((rec) => {
    const { item, family, cls, inPolicy, route, bundled } = rec;
    const row = item.row;
    const pending0 = overrides.pendingBundle[family] ?? null;
    const target = pending0 ? { ...bundled, pending: pending0 } : bundled;
    const roleEntry = cls === "open" ? roles.get(family) ?? {} : {};
    const requiredWithRoles = cls === "open" ? sortStyles([...rec.stylesRequired, ...Object.keys(roleEntry)]) : rec.stylesRequired;
    const availableStyles = target.stylesAvailable;
    const mustHave = cls === "open" ? requiredWithRoles : rec.replacementStylesRequired ?? [];
    const stylesMissing = route.family && cls !== "special" ? mustHave.filter((style) => !availableStyles.includes(style)) : [];

    const corpusRecord = corpus ? scriptCorpusRecord(corpus, family, route, row) : null;

    // Status.
    const lazyPending = target.yes && hostModel.lazyPendingPacks.includes(target.pack);
    const pending = overrides.pendingBundle[family] ?? null;
    if (pending && target.yes) throw new Error(`overrides.pendingBundle for ${family} is stale: ${route.family} is now bundled in the pinned manifest snapshot`);
    let status;
    let statusReason;
    const codeTable = route.kind === "code-table" ? symbolEncodings.get(family) : null;
    if (cls === "special" && route.kind === "code-table" && target.yes) {
      status = "code-table";
      statusReason = `code-table preview (FF-45): ${codeTable ? `${codeTable.mapped} of ${codeTable.codes} codes map to Unicode (${codeTable.verifiedAgainst}); ` : ""}each code draws with the first loaded of ${route.chain.join(", ")} at the verified font's advance; verified in opf-render's node, browser and raster tests; ${nativeEvidence.byFamily.get(family.toLowerCase())?.status === "verified" ? "the native PowerPoint name read-back passed (see nativeVerification; the comparison does not check glyph shapes)" : "no native PowerPoint check is recorded"}`;
    } else if (cls === "special") {
      status = "needs-special-path";
      statusReason = route.kind === "code-table" ? `code-table route faces (${route.chain.filter((name) => !index.has(name)).join(", ")}) are not in the pinned opf-render manifest` : "no look-alike route in the policy; dedicated path required";
    } else if (!inPolicy) {
      status = "policy-gap";
      statusReason = "face ships in the renderer but has no policy row";
    } else if (pending && route.tier === "metric" && rec.measurements?.widthBarMet && cls !== "open") {
      status = "metric-measured";
      statusReason = `metric route ${route.family} (width bar met in four styles); its faces are not in the pinned opf-render manifest until ${pending.prs.join(" and ")} land`;
    } else if (!target.yes) {
      status = "loading-gap";
      statusReason = pending ? `${route.family} is not in the pinned opf-render manifest until ${pending.prs.join(" and ")} land` : `route face ${route.family} is not bundled by opf-render`;
    } else if (stylesMissing.length) {
      status = "style-gap";
      statusReason = `missing ${stylesMissing.join(", ")} in ${route.family}`;
    } else if (lazyPending) {
      status = "loading-gap";
      statusReason = `${route.family} is in the ${target.pack} pack, which the shipped browser, editor and gallery-editor hosts do not load until opf-render#54 and opf-editor#42`;
    } else if (cls === "open") {
      status = "baseline-needed";
      statusReason = "bundled with required styles; fresh per-host verification outstanding";
    } else if (route.tier === "metric" && rec.measurements?.widthBarMet) {
      status = "metric-measured";
      statusReason = "metric tier; width bar met in four styles; line breaks not recorded; see hostVerification and the measurement details";
    } else if (cls === "proprietary-script") {
      status = "script-gap";
      statusReason = corpusRecord ? "visual script route: the script corpus (FF-44) qualifies coverage and shaping; native PowerPoint comparison and the recorded appearance gap remain" : "visual script route; native-script measurement and appearance outstanding";
    } else {
      status = "visual-gap";
      statusReason = "visual route; metric or appearance qualification outstanding";
    }

    const accepted = overrides.acceptance[family];
    if (accepted?.accepted && !(accepted.date && accepted.fixture && accepted.evidence?.length)) throw new Error(`acceptance for ${family} needs fixture, date and evidence`);
    let acceptance = accepted
      ? { fixture: accepted.fixture ?? "pending", accepted: accepted.accepted === true, date: accepted.date ?? null, evidence: resolveEvidence(accepted.evidence ?? [], overrides.evidence), note: accepted.note ?? "" }
      : { fixture: "pending", accepted: false, date: null, evidence: [], note: "Own fixture and acceptance record required; grouped work does not transfer acceptance." };

    // RR-17 (FF-41, FF-42, FF-43): the per-family acceptance for a Latin family is derived from two committed evidence files: the host
    // fixtures (every one of node, browser, editor and gallery editor drew the family's route faces at the face's own advances) and the
    // qualification report (widths per style, line breaks, vertical metrics, outlines, coverage against the real font). Nothing here is
    // hand edited, and native PowerPoint verification stays a separate, unverified field (FF-46).
    const qual = qualByFamily.get(family);
    const fixtureHosts = acceptRules.hosts.filter((host) => hostEvidence.hosts?.[host]?.families?.[family]);
    const latinOnly = rec.scripts.every((script) => script === "Latin");
    const qualification = qual
      ? { file: overrides.qualificationReport, date: qualReport.date, referenceAvailable: qual.referenceAvailable, ...(qual.referenceAvailable ? { stylesMeasured: qual.summary.stylesMeasured, meanAbsWidthDelta: qual.summary.meanAbsWidthDelta, maxAbsWidthDelta: qual.summary.maxAbsWidthDelta, widthBarMet: qual.summary.widthBarMet, lineBreaksIdenticalFraction: qual.summary.lineBreaksIdenticalFraction, verticalMetricsEqual: qual.summary.verticalMetricsEqual, xHeightRatio: qual.summary.xHeightRatio, capHeightRatio: qual.summary.capHeightRatio, ascentRatio: qual.summary.ascentRatio, identicalOutlinesBeyondPlainRectangles: qual.summary.identicalOutlinesBeyondPlainRectangles, latinCodepointsMissing: qual.summary.latinCodepointsMissing } : {}) }
      : null;
    // Script, emoji and math families (not Latin-only): the same rule over their own fixture evidence. An open family that routes to itself
    // is `real` once every host's fixture passed for it; a host whose fixture recorded a finding for it keeps it from the status.
    const scriptFixtureHosts = scriptRules ? scriptRules.hosts.filter((host) => scriptEvidence.hosts?.[host]?.families?.[family]) : [];
    const scriptFindingHosts = scriptRules ? scriptRules.hosts.filter((host) => scriptEvidence.hosts?.[host]?.findings?.[family]) : [];
    let derivedClass = null;
    let derivedBy = null;
    if (!accepted && scriptRules && !latinOnly && target.yes && route.family && cls === "open" && route.kind === "self" && scriptFixtureHosts.length === scriptRules.hosts.length) {
      derivedClass = "real";
      derivedBy = scriptRules;
    } else if (!accepted && target.yes && route.family && latinOnly && cls !== "special" && fixtureHosts.length === acceptRules.hosts.length) {
      derivedBy = acceptRules;
      if (cls === "open" && route.kind === "self") derivedClass = "real";
      else if (qual?.referenceAvailable && route.tier === "metric" && qual.summary.widthBarMet && qual.summary.lineBreaksIdenticalFraction >= acceptRules.lineBreakFloor) derivedClass = "metric";
      else if (qual?.referenceAvailable && route.tier === "visual") derivedClass = "visual";
    }
    if (derivedClass) {
      const q = qualification;
      const gaps = rec.explicitGaps.length ? ` Explicit style gaps (never synthesized): ${rec.explicitGaps.join(", ")}.` : "";
      const note = derivedClass === "real"
        ? derivedBy === scriptRules
          ? `The open family draws as itself in every host: in each, the family's package loads, every style resolves to the family, and samples of its script (${scriptSampleList(scriptEvidence, family)}) are drawn strictly in its own pinned file with no glyph fallback.${gaps}`
          : `The open family draws as itself in every host.${gaps}`
        : derivedClass === "metric"
          ? `Metric route: width mean ${pct(q.meanAbsWidthDelta)} and maximum ${pct(q.maxAbsWidthDelta)} in ${q.stylesMeasured} styles, ${pct(q.lineBreaksIdenticalFraction)} of ${acceptRules.lineBreakCases} wrap cases break at the same words (floor ${pct(acceptRules.lineBreakFloor)}); vertical metrics ${q.verticalMetricsEqual ? "equal" : "differ (recorded; the baseline is placed from the font size, not the font's ascent)"}; x-height ${ratio(q.xHeightRatio)}, cap-height ${ratio(q.capHeightRatio)} of the original.${gaps}`
          : `Documented look-alike (tier visual): width mean ${pct(q.meanAbsWidthDelta)} and maximum ${pct(q.maxAbsWidthDelta)} in ${q.stylesMeasured} measured styles, ${pct(q.lineBreaksIdenticalFraction)} of ${acceptRules.lineBreakCases} wrap cases break at the same words; vertical metrics ${q.verticalMetricsEqual ? "equal" : "differ"}; x-height ${ratio(q.xHeightRatio)}, cap-height ${ratio(q.capHeightRatio)} of the original; ${q.latinCodepointsMissing ?? "n/a"} Latin code points missing; ${q.identicalOutlinesBeyondPlainRectangles ?? "n/a"} identical outlines beyond plain rectangles. Reflow against the real font is expected.${gaps}`;
      acceptance = { fixture: derivedBy.fixture, accepted: true, date: derivedBy.date, evidence: resolveEvidence(derivedBy.evidence, overrides.evidence), note: `${note} Native PowerPoint verification is separate (FF-46).` };
    } else if (!accepted && scriptFindingHosts.length) {
      acceptance = { ...acceptance, note: `Not accepted: the fixture recorded a finding in ${scriptFindingHosts.join(", ")}, and the check stays as strict as for every other family. ${scriptFindingHosts.map((host) => `${host}: ${scriptEvidence.hosts[host].findings[family].reason}`).join(" ")}` };
    } else if (!accepted && scriptRules && !latinOnly && scriptFixtureHosts.length > 0 && scriptFixtureHosts.length < scriptRules.hosts.length) {
      acceptance = { ...acceptance, note: `Not accepted yet: the script fixture passes in ${scriptFixtureHosts.join(", ")} and is missing in ${scriptRules.hosts.filter((host) => !scriptFixtureHosts.includes(host)).join(", ")}.` };
    } else if (!accepted && acceptRules.reasons?.[family]) acceptance = { ...acceptance, note: acceptRules.reasons[family] };
    else if (!accepted && fixtureHosts.length > 0 && fixtureHosts.length < acceptRules.hosts.length) acceptance = { ...acceptance, note: `Not accepted yet: the fixture passes in ${fixtureHosts.join(", ")} and is missing in ${acceptRules.hosts.filter((host) => !fixtureHosts.includes(host)).join(", ")} (the host's pinned renderer or editor predates the family's route).` };
    else if (!accepted && qual && !qual.referenceAvailable && cls === "proprietary-latin") acceptance = { ...acceptance, note: "Not accepted: the real font is not available to measure (not installed on the measuring host); the fixture and qualification run when a reference is present." };
    if (derivedClass) {
      status = derivedClass === "visual" ? "documented-visual" : "qualified";
      statusReason = derivedClass === "visual" ? "documented visual look-alike: fixtures in every host, widths, line breaks and vertical metrics measured against the real font" : derivedClass === "metric" ? "metric route qualified: fixtures in every host, four-style widths and line breaks within the bar" : "open family: fixtures in every host";
    }

    // FF-46 / RR-17: a script, visual or code-table family with a native visual comparison. `documented-visual` needs both the run's
    // pass and the family's OWN fixture in every host (the host evidence keyed by the family's name, as for the Latin families); the
    // fixtures of its open route face do not transfer. A finding or a missing fixture keeps the status and says why.
    const visual = visualRules?.statuses.includes(status) ? visualByFamily.get(family) ?? null : null;
    let visualAccepted = false;
    let nativeVisual = null;
    if (visual) {
      const ownHosts = visualRules.hosts.filter((host) => hostFixtureView.hosts?.[host]?.families?.[family]);
      const missingHosts = visualRules.hosts.filter((host) => !ownHosts.includes(host));
      nativeVisual = { ...visual, ownFixtureHosts: ownHosts };
      const measured = `native / preview ink width ${visual.inkWidthRatio ?? "n/a"} on lines of at least 200 pt, ${visual.singleLineBoxes} of ${visual.lineBoxes} line boxes read one native line, ${visual.fontOverflowBoxes} overflow where the preview fits${visual.previewSizeAdjust ? `, preview size adjustment ${visual.previewSizeAdjust}` : ""}`;
      if (!accepted && visual.outcome === "pass" && !missingHosts.length && target.yes) {
        visualAccepted = true;
        acceptance = { fixture: visualRules.fixture, accepted: true, date: visualRules.date, evidence: resolveEvidence(visualRules.evidence ?? [], overrides.evidence), note: `Documented look-alike: the native visual comparison (${visual.run}) passed (${measured}); the family's own fixture passes in every host. Reflow against the real font is expected.` };
        statusReason = "documented visual look-alike: fixtures in every host and the native visual comparison (FF-46) against the real font";
        status = "documented-visual";
      } else if (!accepted && visual.outcome === "pass") {
        const nameFindings = missingHosts.filter((host) => scriptNameEvidence?.hosts?.[host]?.findings?.[family]).map((host) => `${host}: ${scriptNameEvidence.hosts[host].findings[family].reason}`);
        acceptance = { ...acceptance, note: `Not accepted yet: the native visual comparison (${visual.run}) passed (${measured}), but the family's own host fixture is missing in ${missingHosts.join(", ")} (the script host fixtures cover the open route face, which does not transfer).${nameFindings.length ? ` The name's own fixture recorded a finding, and the check stays strict: ${nameFindings.join(" ")}` : ""}` };
      } else if (!accepted && visual.outcome === "unmeasured") {
        acceptance = { ...acceptance, note: `Not accepted: the real font is not installed on the native host of ${visual.run}, so PowerPoint drew a substitute and the real face was not compared (${visual.reasons.join("; ")}). It needs a native host with the font installed.` };
      } else if (!accepted) {
        acceptance = { ...acceptance, note: `Not accepted: the native visual comparison (${visual.run}) recorded a finding: ${visual.reasons.join("; ")}. Owner decision needed; the gate is unchanged.` };
      }
    }

    const phaseByStatus = { "loading-gap": 2, "style-gap": 2, "policy-gap": 1, "needs-special-path": 4, "code-table": 4, "visual-gap": 4, "script-gap": 4, "baseline-needed": 1, "metric-measured": 1, "documented-visual": 5, "qualified": 5 };
    // An accepted Latin family has only native verification and the full parity rerun (owner phase 5) left.
    const phase = derivedClass || visualAccepted ? 5 : overrides.phaseOverrides[family]?.phase ?? phaseByStatus[status];

    // Parity.
    const used = usage.get(family);
    const observed = used ? Object.keys(used.statuses).sort() : [];
    const expected = expectedStatus(route, target.yes);
    const rerunNeeded = used ? observed.some((value) => value !== expected) : false;
    const paritySignals = {
      source: paritySource,
      totalValues: parity.results.length,
      valuesAffected: used?.values ?? 0,
      fontResolution: used?.verdicts ?? { pass: 0, near: 0, fail: 0 },
      statusAtRun: used?.statuses ?? {},
      resolvedAtRun: used ? [...used.resolved].sort() : [],
      pptxNamedValues: used?.pptxNamed ?? 0,
      byDimension: used?.byDimension ?? {},
      expectedStatusOnMain: expected,
      rerunNeeded,
    };

    // Priority.
    const cards = route.family ? galleryCardsByFamily.get(route.family) ?? null : null;
    const def = overrides.statusDefs[status];
    const drift = rec.measurements?.maxAbsWidthDelta ?? 0;
    const driftBonus = route.tier === "visual" && cls === "proprietary-latin" && drift > 0.05 ? 0.5 : 0;
    const severity = def.severity + driftBonus;
    // Only values that are not already real or pass count, and hosts with per-family verification discount the rest.
    const valuesOpen = paritySignals.valuesAffected - paritySignals.fontResolution.pass;
    const applicable = HOSTS.filter((host) => hostVerificationOf(family, host, target, cards, overrides, hostFixtureView) !== "NA");
    const verifiedHosts = applicable.filter((host) => hostVerificationOf(family, host, target, cards, overrides, hostFixtureView) === "verified").length;
    const hostFactor = applicable.length ? Math.max(0.25, (applicable.length - verifiedHosts) / applicable.length) : 1;
    const score = round(severity * (valuesOpen * hostFactor + 1), 1);

    // Hosts.
    // A vendored package can load differently from the rest of its pack (Intos is an office-pack package that browser hosts load lazily).
    const packKey = route.kind === "code-table" ? (target.yes ? "symbol" : null) : target.yes ? (hostModel.packageModels?.[target.packages[0].name] ?? target.pack) : null;
    const packModel = packKey ? hostModel.packs[packKey] : null;
    const verified = overrides.hostVerification[family];
    const hostVerification = {};
    const hostLoading = {};
    for (const host of HOSTS) {
      if (host === "galleryCards") {
        hostVerification[host] = verified?.[host] ?? cardVerification(family, cards);
        hostLoading[host] = cards
          ? `self-hosted preview webfont: ${cards.package} ${cards.version} (${cards.kind}, weights ${cards.weights.join(" ")}, upright only)${hostVerification[host] === "verified" ? "; covered by pptx-gallery tests/preview-fonts.test.ts (font-scheme stacks resolve to this hash-pinned face)" : cards.coverageGaps ? "; recorded coverage gap in the scheme text" : "; no font scheme uses this family, so no card test covers it"}`
          : cls === "special" ? "no route" : "no self-hosted card preview";
        continue;
      }
      hostVerification[host] = hostFixtureView.hosts?.[host]?.families?.[family] ? "verified" : verified?.[host] ?? (target.yes || pending ? "unverified" : "NA");
      hostLoading[host] = packModel ? packModel[host] : cls === "special" ? "no route" : pending ? `pending ${pending.prs.join(" and ")}: not in the pinned manifest` : "not bundled";
    }

    const evidenceKeys = [...(overrides.families[family]?.evidence ?? [])];
    if (item.extra) evidenceKeys.push("scriptAuto", "scriptModel");
    if (verified?.evidence) evidenceKeys.push(...verified.evidence);
    if (paritySignals.valuesAffected > 0) evidenceKeys.push("parity");
    if (corpusRecord) evidenceKeys.push("scriptCorpora", "scriptCorporaEvidence");
    const native = overrides.nativeVerification[family];
    if (native?.evidence) evidenceKeys.push(...native.evidence);
    const nativeRecord = nativeRecordOf(nativeEvidence, overrides.nativeEvidence, family, native);
    for (const run of nativeRecord.runs ?? []) evidenceKeys.push({ label: run.label, url: run.readme });
    const appearance = appearanceOf(overrides.appearance?.[family]);
    const baseAction = derivedNextAction(acceptance, status, item.extra ? item.extra.nextAction : overrides.families[family]?.nextAction, derivedBy ?? (visualAccepted ? visualRules : acceptRules));
    if (!baseAction) throw new Error(`no nextAction for ${family}`);
    const nativeSentence = !nativeRecord.runs?.length ? "" : nativeRecord.status === "verified" ? ` Native name read-back passed (${nativeRecord.runs.map((run) => run.run).join(", ")}), so any step above that only confirms the selected name is done; acceptance of the drawn look and metrics against PowerPoint remains.` : nativeRecord.status === "failed" ? ` Native name read-back FAILED (${nativeRecord.failures.map((item) => `${item.deck}: ${item.failing.join(", ")}`).join("; ")}); triage it (${nativeRecord.runs.map((run) => run.run).join(", ")}).` : nativeRecord.status === "partial" ? ` Native name read-back is partial (${nativeRecord.runs.map((run) => run.run).join(", ")}): ${nativeRecord.reason}.` : "";
    const visualSentence = !nativeVisual || visualAccepted ? "" : nativeVisual.outcome === "pass" ? ` Native visual comparison passed (${nativeVisual.run}); documented-visual waits for the family's own host fixture in ${visualRules.hosts.filter((host) => !nativeVisual.ownFixtureHosts.includes(host)).join(", ")}.` : nativeVisual.outcome === "unmeasured" ? ` Native visual comparison (${nativeVisual.run}): unmeasured, the real font is not installed on the native host; re-run on a host that has it.` : ` Native visual comparison (${nativeVisual.run}): finding, owner decision needed (${nativeVisual.reasons.join("; ")}).`;
    const nextAction = `${baseAction}${nativeSentence}${visualSentence}`;
    const candidates = overrides.candidates[family] ?? [];

    const record = {
      family,
      class: cls,
      inPolicy,
      licenseClass: row.licenseClass,
      license: row.license,
      selectedNamePreservedInPptx: true,
      pptxNameBasis: inPolicy
        ? "Policy invariant: exporters write the selected family and never a replacement name; the parity typefaces and fontResolution checks read it back"
        : "The exporter writes the selected family; no policy row records this yet",
      previewRoute: {
        family: route.family,
        tier: route.tier,
        kind: route.kind,
        ...(route.chain ? { chain: route.chain } : {}),
        alternates: row.alternates ?? [],
        alternatesBundled: Object.fromEntries((row.alternates ?? []).map((name) => [name, index.has(name)])),
        disabledFeatures: route.disabledFeatures,
        decision: route.decision,
        source: route.source,
        pendingBundle: pending ? { prs: pending.prs, note: pending.note } : null,
      },
      bundled: target,
      stylesRequired: rec.stylesRequired,
      replacementStylesRequired: rec.replacementStylesRequired,
      stylesRequiredByRole: cls === "open" ? roleEntry : undefined,
      stylesMissing,
      stylesExplicitGaps: rec.explicitGaps,
      approximateStyles: rec.approximateStyles,
      stylesBasis: rec.stylesBasis,
      scripts: rec.scripts,
      measurements: rec.measurements,
      candidates,
      hostVerification,
      ...(scriptFindingHosts.length ? { hostFixtureFindings: Object.fromEntries(scriptFindingHosts.map((host) => [host, scriptEvidence.hosts[host].findings[family]])) } : {}),
      hostLoading,
      nativeVerification: Object.fromEntries(Object.entries(nativeRecord).filter(([key]) => key !== "reason")),
      acceptance,
      ...(nativeVisual ? { nativeVisual } : {}),
      ...(corpusRecord ? { scriptCorpus: corpusRecord } : {}),
      ...(qualification ? { qualification } : {}),
      ...(appearance ? { appearance } : {}),
      paritySignals,
      phase,
      status,
      statusReason,
      nextAction,
      evidence: resolveEvidence(evidenceKeys, overrides.evidence),
      priority: { score, severity, valuesAffected: paritySignals.valuesAffected, valuesOpen, hostFactor: round(hostFactor, 2), rank: 0 },
    };
    if (record.stylesRequiredByRole === undefined) delete record.stylesRequiredByRole;
    return record;
  });

  out.sort((a, b) => a.family.localeCompare(b.family, "en"));
  const ranked = [...out].sort((a, b) => b.priority.score - a.priority.score || b.priority.valuesOpen - a.priority.valuesOpen || a.family.localeCompare(b.family, "en"));
  ranked.forEach((rec, i) => {
    rec.priority.rank = i + 1;
  });

  const count = (key, values) => Object.fromEntries(values.map((value) => [value, out.filter((rec) => rec[key] === value).length]));
  const tracker = {
    schema: SCHEMA,
    asOf: overrides.asOf,
    generatedBy: "scripts/build-font-tracker.mjs",
    description:
      `One record per font family: every font-policy family (${policy.families.length}: the 153 the owner reviewed on 2026-09-29 plus the rows added since for Intos, the emoji and math faces and the script-font dependencies)${overrides.extras.length ? ` plus ${overrides.extras.length} shipped script-font dependencies the policy still lacks` : ""}. Derived fields come from the policy, the measurement report, the pinned opf-render manifest and symbol-font snapshots, the pinned pptx.gallery card-font snapshot, the committed native PowerPoint comparison output and the committed parity results; next actions and evidence come from font-tracker.overrides.json. The summary's licensing block answers how many fonts there are, how many are open, how many need a replacement and how many have one.`,
    inputs: {
      galleryPreviewFonts: { file: overrides.galleryFontsSnapshot, ...galleryFonts.source, families: galleryFonts.families.length },
      policy: { file: FILES.policy, version: policy.version, families: policy.families.length },
      measurementReport: { file: overrides.measurementReport, corpus: report.corpus },
      renderManifest: { file: overrides.manifestSnapshot, ...snapshot.source, packages: snapshot.packages.length, faces: snapshot.packages.reduce((sum, pkg) => sum + pkg.faces.length, 0) },
      parity: { file: overrides.paritySource, generatedAt: parity.meta.generatedAt, heads: parity.meta.heads, values: parity.results.length },
      symbolFonts: { file: overrides.symbolFontsSnapshot, ...symbolSnapshot.source, families: Object.keys(symbolSnapshot.previewFaces).length, encodings: overrides.symbolEncodings },
      nativeEvidence: nativeEvidence.runs.map((run) => ({ id: run.id, label: run.label, file: run.file, readme: run.readme, date: run.date, host: run.host, decks: run.decks, decksPassing: run.decksPassing, failingChecks: run.failingChecks })),
      qualification: { file: overrides.qualificationReport, corpusStrings: qualReport.corpus.strings, lineBreakCases: acceptRules.lineBreakCases },
      ...(visualRules ? { nativeVisual: { id: visualRules.id, label: visualRules.label, file: visualRules.file, readme: visualRules.readme, date: visualRules.date, hosts: visualRules.hosts, statuses: visualRules.statuses, families: visualByFamily.size, pass: [...visualByFamily.values()].filter((entry) => entry.outcome === "pass").length, finding: [...visualByFamily.values()].filter((entry) => entry.outcome === "finding").length, unmeasured: [...visualByFamily.values()].filter((entry) => entry.outcome === "unmeasured").length } } : {}),
      ...(scriptEvidence ? { scriptHostFixtures: { file: overrides.scriptHostFixtureEvidence, date: scriptEvidence.date, hosts: Object.fromEntries(Object.entries(scriptEvidence.hosts).map(([host, entry]) => [host, { repository: entry.source.repository, test: entry.source.test, commit: entry.source.commit, families: Object.keys(entry.families).length, findings: Object.keys(entry.findings ?? {}).length }])), lazyBudget: scriptEvidence.lazyBudget } } : {}),
      ...(scriptNameEvidence ? { scriptNameHostFixtures: { file: overrides.scriptNameHostFixtureEvidence, date: scriptNameEvidence.date, hosts: Object.fromEntries(Object.entries(scriptNameEvidence.hosts).map(([host, entry]) => [host, { repository: entry.source.repository, test: entry.source.test, commit: entry.source.commit, families: Object.keys(entry.families).length, findings: Object.keys(entry.findings ?? {}).length }])), names: [...new Set(Object.values(scriptNameEvidence.hosts).flatMap((entry) => Object.keys(entry.families)))].sort(), lazyBudget: scriptNameEvidence.lazyBudget } } : {}),
      hostFixtures: { file: overrides.hostFixtureEvidence, date: hostEvidence.date, hosts: Object.fromEntries(Object.entries(hostEvidence.hosts).map(([host, entry]) => [host, { repository: entry.source.repository, test: entry.source.test, commit: entry.source.commit, families: Object.keys(entry.families).length }])), lazyBudget: hostEvidence.lazyBudget },
      overrides: { file: FILES.overrides },
    },
    ownerPlan: overrides.ownerPlan,
    reconciliation: overrides.reconciliation,
    statusDefinitions: overrides.statusDefs,
    priorityFormula: "score = severity x (valuesOpen x hostFactor + 1). severity is the status severity, plus 0.5 for a visual Latin route whose measured maximum width delta exceeds 5%. valuesOpen counts parity values whose preview uses the family and whose fontResolution is not already pass (real face or metric replacement with the selected name kept). hostFactor is the share of applicable hosts without per-family verification, never below 0.25.",
    summary: {
      records: out.length,
      inPolicy: out.filter((rec) => rec.inPolicy).length,
      licensing: licensingSummary(out, snapshot),
      byClass: count("class", CLASSES),
      byStatus: count("status", STATUSES),
      byPhase: Object.fromEntries([1, 2, 3, 4, 5].map((phase) => [phase, out.filter((rec) => rec.phase === phase).length])),
      hostVerification: Object.fromEntries(HOSTS.map((host) => [host, Object.fromEntries(["verified", "unverified", "NA"].map((value) => [value, out.filter((rec) => rec.hostVerification[host] === value).length]))])),
      nativeVerification: Object.fromEntries(["verified", "partial", "failed", "unverified", "NA"].map((value) => [value, out.filter((rec) => rec.nativeVerification.status === value).length])),
      nativeVerifiedFamilies: out.filter((rec) => rec.nativeVerification.status === "verified").map((rec) => rec.family),
      nativePartialFamilies: out.filter((rec) => rec.nativeVerification.status === "partial").map((rec) => rec.family),
      nativeFailedFamilies: out.filter((rec) => rec.nativeVerification.status === "failed").map((rec) => rec.family),
      bundled: { yes: out.filter((rec) => rec.bundled.yes).length, no: out.filter((rec) => !rec.bundled.yes).length },
      parityRerunNeeded: out.filter((rec) => rec.paritySignals.rerunNeeded).length,
    },
    records: out,
  };
  return { tracker, overrides };
}

// ---- markdown ---------------------------------------------------------------------------------

const cell = (text) => String(text).replaceAll("|", "\\|").replaceAll("\n", " ");

function shortLabel(evidence) {
  const pr = evidence.url.match(/github\.com\/(?:OpenPresentation|Data-Advantage)\/([\w-]+)\/pull\/(\d+)/);
  if (pr) return `${pr[1] === "pptx-gallery" ? "gallery" : pr[1]}#${pr[2]}`;
  return evidence.label.replace(/ \(.*\)$/, "");
}

function evidenceLink(evidence) {
  const url = /^https?:/.test(evidence.url) ? evidence.url : path.posix.relative(DIR, evidence.url);
  return `[${cell(shortLabel(evidence))}](${url})`;
}

function routeCell(rec) {
  const route = rec.previewRoute;
  if (route.kind === "code-table") return `code table (${route.chain[0]} first)`;
  if (!route.family) return "none";
  const base = route.kind === "self" ? `self (${route.tier})` : `${route.family} (${route.tier})`;
  return route.pendingBundle ? `${base}; faces pending ${route.pendingBundle.prs.join(" and ")}` : base;
}

function bundledCell(rec) {
  if (rec.previewRoute.kind === "code-table") return rec.bundled.yes ? `chain of ${rec.bundled.chain.length}` : "no";
  if (rec.class === "special") return "n/a";
  if (!rec.bundled.yes) return "no";
  const styles = rec.bundled.stylesAvailable.join(" ");
  return rec.stylesMissing.length ? `${styles}; missing ${rec.stylesMissing.join(" ")}` : styles;
}

function widthCell(rec) {
  const m = rec.measurements;
  if (!m) return "-";
  return `${pct(m.meanAbsWidthDelta)} / ${pct(m.maxAbsWidthDelta)}`;
}

function scriptCorpusSection(records) {
  const withCorpus = records.filter((rec) => rec.scriptCorpus);
  if (!withCorpus.length) return [];
  const lines = ["", "## Script corpus (FF-44)", ""];
  lines.push(
    "Result of the script shaping corpora ([script-corpora.md](script-corpora.md)): each family's preview face run through the corpus samples of its script (coverage, fontkit against HarfBuzz, browser), and, for a proprietary family whose original is installed on the measuring host, the original read in place. A width delta is the replacement's advance over the original's, minus one, on the corpus samples of the family's script; line height is hhea ascent plus descent plus line gap in em. Not a native PowerPoint claim.",
    "",
    "| Family | Class | Preview face | Corpus scripts | Samples equal to HarfBuzz | Own-script coverage | Original: width delta mean / max, line height original / preview |",
    "| --- | --- | --- | --- | --- | --- | --- |",
  );
  for (const rec of withCorpus.filter((item) => item.class === "proprietary-script" || item.class === "open").sort((a, b) => a.family.localeCompare(b.family, "en"))) {
    const c = rec.scriptCorpus;
    const original = Array.isArray(c.original)
      ? c.original.filter((item, index, all) => all.findIndex((other) => other.script === item.script) === index).map((item) => `${item.script} ${item.meanWidthDelta >= 0 ? "+" : ""}${round(item.meanWidthDelta * 100, 1)}% / ${round(item.maxAbsWidthDelta * 100, 1)}% (${item.samples} samples), ${item.lineHeightEm.original} / ${item.lineHeightEm.replacement} em`).join("; ")
      : c.original ?? (rec.class === "open" ? "-" : "not measured");
    const coverage = c.nationalCharset ? `${pct(c.nationalCharset.covered / c.nationalCharset.size)} of ${c.nationalCharset.charset}` : c.ownScriptBmpCoverage === null ? "-" : pct(c.ownScriptBmpCoverage);
    lines.push(`| ${cell(rec.family)} | ${rec.class} | ${cell(c.face)} | ${c.scripts.join(", ")} | ${c.equalToHarfBuzz} of ${c.faceSamples}${c.recordedFontkitLimits ? ` (${c.recordedFontkitLimits} recorded fontkit limits)` : ""} | ${coverage} | ${cell(original)} |`);
  }
  return lines;
}

function licensingSection(summary, tracker) {
  const l = summary.licensing;
  const found = l.replacementFound;
  const bundledLicense = l.bundledFaceLicenses;
  const license = (counts) => Object.entries(counts).map(([name, count]) => `${name} (${count})`).join(", ");
  return [
    "## Fonts, licences and replacements",
    "",
    "The owner's four questions, answered from the records below (rebuilt on every run, never typed). A replacement counts as found when its face is bundled in the pinned opf-render manifest. Licensed (proprietary) fonts are never bundled or embedded; the PPTX keeps the selected name.",
    "",
    "| Question | Count | Breakdown |",
    "| --- | ---: | --- |",
    `| How many fonts do we have? | ${l.totalFamilies} | ${l.openDirectlyUsable.total} open, ${l.needsReplacement.total} proprietary |`,
    `| How many are licensed so we can use them directly (open)? | ${l.openDirectlyUsable.total} | ${l.openDirectlyUsable.drawnAsItself} drawn as themselves, ${l.openDirectlyUsable.openAlias} open aliases (${l.openDirectlyUsable.aliases.join(", ") || "none"})${l.openDirectlyUsable.notBundled ? `, ${l.openDirectlyUsable.notBundled} not bundled` : ""} |`,
    `| How many need a replacement (proprietary)? | ${l.needsReplacement.total} | ${Object.entries(l.needsReplacement.byClass).map(([cls, count]) => `${count} ${cls}`).join(", ")} |`,
    `| How many have a replacement found? | ${found.total} | ${found.metricCompatible} metric-compatible, ${found.visualLookAlike} visual look-alike (Latin), ${found.scriptFace} script face, ${found.specialPath} special path (${Object.entries(found.specialPathKinds).map(([kind, count]) => `${count} ${kind}`).join(", ") || "none"}) |`,
    `| How many have no route? | ${l.noRoute.total} | ${l.noRoute.families.join(", ") || "none"} |`,
    "",
    `Licence of the bundled faces: the ${found.total} replacement routes use ${bundledLicense.replacementFaces} distinct faces, by licence ${license(bundledLicense.replacementFacesByLicense)}; the pinned opf-render manifest holds ${bundledLicense.manifestPackages} packages and ${bundledLicense.manifestFaces} faces (packages: ${license(bundledLicense.manifestPackagesByLicense)}; faces: ${license(bundledLicense.manifestFacesByLicense)}). The open families themselves: ${license(l.openDirectlyUsable.byLicense)}. Only OFL-1.1, Apache-2.0, MIT and UFL-1.0 may be bundled ([font-licensing.md](font-licensing.md#font-files-bundling-and-licenses)).`,
    "",
    `A route found is not a route verified: ${tracker.summary.nativeVerification.verified} families are native verified, ${tracker.summary.nativeVerification.partial} partial and ${tracker.summary.nativeVerification.failed} failed (see Native evidence); the special path is described under Symbol-encoded families.`,
  ];
}

function nativeSection(tracker) {
  const { summary, inputs } = tracker;
  const lines = ["", "## Native evidence", ""];
  lines.push(
    `Native PowerPoint checks are supervisor-run (root owns Office); only their committed comparison output counts here. Basis: ${NATIVE_BASIS} ${summary.nativeVerification.verified} families are verified, ${summary.nativeVerification.partial} partial and ${summary.nativeVerification.failed} failed (a deck that reads the family back fails a gated check: fonts, themeSlots or presentationFonts); a family no run names stays unverified.`,
    "",
    "| Run | Date | Decks | Decks passing every check | Failing checks |",
    "| --- | --- | ---: | ---: | --- |",
  );
  for (const run of inputs.nativeEvidence) lines.push(`| [${cell(run.label)}](${path.posix.relative(DIR, run.readme)}) | ${run.date} | ${run.decks} | ${run.decksPassing} | ${run.failingChecks.map((item) => `${item.deck}: ${item.failing.join(", ")}`).join("; ") || "none"} |`);
  lines.push("", "| Family | Status | Where |", "| --- | --- | --- |");
  for (const rec of tracker.records.filter((item) => item.nativeVerification.runs)) lines.push(`| ${cell(rec.family)} | ${rec.nativeVerification.status} | ${cell(rec.nativeVerification.note)}${rec.nativeVerification.caveat ? ` Caveat: ${cell(rec.nativeVerification.caveat)}` : ""} |`);
  return lines;
}

function nativeVisualSection(tracker) {
  const run = tracker.inputs.nativeVisual;
  if (!run) return [];
  const rows = tracker.records.filter((rec) => rec.nativeVisual);
  const lines = ["", "## Native visual comparison (FF-46)", ""];
  lines.push(
    `[${cell(run.label)}](${path.posix.relative(DIR, run.readme)}) (${run.date}): ${run.families} families of status ${run.statuses.join(", ")}: ${run.pass} pass, ${run.finding} have a finding and ${run.unmeasured} are unmeasured (the real font is not installed on the native host). PowerPoint does not re-wrap the exported single-line boxes, so line breaks are read as where each native line ends against its box. A family is documented-visual only when the run passes and its own fixture passes in every host (${run.hosts.join(", ")}); a finding keeps the status for an owner decision.`,
    "",
    "| Family | Status | Outcome | Installed on the native host | Ink native / preview | Own fixture hosts | Reasons |",
    "| --- | --- | --- | --- | ---: | --- | --- |",
  );
  for (const rec of rows) {
    const v = rec.nativeVisual;
    lines.push(`| ${cell(rec.family)} | ${rec.status} | ${v.outcome} | ${v.installedOnNativeHost == null ? "-" : v.installedOnNativeHost ? "yes" : "no"} | ${v.inkWidthRatio ?? "-"} | ${v.ownFixtureHosts.join(", ") || "none"} | ${cell(v.reasons.join("; ")) || "-"} |`);
  }
  return lines;
}

function symbolSection(tracker) {
  const symbols = tracker.records.filter((rec) => rec.previewRoute.kind === "code-table");
  if (!symbols.length) return [];
  const lines = ["", "## Symbol-encoded families (FF-45)", ""];
  lines.push(
    `Symbol, Wingdings and Webdings are not text fonts: their glyphs sit at codes 0x20 to 0xFF of a Microsoft Symbol cmap. opf-render previews them through a code table (opf-render#94 and #95; [special-families.md](special-families.md)): each code maps to Unicode through core's [symbol-font-encodings.json](../../../spec/reference/symbol-font-encodings.json) and draws with the first loaded open face of the chain (pinned at opf-render \`${tracker.inputs.symbolFonts.commit.slice(0, 7)}\`), at the verified font's advance. The route kind is \`code-table\` and the status \`code-table\`: the route exists and is verified in opf-render's node, browser and raster tests. Native PowerPoint verification of symbol runs is not recorded for any of them. Wingdings 2 and Wingdings 3 share the Wingdings policy row and have no record of their own.`,
    "",
    "| Family | Chain (first loaded face draws) | Codes mapped | Bundled | Node / browser | Native |",
    "| --- | --- | --- | --- | --- | --- |",
  );
  for (const rec of symbols) lines.push(`| ${cell(rec.family)} | ${rec.previewRoute.chain.join(", ")} | ${cell(rec.statusReason.match(/\d+ of \d+ codes/)?.[0] ?? "-")} | ${rec.bundled.yes ? "yes" : "no"} | ${rec.hostVerification.node} / ${rec.hostVerification.browser} | ${rec.nativeVerification.status} |`);
  return lines;
}

export function renderMarkdown(tracker) {
  const { summary, records } = tracker;
  const lines = [];
  const push = (...items) => lines.push(...items);
  const byRank = (a, b) => a.priority.rank - b.priority.rank;

  push(
    "# Per-font fidelity tracker (FF-40)",
    "",
    "<!-- Generated by scripts/build-font-tracker.mjs from font-tracker.json. Do not edit; edit font-tracker.overrides.json and rebuild. -->",
    "",
    `As of ${tracker.asOf}. Machine-readable source: [font-tracker.json](font-tracker.json). Authored inputs: [font-tracker.overrides.json](font-tracker.overrides.json). Program tracker: [burndown.md](burndown.md) (FF-40 to FF-46). Policy table: [font-licensing.md](font-licensing.md). Internal program documentation: no support or progress status of any kind is shown on pptx.gallery or any site.`,
    "",
    ...licensingSection(summary, tracker),
    "",
    "This is the per-font work list behind the owner's 2026-09-29 review. Each record holds the family's selected name, preview route and tier, the bundled face (package, version, hashes, styles), the styles it needs and lacks, scripts, per-style measurements, host and native verification, parity signals, phase, status, next action and evidence. A family counts as accepted (status qualified or documented-visual) only when its own fixtures pass in every host and, for a proprietary family, its measurement against the real font is on record (RR-17); every other family still needs its own fixture and acceptance record, Native PowerPoint verification is recorded only where a committed native run (see Native evidence) names the family; every other family is unverified.",
    "",
    "## Summary",
    "",
    `${summary.records} records: ${summary.inPolicy} policy families${summary.records > summary.inPolicy ? ` plus ${summary.records - summary.inPolicy} shipped script-font dependencies that the policy lacks` : ""}. ${summary.bundled.yes} route to a face that opf-render bundles (a code-table route counts when every face of its chain is bundled); ${summary.bundled.no} do not. ${summary.parityRerunNeeded} records were read by the committed parity run in a way that is stale against main (rerun needed).`,
    "",
    "| Status | Count | Severity | Meaning |",
    "| --- | --- | --- | --- |",
  );
  for (const status of STATUSES) push(`| \`${status}\` | ${summary.byStatus[status]} | ${tracker.statusDefinitions[status].severity} | ${cell(tracker.statusDefinitions[status].meaning)} |`);
  push("", "| Phase | Count | Owner's phase |", "| --- | --- | --- |");
  for (const phase of tracker.ownerPlan.phases) push(`| ${phase.phase} | ${summary.byPhase[phase.phase]} | ${cell(phase.title)} |`);
  push("", `Phase is the earliest owner phase with unfinished work for the family. Phase 5 (native verification and the full parity rerun) applies to every record: native verification is ${summary.nativeVerification.verified} verified, ${summary.nativeVerification.partial} partial, ${summary.nativeVerification.failed} failed, ${summary.nativeVerification.unverified} unverified (see Native evidence).`);
  push("", "| Class | Count |", "| --- | --- |");
  for (const cls of CLASSES) push(`| ${cls} | ${summary.byClass[cls]} |`);
  push("", "| Host | Verified | Unverified | NA |", "| --- | --- | --- | --- |");
  for (const host of HOSTS) push(`| ${host} | ${summary.hostVerification[host].verified} | ${summary.hostVerification[host].unverified} | ${summary.hostVerification[host].NA} |`);
  push("", "`verified` means per-family evidence exists in a repository; `unverified` means a face is routed but no per-family acceptance exists; `NA` means no intended face exists to load in that host. Hosts: `node` (opf-render registries; the default `prepareNodeFonts` pack is `base`, Roboto only, and the office, open and script packs load only when requested), `browser` (opf-render browser registry), `editor` (the opf-editor playground), `galleryEditor` (the vendored opf-editor bundle inside pptx.gallery, 33 eager faces) and `galleryCards` (pptx.gallery's self-hosted preview webfonts for cards and pages, upright regular and bold only). Loading routes per host are in each record's `hostLoading`.");

  push("", "## Priority queue", "", `Priority: ${tracker.priorityFormula} The audited set is ${tracker.inputs.parity.values} gallery values (${tracker.inputs.parity.file.split("/").pop()}).`, "");
  push("| Rank | Family | Class | Phase | Status | Values | Score | Next action |", "| --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const rec of [...records].sort(byRank).slice(0, 15)) push(`| ${rec.priority.rank} | ${cell(rec.family)} | ${rec.class} | ${rec.phase} | \`${rec.status}\` | ${rec.priority.valuesAffected} | ${rec.priority.score} | ${cell(rec.nextAction)} |`);

  push(...scriptCorpusSection(records));

  push(...nativeSection(tracker), ...nativeVisualSection(tracker), ...symbolSection(tracker));

  push("", "## The owner's plan", "", `Owner input, ${tracker.ownerPlan.date}, adopted as the program order. Request: "${tracker.ownerPlan.request}"`, "", `> ${tracker.ownerPlan.summary}`, ">");
  for (const phase of tracker.ownerPlan.phases) push(`> ${phase.phase}. ${phase.text}`);
  push(">", `> ${tracker.ownerPlan.criticalPath}`, "", "Rules:", "");
  for (const rule of tracker.ownerPlan.rules) push(`- ${rule}`);

  push("", "## Reconciled with current state", "", "The owner's review predates some merged and in-flight work. The records above use current truth: core `origin/main` policy and docs, the pinned opf-render manifest, and the latest committed parity run. What changed against the review:", "");
  for (const note of tracker.reconciliation) push(`- ${note}`);
  const source = tracker.inputs;
  push(
    "",
    `Inputs: policy version ${source.policy.version} (${source.policy.families} families); opf-render manifest at \`${source.renderManifest.commit}\` (${source.renderManifest.packages} packages, ${source.renderManifest.faces} faces, captured ${source.renderManifest.capturedAt}); measurement report corpus ${source.measurementReport.corpus.strings} Latin strings; parity run ${source.parity.generatedAt} at opf \`${source.parity.heads.opf.slice(0, 7)}\`, opf-render \`${source.parity.heads["opf-render"].slice(0, 7)}\`, opf-pptx \`${source.parity.heads["opf-pptx"].slice(0, 7)}\`, pptx-gallery \`${source.parity.heads["pptx-gallery"].slice(0, 7)}\`.`,
  );

  push("", "## Records by phase and class", "", "Columns: Route is the preview face and tier (main's policy; an in-flight route is noted). Bundled lists the styles opf-render ships for the route face and what it lacks. Width delta is mean and maximum |ratio - 1| of shaped advances against the real font on a Latin corpus (per-style values are in the JSON); script families have no script-specific corpus yet. Values counts parity values that use the family.", "");
  for (const phase of tracker.ownerPlan.phases) {
    const inPhase = records.filter((rec) => rec.phase === phase.phase);
    push(`### Phase ${phase.phase}: ${phase.title} (${inPhase.length})`, "");
    if (!inPhase.length) {
      push("No family has this as its earliest unfinished phase. Native verification and the full parity rerun (phase 5) apply to every record and are tracked in FF-46 and FF-38.", "");
      continue;
    }
    for (const cls of CLASSES) {
      const group = inPhase.filter((rec) => rec.class === cls).sort(byRank);
      if (!group.length) continue;
      push(`#### ${cls} (${group.length})`, "", "| Rank | Family | Route | Bundled | Width delta | Values | Status | Next action | Evidence |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
      for (const rec of group) {
        push(`| ${rec.priority.rank} | ${cell(rec.family)} | ${cell(routeCell(rec))} | ${cell(bundledCell(rec))} | ${widthCell(rec)} | ${rec.priority.valuesAffected} | \`${rec.status}\` | ${cell(rec.nextAction)} | ${rec.evidence.map(evidenceLink).join(", ")} |`);
      }
      push("");
    }
  }

  const described = records.filter((rec) => rec.appearance);
  push("", "## Latin qualification and appearance (RR-17)", "", `Per family measured against the real font on the measuring host (${tracker.inputs.qualification.file.split("/").pop()}): width mean and maximum over ${tracker.inputs.qualification.corpusStrings} strings, the share of ${tracker.inputs.qualification.lineBreakCases} wrap cases (50 paragraphs at 5 box widths) that break at the same words, the glyph height ratios (replacement over original, from the painted x and H boxes), and the authored appearance note. ${described.length} families; families whose reference font is not available to the host are described but unmeasured. Status \`qualified\` and \`documented-visual\` need a passing fixture in every host (${tracker.inputs.hostFixtures.file.split("/").pop()}).`, "");
  push("| Family | Route | Status | Widths (mean / max) | Line breaks | x / cap | Appearance |", "| --- | --- | --- | --- | --- | --- | --- |");
  for (const rec of described) {
    const q = rec.qualification;
    const measured = q?.referenceAvailable;
    push(`| ${cell(rec.family)} | ${cell(routeCell(rec))} | \`${rec.status}\` | ${measured ? `${pct(q.meanAbsWidthDelta)} / ${pct(q.maxAbsWidthDelta)}` : "unmeasured"} | ${measured ? pct(q.lineBreaksIdenticalFraction) : "-"} | ${measured ? `${ratio(q.xHeightRatio)} / ${ratio(q.capHeightRatio)}` : "-"} | ${cell(`${rec.appearance.description}${rec.appearance.caveat ? ` ${rec.appearance.caveat}` : ""}`)} |`);
  }
  push("");

  const scriptHosts = tracker.inputs.scriptHostFixtures;
  if (scriptHosts) {
    push("## Script, emoji and math host fixtures (RR-17)", "", `Per family fixtures for the open script, emoji and math families (${scriptHosts.file.split("/").pop()}): in each host the family's package loads, every style resolves to the family itself, and samples of its script (original FF-44 corpus text, FF-45 emoji and math) are drawn strictly in its own pinned file with no glyph fallback. A family appears under a host only when its fixture passed there; a failure is a recorded finding that keeps the family out of \`qualified\`, and the check is never relaxed.`, "", "| Host | Repository and test | Commit | Families passed | Findings |", "| --- | --- | --- | ---: | ---: |");
    for (const [host, entry] of Object.entries(scriptHosts.hosts)) push(`| ${host} | ${entry.repository} \`${entry.test}\` | \`${entry.commit.slice(0, 12)}\` | ${entry.families} | ${entry.findings} |`);
    push("");
    const found = records.filter((rec) => Object.values(rec.hostFixtureFindings ?? {}).length);
    if (found.length) {
      push("| Family | Host | Finding |", "| --- | --- | --- |");
      for (const rec of found) for (const [host, finding] of Object.entries(rec.hostFixtureFindings)) push(`| ${cell(rec.family)} | ${host} | ${cell(finding.reason)} |`);
      push("");
    }
  }
  const nameHosts = tracker.inputs.scriptNameHostFixtures;
  if (nameHosts) {
    push("### Proprietary script, emoji, math and code-table names (FF-46)", "", `Per name fixtures (${nameHosts.file.split("/").pop()}) for the proprietary names that pass the native visual comparison: in each host the name resolves to its policy route (a code table to the first face of its chain) with the policy size adjustment, and every sample of each of its scripts is drawn in that script's route face (the designated script face where the policy route lacks the script) with no other glyph fallback, from the route's pinned file. The fixtures of the open route faces do not transfer to a name, so a name that passes natively is documented-visual only with its own fixture in every host. ${nameHosts.names.length} names: ${nameHosts.names.join(", ")}.`, "", "| Host | Repository and test | Commit | Names passed | Findings |", "| --- | --- | --- | ---: | ---: |");
    for (const [host, entry] of Object.entries(nameHosts.hosts)) push(`| ${host} | ${entry.repository} \`${entry.test}\` | \`${entry.commit.slice(0, 12)}\` | ${entry.families} | ${entry.findings} |`);
    push("");
  }

  push(
    "## Method",
    "",
    "- **Selected name.** The PPTX always retains the selected family. The parity typefaces and fontResolution checks read the exported names back for the audited values; the record's `paritySignals.pptxNamedValues` counts them.",
    "- **Route and tier.** From `spec/reference/font-policy.json`, resolving provisional decisions. `metric` needs a mean below 0.1% and a maximum of at most 0.3% in all four styles; `visual` is a documented look-alike. Width deltas alone do not qualify a face: matching line breaks and line metrics, vertical metrics and unchanged geometry tolerances are also required and are unrecorded (`verticalMetricsMatch`, `lineBreaksMatch` are null) except for the in-flight Intos candidate.",
    "- **Bundled.** From the pinned opf-render manifest snapshot: package, version or commit, license, Reserved Font Names, file names and SHA-256 per face. For a proprietary family it describes the route face, never the proprietary font.",
    "- **Styles.** Style keys are weight plus `i` for italic (`400`, `700i`). Required styles come from the measurement report where the real font was on the measuring host, otherwise four styles for Latin and regular and bold for script families are assumed (`stylesBasis`). An open replacement must also carry the styles of every family routed to it (`stylesRequiredByRole`).",
    "- **Parity signals.** From the committed run named above, which models the gallery editor font host (its font gate loads the script and vendored faces a document needs). `statusAtRun` is what the run observed; `expectedStatusOnMain` is what current main should produce; `rerunNeeded` marks a mismatch.",
    "- **Evidence.** Merged and in-flight pull requests, evidence folders and docs. In-flight work is labelled and never counted as merged.",
    "",
  );
  return `${lines.join("\n")}\n`;
}

export function serialize(tracker) {
  return `${JSON.stringify(tracker, null, 2)}\n`;
}

/** Build both outputs in memory and report which committed files differ. */
export function checkTracker({ root = ROOT } = {}) {
  const { tracker } = buildTracker({ root });
  const expected = { [FILES.json]: serialize(tracker), [FILES.markdown]: renderMarkdown(tracker) };
  const drift = [];
  for (const [file, text] of Object.entries(expected)) {
    let actual = null;
    try {
      actual = readFileSync(path.join(root, file), "utf8");
    } catch {
      // A missing file is drift.
    }
    if (actual !== text) drift.push(file);
  }
  return { drift, expected };
}

async function main() {
  const args = process.argv.slice(2);
  const option = (name) => {
    const at = args.indexOf(name);
    return at >= 0 ? args[at + 1] : undefined;
  };
  const overrides = readJson(ROOT, FILES.overrides);
  if (args.includes("--snapshot-manifest")) {
    const commit = option("--commit");
    if (!/^[0-9a-f]{40}$/.test(commit ?? "")) throw new Error("--commit must be the full 40-character opf-render commit the manifest was read from");
    const { BUNDLED_FONT_MANIFEST } = await import(pathToFileURL(path.resolve(option("--snapshot-manifest"))).href);
    const snapshot = snapshotFromManifest(BUNDLED_FONT_MANIFEST, { commit, capturedAt: option("--date") ?? new Date().toISOString().slice(0, 10) });
    writeFileSync(path.join(ROOT, overrides.manifestSnapshot), `${JSON.stringify(snapshot, null, 2)}\n`);
    console.log(`Wrote ${overrides.manifestSnapshot} (${snapshot.packages.length} packages at ${commit.slice(0, 7)}).`);
  }
  if (args.includes("--snapshot-gallery-fonts")) {
    const commit = option("--commit");
    if (!/^[0-9a-f]{40}$/.test(commit ?? "")) throw new Error("--commit must be the full 40-character pptx-gallery commit the file was read from");
    const previewFonts = JSON.parse(readFileSync(path.resolve(option("--snapshot-gallery-fonts")), "utf8"));
    const snapshot = gallerySnapshotFromPreviewFonts(previewFonts, { commit, capturedAt: option("--date") ?? new Date().toISOString().slice(0, 10) });
    writeFileSync(path.join(ROOT, overrides.galleryFontsSnapshot), `${JSON.stringify(snapshot, null, 2)}\n`);
    console.log(`Wrote ${overrides.galleryFontsSnapshot} (${snapshot.families.length} families at ${commit.slice(0, 7)}).`);
  }
  if (args.includes("--snapshot-symbol-fonts")) {
    const commit = option("--commit");
    if (!/^[0-9a-f]{40}$/.test(commit ?? "")) throw new Error("--commit must be the full 40-character opf-render commit the module was read from");
    const symbolFonts = await import(pathToFileURL(path.resolve(option("--snapshot-symbol-fonts"))).href);
    const snapshot = snapshotFromSymbolFonts(symbolFonts, { commit, capturedAt: option("--date") ?? new Date().toISOString().slice(0, 10) });
    writeFileSync(path.join(ROOT, overrides.symbolFontsSnapshot), `${JSON.stringify(snapshot, null, 2)}\n`);
    console.log(`Wrote ${overrides.symbolFontsSnapshot} (${Object.keys(snapshot.previewFaces).length} families at ${commit.slice(0, 7)}).`);
  }
  if (args.includes("--check")) {
    const { drift } = checkTracker();
    if (drift.length) {
      if (reportStale(`Font tracker drift: ${drift.join(", ")}. Run node scripts/build-font-tracker.mjs and commit the result.`)) process.exit(1);
      return;
    }
    console.log("Font tracker is up to date.");
    return;
  }
  const { expected } = checkTracker();
  for (const [file, text] of Object.entries(expected)) writeFileSync(path.join(ROOT, file), text);
  console.log(`Wrote ${Object.keys(expected).join(" and ")}.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
