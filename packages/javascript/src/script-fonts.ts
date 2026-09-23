import { DEFAULT_FONT_SCHEME, resolveFontFamilies, resolveFontSchemeReference } from "./composition.js";
import { isRecord } from "./content-walk.js";
import { catalogs } from "./generated/catalogs.js";

/**
 * Language/script font model (font-fidelity-everywhere FF-18).
 *
 * Resolves, for a presentation's language and effective font scheme, the font
 * family for each OOXML script slot (`a:latin`, `a:ea`, `a:cs`) of the major
 * (heading) and minor (body) theme fonts, plus the language tags and base
 * direction. Pure: no DOM, fonts, network or mutation. Catalog references
 * resolve against inline `catalogs.<kind>.records[]` first and the bundled
 * catalogs second; a custom `source` is not fetched.
 *
 * Catalog ids and catalog tags resolve deterministically from vendored tables.
 * Only a tag that matches no catalog record may consult the runtime's ICU
 * likely subtags (`Intl.Locale#maximize`) to find its script.
 *
 * Design: docs/programs/font-fidelity-everywhere/script-font-model.md.
 */

/** OOXML script slot a writing system uses: `a:latin`, `a:ea` or `a:cs`. */
export type ScriptRole = "latin" | "eastAsian" | "complexScript";

/** Target application whose language font-scheme defaults apply. */
export type ScriptFontApp = "PowerPoint" | "Google Slides";

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

export interface ResolveScriptFontsOptions {
  /** Which language font-scheme default applies. Defaults to `PowerPoint` (`language.fontScheme`). */
  app?: ScriptFontApp;
  /** Merge `slides[slideIndex].design` over the deck design, per field, before resolving the font scheme. */
  slideIndex?: number;
  /** Language reference to resolve instead of the document's `language` (catalog id, BCP-47 tag or Language object). */
  language?: unknown;
  /** Language tag used when neither the document nor `options.language` names a resolvable language. Defaults to `en-US`. */
  defaultLanguage?: string;
}

export interface ResolvedScriptFonts extends ScriptFontSlots {
  /**
   * Tag for OOXML `a:rPr/@lang` (and `a:endParaRPr/@lang`): an authored tag that carries a region,
   * else the language record's curated `ooxmlLang`, else the canonical BCP-47 tag.
   */
  lang: string;
  /** Canonically cased BCP-47 tag for HTML/SVG `lang`: the authored tag, else the record's `bcp47`. */
  bcp47: string;
  /** Matched languages catalog record id, when one matched. */
  languageId?: string;
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
   * Latin, Cyrillic, Greek and for scripts with no script font.
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

/** Language subtags treated as equal when matching a tag to a catalog record. */
const matchingLanguages: Record<string, string> = { ...deprecatedLanguages, no: "nb", zsm: "ms", ku: "kmr" };

/**
 * Vendored CLDR likely scripts for the catalog languages written in more than
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

/** Paragraph base direction. */
export type TextDirection = "ltr" | "rtl";

/**
 * Letters of right-to-left scripts (Unicode Bidi_Class R or AL), plus RLM
 * (U+200F) and ALM (U+061C). Digits, marks and punctuation of those scripts
 * are weak or neutral, so only letters count.
 */
const strongRtl =
  /[‏؜]|(?=\p{L})[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Syriac}\p{Script=Thaana}\p{Script=Nko}\p{Script=Adlam}\p{Script=Hanifi_Rohingya}\p{Script=Mandaic}\p{Script=Samaritan}\p{Script=Mende_Kikakui}\p{Script=Imperial_Aramaic}\p{Script=Phoenician}\p{Script=Kharoshthi}\p{Script=Old_South_Arabian}\p{Script=Old_North_Arabian}\p{Script=Avestan}\p{Script=Inscriptional_Parthian}\p{Script=Inscriptional_Pahlavi}\p{Script=Psalter_Pahlavi}\p{Script=Old_Turkic}\p{Script=Old_Hungarian}\p{Script=Nabataean}\p{Script=Palmyrene}\p{Script=Hatran}\p{Script=Manichaean}\p{Script=Sogdian}\p{Script=Old_Sogdian}\p{Script=Elymaic}\p{Script=Chorasmian}\p{Script=Yezidi}\p{Script=Cypriot}\p{Script=Lydian}\p{Script=Meroitic_Cursive}\p{Script=Meroitic_Hieroglyphs}]/u;
