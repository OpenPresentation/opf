// FF-40: build the per-font fidelity tracker.
//
//   node scripts/build-font-tracker.mjs            write font-tracker.json and font-tracker.md
//   node scripts/build-font-tracker.mjs --check    fail when either file differs from a fresh build (drift)
//   node scripts/build-font-tracker.mjs --snapshot-manifest <opf-render>/src/font-manifest.js --commit <sha>
//                                                  refresh the pinned render-manifest snapshot, then rebuild
//   node scripts/build-font-tracker.mjs --snapshot-gallery-fonts <pptx-gallery>/data/preview-fonts.json --commit <sha>
//                                                  refresh the pinned gallery preview-font (cards) snapshot, then rebuild
//
// Derived data (never hand edited): spec/reference/font-policy.json, the measurement report, the pinned
// opf-render font manifest snapshot, the pinned pptx.gallery preview-font snapshot and the committed parity results. Authored data:
// docs/programs/font-fidelity-everywhere/font-tracker.overrides.json (owner plan text, reconciled next
// actions, evidence keys, classes, scripts, style rules and in-flight candidates).
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

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
  "visual-gap",
  "script-gap",
  "baseline-needed",
  "metric-measured",
];
const HOSTS = ["node", "browser", "editor", "galleryEditor", "galleryCards"];
const FOUR = ["400", "400i", "700", "700i"];
const TWO = ["400", "700"];

const readJson = (root, file) => JSON.parse(readFileSync(path.join(root, file), "utf8"));
const styleKey = (weight, italic) => `${weight}${italic ? "i" : ""}`;
const styleOrder = (a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10) || a.length - b.length;
const sortStyles = (styles) => [...new Set(styles)].sort(styleOrder);
const round = (value, digits = 4) => Math.round(value * 10 ** digits) / 10 ** digits;
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

// Mirror of the host verification defaults, so priority can be computed before the record is assembled.
function hostVerificationOf(family, host, target, cards, overrides) {
  const set = overrides.hostVerification[family]?.[host];
  if (set) return set;
  if (host === "galleryCards") return cards ? "unverified" : "NA";
  return target.yes || overrides.pendingBundle[family] ? "unverified" : "NA";
}

function expectedStatus(route, targetBundled) {
  if (route.tier === "none") return "missing";
  if (route.kind === "self") return targetBundled ? "real" : "missing";
  return route.tier === "metric" && targetBundled ? "metric-substitute" : "visual-substitute";
}

// ---- build ------------------------------------------------------------------------------------

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

