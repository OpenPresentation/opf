import { layoutTable, fitList, fitRichText, composeSlide, resolveCanvasDimensions, resolveFontFamilies, resolveTextStyle, textWidthMeasurer, fitText, textColorForFill, chartColorForFill } from "@openpresentation/opf/composition";
import {
  catalogs as bundledCatalogs,
  resolveColorRef as resolveCoreColorRef,
  validatePresentation
} from "@openpresentation/opf";
// Optional core exports are read from the namespace so an older published core
// still loads; resolveScriptFonts ships with core FF-18.
import * as opfCore from "@openpresentation/opf";
import { adjustedFontSize, baselineShift, createScriptFonts } from "./script-fonts.js";
import { disabledFeaturesStyle } from "./font-compatibility.js";
import { fontPolicyFor } from "./font-policy.js";
import { isDatasetChart, isDatasetTable, renderCatalogChart } from "./charts.js";
import { renderCaption, renderFootnotes } from "./annotations.js";

export const packageName = "@openpresentation/opf-render";

export const releaseLane = Object.freeze({
  githubRepository: "OpenPresentation/opf-render",
  npmPackage: "@openpresentation/opf-render",
  compatibilityPackage: "@openpresentation/opf"
});

export const runtimePolicy = Object.freeze({
  hostedServiceInCriticalPath: false,
  telemetry: false,
  commercialSdkInCriticalPath: false,
  requiredNetworkCalls: false,
  deterministicLocalExecution: true
});

export const engineDefaults = Object.freeze({
  catalogs: Object.freeze({
    narratives: Object.freeze({ source: "https://www.pptx.gallery/narratives" }),
    themes: Object.freeze({ source: "https://www.pptx.gallery/themes" }),
    colorSchemes: Object.freeze({ source: "https://www.pptx.gallery/color-schemes" }),
    fontSchemes: Object.freeze({ source: "https://www.pptx.gallery/font-schemes" }),
    languages: Object.freeze({ source: "https://www.pptx.gallery/languages" }),
    layouts: Object.freeze({ source: "https://www.pptx.gallery/layouts" }),
    chartTypes: Object.freeze({ source: "https://www.pptx.gallery/chart-types" }),
    tones: Object.freeze({ source: "https://www.pptx.gallery/tones" }),
    audiences: Object.freeze({ source: "https://www.pptx.gallery/audiences" }),
    socialPlatforms: Object.freeze({ source: "https://www.pptx.gallery/social-platforms" })
  }),
  theme: "minimal",
  colorScheme: "cool-horizon",
  language: "english",
  narrative: "classic-story",
  tone: "formal",
  audience: "executives",
  fontScheme: Object.freeze({
    pptx: Object.freeze({ latin: "aptos", ea: "microsoft-yahei", cs: "nirmala-ui" }),
    google: Object.freeze({ latin: "roboto", ea: "noto-sans-sc", cs: "noto-sans" })
  }),
  chartTypes: Object.freeze([
    "stacked-column-3x",
    "stacked-area-3x",
    "line-with-markers-3x"
  ])
});

// Last-resort font scheme shared by every engine (core pagination, opf-editor and
// opf-pptx): DEFAULT_FONT_SCHEME in @openpresentation/opf. It applies only when the
// slide, deck and resolved theme name no font scheme. fontScheme.google is kept for a
// future Google Slides target and is not used by this renderer.
const DEFAULT_FONT_SCHEME = engineDefaults.fontScheme.pptx.latin;

export class OPFRenderError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "OPFRenderError";
    this.code = code;
    this.details = details;
    if (details.issues) this.issues = details.issues;
    if (details.path) this.path = details.path;
  }
}

const ROOT_PAYLOAD_FIELDS = [
  "text",
  "items",
  "bullets",
  "image",
  "video",
  "chart",
  "table",
  "code",
  "metric",
  "quote",
  "timeline"
];

const PROMOTED_REGION_KEYS = [
  "left",
  "center",
  "right",
  "left+center",
  "center+right",
  "left+center+right",
  "top",
  "middle",
  "bottom",
  "top+middle",
  "middle+bottom",
  "top+middle+bottom",
  "top:left",
  "top:center",
  "top:right",
  "top:left+center",
  "top:center+right",
  "top:left+center+right",
  "middle:left",
  "middle:center",
  "middle:right",
  "middle:left+center",
  "middle:center+right",
  "middle:left+center+right",
  "bottom:left",
  "bottom:center",
  "bottom:right",
  "bottom:left+center",
  "bottom:center+right",
  "bottom:left+center+right",
  "top+middle:left",
  "top+middle:center",
  "top+middle:right",
  "top+middle:left+center",
  "top+middle:center+right",
  "top+middle:left+center+right",
  "middle+bottom:left",
  "middle+bottom:center",
  "middle+bottom:right",
  "middle+bottom:left+center",
  "middle+bottom:center+right",
  "middle+bottom:left+center+right",
  "top+middle+bottom:left",
  "top+middle+bottom:center",
  "top+middle+bottom:right",
  "top+middle+bottom:left+center",
  "top+middle+bottom:center+right",
  "top+middle+bottom:left+center+right"
];

const TITLE_PLACEHOLDERS = new Set(["title", "subtitle", "tag"]);

const FIELD_TYPE = Object.freeze({
  text: "text",
  items: "list",
  bullets: "list",
  image: "image",
  video: "video",
  chart: "chart",
  table: "table",
  code: "code",
  metric: "metric",
  quote: "quote",
  timeline: "timeline"
});

const DEFAULT_DIMENSIONS = { width: 1280, height: 720 };
const DEFAULT_SOURCE_PREFIX = "https://www.pptx.gallery/";


function parseInput(input) {
  if (typeof input === "string") {
    try {
      return JSON.parse(input);
    } catch (error) {
      throw new OPFRenderError("invalid-json", "OPF input is not valid JSON.", {
        cause: error instanceof Error ? error.message : String(error)
      });
    }
  }

  if (input instanceof Uint8Array) {
    return parseInput(new TextDecoder().decode(input));
  }

  if (input && typeof input === "object") {
    return input;
  }

  throw new OPFRenderError("invalid-input", "OPF input must be a parsed object, JSON string, or Uint8Array.");
}

// Template variables (core resolveVariables, RR-32): a deck that uses content variables, or a template, is resolved
// to a concrete deck before composition, so the preview and the PPTX exporter see the same text, numbers, dates and
// images. A template previews with each unfilled variable's example; a normal deck with an unfilled required
// variable is refused. Decks without content variables are returned untouched. Read from the namespace so an older
// published core still loads.
function resolveTemplateInput(presentation, options) {
  if (typeof opfCore.resolveVariables !== "function" || !isPlainObject(presentation)) return presentation;
  const values = options.variables;
  // variables: false draws the document as authored, tokens and var: references included (the template editing view).
  if (values === false) return presentation;
  if (values !== undefined && !isPlainObject(values)) {
    throw new OPFRenderError("invalid-variables", "The variables option must be an object keyed by variable id.", { path: "options.variables" });
  }
  const template = opfCore.isTemplate(presentation);
  if (!template && !opfCore.hasContentVariables(presentation) && !(values && Object.keys(values).length)) return presentation;
  const result = opfCore.resolveVariables(presentation, values ?? {}, { examples: template });
  const errors = result.diagnostics.filter((entry) => entry.severity === "error");
  if (errors.length) {
    const unfilled = errors.some((entry) => entry.code === "variable-unfilled");
    throw new OPFRenderError(unfilled ? "unfilled-variables" : "invalid-variables", errors[0].message, {
      issues: errors,
      path: errors[0].path
    });
  }
  for (const entry of result.diagnostics) {
    if (entry.code === "variable-example-used") options.onDiagnostic?.({ code: "variable-example-used", path: entry.path, message: entry.message, id: entry.id });
  }
  return result.presentation;
}

function assertValidBoundary(presentation) {
  const result = validatePresentation(presentation);
  if (!result.valid) {
    throw new OPFRenderError("invalid-opf", "OPF validation failed.", {
      issues: result.errors,
      result
    });
  }
}

function stableJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
}

function cloneWithSortedKeys(value) {
  if (Array.isArray(value)) return value.map((item) => cloneWithSortedKeys(item));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, cloneWithSortedKeys(value[key])]));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function referenceId(reference) {
  if (typeof reference === "string") return reference;
  if (isPlainObject(reference) && typeof reference.id === "string") return reference.id;
  return null;
}

function normalizeSourceRecords(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (Array.isArray(value.records)) return value.records;
  return [];
}

function findById(records, id) {
  return records.find((record) => record && record.id === id) ?? null;
}

function defaultCatalogFor(kind) {
  return Array.isArray(bundledCatalogs[kind]) ? bundledCatalogs[kind] : [];
}

// CatalogEntry.source is one source or an ordered search path (first match wins; the
// default catalog is appended by the callers). An array concatenates each source's
// records in order, so the findById chain keeps the first match. Non-string entries are
// ignored. Nothing is fetched: a source resolves from options.catalogSources or, for the
// bundled default prefixes, from the bundled snapshot.
function sourceRecordsFor(kind, source, options) {
  if (Array.isArray(source)) return source.flatMap((entry) => sourceRecordsFor(kind, entry, options));
  if (typeof source !== "string" || !source) return [];
  const bySource = options.catalogSources?.[source];
  if (bySource) return normalizeSourceRecords(bySource);
  if (source.startsWith(DEFAULT_SOURCE_PREFIX) || source.startsWith("pkg:@openpresentation/opf/")) {
    return defaultCatalogFor(kind);
  }
  return [];
}

function engineDefaultId(kind) {
  if (kind === "fontSchemes") return DEFAULT_FONT_SCHEME;
  if (kind === "chartTypes") return engineDefaults.chartTypes[0];
  const key = kind.endsWith("s") ? kind.slice(0, -1) : kind;
  return engineDefaults[key];
}

function findCatalogRecord(kind, id, context) {
  if (!id) return null;
  const documentCatalog = context.presentation.catalogs?.[kind];
  return findById(normalizeSourceRecords(documentCatalog), id) ??
    findById(sourceRecordsFor(kind, documentCatalog?.source, context.options), id) ??
    findById(normalizeSourceRecords(context.options.catalogs?.[kind]), id) ??
    findById(sourceRecordsFor(kind, engineDefaults.catalogs[kind]?.source, context.options), id) ??
    findById(defaultCatalogFor(kind), id);
}

// Font schemes follow the shared core rule (resolveFontSchemeReference in
// @openpresentation/opf): an id that matches no record reports one
// `unresolved-font-scheme` diagnostic and uses the DEFAULT_FONT_SCHEME record as the
// base, with sibling overrides on top, so preview and PPTX export use the same fonts.
function resolveFontSchemeRecord(reference, context, path) {
  const id = referenceId(reference);
  const found = findCatalogRecord("fontSchemes", id, context);
  const base = found ?? findCatalogRecord("fontSchemes", DEFAULT_FONT_SCHEME, context) ?? {};
  const scheme = cloneWithSortedKeys(isPlainObject(reference) ? { ...base, ...reference } : base);
  if (!id || found) return { scheme };
  return { scheme, diagnostic: { code: "unresolved-font-scheme", path, id, fallback: DEFAULT_FONT_SCHEME, message: `Font scheme '${id}' is not in the inline or bundled catalogs; using the default font scheme '${DEFAULT_FONT_SCHEME}'.` } };
}

// Generated socials furniture formats handles in core. Core applies inline
// document records first; the host supplies the rest in resolution order.
function socialPlatformRecords(context) {
  const kind = "socialPlatforms";
  return [
    ...sourceRecordsFor(kind, context.presentation.catalogs?.[kind]?.source, context.options),
    ...normalizeSourceRecords(context.options.catalogs?.[kind]),
    ...sourceRecordsFor(kind, engineDefaults.catalogs[kind]?.source, context.options),
    ...defaultCatalogFor(kind)
  ];
}

function resolveCatalogRecord(kind, reference, context, path, fallbackId = engineDefaultId(kind)) {
  const id = referenceId(reference) ?? fallbackId;
  const documentCatalog = context.presentation.catalogs?.[kind];
  const documentRecords = normalizeSourceRecords(documentCatalog);
  const injectedRecords = normalizeSourceRecords(context.options.catalogs?.[kind]);
  const documentSource = documentCatalog?.source;
  const sourceRecords = sourceRecordsFor(kind, documentSource, context.options);
  const defaultSource = engineDefaults.catalogs[kind]?.source;
  const engineSourceRecords = sourceRecordsFor(kind, defaultSource, context.options);
  const defaultRecords = defaultCatalogFor(kind);

  const record =
    (id ? findById(documentRecords, id) : null) ??
    (id ? findById(sourceRecords, id) : null) ??
    (id ? findById(injectedRecords, id) : null) ??
    (id ? findById(engineSourceRecords, id) : null) ??
    (id ? findById(defaultRecords, id) : null);

  if (record) {
    return isPlainObject(reference)
      ? cloneWithSortedKeys({ ...record, ...reference })
      : cloneWithSortedKeys(record);
  }

  if (isPlainObject(reference)) {
    return cloneWithSortedKeys(reference);
  }

  throw new OPFRenderError("catalog-resolution-failed", `Could not resolve ${kind} reference '${id}'.`, {
    kind,
    id,
    path,
    source: documentSource ?? defaultSource ?? null
  });
}

const resolveDimensions = resolveCanvasDimensions;

function colorFromScheme(scheme, slot, fallback) {
  if (!slot) return fallback;
  if (typeof slot === "string") {
    if (slot.startsWith("#")) return normalizeColor(slot, fallback);
    return normalizeColor(scheme[slot], fallback);
  }
  if (isPlainObject(slot)) {
    if (slot.type === "theme") return normalizeColor(scheme[slot.slot], fallback);
    if (slot.type === "solid") return normalizeColor(slot.color, fallback);
  }
  return fallback;
}

function normalizeColor(value, fallback) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) return "#" + [...trimmed.slice(1)].map(char => char + char).join("").toUpperCase();
  if (/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(trimmed)) return trimmed.toUpperCase();
  return fallback;
}

/** Resolve content ColorRef via core; keep authored #RRGGBB / #RRGGBBAA casing. */
function resolveColorRef(value, bound, fallback) {
  return resolveColorRefIn(value, bound.design, fallback);
}

// `design` supplies colorScheme, colors (roles) and variables; resolveDesign passes a
// partial one for the background, before the text-dependent roles exist.
function resolveColorRefIn(value, design, fallback) {
  if (value == null || value === "") return fallback;
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  // Core normalizeHexColor uppercases literals and strips #RRGGBBAA alpha.
  // Packed-browser editor checks keep toolbar hex like #2563eb as authored.
  if (/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(trimmed)) return trimmed;
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) return normalizeColor(trimmed, fallback);
  const colors = design.colors ?? {};
  return resolveCoreColorRef(trimmed, {
    colorScheme: design.colorScheme ?? {},
    roles: {
      primary: colors.primary,
      secondary: colors.secondary,
      accent: colors.accent,
      background: colors.background,
      surface: colors.surface,
      text: colors.text,
      textSecondary: colors.mutedText
    },
    variables: design.variables,
    fallback
  });
}

