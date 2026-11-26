import { FONT_POLICY } from "@openpresentation/opf/font-policy";
/** Curated substitution policy. Metric means upstream intent, not universal pixel identity. */
const metric = (requestedFamily, substitutes, source, note = "Standard regular, bold, italic and bold italic styles; verify coverage and font versions.") => ({requestedFamily, substitutes, compatibility:"metric", weights:[400,700], source, note});
const visual = (requestedFamily, substitutes, note = "Approximate appearance; measure again and expect reflow.") => ({requestedFamily, substitutes, compatibility:"visual", note});
// Rules before FF-31. Families that the OPF font policy table (core `FONT_POLICY`) lists take their
// rule from the table below; the remaining legacy rules keep working for other families.
const LEGACY = [
  metric("Calibri",["Carlito"],"https://github.com/googlefonts/carlito"),
  metric("Cambria",["Caladea"],"https://chromium.googlesource.com/external/fontconfig/+/refs/heads/main/conf.d/30-metric-aliases.conf","Fontconfig compatibility mapping; font-version and repertoire differences require verification."),
  metric("Arial",["Arimo","Liberation Sans"],"https://github.com/google/fonts/blob/main/ofl/arimo/DESCRIPTION.en_us.html"),
  metric("Times New Roman",["Tinos","Liberation Serif"],"https://github.com/google/fonts/blob/main/ofl/tinos/DESCRIPTION.en_us.html"),
  metric("Courier New",["Cousine","Liberation Mono"],"https://github.com/google/fonts/blob/main/apache/cousine/DESCRIPTION.en_us.html"),
  {...visual("Georgia",["Gelasio"],"Individual advances match the tested Georgia, but optional ligatures change shaped widths by up to 2.02% in our corpus. Treated as approximate until feature parity is supported."),source:"https://github.com/SorkinType/Gelasio"},
  metric("Arial Narrow",["Liberation Sans Narrow"],"https://github.com/liberationfonts/liberation-sans-narrow","Separate legacy distribution and license; not included in Liberation 2 or this bundle."),
  visual("Calibri Light",["Carlito"],"The bundled Carlito family has no Light face. This replacement is approximate."),
  visual("Aptos",["Source Sans 3","Carlito"]),
  visual("Aptos Display",["Source Sans 3","Carlito"]),
  visual("Aptos Narrow",["Liberation Sans Narrow"]),
  visual("Aptos Mono",["Cousine","Liberation Mono"]),
  visual("Segoe UI",["Open Sans","Noto Sans"]),
  visual("Tahoma",["Arimo","Noto Sans"]),
  visual("Verdana",["DejaVu Sans"]),
  visual("Trebuchet MS",["Ubuntu","Open Sans"]),
  visual("Century Gothic",["Montserrat","URW Gothic"]),
  visual("Franklin Gothic",["Libre Franklin"]),
  visual("Gill Sans",["Cabin","Lato"]),
  visual("Garamond",["EB Garamond"]),
  visual("Palatino Linotype",["TeX Gyre Pagella"]),
  visual("Book Antiqua",["TeX Gyre Pagella"]),
  visual("Bookman Old Style",["TeX Gyre Bonum"]),
  visual("Century Schoolbook",["TeX Gyre Schola"]),
  visual("Consolas",["Inconsolata","Cousine"]),
  visual("Lucida Console",["Liberation Mono","Cousine"]),
  visual("Lucida Sans Unicode",["Noto Sans","DejaVu Sans"]),
  visual("Impact",["Anton","Oswald"]),
  visual("Rockwell",["Arvo","Roboto Slab"]),
  visual("Baskerville",["Libre Baskerville"]),
  visual("Bodoni MT",["Libre Bodoni"]),
  visual("Didot",["GFS Didot"]),
  visual("Candara",["Lato"]),
  visual("Corbel",["Source Sans 3","Lato"]),
  visual("Constantia",["Merriweather"]),
  visual("Ebrima",["Noto Sans"]),
  visual("Microsoft Sans Serif",["Liberation Sans","Arimo"]),
  ...["MS Gothic","Meiryo","Yu Gothic"].map(name=>visual(name,["Noto Sans CJK JP"])),
  visual("SimSun",["Noto Serif CJK SC"]),
  ...["SimHei","Microsoft YaHei"].map(name=>visual(name,["Noto Sans CJK SC"])),
  visual("Malgun Gothic",["Noto Sans CJK KR"]),
  visual("Microsoft JhengHei",["Noto Sans CJK TC"]),
];
const percent = value => `${(value*100).toFixed(1)}%`;
const describe = replacement => replacement.measured
  ? `Measured against ${replacement.measured.reference}: mean width difference ${percent(replacement.measured.meanAbsWidthDelta)} (signed ${percent(replacement.measured.meanWidthDelta)}), max ${percent(replacement.measured.maxAbsWidthDelta)}.`
  : "Not measured against the real font.";
