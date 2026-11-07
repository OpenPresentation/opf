// Grade the release qualification manifest's features (scripts/native-acceptance/qualification/manifest.json) from the LibreOffice
// results, check by check, so the LibreOffice table lines up with the PowerPoint and Keynote tables of the same release.
// LibreOffice has no object model the runner drives, so the checks are read from what it rendered and what it saved:
//   opens, slides           the conversion and the page count
//   noOverflow              no text past its box or the slide, no ink past the slide (checks.mjs)
//   noShrink                no text box in the file asks for shrink on overflow
//   visual                  the pixel difference from OPF's preview, for a reviewer (never decides)
//   smartArt, footer        not gradable here (LibreOffice draws SmartArt from its fallback drawing; footers need the app's dialog)
//   fallback                the SmartArt node text is on the rendered page
//   noSmartArt              the file has no SmartArt on those slides
//   nativeChart, nativeTable, connectors, shapes   LibreOffice's own saved copy still has them as native objects
//   roundtrip               OPF's import reads LibreOffice's saved copy
// Every feature also gets `content`: every word on the page and in the saved copy.

const OVERFLOW = new Set(["slide-edge", "text-box", "clipped", "ink-edge"]);
const CONTENT = new Set(["content", "round-trip", "chart-unsupported"]);

const sum = (list, key) => list.reduce((total, counts) => total + (counts?.[key] ?? 0), 0);

/** Grade one feature against the full result of its case (opf profile). Returns {status, checks: {name: {status, detail}}}. */
export function gradeFeature(feature, result, scope) {
  const checks = {};
  const wanted = feature.slides ?? (result?.perSlide ?? []).map((slide, index) => index + 1);
  const slides = (result?.perSlide ?? []).filter((_, index) => wanted.includes(index + 1));
  const defectsOn = (kinds) => (result?.defects ?? []).filter((defect) => kinds.has(defect.check) && (defect.slide === undefined || wanted.includes(defect.slide)));
  const roundKinds = (result?.roundTrip?.kinds ?? []).filter((_, index) => wanted.includes(index + 1));
  const sourceKinds = slides.map((slide) => slide.kinds);
  const kept = (kind) => {
    const before = sum(sourceKinds, kind), after = sum(roundKinds, kind);
    if (!before) return { status: "fail", detail: `the file has no ${kind} on these slides` };
    return after >= before ? { status: "pass", detail: `${after} of ${before} kept native` } : { status: "fail", detail: `${after} of ${before} kept native` };
  };
  for (const check of feature.checks ?? []) {
    if (!result?.converted && check !== "footer" && check !== "smartArt") { checks[check] = { status: "fail", detail: "did not convert" }; continue; }
    if (check === "opens") checks.opens = { status: "pass", detail: "converted headless" };
    else if (check === "slides") checks.slides = result.pages === result.slides ? { status: "pass", detail: `${result.pages} pages` } : { status: "fail", detail: `${result.pages} pages for ${result.slides} slides` };
    else if (check === "noOverflow") {
      const found = defectsOn(OVERFLOW);
      checks.noOverflow = found.length ? { status: "fail", detail: found.slice(0, 3).map((defect) => `slide ${defect.slide}: ${defect.detail}`).join("; ") } : { status: "pass" };
    } else if (check === "noShrink") {
      const count = slides.reduce((total, slide) => total + (slide.shrink ?? 0), 0);
      checks.noShrink = count ? { status: "fail", detail: `${count} shrink-on-overflow text box(es)` } : { status: "pass" };
    } else if (check === "visual") {
      const worst = Math.max(0, ...slides.map((slide) => slide.preview?.largePercent ?? 0));
      checks.visual = { status: "review", detail: `up to ${worst.toFixed(1)}% of pixels differ from the preview` };
    } else if (check === "smartArt") checks.smartArt = { status: "n/a", detail: "LibreOffice does not lay SmartArt out; it draws the fallback drawing" };
    else if (check === "footer") checks.footer = { status: "n/a", detail: "needs the app's Header and Footer dialog" };
    else if (check === "fallback") {
      const missing = slides.flatMap((slide) => slide.smartArtMissing ?? []);
      const withSmartArt = slides.filter((slide) => slide.kinds?.smartart).length;
      checks.fallback = !withSmartArt ? { status: "n/a", detail: "no SmartArt on these slides" } : missing.length ? { status: "fail", detail: `node text not drawn: ${missing.map((entry) => entry.word).slice(0, 5).join(" ")}` } : { status: "pass", detail: `node text drawn on ${withSmartArt} slide(s)` };
    } else if (check === "noSmartArt") checks.noSmartArt = sum(sourceKinds, "smartart") ? { status: "fail", detail: "the file has SmartArt here" } : { status: "pass" };
    else if (check === "nativeChart") checks.nativeChart = kept("chart");
    else if (check === "nativeTable") checks.nativeTable = kept("table");
    else if (check === "connectors") checks.connectors = kept("connector");
    else if (check === "shapes") {
      const before = sum(sourceKinds, "text") + sum(sourceKinds, "other"), after = sum(roundKinds, "text") + sum(roundKinds, "other");
      checks.shapes = after >= before * 0.9 ? { status: "pass", detail: `${after} of ${before} shapes in LibreOffice's copy` } : { status: "fail", detail: `${after} of ${before} shapes in LibreOffice's copy` };
    } else if (check === "roundtrip") {
      const imported = result.roundTrip?.import;
      checks.roundtrip = imported?.ok ? { status: "pass", detail: `OPF imports LibreOffice's copy (${imported.slides} slides)` } : { status: "fail", detail: imported?.error ?? "LibreOffice did not save a copy" };
    } else checks[check] = { status: "n/a", detail: "not gradable in LibreOffice" };
  }
  if (result?.converted && feature.checks?.length) {
    const lost = defectsOn(CONTENT);
    checks.content = lost.length ? { status: "fail", detail: lost.slice(0, 2).map((defect) => `slide ${defect.slide ?? "?"}: ${defect.detail}`).join("; ") } : { status: "pass" };
  }
  const failing = Object.entries(checks).filter(([, value]) => value.status === "fail").map(([name]) => name);
  const status = !feature.checks?.length ? "n/a" : failing.length ? (scope === "advanced" ? "known difference" : "fail") : "pass";
  return { status, failing, checks };
}

/** Grade every feature: [{id, title, deck, variant, case, scope, status, failing, checks}]. `results` maps a case id to its full result. */
export function gradeFeatures(manifest, results, scopes) {
  return manifest.features.map((feature) => {
    const caseId = `q-${feature.deck}${feature.variant && feature.variant !== "default" ? `~${feature.variant}` : ""}`;
    const result = results.get(caseId);
    const graded = result ? gradeFeature(feature, result, scopes.get(caseId)) : { status: "not run", failing: [], checks: {} };
    return { id: feature.id, title: feature.title, deck: feature.deck, variant: feature.variant ?? "default", case: caseId, scope: scopes.get(caseId) ?? null, ...graded };
  });
}

export function featuresMarkdown(rows) {
  const lines = ["| Feature | Deck | LibreOffice | Checks |", "| --- | --- | --- | --- |"];
  for (const row of rows) {
    const checks = Object.entries(row.checks).map(([name, value]) => `${name} ${value.status === "pass" ? "ok" : value.status}`).join(", ");
    lines.push(`| ${row.id} | ${row.deck}${row.variant === "default" ? "" : ` (${row.variant})`} | ${row.status === "fail" ? "**fail**" : row.status} | ${checks || "-"} |`);
  }
  return `${lines.join("\n")}\n`;
}
