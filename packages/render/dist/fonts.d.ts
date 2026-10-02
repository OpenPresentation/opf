import type { TextMeasurement, TextStyle } from "@openpresentation/opf/composition";
export interface FontFaceInput { data: Uint8Array; family?: string; weight?: number; italic?: boolean; postscriptName?: string; license?: string; /** Serves glyph fallback and requests by its own family only; never a replacement for another family. */ fallbackOnly?: boolean; /** "used" embeds the face in an SVG only when the slide's text names its family (the open pack, FF-31). Default "always". */ embed?: "always" | "used"; /** ISO 15924 scripts a designated script replacement face serves (FF-19). */ scripts?: string[] }
export interface EmbeddedFont { family: string; weight: number; italic?: boolean; dataUrl: string; license?: string; embed?: "used" }
export type FontCompatibility = "exact" | "metric" | "visual" | "generic";
export interface FontReplacementMeasurement { replacement:string; meanAbsWidthDelta:number; meanWidthDelta:number; maxAbsWidthDelta:number; styles:number; reference:string }
export interface FontResolution {
  requestedFamily:string; sourceFamily:string; resolvedFamily:string; requestedWeight:number; resolvedWeight:number; italic:boolean; compatibility:FontCompatibility;
  /** True when the face is not the chosen family itself (policy replacement, alias, script replacement or fallback).
   * Exporters keep writing sourceFamily; the face only drives measurement and drawing (FF-31). */
  substitute:boolean;
  /** A visual replacement without the requested italic/upright style draws the other style. */
  styleFallback?:true;
  fontFace?:TextStyle['fontFace']; path?:string; source?:string; note?:string;
  /** The provisional owner decision the replacement follows, if any. */
  decision?:string;
  /** Measured width difference of the declared replacement against the real font. */
  measured?:FontReplacementMeasurement;
  licenseClass?:FontPolicyEntry['licenseClass']; availability?:FontPolicyEntry['availability'];
}
/** One OPF font policy row (snapshot of opf spec/reference/font-policy.json, decisions applied). */
export interface FontPolicyEntry {
  family:string; licenseClass:"open"|"proprietary-standard"|"proprietary-nonstandard"; license:string;
  availability:("windows"|"windows-optional"|"macos"|"office"|"office-cloud")[]; embeddableByOpf:boolean;
  replacement:{family:string; compatibility:"metric"|"visual"; decision?:string; metricModeFallback?:true; weight?:number; measured:FontReplacementMeasurement|null; source?:string}|null;
  alternates?:string[];
}
export declare const FONT_POLICY: readonly Readonly<FontPolicyEntry>[];
export declare const FONT_POLICY_SOURCE: Readonly<{version:number; path:string; sha256:string}>;
/** Provisional owner decisions applied to the snapshot (owner may revise). */
export declare const FONT_POLICY_DECISIONS: Readonly<Record<string, unknown>>;
export declare function fontPolicyFor(family:string): Readonly<FontPolicyEntry>|undefined;
export interface FontRegistryOptions {
  aliases?: Record<string,string>; fallbackFamily?: string; strictGlyphs?: boolean;
  substitutionPolicy?: "none" | "metric" | "visual";
  themeFonts?: Partial<Record<"majorLatin"|"minorLatin"|"majorEastAsia"|"minorEastAsia"|"majorComplexScript"|"minorComplexScript",string>>;
}
export declare const FONT_COMPATIBILITY: readonly Readonly<{requestedFamily:string;substitutes:readonly string[];compatibility:"metric"|"visual";weights?:readonly number[];weight?:number;source?:string;measured?:FontReplacementMeasurement;decision?:string;metricModeFallback?:true;licenseClass?:FontPolicyEntry['licenseClass'];note:string}>[];
export declare const EXPERIMENTAL_FONT_CANDIDATES: readonly Readonly<{requestedFamily:string;substitute:string;source:string;note:string}>[];
export interface FaceDescription { family:string; weight:number; italic:boolean; scripts?:string[] }
export interface FontRegistry {
  textMeasurement: TextMeasurement & {outlineBounds: NonNullable<TextMeasurement['outlineBounds']>; resolveFont(style: TextStyle): FontResolution};
  clearSubstitutions(): void;
  resolveFont(style: TextStyle): FontResolution;
  readonly embeddedFonts: EmbeddedFont[];
  /** Embedded faces matching `predicate`; large script faces can stay with raster fontFiles. */
  selectEmbeddedFonts(predicate: (face: FaceDescription) => boolean): EmbeddedFont[];
  /** Parsed face metadata in entry order, without encoding font bytes. */
  describeFaces(): FaceDescription[];
  readonly substitutions: FontResolution[];
  /** True when a loaded script-pack face has a glyph for the character. */
  scriptFacesCover(character: string): boolean;
  /** Register more faces (FF-19 script faces once a document needs them). Atomic; returns the added faces' metadata. */
  addFaces(entries: FontFaceInput[]): { family: string; weight: number; italic: boolean; scripts?: string[] }[];
}
export declare class OPFFontError extends Error { code:string; details:Record<string,unknown>; constructor(code:string,message:string,details?:Record<string,unknown>) }
export declare function createFontRegistry(entries: FontFaceInput[], options?: FontRegistryOptions): FontRegistry;

