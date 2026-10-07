// Script fonts for previews (font-fidelity-everywhere FF-19).
//
// Browser-safe and deterministic: no DOM, network, clock or locale data. Text is
// itemized by Unicode script (the JavaScript engine's Unicode tables), each run
// takes the OOXML script slot its script uses (latin, eastAsian or
// complexScript) as resolved by core `resolveScriptFonts`, and a run whose slot
// face is missing or lacks glyphs falls back to the designated open (OFL Noto)
// replacement for that script. Licensed fonts are never bundled: a preview names
// the designated replacement, while the PPTX keeps the chosen family (FF-07).
//
// Glyph fallback: a face that lacks a character (a Latin replacement without
// Cyrillic or Greek, a CJK face without a kanji or hanzi) never fails a preview.
// As in a browser or PowerPoint font linking, each such character takes the
// first bundled face that has it along the deterministic chain of
// `glyphFallbackFamilies`, in measurement and drawing alike, and the substitution
// is reported as a note. `glyphFallback: "none"` (strict mode) keeps the exact
// faces and lets a missing glyph raise `missing-glyph`.

import { fontPolicyFor } from "@openpresentation/opf/font-policy";
import { scriptFontRole } from "@openpresentation/opf/composition";
import { SYMBOL_PLACEHOLDER, SYMBOL_SCRIPT, mapSymbolAdvances, symbolEncodingFamily, symbolPreviewFaces } from "./symbol-fonts.js";
export { scriptFontRole };

const freeze = value => { if (value && typeof value === "object") { for (const child of Object.values(value)) freeze(child); Object.freeze(value); } return value; };

/** Designated open replacement families per ISO 15924 script, by style. */
export const SCRIPT_FONT_FAMILIES = freeze({
  Latn: {sans: "Noto Sans"}, Cyrl: {sans: "Noto Sans"}, Grek: {sans: "Noto Sans"},
  Jpan: {sans: "Noto Sans JP", serif: "Noto Serif JP"},
  Hans: {sans: "Noto Sans SC", serif: "Noto Serif SC"},
  Hant: {sans: "Noto Sans TC", serif: "Noto Serif TC"},
  Kore: {sans: "Noto Sans KR", serif: "Noto Serif KR"},
  Arab: {sans: "Noto Sans Arabic", serif: "Noto Naskh Arabic"},
  Hebr: {sans: "Noto Sans Hebrew", serif: "Noto Serif Hebrew"},
  Deva: {sans: "Noto Sans Devanagari", serif: "Noto Serif Devanagari"},
  Beng: {sans: "Noto Sans Bengali", serif: "Noto Serif Bengali"},
  Guru: {sans: "Noto Sans Gurmukhi"}, Gujr: {sans: "Noto Sans Gujarati"}, Orya: {sans: "Noto Sans Oriya"},
  Taml: {sans: "Noto Sans Tamil"}, Telu: {sans: "Noto Sans Telugu"}, Knda: {sans: "Noto Sans Kannada"},
  Mlym: {sans: "Noto Sans Malayalam"}, Sinh: {sans: "Noto Sans Sinhala"},
  Thai: {sans: "Noto Sans Thai", serif: "Noto Serif Thai"}, Laoo: {sans: "Noto Sans Lao"},
  Khmr: {sans: "Noto Sans Khmer"}, Mymr: {sans: "Noto Sans Myanmar"},
  Ethi: {sans: "Noto Sans Ethiopic"}, Armn: {sans: "Noto Sans Armenian"}, Geor: {sans: "Noto Sans Georgian"},
  Mong: {sans: "Noto Sans Mongolian"}, Thaa: {sans: "Noto Sans Thaana"}, Syrc: {sans: "Noto Sans Syriac"},
  Tibt: {serif: "Noto Serif Tibetan"},
  // FF-45 special families. Zsye (emoji symbols) and Zmth (mathematical notation) are ISO 15924 keys for
  // text, not scripts a character carries: emoji and math characters are Common, so they stay in their
  // neighbours' run and reach these faces through the glyph fallback chain (emoji-presentation clusters
  // take the emoji face first). The keys are last so the chain tries every real script face before them.
  Zsye: {sans: "Noto Color Emoji"},
  Zmth: {serif: "STIX Two Math", sans: "Noto Sans Math"},
});

/**
 * Emoji presentation (FF-45): a grapheme cluster that a browser or PowerPoint draws with the emoji font. Characters
 * whose default presentation is emoji (Emoji_Presentation), any cluster with VS16 (U+FE0F), a skin tone modifier
 * (U+1F3FB-1F3FF), a regional indicator (flags), a keycap (U+20E3) or an emoji tag (U+E0020-E007F). Digits, #, *
 * and text-default pictographs (U+2764 heart, U+263A) count only with VS16; VS15 (U+FE0E) asks for text.
 */
const emojiPresentation = /\p{Emoji_Presentation}|\p{Emoji_Modifier}|\p{Regional_Indicator}|️|⃣|[\u{E0020}-\u{E007F}]/u;
/** True when the text holds an emoji-presentation cluster (planned in the emoji face, in measurement and drawing). */
export function hasEmojiPresentation(text) {
  return typeof text === "string" && emojiPresentation.test(text);
}
const textPresentation = /︎/u;
/** Characters that need a math face rather than a text face: math alphanumerics, letterlike math sets and the rarer operator blocks. */
const mathNotation = /[\u{1D400}-\u{1D7FF}⟀-⟯⦀-⧿⨀-⫿ℂℇℊ-ℓℕℙ-ℝℤℨℬℭℯ-ℱℳ-ℸ]/u;
/** True when the text holds mathematical notation that ordinary text faces lack (loads the math pack under `scripts: 'auto'`). */
export function hasMathNotation(text) {
  return typeof text === "string" && mathNotation.test(text);
}

const replacement = (script, substitutes, requestedFamilies) => requestedFamilies.map(requestedFamily => ({
  requestedFamily, script, substitutes, compatibility: "visual",
  note: "Designated open replacement for preview only; the PPTX keeps the requested family. Appearance and advances differ.",
}));
const sansThenSerif = script => [SCRIPT_FONT_FAMILIES[script].sans, SCRIPT_FONT_FAMILIES[script].serif].filter(Boolean);
const serifThenSans = script => [SCRIPT_FONT_FAMILIES[script].serif, SCRIPT_FONT_FAMILIES[script].sans].filter(Boolean);

/**
 * Proprietary script fonts named by font schemes and language records, with
 * their designated open replacements (first loaded substitute wins). Same shape
 * as FONT_COMPATIBILITY rules so a shared font policy table can absorb them.
 */
