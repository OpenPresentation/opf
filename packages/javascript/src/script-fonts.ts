import { checkCatalogsOption, resolveReference, type CatalogOptions } from "./catalog-refs.js";
import { resolveFontFamilies } from "./composition.js";
import { isRecord } from "./content-walk.js";
import { resolveDesignRecords } from "./design-records.js";
import { LANGUAGES, type LanguageVocabulary } from "./engine-vocabularies.js";

/**
 * Language/script font model (font-fidelity-everywhere FF-18).
 *
 * Resolves, for a presentation's language and effective font scheme, the font
 * family for each OOXML script slot (`a:latin`, `a:ea`, `a:cs`) of the major
 * (heading) and minor (body) theme fonts, plus the language tags and base
 * direction. Pure: no DOM, fonts, network or mutation. Font-scheme references
 * resolve like every content reference (the document's catalogs groups, then the
 * registered catalogs); nothing is fetched.
 *
 * The language is an engine vocabulary: tags the vocabulary knows resolve
 * deterministically from vendored tables. Only a tag outside it may consult the
 * runtime's ICU likely subtags (`Intl.Locale#maximize`) to find its script.
 *
 * Design: docs/programs/font-fidelity-everywhere/script-font-model.md.
 */

/** OOXML script slot a writing system uses: `a:latin`, `a:ea` or `a:cs`. */
export type ScriptRole = "latin" | "eastAsian" | "complexScript";

/** FontScheme.languageFamily as written: the short OOXML names and the long slot names are one value. */
export type LanguageFamilyName = "latin" | "ea" | "cs" | "eastAsian" | "complexScript";

/**
 * Read a FontScheme `languageFamily` as one of three values. `eastAsian` is `ea` and `complexScript` is
 * `cs`; anything that is not one of the five names returns undefined.
 */
export function normalizeLanguageFamily(value: unknown): "latin" | "ea" | "cs" | undefined {
  if (value === "latin") return "latin";
  if (value === "ea" || value === "eastAsian") return "ea";
  if (value === "cs" || value === "complexScript") return "cs";
  return undefined;
}

/** Target application whose language font-scheme defaults apply. */
export type ScriptFontApp = "powerpoint" | "google-slides";

/** Font family per OOXML script slot for one theme font (major or minor). */
export interface ScriptFontSlots {
  latin: string;
  eastAsian: string;
  complexScript: string;
}

/**
 * Where a resolved eastAsian/complexScript family came from:
 * - `fontScheme`: an explicit `eastAsian`/`complexScript` slot on the effective design font scheme.
 * - `schemeFamily`: the design font scheme's own major/minor, because its `languageFamily` names this
 *   slot and its `languages` list is empty or names the presentation language.
 * - `language`: the presentation language's font scheme (`fontScheme`, or `googleFontScheme` for Google Slides).
 * - `latin`: no script-specific choice exists, so the slot repeats the latin family.
 */
export type ScriptFontSource = "fontScheme" | "schemeFamily" | "language" | "latin";

/** A per-script supplemental theme font, as in OOXML `<a:font script="Jpan" typeface="..."/>`. */
export interface ScriptFontSupplement {
  /** OOXML theme script tag (ISO 15924, except Korean uses `Hang`). */
  script: string;
  heading: string;
  body: string;
}

export interface ResolveScriptFontsOptions extends CatalogOptions {
  /** Which language font default applies. Defaults to `powerpoint` (`language.fontScheme`, else the vocabulary default); `google-slides` prefers `language.googleFontScheme`. */
  app?: ScriptFontApp;
  /** Merge `slides[slideIndex].design` over the deck design, per field, before resolving the font scheme. */
  slideIndex?: number;
  /** Language to resolve instead of the document's `language` (a BCP-47 tag or a Language object). */
  language?: unknown;
  /** Language tag used when neither the document nor `options.language` names a resolvable language. Defaults to `en-US`. */
  defaultLanguage?: string;
}

