// LH-28: Office-safe typefaces. `toPptx(deck, {typefaces: 'safe'})` writes each Latin text family as a family that PowerPoint,
// Keynote and LibreOffice find on every Windows and macOS machine and that OPF measures exactly, and lays the text out with that
// family, so the line breaks a viewer draws are the ones the export measured. The default (`'selected'`) writes the families
// the deck chose (the font policy, docs/font-fidelity.md); `typefacesNotOfficeSafe` lists what such a viewer may substitute.
//
// The safe set comes from the font policy table (spec/reference/font-policy.json), not from a list written here: a family is
// Office-safe when it ships with both Windows and macOS (availability `windows` and `macos`) and has a metric-compatible open
// replacement, so the renderer measures it with that replacement's identical advances. Today that is Arial (Arimo), Courier
// New (Cousine), Georgia (Gelasio) and Times New Roman (Tinos). Verdana, Tahoma and the other system fonts are installed
// everywhere too, but OPF only has visual look-alikes for them, so their measured breaks would not be PowerPoint's.
import {FONT_POLICY, fontPolicyFor} from '@openpresentation/opf';
import {isMonospaceFamily} from './import-signals.js';

const key = family => String(family).trim().toLowerCase();

/** Office-safe families, by lower-case name: the policy rows on Windows and macOS with a metric open replacement. */
const SAFE = new Map(FONT_POLICY.families
  .filter(row => row.availability.includes('windows') && row.availability.includes('macos') && row.replacement?.compatibility === 'metric')
  .map(row => [key(row.family), row]));
export const OFFICE_SAFE_TYPEFACES = Object.freeze([...SAFE.values()].map(row => row.family).sort());

// The safe family for each class of design. Georgia over Times New Roman: both are on every machine, and Georgia is the
// screen serif. Each must be in the derived safe set (test/safe-typefaces.mjs checks it).
export const SAFE_TYPEFACE_FOR_CLASS = Object.freeze({'sans-serif': 'Arial', serif: 'Georgia', monospace: 'Courier New'});

// An open family that is the metric replacement (or an alternate) of a safe family is that family: Arimo and Liberation
// Sans are Arial, Tinos and Liberation Serif Times New Roman, Cousine and Liberation Mono Courier New, Gelasio Georgia.
// Writing the safe name then changes no line break at all.
const METRIC_TWIN = new Map();
for (const row of SAFE.values()) for (const twin of [row.replacement.family, ...(row.alternates ?? [])]) if (typeof twin === 'string') METRIC_TWIN.set(key(twin), row.family);

const SPECIAL = /\b(?:emoji|math|symbol|wingdings|webdings|dingbats)\b/i;
// A script face (Noto Sans JP, Noto Naskh Arabic, Noto Serif Hebrew) or a proprietary family previewed by one (Microsoft
// YaHei, Mangal): safe mode is about Latin text, and no Office-safe metric family exists for these scripts.
const SCRIPT_FACE = /^noto (?:sans|serif|naskh|nastaliq|kufi|color)\b(?! *(?:mono|display)? *$)/i;

/**
 * Whether safe mode writes `family` as another family: a Latin text family, not a theme token, not a symbol, emoji or math
 * face (their glyphs are not letters; Wingdings mapped to Arial would print letters instead of icons) and not a script face.
 */
export function isLatinTextFamily(family) {
  if (typeof family !== 'string' || !family.trim() || family.startsWith('+')) return false;
  const row = fontPolicyFor(family);
  if (row && row.licenseClass !== 'open' && row.replacement === null) return false;
  const preview = row?.replacement?.family ?? family;
  return !SPECIAL.test(family) && !SPECIAL.test(preview) && !SCRIPT_FACE.test(family.trim()) && !SCRIPT_FACE.test(preview);
}

export const isOfficeSafeTypeface = family => typeof family === 'string' && SAFE.has(key(family));

/**
 * The Office-safe family safe mode writes for `family`. `classes` maps a family to its design class (`sans-serif`, `serif`,
 * `monospace`, from the font scheme records' `type`); a family with no class is monospace when its name says so, else sans-serif.
 * Families that are not Latin text families are returned unchanged.
 */
export function officeSafeTypeface(family, classes = new Map()) {
  if (!isLatinTextFamily(family)) return family;
  const name = key(family);
  if (SAFE.has(name)) return SAFE.get(name).family;
  if (METRIC_TWIN.has(name)) return METRIC_TWIN.get(name);
  const kind = classes.get(name) ?? (isMonospaceFamily(family) ? 'monospace' : 'sans-serif');
  return SAFE_TYPEFACE_FOR_CLASS[kind] ?? SAFE_TYPEFACE_FOR_CLASS['sans-serif'];
}

/** Whether the safe family has the same advances as `family` (it is the family itself or its metric twin). */
export const sameMetrics = (family, safe) => key(family) === key(safe) || METRIC_TWIN.get(key(family)) === safe;

