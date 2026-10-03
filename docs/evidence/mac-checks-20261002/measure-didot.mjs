// RR-17 (Didot): the Apple-only Didot against the replacement the font policy routes it to (Playfair Display, tier visual).
// Reads Didot in place (never copied; only version, file name, SHA-256 and aggregate numbers are kept) and measures it three
// ways beyond scripts/qualify-latin-fonts.mjs: the spread of the width ratio, the line breaks a width-matched Playfair would give
// (what a preview-only size adjust could reach), and the nearest bundled face by width.
//
//   node measure-didot.mjs --render <opf-render package root, built> --didot <Didot.ttc> [--out <file>]
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const here = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(here, "../../..");
const renderRoot = path.resolve(option("--render", "../opf-render"));
const didotFile = path.resolve(option("--didot", "/System/Library/Fonts/Supplemental/Didot.ttc"));
const out = path.resolve(option("--out", path.join(here, "didot-measurements-20261002.json")));
const fontkit = createRequire(path.join(renderRoot, "package.json"))("fontkit");
const { compareBreaks, paragraphsOf, BOX_WIDTHS_EM } = await import(pathToFileURL(path.join(ROOT, "scripts/qualify-latin-fonts.mjs")).href);
const fonts = await import(pathToFileURL(path.join(renderRoot, "dist/fonts-node.js")).href);
const corpus = JSON.parse(readFileSync(path.join(ROOT, "docs/evidence/font-replacements-20260923/corpus.json"), "utf8"));
const round = (v, d = 4) => Math.round(v * 10 ** d) / 10 ** d;
const sha256 = (b) => createHash("sha256").update(b).digest("hex");

const bytes = readFileSync(didotFile);
const collection = fontkit.create(bytes);
const didot = new Map();
for (const font of collection.fonts) {
  const weight = font["OS/2"].usWeightClass;
  const italic = Boolean(font["OS/2"].fsSelection?.italic || font.italicAngle);
  didot.set(`${weight >= 600 ? 700 : 400}${italic ? "i" : ""}`, { font, postscript: font.postscriptName, full: font.fullName, version: String(font.version) });
}
const manifest = fonts.BUNDLED_FONT_MANIFEST;
const bundled = [];
for (const pkg of manifest.packages) for (const face of pkg.faces) {
  const file = path.join(renderRoot, pkg.vendored ?? path.join("node_modules", pkg.name), face.file);
  bundled.push({ family: face.family, weight: face.weight, italic: Boolean(face.italic), file });
}
const cache = new Map();
const load = (file) => { if (!cache.has(file)) cache.set(file, fontkit.create(readFileSync(file))); return cache.get(file); };
const face = (family, weight, italic) => bundled.find((f) => f.family === family && f.weight === weight && f.italic === italic);
const adv = (font, text) => {
  try { if ([...text].every((ch) => font.hasGlyphForCodePoint(ch.codePointAt(0)))) return font.layout(text).positions.reduce((s, p) => s + p.xAdvance, 0) / font.unitsPerEm; } catch {}
  return NaN;
};
const stats = (values) => {
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const sd = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
  const sorted = [...values].sort((a, b) => a - b);
  return { mean: round(mean), stdev: round(sd), min: round(sorted[0]), p05: round(sorted[Math.floor(sorted.length * 0.05)]), p95: round(sorted[Math.floor(sorted.length * 0.95)]), max: round(sorted.at(-1)) };
};
const paragraphs = paragraphsOf(corpus);
const lineHeight = (font) => round((font.hhea.ascent - font.hhea.descent + font.hhea.lineGap) / font.unitsPerEm);

