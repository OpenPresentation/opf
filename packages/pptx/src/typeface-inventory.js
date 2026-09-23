import {unzipSync} from 'fflate';

// Typeface inventory for a PPTX package (FF-08, font-fidelity-everywhere).
//
// Walks every XML part, including parts of nested OOXML packages such as the
// embedded chart workbooks, and records each font name the package carries:
// DrawingML `typeface` attributes (latin, ea, cs, sym, buFont, theme script
// supplements, embedded-font lists), SpreadsheetML font names (styles `name`,
// rich-text `rFont`) and the docProps/app.xml "Fonts Used" list.
// checkPptxTypefaces() then applies the owner font policy: a package names only
// the fonts its author chose, plus theme references that resolve to them, empty
// theme script slots (FF-05) and the documented theme script supplements.

const decoder = new TextDecoder();
const NESTED_PACKAGE = /\.(?:xlsx|xlsm|docx|pptx)$/i;
const XML_PART = /\.(?:xml|rels)$/i;
const THEME_PART = /(?:^|\/)theme\/theme\d+\.xml$/;
const THEME_REFERENCE = /^\+(mj|mn)-(lt|ea|cs)$/;
const THEME_SLOT = {lt: 'latin', ea: 'ea', cs: 'cs'};
const FIXED_PITCH = 1;

// Per-script theme fonts (`<a:font script="…">`) written by the vendored
// PptxGenJS 4.0.1 theme. They are Office's defaults for scripts the deck
// declares no font for. PowerPoint uses one only for text in that script, and
// it does not list them in "Fonts Used". The check allows exactly these
// script/typeface pairs in the presentation theme; any other supplement fails
// unless it names a chosen font. test/typeface-inventory.mjs pins this list to
// the vendored theme.
const supplement = entries => Object.freeze(Object.fromEntries(entries.split('|').map(pair => pair.split('='))));
const SHARED_SCRIPTS = 'Hang=맑은 고딕|Hant=新細明體|Ethi=Nyala|Beng=Vrinda|Gujr=Shruti|Knda=Tunga|Guru=Raavi|Cans=Euphemia|Cher=Plantagenet Cherokee|Yiii=Microsoft Yi Baiti|Tibt=Microsoft Himalaya|Thaa=MV Boli|Deva=Mangal|Telu=Gautami|Taml=Latha|Syrc=Estrangelo Edessa|Orya=Kalinga|Mlym=Kartika|Laoo=DokChampa|Sinh=Iskoola Pota|Mong=Mongolian Baiti|Uigh=Microsoft Uighur|Geor=Sylfaen|Armn=Arial|Bugi=Leelawadee UI|Bopo=Microsoft JhengHei|Java=Javanese Text|Lisu=Segoe UI|Mymr=Myanmar Text|Nkoo=Ebrima|Olck=Nirmala UI|Osma=Ebrima|Phag=Phagspa|Syrn=Estrangelo Edessa|Syrj=Estrangelo Edessa|Syre=Estrangelo Edessa|Sora=Nirmala UI|Tale=Microsoft Tai Le|Talu=Microsoft New Tai Lue|Tfng=Ebrima';
export const THEME_SCRIPT_SUPPLEMENTS = Object.freeze({
  major: supplement(`Jpan=游ゴシック Light|Hans=等线 Light|Arab=Times New Roman|Hebr=Times New Roman|Thai=Angsana New|Khmr=MoolBoran|Viet=Times New Roman|${SHARED_SCRIPTS}`),
  minor: supplement(`Jpan=游ゴシック|Hans=等线|Arab=Arial|Hebr=Arial|Thai=Cordia New|Khmr=DaunPenh|Viet=Arial|${SHARED_SCRIPTS}`)
});

export function inventoryPptxTypefaces(input, options = {}) {
  const typefaces = [];
  const themes = {};
  let fontsUsed = null;
  const visit = (entries, prefix) => {
    const packageThemes = [];
    for (const path of Object.keys(entries).sort()) {
      const bytes = entries[path];
      if (NESTED_PACKAGE.test(path)) {
        if (options.nested !== false) visit(unzipSync(bytes), `${prefix}${path}!/`);
        continue;
      }
      if (!XML_PART.test(path)) continue;
      const xml = decoder.decode(bytes);
      const part = prefix + path;
      if (THEME_PART.test(path)) packageThemes.push(part);
      readTypefaces(xml, part, THEME_PART.test(path), typefaces);
      if (/^xl\/.*\.xml$/.test(path)) readSpreadsheetFonts(xml, part, typefaces);
      if (!prefix && path === 'docProps/app.xml') fontsUsed = readFontsUsed(xml);
    }
    // Theme references resolve against the package theme. The exporter writes
    // one theme per package; with several, the first (theme1) is used.
    const theme = packageThemes[0];
    if (theme) themes[prefix] = themeFonts(typefaces, theme);
  };
  visit(toEntries(input), '');
  for (const entry of typefaces) {
    const reference = THEME_REFERENCE.exec(entry.typeface);
    if (!reference) continue;
    const prefix = entry.part.includes('!/') ? entry.part.slice(0, entry.part.lastIndexOf('!/') + 2) : '';
    const resolved = themes[prefix]?.[reference[1] === 'mj' ? 'major' : 'minor']?.[THEME_SLOT[reference[2]]];
    entry.resolved = resolved ?? null;
  }
  return {typefaces, themes, fontsUsed};
}