/** OOXML script slot. */
export type ScriptRole = "latin" | "eastAsian" | "complexScript";
export interface ScriptFontSlots { latin: string; eastAsian: string; complexScript: string }
/** Core `resolveScriptFonts` output, or the same shape. `serif` prefers serif replacements. */
export interface ScriptFontProfile {
  heading?: ScriptFontSlots; body?: ScriptFontSlots;
  supplement?: { script: string; heading: string; body: string };
  script?: string; bcp47?: string; lang?: string; direction?: "ltr" | "rtl"; rtl?: boolean;
  languageSource?: "document" | "option" | "default"; scriptRole?: ScriptRole; serif?: boolean;
}
export interface ScriptRun { text: string; script: string; role: ScriptRole }
export interface PlannedRun { text: string; family: string; own: boolean; stack?: string[] }
export interface ScriptFonts {
  readonly profile: ScriptFontProfile;
  readonly rtl: boolean;
  /** Glyph fallback notes recorded so far. */
  readonly fallbacks: readonly GlyphFallbackNote[];
  /** Font runs for text drawn in a resolved latin style. */
  plan(text: string, style: TextStyle): PlannedRun[];
  runWidths(runs: PlannedRun[], size: number, style: TextStyle): number[] | undefined;
  /** Script-aware measurement; undefined without a measurement provider. */
  readonly textMeasurement?: TextMeasurement;
}
export declare const SCRIPT_FONT_FAMILIES: Readonly<Record<string, Readonly<{ sans?: string; serif?: string }>>>;
export declare const SCRIPT_FONT_REPLACEMENTS: readonly Readonly<{requestedFamily:string;script:string;substitutes:readonly string[];compatibility:"visual";note:string}>[];
export declare function scriptOfCharacter(character: string): string;
export declare function scriptFontRole(script: string): ScriptRole;
export declare function itemizeScripts(text: string, profile?: ScriptFontProfile): ScriptRun[];
/** Script keys in the strings of a JSON value. The profile's own script counts unless `includeLanguage` is false; `ignoreKeys` are not visited. */
export declare function detectScripts(value: unknown, profile?: ScriptFontProfile, options?: { includeLanguage?: boolean; ignoreKeys?: readonly string[] }): string[];
export declare function designatedFamilies(script: string, serif?: boolean): string[];
export declare function scriptFontAliases(families: Iterable<string>): Record<string, string>;
export interface GlyphFallbackNote { fontFamily: string; fallbackFamily: string; scripts: string[]; characters: string[]; path?: string }
export interface ScriptFontsOptions {
  /** `"chain"` (default) draws and measures a character the face lacks with the first bundled face that has it; `"none"` keeps exact faces and a missing glyph raises `missing-glyph`. */
  glyphFallback?: "chain" | "none";
  onFallback?: (note: GlyphFallbackNote) => void;
}
export declare function createScriptFonts(profile?: ScriptFontProfile, measurement?: TextMeasurement, options?: ScriptFontsOptions): ScriptFonts;
/** Designated open families a preview tries, in order, for a character its face lacks (own script, deck script, Noto Sans, other CJK, other Noto scripts). */
export declare function glyphFallbackFamilies(character: string, profile?: ScriptFontProfile, serif?: boolean): string[];

