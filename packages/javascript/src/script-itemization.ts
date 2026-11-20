// Shared pure script itemization, extracted byte-for-byte in algorithm from the renderer.
import {scriptFontRole, type ScriptRole, type ScriptMeasurementProfile} from './script-fonts.js';
export type ScriptItemizationProfile = Partial<Pick<ScriptMeasurementProfile, 'script' | 'scriptRole' | 'bcp47'>>;
export interface ScriptTextRun {text: string; script: string; role: ScriptRole}
const latinGroup = new Set(["Latn", "Cyrl", "Grek", "Zyyy", "Zinh", "Zzzz"]);
const detected = ["Latn", "Cyrl", "Grek", "Hani", "Hira", "Kana", "Hang", "Bopo", "Yiii", "Arab", "Hebr", "Syrc", "Thaa", "Nkoo", "Adlm", "Rohg", "Mand", "Samr",
  "Deva", "Beng", "Guru", "Gujr", "Orya", "Taml", "Telu", "Knda", "Mlym", "Sinh", "Thai", "Laoo", "Tibt", "Mymr", "Khmr", "Mong", "Bali", "Java", "Lana",
  "Tale", "Talu", "Cakm", "Olck", "Armn", "Geor", "Ethi", "Cher", "Tfng", "Vaii", "Zinh", "Zyyy"];
// One precompiled pattern for every script, a capture group each, tried in the list's order (the first match wins, as with one
// pattern per script): a character is classified by one match instead of up to 48 tests.
const detectedPattern = new RegExp(`^(?:${detected.map(code => String.raw`(\p{Script=${code}})`).join("|")})$`, "u");
const ignorable = /^\p{Default_Ignorable_Code_Point}$/u;
const scriptCache = new Map<string,string>();
function classify(character: string): string {
  const match = detectedPattern.exec(character);
  if (!match) return "Zzzz";
  for (let group = 1; group < match.length; group++) if (match[group] !== undefined) return detected[group - 1]!;
  return "Zzzz";
}

/** ISO 15924 script of one character: `Zyyy` common, `Zinh` inherited, `Zzzz` otherwise unknown. */
export function scriptOfCharacter(character: string): string {
  let script = scriptCache.get(character);
  if (script === undefined) {
    const code = character.codePointAt(0)!;
    script = code < 0x80 ? (/[A-Za-z]/.test(character) ? "Latn" : "Zyyy")
      : ignorable.test(character) ? "Zinh"
        : classify(character);
    if (scriptCache.size < 65536) scriptCache.set(character, script);
  }
  return script;
}

function hanScript(text: string, profile?: ScriptItemizationProfile): string {
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

function fontKey(script: string, text: string, profile?: ScriptItemizationProfile, han = () => hanScript(text, profile)): string {
  if (script === "Hira" || script === "Kana") return "Jpan";
  if (script === "Hang") return "Kore";
  if (script === "Hani" || script === "Bopo") return han();
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
const eastAsianLanguage = (profile?: ScriptItemizationProfile) => profile?.scriptRole === "eastAsian" || /^(ja|zh|ko)\b/i.test(String(profile?.bcp47 ?? ""));

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
export function itemizeScripts(text: unknown, profile?: ScriptItemizationProfile): ScriptTextRun[] {
  const source = String(text);
  const runs: ScriptTextRun[] = [];
  let pending = "";
  const eastAsian = eastAsianLanguage(profile);
  // The Han key depends on the whole text and the profile only: work it out once per text, not once per Han character.
  let han: string | undefined;
  const hanOfText = () => han ??= hanScript(source, profile);
  const push = (character: string, key: string) => {
    const last = runs.at(-1);
    if (last && last.script === key) last.text += character;
    else runs.push({text: character, script: key, role: scriptFontRole(key)});
  };
  const strong = (character: string, key: string) => {
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
      strong(character, script === "Hira" || script === "Kana" ? "Jpan" : hanOfText());
    } else if (script === "Zinh") {
      if (runs.length) runs.at(-1)!.text += character; else pending += character;
    } else if (script === "Zyyy") {
      const last = runs.at(-1);
      if (!last) pending += character;
      else if (character.codePointAt(0)! < 0x80 && last.role === "eastAsian") push(character, "Latn");
      else last.text += character;
    } else strong(character, fontKey(script, source, profile, hanOfText));
  }
  if (!runs.length) return [{text: pending, script: "Latn", role: "latin"}];
  return runs;
}