export interface ResolvedScriptFonts extends ScriptFontSlots {
  /**
   * Tag for OOXML `a:rPr/@lang` (and `a:endParaRPr/@lang`): an authored tag that carries a region,
   * else the curated `ooxmlLang` of the language vocabulary, else the canonical BCP-47 tag.
   */
  lang: string;
  /** Canonically cased BCP-47 tag for HTML/SVG `lang`: the authored tag. */
  bcp47: string;
  /** `default` when the tag came from `defaultLanguage` because no language resolved. */
  languageSource: "document" | "option" | "default";
  /** ISO 15924 script (`Zzzz` when it cannot be determined). */
  script: string;
  /** Script slot the language's own text uses. */
  scriptRole: ScriptRole;
  direction: "ltr" | "rtl";
  rtl: boolean;
  /** Major (heading) theme font slots. */
  heading: ScriptFontSlots;
  /** Minor (body) theme font slots. The top-level latin/eastAsian/complexScript repeat these. */
  body: ScriptFontSlots;
  /**
   * Supplemental theme font for the language's script. Present only when an explicit slot, the
   * design scheme's own script family or the language's font scheme supplies one; absent for
   * Latin, Cyrillic, Greek and for scripts with no script font. For Armenian, Georgian and
   * Ethiopic (latin slot) an explicit `complexScript` slot or a design `cs` scheme that serves the
   * language replaces the language's own font scheme.
   */
  supplement?: ScriptFontSupplement;
  sources: { eastAsian: ScriptFontSource; complexScript: ScriptFontSource };
}

const eastAsianScripts = new Set(["Hani", "Hans", "Hant", "Hanb", "Jpan", "Kore", "Hang", "Jamo", "Hira", "Kana", "Hrkt", "Bopo", "Yiii"]);

const complexScripts = new Set([
  "Arab", "Hebr", "Syrc", "Thaa", "Nkoo", "Adlm", "Rohg", "Mand", "Samr",
  "Deva", "Beng", "Guru", "Gujr", "Orya", "Taml", "Telu", "Knda", "Mlym", "Sinh",
  "Thai", "Laoo", "Tibt", "Mymr", "Khmr", "Mong", "Bali", "Java", "Lana", "Tale", "Talu", "Cakm", "Olck",
]);

const rtlScripts = new Set(["Arab", "Hebr", "Syrc", "Thaa", "Nkoo", "Adlm", "Rohg", "Mand", "Samr"]);

/** Scripts the latin slot covers directly, so no supplemental theme font is needed. */
const latinSlotScripts = new Set(["Latn", "Cyrl", "Grek", "Zyyy", "Zzzz"]);

/** Deprecated language subtags replaced in returned tags (IANA registry Preferred-Value). */
const deprecatedLanguages: Record<string, string> = { iw: "he", in: "id", ji: "yi" };

/** Language subtags treated as equal when matching a tag to the vocabulary. */
const matchingLanguages: Record<string, string> = { ...deprecatedLanguages, no: "nb", zsm: "ms", ku: "kmr" };

/**
 * Vendored CLDR likely scripts for the vocabulary languages written in more than
 * one script, so their tags resolve without the runtime's locale data.
 */
const likelyScripts: Record<string, { script: string; regions?: Record<string, string> }> = {
  zh: { script: "Hans", regions: { TW: "Hant", HK: "Hant", MO: "Hant" } },
  sr: { script: "Cyrl", regions: { ME: "Latn" } },
  pa: { script: "Guru", regions: { PK: "Arab" } },
  az: { script: "Latn", regions: { IR: "Arab" } },
  uz: { script: "Latn", regions: { AF: "Arab" } },
  bs: { script: "Latn" },
  mn: { script: "Cyrl", regions: { CN: "Mong" } },
  ms: { script: "Latn" },
};

const bareLanguageId = /^[a-z][a-z0-9-]*$/;

export { paragraphDirection, type TextDirection } from "./direction.js";

/** The OOXML script slot for an ISO 15924 script code. Unknown scripts use the latin slot. */
export function scriptFontRole(script: string): ScriptRole {
  const code = normalizeScript(script);
  if (code && eastAsianScripts.has(code)) return "eastAsian";
  if (code && complexScripts.has(code)) return "complexScript";
  return "latin";
}

