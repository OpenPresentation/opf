// The LibreOffice qualification's measurements and verdicts (docs/libreoffice.md, "What is a defect"). Pure functions over the
// PPTX model (pptx-model.mjs) and the PDF runs (pdf-model.mjs), so they are unit-tested without LibreOffice (checks.test.mjs).
import { slideWords, tokenize } from "./pptx-model.mjs";

// Right-to-left letters (Hebrew, Arabic, Syriac, Thaana, NKo and their presentation forms), built from code points.
const span = (from, to) => `${String.fromCodePoint(from)}-${String.fromCodePoint(to)}`;
const RTL = new RegExp(`[${span(0x0590, 0x08ff)}${span(0xfb1d, 0xfdff)}${span(0xfe70, 0xfefe)}]`, "u");
const LETTER = /\p{L}|\p{N}/u;
const fold = (value) => value.normalize("NFKC").toLocaleLowerCase("und");

/** Tolerances, in points. A run may pass its box or the slide by this much before it counts. */
export const TOLERANCE = Object.freeze({ horizontal: 1, slide: 0.5, verticalEm: 0.35 });

/** The share of an em a trailing space is assumed to take when a run's advance includes it (pdf.js reports the run's whole advance). */
const SPACE_EM = 0.25;

/** A run's ink extent estimate: its advance without trailing spaces. */
export function runExtent(run) {
  const trailing = run.str.length - run.str.trimEnd().length;
  const leading = run.str.length - run.str.trimStart().length;
  const right = run.x + Math.max(0, run.width - trailing * SPACE_EM * run.size);
  const left = run.x + leading * SPACE_EM * run.size;
  return { left, right, top: run.baseline - 0.8 * run.size, bottom: run.baseline + 0.25 * run.size };
}

const area = (box) => box.width * box.height;

/**
 * The shape a run belongs to: among the text-bearing shapes (text, table, chart) whose vertical span holds the run's baseline (with
 * tolerance), the smallest whose box holds the run's start, else the smallest it overlaps horizontally. null when none does.
 */
export function shapeForRun(run, shapes) {
  const extent = runExtent(run);
  const slack = TOLERANCE.verticalEm * run.size;
  const candidates = shapes.filter((shape) => shape.box && !shape.rotated && ["text", "table", "chart"].includes(shape.kind)
    && run.baseline >= shape.box.y - slack && run.baseline <= shape.box.y + shape.box.height + slack);
  const starts = candidates.filter((shape) => extent.left >= shape.box.x - TOLERANCE.horizontal && extent.left <= shape.box.x + shape.box.width);
  const overlaps = candidates.filter((shape) => extent.right > shape.box.x && extent.left < shape.box.x + shape.box.width);
  const pick = (list) => list.sort((left, right) => area(left.box) - area(right.box))[0] ?? null;
  return pick(starts) ?? pick(overlaps);
}

/**
 * Text containment on one page. Returns { runs, offSlide: [...], outsideBox: [...], unattributed: [...] }, each finding
 * {str, shape, side, by} with `by` the distance past the edge in points (rounded to 0.01).
 */
