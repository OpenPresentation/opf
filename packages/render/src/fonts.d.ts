import type { TextMeasurement, TextStyle } from "@openpresentation/opf/composition";
export interface FontFaceInput { data: Uint8Array; family?: string; weight?: number; italic?: boolean; postscriptName?: string; license?: string; /** ISO 15924 scripts a designated script replacement face serves (FF-19). */ scripts?: string[] }
export interface EmbeddedFont { family: string; weight: number; italic?: boolean; dataUrl: string; license?: string }
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
export declare function detectScripts(value: unknown, profile?: ScriptFontProfile): string[];
export declare function designatedFamilies(script: string, serif?: boolean): string[];
export declare function scriptFontAliases(families: Iterable<string>): Record<string, string>;
export declare function createScriptFonts(profile?: ScriptFontProfile, measurement?: TextMeasurement): ScriptFonts;
/** Wrap a measurement so pagination, the renderer and the editor itemize script runs identically. */
export declare function createScriptTextMeasurement(measurement: TextMeasurement, profile: ScriptFontProfile): TextMeasurement;
export declare function openTypeLanguage(tag: string | undefined): string | undefined;
/** Heading or body role of a style from its OPF path; undefined without a slide path. */
export declare function textRole(style: { path?: string } | undefined): "heading" | "body" | undefined;