export const SCRIPT_FONT_REPLACEMENTS = freeze([
  ...replacement("Jpan", sansThenSerif("Jpan"), ["Meiryo", "Meiryo UI", "Yu Gothic", "Yu Gothic UI", "MS Gothic", "MS PGothic", "MS UI Gothic"]),
  ...replacement("Jpan", serifThenSans("Jpan"), ["MS Mincho", "MS PMincho", "Yu Mincho"]),
  ...replacement("Hans", sansThenSerif("Hans"), ["Microsoft YaHei", "Microsoft YaHei UI", "SimHei", "DengXian"]),
  ...replacement("Hans", serifThenSans("Hans"), ["SimSun", "NSimSun", "FangSong", "KaiTi"]),
  ...replacement("Hant", sansThenSerif("Hant"), ["Microsoft JhengHei", "Microsoft JhengHei UI"]),
  ...replacement("Hant", serifThenSans("Hant"), ["PMingLiU", "MingLiU", "PMingLiU-ExtB", "MingLiU-ExtB", "DFKai-SB"]),
  ...replacement("Kore", sansThenSerif("Kore"), ["Malgun Gothic", "Gulim", "GulimChe", "Dotum", "DotumChe"]),
  ...replacement("Kore", serifThenSans("Kore"), ["Batang", "BatangChe", "Gungsuh", "GungsuhChe"]),
  ...replacement("Arab", serifThenSans("Arab"), ["Arabic Typesetting", "Traditional Arabic", "Simplified Arabic", "Sakkal Majalla", "Urdu Typesetting", "Andalus", "Aldhabi"]),
  ...replacement("Hebr", serifThenSans("Hebr"), ["David", "Narkisim", "FrankRuehl"]),
  ...replacement("Hebr", sansThenSerif("Hebr"), ["Miriam", "Gisha", "Levenim MT", "Aharoni", "Rod"]),
  ...replacement("Deva", sansThenSerif("Deva"), ["Mangal", "Aparajita", "Kokila", "Utsaah", "Nirmala UI"]),
  ...replacement("Beng", sansThenSerif("Beng"), ["Shonar Bangla", "Vrinda"]),
  ...replacement("Guru", sansThenSerif("Guru"), ["Raavi"]),
  ...replacement("Gujr", sansThenSerif("Gujr"), ["Shruti"]),
  ...replacement("Orya", sansThenSerif("Orya"), ["Kalinga"]),
  ...replacement("Taml", sansThenSerif("Taml"), ["Latha", "Vijaya"]),
  ...replacement("Telu", sansThenSerif("Telu"), ["Gautami", "Vani"]),
  ...replacement("Knda", sansThenSerif("Knda"), ["Tunga"]),
  ...replacement("Mlym", sansThenSerif("Mlym"), ["Kartika"]),
  ...replacement("Sinh", sansThenSerif("Sinh"), ["Iskoola Pota"]),
  ...replacement("Thai", sansThenSerif("Thai"), ["Angsana New", "AngsanaUPC", "Cordia New", "CordiaUPC", "Browallia New", "BrowalliaUPC", "DilleniaUPC", "EucrosiaUPC", "FreesiaUPC", "IrisUPC", "JasmineUPC", "KodchiangUPC", "LilyUPC", "Leelawadee", "Leelawadee UI"]),
  ...replacement("Laoo", sansThenSerif("Laoo"), ["DokChampa", "Lao UI"]),
  ...replacement("Khmr", sansThenSerif("Khmr"), ["DaunPenh", "Khmer UI", "MoolBoran"]),
  ...replacement("Mymr", sansThenSerif("Mymr"), ["Myanmar Text"]),
  ...replacement("Ethi", sansThenSerif("Ethi"), ["Nyala"]),
  // Sylfaen covers Latin, Greek, Cyrillic, Armenian and Georgian. Its Latin text
  // uses Noto Sans; Armenian and Georgian runs fall back by coverage.
  ...replacement("Latn", ["Noto Sans"], ["Sylfaen"]),
  ...replacement("Mong", sansThenSerif("Mong"), ["Mongolian Baiti"]),
  ...replacement("Thaa", sansThenSerif("Thaa"), ["MV Boli"]),
  ...replacement("Syrc", sansThenSerif("Syrc"), ["Estrangelo Edessa"]),
  ...replacement("Tibt", serifThenSans("Tibt"), ["Microsoft Himalaya"]),
  // FF-45: Segoe UI Emoji previews with Noto Color Emoji (COLRv1 and SVG colour glyphs; Noto Emoji is the monochrome
  // face the raster path draws), Cambria Math with STIX Two Math (serif math face with a MATH table; Noto Sans Math
  // is the sans alternative). Both are visual: advances differ from the Microsoft fonts (see the policy rows).
  ...replacement("Zsye", ["Noto Color Emoji", "Noto Emoji"], ["Segoe UI Emoji"]),
  ...replacement("Zmth", ["STIX Two Math", "Noto Sans Math"], ["Cambria Math"]),
]);

/**
 * RR-38: the preview size multiplier of a policy row (`replacement.sizeAdjust`) when `drawnFamily` is its replacement, the face the
 * multiplier was measured on; otherwise undefined. `row` is a policy row, or the requested family name. A renderer scales the
 * replacement's font size by it in measurement and drawing alike, so a replacement much wider than the real font (Noto Naskh Arabic
 * for Arabic Typesetting: 1/0.64) draws lines of the length PowerPoint draws. The exported size and core's geometry never change.
 */
export function sizeAdjustFor(row, drawnFamily) {
  const policy = typeof row === "string" ? fontPolicyFor(row) : row;
  const replacement = policy?.replacement, adjust = replacement?.sizeAdjust;
  return typeof adjust === "number" && adjust !== 1 && typeof replacement.family === "string" && replacement.family.toLowerCase() === String(drawnFamily).toLowerCase() ? adjust : undefined;
}

/**
 * RR-38: where PowerPoint puts the baseline of a line below its top, in em, for the policy row's replacement drawn as `drawnFamily`
 * (`{lineAscent, lineAscentMixed}`: a line in the real font alone, and a line that also holds other fonts), or undefined. Measured in
 * a native PowerPoint probe (Arabic Typesetting 0.70 and 0.78); core places baselines one em below the line top.
 */
export function lineAscentFor(row, drawnFamily) {
  const policy = typeof row === "string" ? fontPolicyFor(row) : row;
  const replacement = policy?.replacement;
  if (!sizeAdjustFor(policy, drawnFamily) || typeof replacement.lineAscent !== "number") return undefined;
  return {lineAscent: replacement.lineAscent, lineAscentMixed: typeof replacement.lineAscentMixed === "number" ? replacement.lineAscentMixed : replacement.lineAscent};
}