/**
 * FF-31: substitution rules from the OPF font policy table. Substitutes are the declared open
 * replacement, then its alternates; the last alternate is usually a face opf-render bundles, so a
 * preview never needs a download. Replacements drive measurement and drawing only; exporters keep
 * writing the chosen family.
 */
const FROM_POLICY = FONT_POLICY.families.filter(row => row.replacement).map(row => ({
  requestedFamily: row.family,
  substitutes: [row.replacement.family, ...(row.alternates ?? [])],
  compatibility: row.replacement.compatibility,
  ...(row.replacement.compatibility === "metric" ? {weights: [400, 700]} : {}),
  ...(row.replacement.weight ? {weight: row.replacement.weight} : {}),
  ...(row.replacement.disabledFeatures ? {disabledFeatures: row.replacement.disabledFeatures} : {}),
  ...(row.replacement.source ? {source: row.replacement.source} : {}),
  ...(row.replacement.measured ? {measured: row.replacement.measured} : {}),
  ...(row.replacement.decision ? {decision: row.replacement.decision} : {}),
  ...(row.replacement.metricModeFallback ? {metricModeFallback: true} : {}),
  licenseClass: row.licenseClass,
  note: row.replacement.compatibility === "metric"
    ? `Standard regular, bold, italic and bold italic styles. ${describe(row.replacement)}`
    : `Approximate appearance; expect reflow against the real font. ${describe(row.replacement)}`,
}));
const listed = new Set(FROM_POLICY.map(rule => rule.requestedFamily.toLowerCase()));
export const FONT_COMPATIBILITY = Object.freeze([...FROM_POLICY, ...LEGACY.filter(rule => !listed.has(rule.requestedFamily.toLowerCase()))].map(rule=>Object.freeze({...rule,substitutes:Object.freeze(rule.substitutes),...(rule.weights?{weights:Object.freeze(rule.weights)}:{}),...(rule.measured?{measured:Object.freeze({...rule.measured})}:{})})));
// FF-31: OpenType features a policy row turns off in its replacement face (Georgia -> Gelasio: liga, clig).
// The row's metric claim is measured that way, so the renderer must shape (fonts.js) and draw (svg.js)
// the face that way too. Keyed by the replacement family: a Georgia deck is measured and drawn with
// Gelasio, and Gelasio requested by name is treated identically, so measurement and drawing never disagree.
const DISABLED_FEATURES = new Map(FONT_POLICY.families.filter(row => row.replacement?.disabledFeatures?.length).map(row => [row.replacement.family.toLowerCase(), Object.freeze([...row.replacement.disabledFeatures])]));
/** OpenType feature tags to turn off for a preview face, from the font policy; undefined when none. */
export function disabledFeaturesFor(family) {
  return typeof family === "string" ? DISABLED_FEATURES.get(family.trim().toLowerCase()) : undefined;
}
/** CSS for SVG text drawn with a face whose features the policy turns off (`liga` and `clig` map to font-variant-ligatures), or undefined. */
export function disabledFeaturesStyle(family) {
  const tags = disabledFeaturesFor(family);
  if (!tags) return undefined;
  const ligatures = tags.some(tag => tag === "liga" || tag === "clig") ? "font-variant-ligatures:none;" : "";
  return `${ligatures}font-feature-settings:${tags.map(tag => `'${tag}' 0`).join(",")}`;
}
/**
 * Raster (resvg) ignores font-variant-ligatures and font-feature-settings, so it would still draw Gelasio's
 * fi/fl/ffi/ffl ligature glyphs. For SVG about to be rasterized only (never the emitted SVG), put a zero-width
 * non-joiner after each f that a ligature would join to the next letter, in text drawn with a face whose
 * policy row turns liga or clig off. ZWNJ has zero advance, so the glyphs follow the unligated measurement.
 */
