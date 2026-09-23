import { FONT_POLICY } from "./font-policy.js";
/** Curated substitution policy. Metric means upstream intent, not universal pixel identity. */
const metric = (requestedFamily, substitutes, source, note = "Standard regular, bold, italic and bold italic styles; verify coverage and font versions.") => ({requestedFamily, substitutes, compatibility:"metric", weights:[400,700], source, note});
const visual = (requestedFamily, substitutes, note = "Approximate appearance; measure again and expect reflow.") => ({requestedFamily, substitutes, compatibility:"visual", note});
// Rules before FF-31. Families that the OPF font policy table (src/font-policy.js) lists take their
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
const FROM_POLICY = FONT_POLICY.filter(row => row.replacement).map(row => ({
  requestedFamily: row.family,
  substitutes: [row.replacement.family, ...(row.alternates ?? [])],
  compatibility: row.replacement.compatibility,
  ...(row.replacement.compatibility === "metric" ? {weights: [400, 700]} : {}),
  ...(row.replacement.weight ? {weight: row.replacement.weight} : {}),
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
export const EXPERIMENTAL_FONT_CANDIDATES = Object.freeze([Object.freeze({requestedFamily:"Aptos",substitute:"Akasia",source:"https://codeberg.org/bloudraad/akasia",note:"Upstream claims metric compatibility in twelve styles. Not bundled or automatically selected; OPF conformance testing is pending. No Narrow or Display compatibility is implied."})]);
