import { resolveFontFamilies } from "./composition.js";
import { isRecord } from "./content-walk.js";
import { catalogs } from "./generated/catalogs.js";

/**
 * Language/script font model (font-fidelity-everywhere FF-18).
 *
 * Resolves, for a presentation's language and effective font scheme, the font
 * family for each OOXML script slot (`a:latin`, `a:ea`, `a:cs`) of the major
 * (heading) and minor (body) theme fonts, plus the BCP-47 tag and base
 * direction. Pure: no DOM, fonts, network or mutation. Catalog references
 * resolve against inline `catalogs.<kind>.records[]` first and the bundled
 * catalogs second; a custom `source` is not fetched.
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
 * - `schemeFamily`: the design font scheme's own major/minor, because its `languageFamily` names this slot.
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
  /** BCP-47 tag for OOXML `a:rPr/@lang` and HTML/SVG `lang`: the authored tag, else the catalog record's `bcp47`. */
  lang: string;
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
  /** Supplemental theme font for the language's script; absent for Latin, Cyrillic, Greek and unknown scripts. */
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

const bareLanguageId = /^[a-z][a-z0-9-]*$/;

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

interface TagParts {
  language: string;
  script?: string;
  region?: string;
}

function parseTag(tag: string): TagParts | undefined {
  try {
    const locale = new Intl.Locale(tag);
    let script = locale.script;
    if (!script) {
      try {
        script = locale.maximize().script;
      } catch {
        script = undefined;
      }
    }
    return { language: locale.language, script: normalizeScript(script), region: locale.region };
  } catch {
    return undefined;
  }
}

/**
 * Match a BCP-47 tag to a language record: an exact (case-insensitive) tag
 * first, then the same language and script preferring the same region, then
 * a record without a region.
 */
function matchLanguageTag(document: Record<string, unknown>, tag: string): Record<string, unknown> | undefined {
  const records = allRecords(document, "languages").filter((record) => typeof record.bcp47 === "string");
  const exact = records.find((record) => (record.bcp47 as string).toLowerCase() === tag.toLowerCase());
  if (exact) return exact;
  const wanted = parseTag(tag);
  if (!wanted) return undefined;
  const candidates = records.flatMap((record) => {
    const parts = parseTag(record.bcp47 as string);
    if (!parts || parts.language !== wanted.language) return [];
    const script = normalizeScript(record.script) ?? parts.script;
    if (wanted.script && script && wanted.script !== script) return [];
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
  lang: string;
  languageId?: string;
}

function resolveLanguage(document: Record<string, unknown>, lookup: Lookup, reference: unknown): ResolvedLanguage | undefined {
  if (typeof reference === "string") {
    const value = reference.trim();
    const byId = bareLanguageId.test(value) ? lookup("languages", value) : undefined;
    if (byId) return { record: byId, lang: text(byId.bcp47) ?? value, languageId: value };
    // URLs and pkg: references cannot be resolved locally.
    if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return undefined;
    const matched = matchLanguageTag(document, value);
    if (matched) return { record: matched, lang: value, languageId: text(matched.id) };
    // Outside the catalogs, accept only a tag whose script is known (explicit
    // or from likely subtags), so an unknown catalog id is not emitted as a tag.
    return parseTag(value)?.script ? { record: {}, lang: value } : undefined;
  }
  if (!isRecord(reference)) return undefined;
  const base =
    typeof reference.id === "string"
      ? lookup("languages", reference.id)
      : typeof reference.bcp47 === "string"
        ? matchLanguageTag(document, reference.bcp47)
        : undefined;
  const record = { ...base, ...reference };
  const lang = text(record.bcp47);
  if (!lang) return undefined;
  return { record, lang, languageId: text(base?.id) };
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
 * Resolve the per-script theme fonts, language tag and direction for a
 * presentation (or a `{ design, language, catalogs }` subset of one).
 *
 * The latin slot follows the effective design font scheme exactly as
 * `resolveFontFamilies` does. Each of the eastAsian and complexScript slots
 * takes, in order: the design font scheme's explicit slot; the scheme's own
 * families when its `languageFamily` names the slot; the language's font
 * scheme when the language's script uses the slot; otherwise the latin family.
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
  const scheme = resolveReference(lookup, "fontSchemes", design.fontScheme ?? theme.fontScheme ?? "roboto") ?? {};
  const latin = resolveFontFamilies(scheme);

  const fromOption = options.language !== undefined ? resolveLanguage(document, lookup, options.language) : undefined;
  const fromDocument = fromOption ? undefined : resolveLanguage(document, lookup, document.language);
  const fallbackTag = text(options.defaultLanguage) ?? "en-US";
  const language = fromOption ??
    fromDocument ??
    resolveLanguage(document, lookup, fallbackTag) ?? { record: {}, lang: fallbackTag };
  const languageSource = fromOption ? "option" : fromDocument ? "document" : "default";

  const script = normalizeScript(language.record.script) ?? parseTag(language.lang)?.script ?? "Zzzz";
  const scriptRole = scriptFontRole(script);
  const declaredDirection = language.record.direction;
  const direction: "ltr" | "rtl" =
    declaredDirection === "rtl" || declaredDirection === "ltr" ? declaredDirection : rtlScripts.has(script) ? "rtl" : "ltr";

  const app = options.app ?? "PowerPoint";
  const preferred = app === "Google Slides" ? language.record.googleFontScheme : language.record.fontScheme;
  const alternate = app === "Google Slides" ? language.record.fontScheme : language.record.googleFontScheme;
  const languageScheme = resolveReference(lookup, "fontSchemes", preferred) ?? resolveReference(lookup, "fontSchemes", alternate);
  const languageFamilies = pairFamilies(languageScheme);

  const slot = (role: Exclude<ScriptRole, "latin">, family: "ea" | "cs") => {
    const explicit = pairFamilies(scheme[role]);
    if (explicit) return { ...explicit, source: "fontScheme" as const };
    if (scheme.languageFamily === family) return { ...latin, source: "schemeFamily" as const };
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
        ? (languageFamilies ?? { heading: latin.heading, body: latin.body })
        : { heading: heading[scriptRole], body: body[scriptRole] };
    supplement = { script: script === "Kore" ? "Hang" : script, heading: families.heading, body: families.body };
  }

  return {
    ...body,
    lang: language.lang,
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
