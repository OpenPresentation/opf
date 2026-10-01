// Script shaping qualification (RR-17, FF-44). Runs the script corpora (test/fixtures/script-corpora.json) through every bundled open
// face that serves each script and records, per face and sample:
//   - coverage: characters of the sample the face has no glyph for (split into the group's own script and common/Latin characters,
//     which the glyph-fallback chain covers with Noto Sans);
//   - the renderer's width: `registry.textMeasurement` (fontkit as the renderer uses it, including the Mongolian lookup guard, the mark
//     retry and the OpenType language system of the sample's `lang`);
//   - HarfBuzz's width and glyph count for the same text, language and face (harfbuzzjs, the same shaper Chromium and resvg use), as the
//     independent shaping reference; and fontkit's own glyph run, to tell whether shaping applied (ligatures, conjuncts, marks).
// Per face it also records the line metrics and the coverage of the face's own script and, for CJK faces, of the national charsets.
// The result is a plain JSON report: node scripts/script-corpora.mjs [report.json]
import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import * as fontkit from 'fontkit';
import * as hb from 'harfbuzzjs';
import {prepareNodeFonts} from '../dist/fonts-node.js';
import {openTypeLanguage} from '../dist/script-fonts.js';

const corpusPath = new URL('../test/fixtures/script-corpora.json', import.meta.url);
export const loadCorpora = async () => JSON.parse(await readFile(corpusPath, 'utf8'));

const ignorable = /^\p{Default_Ignorable_Code_Point}$/u;
/** Unicode scripts whose letters a group's face must carry (kana and Bopomofo with Han, Cyrillic and Greek with Latin). */
const unicodeScripts = {
  Jpan: ['Han', 'Hiragana', 'Katakana'], Hans: ['Han'], Hant: ['Han', 'Bopomofo'], Kore: ['Hangul', 'Han'],
  Cyrl: ['Cyrillic'], Grek: ['Greek'], Latn: ['Latin'], Mong: ['Mongolian'], Ethi: ['Ethiopic'],
  Arab: ['Arabic'], Hebr: ['Hebrew'], Deva: ['Devanagari'], Beng: ['Bengali'], Guru: ['Gurmukhi'], Gujr: ['Gujarati'], Orya: ['Oriya'],
  Taml: ['Tamil'], Telu: ['Telugu'], Knda: ['Kannada'], Mlym: ['Malayalam'], Sinh: ['Sinhala'], Thai: ['Thai'], Laoo: ['Lao'], Khmr: ['Khmer'],
  Mymr: ['Myanmar'], Tibt: ['Tibetan'], Armn: ['Armenian'], Geor: ['Georgian'], Syrc: ['Syriac'], Thaa: ['Thaana'],
};
const ownPattern = script => new RegExp(`^[${unicodeScripts[script].map(name => `\\p{Script=${name}}`).join('')}]$`, 'u');

const eq = (a, b) => a.length === b.length && a.every((value, index) => value === b[index]);
const round = (value, digits = 3) => Math.round(value * 10 ** digits) / 10 ** digits;

/** Raw fontkit glyph run, shaped with the renderer's own retries (see metrics in src/fonts.js). */
const guarded = new WeakSet();
function skipUndecodableLookups(font) {
  if (guarded.has(font)) return false;
  guarded.add(font);
  let did = false;
  for (const tag of ['GSUB', 'GPOS']) {
    let list;
    try { list = font[tag]?.lookupList; } catch { continue; }
    if (typeof list?.get !== 'function') continue;
    const get = list.get.bind(list);
    list.get = index => { try { return get(index); } catch { return {lookupType: 1, flags: {}, subTables: []}; } };
    did = true;
  }
  return did;
}
export function fontkitRun(font, text, lang) {
  const language = openTypeLanguage(lang);
  const shape = extra => font.layout(text, extra, undefined, language);
  try { return {run: shape(), retry: 'none'}; } catch { /* the renderer's retries */ }
  if (skipUndecodableLookups(font)) { try { return {run: shape(), retry: 'skip-undecodable-lookups'}; } catch { /* mark retry */ } }
  try { return {run: shape({abvm: false, blwm: false, mark: false, mkmk: false}), retry: 'no-mark-positioning'}; } catch (error) { return {error: error.message}; }
}

/** The faces a corpus run loads: the whole script pack plus Noto Sans, from the pinned installed packages. */
export async function loadFaces() {
  const {registry, options} = await prepareNodeFonts({pack: 'office', scripts: 'all'});
  const described = registry.describeFaces(), files = options.fontFiles;
  const faces = [];
  for (const [index, face] of described.entries()) {
    if (!face.scripts) continue; // vendored open families are not script faces
    const data = await readFile(files[index]);
    const hbFace = new hb.Face(new hb.Blob(data));
    faces.push({
      family: face.family, weight: face.weight, italic: face.italic, scripts: face.scripts, file: files[index],
      font: fontkit.create(new Uint8Array(data)), hbFace, hbFont: new hb.Font(hbFace),
    });
  }
  return {registry, faces};
}

