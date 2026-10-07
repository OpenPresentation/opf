// RR-17 (FF-41, FF-43): the per-family fixture model shared by the Node and browser host tests. For every Latin family the
// policy names (the proprietary Latin families that route to a bundled open face, the open Latin families, and the metric aliases
// Liberation Sans, Serif and Mono and Source Sans Pro), it says which face each of the four styles must draw, from the policy row
// and the pinned manifest alone: the route family, the face of it that a style resolves to (italic before weight, nearest weight,
// ties to the lighter, the row's encoded weight kept for the regular style and raised for bold), the manifest file that holds it
// and whether the registry loads it eagerly or on demand. Nothing here calls the registry, so the hosts are checked against it.
import {BUNDLED_FONT_MANIFEST} from '../dist/fonts-node.js';
import {FONT_POLICY, disabledFeaturesFor} from '../dist/fonts.js';

export const STYLES = [[400, false], [700, false], [400, true], [700, true]];
export const label = (weight, italic) => `${weight}${italic ? 'i' : ''}`;
export const PROBES = ['Quarterly operating review 1234', 'Hamburgefonstiv WWW iii', 'office fluffy affine fi fl ffi ffl'];

const LATIN_PACKS = new Set(['base', 'office', 'open']);
const packages = BUNDLED_FONT_MANIFEST.packages;
const faceRows = packages.flatMap(pkg => pkg.faces.map(face => ({...face, package: pkg.name, pack: pkg.pack, vendored: pkg.vendored ?? null, embed: pkg.embed ?? null})));
export const facesOf = family => faceRows.filter(face => face.family.toLowerCase() === family.toLowerCase());
const lazyPackage = pkg => Boolean(pkg.vendored) && (pkg.pack === 'open' || pkg.embed === 'used');
/** Package-relative path as a host serves it (fonts/<dir>/<file>) for a lazy face, or the npm path for an eager one. */
export const faceFile = face => face.vendored ? `${face.vendored}/${face.file}` : `node_modules/${face.package}/${face.file}`;
export const isLazy = face => lazyPackage(packages.find(pkg => pkg.name === face.package));

/** Aliases the Node and browser loaders add for renamed open families (Source Sans Pro -> Source Sans 3). */
export const ALIASES = Object.fromEntries(packages.filter(pkg => pkg.pack === 'open' && pkg.renamedFrom).map(pkg => [pkg.renamedFrom.toLowerCase(), pkg.faces[0].family]));

/** The Latin families the fixture covers, with the route each draws. */
export function latinFamilies() {
  const rows = [];
  for (const row of FONT_POLICY) {
    const own = facesOf(row.family);
    let route, tier, weight;
    if (row.replacement) { route = row.replacement.family; tier = row.replacement.compatibility; weight = row.replacement.weight; }
    else if (own.length) { route = row.family; tier = 'exact'; }
    else continue;
    const alias = ALIASES[row.family.toLowerCase()];
    if (alias) { route = alias; tier = 'visual'; }
    const faces = facesOf(route);
    if (!faces.length || !faces.every(face => LATIN_PACKS.has(face.pack))) continue; // script (Noto) and special families are the script fixtures' business
    rows.push({family: row.family, licenseClass: row.licenseClass, route, tier, weight, faces, disabledFeatures: disabledFeaturesFor(route) ? [...disabledFeaturesFor(route)] : null, alias: Boolean(alias), alternates: row.alternates ?? []});
  }
  return rows;
}

/** The face a style resolves to inside the route family, following the registry's rule. */
export function expectedFace(entry, weight, italic) {
  const wanted = entry.weight ? (weight >= 600 ? Math.max(entry.weight, 700) : entry.weight) : weight;
  const upright = entry.faces.filter(face => !face.italic), slanted = entry.faces.filter(face => face.italic);
  const pool = italic && slanted.length ? slanted : upright;
  const face = [...pool].sort((a, b) => Math.abs(a.weight - wanted) - Math.abs(b.weight - wanted) || a.weight - b.weight)[0];
  return {face, wanted, exactWeight: face.weight === wanted, styleGap: Boolean(italic) !== Boolean(face.italic), file: faceFile(face), lazy: isLazy(face)};
}

/**
 * The face one run of the family deck draws. The deck's role styles resolve once, to the replacement family, so a run that is not
 * bold keeps the weight the family names (Arial Black draws Montserrat 900, Segoe UI Semibold Red Hat Display 600), and a bold run
 * resolves 700 inside the replacement family, as the composition resolves its runs.
 */
export function runFace(entry, {bold = false, italic = false, heading = false} = {}) {
  return bold || heading && !entry.weight ? expectedFace({...entry, weight: undefined}, 700, italic) : expectedFace(entry, heading ? 700 : 400, italic);
}
export const RUNS = [['Regular', {}], ['Bold', {bold: true}], ['Italic', {italic: true}], ['BoldItalic', {bold: true, italic: true}]];

/** The distinct faces a family deck draws (heading, then the four runs), with the lazy ones (the files a browser host fetches) marked. */
export function neededFaces(entry) {
  const faces = new Map();
  for (const found of [runFace(entry, {heading: true}), ...RUNS.map(([, style]) => runFace(entry, style))]) faces.set(found.file, found);
  return [...faces.values()];
}

/** A deck that draws `family` as heading and body font with the four styles in one body paragraph. */
export function familyDeck(family) {
  return {
    name: `Latin fixture ${family}`,
    design: {fontScheme: 'x-latin-fixture'},
    catalogs: {fontSchemes: {records: [{$schema: 'https://openpresentation.org/schema/opf-font-scheme/v1', id: 'x-latin-fixture', name: family, app: 'powerpoint', languageFamily: 'latin', languages: [], major: family, minor: family, textSample: 'x', type: 'sans-serif'}]}},
    slides: [{id: 'a', title: 'Quarterly review', text: [{text: 'Regular'}, ' ', {text: 'Bold', bold: true}, ' ', {text: 'Italic', italic: true}, ' ', {text: 'BoldItalic', bold: true, italic: true}]}],
  };
}