/**
 * RR-38: how far (em of the composed font size) the baseline of a line moves up so runs drawn in a policy replacement sit where PowerPoint
 * puts the real font's baseline. `lines` is the planned runs of one line (one array per fragment). A line whose runs all carry a
 * `lineAscent` takes it; a line that also holds other runs takes `lineAscentMixed`; a line with none is untouched (0).
 */
export function baselineShift(...lines) {
  const runs = lines.flat().filter(run => run.text !== "");
  const adjusted = runs.filter(run => typeof run.lineAscent === "number");
  if (!adjusted.length) return 0;
  const ascent = adjusted.length === runs.length ? Math.min(...adjusted.map(run => run.lineAscent)) : Math.min(...adjusted.map(run => run.lineAscentMixed ?? run.lineAscent));
  return Math.max(0, 1 - ascent);
}

/**
 * RR-38: the font size a run with a policy size multiplier is measured and drawn at: `size x adjust` on a quarter-pixel grid. Chromium on
 * Linux quantizes a fractional font size (a scan of Noto Naskh Arabic against fontkit: every multiple of 0.25 px within 0.09 px over
 * 340 px lines, other fractions up to 0.27 px), so a size off that grid would break the 0.1 px browser-versus-measured advance gate.
 * Measurement and drawing both go through this function, so they agree on the size whatever the grid.
 */
export function adjustedFontSize(size, adjust) {
  return typeof adjust === "number" && adjust > 0 ? Math.max(0.25, Math.round(size * adjust * 4) / 4) : size;
}

/** The emoji faces (FF-45): they draw emoji-presentation clusters only, never a run's Latin text or digits. */
export const EMOJI_FONT_FAMILIES = SCRIPT_FONT_REPLACEMENTS.find(rule => rule.script === "Zsye").substitutes;
const emojiFaces = new Set(EMOJI_FONT_FAMILIES);

const rtlScripts = new Set(["Arab", "Hebr", "Syrc", "Thaa", "Nkoo", "Adlm", "Rohg", "Mand", "Samr"]);
/** Scripts the latin slot covers directly; never split from the surrounding Latin run. */
const latinGroup = new Set(["Latn", "Cyrl", "Grek", "Zyyy", "Zinh", "Zzzz"]);

const detected = ["Latn", "Cyrl", "Grek", "Hani", "Hira", "Kana", "Hang", "Bopo", "Yiii", "Arab", "Hebr", "Syrc", "Thaa", "Nkoo", "Adlm", "Rohg", "Mand", "Samr",
  "Deva", "Beng", "Guru", "Gujr", "Orya", "Taml", "Telu", "Knda", "Mlym", "Sinh", "Thai", "Laoo", "Tibt", "Mymr", "Khmr", "Mong", "Bali", "Java", "Lana",
  "Tale", "Talu", "Cakm", "Olck", "Armn", "Geor", "Ethi", "Cher", "Tfng", "Vaii", "Zinh", "Zyyy"].map(code => [code, new RegExp(String.raw`^\p{Script=${code}}$`, "u")]);
const ignorable = /^\p{Default_Ignorable_Code_Point}$/u;
const scriptCache = new Map();

/** ISO 15924 script of one character: `Zyyy` common, `Zinh` inherited, `Zzzz` otherwise unknown. */
export function scriptOfCharacter(character) {
  let script = scriptCache.get(character);
  if (script === undefined) {
    const code = character.codePointAt(0);
    script = code < 0x80 ? (/[A-Za-z]/.test(character) ? "Latn" : "Zyyy")
      : ignorable.test(character) ? "Zinh"
        : (detected.find(([, pattern]) => pattern.test(character))?.[0] ?? "Zzzz");
    if (scriptCache.size < 65536) scriptCache.set(character, script);
  }
  return script;
}

/** Latin, Greek, Cyrillic, general punctuation and letterlike text: no script split is possible. */
const latinOnly = /^[\u0000-\u036F\u0370-\u052F\u1E00-\u1FFF\u2000-\u2065\u206A-\u20CF\u2100-\u218F]*$/;

/** Han script for this text: kana marks Japanese, Hangul marks Korean, otherwise the language decides. */
function hanScript(text, profile) {
  if (/[\p{Script=Hira}\p{Script=Kana}]/u.test(text)) return "Jpan";
  if (/\p{Script=Hang}/u.test(text)) return "Kore";
  const script = profile?.script;
  if (script === "Jpan" || script === "Kore" || script === "Hans" || script === "Hant") return script;
  const tag = String(profile?.bcp47 ?? "").toLowerCase();
  if (/^ja\b/.test(tag)) return "Jpan";
  if (/^ko\b/.test(tag)) return "Kore";
  if (/^zh\b/.test(tag) && /-(hant|tw|hk|mo)\b/.test(tag)) return "Hant";
  return "Hans";
}

function fontKey(script, text, profile) {
  if (script === "Hira" || script === "Kana") return "Jpan";
  if (script === "Hang") return "Kore";
  if (script === "Hani" || script === "Bopo") return hanScript(text, profile);
  return latinGroup.has(script) ? "Latn" : script;
}

// East Asian common characters that PowerPoint always draws with the East Asian
// (a:ea) font: CJK symbols and punctuation, kana marks, enclosed CJK, CJK
// compatibility, vertical and small forms, and halfwidth/fullwidth forms.
const eastAsianCommon = /[\u3000-\u303F\u3040-\u30FF\u31F0-\u31FF\u3200-\u33FF\uFE30-\uFE4F\uFF00-\uFFEF]/u;
// Characters whose font PowerPoint picks from the run language: with an East
// Asian language they use the a:ea font (curly quotes, dashes, ellipsis,
// daggers, per-mille, primes, reference mark).
const eastAsianAmbiguous = /[\u2010-\u2016\u2018-\u2022\u2025\u2026\u2030\u2032\u2033\u203B]/u;
const eastAsianLanguage = profile => profile?.scriptRole === "eastAsian" || /^(ja|zh|ko)\b/i.test(String(profile?.bcp47 ?? ""));

/**
 * Split text into font runs by Unicode script, following PowerPoint's
 * character-to-slot rules where they are known:
 * - Letters take their script's slot. Latin, Greek and Cyrillic share one run.
 * - East Asian common characters (CJK punctuation U+3000-303F, fullwidth forms
 *   U+FF00-FFEF and similar) are East Asian, also at the start of a text; with
 *   an East Asian language, curly quotes, dashes and the ellipsis are too.
 * - ASCII spaces, digits and punctuation use the latin slot next to East Asian
 *   text, and stay in a complex-script run (as PowerPoint draws them with the
 *   complex-script font inside Arabic, Hebrew, Indic or Thai text).
 * - Other common and inherited characters (combining marks, other punctuation)
 *   join the preceding run, or the following run at the start of the text.
 * `profile` (for example core `resolveScriptFonts` output) supplies the
 * language, which disambiguates Han and the language-dependent characters.
 */