/** Letters of every other script (Bidi_Class L), plus LRM (U+200E). */
const strongLtr = /[‎\p{L}]/u;

/**
 * The base direction of one paragraph in a deck, shared by the renderer and
 * the PPTX exporter so preview and export agree. In a right-to-left deck a
 * paragraph is right-to-left when its first strong character is
 * right-to-left, or when it has no strong character (digits, punctuation or
 * empty text); a paragraph whose first strong character is left-to-right
 * (for example an English quote or code) stays left-to-right. In a
 * left-to-right deck every paragraph is left-to-right.
 *
 * Strong characters follow UAX #9 rule P2: text inside directional isolates
 * (LRI, RLI or FSI up to the matching PDI) is skipped. Letters count as
 * strong; RTL letters are those of right-to-left scripts. The result does not
 * depend on locale data, only on the JavaScript engine's Unicode tables.
 */
export function paragraphDirection(text: string, deckDirection: TextDirection | string | undefined): TextDirection {
  if (deckDirection !== "rtl") return "ltr";
  let isolates = 0;
  for (const char of String(text ?? "")) {
    if (char === "⁦" || char === "⁧" || char === "⁨") isolates += 1;
    else if (char === "⁩") isolates = Math.max(0, isolates - 1);
    else if (isolates === 0) {
      if (strongRtl.test(char)) return "rtl";
      if (strongLtr.test(char)) return "ltr";
    }
  }
  return "rtl";
}

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

/** Script of a tag outside the catalogs: explicit, vendored, then the runtime's ICU likely subtags. */
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

type CatalogKey = "languages" | "fontSchemes" | "themes";
type Lookup = (kind: CatalogKey, id: string) => Record<string, unknown> | undefined;

function inlineRecords(document: Record<string, unknown>, kind: CatalogKey): Record<string, unknown>[] {
  const kinds = isRecord(document.catalogs) ? document.catalogs : {};
  const entry = kinds[kind];
  return isRecord(entry) && Array.isArray(entry.records) ? entry.records.filter(isRecord) : [];
}

function allRecords(document: Record<string, unknown>, kind: CatalogKey): Record<string, unknown>[] {
  return [...inlineRecords(document, kind), ...(catalogs[kind] as unknown as Record<string, unknown>[])];
}

/** Resolve a string id or `{ id, ...overrides }` object into one record. */
function resolveReference(lookup: Lookup, kind: CatalogKey, reference: unknown): Record<string, unknown> | undefined {
  if (typeof reference === "string") return lookup(kind, reference);
  if (!isRecord(reference)) return undefined;
  const base = typeof reference.id === "string" ? lookup(kind, reference.id) : undefined;
  return { ...base, ...reference };
}

/**
 * Match a BCP-47 tag to a language record without locale data: an exact
 * (case-insensitive, deprecated subtags replaced) tag first, then the same
 * language and script preferring the same region, then a record without a
 * region. A tag without a script matches any script unless the vendored table
 * names one.
 */
function matchLanguageTag(document: Record<string, unknown>, tag: string): Record<string, unknown> | undefined {
  const wanted = splitTag(tag);
  if (!wanted) return undefined;
  const records = allRecords(document, "languages").filter((record) => typeof record.bcp47 === "string");
  const key = canonicalTag(tag).toLowerCase();
  const exact = records.find((record) => canonicalTag(record.bcp47 as string).toLowerCase() === key);
  if (exact) return exact;
  const language = matchingLanguages[wanted.language] ?? wanted.language;
  const script = wanted.script ?? vendoredScript(language, wanted.region);
  const candidates = records.flatMap((record) => {
    const parts = splitTag(record.bcp47 as string);
    if (!parts || (matchingLanguages[parts.language] ?? parts.language) !== language) return [];
    const recordScript = normalizeScript(record.script) ?? parts.script ?? vendoredScript(language, parts.region);
    if (script && recordScript && script !== recordScript) return [];
    return [{ record, region: parts.region }];
  });
  return (
    candidates.find((candidate) => wanted.region && candidate.region === wanted.region)?.record ??
    candidates.find((candidate) => !candidate.region)?.record ??
    candidates[0]?.record
  );
}

