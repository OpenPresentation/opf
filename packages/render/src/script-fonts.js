// Script fonts for previews (font-fidelity-everywhere FF-19).
//
// Browser-safe and deterministic: no DOM, network, clock or locale data. Text is
// itemized by Unicode script (the JavaScript engine's Unicode tables), each run
// takes the OOXML script slot its script uses (latin, eastAsian or
// complexScript) as resolved by core `resolveScriptFonts`, and a run whose slot
// face is missing or lacks glyphs falls back to the designated open (OFL Noto)
// replacement for that script. Licensed fonts are never bundled: a preview names
// the designated replacement, while the PPTX keeps the chosen family (FF-07).

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
});

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
]);

const eastAsianScripts = new Set(["Hani", "Hans", "Hant", "Hanb", "Jpan", "Kore", "Hang", "Jamo", "Hira", "Kana", "Hrkt", "Bopo", "Yiii"]);
const complexScripts = new Set([
  "Arab", "Hebr", "Syrc", "Thaa", "Nkoo", "Adlm", "Rohg", "Mand", "Samr",
  "Deva", "Beng", "Guru", "Gujr", "Orya", "Taml", "Telu", "Knda", "Mlym", "Sinh",
  "Thai", "Laoo", "Tibt", "Mymr", "Khmr", "Mong", "Bali", "Java", "Lana", "Tale", "Talu", "Cakm", "Olck",
]);
const rtlScripts = new Set(["Arab", "Hebr", "Syrc", "Thaa", "Nkoo", "Adlm", "Rohg", "Mand", "Samr"]);
/** Scripts the latin slot covers directly; never split from the surrounding Latin run. */
const latinGroup = new Set(["Latn", "Cyrl", "Grek", "Zyyy", "Zinh", "Zzzz"]);

/** OOXML script slot for an ISO 15924 script code (the same table as core `scriptFontRole`). */
export function scriptFontRole(script) {
  if (eastAsianScripts.has(script)) return "eastAsian";
  if (complexScripts.has(script)) return "complexScript";
  return "latin";
}

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

/** Script keys (as used by the script font pack) present in the strings of any JSON value. */
export function detectScripts(value, profile) {
  const scripts = new Set();
  const visit = item => {
    if (typeof item === "string") { if (!latinOnly.test(item)) for (const run of itemizeScripts(item, profile)) if (run.script !== "Latn") scripts.add(run.script); }
    else if (Array.isArray(item)) item.forEach(visit);
    else if (item && typeof item === "object") Object.values(item).forEach(visit);
  };
  visit(value);
  if (profile?.script && !latinGroup.has(profile.script)) scripts.add(fontKey(profile.script, "", profile));
  return [...scripts].sort();
}

/** Designated open families for a script key, preferring the serif face for serif schemes. */
export function designatedFamilies(script, serif = false) {
  const entry = SCRIPT_FONT_FAMILIES[script];
  if (!entry) return [];
  return (serif ? [entry.serif, entry.sans] : [entry.sans, entry.serif]).filter(Boolean);
}

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
 */