export function containment(page, slide, slideSize) {
  const offSlide = [], outsideBox = [], unattributed = [], atEdge = [];
  const round = (value) => Math.round(value * 100) / 100;
  for (const run of page.runs) {
    if (run.rotated) continue;
    const extent = runExtent(run);
    const sides = { left: -extent.left, right: extent.right - slideSize.width, top: -extent.top, bottom: extent.bottom - slideSize.height };
    for (const [side, by] of Object.entries(sides)) if (by > TOLERANCE.slide) offSlide.push({ str: run.str, side, by: round(by) });
    // LibreOffice's PDF export leaves out the glyphs past the page: a line cut there ends at the slide edge.
    if (Math.abs(sides.right) <= 1 || Math.abs(sides.left) <= 1) atEdge.push({ str: run.str, side: Math.abs(sides.right) <= 1 ? "right" : "left" });
    const shape = shapeForRun(run, slide.shapes);
    if (!shape) { unattributed.push({ str: run.str, x: round(run.x), baseline: round(run.baseline) }); continue; }
    // A wrapping body grows downward when a viewer breaks lines differently; only a single-line (wrap none) shape and a table cell are
    // held to their bottom edge here. Text below its box is reported separately as vertical growth.
    const box = shape.box;
    const past = { left: box.x - extent.left, right: extent.right - (box.x + box.width) };
    for (const [side, by] of Object.entries(past)) if (by > TOLERANCE.horizontal) outsideBox.push({ str: run.str, shape: shape.name || shape.id, kind: shape.kind, wrap: shape.body?.wrap ?? null, side, by: round(by) });
    const below = extent.bottom - (box.y + box.height) - TOLERANCE.verticalEm * run.size;
    if (below > 0 && shape.kind === "text") outsideBox.push({ str: run.str, shape: shape.name || shape.id, kind: shape.kind, wrap: shape.body?.wrap ?? null, side: "bottom", by: round(below) });
  }
  return { runs: page.runs.length, offSlide, outsideBox, unattributed, atEdge };
}

/**
 * The source words a text is missing. `words` are the required tokens; `text` is what a viewer kept. A token is found when its
 * occurrences in the whitespace-free text are at least its occurrences in `words` (a run split by the viewer still matches).
 */
export function missingWords(words, text) {
  // Case-folded and NFKC: a run drawn in capitals (cap="all", an eyebrow) or with presentation-form glyphs still matches.
  const haystack = fold(tokenize(text).join(""));
  const counts = new Map();
  const rtl = [];
  for (const word of words) {
    // A PDF's text layer gives right-to-left words as glyph clusters in visual order, split apart: they are compared as letters.
    if (RTL.test(word)) rtl.push(word);
    else counts.set(fold(word), (counts.get(fold(word)) ?? 0) + 1);
  }
  const missing = [];
  if (rtl.length) {
    const letters = (value) => [...fold(value)].filter((char) => LETTER.test(char)).reduce((map, char) => map.set(char, (map.get(char) ?? 0) + 1), new Map());
    const have = letters(text), need = letters(rtl.join(""));
    const short = [...need].filter(([char, count]) => (have.get(char) ?? 0) < count);
    if (short.length) missing.push({ word: rtl.join(" "), expected: need.size, found: need.size - short.length, letters: short.map(([char]) => char).join("") });
  }
  for (const [word, count] of counts) {
    let found = 0, index = 0;
    while (found < count && (index = haystack.indexOf(word, index)) !== -1) { found += 1; index += word.length; }
    if (found < count) missing.push({ word, expected: count, found });
  }
  return missing;
}

/** Words and explicit breaks per slide, for a round trip: [{words, breaks, paragraphs}]. */
export function slideStructure(model) {
  return model.slides.map((slide) => ({
    words: slideWords(slide),
    breaks: slide.shapes.reduce((sum, shape) => sum + shape.paragraphs.reduce((inner, paragraph) => inner + paragraph.breaks, 0), 0),
    textShapes: slide.shapes.filter((shape) => shape.kind === "text").length,
  }));
}

/** Compare a round trip's structure with the source's: [{slide, missing, extra, breaks: {source, roundTrip}}] for the slides that differ. */
export function compareStructure(source, roundTrip) {
  const findings = [];
  const length = Math.max(source.length, roundTrip.length);
  for (let index = 0; index < length; index += 1) {
    const before = source[index], after = roundTrip[index];
    if (!before || !after) { findings.push({ slide: index + 1, issue: before ? "slide-lost" : "slide-added" }); continue; }
    const missing = missingWords(before.words, after.words.join(" "));
    const extra = missingWords(after.words, before.words.join(" "));
    if (missing.length || extra.length || before.breaks !== after.breaks) findings.push({ slide: index + 1, missing, extra, breaks: { source: before.breaks, roundTrip: after.breaks } });
  }
  return findings;
}

