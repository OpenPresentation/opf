import type { TextMeasurement, TextStyle, ScriptRole } from "@openpresentation/opf/composition";
import type { FontPolicyEntry } from "@openpresentation/opf/font-policy";
import type { LazyFont } from "./fonts-node.js";
// Core owns these: the font policy table and lookup, the symbol-font code rules and the script slot of a script. They are core's own
// exports (the same objects), not copies.
export { FONT_POLICY, fontPolicyFor } from "@openpresentation/opf/font-policy";
export type { FontPolicyEntry } from "@openpresentation/opf/font-policy";
export { isSymbolEncodedFamily, mapSymbolText, symbolCodeOf } from "@openpresentation/opf/symbol-font-encodings";
export { scriptFontRole } from "@openpresentation/opf/composition";
export type { ScriptRole } from "@openpresentation/opf/composition";
export interface FontFaceInput { data: Uint8Array; family?: string; weight?: number; italic?: boolean; postscriptName?: string; license?: string; /** Serves glyph fallback and requests by its own family only; never a replacement for another family. */ fallbackOnly?: boolean; /** Every face is embedded in an SVG only when the slide's text draws it (RR-61). "used" also leaves the face out of the eager `registry.embeddedFonts` list (the open pack, FF-31); "always" embeds it in every SVG. */ embed?: "always" | "used"; /** ISO 15924 scripts a designated script replacement face serves (FF-19). */ scripts?: string[] }
export interface EmbeddedFont { family: string; weight: number; italic?: boolean; dataUrl: string; license?: string; /** "always": written into every SVG; otherwise only into an SVG whose text draws the face (RR-61). */ embed?: "always" | "used" }
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
export interface FontRegistryOptions {
  aliases?: Record<string,string>; fallbackFamily?: string; strictGlyphs?: boolean;
  substitutionPolicy?: "none" | "metric" | "visual";
  themeFonts?: Partial<Record<"majorLatin"|"minorLatin"|"majorEastAsia"|"minorEastAsia"|"majorComplexScript"|"minorComplexScript",string>>;
}
export declare const FONT_COMPATIBILITY: readonly Readonly<{requestedFamily:string;substitutes:readonly string[];compatibility:"metric"|"visual";weights?:readonly number[];weight?:number;source?:string;measured?:FontReplacementMeasurement;decision?:string;metricModeFallback?:true;licenseClass?:FontPolicyEntry['licenseClass'];note:string}>[];
export declare const EXPERIMENTAL_FONT_CANDIDATES: readonly Readonly<{requestedFamily:string;substitute:string;source:string;note:string}>[];
/**
 * What the deck-level functions read from their `fonts` option: `toSvg` and `<opf-deck>` take the measurement and
 * the faces to embed; `toPng` and `toPdf` (Node) take the font files; core `paginate`, `validate` and `resolveSlideContext` take the
 * measurement. The object `loadFonts()` returns is a `FontsHandle`, which extends this; any object with these fields works.
 */
export interface RenderFonts {
  /** Measures text with the real faces. Without it layout uses core's portable estimate. */
  textMeasurement?: TextMeasurement;
  /** Faces `toSvg` may write into an SVG as @font-face data: each only into the SVGs whose text draws it (its family, weight and style), unless flagged `embed: "always"` (RR-61). */
  embeddedFonts?: readonly EmbeddedFont[];
  /** Font files the Node raster and PDF conversions draw with. */
  fontFiles?: readonly string[];
  /** Whether a conversion adds the bundled base faces to `fontFiles`. Default true; a handle that already holds them says false. */
  useBundledFonts?: boolean;
  /** Whether the raster conversion loads system fonts. Default false (the output never depends on the machine). */
  loadSystemFonts?: boolean;
  /** The outline engine `text: "paths"` draws text with (RR-64); a `loadFonts` handle carries one over its registry's faces. */
  outlines?: TextOutlines;
  /** The subset engine (RR-65): each face an SVG embeds is cut to the characters the slide draws. The Node `loadFonts` handle carries one; a browser handle with `subsetWasm`. */
  subsets?: FontSubsets;
}
/** Cuts an embedded face to code points (RR-65), with hb-subset; a face whose license, Reserved Font Name or fsType does not allow it keeps its own data URL. */
export interface FontSubsets { subsetDataUrl(font: EmbeddedFont, codePoints: Iterable<number>): string }
/** Draws a slide's text as glyph outlines (RR-64). Read by `toSvg`; hosts pass the handle and `text: "paths"`. */
export interface TextOutlines { outlineSlideText(content: string[], options: object): { content: string[]; defs: string } }
/** What `fonts.ensure(presentation)` loaded: the script packages and vendored faces that were missing, and drawn CJK characters no face covers. */
export interface EnsureResult { scripts: string[]; lazy: LazyFont[]; uncovered: string[] }
/** The fonts handle `loadFonts()` returns from `/fonts-node` and `/fonts-browser`: pass it as `{ fonts }` to every deck-level function. */
export interface FontsHandle extends RenderFonts {
  readonly textMeasurement: FontRegistry["textMeasurement"];
  readonly embeddedFonts: EmbeddedFont[];
  /** The face registry behind the handle (shaping, resolution, lazy and script loading). */
  readonly registry: FontRegistry;
  /** The outline engine for `text: "paths"` (RR-64), over this registry's faces, including faces `ensure` loads later. */
  readonly outlines: TextOutlines;
  /** The pinned manifest of the bundled font packages. */
  readonly manifest: { readonly version: number; readonly packages: readonly object[] };
  /** The substitutions made so far (a requested family drawn with another face), as `registry.substitutions`. */
  readonly substitutions: FontResolution[];
  /** Load the script (and, in a browser, vendored) faces the presentation's text needs. Cheap when nothing is missing. */
  ensure(presentation: unknown, options?: object): Promise<EnsureResult>;
  /** Synchronous: the files and script packages `ensure` would load. Empty means a render can start now. */
  pending(presentation: unknown, renderOptions?: object): string[];
  /** Remove the faces this handle added to the document (a browser handle). */
  dispose?(): void;
}
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
  /** Every face as `{ family, data }`, the bytes the registry measures with. */
  exportFaces(): { family: string; data: Uint8Array }[];
  readonly substitutions: FontResolution[];
  /** True when a loaded script-pack face has a glyph for the character. */
  scriptFacesCover(character: string): boolean;
  /** Register more faces (FF-19 script faces once a document needs them). Atomic; returns the added faces' metadata. */
  addFaces(entries: FontFaceInput[]): { family: string; weight: number; italic: boolean; scripts?: string[] }[];
}
export declare class OPFFontError extends Error { code:string; details:Record<string,unknown>; constructor(code:string,message:string,details?:Record<string,unknown>) }

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
export declare function symbolPreviewFaces(family: string): readonly string[];
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