/** Symbol-encoded families (FF-45): Symbol, Wingdings, Wingdings 2, Wingdings 3 and Webdings preview through code-to-Unicode tables. */
export type SymbolFontFamily = "Symbol" | "Wingdings" | "Wingdings 2" | "Wingdings 3" | "Webdings";
/** The script key the open symbol faces load under (`scripts: ['Zsym']`). */
export declare const SYMBOL_SCRIPT: "Zsym";
/** Drawn for a code with no Unicode equivalent, or whose equivalent no loaded face has (U+25A1). */
export declare const SYMBOL_PLACEHOLDER: string;
/** The open faces that preview each symbol-encoded family, in the order a code tries them. */
export declare const SYMBOL_PREVIEW_FACES: Readonly<Record<SymbolFontFamily, readonly string[]>>;
/** Every open face a symbol preview may draw with. */
export declare const SYMBOL_FACE_FAMILIES: readonly string[];
/** Per family: the verified font version and, for codes 0x20..0xFF in order, `[unicode, advance, reason?]` (hex code points joined with '+', font units). */
export declare const SYMBOL_ENCODINGS: readonly Readonly<{ family: SymbolFontFamily; version: string; unitsPerEm: number; mapped: number; codes: readonly (readonly [string | null, number | null, string?])[] }>[];
/** Which core table (spec/reference/symbol-font-encodings.json) the snapshot came from. */
export declare const SYMBOL_ENCODINGS_SOURCE: Readonly<{ version: number; path: string; sha256: string }>;
export declare function isSymbolEncodedFamily(family: string): boolean;
export declare function symbolEncodingFor(family: string): (typeof SYMBOL_ENCODINGS)[number] | undefined;
export declare function symbolPreviewFaces(family: string): readonly string[];
/** The symbol code (0x20..0xFF) of one character: a private-use U+F0xx, an ASCII or Latin-1 character, or a Windows-1252 character at 0x80..0x9F; null for anything else. */
export declare function symbolCodeOf(character: string): number | null;
/** Normalise text in a symbol-encoded family: per character its code (null when not a code), the Unicode equivalent to draw (or null with a reason) and the verified font's advance in em. */
export declare function mapSymbolText(family: string, text: string): { source: string; code: number | null; unicode: string | null; advance: number | null; reason?: string }[];
/** Wrap a measurement so pagination, the renderer and the editor itemize script runs identically. */
export declare function createScriptTextMeasurement(measurement: TextMeasurement, profile: ScriptFontProfile, options?: ScriptFontsOptions): TextMeasurement;
export declare function openTypeLanguage(tag: string | undefined): string | undefined;
/** Heading or body role of a style from its OPF path; undefined without a slide path. */
export declare function textRole(style: { path?: string } | undefined): "heading" | "body" | undefined;
/** FF-45: the emoji faces (Noto Color Emoji, then Noto Emoji); they draw emoji-presentation clusters only. */
export declare const EMOJI_FONT_FAMILIES: readonly string[];
/** True when the text holds an emoji-presentation cluster (emoji-default characters, VS16, skin tones, flags, keycaps, tags). */
export declare function hasEmojiPresentation(text: string): boolean;
/** True when the text holds mathematical notation that text faces lack (math alphanumerics, letterlike math sets, rarer operator blocks). */
export declare function hasMathNotation(text: string): boolean;
/** Colour faces of the manifest: resvg draws their monochrome stand-in (`rasterFamily`); browsers draw them in colour. */
export declare const COLOR_FONT_FACES: readonly { family: string; file: string; package: string; format: string; rasterFamily: string }[];