function normalizeScript(value: unknown): string | undefined {
  if (typeof value !== "string" || !/^[A-Za-z]{4}$/.test(value)) return undefined;
  return value.slice(0, 1).toUpperCase() + value.slice(1).toLowerCase();
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

interface TagParts {
  language: string;
  script?: string;
  region?: string;
}

const tagSyntax = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/;

/** Split a BCP-47 tag without locale data. `und` and malformed tags yield undefined. */
function splitTag(tag: string): TagParts | undefined {
  if (!tagSyntax.test(tag)) return undefined;
  const [first = "", ...rest] = tag.split("-");
  const language = first.toLowerCase();
  if (language === "und") return undefined;
  let script: string | undefined;
  let region: string | undefined;
  for (const subtag of rest) {
    if (subtag.length === 1) break;
    if (!script && !region && /^[A-Za-z]{4}$/.test(subtag)) script = normalizeScript(subtag);
    else if (!region && /^(?:[A-Za-z]{2}|\d{3})$/.test(subtag)) region = subtag.toUpperCase();
  }
  return { language, script, region };
}

/** BCP-47 canonical casing (language lower, Script title, REGION upper), with deprecated language subtags replaced. */
function canonicalTag(tag: string): string {
  let extension = false;
  return tag
    .split("-")
    .map((subtag, index) => {
      const lower = subtag.toLowerCase();
      if (index === 0) return deprecatedLanguages[lower] ?? lower;
      if (extension) return lower;
      if (subtag.length === 1) {
        extension = true;
        return lower;
      }
      if (/^[A-Za-z]{4}$/.test(subtag)) return normalizeScript(subtag) as string;
      if (/^[A-Za-z]{2}$/.test(subtag)) return subtag.toUpperCase();
      return lower;
    })
    .join("-");
}

function vendoredScript(language: string, region?: string): string | undefined {
  const entry = likelyScripts[language];
  return entry ? ((region && entry.regions?.[region]) ?? entry.script) : undefined;
}

/** Script of a tag outside the vocabulary: explicit, vendored, then the runtime's ICU likely subtags. */
function inferScript(tag: string): string | undefined {
  const parts = splitTag(tag);
  if (!parts) return undefined;
  const known = parts.script ?? vendoredScript(matchingLanguages[parts.language] ?? parts.language, parts.region);
  if (known) return known;
  try {
    return normalizeScript(new Intl.Locale(tag).maximize().script);
  } catch {
    return undefined;
  }
}

/**
 * Match a BCP-47 tag to the engine's language vocabulary without locale data: an exact (case-insensitive,
 * deprecated subtags replaced) tag first, then the same language and script preferring the same region, then an
 * entry without a region. A tag without a script matches any script unless the vendored table names one.
 */
function matchLanguageTag(tag: string): LanguageVocabulary | undefined {
  const wanted = splitTag(tag);
  if (!wanted) return undefined;
  const key = canonicalTag(tag).toLowerCase();
  const exact = LANGUAGES.find((entry) => canonicalTag(entry.tag).toLowerCase() === key);
  if (exact) return exact;
  const language = matchingLanguages[wanted.language] ?? wanted.language;
  const script = wanted.script ?? vendoredScript(language, wanted.region);
  const candidates = LANGUAGES.flatMap((entry) => {
    const parts = splitTag(entry.tag);
    if (!parts || (matchingLanguages[parts.language] ?? parts.language) !== language) return [];
    const entryScript = normalizeScript(entry.script) ?? parts.script ?? vendoredScript(language, parts.region);
    if (script && entryScript && script !== entryScript) return [];
    return [{ entry, region: parts.region }];
  });
  return (
    candidates.find((candidate) => wanted.region && candidate.region === wanted.region)?.entry ??
    candidates.find((candidate) => !candidate.region)?.entry ??
    candidates[0]?.entry
  );
}

interface ResolvedLanguage {
  /** The authored tag, canonical casing applied later. */
  tag: string;
  /** The vocabulary entry the tag matched, if any. */
  known?: LanguageVocabulary;
  /** The document's own Language object, whose fields override the vocabulary. */
  overrides: Record<string, unknown>;
}

function resolveLanguage(reference: unknown): ResolvedLanguage | undefined {
  if (typeof reference === "string") {
    const value = reference.trim();
    // `und`, empty and malformed tags name no language.
    if (!splitTag(value)) return undefined;
    const known = matchLanguageTag(value);
    // Outside the vocabulary, accept only a tag whose script is known.
    if (!known && !inferScript(value)) return undefined;
    return { tag: value, ...(known ? { known } : {}), overrides: {} };
  }
  if (!isRecord(reference)) return undefined;
  const tag = text(reference.bcp47);
  if (!tag || !splitTag(tag)) return undefined;
  const known = matchLanguageTag(tag);
  return { tag, ...(known ? { known } : {}), overrides: reference };
}

function pairFamilies(value: unknown): { heading: string; body: string } | undefined {
  if (!isRecord(value)) return undefined;
  const major = text(value.major);
  const minor = text(value.minor);
  const heading = major ?? minor;
  const body = minor ?? major;
  return heading && body ? { heading, body } : undefined;
}

/**
 * Whether a font scheme's `languages` list (BCP-47 tags) admits the language: an empty list admits every language;
 * otherwise an entry must have the language's language subtag and, when the entry names a script, its script.
 */
function schemeServesLanguage(scheme: Record<string, unknown>, tag: string, script: string): boolean {
  const entries = Array.isArray(scheme.languages) ? scheme.languages.filter((entry): entry is string => typeof entry === "string") : [];
  if (entries.length === 0) return true;
  const wanted = splitTag(tag);
  if (!wanted) return false;
  const language = matchingLanguages[wanted.language] ?? wanted.language;
  return entries.some((entry) => {
    const parts = splitTag(entry);
    if (!parts || (matchingLanguages[parts.language] ?? parts.language) !== language) return false;
    const entryScript = parts.script ?? vendoredScript(language, parts.region);
    return !entryScript || entryScript === script;
  });
}

/**
 * Resolve the per-script theme fonts, language tags and direction for a
 * presentation (or a `{ design, language, catalogs }` subset of one).
 *
 * The latin slot follows the effective design font scheme exactly as
 * `resolveFontFamilies` does; when nothing names a font scheme it falls back to
 * the engine default font scheme. Each of the eastAsian and complexScript slots
 * takes, in order: the design font scheme's explicit slot; the scheme's own
 * families when its `languageFamily` names the slot and its `languages` list
 * is empty or names the language; the language's font scheme when the
 * language's script uses the slot; otherwise the latin family.
 */
export function resolveScriptFonts(input: unknown, options: ResolveScriptFontsOptions = {}): ResolvedScriptFonts {
  const document = isRecord(input) ? input : {};
  if (options.slideIndex !== undefined) {
    const slides = Array.isArray(document.slides) ? document.slides : [];
    if (!Number.isInteger(options.slideIndex) || options.slideIndex < 0 || options.slideIndex >= slides.length) {
      throw new RangeError(`slideIndex must be an integer between 0 and ${slides.length - 1}.`);
    }
  }
  const catalogs = { catalogs: checkCatalogsOption(options.catalogs, 'resolveScriptFonts') };
  const scheme = resolveDesignRecords(document, options.slideIndex, catalogs).fontScheme;
  const latin = resolveFontFamilies(scheme);

  const fromOption = options.language !== undefined ? resolveLanguage(options.language) : undefined;
  const fromDocument = fromOption ? undefined : resolveLanguage(document.language);
  const requestedDefault = text(options.defaultLanguage);
  const fallbackTag = requestedDefault && splitTag(requestedDefault) ? requestedDefault : "en-US";
  const language = fromOption ?? fromDocument ?? resolveLanguage(fallbackTag) ?? { tag: fallbackTag, overrides: {} };
  const languageSource = fromOption ? "option" : fromDocument ? "document" : "default";
  const overrides = language.overrides;
  const known = language.known;

  const bcp47 = canonicalTag(language.tag);
  const authoredOoxml = text(overrides.ooxmlLang);
  const lang = authoredOoxml
    ? canonicalTag(authoredOoxml)
    : splitTag(language.tag)?.region
      ? bcp47
      : known
        ? canonicalTag(known.ooxmlLang)
        : bcp47;

  // A vocabulary language's script is its own entry's, or the tag's explicit or vendored script, never the
  // runtime's locale data. Only tags outside the vocabulary may fall through to ICU likely subtags.
  const parts = splitTag(bcp47);
  const script =
    normalizeScript(overrides.script) ??
    (known ? (normalizeScript(known.script) ?? parts?.script ?? (parts ? vendoredScript(matchingLanguages[parts.language] ?? parts.language, parts.region) : undefined)) : inferScript(bcp47)) ??
    "Zzzz";
  const scriptRole = scriptFontRole(script);
  const declaredDirection = overrides.direction ?? known?.direction;
  const direction: "ltr" | "rtl" =
    declaredDirection === "rtl" || declaredDirection === "ltr" ? declaredDirection : rtlScripts.has(script) ? "rtl" : "ltr";

  const app = options.app ?? "powerpoint";
  // The language's script fonts: a font scheme the document's Language object names for the target app, else the
  // vocabulary default for the app, else the scheme it names for the other app.
  const named = (key: "fontScheme" | "googleFontScheme") => (typeof overrides[key] === "string" ? resolveReference(document, "fontSchemes", overrides[key], catalogs)?.record : undefined);
  const languageScheme =
    app === "google-slides" ? (named("googleFontScheme") ?? known?.fonts.google ?? named("fontScheme")) : (named("fontScheme") ?? known?.fonts.powerpoint ?? named("googleFontScheme"));
  const languageFamilies = pairFamilies(languageScheme);
  const schemeAdmitsLanguage = schemeServesLanguage(scheme, bcp47, script);

  const slot = (role: Exclude<ScriptRole, "latin">, family: "ea" | "cs") => {
    const explicit = pairFamilies(scheme[role]);
    if (explicit) return { ...explicit, source: "fontScheme" as const };
    if (normalizeLanguageFamily(scheme.languageFamily) === family && schemeAdmitsLanguage) return { ...latin, source: "schemeFamily" as const };
    if (scriptRole === role && languageFamilies) return { ...languageFamilies, source: "language" as const };
    return { heading: latin.heading, body: latin.body, source: "latin" as const };
  };
  const eastAsian = slot("eastAsian", "ea");
  const complexScript = slot("complexScript", "cs");

  const heading = { latin: latin.heading, eastAsian: eastAsian.heading, complexScript: complexScript.heading };
  const body = { latin: latin.body, eastAsian: eastAsian.body, complexScript: complexScript.body };

  let supplement: ScriptFontSupplement | undefined;
  if (!latinSlotScripts.has(script)) {
    // A script the latin slot covers (Armenian, Georgian, Ethiopic) has no slot of its own, so its theme entry is the only
    // place its script font is named. The deck chooses the family for it through the complex-script slot, the only slot
    // the native FF-46 decks use for these scripts: an explicit `complexScript` pair (source `fontScheme`), or a `cs`
    // scheme for the deck's language (its `languageFamily` is `cs` and its `languages` list is empty or names the
    // language: `schemeFamily`). The entry then names that family, not the language's default (FF-46, opf#375: an
    // Amharic deck on Ebrima wrote `Ethi` as Nyala, and PowerPoint listed Nyala in Presentation.Fonts). A latin-only
    // scheme, an `ea` slot and a `cs` scheme for another language name no family for these scripts, so the language's
    // default stays. The `eastAsian` and `complexScript` scripts read their own resolved slot below, which already
    // follows an explicit slot.
    const chosen = complexScript.source === "fontScheme" || complexScript.source === "schemeFamily" ? complexScript : undefined;
    const families =
      scriptRole === "latin"
        ? (chosen ? { heading: chosen.heading, body: chosen.body } : languageFamilies)
        : (scriptRole === "eastAsian" ? eastAsian : complexScript).source === "latin"
          ? undefined
          : { heading: heading[scriptRole], body: body[scriptRole] };
    if (families) supplement = { script: script === "Kore" ? "Hang" : script, heading: families.heading, body: families.body };
  }

  return {
    ...body,
    lang,
    bcp47,
    languageSource,
    script,
    scriptRole,
    direction,
    rtl: direction === "rtl",
    heading,
    body,
    ...(supplement ? { supplement } : {}),
    sources: { eastAsian: eastAsian.source, complexScript: complexScript.source },
  };
}

/**
 * The deck base direction composition lays a slide out in: the direction of the presentation language's script
 * (`rtl` for Arabic, Hebrew and the other right-to-left scripts), `ltr` when the document names no language or
 * the language does not resolve. Layout, preview and export all read this one value (RR-05).
 */
export function resolveSlideDirection(presentation: unknown, slideIndex?: number): "ltr" | "rtl" {
  if (!isRecord(presentation) || presentation.language === undefined) return "ltr";
  try {
    return resolveScriptFonts(presentation, Number.isInteger(slideIndex) ? { slideIndex } : {}).direction;
  } catch {
    try {
      return resolveScriptFonts(presentation).direction;
    } catch {
      return "ltr";
    }
  }
}