export function itemizeScripts(text, profile) {
  const source = String(text);
  const runs = [];
  let pending = "";
  const eastAsian = eastAsianLanguage(profile);
  const push = (character, key) => {
    const last = runs.at(-1);
    if (last && last.script === key) last.text += character;
    else runs.push({text: character, script: key, role: scriptFontRole(key)});
  };
  const strong = (character, key) => {
    // Leading neutrals join a complex-script run; otherwise they are Latin.
    if (!runs.length && pending) {
      if (scriptFontRole(key) === "complexScript") { runs.push({text: pending, script: key, role: "complexScript"}); }
      else push(pending, "Latn");
      pending = "";
    }
    push(character, key);
  };
  for (const character of source) {
    const script = scriptOfCharacter(character);
    if (eastAsianCommon.test(character) || (eastAsian && eastAsianAmbiguous.test(character))) {
      strong(character, script === "Hira" || script === "Kana" ? "Jpan" : hanScript(source, profile));
    } else if (script === "Zinh") {
      if (runs.length) runs.at(-1).text += character; else pending += character;
    } else if (script === "Zyyy") {
      const last = runs.at(-1);
      if (!last) pending += character;
      else if (character.codePointAt(0) < 0x80 && last.role === "eastAsian") push(character, "Latn");
      else last.text += character;
    } else strong(character, fontKey(script, source, profile));
  }
  if (!runs.length) return [{text: pending, script: "Latn", role: "latin"}];
  return runs;
}

/**
 * Non-Latin script keys the renderer would plan runs for in `text`. It applies the same shortcut as drawing
 * (`createScriptFonts().plan`): Latin, Greek and Cyrillic text is one run in the design font, except that
 * with an East Asian document language the curly quotes, dashes and ellipsis are East Asian characters.
 */
export function scriptsOfText(text, profile) {
  const source = String(text ?? "");
  // FF-45: emoji-presentation clusters and mathematical notation are Common characters inside a Latin (or other) run; their
  // faces are needed all the same, so they are reported as the pseudo-scripts Zsye and Zmth, which the emoji and math packs serve.
  const special = [...(hasEmojiPresentation(source) ? ["Zsye"] : []), ...(hasMathNotation(source) ? ["Zmth"] : [])];
  if (latinOnly.test(source) && !(eastAsianLanguage(profile) && eastAsianAmbiguous.test(source))) return special;
  return [...itemizeScripts(source, profile).filter(run => run.script !== "Latn").map(run => run.script), ...special];
}

/**
 * Script keys (as used by the script font pack) present in the strings of any JSON value.
 * The profile's own script is included too, unless `includeLanguage` is false (then only
 * text decides). `ignoreKeys` names object keys whose values are not visited.
 */
export function detectScripts(value, profile, { includeLanguage = true, ignoreKeys = [] } = {}) {
  const scripts = new Set(), ignored = new Set(ignoreKeys);
  const visit = item => {
    if (typeof item === "string") { for (const script of scriptsOfText(item, profile)) scripts.add(script); }
    else if (Array.isArray(item)) item.forEach(visit);
    else if (item && typeof item === "object") for (const [key, child] of Object.entries(item)) if (!ignored.has(key)) visit(child);
  };
  visit(value);
  if (includeLanguage && profile?.script && !latinGroup.has(profile.script)) scripts.add(fontKey(profile.script, "", profile));
  return [...scripts].sort();
}

/** Designated open families for a script key, preferring the serif face for serif schemes. */
export function designatedFamilies(script, serif = false) {
  const entry = SCRIPT_FONT_FAMILIES[script];
  if (!entry) return [];
  return (serif ? [entry.serif, entry.sans] : [entry.sans, entry.serif]).filter(Boolean);
}

const hanKeys = ["Jpan", "Hans", "Hant", "Kore"];

/**
 * Deterministic glyph fallback chain for one character: the designated open
 * families, in order, that a preview tries when the chosen face lacks the
 * character (the same order in measurement and drawing).
 *
 * 1. the character's own script policy face (`SCRIPT_FONT_FAMILIES`; a Han
 *    character takes the deck language's face: Japanese, Simplified, Traditional
 *    or Korean);
 * 2. the deck language's script face;
 * 3. Noto Sans, which covers Latin, Cyrillic and Greek;
 * 4. the other CJK faces (Japanese, Simplified, Traditional, Korean);
 * 5. every other Noto script face, in `SCRIPT_FONT_FAMILIES` order.
 *
 * `profile` is core `resolveScriptFonts` output (or the same shape); serif
 * profiles prefer the serif face of each script. Families that are not loaded
 * are skipped by the caller.
 */
export function glyphFallbackFamilies(character, profile = {}, serif = profile?.serif === true) {
  const script = scriptOfCharacter(character);
  const language = fontKey(profile?.script ?? "Zzzz", "", profile);
  // A Han character has no script of its own: it takes the deck language's face when that is CJK,
  // otherwise every CJK face is tried in turn (Japanese, Simplified, Traditional, Korean).
  const own = script === "Hani" ? (hanKeys.includes(language) ? language : "Zzzz") : fontKey(script, character, profile);
  const keys = [own, language, "Latn", ...hanKeys, ...Object.keys(SCRIPT_FONT_FAMILIES)];
  // 6. the open symbol faces (FF-45), when a host loaded them: mathematical operators, arrows, dingbats and pictographs.
  return [...new Set([...new Set(keys)].flatMap(key => designatedFamilies(key, serif)).concat(SYMBOL_FALLBACK_FACES))];
}
/** The symbol faces at the end of the glyph fallback chain, in order: pictographs, then the mathematical operators. */
const SYMBOL_FALLBACK_FACES = ["Noto Sans Symbols 2", "Noto Sans Symbols", "Noto Sans Math"];

/**
 * Aliases from proprietary script fonts to the first loaded designated
 * replacement. `families` are the loaded script-replacement families.
 */
export function scriptFontAliases(families) {
  const loaded = new Map([...families].map(family => [String(family).toLowerCase(), String(family)]));
  const aliases = {};
  for (const rule of SCRIPT_FONT_REPLACEMENTS) {
    const substitute = rule.substitutes.find(family => loaded.has(family.toLowerCase()));
    if (substitute && !Object.hasOwn(aliases, rule.requestedFamily)) aliases[rule.requestedFamily] = loaded.get(substitute.toLowerCase());
  }
  return aliases;
}

