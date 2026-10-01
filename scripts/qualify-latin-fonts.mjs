// RR-17 (FF-42, FF-43): per-family metric qualification of the Latin preview replacements, with the owner's whole bar:
// per-style advance widths, line breaks, vertical metrics, outline identity and Latin coverage, measured against the real
// font on this host (or a directory of reference files) and through the renderer's own registry (the faces opf-render ships,
// resolved and measured exactly as a preview resolves and measures them, Georgia's liga/clig switch included).
//
//   node scripts/qualify-latin-fonts.mjs --render <opf-render checkout, built> [--reference-dir <dir>]... [--liberation-dir <dir>]
//        [--families "Garamond,Aptos Mono"] [--out <file>] [--check <file>]
//
// Reference fonts are read in place and never copied: the report keeps version strings, file names, SHA-256 digests and aggregate
// numbers, never tables or outlines. Families whose real font is not on the host are recorded `referenceAvailable: false`; the
// Microsoft 365 cloud fonts (Grandview, Tenorite, Seaford, Skeena) appear on a host once Office has cached them (the supervisor's
// native step), and a rerun of this script then measures them without copying them.
//
// Line breaks: 50 paragraphs of six corpus strings are wrapped greedily at five box widths (8, 11.5, 16, 22 and 30 em, the
// widths of the 3.2 in and 5.5 in columns at 20 pt and 18 pt and wider ones) from word advances and the space advance of each
// face (kerning across a space is not modelled; the real font and the replacement are treated the same way). A case matches when
// both wraps break at the same words.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, "..");
export const BOX_WIDTHS_EM = [8, 11.5, 16, 22, 30];
export const PARAGRAPH_SIZE = 6;
const round = (value, digits = 4) => Math.round(value * 10 ** digits) / 10 ** digits;
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

/** Greedy wrap of `text` on spaces: the line break positions as word counts per line. `widthOf(word)` and `space` are in em. */
export function wrapBreaks(text, widthOf, space, box) {
  const words = text.split(/ +/).filter(Boolean);
  const lines = [];
  let count = 0;
  let width = 0;
  for (const word of words) {
    const w = widthOf(word);
    if (count === 0) { count = 1; width = w; continue; }
    if (width + space + w <= box) { count += 1; width += space + w; } else { lines.push(count); count = 1; width = w; }
  }
  if (count) lines.push(count);
  return lines;
}

/** Group corpus strings into paragraphs of `size` strings joined by a space. */
export function paragraphsOf(corpus, size = PARAGRAPH_SIZE) {
  const out = [];
  for (let i = 0; i + size <= corpus.length; i += size) out.push(corpus.slice(i, i + size).join(" "));
  return out;
}

/** Compare the wraps of two faces: per box width, how many paragraphs break at the same words, and how many lines differ in total. */
export function compareBreaks(paragraphs, refWidth, refSpace, repWidth, repSpace, boxes = BOX_WIDTHS_EM) {
  const perWidth = [];
  let cases = 0;
  let identical = 0;
  for (const box of boxes) {
    let same = 0;
    let differing = 0;
    for (const paragraph of paragraphs) {
      const a = wrapBreaks(paragraph, refWidth, refSpace, box);
      const b = wrapBreaks(paragraph, repWidth, repSpace, box);
      cases += 1;
      if (a.length === b.length && a.every((n, i) => n === b[i])) { same += 1; identical += 1; } else differing += 1;
    }
    perWidth.push({ boxEm: box, paragraphs: paragraphs.length, identical: same, differing });
  }
  return { cases, identical, differing: cases - identical, identicalFraction: round(identical / cases, 4), perWidth };
}

const cliArgs = process.argv.slice(2);
const option = (name, fallback) => { const index = cliArgs.indexOf(name); return index >= 0 ? cliArgs[index + 1] : fallback; };
const multi = (name) => cliArgs.flatMap((arg, index) => (arg === name ? [path.resolve(cliArgs[index + 1])] : []));

const walk = (dir) => readdirSync(dir).flatMap((name) => { const file = path.join(dir, name); return statSync(file).isDirectory() ? walk(file) : /\.(ttf|otf|ttc)$/i.test(name) ? [file] : []; });