/** Vertical metrics of a face in em units (hhea, OS/2 typo and win), the data the preview's line box depends on. */
export function lineMetrics(font) {
  const unit = font.unitsPerEm, os2 = font['OS/2'] ?? {};
  return {
    unitsPerEm: unit,
    hhea: {ascent: round(font.ascent / unit), descent: round(font.descent / unit), lineGap: round(font.lineGap / unit)},
    typo: os2.typoAscender === undefined ? null : {ascent: round(os2.typoAscender / unit), descent: round(os2.typoDescender / unit), lineGap: round(os2.typoLineGap / unit)},
    win: os2.winAscent === undefined ? null : {ascent: round(os2.winAscent / unit), descent: round(os2.winDescent / unit)},
    useTypoMetrics: Boolean(os2.fsSelection?.useTypoMetrics),
    xHeight: os2.xHeight === undefined ? null : round(os2.xHeight / unit), capHeight: os2.capHeight === undefined ? null : round(os2.capHeight / unit),
  };
}

const range = (from, to) => Array.from({length: to - from + 1}, (_, index) => from + index);
const isHan = code => (code >= 0x4E00 && code <= 0x9FFF) || (code >= 0x3400 && code <= 0x4DBF) || (code >= 0xF900 && code <= 0xFAFF);
function legacyCharset(encoding, leads, trails, singles = []) {
  const decoder = new TextDecoder(encoding, {fatal: true}), out = new Set();
  const add = bytes => {
    try { const text = decoder.decode(Uint8Array.from(bytes)), code = text.codePointAt(0); if ([...text].length === 1 && code > 0x7F && code !== 0xFFFD) out.add(code); } catch { /* an unassigned code */ }
  };
  for (const lead of leads) for (const trail of trails) add([lead, trail]);
  for (const single of singles) add([single]);
  return out;
}
/** The legacy national character sets a CJK face is held to (decoded from the WHATWG encodings, so the data is the standards'). */
export const CJK_CHARSETS = {
  'JIS X 0208': () => legacyCharset('shift_jis', [...range(0x81, 0x9F), ...range(0xE0, 0xEF)], range(0x40, 0xFC), range(0xA1, 0xDF)),
  'GB 2312': () => legacyCharset('gbk', range(0xA1, 0xF7), range(0xA1, 0xFE)),
  'Big5 levels 1 and 2': () => legacyCharset('big5', [...range(0xA4, 0xC6), ...range(0xC9, 0xF8)], [...range(0x40, 0x7E), ...range(0xA1, 0xFE)]),
  'KS X 1001': () => legacyCharset('euc-kr', range(0xA1, 0xFD), range(0xA1, 0xFE)),
};
/** The national charset a CJK script's own face carries (the rest of CJK text falls to another CJK face by glyph fallback). */
export const OWN_CHARSET = {Jpan: 'JIS X 0208', Hans: 'GB 2312', Hant: 'Big5 levels 1 and 2', Kore: 'KS X 1001'};
const charsetCache = new Map();
const charset = name => { if (!charsetCache.has(name)) charsetCache.set(name, [...CJK_CHARSETS[name]()]); return charsetCache.get(name); };

const assignedCache = new Map();
/** Assigned letters, marks and digits of one Unicode script (the Unicode version of this Node's ICU). */
function assigned(unicodeScript) {
  if (assignedCache.has(unicodeScript)) return assignedCache.get(unicodeScript);
  const script = new RegExp(`^\\p{Script=${unicodeScript}}$`, 'u'), kind = /^[\p{L}\p{M}\p{N}]$/u, codes = [];
  for (let code = 0x20; code <= 0x1FFFF; code++) {
    if (code >= 0xD800 && code <= 0xDFFF) continue;
    const character = String.fromCodePoint(code);
    if (script.test(character) && kind.test(character)) codes.push(code);
  }
  assignedCache.set(unicodeScript, codes);
  return codes;
}
/** Coverage of the letters, marks and digits of the face's own Unicode script(s), BMP and all planes, and for CJK faces of the national charsets. */
export function charsetCoverage(font, scripts) {
  const out = {scripts: [], charsets: []};
  const has = code => font.hasGlyphForCodePoint(code);
  for (const script of scripts) {
    for (const name of unicodeScripts[script] ?? []) {
      if (name === 'Han' || name === 'Hiragana' || name === 'Katakana' || name === 'Bopomofo') continue; // CJK is measured against the national charsets below
      const codes = assigned(name), bmp = codes.filter(code => code < 0x10000);
      out.scripts.push({script, unicodeScript: name, assigned: codes.length, covered: codes.filter(has).length, bmpAssigned: bmp.length, bmpCovered: bmp.filter(has).length,
        missingFirst: codes.filter(code => !has(code)).slice(0, 8).map(code => `U+${code.toString(16).toUpperCase()}`)});
    }
  }
  if (scripts.some(script => OWN_CHARSET[script])) {
    for (const name of Object.keys(CJK_CHARSETS)) {
      const set = charset(name), han = set.filter(isHan);
      out.charsets.push({charset: name, size: set.length, covered: set.filter(has).length, han: han.length, hanCovered: han.filter(has).length});
    }
  }
  return out;
}