// BCP-47 language subtag -> OpenType language system tag, following HarfBuzz
// (hb-ot-tag), so measurement selects the same language-specific lookups a
// browser applies for the SVG's lang (for example KOR spacing in Noto Sans KR).
const openTypeLanguages = freeze({
  af: "AFK", am: "AMH", ar: "ARA", as: "ASM", ay: "AYM", az: "AZE", be: "BEL", ber: "BBR", bg: "BGR", bn: "BEN", bo: "TIB", bs: "BOS",
  ca: "CAT", ceb: "CEB", crh: "CRT", cs: "CSY", cy: "WEL", da: "DAN", de: "DEU", dv: "DIV", el: "ELL", en: "ENG", es: "ESP", et: "ETI",
  eu: "EUQ", fa: "FAR", ff: "FUL", fi: "FIN", fil: "PIL", fr: "FRA", ga: "IRI", gl: "GAL", gu: "GUJ", ha: "HAU", he: "IWR", iw: "IWR",
  hi: "HIN", hr: "HRV", hu: "HUN", hy: "HYE0", id: "IND", in: "IND", ig: "IBO", is: "ISL", it: "ITA", ja: "JAN", ka: "KAT", kk: "KAZ",
  km: "KHM", kmr: "KUR", kn: "KAN", ko: "KOR", ku: "KUR", lo: "LAO", lt: "LTH", lv: "LVI", mg: "MLG", mi: "MRI", mk: "MKD", ml: "MAL",
  mn: "MNG", mo: "MOL", mr: "MAR", ms: "MLY", zsm: "MLY", my: "BRM", nb: "NOR", ne: "NEP", nl: "NLD", no: "NOR", nv: "NAV", om: "ORO",
  or: "ORI", pa: "PAN", pl: "PLK", ps: "PAS", pt: "PTG", ro: "ROM", ru: "RUS", rw: "RUA", sa: "SAN", sd: "SND", si: "SNH", sk: "SKY",
  sl: "SLV", sn: "SNA0", so: "SML", sq: "SQI", sr: "SRB", sv: "SVE", sw: "SWK", syr: "SYR", ta: "TAM", te: "TEL", tg: "TAJ", th: "THA",
  tl: "PIL", tr: "TRK", tt: "TAT", uk: "UKR", ur: "URD", uz: "UZB", vi: "VIT", xh: "XHS", yo: "YBA", zu: "ZUL",
});

/** OpenType language system tag for a BCP-47 tag, or undefined when none applies. */
export function openTypeLanguage(tag) {
  if (typeof tag !== "string" || !tag) return undefined;
  const [language = "", ...rest] = tag.toLowerCase().split("-");
  if (language === "zh") {
    if (rest.includes("hk") || rest.includes("mo")) return "ZHH";
    return rest.includes("hant") || rest.includes("tw") ? "ZHT" : "ZHS";
  }
  return openTypeLanguages[language];
}

/**
 * Heading or body role of a text style from its OPF path: title, subtitle and
 * tag placeholders are headings (the exporter's heading shapes), everything
 * else is body. Undefined when the style carries no slide path.
 */
export function textRole(style) {
  const path = typeof style?.path === "string" ? style.path : undefined;
  if (!path || !/^slides\.\d+\./.test(path)) return undefined;
  return /^slides\.\d+\.(?:title|subtitle|tag)(?:\.\d+)?$/.test(path) ? "heading" : "body";
}

/** True when the profile's language is written right to left. */
export function isRtlProfile(profile) {
  return profile?.rtl === true || profile?.direction === "rtl" || (!profile?.direction && rtlScripts.has(profile?.script));
}

const softErrors = new Set(["font-unavailable", "font-style-unavailable", "unresolved-theme-font", "font-encoding-required", "math-font-required", "invalid-font-family"]);
const scriptMeasurement = Symbol.for("@openpresentation/opf-render/script-measurement");

/**
 * Plan script font runs for one presentation (or slide).
 *
 * `profile` is core `resolveScriptFonts` output (or the same shape):
 * `{heading, body: {latin, eastAsian, complexScript}, supplement?, script, bcp47, rtl}`
 * plus an optional `serif` flag. `measurement` is an optional font-registry
 * `textMeasurement`; without it the plan names every candidate family in order
 * so the host resolves glyphs per character.
 *
 * `options.glyphFallback` is `"chain"` (default: a character its face lacks
 * takes the first bundled face along `glyphFallbackFamilies`) or `"none"`
 * (exact faces: a missing glyph raises `missing-glyph`). `options.onFallback`
 * receives each new substitution note `{fontFamily, fallbackFamily, scripts,
 * characters, path?}` once; `fallbacks` lists them all.
 */