const styles = [];
for (const [label, weight, italic] of [["400", 400, false], ["700", 700, false], ["400i", 400, true], ["700i", 700, true]]) {
  const ref = didot.get(label);
  if (!ref) { styles.push({ style: label, referenceFace: null, note: "Didot ships no such face on macOS; PowerPoint draws a synthesized slant and weight, the preview draws the Playfair face." }); continue; }
  const rep = load(face("Playfair Display", weight, italic).file);
  const ratios = [];
  for (const text of corpus) { const a = adv(ref.font, text); const b = adv(rep, text); if (Number.isFinite(a) && Number.isFinite(b) && a > 0) ratios.push(b / a); }
  const stat = stats(ratios);
  const k = 1 / stat.mean; // the em scale that makes Playfair's mean advance equal Didot's
  const refSpace = adv(ref.font, " ");
  const repSpace = adv(rep, " ") * k;
  const wrapped = (scale) => compareBreaks(paragraphs, (w) => { const v = adv(ref.font, w); return Number.isFinite(v) ? v : adv(rep, w) * k; }, refSpace, (w) => { const v = adv(rep, w) * scale; return Number.isFinite(v) ? v : adv(ref.font, w); }, adv(rep, " ") * scale);
  const plain = wrapped(1);
  const matched = wrapped(k);
  styles.push({
    style: label,
    reference: { file: path.basename(didotFile), postscript: ref.postscript, version: ref.version },
    replacement: { family: "Playfair Display", weight, italic },
    widthRatioReplacementOverReference: stat,
    lineBreaksAsRouted: { cases: plain.cases, identical: plain.identical, identicalFraction: plain.identicalFraction, perWidth: plain.perWidth },
    lineBreaksIfWidthMatched: { scale: round(k), cases: matched.cases, identical: matched.identical, identicalFraction: matched.identicalFraction, perWidth: matched.perWidth },
    hheaLineHeight: { reference: lineHeight(ref.font), replacement: lineHeight(rep), ratio: round(lineHeight(rep) / lineHeight(ref.font), 3) },
    unitsPerEm: { reference: ref.font.unitsPerEm, replacement: rep.unitsPerEm },
  });
}

// The nearest bundled face by Regular width, a hint for the policy owner only (no routing change here).
const regular = didot.get("400").font;
const ranking = [];
for (const f of bundled.filter((x) => x.weight === 400 && !x.italic)) {
  let font; try { font = load(f.file); } catch { continue; }
  const deltas = corpus.map((t) => { const a = adv(regular, t); const b = adv(font, t); return Number.isFinite(a) && Number.isFinite(b) && a > 0 ? b / a - 1 : NaN; }).filter(Number.isFinite);
  if (deltas.length < corpus.length * 0.9) continue;
  const refSpace = adv(regular, " ");
  const breaks = compareBreaks(paragraphs, (w) => { const v = adv(regular, w); return Number.isFinite(v) ? v : adv(font, w); }, refSpace, (w) => { const v = adv(font, w); return Number.isFinite(v) ? v : adv(regular, w); }, adv(font, " "));
  ranking.push({ family: f.family, strings: deltas.length, lineBreaksIdenticalFraction: breaks.identicalFraction, meanAbsWidthDelta: round(deltas.reduce((s, d) => s + Math.abs(d), 0) / deltas.length), meanWidthDelta: round(deltas.reduce((s, d) => s + d, 0) / deltas.length) });
}
ranking.sort((a, b) => a.meanAbsWidthDelta - b.meanAbsWidthDelta);

const report = {
  tool: "docs/evidence/mac-checks-20261002/measure-didot.mjs",
  date: "2026-10-02",
  host: { platform: process.platform, arch: process.arch, node: process.version, macos: option("--macos", "") },
  referenceFile: { name: path.basename(didotFile), sha256: sha256(bytes), faces: [...didot.keys()] },
  corpus: { strings: corpus.length, paragraphs: paragraphs.length, boxWidthsEm: BOX_WIDTHS_EM },
  styles,
  nearestBundledRegularByWidth: ranking.slice(0, 8),
  playfairRank: ranking.findIndex((r) => r.family === "Playfair Display") + 1,
};
writeFileSync(out, `${JSON.stringify(report, null, 1)}\n`);
for (const s of styles.filter((x) => x.reference)) console.log(s.style, "ratio", s.widthRatioReplacementOverReference, "breaks", s.lineBreaksAsRouted.identicalFraction, "->matched", s.lineBreaksIfWidthMatched.identicalFraction, "lh", s.hheaLineHeight.ratio);
console.log(ranking.slice(0, 6), "playfair rank", report.playfairRank, "of", ranking.length);