export function separateLigatures(svg) {
  if (!DISABLED_FEATURES.size || !/<text[\s>]/.test(svg)) return svg;
  const tokens = /<(\/?)([A-Za-z][\w:.-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>|<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|[^<]+/g;
  const stack = [], ligatureFree = family => DISABLED_FEATURES.get(family)?.some(tag => tag === "liga" || tag === "clig") === true;
  return svg.replace(tokens, (token, close, name, attributes, selfClose) => {
    if (name === undefined) return stack.at(-1) ? token.replace(/f(?=[fil])/g, "f\u200C") : token;
    if (name !== "text" && name !== "tspan") return token;
    if (close) { stack.pop(); return token; }
    const declared = /\sfont-family\s*=\s*(?:"([^"]*)"|'([^']*)')/.exec(attributes);
    const family = declared ? (declared[1] ?? declared[2]).split(",")[0].trim().replace(/^['"]|['"]$/g, "").toLowerCase() : undefined;
    if (!selfClose) stack.push(family === undefined ? stack.at(-1) ?? false : ligatureFree(family));
    return token;
  });
}
// Candidates that were measured and did not qualify. Never bundled or selected automatically.
// Akasia (Aptos) was dropped: its repository is gone and Intos, pinned and measured identical to Aptos 2.01, replaces it.
export const EXPERIMENTAL_FONT_CANDIDATES = Object.freeze([Object.freeze({requestedFamily:"Segoe UI",substitute:"Selawik",source:"https://github.com/microsoft/Selawik/releases/tag/1.01",note:"Microsoft's OFL Segoe UI fallback, measured 2026-09-29 against Segoe UI 5.71: mean width difference 0.16% and up to 2.5% in regular, 2.65% in italic (no italic faces), 1.75% in Semibold, 349 code points, lowercase 5% shorter, hhea ascent 8% smaller. Fails the metric bar; not bundled. See docs/evidence/font-replacements-20260923/metric-candidates-20260929.json in core."})]);

// opf#1472: glyphs a bundled face draws wrongly. The vendored files stay byte for byte as upstream ships them, so a known bad glyph is
// recorded here instead, and the script-font planner (script-fonts.js) draws that one character from `replacement` (the first loaded
// family that has it) at the advance the bad face gave it. A row names the exact file (`sha256`, the one in the face's PROVENANCE.json):
// a fixed upstream release changes the hash, and test/glyph-defects.mjs fails until the row is removed.
const INTOS_BAD_DCROAT = Object.freeze({
  repository: "https://github.com/muglug/intos", commit: "fef9315c14da9e4b23b4c3cac8e718998d4e4736", release: "1.000",
  defect: "U+0111 (glyph dcroat) is a mirrored d with a bar to its right in the regular faces, and a d whose bar is drawn as broken blocks in the bold faces; the italic and serif faces draw it correctly",
  codePoints: Object.freeze([0x111]), replacement: Object.freeze(["Arimo", "Noto Sans", "Roboto"]), issue: "OpenPresentation/opf#1472"
});
const intosFace = (family, weight, file, sha256) => Object.freeze({family, weight, italic: false, file, sha256, ...INTOS_BAD_DCROAT});
export const GLYPH_DEFECTS = Object.freeze([
  intosFace("Intos", 400, "Intos-Regular.ttf", "4de204b6414d30f9f49b9375dc9b71ccea1683e55ac37de6c8d541abbc760eea"),
  intosFace("Intos", 700, "Intos-Bold.ttf", "8afd148fff67d6426d0d6906d4c6232886aedc81a7832544806e6c93c44340ab"),
  intosFace("Intos Display", 400, "IntosDisplay-Regular.ttf", "b652fdab5e8939540f084529a507ddd158629985b8eee1b553ef05c46d131877"),
  intosFace("Intos Display", 700, "IntosDisplay-Bold.ttf", "5055714a7215331b7786b10538138baa4dc969a8afe018bbf459f8b5395026d8"),
  intosFace("Intos Narrow", 400, "IntosNarrow-Regular.ttf", "ea91acdb933f2f1919df688f154140b851191adf4ecb77f7d931724198ea23c1"),
  intosFace("Intos Narrow", 700, "IntosNarrow-Bold.ttf", "59fd6e53b61ae483809ce1d8fc396357ec33d7beedef2e81f87da11551a99e51")
]);
/** The known bad glyphs of the face `family` at `weight` and `italic`: `{codePoints, replacement}`, or undefined. */
export function glyphDefectsFor(family, weight, italic) {
  const name = String(family).toLowerCase();
  return GLYPH_DEFECTS.find(row => row.family.toLowerCase() === name && row.weight === weight && row.italic === !!italic);
}