// Fonts a package uses, as PowerPoint lists them under "Fonts Used": the
// presentation theme's major/minor fonts and every explicit font in the
// presentation's own parts (slides, layouts, masters, notes, charts), with
// theme references resolved. Script supplements, empty slots and nested
// packages are not fonts in use. Sorted by a locale-independent order.
export function packageFontsUsed(inventory) {
  const used = new Set();
  for (const entry of inventory.typefaces) {
    if (entry.part.includes('!/') || !entry.part.startsWith('ppt/') || entry.script !== undefined || entry.kind !== 'drawingml') continue;
    const value = THEME_REFERENCE.test(entry.typeface) ? entry.resolved : entry.typeface;
    if (value) used.add(value);
  }
  return [...used].sort(compareFontNames);
}

export function checkPptxTypefaces(input, options = {}) {
  if (!Array.isArray(options.fonts) || options.fonts.some(font => typeof font !== 'string' || !font)) {
    throw new TypeError('checkPptxTypefaces requires options.fonts, the non-empty family names the author chose.');
  }
  const chosen = new Set(options.fonts);
  const monospace = new Set(options.monospace ?? []);
  const allowEmpty = options.allowEmptyThemeScripts ?? true;
  const supplements = options.scriptSupplements ?? THEME_SCRIPT_SUPPLEMENTS;
  const inventory = inventoryPptxTypefaces(input);
  const violations = [];
  const fail = (entry, reason, details = {}) => violations.push({reason, part: entry.part, element: entry.element, typeface: entry.typeface, ...details});
  const emptyAllowed = entry => allowEmpty && entry.theme && (entry.element === 'ea' || entry.element === 'cs');
  const pitches = new Map();
  for (const entry of inventory.typefaces) {
    const reference = THEME_REFERENCE.exec(entry.typeface);
    if (reference) {
      if (entry.resolved === null) fail(entry, 'unresolved-theme-reference');
      else if (entry.resolved === '') { if (!allowEmpty || reference[2] === 'lt') fail(entry, 'empty-theme-reference'); }
      else if (!chosen.has(entry.resolved)) fail(entry, 'foreign-theme-reference', {resolved: entry.resolved});
      continue;
    }
    if (entry.typeface === '') {
      if (!emptyAllowed(entry)) fail(entry, 'empty-typeface');
      continue;
    }
    if (entry.script !== undefined) {
      const documented = !entry.part.includes('!/') && Boolean(entry.theme) && supplements[entry.theme]?.[entry.script] === entry.typeface;
      if (!documented && !chosen.has(entry.typeface)) fail(entry, 'foreign-script-supplement', {script: entry.script, theme: entry.theme});
      continue;
    }
    if (!chosen.has(entry.typeface)) fail(entry, 'foreign-typeface');
    if (entry.pitchFamily !== undefined) {
      const fixed = (entry.pitchFamily & 0x03) === FIXED_PITCH;
      if (monospace.has(entry.typeface) && !fixed) fail(entry, 'monospace-not-fixed-pitch', {pitchFamily: entry.pitchFamily});
      if (!monospace.has(entry.typeface) && fixed) fail(entry, 'fixed-pitch-not-monospace', {pitchFamily: entry.pitchFamily});
      const seen = pitches.get(entry.typeface);
      if (seen === undefined) pitches.set(entry.typeface, entry.pitchFamily);
      else if (seen !== entry.pitchFamily) fail(entry, 'inconsistent-pitch-family', {pitchFamily: entry.pitchFamily, first: seen});
    }
  }
  const expected = packageFontsUsed(inventory);
  if (inventory.fontsUsed === null) {
    violations.push({reason: 'missing-fonts-used', part: 'docProps/app.xml'});
  } else {
    for (const font of inventory.fontsUsed) {
      if (!chosen.has(font)) violations.push({reason: 'foreign-fonts-used', part: 'docProps/app.xml', typeface: font});
    }
    if (inventory.fontsUsed.join('\n') !== expected.join('\n')) {
      violations.push({reason: 'fonts-used-mismatch', part: 'docProps/app.xml', listed: inventory.fontsUsed, expected});
    }
  }
  return {ok: violations.length === 0, violations, inventory, fontsUsed: expected};
}

