// FF-31: measure each font-policy replacement against the real font it previews.
//
// Reference fonts are read in place from this host's font directories (Windows fonts and
// Microsoft 365 cloud fonts). They are never copied, embedded or committed; the report keeps
// only their version strings and SHA-256 digests. Replacement faces come from the pinned
// @expo-google-fonts packages installed next to opf-render (or --packages <node_modules>).
//
// node scripts/measure-font-replacements.mjs [--packages <dir>] [--out <report.json>] [--check | --explore]
//   --check    compare the measured values with spec/reference/font-policy.json and fail on drift.
//   --explore  rank every installed @expo-google-fonts package against each measurable family
//              (writes candidates.json next to the report); this is how replacements were chosen.
//              --only a,b limits the packages; --candidates-out names the output file.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const option = (name, fallback) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : fallback; };
const packages = path.resolve(option("--packages", path.join(root, "../opf-render/node_modules")));
const output = path.resolve(option("--out", path.join(root, "docs/evidence/font-replacements-20260923/report.json")));
const corpusFile = path.join(root, "docs/evidence/font-replacements-20260923/corpus.json");
const policy = JSON.parse(readFileSync(path.join(root, "spec/reference/font-policy.json"), "utf8"));
// Rows may take their replacement from a provisional owner decision; measure what renders today.
const decisions = policy.provisionalDecisions?.decisions ?? {};
for (const row of policy.families) if (row.replacement?.decision) Object.assign(row.replacement, { family: decisions[row.replacement.decision].replacement, compatibility: decisions[row.replacement.decision].compatibility });
const fontkit = createRequire(path.join(packages, "noop.js"))("fontkit");
const corpus = JSON.parse(readFileSync(corpusFile, "utf8"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

// Reference faces, indexed by preferred and legacy family name, weight and italic.
const referenceDirs = [process.env.WINDIR && path.join(process.env.WINDIR, "Fonts"), process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Microsoft/FontCache/4/CloudFonts"), "/Library/Fonts", "/System/Library/Fonts/Supplemental"].filter((dir) => dir && existsSync(dir));
const walk = (dir) => readdirSync(dir).flatMap((name) => { const file = path.join(dir, name); return statSync(file).isDirectory() ? walk(file) : /\.(ttf|otf|ttc)$/i.test(name) ? [file] : []; });
const faceInfo = (font) => ({ preferred: font.getName?.("preferredFamily", "en") ?? font.familyName, legacy: font.familyName, weight: font["OS/2"]?.usWeightClass ?? 400, italic: Boolean(font["OS/2"]?.fsSelection?.italic || font.italicAngle) });
const references = new Map();
for (const file of referenceDirs.flatMap(walk)) {
  let bytes, created;
  try { bytes = readFileSync(file); created = fontkit.create(bytes); } catch { continue; }
  for (const font of created.fonts ?? [created]) {
    if (!font?.layout || !font.unitsPerEm) continue;
    const info = faceInfo(font);
    for (const family of new Set([info.preferred, info.legacy])) {
      const key = `${family.toLowerCase()}|${info.weight}|${info.italic}`;
      // Prefer the normal-width face when a preferred family also has condensed/expanded faces.
      const width = font["OS/2"]?.usWidthClass ?? 5, previous = references.get(key);
      if (!previous || (previous.width !== 5 && width === 5)) references.set(key, { font, width, file: path.basename(file), sha256: sha256(bytes), version: String(font.version ?? "") });
    }
  }
}
// Replacement faces from the pinned packages: <package>/<weight><Style>[_Italic]/<file>.ttf.
const packageOf = (family) => `@expo-google-fonts/${family.toLowerCase().replace(/\s+/g, "-")}`;
const faceCache = new Map();
function replacementFace(family, weight, italic, pkg = packageOf(family)) {
  const id = `${pkg}|${weight}|${italic}`;
  if (!faceCache.has(id)) faceCache.set(id, loadReplacementFace(pkg, weight, italic));
  return faceCache.get(id);
}
function loadReplacementFace(pkg, weight, italic) {
  const dir = path.join(packages, pkg);
  if (!existsSync(dir)) return null;
  const choices = readdirSync(dir).map((name) => ({ name, match: name.match(/^(\d{3})[A-Za-z]*?(_Italic)?$/) })).filter((item) => item.match && Boolean(item.match[2]) === italic);
  choices.sort((a, b) => Math.abs(Number(a.match[1]) - weight) - Math.abs(Number(b.match[1]) - weight) || Number(a.match[1]) - Number(b.match[1]));
  if (!choices.length) return null;
  const faceDir = path.join(dir, choices[0].name), file = readdirSync(faceDir).find((name) => name.endsWith(".ttf"));
  const bytes = readFileSync(path.join(faceDir, file));
  return { font: fontkit.create(bytes), weight: Number(choices[0].match[1]), package: `${pkg}@${JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8")).version}`, file: `${choices[0].name}/${file}`, sha256: sha256(bytes) };
}
const cache = new WeakMap();
function width(font, text) {
  let map = cache.get(font);
  if (!map) {
    map = new Map();
    cache.set(font, map);
  }
  if (!map.has(text)) {
    let value = NaN;
    try { if ([...text].every((c) => font.hasGlyphForCodePoint(c.codePointAt(0)))) value = font.layout(text).positions.reduce((sum, p) => sum + p.xAdvance, 0) / font.unitsPerEm; } catch { value = NaN; }
    map.set(text, value);
  }
  return map.get(text);
}
const STYLES = [[400, false], [700, false], [400, true], [700, true]];
function measure(family, replacement, pkg) {
  // Reference styles: the four standard styles, or whatever the weight-named family provides.
  let refs = STYLES.map(([weight, italic]) => ({ weight, italic, ref: references.get(`${family.toLowerCase()}|${weight}|${italic}`) })).filter((item) => item.ref);
  if (!refs.length) refs = [...references.entries()].filter(([key]) => key.startsWith(`${family.toLowerCase()}|`)).map(([key, ref]) => { const [, weight, italic] = key.split("|"); return { weight: Number(weight), italic: italic === "true", ref }; });
  if (!refs.length) return { skipped: "reference font not available on this host" };
  const styles = [];
  for (const { weight, italic, ref } of refs) {
    // The renderer requests 400 or 700 (the style link); a weight-named family selects its encoded weight.
    const target = replacement.weight ?? (weight >= 600 ? 700 : 400);
    const face = replacementFace(replacement.family, target, italic, pkg);
    if (!face) continue;
    const deltas = corpus.map((text) => { const a = width(ref.font, text), b = width(face.font, text); return Number.isFinite(a) && Number.isFinite(b) && a > 0 ? b / a - 1 : null; }).filter((value) => value !== null);
    if (!deltas.length) continue;
    styles.push({ weight, italic, replacementWeight: face.weight, strings: deltas.length, meanAbs: deltas.reduce((s, d) => s + Math.abs(d), 0) / deltas.length, mean: deltas.reduce((s, d) => s + d, 0) / deltas.length, maxAbs: Math.max(...deltas.map(Math.abs)), reference: { file: ref.file, version: ref.version, sha256: ref.sha256 }, replacement: { package: face.package, file: face.file, sha256: face.sha256 } });
  }
  if (!styles.length) return { skipped: "replacement package not installed" };
  const round = (value) => Math.round(value * 10000) / 10000;
  return {
    meanAbsWidthDelta: round(styles.reduce((s, x) => s + x.meanAbs, 0) / styles.length),
    meanWidthDelta: round(styles.reduce((s, x) => s + x.mean, 0) / styles.length),
    maxAbsWidthDelta: round(Math.max(...styles.map((x) => x.maxAbs))),
    styles: styles.length,
    reference: `${family} ${[...new Set(styles.map((x) => x.reference.version.replace(/^Version /, "")))].join("/")}`,
    detail: styles.map((x) => ({ ...x, meanAbs: round(x.meanAbs), mean: round(x.mean), maxAbs: round(x.maxAbs) })),
  };
}

const results = [];
for (const row of policy.families) {
  if (!row.replacement || row.licenseClass === "open") continue;
  const result = measure(row.family, row.replacement);
  results.push({ family: row.family, replacement: row.replacement.family, compatibility: row.replacement.compatibility, ...(row.replacement.weight ? { weight: row.replacement.weight } : {}), ...result });
}
const report = { tool: `fontkit ${JSON.parse(readFileSync(path.join(packages, "fontkit/package.json"), "utf8")).version}`, corpus: { strings: corpus.length, sha256: sha256(readFileSync(corpusFile)) }, host: { platform: process.platform, node: process.version }, results };
if (args.includes("--explore")) {
  const only = option("--only", ""), names = readdirSync(path.join(packages, "@expo-google-fonts")).filter((name) => !only || only.split(",").includes(name));
  const ranking = [];
  for (const row of policy.families) {
    if (!row.replacement || row.licenseClass === "open") continue;
    const candidates = names.map((name) => ({ package: name, ...measure(row.family, { weight: row.replacement.weight }, `@expo-google-fonts/${name}`) })).filter((item) => !item.skipped);
    if (!candidates.length) continue;
    candidates.sort((a, b) => a.meanAbsWidthDelta - b.meanAbsWidthDelta);
    ranking.push({ family: row.family, chosen: row.replacement.family, top: candidates.slice(0, 10).map(({ detail, ...rest }) => rest) });
  }
  writeFileSync(path.join(path.dirname(output), option("--candidates-out", "candidates.json")), JSON.stringify({ tool: report.tool, corpus: report.corpus, packages: names.length, ranking }, null, 2) + "\n");
  console.log(`Ranked ${names.length} packages for ${ranking.length} families.`);
} else if (args.includes("--check")) {
  const drift = [];
  for (const result of results) {
    const expected = policy.families.find((row) => row.family === result.family).replacement.measured;
    if (result.skipped) continue;
    if (!expected) { drift.push(`${result.family}: measured here but the policy records null`); continue; }
    if (expected.replacement !== result.replacement) { drift.push(`${result.family}: policy measured ${expected.replacement}, the replacement is now ${result.replacement}`); continue; }
    for (const key of ["meanAbsWidthDelta", "meanWidthDelta", "maxAbsWidthDelta", "styles"]) if (Math.abs(result[key] - expected[key]) > 1e-4) drift.push(`${result.family} ${key}: policy ${expected[key]}, measured ${result[key]}`);
  }
  assert.deepEqual(drift, [], "font-policy.json measured values drifted from this host's measurement");
  console.log(`Font replacement measurements match the policy for ${results.filter((r) => !r.skipped).length} families (${results.filter((r) => r.skipped).length} skipped on this host).`);
} else {
  writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(`Measured ${results.filter((r) => !r.skipped).length} replacements; ${results.filter((r) => r.skipped).length} skipped. Wrote ${path.relative(root, output)}.`);
}