// Background fills: a literal hex keeps normalizeColor's behaviour (uppercase, alpha kept);
// anything else is a ColorRef (var:id, scheme slot or role) resolved like table fills and run
// colours, falling back exactly as an unparseable literal did.
// Roles resolve through the colour scheme only: background, surface and text are derived from the
// background itself (the contrast text), so a reference must not see them.
function resolveBackgroundColor(value, design, fallback) {
  const literal = normalizeColor(value, null);
  if (literal) return literal;
  const { primary, secondary, accent } = design.colors ?? {};
  return resolveColorRefIn(value, { colorScheme: design.colorScheme, colors: { primary, secondary, accent }, variables: design.variables }, fallback);
}

function resolveBackground(background, colorScheme, design) {
  if (!background) return colorFromScheme(colorScheme, "light1", "#FFFFFF");
  if (typeof background === "string") return colorFromScheme(colorScheme, background, "#FFFFFF");
  if (background.type === "theme") return colorFromScheme(colorScheme, background.slot, "#FFFFFF");
  if (background.type === "solid") return resolveBackgroundColor(background.color, design, "#FFFFFF");
  if (background.type === "gradient") return null;
  if (background.type === "pattern") return resolveBackgroundColor(background.pattern?.backgroundColor, design, "#FFFFFF");
  return colorFromScheme(colorScheme, "light1", "#FFFFFF");
}