/** The design class of each family a font scheme names: its `type` for the scheme's major and minor families, monospace for its code family. */
export function typefaceClasses(schemes) {
  const classes = new Map();
  for (const scheme of schemes) {
    if (!scheme) continue;
    if (typeof scheme.code === 'string' && scheme.code) classes.set(key(scheme.code), 'monospace');
    if (!['sans-serif', 'serif', 'monospace'].includes(scheme.type)) continue;
    for (const family of [scheme.major, scheme.minor]) if (typeof family === 'string' && family && !classes.has(key(family))) classes.set(key(family), scheme.type);
  }
  return classes;
}

/**
 * A text measurement that measures each Latin text family as its safe family, so composition lays out the text PowerPoint
 * draws. Every method of the provider is kept; only the requested `fontFamily` changes.
 */
export function safeMeasurement(measurement, safe) {
  if (!measurement) return measurement;
  const style = value => value && typeof value.fontFamily === 'string' ? {...value, fontFamily: safe(value.fontFamily)} : value;
  const wrapped = {
    measure: (text, size, value) => measurement.measure(text, size, style(value)),
  };
  for (const name of ['resolveStyle', 'resolveFont']) if (typeof measurement[name] === 'function') wrapped[name] = (value, ...rest) => measurement[name](style(value), ...rest);
  if (typeof measurement.outlineBounds === 'function') wrapped.outlineBounds = (text, size, value) => measurement.outlineBounds(text, size, style(value));
  return wrapped;
}

const escapeXml = value => String(value).replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'}[char]));
const unescapeXml = value => value.replace(/&(amp|lt|gt|quot|apos);/g, (_, name) => ({amp: '&', lt: '<', gt: '>', quot: '"', apos: "'"}[name]));
const PITCH = {'sans-serif': 34, serif: 18, monospace: 49};
const SAFE_CLASS = Object.fromEntries(Object.entries(SAFE_TYPEFACE_FOR_CLASS).map(([kind, family]) => [family, kind]));
SAFE_CLASS['Times New Roman'] = 'serif';

/**
 * Rewrite one XML part: each `a:latin` and `a:buFont` typeface that safe mode replaces names the safe family (with its pitch
 * family when the element carries one, and no panose of the old face). An `a:ea` or `a:cs` slot is rewritten only where the
 * deck's script fonts fall back to the Latin families (`latinFallback`, core's script-font `sources`) and the slot names the
 * same family as the `a:latin` of its run or theme font group: a script font chosen for East Asian or complex-script text is kept.
 */
export function writeSafeTypefaces(xml, safe, {latinFallback = {ea: false, cs: false}} = {}) {
  if (!xml.includes('typeface="')) return xml;
  const swap = (element, attributes, face) => {
    const family = unescapeXml(face), target = safe(family);
    if (target === family) return undefined;
    let next = attributes.replace(/\btypeface="[^"]*"/, `typeface="${escapeXml(target)}"`).replace(/\s+panose="[^"]*"/, '');
    if (/\bpitchFamily="/.test(next) && SAFE_CLASS[target]) next = next.replace(/\bpitchFamily="[^"]*"/, `pitchFamily="${PITCH[SAFE_CLASS[target]]}"`);
    return `<a:${element}${next}/>`;
  };
  // A group: a run property element (its latin/ea/cs children) or a theme font collection.
  const group = /<a:(rPr|defRPr|endParaRPr|majorFont|minorFont|pPr|lvl\dpPr)\b[^>]*?(?:\/>|>[\s\S]*?<\/a:\1>)/g;
  const element = /<a:(latin|ea|cs|buFont)\b([^<>]*?)\/>/g;
  const rewrite = (part, latinFace) => part.replace(element, (node, name, attributes) => {
    const face = /\btypeface="([^"]*)"/.exec(attributes)?.[1];
    if (face === undefined || face === '' || face.startsWith('+')) return node;
    // Composition may already have named the run's latin family as its safe family while the slot still names the authored one.
    if ((name === 'ea' || name === 'cs') && !(latinFallback[name] && latinFace !== undefined && safe(unescapeXml(face)) === safe(unescapeXml(latinFace)))) return node;
    return swap(name, attributes.replace(/\/$/, ''), face) ?? node;
  });
  return xml.replace(group, block => rewrite(block, /<a:latin\b[^>]*\btypeface="([^"]*)"/.exec(block)?.[1]));
}

/** The Latin text typefaces of a finished package that are not Office-safe, sorted. `entries` maps part paths to bytes. */
export function unsafeTypefacesIn(entries) {
  const decoder = new TextDecoder(), found = new Set();
  for (const [path, bytes] of Object.entries(entries)) {
    if (!/^ppt\/.*\.xml$/.test(path)) continue;
    for (const [, face] of decoder.decode(bytes).matchAll(/<a:(?:latin|buFont)\b[^<>]*?\btypeface="([^"]*)"/g)) {
      const family = unescapeXml(face);
      if (isLatinTextFamily(family) && !isOfficeSafeTypeface(family)) found.add(family);
    }
  }
  return [...found].sort();
}