/** Qualify one sample against one face. */
export function qualifySample(face, group, sample, registry) {
  const text = sample.text, own = ownPattern(group.script);
  const missing = [], missingOwn = [];
  for (const character of new Set(text)) {
    if (/\s/u.test(character) || ignorable.test(character)) continue;
    if (face.font.hasGlyphForCodePoint(character.codePointAt(0))) continue;
    (own.test(character) ? missingOwn : missing).push(character);
  }
  const shaped = fontkitRun(face.font, text, sample.lang);
  let rendererWidth = null, rendererError = null;
  try { rendererWidth = registry.textMeasurement.measure(text, 100, {fontFamily: face.family, fontWeight: face.weight, italic: face.italic, lang: sample.lang}); }
  catch (error) { rendererError = error.code ?? error.message; }
  const buffer = new hb.Buffer();
  buffer.addText(text);
  buffer.guessSegmentProperties();
  if (sample.lang) buffer.setLanguage(sample.lang);
  hb.shape(face.hbFont, buffer);
  const infos = buffer.getGlyphInfos(), positions = buffer.getGlyphPositions();
  const unit = face.hbFace.upem;
  const hbWidth = positions.reduce((total, position) => total + position.xAdvance, 0) / unit * 100;
  const hbGlyphs = infos.map(info => info.codepoint);
  const hbMarks = positions.filter(position => position.xAdvance === 0).length;
  const run = shaped.run;
  const fkGlyphs = run ? run.glyphs.map(glyph => glyph.id) : [];
  const nominal = [...text].filter(character => !ignorable.test(character)).map(character => face.font.glyphForCodePoint(character.codePointAt(0)).id);
  const fkMarks = run ? run.positions.filter(position => position.xAdvance === 0).length : null;
  const comparable = fkGlyphs.length === hbGlyphs.length && (eq(fkGlyphs, hbGlyphs) || eq(fkGlyphs, [...hbGlyphs].reverse()));
  return {
    id: sample.id, category: sample.category, lang: sample.lang,
    codePoints: [...text].length, missing: missing.join(''), missingOwn: missingOwn.join(''),
    rendererWidth: rendererWidth === null ? null : round(rendererWidth), rendererError,
    retry: shaped.retry ?? null, shapingError: shaped.error ?? null,
    hbWidth: round(hbWidth), widthDelta: rendererWidth === null ? null : round(rendererWidth - hbWidth),
    fontkitGlyphs: fkGlyphs.length, hbGlyphs: hbGlyphs.length, glyphSequenceEqual: comparable,
    shapingApplied: fkGlyphs.length !== nominal.length || !eq(fkGlyphs, nominal) || hbGlyphs.length !== nominal.length,
    zeroAdvance: {fontkit: fkMarks, harfbuzz: hbMarks},
  };
}

/**
 * Latin, Cyrillic and Greek corpus characters that each bundled Latin-script design face (the office and open packs, upright regular) lacks:
 * those characters draw with Noto Sans by glyph fallback (a different design, the same metrics class). Information for the Latin
 * replacement work (FF-41 to FF-43); nothing gates on it.
 */
export async function latinFaceCoverage({registry, files, corpora}) {
  const described = registry.describeFaces();
  const groups = corpora.groups.filter(group => ['Latn', 'Cyrl', 'Grek'].includes(group.script));
  const characters = [...new Set(groups.flatMap(group => group.samples.flatMap(sample => [...sample.text])))].filter(character => !/s/u.test(character) && !ignorable.test(character));
  const out = [];
  for (const [index, face] of described.entries()) {
    if (face.scripts || face.weight !== 400 || face.italic) continue;
    const font = fontkit.create(new Uint8Array(await readFile(files[index])));
    const missing = characters.filter(character => !font.hasGlyphForCodePoint(character.codePointAt(0)));
    out.push({family: face.family, characters: characters.length, missing: missing.length, missingCharacters: missing.join('')});
  }
  return out;
}

/** The qualification report for every face and every corpus group that it serves. */
export async function qualify({faces, registry, corpora, files}) {
  const report = {corpus: corpora.id, corpusVersion: corpora.version, faces: [], ...(files ? {latinFaces: await latinFaceCoverage({registry, files, corpora})} : {})};
  for (const face of faces) {
    const entry = {family: face.family, weight: face.weight, italic: face.italic, scripts: face.scripts, lineMetrics: lineMetrics(face.font), coverage: charsetCoverage(face.font, face.scripts), groups: []};
    for (const group of corpora.groups) {
      if (!face.scripts.includes(group.script)) continue;
      entry.groups.push({script: group.script, direction: group.direction, samples: group.samples.map(sample => qualifySample(face, group, sample, registry))});
    }
    report.faces.push(entry);
  }
  return report;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const {faces, registry} = await loadFaces();
  const {options} = await prepareNodeFonts({pack: 'office', scripts: 'all'});
  const report = await qualify({faces, registry, corpora: await loadCorpora(), files: options.fontFiles});
  if (process.argv[2]) await writeFile(process.argv[2], `${JSON.stringify(report, null, 2)}\n`);
  else console.log(JSON.stringify(report, null, 2));
}