function colorLuminance(color) {
  const hex = normalizeColor(color, "#FFFFFF").replace("#", "");
  const channels = [0, 2, 4].map(offset => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

// FF-61: WCAG 2.x contrast ratio, (L1 + 0.05) / (L2 + 0.05) with L1 the lighter relative luminance. The slide tag
// draws in the primary colour unless that is under 4.5:1 against the slide background; opf-pptx applies the same
// rule with the same arithmetic (test/tag-colour.mjs in both repositories pins the same colour pairs).
const TAG_MIN_CONTRAST = 4.5;
function contrastRatio(first, second) {
  const a = colorLuminance(first), b = colorLuminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
// The slide background the tag sits on: the resolved solid or pattern colour, else (gradient) the scheme light1,
// the colour the background rect also falls back to and opf-pptx uses for a background that is not one colour.
function tagFill(design) {
  const background = design.backgroundColor ?? design.colors.background;
  return contrastRatio(design.colors.primary, background) < TAG_MIN_CONTRAST ? design.colors.text : design.colors.primary;
}

function resolveDesign(presentation, slide, context, index) {
  const deckDesign = presentation.design ?? {};
  const slideDesign = slide.design ?? {};

  const theme = resolveCatalogRecord(
    "themes",
    slideDesign.theme ?? deckDesign.theme ?? engineDefaults.theme,
    context,
    "design.theme"
  );
  const colorScheme = resolveCatalogRecord(
    "colorSchemes",
    slideDesign.colorScheme ?? deckDesign.colorScheme ?? theme.colorScheme ?? engineDefaults.colorScheme,
    context,
    "design.colorScheme"
  );
  const fontPath = slideDesign.fontScheme !== undefined ? `slides.${index}.design.fontScheme`
    : deckDesign.fontScheme !== undefined ? "design.fontScheme"
    : slideDesign.theme !== undefined ? `slides.${index}.design.theme` : "design.theme";
  const { scheme: fontScheme, diagnostic: fontSchemeDiagnostic } = resolveFontSchemeRecord(
    slideDesign.fontScheme ?? deckDesign.fontScheme ?? theme.fontScheme ?? DEFAULT_FONT_SCHEME,
    context,
    fontPath
  );
  const dimensions = resolveDimensions(slideDesign.dimensions ?? deckDesign.dimensions ?? theme.dimensions);
  const backgroundDefinition = slideDesign.background ?? deckDesign.background ?? theme.background;
  const primary = normalizeColor(colorScheme.primary, null) ?? colorFromScheme(colorScheme, "accent1", "#2563EB");
  const secondary = normalizeColor(colorScheme.secondary, null) ?? colorFromScheme(colorScheme, "accent2", "#0F766E");
  const accent = normalizeColor(colorScheme.accent, null) ?? colorFromScheme(colorScheme, "accent3", "#F59E0B");
  const variables = presentation.variables ?? {};
  // background/surface/text roles depend on the background itself, so a background reference sees only the scheme and the three accent roles.
  const backgroundColor = resolveBackground(backgroundDefinition, colorScheme, { colorScheme, colors: { primary, secondary, accent }, variables });
  const darkBackground = colorLuminance(backgroundColor ?? "#FFFFFF") < 0.179;
  const textColor = colorFromScheme(colorScheme, darkBackground ? "light1" : "dark1", darkBackground ? "#FFFFFF" : "#111827");

  return {
    ...deckDesign,
    ...slideDesign,
    theme,
    colorScheme,
    fontScheme,
    dimensions,
    variables,
    background: backgroundDefinition,
    backgroundColor,
    colors: {
      background: colorFromScheme(colorScheme, "light1", "#FFFFFF"),
      surface: colorFromScheme(colorScheme, darkBackground ? "dark2" : "light2", darkBackground ? "#1E293B" : "#F8FAFC"),
      text: textColor,
      mutedText: colorFromScheme(colorScheme, darkBackground ? "light2" : "dark2", darkBackground ? "#E2E8F0" : "#334155"),
      primary,
      secondary,
      accent,
      border: colorFromScheme(colorScheme, "accent5", "#CBD5E1")
    },
    fonts: resolveFontFamilies(fontScheme),
    darkBackground,
    diagnostics: fontSchemeDiagnostic ? [fontSchemeDiagnostic] : []
  };
}

/**
 * Script font slots, language tags and direction for one slide from core
 * `resolveScriptFonts` (FF-18). The latin slot is always the renderer's design
 * font; a script slot that core fills from the latin family follows it too.
 * Without core support every slot repeats the latin family.
 */
function scriptProfile(presentation, index, design, context) {
  let resolved;
  if (typeof opfCore.resolveScriptFonts === "function") {
    try { resolved = opfCore.resolveScriptFonts(presentation, { slideIndex: index }); }
    catch (error) {
      reportLanguageDiagnostic(context, { code: "language-preview-unresolved", path: "language",
        message: "Script fonts could not be resolved (" + (error instanceof Error ? error.message : String(error)) + "), so the preview uses the design font for every script, sets no lang and lays out every paragraph left to right." });
    }
  } else if (presentation.language !== undefined) {
    reportLanguageDiagnostic(context, { code: "language-preview-unavailable", path: "language",
      message: "The installed @openpresentation/opf has no resolveScriptFonts (FF-18), so the preview uses the design font for every script, sets no lang and lays out every paragraph left to right. Use a core release with the language model." });
  }
  if (resolved?.rtl === true && typeof opfCore.paragraphDirection !== "function") {
    reportLanguageDiagnostic(context, { code: "paragraph-direction-unavailable", path: "language",
      message: "The installed @openpresentation/opf has no paragraphDirection, so the preview lays out every paragraph of this right-to-left deck left to right, as the PPTX export does. Use a core release that exports it." });
  }
  const slots = role => {
    const latin = design.fonts[role];
    const slot = key => !resolved || resolved.sources?.[key] === "latin" || resolved.sources?.[key] === "schemeFamily" ? latin : resolved[role]?.[key] ?? latin;
    return { latin, eastAsian: slot("eastAsian"), complexScript: slot("complexScript") };
  };
  return {
    heading: slots("heading"),
    body: slots("body"),
    ...(resolved?.supplement ? { supplement: resolved.supplement } : {}),
    script: resolved?.script ?? "Zzzz",
    ...(resolved?.scriptRole ? { scriptRole: resolved.scriptRole } : {}),
    ...(resolved ? { bcp47: resolved.bcp47, lang: resolved.lang, languageSource: resolved.languageSource, direction: resolved.direction } : {}),
    rtl: resolved?.rtl === true,
    serif: design.fontScheme?.type === "serif"
  };
}

/** Report a language diagnostic once per resolvePresentation call. */
function reportLanguageDiagnostic(context, diagnostic) {
  context.languageDiagnostics ??= new Set();
  if (context.languageDiagnostics.has(diagnostic.code)) return;
  context.languageDiagnostics.add(diagnostic.code);
  context.options.onDiagnostic?.(diagnostic);
}

/**
 * Report a glyph fallback once per resolvePresentation call, family pair and path (FF-19).
 * It is a note, not an error: the face the font scheme resolved to lacks glyphs for the text,
 * so a bundled face that has them draws those characters. The PPTX still names the chosen font.
 */
function reportGlyphFallback(context, note) {
  context.glyphFallbackDiagnostics ??= new Set();
  const key = `${note.fontFamily}\u0000${note.fallbackFamily}\u0000${note.placeholder ?? ""}\u0000${note.path ?? ""}`;
  if (context.glyphFallbackDiagnostics.has(key)) return;
  context.glyphFallbackDiagnostics.add(key);
  // FF-45: a symbol-encoded family's note lists the codes drawn as their Unicode equivalents, or as the placeholder.
  const symbol = Array.isArray(note.codes);
  const codes = symbol ? note.codes.slice(0, 8).map(code => `0x${code}`).join(", ") : "";
  context.options.onDiagnostic?.({
    code: "font-glyph-fallback",
    ...(note.path ? { path: note.path } : {}),
    // The note is reported once per family pair and path: it names characters the face lacks, such as these, not every one.
    message: symbol
      ? (note.placeholder
        ? `'${note.fontFamily}' is symbol-encoded; codes such as ${codes} have no Unicode equivalent that a loaded face draws, so the preview draws the placeholder '${note.placeholder}' with '${note.fallbackFamily}'. The PPTX keeps the chosen font and the original codes.`
        : `'${note.fontFamily}' is symbol-encoded and not bundled; the preview draws codes such as ${codes} as their Unicode equivalents with '${note.fallbackFamily}'. The PPTX keeps the chosen font and the original codes.`)
      : `'${note.fontFamily}' lacks glyphs for characters such as ${note.characters.slice(0, 8).map(character => `U+${character.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`).join(", ")}; the preview draws those with '${note.fallbackFamily}'. The PPTX keeps the chosen font.`,
    fontFamily: note.fontFamily,
    fallbackFamily: note.fallbackFamily,
    scripts: [...note.scripts],
    characters: [...note.characters],
    ...(symbol ? { codes: [...note.codes], ...(note.placeholder ? { placeholder: note.placeholder } : {}) } : {})
  });
}

function inferLayoutId(slide) {
  if (slide.layout) return slide.layout;
  if (slide.blocks?.length) return "blank";
  if (PROMOTED_REGION_KEYS.some((key) => key in slide)) return "blank";
  if (slide.chart) return "chart-1x";
  if (slide.table) return "table-1x";
  if (slide.image) return "image-1x";
  if (slide.video) return "media-1x";
  // Unspecified code layout uses the same automatic flow as core pagination
  // and PPTX export. An explicit code-1x preset still reserves its own slots.
  if (slide.code !== undefined) return "blank";
  if (slide.items || slide.bullets) return "list-1x";
  if (slide.text || slide.metric || slide.quote || slide.timeline) return "text-1x";
  if (slide.subtitle) return "title-subtitle";
  return "title";
}

function resolveLayout(slide, context, index) {
  const layoutId = inferLayoutId(slide);
  try {
    return resolveCatalogRecord("layouts", layoutId, context, `slides.${index}.layout`);
  } catch (error) {
    if (error instanceof OPFRenderError && isPlainObject(slide.layout)) return slide.layout;
    throw error;
  }
}

function contentPayloadFromHost(host, path, slot) {
  if (!isPlainObject(host)) {
    return { type: "text", field: "text", value: host, slot: slot ?? "text", path };
  }

  for (const field of ROOT_PAYLOAD_FIELDS) {
    if (host[field] !== undefined) {
      return {
        type: host.type ?? FIELD_TYPE[field],
        field,
        value: host[field],
        slot: host.slot ?? slot ?? host.type ?? FIELD_TYPE[field],
        path: `${path}.${field}`
      };
    }
  }

  return {
    type: "text",
    field: "text",
    value: stableJson(host),
    slot: slot ?? "text",
    path
  };
}

function slideRootContent(slide, slidePath) {
  const items = [];
  for (const field of ROOT_PAYLOAD_FIELDS) {
    if (slide[field] !== undefined) {
      items.push({
        type: slide.type ?? FIELD_TYPE[field],
        field,
        value: slide[field],
        slot: slide.type ?? FIELD_TYPE[field],
        path: `${slidePath}.${field}`
      });
    }
  }
  return items;
}

function promotedRegionContent(slide, slidePath) {
  const items = [];
  for (const key of PROMOTED_REGION_KEYS) {
    if (slide[key] !== undefined) {
      const payload = contentPayloadFromHost(slide[key], `${slidePath}.${key}`, key);
      items.push({ ...payload, slot: key, regionKey: key });
    }
  }
  return items;
}

function blockContent(slide, slidePath) {
  if (!Array.isArray(slide.blocks)) return [];
  return slide.blocks.map((block, index) => contentPayloadFromHost(block, `${slidePath}.blocks.${index}`, "body"));
}

function normalizeFutureContent(slide, slidePath) {
  if (!Array.isArray(slide.content)) return [];
  return slide.content.map((item, index) => {
    const payload = contentPayloadFromHost(item, `${slidePath}.content.${index}`, item.slot);
    return { ...payload, slot: item.slot ?? payload.slot, path: `${slidePath}.content.${index}` };
  });
}

function bindSlide(presentation, slide, layout, index, context) {
  const slidePath = `slides.${index}`;
  const placeholders = Array.isArray(layout.placeholders) ? layout.placeholders : [];
  const titleBindings = [];

  for (let i = 0; i < placeholders.length; i += 1) {
    const type = placeholders[i]?.type;
    if (!TITLE_PLACEHOLDERS.has(type)) continue;
    const value = slide[type] ?? presentation[type] ?? "";
    if (value) {
      titleBindings.push({
        type: "text",
        field: type,
        slot: type,
        value,
        placeholderIndex: i,
        path: `${slidePath}.${type}`
      });
    }
  }

  const contentItems = [
    ...normalizeFutureContent(slide, slidePath),
    ...slideRootContent(slide, slidePath),
    ...promotedRegionContent(slide, slidePath)
  ];
  const blocks = blockContent(slide, slidePath);

  const design = resolveDesign(presentation, slide, context, index);
  // Script fonts (FF-19): each text run is measured and drawn with its script
  // slot's face; the latin slot stays the design font scheme's family.
  const scriptFonts = createScriptFonts(scriptProfile(presentation, index, design, context), context.options.textMeasurement, {
    glyphFallback: context.options.glyphFallback,
    onFallback: note => reportGlyphFallback(context, note)
  });
  const textMeasurement = scriptFonts.textMeasurement ?? context.options.textMeasurement;
  // fontScheme.accent (the tag and quote text) exists only with a core that resolves it; it takes the same look-alike policy.
  // RR-17 (FF-41): a family that names its weight (Arial Black, Segoe UI Semibold and Light) keeps its own name through composition, so each run
  // resolves it again and draws the replacement's encoded weight (Montserrat 900, Red Hat Display 600 and 300); resolving the role to the
  // replacement family first would draw every run at 400 or 700 and measure it that way. Every other family resolves once, here.
  for (const role of ["heading","body","code","accent"]) if (design.fonts[role] !== undefined) {
    const named = design.fonts[role], resolved = resolveTextStyle({fontFamily:named,fontWeight:role === "heading" ? 700 : 400},textMeasurement).fontFamily;
    design.fonts[role] = fontPolicyFor(named)?.replacement?.weight !== undefined && resolved.toLowerCase() !== named.toLowerCase() ? named : resolved;
  }
  const geometry = composeSlide(slide, { ...design.dimensions, layout, presentation, slideIndex: index, fonts: design.fonts, contentAlignment:design.contentAlignment, titleAlignment:design.titleAlignment, textRasterPadding:context.options.textRasterPadding, contentBox:design.contentBox, darkBackground: design.darkBackground, textMeasurement, date: context.options.date, socialPlatforms: socialPlatformRecords(context) });
  return {
    scriptFonts,
    textMeasurement,
    geometry,
    assets: presentation.assets ?? {},
    // RR-54: the whole document, so a chart reads its dataset and a trace path can tell a dataset-backed chart from an inline one.
    presentation,
    index,
    path: slidePath,
    slide,
    layout,
    design,
    titleBindings,
    contentItems,
    blocks
  };
}

export function resolvePresentation(input, options = {}) {
  const presentation = resolveTemplateInput(parseInput(input), options);
  if (options.validate !== false) {
    assertValidBoundary(presentation);
  }

  const context = { presentation, options };
  const slides = presentation.slides.map((slide, index) => {
    const layout = resolveLayout(slide, context, index);
    return bindSlide(presentation, slide, layout, index, context);
  });

  return {
    presentation,
    engineDefaults,
    slides
  };
}

export function renderSvg(input, options = {}) {
  const resolved = resolvePresentation(input, options);
  const slideIndex = options.slideIndex ?? 0;
  if (!Number.isInteger(slideIndex) || slideIndex < 0 || slideIndex >= resolved.slides.length) {
    throw new OPFRenderError("slide-index-out-of-range", `Slide index ${slideIndex} is out of range.`, {
      slideIndex,
      slideCount: resolved.slides.length
    });
  }
  return renderResolvedSlide(resolved, slideIndex, options);
}

export function renderSvgDeck(input, options = {}) {
  const resolved = resolvePresentation(input, options);
  return resolved.slides.map((_, index) => renderResolvedSlide(resolved, index, options));
}

function renderResolvedSlide(resolved, slideIndex, options) {
  const bound = resolved.slides[slideIndex];
  // Paint with the same script-aware measurement composition used.
  options = { ...options, ...(bound.textMeasurement ? { textMeasurement: bound.textMeasurement } : {}), _diagnosticPaths: new Set() };
  const script = bound.scriptFonts?.profile;
  // Only a language the document names sets lang; the renderer default does not.
  const lang = script?.languageSource === "document" || script?.languageSource === "option" ? script.bcp47 : undefined;
  const { width, height } = bound.design.dimensions;
  const title = bound.slide.title ?? resolved.presentation.name ?? `Slide ${slideIndex + 1}`;
  const content = [
    renderBackground(bound, width, height, options),
    renderSlideImage(bound, options),
    renderBranding(bound, resolved.presentation, width, height, options),
    ...renderSlideContent(bound, width, height, options),
    // RR-34: the footnote area core reserved above the footer band, after the content and before the furniture.
    renderFootnotes(bound, options, drawHelpers),
    renderFurniture(bound, resolved.presentation, width, height, options, "header"),
    renderFurniture(bound, resolved.presentation, width, height, options, "footer")
  ].filter(Boolean);
  const children = [renderEmbeddedFonts(embeddedFontsFor(options.embeddedFonts, content)), ...content].filter(Boolean);
  // FF-44: Chromium (123+) trims adjacent fullwidth punctuation by default (CSS text-spacing-trim: normal; a sequence such as
  // 「」。 is up to 10 percent narrower), but measurement and PowerPoint advance every such character by its full width, so the browser
  // would stretch the glyphs back to the pinned textLength. space-all keeps the drawn advances equal to the measured ones. Only slides
  // that draw such punctuation carry it, so other output is unchanged.
  const drawn = content.join("");
  const trimsPunctuation = /[　-〿＀-￯]/.test(drawn) || (script?.scriptRole === "eastAsian" && /[‘-”]/.test(drawn));

  return tag(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      role: "img",
      "aria-label": title,
      viewBox: `0 0 ${width} ${height}`,
      width,
      height,
      lang,
      "xml:lang": lang,
      style: trimsPunctuation ? "text-spacing-trim:space-all" : undefined,
      ...traceAttrs(options, bound.path)
    },
    `\n${children.join("\n")}\n`
  );
}

function renderBackground(bound, width, height, options) {
  const background = bound.design.background;
  if (isPlainObject(background) && background.type === "gradient") {
    const id = `opf-s${bound.index + 1}-background`;
    const stops = Array.isArray(background.gradient?.stops) ? background.gradient.stops : [];
    const angle=(Number(background.gradient?.angle??0)*Math.PI)/180;
    const dx=Math.cos(angle)*50,dy=Math.sin(angle)*50;
    const stopTags = stops.map((stop, index) => tag("stop", {
      offset: stableNumber((stop.position ?? index / Math.max(1, stops.length - 1)) * 100) + "%",
      "stop-color": resolveBackgroundColor(stop.color, bound.design, bound.design.colors.background)
    }));
    return [
      tag("defs", traceAttrs(options, `${bound.path}.design.background`), tag("linearGradient", {
        id,
        x1: `${50-dx}%`,
        x2: `${50+dx}%`,
        y1: `${50-dy}%`,
        y2: `${50+dy}%`
      }, stopTags.join(""))),
      tag("rect", {
        x: 0,
        y: 0,
        width,
        height,
        fill: `url(#${id})`,
        opacity: background.opacity ?? 1,
        ...traceAttrs(options, `${bound.path}.design.background`)
      })
    ].join("\n");
  }

  if(isPlainObject(background) && background.type==='image'){
    const imageItem={value:background.image,path:`${bound.path}.design.background.image`};
    if(background.image.fit==='tile'){
      const size=Math.min(width,height)/4,id=`opf-s${bound.index+1}-image-tile`;
      return tag('g',{opacity:background.opacity??1},tag('defs',{},tag('pattern',{id,width:size,height:size,patternUnits:'userSpaceOnUse'},renderImage(imageItem,{x:0,y:0,width:size,height:size},bound,options)))+tag('rect',{width,height,fill:`url(#${id})`}));
    }
    return tag('g',{opacity:background.opacity??1},renderImage(imageItem,{x:0,y:0,width,height},bound,{...options,imageFit:background.image.fit??'cover'}));
  }
  if(isPlainObject(background) && background.type==='pattern'){
    const pattern=background.pattern??{},id=`opf-s${bound.index+1}-pattern`,color=resolveBackgroundColor(pattern.foregroundColor,bound.design,bound.design.colors.text),preset=pattern.preset;
    // Without core's pattern table (an older core) five presets keep their hand-drawn approximation. diagStripe is the
    // engine id that PPTX export writes as wdUpDiag, so both draw the same rising stripe.
    const stroke=(d,width=1)=>tag('path',{d,fill:'none',stroke:color,'stroke-width':width});
    // RR-07: every DrawingML preset (core PATTERN_PRESETS) is an 8x8 bitmap, one unit per 1/96 inch, anchored at the slide origin.
    const runs=typeof opfCore.patternRuns==='function'?opfCore.patternRuns(preset):undefined;
    const bitmap=runs?tag('path',{d:runs.map(run=>`M${run.x} ${run.y}h${run.width}v1h-${run.width}z`).join(''),fill:color,'shape-rendering':'crispEdges'}):'';
    const legacy=preset==='ltHorz'?tag('path',{d:'M0 4H8',stroke:color,'stroke-width':1}):preset==='diagStripe'||preset==='wdUpDiag'?tag('path',{d:'M-2 2L2 -2M0 8L8 0M6 10L10 6',stroke:color,'stroke-width':2}):preset==='pct5'?tag('circle',{cx:2,cy:2,r:.8,fill:color}):preset==='openDmnd'?stroke('M0 4L4 0L8 4L4 8Z'):preset==='wave'?stroke('M0 4C2 1 2 1 4 4S6 7 8 4'):'';
    const mark=bitmap||legacy;
    if(!mark)reportDiagnostic({code:'unsupported-pattern',path:`${bound.path}.design.background.pattern.preset`,message:`Pattern ${preset} is not implemented by the SVG preview.`},options);
    return tag('g',{opacity:background.opacity??1},tag('rect',{width,height,fill:bound.design.backgroundColor??'#FFFFFF'})+tag('defs',{},tag('pattern',{id,width:8,height:8,patternUnits:'userSpaceOnUse'},mark))+tag('rect',{width,height,fill:`url(#${id})`}));
  }
  return tag("rect", {
    x: 0,
    y: 0,
    width,
    height,
    opacity: typeof background==='object'?background?.opacity??1:1,
    fill: bound.design.backgroundColor ?? bound.design.colors.background,
    ...traceAttrs(options, `${bound.path}.design.background`)
  });
}

// design.slideImage: the shared composition frame, beneath branding and content.
// crop covers the frame and fit centers the whole image, matching native a:srcRect.
// Treatments mirror the native picture: the preset mask (core outline), recolor
// and alphaModFix on the pixels only, the centered line, then the overlay shape.
function renderSlideImage(bound, options) {
  const image = bound.geometry.slideImage;
  if (!image) return '';
  const trace = options.trace ? { 'data-opf-slide-image': image.path, 'data-opf-slide-image-position': image.position } : {};
  const value = image.alt === undefined ? image.value : { ...normalizeAsset(image.value), alt: image.alt };
  const picture = renderImage({ value, path: image.sourcePath }, image.box, bound, { ...options, imageFit: image.fill === 'crop' ? 'cover' : 'contain' });
  // Unresolved sources keep the ordinary placeholder without treatments, like the export.
  if (!picture.startsWith('<image')) return tag('g', trace, picture);
  const id = `opf-s${bound.index + 1}-slide-image`, shape = image.shape, defs = [];
  const masked = shape && shape.preset !== 'rect';
  if (masked) defs.push(tag('clipPath', { id: `${id}-clip` }, tag('path', { d: shape.path })));
  const matrix = slideImageRecolorMatrix(image.recolor, bound);
  if (matrix) defs.push(tag('filter', { id: `${id}-recolor`, 'color-interpolation-filters': 'sRGB' }, tag('feColorMatrix', { type: 'matrix', values: matrix })));
  let pixels = matrix || image.opacity !== undefined ? tag('g', { filter: matrix ? `url(#${id}-recolor)` : undefined, opacity: image.opacity === undefined ? undefined : preciseNumber(image.opacity) }, picture) : picture;
  if (masked) pixels = tag('g', { 'clip-path': `url(#${id}-clip)` }, pixels);
  const children = [defs.length ? tag('defs', {}, defs.join('')) : '', pixels];
  if (image.border) {
    const paint = slideImagePaint(image.border.color, bound, bound.design.colors.border);
    children.push(tag('path', { d: shape?.path ?? rectanglePath(image.box), fill: 'none', stroke: paint.color, 'stroke-opacity': paint.alpha < 1 ? preciseNumber(paint.alpha) : undefined, 'stroke-width': stableNumber(image.border.width), 'stroke-linejoin': 'miter', 'stroke-miterlimit': 8 }));
  }
  if (image.overlay) {
    const paint = slideImagePaint(image.overlay.color, bound, bound.design.colors.text);
    children.push(tag('path', { d: image.overlay.shape?.path ?? rectanglePath(image.overlay.box), fill: paint.color, 'fill-opacity': preciseNumber(paint.alpha * image.overlay.opacity), ...(options.trace ? { 'data-opf-slide-image-overlay': `${image.path}.overlay` } : {}) }));
  }
  return tag('g', trace, children.filter(Boolean).join(''));
}

// Native alpha and color-matrix values keep 1/100000 precision; three decimals would drift.
const preciseNumber = value => String(Math.round(value * 1e6) / 1e6);

function rectanglePath(box) {
  return `M${stableNumber(box.x)} ${stableNumber(box.y)}H${stableNumber(box.x + box.width)}V${stableNumber(box.y + box.height)}H${stableNumber(box.x)}Z`;
}

// ColorRef -> opaque #RRGGBB plus the AA byte as alpha, as the native srgbClr + alpha.
function slideImagePaint(value, bound, fallback) {
  const hex = resolveColorRef(value, bound, fallback) ?? fallback;
  const raw = normalizeColor(hex, fallback).slice(1);
  return { color: `#${raw.slice(0, 6).toUpperCase()}`, alpha: raw.length === 8 ? parseInt(raw.slice(6), 16) / 255 : 1 };
}

// Rec. 601 luminance on sRGB values; duotone maps it linearly from dark to light.
function slideImageRecolorMatrix(recolor, bound) {
  if (!recolor) return undefined;
  const weights = [0.299, 0.587, 0.114];
  const channels = recolor.type === 'duotone'
    ? [slideImagePaint(recolor.dark, bound, '#000000'), slideImagePaint(recolor.light, bound, '#FFFFFF')].map(paint => [1, 3, 5].map(at => parseInt(paint.color.slice(at, at + 2), 16) / 255))
    : [[0, 0, 0], [1, 1, 1]];
  const [dark, light] = channels;
  const rows = [0, 1, 2].map(channel => [...weights.map(weight => preciseNumber((light[channel] - dark[channel]) * weight)), 0, preciseNumber(dark[channel])].join(' '));
  return [...rows, '0 0 0 1 0'].join(' ');
}

function renderSlideContent(bound, width, height, options) {
  for (const diagnostic of [...bound.design.diagnostics, ...bound.geometry.diagnostics]) reportDiagnostic(diagnostic, options);
  return bound.geometry.items.map(item => {
    const frame=item.frameBox;
    const surface=frame ? tag('rect',{x:frame.x,y:frame.y,width:frame.width,height:frame.height,rx:8*Math.min(width,height)/720,fill:bound.design.colors.surface,stroke:bound.design.colors.border,...traceAttrs(options,item.path)}) : '';
    // RR-34: a captioned item draws its media in item.box and its caption band after it (src/annotations.js).
    return surface+renderPayload(item, item.box, { ...bound, composition: item.composition }, options)+(item.caption?renderCaption(item,{ ...bound, composition: item.composition },options,drawHelpers):'');
  });
}
// Draw helpers injected into src/annotations.js (captions and footnote areas).
const drawHelpers = { tag, renderTextBox, renderRichLines };

function reportDiagnostic(diagnostic, options) {
  const key = `${diagnostic.code}:${diagnostic.path}:${diagnostic.reason ?? ''}`;
  if (options._diagnosticPaths.has(key)) return;
  options._diagnosticPaths.add(key);
  options.onDiagnostic?.(diagnostic);
}

function renderPayload(item, box, bound, options) {
  if (!box) return "";
  if (item.field === "items" || item.field === "bullets") return renderList(item, box, bound, options);
  switch (item.type) {
    case "chart":
      return renderChart(item, box, bound, options);
    case "table":
      return renderTable(item, box, bound, options);
    case "image":
      return renderImage(item, box, bound, options);
    case "video":
      return renderMedia(item, box, bound, options);
    case "code":
      return renderCode(item, box, bound, options);
    case "metric":
      return renderMetric(item, box, bound, options);
    case "quote":
      return renderQuote(item, box, bound, options);
    case "timeline":
      return renderTimeline(item, box, bound, options);
    case "list":
      return renderList(item, box, bound, options);
    default:
      return renderTextPayload(item, box, bound, options);
  }
}

function renderTextPayload(item, box, bound, options) {
  return (Array.isArray(item.value) ? renderRichTextBox : renderTextBox)(Array.isArray(item.value) ? item.value : flattenText(item.value), box, bound, {
    path: item.path,
    // Core resolves one alignment per composed item for every engine. The
    // fallback keeps cores published before item.alignment working: titles
    // follow design.titleAlignment only (unset is left, as in core composition).
    align: item.alignment ?? (item.field === "title" ? bound.design.titleAlignment ?? "left" : bound.design.contentAlignment),
    fontSize: item.field === "title" ? 54 : item.field === "tag" ? 16 : 25,
    // fontScheme.accent draws the tag; core's textStyle (item.textStyle) already carries it, this is the fallback family.
    fontFamily: item.field === "title" ? bound.design.fonts.heading : item.field === "tag" ? bound.design.fonts.accent ?? bound.design.fonts.body : bound.design.fonts.body,
    fontWeight: item.field === "title" ? 700 : 400,
    // The slide tag is the eyebrow label: it draws in the primary colour (scheme accent1), as the
    // PPTX export writes it, or in the text colour when the primary is under 4.5:1 against the
    // slide background (FF-61). Every other text payload here uses the text colour.
    fill: item.field === "tag" ? tagFill(bound.design) : bound.design.colors.text,
    fit: item.text,
    textStyle: item.textStyle,
    diagnosticsHandled: Boolean(item.text),
    options
  });
}

function renderList(item, box, bound, options) {
  const scale=Math.min(bound.design.dimensions.width,bound.design.dimensions.height)/720;
  const fit=item.text?.listEntries?item.text:fitList(item.value,box,25*scale,((bound.composition??bound.geometry.composition).minFontSize??16)*scale,{style:{fontFamily:bound.design.fonts.body,fontWeight:400,path:item.path},textMeasurement:options.textMeasurement,...(item.payload?.numbering!==undefined?{numbering:item.payload.numbering}:{})});
  const children=[];
  // design.listBullet=image: core attaches the icon logo as item.bulletImage and its box (entry.bulletBox: 0.65 em, as PowerPoint draws a:buBlip). An icon that cannot be drawn keeps the glyph marker.
  const bullet=item.bulletImage?resolveBulletImage(item.bulletImage,bound,options):undefined;
  for(const entry of fit.listEntries){
    if(bullet){const box=entry.bulletBox??{x:entry.marker.x,y:entry.marker.y-entry.marker.fontSize*.65,width:entry.marker.fontSize*.65,height:entry.marker.fontSize*.65};children.push(tag('image',{x:stableNumber(box.x),y:stableNumber(box.y),width:stableNumber(box.width),height:stableNumber(box.height),href:bullet,preserveAspectRatio:'xMidYMid meet','aria-hidden':'true',...(options.trace?{'data-opf-generated':'true'}:{})}));}
    else children.push(tag('text',{x:stableNumber(entry.marker.x),y:stableNumber(entry.marker.y),'font-family':fontStack(entry.marker.style.fontFamily,bound.design.fontScheme.type),'font-size':stableNumber(entry.marker.fontSize),...numberMarkerStyle(entry.marker),fill:bound.design.colors.text,'aria-hidden':'true',...(entry.marker.anchor==='end'?{'text-anchor':'end'}:{})},escapeText(entry.marker.text)));
    const config={path:entry.textPath,align:'left',fill:bound.design.colors.text,rich:Array.isArray(entry.value),options};
    children.push(renderRichLines(typeof entry.value==='string'?[entry.value]:entry.value,entry.text,entry.textBox,bound,config));
    if(entry.description)children.push(renderRichLines(typeof entry.descriptionValue==='string'?[entry.descriptionValue]:entry.descriptionValue,entry.description,entry.descriptionBox,bound,{...config,path:entry.descriptionPath,rich:Array.isArray(entry.descriptionValue),fill:bound.design.colors.mutedText}));
  }
  return tag('g',{...traceAttrs(options,item.path),...(fit.overflow?{'data-opf-overflow':'true'}:{})},children.join('\n'));
}

// A numbered list's marker (numbering) draws the number with the weight and slant core measured it at: PowerPoint draws an
// auto-number in the first run's character formatting. Bullet markers carry no such attributes.
function numberMarkerStyle(marker) {
  if (!marker.number) return {};
  return {'font-weight':marker.style.fontWeight===400?undefined:marker.style.fontWeight,'font-style':marker.style.italic?'italic':undefined};
}

// Follows asset: references and the host imageResolver to the drawable source of an image value.
function resolveImageSource(item, bound, options) {
  let asset = normalizeAsset(item.value);
  const seen = new Set();
  let missingReference;
  while (asset.src?.startsWith("asset:")) {
    const id = asset.src.slice(6);
    if (seen.has(id)) throw new OPFRenderError("invalid-asset-reference", "Circular asset reference.", { path: item.path });
    seen.add(id);
    if (!Object.hasOwn(bound.assets,id)) { missingReference=id; break; }
    const {src:_source,...overrides}=asset;
    asset = {...normalizeAsset(bound.assets[id]),...overrides};
  }
  const source = options.imageResolver?.(asset.src, { asset, path: item.path }) ?? asset.src;
  // An SVG data URI (base64 or text, any encoding) is drawn as an image too, as a base64 URI: an SVG used as an image never
  // runs scripts or loads anything outside itself, in a browser or in the PNG/PDF rasterizer.
  const svg = typeof source === "string" ? svgImageSource(source) : null;
  const drawable = svg !== null || (typeof source === "string" && /^data:image\/(png|jpeg|gif|webp);base64,/i.test(source));
  return { asset, source: svg ?? source, drawable, missingReference };
}

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

// The base64 data URI of a drawable SVG, else null. Drawable: a data URI whose type is image/svg+xml, whose text is
// well-formed XML (and safe: no external or markup entity) with an <svg> root in the SVG namespace and an intrinsic size
// (width and height, or a viewBox) - the same checks opf-pptx makes before it writes a native SVG picture over a PNG
// fallback - so a document the export refuses (malformed, unsafe, no size) is the placeholder in the preview too, and the
// two agree. The scripts, foreign objects and external references a valid document may carry are never run or loaded: an
// SVG used as an image reaches nothing outside itself.
function svgImageSource(uri) {
  const header = /^data:([^;,]*)((?:;[^;,]*)*),/i.exec(uri);
  if (!header || !/^image\/svg\+xml$/i.test(header[1])) return null;
  let bytes;
  try {
    const payload = uri.slice(header[0].length);
    bytes = /;base64/i.test(header[2]) ? Uint8Array.from(atob(payload.replace(/\s+/g, "")), char => char.charCodeAt(0)) : new TextEncoder().encode(decodeURIComponent(payload));
  } catch { return null; }
  if (bytes.length > SVG_IMAGE_MAX_BYTES) return null;
  let text;
  try { text = decodeSvgText(bytes); } catch { return null; }
  const root = svgRootAttributes(text);
  if (!root || !svgHasIntrinsicSize(root)) return null;
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return `data:image/svg+xml;base64,${btoa(binary)}`;
}

const SVG_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

// UTF-8 (with or without a BOM), UTF-16 with a BOM, or the encoding the XML declaration names; throws on bytes the encoding cannot decode.
function decodeSvgText(bytes) {
  let start = 0, label = "utf-8";
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) start = 3;
  else if (bytes[0] === 0xff && bytes[1] === 0xfe) { label = "utf-16le"; start = 2; }
  else if (bytes[0] === 0xfe && bytes[1] === 0xff) { label = "utf-16be"; start = 2; }
  else {
    const declared = /^\s*<\?xml\b[^>]*\bencoding\s*=\s*["']([A-Za-z0-9._-]+)["']/.exec(String.fromCharCode(...bytes.subarray(0, 200)))?.[1];
    if (declared && !/^utf-?8$/i.test(declared)) label = declared;
  }
  return new TextDecoder(label, { fatal: true }).decode(bytes.subarray(start));
}

const SVG_START_TAG = /<([A-Za-z_][\w.-]*(?::[A-Za-z_][\w.-]*)?)((?:\s+[^\s=\/>"'<]+\s*=\s*(?:"[^"<]*"|'[^'<]*'))*)\s*(\/?)>/y;
const SVG_ATTRIBUTE = /\s+([^\s=\/>"'<]+)\s*=\s*(?:"([^"<]*)"|'([^'<]*)')/y;
const SVG_END_TAG = /<\/([A-Za-z_][\w.-]*(?::[A-Za-z_][\w.-]*)?)\s*>/y;

// The root element's attributes (references expanded) of a well-formed, safe SVG document in the SVG namespace, else null.
// A small XML check, not a parser: tags nest and close, attributes are quoted and unique, the one root is <svg>, text sits
// inside it, and every reference is one of the five predefined entities, a numeric reference or a plain-text entity the
// DOCTYPE declares. An entity that is external or contains markup, or expansions beyond the size limit, refuse the document.
function svgRootAttributes(text) {
  const stack = [], entities = new Map();
  let index = 0, rootDone = false, rootAttributes = null, expansion = 0;
  const references = value => value.replace(/&([^;\s&<]*);?/g, (all, name) => {
    if (!all.endsWith(";")) throw new Error("reference");
    if (/^(?:amp|lt|gt|quot|apos|#\d{1,7}|#x[0-9a-fA-F]{1,6})$/.test(name)) return all;
    if (!entities.has(name)) throw new Error("undeclared entity");
    const expanded = entities.get(name);
    if ((expansion += expanded.length) > SVG_IMAGE_MAX_BYTES) throw new Error("entity expansion");
    return expanded;
  });
  try {
    while (index < text.length) {
      if (text[index] !== "<") {
        const end = text.indexOf("<", index), chunk = text.slice(index, end < 0 ? text.length : end);
        index += chunk.length;
        if (!stack.length) { if (chunk.trim()) return null; }
        else { if (chunk.includes("]]>")) return null; references(chunk); }
        continue;
      }
      if (text.startsWith("<!--", index)) {
        const end = text.indexOf("-->", index + 4);
        if (end < 0) return null;
        index = end + 3;
      } else if (text.startsWith("<![CDATA[", index)) {
        const end = text.indexOf("]]>", index + 9);
        if (end < 0 || !stack.length) return null;
        index = end + 3;
      } else if (text.startsWith("<?", index)) {
        const end = text.indexOf("?>", index + 2);
        if (end < 0) return null;
        index = end + 2;
      } else if (text.startsWith("<!DOCTYPE", index)) {
        if (rootDone || stack.length || rootAttributes) return null;
        const match = /^<!DOCTYPE\s+[^\[>]*(?:\[([\s\S]*?)\]\s*)?>/.exec(text.slice(index));
        if (!match) return null;
        for (const declaration of (match[1] ?? "").matchAll(/<!ENTITY\b[^>]*>/g)) {
          const entity = /^<!ENTITY\s+([A-Za-z_][\w.-]*)\s+(?:"([^"]*)"|'([^']*)')\s*>$/.exec(declaration[0]);
          const value = entity?.[2] ?? entity?.[3];
          if (!entity || value.includes("&") || value.includes("<")) return null;
          entities.set(entity[1], value);
        }
        index += match[0].length;
      } else if (text.startsWith("</", index)) {
        SVG_END_TAG.lastIndex = index;
        const match = SVG_END_TAG.exec(text);
        if (!match || stack.pop() !== match[1]) return null;
        index = SVG_END_TAG.lastIndex;
        if (!stack.length) rootDone = true;
      } else {
        SVG_START_TAG.lastIndex = index;
        const match = SVG_START_TAG.exec(text);
        if (!match) return null;
        index = SVG_START_TAG.lastIndex;
        const [, qualified, source, selfClosing] = match;
        const attributes = [], names = new Set();
        SVG_ATTRIBUTE.lastIndex = 0;
        for (let attribute; source && (attribute = SVG_ATTRIBUTE.exec(source));) {
          if (names.has(attribute[1])) return null;
          names.add(attribute[1]);
          attributes.push([attribute[1], references(attribute[2] ?? attribute[3])]);
        }
        if (!stack.length) {
          if (rootDone || rootAttributes) return null;
          const colon = qualified.indexOf(":");
          if (qualified.slice(colon + 1) !== "svg") return null;
          const namespace = colon < 0 ? "xmlns" : `xmlns:${qualified.slice(0, colon)}`;
          if (!attributes.some(([key, value]) => key === namespace && value === SVG_NAMESPACE)) return null;
          rootAttributes = Object.fromEntries(attributes);
        }
        if (selfClosing) { if (!stack.length) rootDone = true; }
        else stack.push(qualified);
      }
    }
  } catch { return null; }
  return stack.length || !rootAttributes ? null : rootAttributes;
}

// The root has an intrinsic size: width and height lengths, or a viewBox (the same rule core and opf-pptx use).
function svgHasIntrinsicSize(attributes) {
  const length = value => { const match = value && /^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\s*(px|pt|pc|mm|cm|in|q)?\s*$/i.exec(value); return match && Number(match[1]) > 0 ? Number(match[1]) : undefined; };
  const box = (attributes.viewBox ?? "").trim().split(/[\s,]+/).map(Number);
  const view = box.length === 4 && box.every(Number.isFinite) && box[2] > 0 && box[3] > 0;
  return Boolean((length(attributes.width) && length(attributes.height)) || view);
}

// The drawable data URI of a picture bullet, or undefined (after reporting unresolved-asset once) so the glyph marker stays.
function resolveBulletImage(bulletImage, bound, options) {
  const { drawable, source, asset, missingReference } = resolveImageSource({ value: bulletImage.source, path: bulletImage.path }, bound, options);
  if (drawable) return source;
  const reason=missingReference?'missing-reference':!asset.src?'missing-source':'unsupported-source';
  const message=missingReference?`Bullet image asset ${missingReference} is missing; the preview draws the character bullet.`:'A picture bullet requires an embedded raster data URI or a host imageResolver; the preview draws the character bullet.';
  if (options.strictAssets) throw new OPFRenderError("unresolved-asset", message, { path: bulletImage.path,reason });
  reportDiagnostic({code:'unresolved-asset',path:bulletImage.path,message,reason,source:asset.src,assetId:missingReference,description:asset.alt??asset.title??'Bullet image',placeholder:'glyph'},options);
  return undefined;
}

function renderImage(item, box, bound, options) {
  const { asset, source, drawable, missingReference } = resolveImageSource(item, bound, options);
  if (drawable) {
    return tag("image", { x: box.x, y: box.y, width: box.width, height: box.height,
      href: source, preserveAspectRatio: options.imageAnchor === "left" ? "xMinYMid meet" : options.imageAnchor === "right" ? "xMaxYMid meet" : (options.imageFit ?? (bound.design.imageFill === "crop" ? "cover" : "contain")) === "cover" ? "xMidYMid slice" : "xMidYMid meet", role: "img", "aria-label": asset.alt ?? options.imageLabel ?? "Image",
      ...traceAttrs(options, item.path), ...generatedAttrs(options) });
  }
  const reason=missingReference?'missing-reference':!asset.src?'missing-source':'unsupported-source';
  const message=missingReference?`Image asset ${missingReference} is missing; supply the referenced asset or resolve it in the host.`:'Image requires an embedded raster or SVG data URI, or a host imageResolver.';
  if (options.strictAssets) throw new OPFRenderError("unresolved-asset", message, { path: item.path,reason });
  const fill = bound.design.colors.surface;
  const scale=Math.min(bound.design.dimensions.width,bound.design.dimensions.height)/720;
  const padding=Math.min(24*scale,box.width*.06,box.height*.1),inner=inset(box,padding);
  const description=asset.alt??asset.title??'Image';
  const label=`Image unavailable\n${description}`;
  const style=resolveTextStyle({fontFamily:bound.design.fonts.body,fontWeight:600,path:item.path},options.textMeasurement);
  const fit=fitText(label,inner,20*scale,((bound.composition??bound.geometry.composition).minFontSize??16)*scale,textWidthMeasurer(style,options.textMeasurement));
  const textColor=textColorForFill(fill,bound.design.colors.text);
  reportDiagnostic({code:'unresolved-asset',path:item.path,message,reason,source:asset.src,assetId:missingReference,description,placeholder:fit.overflow?'icon':'label'},options);
  const children = [
    tag("rect", {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      rx: 0,
      fill,
      stroke: bound.design.colors.border,
      "stroke-width": 1,
      "stroke-dasharray": "4 3",
      ...traceAttrs(options, item.path)
    })
  ];
  if(!fit.overflow)children.push(renderTextBox(label, inner, bound, {
      path: item.path,
      fontSize: 20,
      fontFamily: style.fontFamily,
      fontWeight: 600,
      textStyle:style,fit,diagnosticsHandled:true,
      fill: textColor,
      options,
      align: "center",
      verticalAlign: "middle"
    }));
  else {
    // This is a status indicator, not shortened authored content. The complete
    // description remains in the accessible name and the path-specific diagnostic.
    const size=Math.max(0,Math.min(inner.width,inner.height,24*scale)),icon=centeredBox(inner,size,size);
    children.push(tag('path',{d:`M ${icon.x} ${icon.y} L ${icon.x+size} ${icon.y+size} M ${icon.x+size} ${icon.y} L ${icon.x} ${icon.y+size}`,fill:'none',stroke:textColor,'stroke-width':Math.min(2*scale,size/8),'aria-hidden':'true'}));
  }
  return tag("g", {...traceAttrs(options,item.path),...generatedAttrs(options),'data-opf-asset-status':'unresolved',role:'img','aria-label':`Image unavailable: ${description}`},children.join("\n"));
}

function renderMedia(item, box, bound, options) {
  const asset = normalizeAsset(item.value);
  const iconBox = centeredBox(box, 72, 72);
  const children = [
    tag("rect", {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      fill: bound.design.colors.surface,
      stroke: bound.design.colors.border,
      "stroke-width": 1,
      ...traceAttrs(options, item.path)
    }),
    tag("circle", {
      cx: iconBox.x + iconBox.width / 2,
      cy: iconBox.y + iconBox.height / 2,
      r: 36,
      fill: bound.design.colors.primary,
      ...traceAttrs(options, item.path)
    }),
    tag("path", {
      d: trianglePath(iconBox.x + 28, iconBox.y + 22, 28, 28),
      fill: "#FFFFFF",
      ...traceAttrs(options, item.path)
    }),
    renderTextBox(asset.title || asset.src || "Media", { ...box, y: iconBox.y + iconBox.height + 20, height: 50 }, bound, {
      path: item.path,
      fontSize: 18,
      fontFamily: bound.design.fonts.body,
      fontWeight: 600,
      fill: bound.design.colors.mutedText,
      options,
      align: "center"
    })
  ];
  return tag("g", traceAttrs(options, item.path), children.join("\n"));
}

function renderCode(item, box, bound, options) {
  const layout = item.codeLayout;
  if (!layout) throw new OPFRenderError('missing-code-layout', 'Code rendering requires a coordinated core build with shared code geometry.', {path:item.path});
  for (const part of layout.parts) {
    // XML 1.0 Char excludes controls and unpaired UTF-16 surrogates. The u flag
    // keeps valid supplementary characters (surrogate pairs) accepted.
    const invalid = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uD800-\uDFFF\uFFFE\uFFFF]/u.exec(part.text);
    if (invalid) throw new OPFRenderError('invalid-code-text', `Code text contains U+${invalid[0].codePointAt(0).toString(16).toUpperCase().padStart(4,'0')} at UTF-16 offset ${invalid.index}, which XML cannot represent; edit that character before rendering.`, {path:part.path});
  }
  const syntax = codeSyntax(item, layout, bound, options);
  const children = [
    tag("rect", {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      fill: "#111827",
      stroke: "#334155",
      "stroke-width": 1,
      ...traceAttrs(options, item.path)
    })
  ];
  for (const part of layout.parts) {
    if (!part.fit) throw new OPFRenderError('layout-overflow', 'Code content has no usable internal space; increase its cell size before rendering.', {path:part.path,issues:layout.diagnostics});
    const lines=part.fit.sourceLines.map((line,index)=>tag('text',{
      x:stableNumber(part.box.x),y:stableNumber(part.box.y+part.fit.fontSize+index*part.fit.lineHeight),
      'text-anchor':'start','font-family':fontStack(part.style.fontFamily,'monospace'),
      'font-size':stableNumber(part.fit.fontSize),'font-weight':part.style.fontWeight,'font-style':part.style.italic?'italic':undefined,
      'xml:space':'preserve',style:'white-space:pre','text-rendering':'geometricPrecision',fill:part.role==='body'?'#E5E7EB':'#93C5FD',
      ...traceAttrs(options,part.path),...(options.trace?{'data-opf-code-role':part.role,'data-opf-generated':part.generated?'true':undefined,
        'data-opf-text-start':line.start,'data-opf-text-end':line.end,'data-opf-text-next-start':line.nextStart,'data-opf-line-boundary':line.boundary}:{}),
    },line.segments.map(segment=>segmentSpan({
      x:stableNumber(part.box.x+segment.x),
      // SVG's CSS tab-size does not place literal tabs at their measured stops.
      ...(segment.kind==='tab'?{textLength:stableNumber(segment.width),lengthAdjust:'spacingAndGlyphs'}:{}),
      ...(options.trace?{'data-opf-segment':segment.kind,'data-opf-text-start':segment.start,'data-opf-text-end':segment.end}:{}),
      // Code stays left to right; script runs still take their slot fonts.
    },segment,part.text.slice(segment.start,segment.end),part.style,bound,'monospace',{rtl:false,fontSize:part.fit.fontSize},part.role==='body'?syntax:undefined)).join('')));
    children.push(tag('g',{...traceAttrs(options,part.path),...(options.trace?{'data-opf-code-role':part.role,'data-opf-generated':part.generated?'true':undefined,
      'data-opf-box-x':part.box.x,'data-opf-box-y':part.box.y,'data-opf-box-width':part.box.width,'data-opf-box-height':part.box.height}:{}),
      ...(part.fit.overflow?{'data-opf-overflow':'true'}:{})},lines.join('\n')));
  }
  return tag("g", {...traceAttrs(options,item.path),...(options.trace?{'data-opf-code-container':'true'}:{})}, children.join("\n"));
}

function renderMetric(item, box, bound, options) {
  const layout=item.metricLayout;
  if (!layout) throw new OPFRenderError('missing-metric-layout','Metric rendering requires coordinated core metric geometry.',{path:item.path});
  const children=[];
  // RR-07: a trend draws an arrow beside its word and colours the trend and delta text, from core's accepted geometry.
  const trendMark=metricTrendMark(layout,bound,options);
  const partFill=part=>trendMark&&(part.role==='trend'||part.role==='delta')?trendMark.color:part.role==='value'?bound.design.colors.primary:bound.design.colors.text;
  for (const part of layout.parts) {
    const invalid=/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uD800-\uDFFF\uFFFE\uFFFF]/u.exec(part.text);
    if (invalid) throw new OPFRenderError('invalid-metric-text',`Metric text contains U+${invalid[0].codePointAt(0).toString(16).toUpperCase().padStart(4,'0')} at UTF-16 offset ${invalid.index}, which XML cannot represent; edit that character before rendering.`,{path:part.path});
    if (!part.visible) continue;
    if (!part.fit||part.linePositions?.length!==part.fit.sourceLines.length) throw new OPFRenderError('layout-overflow','Metric content has no accepted internal line positions; increase its cell size or coordinate package versions.',{path:part.path,issues:layout.diagnostics});
    const partRtl=paragraphRtl(bound,part.text);
    // Anchor untabbed lines at the accepted alignment edge, as PPTX export does,
    // so a shaper whose advance differs from the accepted width keeps the edge.
    // Tabbed lines keep their accepted segment origins.
    const factor=layout.alignment==='right'?1:layout.alignment==='center'?.5:0;
    const lines=part.fit.sourceLines.map((line,index)=>{
      const origin=part.linePositions[index];
      if(factor&&!line.segments.some(segment=>segment.kind==='tab'))return tag('text',{x:stableNumber(origin.x+line.width*factor),y:stableNumber(origin.baseline),'text-anchor':factor===1?'end':'middle',
        'font-family':fontStack(part.style.fontFamily,bound.design.fontScheme.type),'font-size':stableNumber(part.fit.fontSize),
        'font-weight':part.style.fontWeight,'font-style':part.style.italic?'italic':undefined,
        'xml:space':'preserve',style:'white-space:pre','text-rendering':'geometricPrecision',fill:partFill(part),
        ...traceAttrs(options,part.path),...(options.trace?{'data-opf-metric-role':part.role,'data-opf-text-start':line.start,
          'data-opf-text-end':line.end,'data-opf-text-next-start':line.nextStart,'data-opf-line-boundary':line.boundary}:{}),
      },line.segments.map(segment=>segmentSpan({
        ...(options.trace?{'data-opf-segment':segment.kind,'data-opf-text-start':segment.start,'data-opf-text-end':segment.end}:{}),
      },segment,part.text.slice(segment.start,segment.end),part.style,bound,bound.design.fontScheme.type,{rtl:partRtl(line.start),fontSize:part.fit.fontSize})).join(''));
      return tag('text',{x:stableNumber(origin.x),y:stableNumber(origin.baseline),'text-anchor':'start',
        'font-family':fontStack(part.style.fontFamily,bound.design.fontScheme.type),'font-size':stableNumber(part.fit.fontSize),
        'font-weight':part.style.fontWeight,'font-style':part.style.italic?'italic':undefined,
        'xml:space':'preserve',style:'white-space:pre','text-rendering':'geometricPrecision',fill:partFill(part),
        ...traceAttrs(options,part.path),...(options.trace?{'data-opf-metric-role':part.role,'data-opf-text-start':line.start,
          'data-opf-text-end':line.end,'data-opf-text-next-start':line.nextStart,'data-opf-line-boundary':line.boundary}:{}),
      },line.segments.map(segment=>segmentSpan({x:stableNumber(origin.x+segment.x),
        ...(segment.kind==='tab'?{textLength:stableNumber(segment.width),lengthAdjust:'spacingAndGlyphs'}:{}),
        ...(options.trace?{'data-opf-segment':segment.kind,'data-opf-text-start':segment.start,'data-opf-text-end':segment.end}:{}),
      },segment,part.text.slice(segment.start,segment.end),part.style,bound,bound.design.fontScheme.type,{rtl:partRtl(line.start),fontSize:part.fit.fontSize})).join(''));
    });
    children.push(tag('g',{...traceAttrs(options,part.path),...(options.trace?{'data-opf-metric-role':part.role,
      'data-opf-box-x':part.box.x,'data-opf-box-y':part.box.y,'data-opf-box-width':part.box.width,'data-opf-box-height':part.box.height}:{}),
      ...(part.fit.overflow?{'data-opf-overflow':'true'}:{})},lines.join('\n')));
  }
  if (trendMark) children.push(tag('g',{role:'img','aria-label':trendMark.ariaLabel},tag('polygon',{points:trendMark.points.map(([x,y])=>`${stableNumber(x)},${stableNumber(y)}`).join(' '),fill:trendMark.color})));
  return tag('g',{...traceAttrs(options,item.path),...(options.trace?{'data-opf-metric-container':'true'}:{})},children.join('\n'));
}

// The trend arrow and colour for a laid-out metric (core metricTrendMark); undefined without a trend or without core support.
function metricTrendMark(layout,bound,options) {
  if (typeof opfCore.metricTrendMark!=='function') return undefined;
  return opfCore.metricTrendMark(layout,{background:bound.design.backgroundColor??bound.design.colors.background});
}

function renderQuote(item, box, bound, options) {
  const layout = item.quoteLayout;
  if (!layout) throw new OPFRenderError('missing-quote-layout', 'Quote rendering requires a coordinated core build with shared quote geometry.', {path:item.path});
  const children = layout.parts.map(part => {
    if (!part.fit) throw new OPFRenderError('layout-overflow', 'Quote content has no usable internal space; increase its cell size before rendering.', {path:part.path,issues:layout.diagnostics});
    return renderTextBox(part.text,part.box,bound,{
      path:part.path,fit:part.fit,textStyle:part.style,fontFamily:part.requestedStyle.fontFamily,
      fill:part.role==='footer'?bound.design.colors.mutedText:bound.design.colors.text,
      diagnosticsHandled:true,options,
    });
  });
  return tag("g", traceAttrs(options, item.path), children.join("\n"));
}

function renderTimeline(item, box, bound, options) {
  const layout=item.timelineLayout;
  if(!layout)throw new OPFRenderError('missing-timeline-layout','Timeline rendering requires a coordinated core build with shared timeline geometry.',{path:item.path});
  const scale=Math.min(bound.design.dimensions.width,bound.design.dimensions.height)/720;
  const children=[tag('line',{...layout.connector,stroke:bound.design.colors.border,'stroke-width':3*scale,...traceAttrs(options,item.path)})];
  for(const marker of layout.markers)children.push(tag('circle',{cx:marker.x,cy:marker.y,r:marker.radius,fill:bound.design.colors.primary,...traceAttrs(options,marker.path)}));
  for(const part of layout.parts){
    if(!part.fit)throw new OPFRenderError('layout-overflow','Timeline field has no usable space; change the arrangement or paginate events.',{path:part.path,issues:layout.diagnostics});
    children.push(tag('g',options.trace?{'data-opf-timeline-role':part.role}:{},renderTextBox(part.text,part.box,bound,{
      path:part.path,fit:part.fit,textStyle:part.style,fontFamily:part.requestedStyle.fontFamily,align:part.alignment,
      fill:bound.design.colors.text,diagnosticsHandled:true,options,
    })));
  }
  return tag('g',{...traceAttrs(options,item.path),...(options.trace?{'data-opf-timeline-arrangement':layout.arrangement}:{})},children.join('\n'));
}

function renderTable(item, box, bound, options) {
  const scale = Math.min(bound.design.dimensions.width, bound.design.dimensions.height) / 720;
  const layout = layoutTable(item.value, box, {scale, minFontSize:(bound.composition ?? bound.geometry.composition).minFontSize, fontFamily:bound.design.fonts.body, textMeasurement:options.textMeasurement, path:item.path, presentation:bound.presentation, ...(bound.geometry?.direction === "rtl" ? {direction:"rtl"} : {})});
  const children = [];
  // RR-54: a dataset table has no rows or columns of its own to point at; every cell reports the table's authored path.
  const own = isDatasetTable(item, bound) ? () => item.path : (path) => path;
  const separateBorders = layout.rows.some(row => row.cells.some(cell => cell.style?.borders));
  const defaultEdges = [], explicitEdges = [];
  for (const row of layout.rows) for (const cell of row.cells) {
    const style = cell.style ?? {};
    const defaultFill = cell.header ? bound.design.colors.primary : bound.design.colors.surface;
    const fill = style.fill == null
      ? defaultFill
      : resolveColorRef(style.fill, bound, defaultFill);
    const defaultText = textColorForFill(fill, cell.header ? "#FFFFFF" : bound.design.colors.text);
    const textFill = style.color == null
      ? defaultText
      : resolveColorRef(style.color, bound, defaultText);
    children.push(tag("rect", {
      x: stableNumber(cell.box.x), y: stableNumber(cell.box.y),
      width: stableNumber(cell.box.width), height: stableNumber(cell.box.height),
      fill,
      stroke: separateBorders ? undefined : bound.design.colors.border, "stroke-width":separateBorders ? undefined : 1,
      ...traceAttrs(options, own(cell.sourcePath ?? cell.path))
    }));
    if (separateBorders) {
      const {x, y, width, height} = cell.box;
      const edges = {top:[x,y,x+width,y],right:[x+width,y,x+width,y+height],bottom:[x,y+height,x+width,y+height],left:[x,y,x,y+height]};
      for (const [edge, coordinates] of Object.entries(edges)) {
        const border = style.borders?.[edge];
        (border ? explicitEdges : defaultEdges).push({coordinates, border, path:own(`${cell.sourcePath ?? cell.path}.style.borders.${edge}`)});
      }
    }
    // Core layout has already applied vertical alignment to cell.textBox.y.
    children.push((cell.rich ? renderRichTextBox : renderTextBox)(cell.rich ? cell.value : flattenText(cell.value ?? ""), cell.textBox, bound, {
      path:own(cell.path), fontSize:15, fontFamily:bound.design.fonts.body,
      fontWeight:cell.header ? 700 : 400, textStyle:cell.textStyle, fit:cell.fit,
      fill:textFill, align:style.align, options
    }));
  }

  return tag("g", traceAttrs(options, item.path), [...children, ...renderTableBorders(defaultEdges, explicitEdges, scale, bound, options)].join("\n"));
}

// Explicit edges own their shared segment, including invisible/zero-width edges.
// Split implicit neighbors at merge boundaries so they cannot fill dashed gaps,
// cover alpha strokes, or reintroduce a border the author removed.
function renderTableBorders(defaultEdges, explicitEdges, scale, bound, options) {
  const defaultColor = bound.design.colors.border;
  const epsilon = 1e-7;
  const segment = ({coordinates:[x1,y1,x2,y2]}) => y1 === y2
    ? {horizontal:true, fixed:y1, start:x1, end:x2}
    : {horizontal:false, fixed:x1, start:y1, end:y2};
  const blockers = explicitEdges.map(segment);
  const defaults = defaultEdges.flatMap(edge => {
    const axis = segment(edge);
    let intervals = [[axis.start, axis.end]];
    for (const blocker of blockers) {
      if (axis.horizontal !== blocker.horizontal || Math.abs(axis.fixed - blocker.fixed) > epsilon) continue;
      intervals = intervals.flatMap(([start,end]) => {
        if (blocker.end <= start + epsilon || blocker.start >= end - epsilon) return [[start,end]];
        return [[start,Math.min(end,blocker.start)],[Math.max(start,blocker.end),end]].filter(([a,b]) => b-a > epsilon);
      });
    }
    return intervals.map(([start,end]) => ({...edge,coordinates:axis.horizontal
      ? [start,axis.fixed,end,axis.fixed] : [axis.fixed,start,axis.fixed,end]}));
  });
  return [...defaults,...explicitEdges].flatMap(({coordinates:[x1,y1,x2,y2],border,path}) => {
    const width = border ? border.width * scale : 1;
    if (width === 0) return [];
    const stroke = border?.color == null
      ? defaultColor
      : resolveColorRef(border.color, bound, defaultColor);
    return [tag('line', {
      x1:stableNumber(x1), y1:stableNumber(y1), x2:stableNumber(x2), y2:stableNumber(y2),
      stroke, 'stroke-width':stableNumber(width),
      'stroke-dasharray':border?.dash === 'dash' ? `${width*4} ${width*3}` : border?.dash === 'dot' ? `${width} ${width*2}` : undefined,
      ...traceAttrs(options,path)
    })];
  });
}

function renderChart(item, box, bound, options) {
  // Catalog chart types (kept, deprecated and aliased ids) preview the native
  // construct opf-pptx exports; other ids keep the legacy single-series preview.
  const rendered = renderCatalogChart(item, box, bound, options, { tag, traceAttrs, stableNumber, renderTextBox, reportDiagnostic });
  if (rendered) return rendered;
  const chart = item.value ?? {};
  const chartType = chart.type ?? engineDefaults.chartTypes[0];
  const data = inlineChartRows(legacyChartData(chart, bound));
  // A dataset-backed chart has no data.rows of its own: its parts report the chart's authored path.
  const part = isDatasetChart(item, bound) ? () => item.path : (path) => path;
  const plot = inset(box, 28);
  const max = Math.max(1, ...data.map((row) => Math.abs(row.value)));
  const panelFill = bound.design.colors.surface;
  const labelColor = textColorForFill(panelFill, bound.design.colors.text);
  const primary = chartColorForFill(panelFill, bound.design.colors.primary);
  const secondary = chartColorForFill(panelFill, bound.design.colors.secondary);
  const children = [
    tag("rect", {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      fill: panelFill,
      stroke: bound.design.colors.border,
      "stroke-width": 1,
      ...traceAttrs(options, item.path)
    })
  ];

  if (!data.length) {
    children.push(renderTextBox("No chart data", plot, bound, {
      path: item.path,
      fontSize: 20,
      fontFamily: bound.design.fonts.body,
      fontWeight: 500,
      fill: labelColor,
      options,
      align: "center",
      verticalAlign: "middle"
    }));
    return tag("g", traceAttrs(options, item.path), children.join("\n"));
  }

  if (chartType.includes("line") || chartType.includes("area")) {
    const points = data.map((row, index) => {
      const x = plot.x + (data.length === 1 ? plot.width / 2 : (plot.width / (data.length - 1)) * index);
      const y = plot.y + plot.height - (Math.abs(row.value) / max) * plot.height;
      return [x, y];
    });
    children.push(tag("polyline", {
      points: points.map(([x, y]) => `${stableNumber(x)},${stableNumber(y)}`).join(" "),
      fill: "none",
      stroke: primary,
      "stroke-width": 4,
      ...traceAttrs(options, part(`${item.path}.data`))
    }));
    points.forEach(([x, y], index) => children.push(tag("circle", {
      cx: stableNumber(x),
      cy: stableNumber(y),
      r: 5,
      fill: primary,
      ...traceAttrs(options, part(`${item.path}.data.rows.${index}`))
    })));
  } else {
    const gap = 10;
    const barWidth = Math.max(6, (plot.width - gap * (data.length - 1)) / data.length);
    data.forEach((row, index) => {
      const barHeight = (Math.abs(row.value) / max) * plot.height;
      const x = plot.x + index * (barWidth + gap);
      const y = plot.y + plot.height - barHeight;
      children.push(tag("rect", {
        x: stableNumber(x),
        y: stableNumber(y),
        width: stableNumber(barWidth),
        height: stableNumber(barHeight),
        fill: index % 2 === 0 ? primary : secondary,
        ...traceAttrs(options, part(`${item.path}.data.rows.${index}`))
      }));
    });
  }

  children.push(renderTextBox(data.map((row) => row.label).join("  "), {
    x: plot.x,
    y: plot.y + plot.height + 8,
    width: plot.width,
    height: 24
  }, bound, {
    path: part(`${item.path}.data`),
    fontSize: 12,
    fontFamily: bound.design.fonts.body,
    fontWeight: 400,
    fill: labelColor,
    options,
    align: "center"
  }));

  return tag("g", traceAttrs(options, item.path), children.join("\n"));
}

// RR-54: the legacy sketch reads the same resolved rows as the catalog charts (mapping, datasets and strict numbers). Data that does
// not resolve, or a core without the resolver, is read as authored.
function legacyChartData(chart, bound) {
  if (typeof opfCore.resolveChartData !== "function") return chart.data;
  const resolved = opfCore.resolveChartData(chart, bound.presentation);
  return resolved.ok ? { rows: resolved.rows, resolved: true } : chart.data;
}

function inlineChartRows(data) {
  const rows = Array.isArray(data?.rows) ? data.rows : [];
  return rows.map((row, index) => {
    const cells = Array.isArray(row) ? row : [row];
    // Resolved rows already hold strict numbers (a gap is null), so only a number cell is a value: reading a numeric-looking label
    // ("2020") or a boolean as the value of a gap would plot it.
    const value = cells.find((cell) => typeof cell === "number") ?? (data?.resolved ? 0 : Number(cells.find((cell) => Number.isFinite(Number(cell))) ?? 0));
    return {
      label: flattenText(cells.find((cell) => typeof cell === "string") ?? `Row ${index + 1}`),
      value: Number.isFinite(value) ? value : 0
    };
  });
}

function renderFurniture(bound, presentation, width, height, options, kind) {
  const layout=bound.geometry.furniture;
  if(!layout){
    const value=bound.slide.design?.[kind]!==undefined?bound.slide.design[kind]:presentation.design?.[kind];
    if(value)throw new OPFRenderError('missing-furniture-layout','Header/footer rendering requires coordinated core furniture geometry.',{path:bound.path});
    return '';
  }
  return tag('g',{},layout.parts.filter(part=>part.kind===kind).map(part=>{
    const trace=options.trace?{'data-opf-furniture-kind':kind,'data-opf-furniture-field':part.field,'data-opf-furniture-generated':String(part.generated),'data-opf-furniture-editable':!part.generated?'true':undefined,'data-opf-furniture-source':part.sourcePath}:{};
    if(part.type==='image')return tag('g',trace,renderImage({value:part.image,path:part.path},part.box,bound,{...options,imageFit:'contain'}));
    return tag('g',trace,renderTextBox(part.text,part.box,bound,{path:part.path,fit:part.fit,textStyle:part.style,fontFamily:part.style.fontFamily,align:part.alignment,fill:bound.design.colors.mutedText,diagnosticsHandled:true,options}));
  }).join(''));
}
function renderBranding(bound,presentation,width,height,options) {
  const design={...presentation.design,...bound.slide.design}, pieces=[];
  const rootFor=key=>bound.slide.design?.[key]!==undefined?`${bound.path}.design.${key}`:`design.${key}`;
  if(design.watermark){
    pieces.push(tag('g',{opacity:typeof design.watermark==='object'?design.watermark.opacity??.08:.08},renderImage({value:design.watermark,path:rootFor('watermark')},{x:width*.3,y:height*.3,width:width*.4,height:height*.4},bound,{...options,imageFit:'contain'})));
  }
  // Cover and section slides: the deck logo core composed at the top-left of the free area, anchored left.
  const logo=bound.geometry.logo;
  if(logo)pieces.push(renderImage({value:logo.source,path:logo.path},logo.box,bound,{...options,imageAnchor:logo.anchor??'left',imageLabel:'Logo',imageGenerated:true}));
  return pieces.join('');
}

// A family name is written unquoted only when it is a valid sequence of CSS identifiers; a word that starts with a digit
// ("Source Sans 3", "Noto Sans Symbols 2") or any other non-identifier character makes an unquoted name invalid CSS, which
// drops the whole font-family in a browser (FF-45). Such names are single-quoted (the attribute is double-quoted).
const cssIdentifierSequence = /^(?:-?(?:[A-Za-z_ -￿]|\\.)(?:[\w -￿-]|\\.)*)(?: (?:-?(?:[A-Za-z_ -￿]|\\.)(?:[\w -￿-]|\\.)*))*$/;
const cssFamily = name => cssIdentifierSequence.test(name) && !/^(?:inherit|initial|unset|default|serif|sans-serif|monospace|cursive|fantasy|system-ui)$/i.test(name) ? name : `'${name.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
function fontStack(family, type) {
  const fallback = type === "serif" ? "serif" : type === "monospace" ? "monospace" : "sans-serif";
  return `${[family].flat().map(cssFamily).join(", ")}, ${fallback}`;
}

// Unicode directional isolates (FF-19): each paragraph (text between hard line
// breaks) of a right-to-left-language deck takes one base direction from
// paragraphDirection(text, deckDirection), the rule the PPTX export uses for
// a:pPr rtl. Every wrapped line of a right-to-left paragraph is laid out as a
// right-to-left isolate, so its lines never differ in direction. Absolute
// alignment and measured advances are unchanged.
const RIGHT_TO_LEFT_ISOLATE = "\u2067", POP_DIRECTIONAL_ISOLATE = "\u2069";
// Core owns the rule (paragraphDirection, core #134), so preview and export agree.
// Without it (published core 0.11.0) every paragraph is left to right, as in export.
const coreParagraphDirection = typeof opfCore.paragraphDirection === "function" ? opfCore.paragraphDirection : null;
// RR-05: authored alignment is logical for right-to-left text, so `left` is the start edge (drawn at the right of a
// right-to-left line) and `right` the end edge. Core owns the rule; the fallback only serves a core without it, which
// also reports no line directions, so it never flips.
const physicalAlignment = typeof opfCore.physicalAlignment === "function" ? opfCore.physicalAlignment : alignment => alignment;
/** Maps a source offset of the text to whether its paragraph is right to left. */
function paragraphRtl(bound, text) {
  if (bound.scriptFonts?.rtl !== true || !coreParagraphDirection) return () => false;
  const source = String(text ?? ""), spans = [];
  let start = 0;
  for (const match of source.matchAll(/\r\n|\r|\n/g)) { spans.push([start, match.index]); start = match.index + match[0].length; }
  spans.push([start, source.length]);
  const rtl = spans.map(([from, to]) => coreParagraphDirection(source.slice(from, to), "rtl") === "rtl");
  return offset => { for (let index = spans.length - 1; index >= 0; index--) if (offset >= spans[index][0]) return rtl[index]; return rtl[0]; };
}

/**
 * SVG content for `text` drawn in `style` (FF-19). Text in the style's own
 * family is emitted unchanged. A single run in another family returns that
 * family for the enclosing element. Several runs become tspans naming their
 * script slot's family. With `placement` ({x, width, fontSize}) the runs are
 * positioned at their measured advances, each with its own textLength, because
 * a textLength spanning differently fonted tspans does not rasterize reliably;
 * the caller then drops its own textLength and anchors at the start.
 */
// Nested script runs of a line drawn with a flagged face (Gelasio) opt back into default shaping,
// unless the run itself uses a flagged family (tag() then adds that family's own style).
function nestedReset(style, run) {
  const parent = disabledFeaturesStyle(style?.fontFamily);
  return parent && !disabledFeaturesStyle([run.stack ?? run.family].flat()[0]) ? RESET_POLICY_FEATURES : undefined;
}

function scriptLine(text, style, bound, type, { rtl = false, placement, trace, fontSize } = {}) {
  const value = String(text ?? "");
  const scripts = bound.scriptFonts;
  rtl = rtl && value !== "";
  const isolate = content => rtl ? `${RIGHT_TO_LEFT_ISOLATE}${content}${POP_DIRECTIONAL_ISOLATE}` : content;
  const runs = value && scripts ? scripts.plan(value, style) : [{ text: value, own: true }];
  // RR-38: PowerPoint's baseline of a line in Arabic Typesetting sits above core's (one em below the line top): the caller moves it up by `baselineShift` em.
  const shiftOf = list => { const shift = baselineShift(list); return shift ? { baselineShift: shift } : {}; };
  // FF-45: symbol runs (Wingdings, Symbol, Webdings codes drawn as their Unicode equivalents) are always positioned when the
  // line is placed, one tspan per glyph at the verified symbol font's advance, so a single mapped glyph is never stretched to it.
  const symbols = runs.some(run => run.symbol);
  if (runs.length === 1 && !(symbols && placement && placement.width > 0)) {
    const [run] = runs;
    // RR-38: a replacement the policy scales (Arabic Typesetting -> Noto Naskh Arabic, 0.64) is drawn at the scaled size; the caller applies it.
    return { content: isolate(escapeText(run.own ? value : run.text)), family: run.own ? undefined : fontStack(run.stack ?? run.family, type), ...(run.sizeAdjust ? { sizeAdjust: run.sizeAdjust } : {}), ...shiftOf(runs) };
  }
  const baseSize = placement?.fontSize ?? fontSize;
  const adjusted = run => run.sizeAdjust && baseSize > 0 ? stableNumber(adjustedFontSize(baseSize, run.sizeAdjust)) : undefined;
  const widths = placement && placement.width > 0 ? scripts.runWidths(runs, placement.fontSize, style) : undefined;
  if (!widths) {
    return { content: isolate(runs.map(run => run.own ? escapeText(run.text)
      : tag("tspan", { "font-family": fontStack(run.stack ?? run.family, type), "font-size": adjusted(run), style: nestedReset(style, run) }, escapeText(run.text))).join("")), ...shiftOf(runs) };
  }
  const natural = symbols ? scripts.runWidths(runs, placement.fontSize, style, { natural: true }) : undefined;
  const total = widths.reduce((sum, width) => sum + width, 0), factor = total > 0 ? placement.width / total : 1;
  let advance = 0, offset = 0;
  const content = runs.map((run, index) => {
    const width = widths[index] * factor, left = rtl ? placement.width - advance - width : advance;
    advance += width;
    const start = offset;
    offset += run.symbol ? run.symbol.source.length : run.text.length;
    // A symbol glyph keeps the open face's shape: it is compressed to its code's advance only when wider, never stretched.
    const pinned = run.symbol ? natural[index] > width + 1e-6 : width > 0;
    return tag("tspan", {
      x: stableNumber(placement.x + left),
      textLength: pinned ? stableNumber(width) : undefined, lengthAdjust: pinned ? "spacingAndGlyphs" : undefined,
      "font-family": run.own ? undefined : fontStack(run.family, type),
      "font-size": adjusted(run),
      style: run.own ? undefined : nestedReset(style, run),
      ...(trace ? trace(start, offset) : {})
    }, isolate(escapeText(run.text)));
  }).join("");
  return { content, positioned: true, ...shiftOf(runs) };
}

/** One positioned code/metric segment tspan; its script runs flow inside it (no textLength). */
function segmentSpan(attrs, segment, text, style, bound, type, options, syntax) {
  const scripted = segment.kind === "tab" ? { content: escapeText(text) } : scriptLine(text, style, bound, type, options);
  // Syntax highlighting (RR-07): a coloured text segment becomes consecutive sibling tspans, one per run, each a
  // traced segment of its own source range holding one text node (the editor's caret mapping reads that), the first
  // keeping the accepted x and the rest flowing after it. Plain code keeps one tspan per accepted segment.
  const runs = syntax && segment.kind !== "tab" ? opfCore.codeLineRuns(syntax.tokens, segment.start, segment.end) : undefined;
  if (runs?.some(run => run.kind)) {
    return runs.map((run, index) => {
      const sizeOf = line => line.sizeAdjust && options?.fontSize > 0 ? stableNumber(adjustedFontSize(options.fontSize, line.sizeAdjust)) : undefined;
      const piece = scriptLine(text.slice(run.start - segment.start, run.end - segment.start), style, bound, type, options);
      const own = { ...attrs };
      if (index > 0) delete own.x;
      if (own["data-opf-text-start"] !== undefined) { own["data-opf-text-start"] = run.start; own["data-opf-text-end"] = run.end; }
      return tag("tspan", { ...own, fill: run.kind ? syntax.palette[run.kind] : undefined, "font-family": piece.family, "font-size": sizeOf(piece) }, piece.content);
    }).join("");
  }
  return tag("tspan", { ...attrs, "font-family": scripted.family, "font-size": scripted.sizeAdjust && options?.fontSize > 0 ? stableNumber(adjustedFontSize(options.fontSize, scripted.sizeAdjust)) : undefined }, scripted.content);
}

// Token ranges of the code body and the palette to paint them with; undefined for plain code (an unknown language,
// no language, or a core without the shared highlighter). The preview and the PPTX export read the same tables.
function codeSyntax(item, layout, bound, options) {
  const body = layout.parts.find(part => part.role === "body");
  const language = typeof item.value?.language === "string" ? item.value.language : layout.parts.find(part => part.role === "language")?.text;
  if (!body || !language) return undefined;
  if (typeof opfCore.tokenizeCode !== "function") return undefined;
  const tokens = opfCore.tokenizeCode(body.text, language);
  if (!tokens.length) return undefined;
  return { tokens, palette: opfCore.codeSyntaxPaletteForScheme(bound.design.colorScheme) };
}

// Faces flagged embed:"used" (the vendored open, Intos and script-pack faces) are embedded only when the slide's own markup draws
// them: the family in a font-family list, at a font-weight and font-style some text of the slide takes (attributes are
// inherited down the element tree, as in SVG). A used family none of whose faces matches a drawn weight and style keeps all
// its faces, so the browser can always choose. Every other face (the npm packs) is embedded as before.
function embeddedFontsFor(fonts = [], content) {
  if (!fonts.some(font => font?.embed === "used")) return fonts;
  const drawn = drawnFaces(content.join("\n"));
  const wanted = font => {
    const triples = drawn.get(String(font.family).toLowerCase());
    if (!triples) return false;
    const family = fonts.filter(other => other?.embed === "used" && String(other.family).toLowerCase() === String(font.family).toLowerCase());
    const matching = family.filter(other => triples.has(`${other.weight}|${other.italic ? "italic" : "normal"}`));
    return matching.length ? matching.includes(font) : true;
  };
  return fonts.filter(font => font?.embed !== "used" || wanted(font));
}

const FONT_WEIGHT_KEYWORDS = { normal: "400", bold: "700" };
/** family (lowercase) to the set of "weight|style" pairs the markup draws text in. */
function drawnFaces(markup) {
  const drawn = new Map();
  const tokens = /<(\/?)([A-Za-z][\w:.-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>|<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|[^<]+/g;
  const stack = [{ families: [], weight: "400", style: "normal", text: false }];
  const attribute = (attributes, name) => { const found = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`).exec(attributes); return found ? found[1] ?? found[2] : undefined; };
  for (const [token, close, name, attributes, selfClose] of markup.matchAll(tokens)) {
    const top = stack.at(-1);
    if (name === undefined) {
      if (top.text && /\S/.test(token)) for (const family of top.families) { const set = drawn.get(family) ?? new Set(); set.add(`${top.weight}|${top.style}`); drawn.set(family, set); }
      continue;
    }
    if (close) { if (stack.length > 1) stack.pop(); continue; }
    const family = attribute(attributes, "font-family"), weight = attribute(attributes, "font-weight"), style = attribute(attributes, "font-style");
    const next = {
      families: family === undefined ? top.families : family.split(",").map(item => item.trim().replace(/^&quot;|&quot;$|^["']|["']$/g, "").toLowerCase()).filter(Boolean),
      weight: weight === undefined ? top.weight : FONT_WEIGHT_KEYWORDS[weight.trim()] ?? weight.trim(),
      style: style === undefined ? top.style : /italic|oblique/.test(style) ? "italic" : "normal",
      text: top.text || name === "text",
    };
    if (!selfClose) stack.push(next);
  }
  return drawn;
}

function renderEmbeddedFonts(fonts = []) {
  if (!fonts.length) return "";
  const css = fonts.map(font => {
    if (typeof font.family !== "string" || /[\u0000-\u001f"'\\<>;]/.test(font.family) || !/^data:font\/(ttf|otf|woff|woff2);base64,[A-Za-z0-9+/=]+$/.test(font.dataUrl) || !Number.isInteger(font.weight) || font.weight < 1 || font.weight > 1000) throw new OPFRenderError("invalid-embedded-font", "Embedded fonts require a plain family name, valid weight, and a font data URI.");
    return `@font-face{font-family:"${font.family}";font-weight:${font.weight};font-style:${font.italic ? "italic" : "normal"};src:url("${font.dataUrl}")}`;
  }).join("\n");
  const licenses = [...new Set(fonts.map(font=>font.license).filter(Boolean))];
  return tag("style",{},css) + (licenses.length ? tag("metadata",{},escapeText(licenses.join("\n\n"))) : "");
}

function renderRichTextBox(value, box, bound, config) {
  const scale=Math.min(bound.design.dimensions.width,bound.design.dimensions.height)/720;
  const fit=config.fit??fitRichText(value,box,config.fontSize*scale,((bound.composition??bound.geometry.composition).minFontSize??16)*scale,{style:{fontFamily:config.fontFamily,fontWeight:config.fontWeight??400,path:config.path},textMeasurement:config.options.textMeasurement});
  if(fit.overflow&&!config.diagnosticsHandled){const diagnostic={code:'text-overflow',path:config.path,message:'Mixed-style text exceeds its cell at the minimum font size.'};reportDiagnostic(diagnostic,config.options);if((bound.composition??bound.geometry.composition).overflow==='error')throw new OPFRenderError('layout-overflow',diagnostic.message,{issues:[diagnostic]});}
  return renderRichLines(value,fit,box,bound,config);
}

// A rich line without its leading and trailing whitespace: fragments keep their order and styles, positions and widths follow the trimmed text.
// Returns null when there is nothing to trim or the line holds a tab.
function trimRichLineEdges(line,textMeasurement) {
  const fragments=line.fragments.map(fragment=>({...fragment}));
  if(!fragments.length||fragments.some(fragment=>fragment.kind==='tab'))return null;
  const width=(fragment,text)=>text?textWidthMeasurer(fragment.style,textMeasurement)(text,fragment.fontSize):0;
  let changed=false;
  while(fragments.length&&!/\S/.test(fragments[0].text)){fragments.shift();changed=true;}
  while(fragments.length&&!/\S/.test(fragments.at(-1).text)){fragments.pop();changed=true;}
  if(!fragments.length)return null;
  const first=fragments[0],last=fragments.at(-1);
  const lead=/^\s*/.exec(first.text)[0],trail=/\s*$/.exec(last.text)[0];
  if(lead){first.text=first.text.slice(lead.length);first.start+=lead.length;first.width-=width(first,lead);changed=true;}
  if(trail){last.text=last.text.slice(0,-trail.length);last.end-=trail.length;last.width-=width(last,trail);changed=true;}
  if(!changed)return null;
  let x=0;
  for(const fragment of fragments){fragment.x=x;x+=fragment.width;}
  return {...line,fragments,width:x};
}

function renderRichLines(value,fit,box,bound,config) {
  const logicalAlignment=fit.placement?.alignment??config.align??bound.design.contentAlignment;
  // Each line takes its paragraph's direction from core (every wrapped line shares it) and its physical edge from that.
  const lineAlignment=index=>fit.placement?.lines[index]?.alignment??physicalAlignment(logicalAlignment,fit.directions?.[index]);
  let textOffset=0;
  const runOffsets=value.map(run=>{const start=textOffset;textOffset+=(typeof run==='string'?run:run.text).length;return start;});
  const richRtl=paragraphRtl(bound,value.map(run=>typeof run==='string'?run:run.text).join(''));
  // With no measurement provider, fragment advances are estimates. Let SVG
  // shape adjacent runs naturally inside each estimated line instead of turning
  // those estimates into visible gaps. Supplied measurements keep exact origins.
  const naturalFlow=!config.options.textMeasurement?.measure&&!fit.placement;
  const hasTabs=fit.richLines.some(line=>line.fragments.some(fragment=>fragment.kind==='tab'));
  const content=fit.richLines.map((sourceLine,lineIndex)=>{
    const alignment=lineAlignment(lineIndex);
    const sourceFirst=sourceLine.fragments[0],rtl=fit.directions?fit.directions[lineIndex]==='rtl':richRtl(sourceFirst?runOffsets[sourceFirst.runIndex]+sourceFirst.start:0);
    // PowerPoint ignores whitespace at either edge of a right-aligned right-to-left line, so the glyph edge stays on the box edge (RR-05).
    const edgeTrim=rtl&&alignment==='right'?trimRichLineEdges(sourceLine,config.options.textMeasurement):null;
    const line=edgeTrim??sourceLine;
    const lineHasTab=line.fragments.some(fragment=>fragment.kind==='tab');
    const flow=naturalFlow&&!lineHasTab;
    const offset=alignment==='right'?box.width-line.width:alignment==='center'?(box.width-line.width)/2:0;
    const placed=fit.placement?.lines[lineIndex];
    // RR-38: a line with runs in a policy replacement (Arabic Typesetting) takes PowerPoint's baseline of the real font, above core's.
    const lineShift=bound.scriptFonts?baselineShift(...line.fragments.filter(fragment=>fragment.kind!=='tab'&&fragment.text).map(fragment=>bound.scriptFonts.plan(fragment.text,fragment.style))):0;
    const shiftPx=lineShift*Math.max(fit.fontSize,...line.fragments.map(fragment=>fragment.fontSize));
    const originX=placed?placed.x+(edgeTrim?sourceLine.width-line.width:0):box.x+offset,baseline=(placed?.baseline??box.y+line.baseline)-shiftPx;
    const firstFragment=line.fragments[0];
    const renderFragment=(fragment,asFlow,edges={})=>{
    const run=fragment.run;
    // Accepted outline placement owns the horizontal advance. Geometric precision
    // avoids hinted browser advances; textLength also removes fractional-size
    // quantization drift. Height and baseline retain the selected font size.
    // A right-to-left line places its fragments from the right edge (FF-19).
    // Estimated (natural-flow) lines keep logical order; the browser reorders them.
    const fragmentX=rtl&&!naturalFlow?line.width-fragment.x-fragment.width:fragment.x;
    const position=asFlow?{'baseline-shift':fragment.baselineShift?stableNumber(-fragment.baselineShift):undefined}:{x:stableNumber(originX+fragmentX),y:stableNumber(baseline+fragment.baselineShift)};
    const runFill = run.color == null
      ? config.fill
      : resolveColorRef(run.color, bound, config.fill);
    let fixedAdvance=(fragment.kind==='tab'||placed)&&fragment.width>0;
    const scripted=fragment.kind==='tab'?{content:escapeText(fragment.text)}:scriptLine(fragment.text,fragment.style,bound,bound.design.fontScheme.type,{rtl:rtl&&!asFlow,
      placement:fixedAdvance&&!asFlow?{x:originX+fragmentX,width:fragment.width,fontSize:fragment.fontSize}:undefined,fontSize:fragment.fontSize});
    if(scripted.positioned)fixedAdvance=false;
    const content=`${edges.first?RIGHT_TO_LEFT_ISOLATE:''}${scripted.content}${edges.last?POP_DIRECTIONAL_ISOLATE:''}`;
    // RR-34: a citation/footnote marker is generated text (no source range): it is traced as a marker
    // segment without text offsets, so editors never read it as part of the run, and it is not linked.
    const marker=fragment.kind==='marker';
    const rendered=tag(asFlow?'tspan':'text',{...(config.options.trace?marker?{'data-opf-segment':'marker','data-opf-marker':fragment.text}:{'data-opf-text-start':runOffsets[fragment.runIndex]+fragment.start,'data-opf-text-end':runOffsets[fragment.runIndex]+fragment.end,'data-opf-segment':fragment.kind}:{}),...position,'xml:space':'preserve','text-rendering':asFlow?undefined:'geometricPrecision',textLength:fixedAdvance?stableNumber(fragment.width):undefined,lengthAdjust:fixedAdvance?'spacingAndGlyphs':undefined,'font-family':scripted.family??fontStack(fragment.style.fontFamily,bound.design.fontScheme.type),'font-size':stableNumber(adjustedFontSize(fragment.fontSize,scripted.sizeAdjust)),'font-weight':fragment.style.fontWeight,'font-style':fragment.style.italic?'italic':asFlow?'normal':undefined,'text-decoration':marker?undefined:[run.underline?'underline':'',run.strikethrough?'line-through':''].filter(Boolean).join(' ')||undefined,fill:runFill},content);
    if(!marker&&run.link&&/^(https?:|mailto:)/i.test(run.link))return tag('a',{href:run.link,target:'_blank',rel:'noopener noreferrer'},rendered);
    return rendered;
    };
    if(naturalFlow&&lineHasTab) {
      const chunks=[];let textChunk=[];
      const flush=()=>{if(!textChunk.length)return;const first=textChunk[0];chunks.push(tag('text',{x:stableNumber(originX+first.x),y:stableNumber(baseline),'xml:space':'preserve'},textChunk.map((fragment,index)=>renderFragment(fragment,true,{first:rtl&&!index,last:rtl&&index===textChunk.length-1})).join('')));textChunk=[];};
      for(const fragment of line.fragments) {
        if(fragment.kind==='tab'){flush();chunks.push(renderFragment(fragment,false));}
        else textChunk.push(fragment);
      }
      flush();return chunks.join('\n');
    }
    // A flowing right-to-left line is one isolate across its fragments.
    const fragments=line.fragments.map((fragment,index)=>renderFragment(fragment,flow,flow?{first:rtl&&!index,last:rtl&&index===line.fragments.length-1}:{}));
    if(!flow)return fragments.join('\n');
    const x=alignment==='right'?box.x+box.width:alignment==='center'?box.x+box.width/2:box.x;
    const first=line.fragments[0];
    return tag('text',{x:stableNumber(x),y:stableNumber(box.y+line.baseline-shiftPx),'text-anchor':alignment==='right'?'end':alignment==='center'?'middle':'start','xml:space':'preserve','font-family':fontStack(first?.style.fontFamily??config.fontFamily,bound.design.fontScheme.type),'font-size':stableNumber(first?.fontSize??fit.fontSize),'font-weight':first?.style.fontWeight??config.fontWeight??400,'font-style':first?.style.italic?'italic':undefined,[NO_POLICY_FEATURES]:true},fragments.join(''));
  });
  let cursor=0;
  const whole=value.map(run=>typeof run==='string'?run:run.text).join('');
  const lineTrace=config.options.trace?fit.richLines.map((line,index)=>{
    if(index){const newline=/^(\r\n|\r|\n)/.exec(whole.slice(cursor));if(newline)cursor+=newline[0].length;}
    const start=cursor;cursor+=(fit.lines[index]??'').length;
    const alignment=lineAlignment(index);
    const offset=alignment==='right'?box.width-line.width:alignment==='center'?(box.width-line.width)/2:0;
    const placed=fit.placement?.lines[index];
    return {start,end:cursor,x:placed?.x??box.x+offset,y:placed?.y??box.y+line.y,height:placed?.height??line.height,
      ...(naturalFlow&&line.fragments.some(fragment=>fragment.kind==='tab')?{spacing:'natural-chunks-estimated-tabs'}:{})};
  }):undefined;
  const spacing=naturalFlow?(hasTabs?'mixed-estimated-tabs':'natural'):'measured';
  return tag('g',{...traceAttrs(config.options,config.path),...(config.options.trace?{'data-opf-box-width':box.width,'data-opf-rich-text':config.rich===false?undefined:'true','data-opf-rich-lines':JSON.stringify(lineTrace),'data-opf-rich-spacing':spacing}:{}),...(fit.overflow?{'data-opf-overflow':'true'}:{})},content.join('\n'));
}

function renderTextBox(text, box, bound, config) {
  const invalid=/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uD800-\uDFFF\uFFFE\uFFFF]/u.exec(String(text??''));
  if(invalid)throw new OPFRenderError('invalid-text',`Text contains U+${invalid[0].codePointAt(0).toString(16).toUpperCase().padStart(4,'0')} at UTF-16 offset ${invalid.index}, which SVG XML cannot represent.`,{path:config.path});
  const scale = Math.min(bound.design.dimensions.width, bound.design.dimensions.height) / 720;
  const style = config.textStyle ?? resolveTextStyle({fontFamily:config.fontFamily,fontWeight:config.fontWeight ?? 400,italic:config.italic ?? false,path:config.path},config.options.textMeasurement);
  const fit = config.fit ?? fitText(String(text ?? ""), box, config.fontSize * scale,
    ((bound.composition ?? bound.geometry.composition).minFontSize ?? 16) * scale, textWidthMeasurer(style,config.options.textMeasurement));
  if (fit.overflow && !config.diagnosticsHandled) {
    const diagnostic = { code: "text-overflow", path: config.path,
      message: "Text exceeds its cell at the minimum font size; shorten it, increase its space, or split the slide." };
    reportDiagnostic(diagnostic, config.options);
    if ((bound.composition ?? bound.geometry.composition).overflow === "error") throw new OPFRenderError("layout-overflow", diagnostic.message, { path: diagnostic.path, issues: [diagnostic] });
  }
  const size = fit.fontSize;
  const totalHeight = fit.lines.length * fit.lineHeight;
  const startY = config.verticalAlign === "middle"
    ? box.y + Math.max(0, (box.height - totalHeight) / 2) + size : box.y + size;
  const logicalAlignment=fit.placement?.alignment??config.align??bound.design.contentAlignment;
  const type = config.fontFamily === bound.design.fonts.code ? "monospace" : bound.design.fontScheme.type;
  const source = String(text ?? ""), boxRtl = paragraphRtl(bound, source);
  let cursor = 0;
  const lines = fit.lines.map((line, index) => {
    // Logical alignment (RR-05): a right-to-left line starts at the right edge.
    const alignment=fit.placement?.lines[index]?.alignment??physicalAlignment(logicalAlignment,fit.directions?.[index]);
    const anchor = alignment === "center" ? "middle" : alignment === "right" ? "end" : "start";
    const x = alignment === "center" ? box.x + box.width / 2 : alignment === "right" ? box.x + box.width : box.x;
    const sourceLine=fit.sourceLines?.[index],placed=fit.placement?.lines[index],factor=alignment==='right'?1:alignment==='center'?.5:0;
    // The line's paragraph decides its direction: source offsets when layout has them, else the next match.
    const found=sourceLine?sourceLine.start:source.indexOf(line,cursor),lineStart=found>=0?found:cursor;cursor=lineStart+line.length;
    const rtl=fit.directions?fit.directions[index]==='rtl':boxRtl(lineStart);
    const origin=placed?.x??x-(sourceLine?.width??0)*factor;
    const tabs=sourceLine?.segments.some(segment=>segment.kind==='tab');
    let content,family,positioned=false,trimWidth=0,sizeAdjust,shift=0;
    if(tabs) content=sourceLine.segments.map(segment=>{
      const segmentText=line.slice(segment.start-sourceLine.start,segment.end-sourceLine.start),fixed=segment.kind==='tab'||placed;
      const traced=(start,end)=>config.options.trace?{'data-opf-source-start':start,'data-opf-source-end':end,'data-opf-segment':segment.kind}:{};
      const scripted=segment.kind==='tab'?{content:escapeText(segmentText)}:scriptLine(segmentText,style,bound,type,{rtl,
        placement:placed?{x:origin+segment.x,width:segment.width,fontSize:size}:undefined,fontSize:size,
        trace:config.options.trace?(start,end)=>traced(segment.start+start,segment.start+end):undefined});
      if(scripted.positioned)return scripted.content;
      return tag('tspan',{
        x:stableNumber(origin+segment.x),textLength:fixed?stableNumber(segment.width):undefined,
        lengthAdjust:fixed?'spacingAndGlyphs':undefined,'font-family':scripted.family,'font-size':scripted.sizeAdjust?stableNumber(adjustedFontSize(size,scripted.sizeAdjust)):undefined,
        ...traced(segment.start,segment.end),
      },scripted.content);
    }).join('');
    else {
      // PowerPoint ignores whitespace at either edge of a right-aligned right-to-left line (the glyph edge stays on the box edge, native check
      // 2026-10-02), so a soft-wrapped line that keeps its trailing space, or a leading space, draws without it (RR-05).
      const edge=rtl&&alignment==='right'?/^(\s*)([\s\S]*?)(\s*)$/.exec(line):null,trimmed=edge&&edge[2]&&(edge[1]||edge[3])?edge:null;
      if(trimmed){const measureEdge=textWidthMeasurer(style,config.options.textMeasurement);trimWidth=measureEdge(trimmed[1],size)+measureEdge(trimmed[3],size);}
      ({content,family,positioned=false,sizeAdjust,baselineShift:shift=0}=scriptLine(trimmed?trimmed[2]:line,style,bound,type,{rtl,placement:placed?.width>0?{x:placed.x+trimWidth,width:placed.width-trimWidth,fontSize:size}:undefined,fontSize:size}));
    }
    // Positioned script runs carry their own x and textLength (FF-19).
    const start=tabs||positioned;
    return tag("text", {
    x: stableNumber(tabs?origin:positioned?placed.x:placed?placed.x+placed.width*factor:x), y: stableNumber((placed?.baseline??startY + index * fit.lineHeight) - shift * size),
    "text-anchor": start?'start':anchor, "font-family": family ?? fontStack(style.fontFamily, type),
    "font-size": stableNumber(adjustedFontSize(size,sizeAdjust)), "font-weight": style.fontWeight, "font-style": style.italic ? "italic" : undefined, fill: config.fill,
    'xml:space':'preserve',style:'white-space:pre','text-rendering':config.options.textMeasurement?.measure?'geometricPrecision':undefined,
    textLength:!start&&placed?.width>0?stableNumber(placed.width-trimWidth):undefined,lengthAdjust:!start&&placed?.width>0?'spacingAndGlyphs':undefined,
    ...traceAttrs(config.options, config.path),
    ...(config.options.trace&&sourceLine?{'data-opf-source-start':sourceLine.start,'data-opf-source-end':sourceLine.end,'data-opf-source-next-start':sourceLine.nextStart,'data-opf-line-boundary':sourceLine.boundary}:{}),
  }, content);
  });
  return tag("g", { ...traceAttrs(config.options, config.path),
    ...(config.options.trace&&fit.sourceLines?{'data-opf-source-text':'true','data-opf-box-x':box.x,'data-opf-box-y':box.y,'data-opf-box-width':box.width,'data-opf-box-height':box.height}:{}),
    ...(fit.overflow ? { "data-opf-overflow": "true" } : {}) }, lines.join("\n"));
}

function normalizeList(value) {
  if (!Array.isArray(value)) return [{ text: flattenText(value), level: 0 }];
  return value.map((item) => {
    if (Array.isArray(item)) return { text: flattenText(item), level: 0 };
    if (isPlainObject(item)) {
      return {
        text: flattenText(item.text ?? item.value ?? ""),
        description: item.description ? flattenText(item.description) : "",
        level: Number.isInteger(item.level) ? item.level : 0
      };
    }
    return { text: flattenText(item), level: 0 };
  });
}

function flattenText(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map((item) => flattenText(item)).join("");
  if (isPlainObject(value)) {
    if (value.text !== undefined) return flattenText(value.text);
    if (value.value !== undefined) return flattenText(value.value);
    if (value.source !== undefined) return flattenText(value.source);
  }
  return stableJson(value);
}

function normalizeAsset(value) {
  if (typeof value === "string") return { src: value };
  if (isPlainObject(value)) return value;
  return { src: "" };
}

function inset(box, padding) {
  return {
    x: box.x + padding,
    y: box.y + padding,
    width: Math.max(1, box.width - padding * 2),
    height: Math.max(1, box.height - padding * 2)
  };
}

function centeredBox(box, width, height) {
  return {
    x: box.x + (box.width - width) / 2,
    y: box.y + (box.height - height) / 2,
    width,
    height
  };
}

function trianglePath(x, y, width, height) {
  return `M ${stableNumber(x)} ${stableNumber(y)} L ${stableNumber(x)} ${stableNumber(y + height)} L ${stableNumber(x + width)} ${stableNumber(y + height / 2)} Z`;
}

function traceAttrs(options, path) {
  return options.trace ? { "data-opf-path": path } : {};
}

// Generated pictures (the deck logo) are drawn from design fields, not authored content: editors skip them.
function generatedAttrs(options) {
  return options.trace && options.imageGenerated ? { "data-opf-generated": "true" } : {};
}

function stableNumber(value) {
  if (Number.isInteger(value)) return String(value);
  return Number(value).toFixed(3).replace(/\.?0+$/, "");
}

function escapeText(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttr(value) {
  return escapeText(value).replaceAll('"', "&quot;");
}

// FF-31: text drawn with a face whose features the font policy turns off (Gelasio for Georgia) says so, so
// browsers do not ligate what the measurement did not. Only text or tspan elements that name such a family.
// A flow line's outer text element, which only carries the first fragment's family, opts out: each of its
// tspans names its own family and gets its own style, so other faces do not inherit ligatures:none.
const NO_POLICY_FEATURES = Symbol("noPolicyFeatures");
// Text in another script nested in a flagged run (scriptLine tspans) goes back to default shaping.
const RESET_POLICY_FEATURES = "font-variant-ligatures:normal;font-feature-settings:normal";
function withPolicyFeatures(name, attrs) {
  if (attrs[NO_POLICY_FEATURES]) return attrs;
  const family = (name === "text" || name === "tspan") && typeof attrs["font-family"] === "string" ? attrs["font-family"].split(",")[0].trim().replace(/^'(.*)'$/, "$1") : undefined;
  const features = family && disabledFeaturesStyle(family);
  return features ? { ...attrs, style: attrs.style ? `${attrs.style};${features}` : features } : attrs;
}

function tag(name, attrs = {}, children = "") {
  attrs = withPolicyFeatures(name, attrs);
  const serializedAttrs = Object.keys(attrs)
    .filter((key) => attrs[key] !== undefined && attrs[key] !== null && attrs[key] !== false)
    .sort()
    .map((key) => ` ${key}="${escapeAttr(attrs[key])}"`)
    .join("");
  if (children === "") return `<${name}${serializedAttrs}/>`;
  return `<${name}${serializedAttrs}>${children}</${name}>`;
}
