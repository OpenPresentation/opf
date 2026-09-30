// FF-31: accept or reject a metric-compatible replacement candidate (2026-09-29 owner policy).
//
// Compares candidate font files with the real proprietary faces on this host, per style:
//   - shaped advance widths over the FF-31 corpus (the same method as measure-font-replacements.mjs),
//   - vertical metrics (hhea, OS/2 typo and win, x-height and cap-height fields),
//   - outline identity, as aggregate counts only: a candidate whose outlines equal the proprietary
//     font's outlines is rejected (docs/programs/font-fidelity-everywhere/font-licensing.md),
//   - painted glyph heights (x-height and cap-height glyph boxes) and codepoint coverage.
// Reference fonts are read in place and never copied; the evidence keeps only version strings, file
// names, SHA-256 digests and aggregate numbers, never tables or outlines.
//
// node scripts/measure-font-candidates.mjs --intos <dir with the Intos TTFs> [--selawik <dir with selawk*.ttf>]
//   [--reference-dir <dir with Aptos Serif files>] [--packages <node_modules with fontkit>] [--out <file>]
// node scripts/measure-font-candidates.mjs --vendored <opf-render checkout> --families "Century Gothic,Trebuchet MS" [--out <file>]
//   FF-43: the faces opf-render actually ships (its pinned manifest, fonts/<name>) for the named policy rows, against the installed
//   originals: every reference style on the host, the shipped face drawn for it (nearest weight of the same slope, as the renderer picks),
//   with vertical metrics, painted glyph heights and outline identity counts. It never changes a tier: only the metric bar does.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const option = (name, fallback) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : fallback; };
const packages = path.resolve(option("--packages", path.join(root, "../opf-render/node_modules")));
const output = path.resolve(option("--out", path.join(root, "docs/evidence/font-replacements-20260923/metric-candidates-20260929.json")));
const fontkit = createRequire(path.join(packages, "noop.js"))("fontkit");
const corpus = JSON.parse(readFileSync(path.join(root, "docs/evidence/font-replacements-20260923/corpus.json"), "utf8"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const round = (value, digits = 4) => Math.round(value * 10 ** digits) / 10 ** digits;

const referenceDirs = [...args.flatMap((arg, index) => arg === "--reference-dir" ? [path.resolve(args[index + 1])] : []), process.env.WINDIR && path.join(process.env.WINDIR, "Fonts"), process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Microsoft/FontCache/4/CloudFonts")].filter((dir) => dir && existsSync(dir));
const walk = (dir) => readdirSync(dir).flatMap((name) => { const file = path.join(dir, name); return statSync(file).isDirectory() ? walk(file) : /\.(ttf|otf)$/i.test(name) ? [file] : []; });
const references = new Map();
for (const file of referenceDirs.flatMap(walk)) {
  let bytes, font;
  try { bytes = readFileSync(file); font = fontkit.create(bytes); } catch { continue; }
  if (!font?.layout || !font.unitsPerEm) continue;
  const weight = font["OS/2"]?.usWeightClass ?? 400, italic = Boolean(font["OS/2"]?.fsSelection?.italic || font.italicAngle);
  const legacy = font.familyName, preferred = font.getName?.("preferredFamily", "en") ?? legacy;
  for (const family of new Set([legacy, preferred])) {
    const key = `${family.toLowerCase()}|${weight}|${italic}`, previous = references.get(key), exact = family === legacy;
    // A face whose own family name matches wins over one that only shares the preferred name.
    if (!previous || (!previous.exact && exact)) references.set(key, { font, exact, file: path.basename(file), sha256: sha256(bytes), version: String(font.version ?? "") });
  }
}

const widthCache = new WeakMap();
function width(font, text) {
  let map = widthCache.get(font);
  if (!map) {
    map = new Map();
    widthCache.set(font, map);
  }
  if (!map.has(text)) {
    let value = NaN;
    try { if ([...text].every((c) => font.hasGlyphForCodePoint(c.codePointAt(0)))) value = font.layout(text).positions.reduce((sum, p) => sum + p.xAdvance, 0) / font.unitsPerEm; } catch { value = NaN; }
    map.set(text, value);
  }
  return map.get(text);
}
const vertical = (font) => {
  const os2 = font["OS/2"], hhea = font.hhea, unit = font.unitsPerEm;
  return { unitsPerEm: unit, hhea: [hhea.ascent, hhea.descent, hhea.lineGap].map((v) => round(v / unit)), typo: [os2.typoAscender, os2.typoDescender, os2.typoLineGap].map((v) => round(v / unit)), win: [os2.winAscent, os2.winDescent].map((v) => round(v / unit)), xHeight: round(os2.xHeight / unit), capHeight: round(os2.capHeight / unit), useTypoMetrics: Boolean(os2.fsSelection?.useTypoMetrics) };
};
const outlineSignature = (glyph) => glyph.path.commands.map((c) => c.command[0] + c.args.map(Math.round).join(",")).join(";");
function outlines(reference, candidate) {
  const common = [...reference.characterSet].filter((cp) => candidate.hasGlyphForCodePoint(cp));
  let nonempty = 0, identical = 0, identicalBeyondRectangles = 0;
  const deviations = [];
  for (const cp of common) {
    const a = reference.glyphForCodePoint(cp), b = candidate.glyphForCodePoint(cp);
    if (!a.path.commands.length || !b.path.commands.length) continue;
    nonempty++;
    // A plain rectangle (hyphen, dashes, minus, macron) is five path commands and is identical in any two fonts.
    if (outlineSignature(a) === outlineSignature(b)) { identical++; if (a.path.commands.length > 5) identicalBeyondRectangles++; }
    const [A, B] = [a.bbox, b.bbox];
    const deviation = Math.max(Math.abs(A.minX - B.minX), Math.abs(A.maxX - B.maxX), Math.abs(A.minY - B.minY), Math.abs(A.maxY - B.maxY)) / reference.unitsPerEm;
    if (Number.isFinite(deviation)) deviations.push(deviation);
  }
  deviations.sort((x, y) => x - y);
  const box = (font, character) => { const b = font.glyphForCodePoint(character.codePointAt(0)).bbox; return [round(b.minY / font.unitsPerEm, 3), round(b.maxY / font.unitsPerEm, 3)]; };
  return { referenceCodepoints: reference.characterSet.length, candidateCodepoints: candidate.characterSet.length, sharedNonemptyGlyphs: nonempty, identicalOutlines: identical, identicalBeyondPlainRectangles: identicalBeyondRectangles, glyphBoxDeviationEm: { median: round(deviations[deviations.length >> 1] ?? 0), p90: round(deviations[Math.floor(deviations.length * 0.9)] ?? 0) }, glyphBoxYRange: Object.fromEntries(["x", "H", "o", "p"].map((c) => [c, { reference: box(reference, c), candidate: box(candidate, c) }])) };
}

const STYLES = [[400, false, "Regular"], [700, false, "Bold"], [400, true, "Italic"], [700, true, "BoldItalic"]];
const results = [];
function compare({ reference, candidate, styles, candidateNote }) {
  const entry = { reference, candidate, ...(candidateNote ? { note: candidateNote } : {}), styles: [] };
  for (const { weight, italic, label, file, refWeight = weight, outline = label === "Regular", replacementWeight } of styles) {
    const ref = references.get(`${reference.toLowerCase()}|${refWeight}|${italic}`);
    if (!ref) { entry.styles.push({ style: label, skipped: "reference font not available on this host" }); continue; }
    if (!file || !existsSync(file)) { entry.styles.push({ style: label, skipped: "no candidate face for this style" }); continue; }
    const bytes = readFileSync(file), face = fontkit.create(bytes);
    const deltas = corpus.map((text) => { const a = width(ref.font, text), b = width(face, text); return Number.isFinite(a) && Number.isFinite(b) && a > 0 ? b / a - 1 : null; }).filter((v) => v !== null);
    const meanAbs = deltas.reduce((s, d) => s + Math.abs(d), 0) / deltas.length, maxAbs = Math.max(...deltas.map(Math.abs));
    const row = { style: label, strings: deltas.length, meanAbs: round(meanAbs), mean: round(deltas.reduce((s, d) => s + d, 0) / deltas.length), maxAbs: round(maxAbs), meetsMetricBar: meanAbs < 0.001 && maxAbs <= 0.003, reference: { file: ref.file, version: ref.version, sha256: ref.sha256 }, candidateFile: { name: path.basename(file), sha256: sha256(bytes) }, referenceVertical: vertical(ref.font), candidateVertical: vertical(face) };
    row.verticalMetricsEqual = JSON.stringify(row.referenceVertical) === JSON.stringify(row.candidateVertical);
    if (outline) row.outlines = outlines(ref.font, face);
    if (replacementWeight !== undefined) row.replacementWeight = replacementWeight;
    entry.styles.push(row);
  }
  results.push(entry);
}

const intosDir = option("--intos");
if (intosDir) {
  for (const [reference, prefix] of [["Aptos", "Intos"], ["Aptos Display", "IntosDisplay"], ["Aptos Narrow", "IntosNarrow"], ["Aptos Serif", "IntosSerif"]])
    compare({ reference, candidate: prefix.replace(/([a-z])([A-Z])/g, "$1 $2"), styles: STYLES.map(([weight, italic, label]) => ({ weight, italic, label, file: path.join(intosDir, `${prefix}-${label}.ttf`) })) });
  // Semibold is not bundled; measured to say whether it could be.
  compare({ reference: "Aptos SemiBold", candidate: "Intos Semibold", candidateNote: "Not bundled: OPF maps Aptos at 400 and 700.", styles: [{ weight: 600, italic: false, label: "Regular", file: path.join(intosDir, "Intos-Semibold.ttf") }, { weight: 600, italic: true, label: "Italic", file: path.join(intosDir, "Intos-SemiboldItalic.ttf") }] });
}
const vendoredDir = option("--vendored");
if (vendoredDir) {
  const renderRoot = path.resolve(vendoredDir), { BUNDLED_FONT_MANIFEST } = await import(pathToFileURL(path.join(renderRoot, "src/font-manifest.js")).href);
  const faces = BUNDLED_FONT_MANIFEST.packages.filter((pkg) => pkg.vendored).flatMap((pkg) => pkg.faces.map((face) => ({ ...face, file: path.join(renderRoot, pkg.vendored, face.file), package: pkg.name, version: pkg.version })));
  const policy = JSON.parse(readFileSync(path.join(root, "spec/reference/font-policy.json"), "utf8")), decisions = policy.provisionalDecisions?.decisions ?? {};
  const wanted = new Set(option("--families", "").split(",").map((name) => name.trim().toLowerCase()).filter(Boolean));
  for (const row of policy.families) {
    if (!wanted.has(row.family.toLowerCase())) continue;
    const replacement = row.replacement?.decision ? { ...row.replacement, family: decisions[row.replacement.decision].replacement } : row.replacement;
    // Reference styles the host has: the four standard ones, or whatever a weight-named family provides (Semibold, Light, Bookman 300/600).
    let refs = [[400, false], [700, false], [400, true], [700, true]].filter(([weight, italic]) => references.has(`${row.family.toLowerCase()}|${weight}|${italic}`)).map(([weight, italic]) => ({ weight, italic }));
    if (!refs.length) refs = [...references.keys()].filter((key) => key.startsWith(`${row.family.toLowerCase()}|`)).map((key) => { const [, weight, italic] = key.split("|"); return { weight: Number(weight), italic: italic === "true" }; });
    let first = true;
    const styles = refs.flatMap(({ weight, italic }) => {
      // The renderer requests 400 or 700 (the style link); a weight-named row draws its encoded weight.
      const target = replacement.weight ?? (weight >= 600 ? 700 : 400);
      const choices = faces.filter((face) => face.family === replacement.family && face.italic === italic).sort((a, b) => Math.abs(a.weight - target) - Math.abs(b.weight - target) || a.weight - b.weight);
      if (!choices.length) return [];
      const outline = first && !italic; if (outline) first = false;
      return [{ weight, refWeight: weight, italic, label: `${weight}${italic ? "i" : ""}`, file: choices[0].file, outline, replacementWeight: choices[0].weight }];
    });
    compare({ reference: row.family, candidate: replacement.family, candidateNote: `Shipped by opf-render (${[...new Set(faces.filter((face) => face.family === replacement.family).map((face) => `${face.package}@${/^[0-9a-f]{40}$/.test(face.version) ? face.version.slice(0, 12) : face.version}`))].join(", ")}); tier ${replacement.compatibility}.`, styles });
  }
}
const selawikDir = option("--selawik");
if (selawikDir) {
  const file = (name) => path.join(selawikDir, name);
  compare({ reference: "Segoe UI", candidate: "Selawik", candidateNote: "Selawik has no italic faces; the upright faces stand in.", styles: [{ weight: 400, italic: false, label: "Regular", file: file("selawk.ttf") }, { weight: 700, italic: false, label: "Bold", file: file("selawkb.ttf") }, { weight: 400, italic: true, label: "Italic", file: file("selawk.ttf") }, { weight: 700, italic: true, label: "BoldItalic", file: file("selawkb.ttf") }] });
  compare({ reference: "Segoe UI Light", candidate: "Selawik Light", styles: [{ weight: 300, italic: false, label: "Regular", file: file("selawkl.ttf") }] });
  compare({ reference: "Segoe UI Semilight", candidate: "Selawik Semilight", styles: [{ weight: 350, italic: false, label: "Regular", file: file("selawksl.ttf") }] });
  compare({ reference: "Segoe UI Semibold", candidate: "Selawik Semibold", styles: [{ weight: 600, italic: false, label: "Regular", file: file("selawksb.ttf") }] });
}
const report = { tool: `fontkit ${JSON.parse(readFileSync(path.join(packages, "fontkit/package.json"), "utf8")).version}`, corpus: { strings: corpus.length, bar: "mean < 0.1% and max <= 0.3% in every style" }, host: { platform: process.platform, node: process.version }, results };
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
for (const entry of results) for (const style of entry.styles) console.log(`${entry.reference} / ${entry.candidate} ${style.style}: ${style.skipped ?? `mean ${(style.meanAbs * 100).toFixed(3)}% max ${(style.maxAbs * 100).toFixed(3)}% bar ${style.meetsMetricBar ? "met" : "MISSED"} vertical ${style.verticalMetricsEqual ? "equal" : "differs"}${style.outlines ? ` identicalOutlines ${style.outlines.identicalOutlines} (${style.outlines.identicalBeyondPlainRectangles} beyond plain rectangles) of ${style.outlines.sharedNonemptyGlyphs}` : ""}`}`);
console.log(`Wrote ${path.relative(root, output)}.`);