async function main() {
  const renderRoot = path.resolve(option("--render", path.join(ROOT, "../opf-render")));
  const out = path.resolve(option("--out", path.join(ROOT, "docs/evidence/font-replacements-20260923/latin-qualification-20261001.json")));
  const wanted = new Set(option("--families", "").split(",").map((name) => name.trim().toLowerCase()).filter(Boolean));
  const fontkit = createRequire(path.join(renderRoot, "package.json"))("fontkit");
  const fonts = await import(pathToFileURL(path.join(renderRoot, "dist/fonts-node.js")).href);
  const renderPackage = JSON.parse(readFileSync(path.join(renderRoot, "package.json"), "utf8"));
  const corpus = JSON.parse(readFileSync(path.join(ROOT, "docs/evidence/font-replacements-20260923/corpus.json"), "utf8"));
  const policy = JSON.parse(readFileSync(path.join(ROOT, "spec/reference/font-policy.json"), "utf8"));
  const overrides = JSON.parse(readFileSync(path.join(ROOT, "docs/programs/font-fidelity-everywhere/font-tracker.overrides.json"), "utf8"));
  const decisions = policy.provisionalDecisions?.decisions ?? {};
  const scriptOrSpecial = new Set([...overrides.classes.proprietaryScript, ...overrides.classes.special]);

  // Reference faces by preferred and legacy family, weight and italic.
  const dirs = [...multi("--reference-dir"), process.env.WINDIR && path.join(process.env.WINDIR, "Fonts"), process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Microsoft/FontCache/4/CloudFonts")].filter((dir) => dir && existsSync(dir));
  const references = new Map();
  for (const file of dirs.flatMap(walk)) {
    let bytes;
    let created;
    try { bytes = readFileSync(file); created = fontkit.create(bytes); } catch { continue; }
    for (const font of created.fonts ?? [created]) {
      if (!font?.layout || !font.unitsPerEm) continue;
      const weight = font["OS/2"]?.usWeightClass ?? 400;
      const italic = Boolean(font["OS/2"]?.fsSelection?.italic || font.italicAngle);
      const legacy = font.familyName;
      const preferred = font.getName?.("preferredFamily", "en") ?? legacy;
      const preferredSub = font.getName?.("preferredSubfamily", "en") ?? "Regular";
      // A face is indexed by its own (legacy) family name, and by its preferred family only when it is a plain style of it: the
      // Display faces of Aptos and Tenorite share the preferred family "Aptos"/"Tenorite" and must not stand in for a missing Bold.
      const names = new Set([legacy]);
      if (preferred !== legacy && /^(Regular|Bold|Italic|Bold Italic)$/.test(preferredSub)) names.add(preferred);
      for (const family of names) {
        const key = `${family.toLowerCase()}|${weight}|${italic}`;
        const previous = references.get(key);
        const exact = family === legacy;
        if (!previous || (!previous.exact && exact)) references.set(key, { font, exact, file: path.basename(file), sha256: sha256(bytes), version: String(font.version ?? "") });
      }
    }
  }

  // The renderer's own registry with every vendored face loaded, for resolution and measurement of the replacement.
  const { registry } = await fonts.prepareNodeFonts({ pack: "office", substitutionPolicy: "visual" });
  const manifest = fonts.BUNDLED_FONT_MANIFEST;
  const faceFile = (family, weight, italic) => {
    for (const pkg of manifest.packages) for (const face of pkg.faces) {
      if (face.family === family && face.weight === weight && Boolean(face.italic) === Boolean(italic)) return { file: path.join(renderRoot, pkg.vendored ?? path.join("node_modules", pkg.name), face.file), sha256: face.sha256, package: pkg.name };
    }
    return null;
  };
  const faceCache = new Map();
  const faceOf = (info) => {
    if (!faceCache.has(info.file)) faceCache.set(info.file, fontkit.create(readFileSync(info.file)));
    return faceCache.get(info.file);
  };

  const wordCache = new Map();
  const refAdvance = (key, font, text) => {
    const id = `${key}\u0000${text}`;
    if (!wordCache.has(id)) {
      let value = NaN;
      try { if ([...text].every((ch) => font.hasGlyphForCodePoint(ch.codePointAt(0)))) value = font.layout(text).positions.reduce((sum, p) => sum + p.xAdvance, 0) / font.unitsPerEm; } catch { value = NaN; }
      wordCache.set(id, value);
    }
    return wordCache.get(id);
  };
  const repAdvance = (style, text) => {
    const id = `rep\u0000${style.fontFamily}\u0000${style.fontWeight}\u0000${style.italic}\u0000${text}`;
    if (!wordCache.has(id)) {
      let value = NaN;
      try { value = registry.textMeasurement.measure(text, 1000, style) / 1000; } catch { value = NaN; }
      wordCache.set(id, value);
    }
    return wordCache.get(id);
  };

  const vertical = (font) => {
    const os2 = font["OS/2"];
    const unit = font.unitsPerEm;
    return {
      hhea: [font.hhea.ascent, font.hhea.descent, font.hhea.lineGap].map((v) => round(v / unit)),
      typo: [os2.typoAscender, os2.typoDescender, os2.typoLineGap].map((v) => round(v / unit)),
      win: [os2.winAscent, os2.winDescent].map((v) => round(v / unit)),
      xHeight: round(os2.xHeight / unit),
      capHeight: round(os2.capHeight / unit),
    };
  };
  const signature = (glyph) => glyph.path.commands.map((c) => c.command[0] + c.args.map(Math.round).join(",")).join(";");
  const outlineIdentity = (reference, candidate) => {
    const common = [...reference.characterSet].filter((cp) => candidate.hasGlyphForCodePoint(cp));
    let nonempty = 0;
    let identical = 0;
    let beyondRectangles = 0;
    for (const cp of common) {
      const a = reference.glyphForCodePoint(cp);
      const b = candidate.glyphForCodePoint(cp);
      if (!a.path.commands.length || !b.path.commands.length) continue;
      nonempty += 1;
      if (signature(a) === signature(b)) { identical += 1; if (a.path.commands.length > 5) beyondRectangles += 1; }
    }
    return { sharedNonemptyGlyphs: nonempty, identicalOutlines: identical, identicalBeyondPlainRectangles: beyondRectangles };
  };
  // Latin coverage: the reference code points in Basic Latin to Latin Extended-B, general punctuation and currency that the replacement lacks.
  const LATIN_RANGES = [[0x20, 0x24f], [0x2010, 0x2027], [0x2030, 0x203a], [0x20a0, 0x20bf], [0x2122, 0x2122], [0x2212, 0x2212]];
  const coverage = (reference, candidate) => {
    let have = 0;
    const missing = [];
    for (const [lo, hi] of LATIN_RANGES) for (let cp = lo; cp <= hi; cp += 1) {
      if (!reference.hasGlyphForCodePoint(cp)) continue;
      have += 1;
      if (!candidate.hasGlyphForCodePoint(cp)) missing.push(cp);
    }
    return { referenceLatinCodepoints: have, missingInReplacement: missing.length, missingSample: missing.slice(0, 12).map((cp) => `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`) };
  };

  const paragraphs = paragraphsOf(corpus);
  const STYLES = [[400, false], [700, false], [400, true], [700, true]];
  const styleLabel = (weight, italic) => `${weight}${italic ? "i" : ""}`;
  const liberationDir = option("--liberation-dir");
  const results = [];

  const rows = policy.families.filter((row) => row.replacement && !scriptOrSpecial.has(row.family) && (row.licenseClass !== "open" || ["Liberation Sans", "Liberation Serif", "Liberation Mono", "Source Sans Pro"].includes(row.family)));
  for (const row of rows) {
    if (wanted.size && !wanted.has(row.family.toLowerCase())) continue;
    const replacement = row.replacement.decision ? { ...row.replacement, family: decisions[row.replacement.decision].replacement, compatibility: decisions[row.replacement.decision].compatibility } : row.replacement;
    const entry = { family: row.family, licenseClass: row.licenseClass, route: replacement.family, tier: replacement.compatibility, referenceAvailable: false, styles: [] };

    // Reference styles: the four standard ones, or whatever the host provides for a weight-named family (Light, Semibold, Medium).
    let refs = STYLES.filter(([weight, italic]) => references.has(`${row.family.toLowerCase()}|${weight}|${italic}`)).map(([weight, italic]) => ({ weight, italic, face: references.get(`${row.family.toLowerCase()}|${weight}|${italic}`) }));
    if (!refs.length) refs = [...references.keys()].filter((key) => key.startsWith(`${row.family.toLowerCase()}|`)).map((key) => { const [, weight, italic] = key.split("|"); return { weight: Number(weight), italic: italic === "true", face: references.get(key) }; });
    // Liberation: the reference is the upstream Liberation 2.1.5 release (open font, read from --liberation-dir, never bundled).
    if (!refs.length && liberationDir && row.family.startsWith("Liberation ")) {
      const stem = row.family.replace(" ", "");
      refs = STYLES.flatMap(([weight, italic]) => {
        const file = path.join(liberationDir, `${stem}-${weight >= 700 ? "Bold" : ""}${italic ? "Italic" : ""}${weight < 700 && !italic ? "Regular" : ""}.ttf`);
        if (!existsSync(file)) return [];
        const bytes = readFileSync(file);
        return [{ weight, italic, face: { font: fontkit.create(bytes), file: path.basename(file), sha256: sha256(bytes), version: "Liberation 2.1.5" } }];
      });
    }
    if (!refs.length) { results.push(entry); continue; }
    entry.referenceAvailable = true;
    let first = true;
    for (const { weight, italic, face: ref } of refs) {
      // The renderer is asked for 400 or 700 (the style link); a weight-named row draws its encoded weight.
      const requested = weight >= 600 ? 700 : 400;
      let resolved;
      try { resolved = registry.resolveFont({ fontFamily: row.family, fontWeight: requested, italic }); } catch (error) { entry.styles.push({ style: styleLabel(weight, italic), error: error.code ?? String(error) }); continue; }
      const info = faceFile(resolved.resolvedFamily, resolved.resolvedWeight, resolved.italic);
      if (!info) { entry.styles.push({ style: styleLabel(weight, italic), error: `no manifest face for ${resolved.resolvedFamily} ${resolved.resolvedWeight}` }); continue; }
      const rep = faceOf(info);
      const style = { fontFamily: row.family, fontWeight: requested, italic };
      const refKey = `${ref.file}`;
      const deltas = [];
      for (const text of corpus) {
        const a = refAdvance(refKey, ref.font, text);
        const b = repAdvance(style, text);
        if (Number.isFinite(a) && Number.isFinite(b) && a > 0) deltas.push(b / a - 1);
      }
      const meanAbs = deltas.reduce((sum, d) => sum + Math.abs(d), 0) / deltas.length;
      const maxAbs = Math.max(...deltas.map(Math.abs));
      const wordWidthRef = (word) => refAdvance(refKey, ref.font, word);
      const wordWidthRep = (word) => repAdvance(style, word);
      const refSpace = refAdvance(refKey, ref.font, " ");
      const repSpace = repAdvance(style, " ");
      const breaks = compareBreaks(paragraphs, (w) => { const v = wordWidthRef(w); return Number.isFinite(v) ? v : wordWidthRep(w); }, refSpace, (w) => { const v = wordWidthRep(w); return Number.isFinite(v) ? v : wordWidthRef(w); }, repSpace);
      const refVertical = vertical(ref.font);
      const repVertical = vertical(rep);
      const record = {
        style: styleLabel(weight, italic),
        reference: { file: ref.file, version: ref.version, sha256: ref.sha256 },
        replacement: { family: resolved.resolvedFamily, weight: resolved.resolvedWeight, italic: resolved.italic, package: info.package, sha256: info.sha256 },
        strings: deltas.length,
        meanAbsWidthDelta: round(meanAbs),
        meanWidthDelta: round(deltas.reduce((sum, d) => sum + d, 0) / deltas.length),
        maxAbsWidthDelta: round(maxAbs),
        meetsWidthBar: meanAbs < 0.001 && maxAbs <= 0.003,
        lineBreaks: breaks,
        referenceVertical: refVertical,
        replacementVertical: repVertical,
        verticalMetricsEqual: JSON.stringify(refVertical) === JSON.stringify(repVertical),
        verticalFieldsDiffering: Object.keys(refVertical).filter((key) => JSON.stringify(refVertical[key]) !== JSON.stringify(repVertical[key])),
        xHeightRatio: refVertical.xHeight ? round(repVertical.xHeight / refVertical.xHeight, 3) : null,
        capHeightRatio: refVertical.capHeight ? round(repVertical.capHeight / refVertical.capHeight, 3) : null,
        ascentRatio: round(repVertical.hhea[0] / refVertical.hhea[0], 3),
      };
      if (first) { record.outlines = outlineIdentity(ref.font, rep); record.coverage = coverage(ref.font, rep); first = false; }
      entry.styles.push(record);
    }
    const ok = entry.styles.filter((style) => !style.error);
    const standard = STYLES.map(([weight, italic]) => styleLabel(weight, italic));
    entry.summary = {
      stylesMeasured: ok.length,
      standardStylesMeasured: standard.filter((label) => ok.some((style) => style.style === label)).length,
      meanAbsWidthDelta: round(ok.reduce((sum, s) => sum + s.meanAbsWidthDelta, 0) / (ok.length || 1)),
      meanWidthDelta: round(ok.reduce((sum, s) => sum + s.meanWidthDelta, 0) / (ok.length || 1)),
      worstStyleMeanAbsWidthDelta: round(Math.max(0, ...ok.map((s) => s.meanAbsWidthDelta))),
      maxAbsWidthDelta: round(Math.max(0, ...ok.map((s) => s.maxAbsWidthDelta))),
      widthBarMet: ok.length > 0 && ok.every((s) => s.meetsWidthBar),
      lineBreaksIdenticalFraction: ok.length ? round(Math.min(...ok.map((s) => s.lineBreaks.identicalFraction)), 4) : null,
      verticalMetricsEqual: ok.length > 0 && ok.every((s) => s.verticalMetricsEqual),
      xHeightRatio: ok[0]?.xHeightRatio ?? null,
      capHeightRatio: ok[0]?.capHeightRatio ?? null,
      ascentRatio: ok[0]?.ascentRatio ?? null,
      identicalOutlinesBeyondPlainRectangles: ok[0]?.outlines?.identicalBeyondPlainRectangles ?? null,
      latinCodepointsMissing: ok[0]?.coverage?.missingInReplacement ?? null,
    };
    results.push(entry);
  }

  const report = {
    tool: `scripts/qualify-latin-fonts.mjs (fontkit ${JSON.parse(readFileSync(path.join(renderRoot, "node_modules/fontkit/package.json"), "utf8")).version}, opf-render ${renderPackage.version})`,
    date: "2026-10-01",
    bar: "width: mean < 0.1% and max <= 0.3% in every measured style; line breaks identical in every case; vertical metrics (hhea, typo, win, x-height, cap-height) equal; original outlines",
    corpus: { strings: corpus.length, sha256: sha256(readFileSync(path.join(ROOT, "docs/evidence/font-replacements-20260923/corpus.json"))) },
    lineBreakModel: { paragraphs: paragraphs.length, stringsPerParagraph: PARAGRAPH_SIZE, boxWidthsEm: BOX_WIDTHS_EM, note: "greedy wrap on spaces from word and space advances; kerning across a space is not modelled" },
    host: { platform: process.platform, node: process.version, referenceDirs: dirs.map((dir) => path.basename(dir)) },
    results,
  };
  writeFileSync(out, `${JSON.stringify(report, null, 1)}\n`);
  for (const entry of results) {
    const s = entry.summary;
    console.log(`${entry.family} -> ${entry.route} (${entry.tier}): ${entry.referenceAvailable ? `styles ${s.stylesMeasured}, mean ${(s.meanAbsWidthDelta * 100).toFixed(2)}% max ${(s.maxAbsWidthDelta * 100).toFixed(2)}%, breaks ${(s.lineBreaksIdenticalFraction * 100).toFixed(1)}%, vertical ${s.verticalMetricsEqual ? "equal" : "differs"}` : "reference not available"}`);
  }
  console.log(`Wrote ${path.relative(ROOT, out)}.`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) await main();