export function buildTracker({ root = ROOT } = {}) {
  const policy = readJson(root, FILES.policy);
  const overrides = readJson(root, FILES.overrides);
  const snapshot = readJson(root, overrides.manifestSnapshot);
  const report = readJson(root, overrides.measurementReport);
  const galleryFonts = readJson(root, overrides.galleryFontsSnapshot);
  const galleryCardsByFamily = new Map(galleryFonts.families.map((entry) => [entry.family, entry]));
  const parity = readJson(root, overrides.paritySource);
  const decisions = policy.provisionalDecisions?.decisions ?? {};
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
  for (const extra of overrides.extras) {
    if (policyNames.has(extra.family)) throw new Error(`${extra.family} is in the policy; remove it from overrides.extras`);
    if (!index.has(extra.family)) throw new Error(`${extra.family} is not in the pinned render manifest snapshot`);
  }
  const scriptClass = new Set(overrides.classes.proprietaryScript);
  const specialClass = new Set(overrides.classes.special);

  const classOf = (row) => (specialClass.has(row.family) ? "special" : scriptClass.has(row.family) ? "proprietary-script" : row.licenseClass === "open" ? "open" : "proprietary-latin");

  // First pass: everything derived from one policy row.
  const rows = policy.families.map((row) => ({ row, cls: classOf(row), inPolicy: true, route: routeOf(row, decisions) }));
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
    const applies = route.kind === "self" ? "self" : route.family ? "route-target" : "none";
    const bundled = bundledRecord(index, route.family, applies);

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
          verticalMetricsMatch: overrides.measurementDetails[family]?.verticalMetricsMatch ?? null,
          verticalMetricsNote: overrides.measurementDetails[family]?.note ?? null,
          lineBreaksMatch: null,
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
      stylesBasis = "not applicable: dedicated path";
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

    // Status.
    const lazyPending = target.yes && hostModel.lazyPendingPacks.includes(target.pack);
    const pending = overrides.pendingBundle[family] ?? null;
    if (pending && target.yes) throw new Error(`overrides.pendingBundle for ${family} is stale: ${route.family} is now bundled in the pinned manifest snapshot`);
    let status;
    let statusReason;
    if (cls === "special") {
      status = "needs-special-path";
      statusReason = "no look-alike route in the policy; dedicated path required";
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
      statusReason = "visual script route; native-script measurement and appearance outstanding";
    } else {
      status = "visual-gap";
      statusReason = "visual route; metric or appearance qualification outstanding";
    }

    const phaseByStatus = { "loading-gap": 2, "style-gap": 2, "policy-gap": 1, "needs-special-path": 4, "visual-gap": 4, "script-gap": 4, "baseline-needed": 1, "metric-measured": 1 };
    const phase = overrides.phaseOverrides[family]?.phase ?? phaseByStatus[status];

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
    const applicable = HOSTS.filter((host) => hostVerificationOf(family, host, target, cards, overrides) !== "NA");
    const verifiedHosts = applicable.filter((host) => hostVerificationOf(family, host, target, cards, overrides) === "verified").length;
    const hostFactor = applicable.length ? Math.max(0.25, (applicable.length - verifiedHosts) / applicable.length) : 1;
    const score = round(severity * (valuesOpen * hostFactor + 1), 1);

    // Hosts.
    // A vendored package can load differently from the rest of its pack (Intos is an office-pack package that browser hosts load lazily).
    const packKey = target.yes ? (hostModel.packageModels?.[target.packages[0].name] ?? target.pack) : null;
    const packModel = packKey ? hostModel.packs[packKey] : null;
    const verified = overrides.hostVerification[family];
    const hostVerification = {};
    const hostLoading = {};
    for (const host of HOSTS) {
      if (host === "galleryCards") {
        hostVerification[host] = verified?.[host] ?? (cards ? "unverified" : "NA");
        hostLoading[host] = cards
          ? `self-hosted preview webfont: ${cards.package} ${cards.version} (${cards.kind}, weights ${cards.weights.join(" ")}, upright only)`
          : cls === "special" ? "no route" : "no self-hosted card preview";
        continue;
      }
      hostVerification[host] = verified?.[host] ?? (target.yes || pending ? "unverified" : "NA");
      hostLoading[host] = packModel ? packModel[host] : cls === "special" ? "no route" : pending ? `pending ${pending.prs.join(" and ")}: not in the pinned manifest` : "not bundled";
    }

    const evidenceKeys = [...(overrides.families[family]?.evidence ?? [])];
    if (item.extra) evidenceKeys.push("scriptAuto", "scriptModel");
    if (verified?.evidence) evidenceKeys.push(...verified.evidence);
    if (paritySignals.valuesAffected > 0) evidenceKeys.push("parity");
    const native = overrides.nativeVerification[family];
    if (native?.evidence) evidenceKeys.push(...native.evidence);
    const accepted = overrides.acceptance[family];
    if (accepted?.accepted && !(accepted.date && accepted.fixture && accepted.evidence?.length)) throw new Error(`acceptance for ${family} needs fixture, date and evidence`);
    const acceptance = accepted
      ? { fixture: accepted.fixture ?? "pending", accepted: accepted.accepted === true, date: accepted.date ?? null, evidence: resolveEvidence(accepted.evidence ?? [], overrides.evidence), note: accepted.note ?? "" }
      : { fixture: "pending", accepted: false, date: null, evidence: [], note: "Own fixture and acceptance record required; grouped work does not transfer acceptance." };
    const nextAction = item.extra ? item.extra.nextAction : overrides.families[family]?.nextAction;
    if (!nextAction) throw new Error(`no nextAction for ${family}`);
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
      hostLoading,
      nativeVerification: native ? { status: native.status, note: native.note } : { status: "unverified", note: "No per-family native PowerPoint acceptance (phase 5)." },
      acceptance,
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
      "One record per font family: every font-policy family (the 153 the owner reviewed on 2026-09-29 plus the four Intos rows added by opf#166) plus the seven shipped script-font dependencies the policy still lacks. Derived fields come from the policy, the measurement report, the pinned opf-render manifest snapshot and the committed parity results; next actions and evidence come from font-tracker.overrides.json.",
    inputs: {
      galleryPreviewFonts: { file: overrides.galleryFontsSnapshot, ...galleryFonts.source, families: galleryFonts.families.length },
      policy: { file: FILES.policy, version: policy.version, families: policy.families.length },
      measurementReport: { file: overrides.measurementReport, corpus: report.corpus },
      renderManifest: { file: overrides.manifestSnapshot, ...snapshot.source, packages: snapshot.packages.length, faces: snapshot.packages.reduce((sum, pkg) => sum + pkg.faces.length, 0) },
      parity: { file: overrides.paritySource, generatedAt: parity.meta.generatedAt, heads: parity.meta.heads, values: parity.results.length },
      overrides: { file: FILES.overrides },
    },
    ownerPlan: overrides.ownerPlan,
    reconciliation: overrides.reconciliation,
    statusDefinitions: overrides.statusDefs,
    priorityFormula: "score = severity x (valuesOpen x hostFactor + 1). severity is the status severity, plus 0.5 for a visual Latin route whose measured maximum width delta exceeds 5%. valuesOpen counts parity values whose preview uses the family and whose fontResolution is not already pass (real face or metric replacement with the selected name kept). hostFactor is the share of applicable hosts without per-family verification, never below 0.25.",
    summary: {
      records: out.length,
      inPolicy: out.filter((rec) => rec.inPolicy).length,
      byClass: count("class", CLASSES),
      byStatus: count("status", STATUSES),
      byPhase: Object.fromEntries([1, 2, 3, 4, 5].map((phase) => [phase, out.filter((rec) => rec.phase === phase).length])),
      hostVerification: Object.fromEntries(HOSTS.map((host) => [host, Object.fromEntries(["verified", "unverified", "NA"].map((value) => [value, out.filter((rec) => rec.hostVerification[host] === value).length]))])),
      nativeVerification: Object.fromEntries(["verified", "partial", "unverified", "NA"].map((value) => [value, out.filter((rec) => rec.nativeVerification.status === value).length])),
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
  if (!route.family) return "none";
  const base = route.kind === "self" ? `self (${route.tier})` : `${route.family} (${route.tier})`;
  return route.pendingBundle ? `${base}; faces pending ${route.pendingBundle.prs.join(" and ")}` : base;
}

function bundledCell(rec) {
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
    `As of ${tracker.asOf}. Machine-readable source: [font-tracker.json](font-tracker.json). Authored inputs: [font-tracker.overrides.json](font-tracker.overrides.json). Program tracker: [burndown.md](burndown.md) (FF-40 to FF-46). Policy table: [font-licensing.md](font-licensing.md).`,
    "",
    "This is the per-font work list behind the owner's 2026-09-29 review. Each record holds the family's selected name, preview route and tier, the bundled face (package, version, hashes, styles), the styles it needs and lacks, scripts, per-style measurements, host and native verification, parity signals, phase, status, next action and evidence. Nothing here is a claim of per-family acceptance: every family still needs its own fixture and acceptance record.",
    "",
    "## Summary",
    "",
    `${summary.records} records: ${summary.inPolicy} policy families plus ${summary.records - summary.inPolicy} shipped script-font dependencies that the policy lacks. ${summary.bundled.yes} route to a face that opf-render bundles; ${summary.bundled.no} do not. ${summary.parityRerunNeeded} records were read by the committed parity run in a way that is stale against main (rerun needed).`,
    "",
    "| Status | Count | Severity | Meaning |",
    "| --- | --- | --- | --- |",
  );
  for (const status of STATUSES) push(`| \`${status}\` | ${summary.byStatus[status]} | ${tracker.statusDefinitions[status].severity} | ${cell(tracker.statusDefinitions[status].meaning)} |`);
  push("", "| Phase | Count | Owner's phase |", "| --- | --- | --- |");
  for (const phase of tracker.ownerPlan.phases) push(`| ${phase.phase} | ${summary.byPhase[phase.phase]} | ${cell(phase.title)} |`);
  push("", `Phase is the earliest owner phase with unfinished work for the family. Phase 5 (native verification and the full parity rerun) applies to every record: native verification is ${summary.nativeVerification.verified} verified, ${summary.nativeVerification.partial} partial, ${summary.nativeVerification.unverified} unverified.`);
  push("", "| Class | Count |", "| --- | --- |");
  for (const cls of CLASSES) push(`| ${cls} | ${summary.byClass[cls]} |`);
  push("", "| Host | Verified | Unverified | NA |", "| --- | --- | --- | --- |");
  for (const host of HOSTS) push(`| ${host} | ${summary.hostVerification[host].verified} | ${summary.hostVerification[host].unverified} | ${summary.hostVerification[host].NA} |`);
  push("", "`verified` means per-family evidence exists in a repository; `unverified` means a face is routed but no per-family acceptance exists; `NA` means no intended face exists to load in that host. Hosts: `node` (opf-render registries; the default `prepareNodeFonts` pack is `base`, Roboto only, and the office, open and script packs load only when requested), `browser` (opf-render browser registry), `editor` (the opf-editor playground), `galleryEditor` (the vendored opf-editor bundle inside pptx.gallery, 33 eager faces) and `galleryCards` (pptx.gallery's self-hosted preview webfonts for cards and pages, upright regular and bold only). Loading routes per host are in each record's `hostLoading`.");

  push("", "## Priority queue", "", `Priority: ${tracker.priorityFormula} The audited set is ${tracker.inputs.parity.values} gallery values (${tracker.inputs.parity.file.split("/").pop()}).`, "");
  push("| Rank | Family | Class | Phase | Status | Values | Score | Next action |", "| --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const rec of [...records].sort(byRank).slice(0, 15)) push(`| ${rec.priority.rank} | ${cell(rec.family)} | ${rec.class} | ${rec.phase} | \`${rec.status}\` | ${rec.priority.valuesAffected} | ${rec.priority.score} | ${cell(rec.nextAction)} |`);

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
  if (args.includes("--check")) {
    const { drift } = checkTracker();
    if (drift.length) {
      console.error(`Font tracker drift: ${drift.join(", ")}. Run node scripts/build-font-tracker.mjs and commit the result.`);
      process.exit(1);
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