/** Ink outside the page in a raster with a margin: { left, right, top, bottom } pixel counts, ignoring a `guard`-pixel band at the edge. */
export function inkOutside(raster, { guard = 2, threshold = 40 } = {}) {
  const { raw, width, height, channels, offset, pageWidth, pageHeight } = raster;
  const counts = { left: 0, right: 0, top: 0, bottom: 0 };
  if (!offset) return counts;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const px = x - offset, py = y - offset;
      let side = null;
      if (px < -guard) side = "left";
      else if (px >= pageWidth + guard) side = "right";
      else if (py < -guard) side = "top";
      else if (py >= pageHeight + guard) side = "bottom";
      if (!side) continue;
      const at = (y * width + x) * channels;
      if (255 - raw[at] > threshold || 255 - raw[at + 1] > threshold || 255 - raw[at + 2] > threshold) counts[side] += 1;
    }
  }
  return counts;
}

/** The sides on which a source shape reaches past the slide (a bleed the deck asked for), so ink there is not a finding. */
export function sourceBleeds(slide, slideSize) {
  const sides = new Set();
  for (const shape of slide.shapes) {
    if (!shape.box) continue;
    if (shape.box.x < -1) sides.add("left");
    if (shape.box.y < -1) sides.add("top");
    if (shape.box.x + shape.box.width > slideSize.width + 1) sides.add("right");
    if (shape.box.y + shape.box.height > slideSize.height + 1) sides.add("bottom");
  }
  return sides;
}

/**
 * The verdict of one case under one font profile. Defects: the file did not convert, a slide is missing, a source word is missing
 * from the rendered page or from LibreOffice's own re-export, an explicit break was lost, text crossed the slide edge, text left its
 * box sideways (or a single-line box at the bottom), or ink was drawn past the slide where the deck has no bleed. Everything else
 * that differs (the look of a substituted face, vertical growth of a wrapping body, a chart drawn in LibreOffice's style, the
 * difference from OPF's preview) is a documented difference, listed but not failing.
 */