export function createScriptFonts(profile = {}, measurement, options = {}) {
  const wrapped = measurement?.[scriptMeasurement];
  const inner = wrapped?.inner ?? measurement;
  // Glyph fallback is on unless `glyphFallback: "none"` (strict faces); a wrapped measurement keeps its options.
  // Only defined keys override: a caller passing `glyphFallback: undefined` must not undo a wrapper's `"none"`.
  // A renderer-supplied `onFallback` chains with, and does not replace, the wrapper's own.
  const notifiers = [wrapped?.options?.onFallback, options?.onFallback].filter(notify => typeof notify === "function");
  options = {...wrapped?.options, ...Object.fromEntries(Object.entries(options ?? {}).filter(([, value]) => value !== undefined)), onFallback: notifiers.length ? note => { for (const notify of notifiers) notify(note); } : undefined};
  const fallbackEnabled = options.glyphFallback !== "none";
  const fallbackNotes = new Map();
  const measured = typeof inner?.measure === "function";
  const serif = profile.serif === true;
  // The language the SVG declares (lang) also selects OpenType language systems in measurement.
  const lang = profile.languageSource === "document" || profile.languageSource === "option" ? profile.bcp47 : undefined;
  const styled = style => lang && style.lang === undefined ? {...style, lang} : style;
  const eastAsianText = eastAsianLanguage(profile);
  const plans = new Map();
  const resolvedNames = new Map();
  const coverage = new Map();

  const resolveName = (family, style) => {
    const key = `${family}\u0000${style.fontWeight ?? 400}\u0000${!!style.italic}`;
    if (resolvedNames.has(key)) return resolvedNames.get(key);
    let name = null;
    if (typeof inner?.resolveStyle !== "function") name = family;
    else {
      try { name = inner.resolveStyle({...style, fontFamily: family}).fontFamily ?? family; }
      catch (error) { if (!softErrors.has(error?.code)) throw error; }
    }
    resolvedNames.set(key, name);
    return name;
  };
  const covers = (family, text, style) => {
    const key = `${family}\u0000${style.fontWeight ?? 400}\u0000${!!style.italic}\u0000${text}`;
    if (coverage.has(key)) return coverage.get(key);
    let result = true;
    try { inner.measure(text, 1, {...style, fontFamily: family}); }
    catch (error) { if (error?.code !== "missing-glyph" && !softErrors.has(error?.code)) throw error; result = false; }
    if (coverage.size >= 8192) coverage.delete(coverage.keys().next().value);
    coverage.set(key, result);
    return result;
  };
  const headingLatin = () => profile.heading?.latin === undefined ? undefined : measured ? resolveName(profile.heading.latin, {fontWeight: 700}) : profile.heading.latin;
  const slotsFor = style => {
    const role = textRole(style);
    // The text's role picks the major (heading) or minor (body) slots, as the
    // exporter's heading shapes do. Only a style without an OPF path falls back
    // to comparing its latin family with the heading's.
    const useHeading = profile.heading && profile.body && JSON.stringify(profile.heading) !== JSON.stringify(profile.body) &&
      (role ? role === "heading" : style.fontFamily === headingLatin());
    const slots = (useHeading ? profile.heading : profile.body) ?? {};
    const supplement = profile.supplement ? {script: profile.supplement.script === "Hang" ? "Kore" : profile.supplement.script, family: useHeading ? profile.supplement.heading : profile.supplement.body} : undefined;
    return {latin: style.fontFamily, eastAsian: slots.eastAsian ?? style.fontFamily, complexScript: slots.complexScript ?? style.fontFamily, supplement};
  };
  const nonAscii = /[^\u0020-\u007E]/;
  const cyrillicOrGreek = /[\u0370-\u052F\u1F00-\u1FFF]/;
  const chains = new Map();
  const chainFor = character => {
    const script = scriptOfCharacter(character);
    let chain = chains.get(script);
    if (!chain) chains.set(script, chain = glyphFallbackFamilies(character, profile, serif));
    return chain;
  };
  /** Collect that `family` draws characters the chosen `from` face lacks; `flushFallbacks` records them per planned text. */
  const noteFallback = (pending, from, family, characters) => {
    if (from === null || from === family) return;
    const key = `${from}\u0000${family}`;
    let entry = pending.get(key);
    if (!entry) pending.set(key, entry = {from, family, characters: new Set()});
    for (const character of characters) entry.characters.add(character);
  };
  const flushFallbacks = (pending, style) => {
    for (const {from, family, characters} of pending.values()) {
      const key = `${from}\u0000${family}\u0000${style.path ?? ""}`;
      let note = fallbackNotes.get(key);
      const isNew = !note;
      if (isNew) fallbackNotes.set(key, note = {fontFamily: from, fallbackFamily: family, scripts: [], characters: [], ...(style.path ? {path: style.path} : {})});
      for (const character of characters) {
        const script = scriptOfCharacter(character);
        if (!note.scripts.includes(script)) note.scripts.push(script);
        if (note.characters.length < 16 && !note.characters.includes(character)) note.characters.push(character);
      }
      if (isNew) options.onFallback?.(note);
    }
  };
  const candidatesFor = (run, slots) => {
    const list = [run.role === "eastAsian" ? slots.eastAsian : run.role === "complexScript" ? slots.complexScript : slots.latin];
    if (run.script !== "Latn") {
      // RR-38: a slot family whose policy replacement carries a size multiplier (Arabic Typesetting -> Noto Naskh Arabic, 0.64) names that
      // replacement next: the multiplier was measured on it, and it is the face a registry resolves the family to, so a preview without a
      // measurement provider draws the same face and size as a measured one (it drew the sans face, Noto Sans Arabic, at full size). Other
      // proprietary script families keep the designated order below until they carry a measured multiplier of their own.
      const scriptRule = list[0] ? SCRIPT_FONT_REPLACEMENTS.find(rule => rule.script === run.script && rule.requestedFamily.toLowerCase() === String(list[0]).toLowerCase()) : undefined;
      if (scriptRule && sizeAdjustFor(list[0], scriptRule.substitutes[0])) list.push(scriptRule.substitutes[0]);
      if (slots.supplement && slots.supplement.script === run.script) list.push(slots.supplement.family);
      list.push(...designatedFamilies(run.script, serif));
    }
    return [...new Set(list.filter(Boolean))];
  };

  /**
   * FF-45: runs for text in a symbol-encoded family (Symbol, Wingdings, Wingdings 2, Wingdings 3, Webdings). Each
   * character's code (U+F0xx private use or its Windows-1252 character) maps to its Unicode equivalent, drawn with the
   * first loaded face of the family's preview chain that has it (`symbolPreviewFaces`), one run per glyph so the
   * preview can place each at the verified font's advance (`run.symbol.advance`, em). A code with no equivalent, or
   * whose equivalent no loaded face has, draws the placeholder U+25A1 and says so (`run.symbol.placeholder`, the
   * fallback note carries `codes`). Characters that are not codes (a CJK letter, an emoji) are planned as ordinary text.
   * Without a measurement provider every symbol run names the whole chain as its stack.
   */
  const planSymbols = (text, style, encoding) => {
    const cacheKey = `${SYMBOL_SCRIPT}\u0000${encoding}\u0000${style.fontFamily}\u0000${style.fontWeight ?? 400}\u0000${!!style.italic}\u0000${textRole(style) ?? ""}\u0000${style.path ?? ""}\u0000${text}`;
    const cached = plans.get(cacheKey);
    if (cached) return cached;
    const chain = symbolPreviewFaces(encoding);
    const resolvedChain = measured ? chain.map(name => resolveName(name, style)).filter((name, index, all) => name && all.indexOf(name) === index) : chain;
    const out = [], notes = new Map();
    let foreign = "";
    const flushForeign = () => {
      if (!foreign) return;
      for (const run of plan(foreign, {...style, symbolEncoding: null})) out.push(run);
      foreign = "";
    };
    const note = (family, item, drawn, placeholder) => {
      const key = `${family}\u0000${placeholder ? "placeholder" : "glyph"}`;
      let entry = notes.get(key);
      if (!entry) notes.set(key, entry = {fontFamily: encoding, fallbackFamily: family, scripts: [SYMBOL_SCRIPT], characters: [], codes: [], ...(placeholder ? {placeholder: drawn || "none"} : {}), ...(style.path ? {path: style.path} : {})});
      const hex = item.code.toString(16).toUpperCase().padStart(2, "0");
      if (!entry.codes.includes(hex) && entry.codes.length < 32) { entry.codes.push(hex); if (entry.characters.length < 16) entry.characters.push(item.source); }
    };
    for (const item of mapSymbolAdvances(encoding, text)) {
      if (item.code === null) { foreign += item.source; continue; }
      flushForeign();
      let drawn = item.unicode, family = null, placeholder = false;
      if (!measured) { out.push({text: drawn ?? SYMBOL_PLACEHOLDER, family: chain[0], own: false, stack: chain, symbol: {family: encoding, code: item.code, source: item.source, advance: item.advance, ...(drawn === null ? {placeholder: true, reason: item.reason} : {})}}); continue; }
      if (drawn !== null) family = resolvedChain.find(name => covers(name, drawn, style)) ?? null;
      if (family === null) {
        placeholder = true;
        const reason = drawn === null ? item.reason : `no loaded face has U+${drawn.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}; load the symbol faces (scripts: ['${SYMBOL_SCRIPT}'])`;
        // The placeholder is U+25A1 WHITE SQUARE from a loaded symbol face; without one, U+FFFD from the style's face (Noto Sans,
        // Roboto and the office faces have it); a registry with neither draws nothing at the code's advance.
        const own = resolveName(style.fontFamily, style) ?? style.fontFamily;
        const choice = [[SYMBOL_PLACEHOLDER, resolvedChain.find(name => covers(name, SYMBOL_PLACEHOLDER, style))], ["�", [own, ...resolvedChain].find(name => covers(name, "�", style))]].find(([, name]) => name);
        drawn = choice ? choice[0] : "";
        family = choice ? choice[1] : own;
        out.push({text: drawn, family, own: false, symbol: {family: encoding, code: item.code, source: item.source, advance: item.advance, placeholder: true, reason}});
      } else out.push({text: drawn, family, own: false, symbol: {family: encoding, code: item.code, source: item.source, advance: item.advance}});
      note(family, item, drawn, placeholder);
    }
    flushForeign();
    for (const entry of notes.values()) {
      const key = `${entry.fontFamily}\u0000${entry.fallbackFamily}\u0000${entry.placeholder ?? ""}\u0000${style.path ?? ""}`;
      if (fallbackNotes.has(key)) continue;
      fallbackNotes.set(key, entry);
      options.onFallback?.(entry);
    }
    if (plans.size >= 4096) plans.delete(plans.keys().next().value);
    plans.set(cacheKey, out);
    return out;
  };

  /** Font runs for text drawn in `style` (the resolved latin style). `own` runs use the style's family. */
  const plan = (text, style) => {
    text = String(text ?? "");
    // A symbol-encoded family (resolved styles carry `symbolEncoding`; an unresolved style names the family itself) is mapped code by
    // code; `symbolEncoding: null` is the planner's own request for ordinary runs (characters that are not codes).
    const encoding = style.symbolEncoding === null ? undefined : style.symbolEncoding ?? symbolEncodingFamily(style.fontFamily);
    if (encoding) return text ? planSymbols(text, style, encoding) : [{text, family: style.fontFamily, own: true}];
    // An emoji face (Noto Color Emoji for a Segoe UI Emoji run) draws emoji-presentation clusters only: its Latin text and digits
    // are planned per cluster below, where they take a text face (FF-45).
    const ownFace = measured && fallbackEnabled ? resolveName(style.fontFamily, style) : undefined;
    if (latinOnly.test(text) && !(eastAsianText && eastAsianAmbiguous.test(text)) && !(ownFace && emojiFaces.has(ownFace))) {
      // Latin-group text is one run in the latin slot's face, unless that face lacks a character
      // (Cyrillic or Greek beyond a Latin replacement): then it is planned per character below.
      if (!fallbackEnabled || !nonAscii.test(text)) return [{text, family: style.fontFamily, own: true}];
      if (!measured) return cyrillicOrGreek.test(text) ? [{text, family: style.fontFamily, own: false, stack: [style.fontFamily, ...designatedFamilies("Latn", serif)]}] : [{text, family: style.fontFamily, own: true}];
      if (ownFace === null || covers(ownFace, text, style)) return [{text, family: style.fontFamily, own: true}];
    }
    const cacheKey = `${style.fontFamily}\u0000${style.fontWeight ?? 400}\u0000${!!style.italic}\u0000${textRole(style) ?? ""}\u0000${style.path ?? ""}\u0000${text}`;
    const cached = plans.get(cacheKey);
    if (cached) return cached;
    const slots = slotsFor(style);
    const runs = itemizeScripts(text, profile).map(run => ({...run, candidates: candidatesFor(run, slots)}));
    const pending = new Map();
    const global = [...new Set([...runs.flatMap(run => run.candidates), ...designatedFamilies(fontKey(profile.script ?? "Zzzz", text, profile), serif), ...designatedFamilies("Latn", serif)])];
    const unique = names => names.map(name => resolveName(name, style)).filter((name, index, all) => name && all.indexOf(name) === index);
    const out = [];
    const push = (text, family, stack, sizeAdjust, ascent) => {
      const own = family === style.fontFamily && (!stack || stack.length === 1);
      const last = out.at(-1);
      if (last && last.family === family && last.sizeAdjust === sizeAdjust && last.lineAscent === ascent?.lineAscent && JSON.stringify(last.stack) === JSON.stringify(stack)) last.text += text;
      else out.push({text, family, own, ...(stack && !own ? {stack} : {}), ...(sizeAdjust ? {sizeAdjust} : {}), ...(ascent ?? {})});
    };
    for (const run of runs) {
      // RR-38: the slot family's replacement draws at the policy's size multiplier. Unmeasured, the replacement is the first face
      // the stack names after the requested family; the requested name leaves the stack so a host that has the real font installed
      // (a browser on Windows) cannot draw it at the reduced size.
      const adjustOf = family => sizeAdjustFor(run.candidates[0], family);
      const ascentOf = family => lineAscentFor(run.candidates[0], family);
      if (!measured) {
        const adjust = adjustOf(run.candidates[1]);
        push(run.text, adjust ? run.candidates[1] : run.candidates[0], adjust ? run.candidates.slice(1) : run.candidates, adjust, ascentOf(run.candidates[1]));
        continue;
      }
      const chosen = resolveName(run.candidates[0], style);
      // FF-45: a run with an emoji-presentation cluster, or whose face is an emoji face, is always planned per cluster: VS16 and
      // emoji-default clusters take the emoji face even when the text face has a monochrome glyph for the base character, and the
      // emoji face never draws the run's Latin text or digits.
      const emojiRun = emojiFaces.has(chosen) || hasEmojiPresentation(run.text);
      const whole = emojiRun ? undefined : run.candidates.map(family => resolveName(family, style)).find(name => name && covers(name, run.text, style));
      if (whole) {
        if (whole !== chosen) noteFallback(pending, chosen, whole, [...run.text].filter(character => !covers(chosen ?? whole, character, style)));
        push(run.text, whole, undefined, adjustOf(whole), ascentOf(whole));
        continue;
      }
      // No single candidate covers the run. Split it into grapheme clusters (a base character with
      // the combining marks and joiners that follow it) and group those into script segments
      // (common characters stay with their neighbours; white space ends a word). Each segment takes the first face that
      // covers all of its letters and marks: the chosen face, the previous fallback face, the
      // other candidates, then the fallback chain. A word is never drawn in two faces when one
      // face has all of it (Greek beside a Latin serif, a kanji run beside Hangul). A cluster
      // that face still lacks, mark included, moves whole to the first face that has the cluster,
      // so a base and its mark are never split across faces.
      const primary = chosen ?? style.fontFamily;
      let sticky = null;
      // The note lists what the chosen face lacks (a mark, not its covered base letter); a cluster it only lacks as a whole lists all.
      const missingFrom = (face, text) => { const lacking = [...text].filter(character => !covers(face, character, style)); return lacking.length ? lacking : [...text]; };
      // An emoji-presentation cluster tries the emoji faces first (Noto Color Emoji, loaded with the emoji pack), then the text
      // faces; any other cluster tries them last, so a run's digits and Latin text (which the emoji face draws emoji-sized) take a
      // text face, while a text-presentation symbol only the emoji face has (U+2764 with VS15) is still drawn rather than missing.
      const choose = (subject, sample, emoji = false) => {
        const names = unique([run.candidates[0], ...(sticky ? [sticky] : []), ...run.candidates, ...global, ...(fallbackEnabled ? chainFor(sample) : [])]);
        const emojiNames = names.filter(name => emojiFaces.has(name)), textNames = names.filter(name => !emojiFaces.has(name));
        return (emoji ? [...emojiNames, ...textNames] : [...textNames, ...emojiNames]).find(name => covers(name, subject, style));
      };
      const segments = [];
      for (const character of run.text) {
        const script = scriptOfCharacter(character), last = segments.at(-1)?.clusters.at(-1);
        if (script === "Zinh" && last) { last.text += character; continue; }
        const weak = script === "Zyyy" || script === "Zinh", segment = segments.at(-1);
        const cluster = {text: character, base: character, weak};
        // A segment is one script and one word: white space closes it, so a single lacking mark
        // moves its word to another face, not the whole sentence.
        if (segment && !(segment.closed && !weak) && (weak || segment.script === undefined || segment.script === script)) {
          segment.clusters.push(cluster);
          if (!weak) segment.script = script; else if (/^\s/.test(character)) segment.closed = true;
        } else segments.push({script: weak ? undefined : script, clusters: [cluster]});
      }
      for (const segment of segments) {
        const strong = segment.clusters.filter(cluster => !cluster.weak);
        const face = strong.length ? choose(strong.map(cluster => cluster.text).join(""), strong[0].base) : undefined;
        for (const cluster of segment.clusters) {
          const emoji = hasEmojiPresentation(cluster.text);
          const family = !emoji && face && covers(face, cluster.text, style) ? face : choose(cluster.text, cluster.base, emoji) ?? choose(cluster.base, cluster.base, emoji) ?? primary;
          if (family !== primary && family !== chosen) sticky = family;
          if (chosen !== null && family !== chosen && covers(family, cluster.text, style)) noteFallback(pending, chosen, family, missingFrom(chosen, cluster.text));
          push(cluster.text, family, undefined, adjustOf(family), ascentOf(family));
        }
      }
    }
    flushFallbacks(pending, style);
    if (plans.size >= 4096) plans.delete(plans.keys().next().value);
    plans.set(cacheKey, out);
    return out;
  };

  // A run drawn for another family drops the encoding: the open face's own glyphs are measured.
  const styleFor = (run, style) => styled(run.own ? style : {...style, fontFamily: run.family, symbolEncoding: null});
  /**
   * The advance a planned run occupies: the open face's measured advance, except that a symbol run (FF-45) occupies the
   * verified symbol font's advance for its code, so lines break and bullets sit where PowerPoint puts them; `natural`
   * asks for the open face's advance of that run instead (the SVG compresses a wider glyph to fit, never stretches one).
   */
  const runWidth = (run, size, style, natural = false) => run.symbol && !natural && run.symbol.advance !== null ? run.symbol.advance * size : inner.measure(run.text, adjustedFontSize(size, run.sizeAdjust), styleFor(run, style));
  /** Advance of each planned run, in order (see `runWidth`); undefined without a measurement provider. */
  const runWidths = (runs, size, style, {natural = false} = {}) => measured ? runs.map(run => runWidth(run, size, style, natural)) : undefined;
  let textMeasurement;
  if (measured) {
    textMeasurement = {
      ...inner,
      measure(text, size, style) {
        const runs = plan(text, style);
        // RR-38: a run drawn at the policy's size multiplier is not the style's own face at its own size: it takes the run path below.
        if (runs.length === 1 && runs[0].own && !runs[0].sizeAdjust) return inner.measure(text, size, styled(style));
        return runs.reduce((total, run) => total + runWidth(run, size, style), 0);
      },
      [scriptMeasurement]: {inner, profile, options},
    };
    if (typeof inner.outlineBounds === "function") {
      textMeasurement.outlineBounds = (text, size, style) => {
        const runs = plan(text, style);
        if (runs.length === 1 && runs[0].own && !runs[0].sizeAdjust) return inner.outlineBounds(text, size, styled(style));
        let x = 0, box = null;
        for (const run of runs) {
          const runStyle = styleFor(run, style), bounds = inner.outlineBounds(run.text, adjustedFontSize(size, run.sizeAdjust), runStyle);
          if (bounds) {
            const left = x + bounds.x, top = bounds.y, right = left + bounds.width, bottom = top + bounds.height;
            box = box ? {left: Math.min(box.left, left), top: Math.min(box.top, top), right: Math.max(box.right, right), bottom: Math.max(box.bottom, bottom)} : {left, top, right, bottom};
          }
          x += runWidth(run, size, style);
        }
        return box && {x: box.left, y: box.top, width: box.right - box.left, height: box.bottom - box.top};
      };
    }
  }
  return {profile, plan, runWidths, textMeasurement, rtl: isRtlProfile(profile), get fallbacks() { return [...fallbackNotes.values()].map(note => ({...note, scripts: [...note.scripts], characters: [...note.characters]})); }};
}

/**
 * Wrap a font-registry `textMeasurement` so every measurement itemizes text by
 * script and measures each run with its script-slot face (or designated
 * replacement). Pass the same wrapper to core pagination, the renderer and the
 * editor so their line breaks agree for non-Latin text.
 */
export function createScriptTextMeasurement(measurement, profile, options) {
  if (typeof measurement?.measure !== "function") throw new TypeError("createScriptTextMeasurement requires a textMeasurement with measure().");
  return createScriptFonts(profile, measurement, options).textMeasurement;
}