export function compareFontNames(left, right) {
  const a = left.toLowerCase(), b = right.toLowerCase();
  if (a !== b) return a < b ? -1 : 1;
  return left < right ? -1 : left > right ? 1 : 0;
}

function toEntries(input) {
  if (input instanceof Uint8Array) return unzipSync(input);
  if (input instanceof ArrayBuffer) return unzipSync(new Uint8Array(input));
  if (input && typeof input === 'object') return input;
  throw new TypeError('Expected PPTX bytes or a map of package parts.');
}

function readTypefaces(xml, part, isTheme, output) {
  const major = sectionRange(xml, 'majorFont'), minor = sectionRange(xml, 'minorFont');
  for (const match of xml.matchAll(/<(?:[\w.-]+:)?([\w.-]+)\b([^<>]*?\btypeface="([^"]*)"[^<>]*)>/g)) {
    const [, element, attributes, raw] = match;
    const entry = {part, kind: 'drawingml', element, typeface: unescapeXml(raw)};
    const pitch = /\bpitchFamily="([^"]*)"/.exec(attributes)?.[1];
    if (pitch !== undefined) entry.pitchFamily = Number(pitch);
    const script = /\bscript="([^"]*)"/.exec(attributes)?.[1];
    if (script !== undefined) entry.script = script;
    if (isTheme) {
      const at = match.index;
      if (at > major[0] && at < major[1]) entry.theme = 'major';
      else if (at > minor[0] && at < minor[1]) entry.theme = 'minor';
    }
    output.push(entry);
  }
}

function readSpreadsheetFonts(xml, part, output) {
  for (const match of xml.matchAll(/<(?:[\w.-]+:)?(name|rFont)\b[^<>]*?\bval="([^"]*)"[^<>]*>/g)) {
    output.push({part, kind: 'spreadsheetml', element: match[1], typeface: unescapeXml(match[2])});
  }
}

function themeFonts(typefaces, part) {
  const fonts = {major: {}, minor: {}};
  for (const entry of typefaces) {
    if (entry.part !== part || !entry.theme || !['latin', 'ea', 'cs'].includes(entry.element)) continue;
    fonts[entry.theme][entry.element] ??= entry.typeface;
  }
  return fonts;
}

function readFontsUsed(xml) {
  const pairs = headingPairs(xml);
  const titles = titlesOfParts(xml);
  if (!pairs || !titles) return null;
  let offset = 0;
  for (const [name, count] of pairs) {
    if (name === 'Fonts Used') return titles.slice(offset, offset + count);
    offset += count;
  }
  return [];
}

export function headingPairs(xml) {
  const block = /<HeadingPairs>([\s\S]*?)<\/HeadingPairs>/.exec(xml)?.[1];
  if (block === undefined) return null;
  const values = [...block.matchAll(/<vt:variant>\s*<vt:(lpstr|i4)>([^<]*)<\/vt:\1>\s*<\/vt:variant>/g)].map(match => match[1] === 'i4' ? Number(match[2]) : unescapeXml(match[2]));
  const pairs = [];
  for (let index = 0; index + 1 < values.length; index += 2) pairs.push([values[index], values[index + 1]]);
  return pairs;
}

export function titlesOfParts(xml) {
  const block = /<TitlesOfParts>([\s\S]*?)<\/TitlesOfParts>/.exec(xml)?.[1];
  if (block === undefined) return null;
  return [...block.matchAll(/<vt:lpstr>([^<]*)<\/vt:lpstr>/g)].map(match => unescapeXml(match[1]));
}

function sectionRange(xml, name) {
  const start = xml.indexOf(`<a:${name}>`);
  if (start < 0) return [-1, -1];
  const end = xml.indexOf(`</a:${name}>`, start);
  return [start, end < 0 ? xml.length : end];
}

function unescapeXml(value) {
  return value.replace(/&(?:amp|lt|gt|quot|apos|#(\d+)|#x([0-9a-fA-F]+));/g, (entity, decimal, hex) => {
    if (decimal) return String.fromCodePoint(Number(decimal));
    if (hex) return String.fromCodePoint(Number.parseInt(hex, 16));
    return {'&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'"}[entity];
  });
}