export function verdict(result) {
  const defects = [], differences = [];
  if (!result.converted) defects.push({ check: "open", detail: result.conversionError ?? "LibreOffice produced no PDF" });
  else {
    if (result.pages !== result.slides) defects.push({ check: "slides", detail: `${result.pages} pages for ${result.slides} slides` });
    for (const slide of result.perSlide ?? []) {
      // pdf.js leaves out glyphs drawn past the page, so words pushed off the slide look missing: with a slide-edge finding they are
      // reported as clipped, not lost (the round trip shows whether the words themselves survive).
      const pastEdge = slide.offSlide?.length || slide.atEdge?.length || Object.entries(slide.inkOutside ?? {}).some(([side, count]) => count > 0 && !slide.bleeds?.includes(side));
      // Right-to-left text is compared as letters, and a PDF's text layer can drop the code points of contextual glyph forms, so a
      // letter shortfall there is a difference; LibreOffice's re-export (round trip, compared as exact words) decides whether text is lost.
      const rtlShort = (slide.missing ?? []).filter((entry) => entry.letters !== undefined && entry.found / entry.expected >= 0.75);
      const missing = (slide.missing ?? []).filter((entry) => !rtlShort.includes(entry));
      if (rtlShort.length) differences.push({ check: "rtl-text-layer", slide: slide.number, detail: `the PDF text layer lacks ${rtlShort.map((entry) => entry.letters).join("")} of the right-to-left letters` });
      if (missing.length) defects.push({ check: pastEdge ? "clipped" : "content", slide: slide.number, detail: `${pastEdge ? "not on the page (past the slide edge)" : "missing from the page"}: ${missing.map((entry) => entry.word).slice(0, 8).join(" ")}` });
      if (slide.offSlide?.length) defects.push({ check: "slide-edge", slide: slide.number, detail: slide.offSlide.slice(0, 4).map((entry) => `"${entry.str.trim().slice(-24)}" ${entry.side} +${entry.by} pt`).join("; ") });
      const sideways = (slide.outsideBox ?? []).filter((entry) => entry.side !== "bottom" || entry.wrap === "none");
      if (sideways.length) defects.push({ check: "text-box", slide: slide.number, detail: sideways.slice(0, 4).map((entry) => `"${entry.str.trim().slice(-24)}" ${entry.side} +${entry.by} pt`).join("; ") });
      const grown = (slide.outsideBox ?? []).filter((entry) => entry.side === "bottom" && entry.wrap !== "none");
      if (grown.length) differences.push({ check: "vertical-growth", slide: slide.number, detail: `${grown.length} run(s) below a wrapping box, up to ${Math.max(...grown.map((entry) => entry.by))} pt` });
      if (slide.unsupportedCharts) defects.push({ check: "chart-unsupported", slide: slide.number, detail: `${slide.unsupportedCharts} chart(s) drawn as LibreOffice's "unsupported chart type" placeholder, without their data` });
      if (slide.shrink) defects.push({ check: "shrink", slide: slide.number, detail: `${slide.shrink} text box(es) ask the viewer to shrink text on overflow (normAutofit)` });
      if (slide.smartArtMissing?.length) differences.push({ check: "smartart-fallback", slide: slide.number, detail: `SmartArt text not on the page: ${slide.smartArtMissing.map((entry) => entry.word).slice(0, 6).join(" ")}` });
      const ink = Object.entries(slide.inkOutside ?? {}).filter(([side, count]) => count > 0 && !slide.bleeds?.includes(side));
      if (ink.length) defects.push({ check: "ink-edge", slide: slide.number, detail: ink.map(([side, count]) => `${count} px ${side}`).join(", ") });
      if (slide.preview && slide.preview.largePercent > 5) differences.push({ check: "preview", slide: slide.number, detail: `${slide.preview.largePercent.toFixed(1)}% of pixels differ from OPF's preview` });
    }
    for (const finding of result.roundTrip?.findings ?? []) {
      if (finding.issue) defects.push({ check: "round-trip", slide: finding.slide, detail: finding.issue });
      else {
        if (finding.missing?.length) defects.push({ check: "round-trip", slide: finding.slide, detail: `lost in LibreOffice's re-export: ${finding.missing.map((entry) => entry.word).slice(0, 8).join(" ")}` });
        if (finding.breaks.source > finding.breaks.roundTrip) defects.push({ check: "round-trip", slide: finding.slide, detail: `explicit breaks ${finding.breaks.source} -> ${finding.breaks.roundTrip}` });
        if (finding.extra?.length || finding.breaks.source < finding.breaks.roundTrip) differences.push({ check: "round-trip", slide: finding.slide, detail: `re-export adds ${finding.extra?.map((entry) => entry.word).slice(0, 6).join(" ") || "breaks"}` });
      }
    }
    if (result.roundTrip && !result.roundTrip.converted) defects.push({ check: "round-trip", detail: "LibreOffice could not re-export the file as PPTX" });
    if (result.roundTrip?.import && !result.roundTrip.import.ok) differences.push({ check: "round-trip-import", detail: `OPF could not import LibreOffice's copy: ${result.roundTrip.import.error}` });
    const substituted = (result.fonts?.requested ?? []).filter((entry) => entry.resolution === "substituted");
    if (substituted.length) differences.push({ check: "fonts", detail: `not installed: ${substituted.map((entry) => entry.family).join(", ")}; LibreOffice drew ${(result.fonts.drawn ?? []).map((font) => font.name).join(", ") || "?"}` });
  }
  return { status: defects.length ? "fail" : "pass", defects, differences };
}