export function createScriptFonts(profile = {}, measurement) {
  const inner = measurement?.[scriptMeasurement]?.inner ?? measurement;
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
  const candidatesFor = (run, slots) => {
    const list = [run.role === "eastAsian" ? slots.eastAsian : run.role === "complexScript" ? slots.complexScript : slots.latin];
    if (run.script !== "Latn") {
      if (slots.supplement && slots.supplement.script === run.script) list.push(slots.supplement.family);
      list.push(...designatedFamilies(run.script, serif));
    }
    return [...new Set(list.filter(Boolean))];
  };

  /** Font runs for text drawn in `style` (the resolved latin style). `own` runs use the style's family. */
  const plan = (text, style) => {
    text = String(text ?? "");
    if (latinOnly.test(text) && !(eastAsianText && eastAsianAmbiguous.test(text))) return [{text, family: style.fontFamily, own: true}];
    const cacheKey = `${style.fontFamily}\u0000${style.fontWeight ?? 400}\u0000${!!style.italic}\u0000${textRole(style) ?? ""}\u0000${text}`;
    const cached = plans.get(cacheKey);
    if (cached) return cached;
    const slots = slotsFor(style);
    const runs = itemizeScripts(text, profile).map(run => ({...run, candidates: candidatesFor(run, slots)}));
    const global = [...new Set([...runs.flatMap(run => run.candidates), ...designatedFamilies(fontKey(profile.script ?? "Zzzz", text, profile), serif), ...designatedFamilies("Latn", serif)])];
    const out = [];
    const push = (text, family, stack) => {
      const own = family === style.fontFamily && (!stack || stack.length === 1);
      const last = out.at(-1);
      if (last && last.family === family && JSON.stringify(last.stack) === JSON.stringify(stack)) last.text += text;
      else out.push({text, family, own, ...(stack && !own ? {stack} : {})});
    };
    for (const run of runs) {
      if (!measured) { push(run.text, run.candidates[0], run.candidates); continue; }
      const whole = run.candidates.map(family => resolveName(family, style)).find(name => name && covers(name, run.text, style));
      if (whole) { push(run.text, whole); continue; }
      // No single candidate covers the run: choose per character, keeping
      // combining marks and joiners with their base character.
      const primary = resolveName(run.candidates[0], style) ?? style.fontFamily;
      let previous = primary;
      for (const character of run.text) {
        const script = scriptOfCharacter(character);
        let family = previous;
        if (script !== "Zinh") family = [...run.candidates, ...global].map(name => resolveName(name, style)).find(name => name && covers(name, character, style)) ?? primary;
        push(character, family);
        previous = family;
      }
    }
    if (plans.size >= 4096) plans.delete(plans.keys().next().value);
    plans.set(cacheKey, out);
    return out;
  };

  const styleFor = (run, style) => styled(run.own ? style : {...style, fontFamily: run.family});
  /** Measured advance of each planned run, in order; undefined without a measurement provider. */
  const runWidths = (runs, size, style) => measured ? runs.map(run => inner.measure(run.text, size, styleFor(run, style))) : undefined;
  let textMeasurement;
  if (measured) {
    textMeasurement = {
      ...inner,
      measure(text, size, style) {
        const runs = plan(text, style);
        if (runs.length === 1 && runs[0].own) return inner.measure(text, size, styled(style));
        return runs.reduce((total, run) => total + inner.measure(run.text, size, styleFor(run, style)), 0);
      },
      [scriptMeasurement]: {inner, profile},
    };
    if (typeof inner.outlineBounds === "function") {
      textMeasurement.outlineBounds = (text, size, style) => {
        const runs = plan(text, style);
        if (runs.length === 1 && runs[0].own) return inner.outlineBounds(text, size, styled(style));
        let x = 0, box = null;
        for (const run of runs) {
          const runStyle = styleFor(run, style), bounds = inner.outlineBounds(run.text, size, runStyle);
          if (bounds) {
            const left = x + bounds.x, top = bounds.y, right = left + bounds.width, bottom = top + bounds.height;
            box = box ? {left: Math.min(box.left, left), top: Math.min(box.top, top), right: Math.max(box.right, right), bottom: Math.max(box.bottom, bottom)} : {left, top, right, bottom};
          }
          x += inner.measure(run.text, size, runStyle);
        }
        return box && {x: box.left, y: box.top, width: box.right - box.left, height: box.bottom - box.top};
      };
    }
  }
  return {profile, plan, runWidths, textMeasurement, rtl: isRtlProfile(profile)};
}

/**
 * Wrap a font-registry `textMeasurement` so every measurement itemizes text by
 * script and measures each run with its script-slot face (or designated
 * replacement). Pass the same wrapper to core pagination, the renderer and the
 * editor so their line breaks agree for non-Latin text.
 */
export function createScriptTextMeasurement(measurement, profile) {
  if (typeof measurement?.measure !== "function") throw new TypeError("createScriptTextMeasurement requires a textMeasurement with measure().");
  return createScriptFonts(profile, measurement).textMeasurement;
}