interface ResolvedLanguage {
  record: Record<string, unknown>;
  /** The tag the author wrote, when the language was named by tag. */
  authoredTag?: string;
  /** An `ooxmlLang` written on the document's own Language object. */
  authoredOoxmlLang?: string;
  languageId?: string;
}

function resolveLanguage(document: Record<string, unknown>, lookup: Lookup, reference: unknown): ResolvedLanguage | undefined {
  if (typeof reference === "string") {
    const value = reference.trim();
    const byId = bareLanguageId.test(value) ? lookup("languages", value) : undefined;
    if (byId) return { record: byId, languageId: value };
    // URLs and pkg: references cannot be resolved locally; `und` and empty tags name no language.
    if (/^[a-z][a-z0-9+.-]*:/i.test(value) || !splitTag(value)) return undefined;
    const matched = matchLanguageTag(document, value);
    if (matched) return { record: matched, authoredTag: value, languageId: text(matched.id) };
    // Outside the catalogs, accept only a tag whose script is known, so an
    // unknown catalog id is not emitted as a tag.
    return inferScript(value) ? { record: {}, authoredTag: value } : undefined;
  }
  if (!isRecord(reference)) return undefined;
  const authoredTag = text(reference.bcp47);
  if (authoredTag !== undefined && !splitTag(authoredTag)) return undefined;
  const base =
    typeof reference.id === "string"
      ? lookup("languages", reference.id)
      : authoredTag
        ? matchLanguageTag(document, authoredTag)
        : undefined;
  const record = { ...base, ...reference };
  const tag = text(record.bcp47);
  if (!tag || !splitTag(tag)) return undefined;
  return { record, authoredTag, authoredOoxmlLang: text(reference.ooxmlLang), languageId: text(base?.id) };
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
 * Whether a font scheme's `languages` list (human-readable names) admits the
 * language: an empty list admits every language; otherwise an entry must equal
 * the record's name, or its name without a trailing parenthetical qualifier,
 * case-insensitively.
 */
function schemeServesLanguage(scheme: Record<string, unknown>, language: Record<string, unknown>): boolean {
  const entries = Array.isArray(scheme.languages) ? scheme.languages.filter((entry): entry is string => typeof entry === "string") : [];
  if (entries.length === 0) return true;
  const name = text(language.name)?.toLowerCase();
  if (!name) return false;
  const base = name.replace(/\s*\([^)]*\)\s*$/, "");
  return entries.some((entry) => {
    const value = entry.trim().toLowerCase();
    return value === name || value === base;
  });
}

/**
 * Resolve the per-script theme fonts, language tags and direction for a
 * presentation (or a `{ design, language, catalogs }` subset of one).
 *
 * The latin slot follows the effective design font scheme exactly as
 * `resolveFontFamilies` does; when nothing names a font scheme it falls back to
 * the shared `DEFAULT_FONT_SCHEME`. Each of the eastAsian and complexScript slots
 * takes, in order: the design font scheme's explicit slot; the scheme's own
 * families when its `languageFamily` names the slot and its `languages` list
 * is empty or names the language; the language's font scheme when the
 * language's script uses the slot; otherwise the latin family.
 */
export function resolveScriptFonts(input: unknown, options: ResolveScriptFontsOptions = {}): ResolvedScriptFonts {
  const document = isRecord(input) ? input : {};
  const lookup: Lookup = (kind, id) =>
    inlineRecords(document, kind).find((record) => record.id === id) ??
    (catalogs[kind] as unknown as Record<string, unknown>[]).find((record) => record.id === id);

  let design = isRecord(document.design) ? document.design : {};
  if (options.slideIndex !== undefined) {
    const slides = Array.isArray(document.slides) ? document.slides : [];
    if (!Number.isInteger(options.slideIndex) || options.slideIndex < 0 || options.slideIndex >= slides.length) {
      throw new RangeError(`slideIndex must be an integer between 0 and ${slides.length - 1}.`);
    }
    const slide = slides[options.slideIndex];
    if (isRecord(slide) && isRecord(slide.design)) design = { ...design, ...slide.design };
  }

  const theme = resolveReference(lookup, "themes", design.theme ?? "minimal") ?? {};
  const scheme = resolveFontSchemeReference(design.fontScheme ?? theme.fontScheme ?? DEFAULT_FONT_SCHEME, (id) => lookup("fontSchemes", id)).scheme;
  const latin = resolveFontFamilies(scheme);

  const fromOption = options.language !== undefined ? resolveLanguage(document, lookup, options.language) : undefined;
  const fromDocument = fromOption ? undefined : resolveLanguage(document, lookup, document.language);
  const requestedDefault = text(options.defaultLanguage);
  const fallbackTag = requestedDefault && splitTag(requestedDefault) ? requestedDefault : "en-US";
  const language = fromOption ??
    fromDocument ??
    resolveLanguage(document, lookup, fallbackTag) ?? { record: {}, authoredTag: fallbackTag };
  const languageSource = fromOption ? "option" : fromDocument ? "document" : "default";
  const record = language.record;

  const bcp47 = canonicalTag(language.authoredTag ?? text(record.bcp47) ?? fallbackTag);
  const curated = text(record.ooxmlLang);
  const lang = language.authoredOoxmlLang
    ? canonicalTag(language.authoredOoxmlLang)
    : language.authoredTag && splitTag(language.authoredTag)?.region
      ? canonicalTag(language.authoredTag)
      : curated
        ? canonicalTag(curated)
        : bcp47;

  // A catalog record's script is its own `script`, its tag's explicit or
  // vendored script, or the script of the bundled record its tag matches —
  // never the runtime's locale data. Only tags outside the catalogs may fall
  // through to ICU likely subtags.
  const parts = splitTag(bcp47);
  const script =
    normalizeScript(record.script) ??
    (language.languageId
      ? (parts?.script ??
        (parts ? vendoredScript(matchingLanguages[parts.language] ?? parts.language, parts.region) : undefined) ??
        normalizeScript(matchLanguageTag({}, bcp47)?.script))
      : inferScript(bcp47)) ??
    "Zzzz";
  const scriptRole = scriptFontRole(script);
  const declaredDirection = record.direction;
  const direction: "ltr" | "rtl" =
    declaredDirection === "rtl" || declaredDirection === "ltr" ? declaredDirection : rtlScripts.has(script) ? "rtl" : "ltr";

  const app = options.app ?? "PowerPoint";
  const preferred = app === "Google Slides" ? record.googleFontScheme : record.fontScheme;
  const alternate = app === "Google Slides" ? record.fontScheme : record.googleFontScheme;
  const languageScheme = resolveReference(lookup, "fontSchemes", preferred) ?? resolveReference(lookup, "fontSchemes", alternate);
  const languageFamilies = pairFamilies(languageScheme);
  const schemeAdmitsLanguage = schemeServesLanguage(scheme, record);

  const slot = (role: Exclude<ScriptRole, "latin">, family: "ea" | "cs") => {
    const explicit = pairFamilies(scheme[role]);
    if (explicit) return { ...explicit, source: "fontScheme" as const };
    if (scheme.languageFamily === family && schemeAdmitsLanguage) return { ...latin, source: "schemeFamily" as const };
    if (scriptRole === role && languageFamilies) return { ...languageFamilies, source: "language" as const };
    return { heading: latin.heading, body: latin.body, source: "latin" as const };
  };
  const eastAsian = slot("eastAsian", "ea");
  const complexScript = slot("complexScript", "cs");

  const heading = { latin: latin.heading, eastAsian: eastAsian.heading, complexScript: complexScript.heading };
  const body = { latin: latin.body, eastAsian: eastAsian.body, complexScript: complexScript.body };

  let supplement: ScriptFontSupplement | undefined;
  if (!latinSlotScripts.has(script)) {
    const families =
      scriptRole === "latin"
        ? languageFamilies
        : (scriptRole === "eastAsian" ? eastAsian : complexScript).source === "latin"
          ? undefined
          : { heading: heading[scriptRole], body: body[scriptRole] };
    if (families) supplement = { script: script === "Kore" ? "Hang" : script, heading: families.heading, body: families.body };
  }

  return {
    ...body,
    lang,
    bcp47,
    ...(language.languageId ? { languageId: language.languageId } : {}),
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
