import type { TextMeasurement, TextStyle } from "@openpresentation/opf/composition";
export interface FontFaceInput { data: Uint8Array; family?: string; weight?: number; italic?: boolean; postscriptName?: string; license?: string }
export interface EmbeddedFont { family: string; weight: number; italic?: boolean; dataUrl: string; license?: string }
export type FontCompatibility = "exact" | "metric" | "visual" | "generic";
export interface FontResolution { requestedFamily:string; sourceFamily:string; resolvedFamily:string; requestedWeight:number; resolvedWeight:number; italic:boolean; compatibility:FontCompatibility; fontFace?:TextStyle['fontFace']; path?:string; source?:string; note?:string }
export interface FontRegistryOptions {
  aliases?: Record<string,string>; fallbackFamily?: string; strictGlyphs?: boolean;
  substitutionPolicy?: "none" | "metric" | "visual";
  themeFonts?: Partial<Record<"majorLatin"|"minorLatin"|"majorEastAsia"|"minorEastAsia"|"majorComplexScript"|"minorComplexScript",string>>;
}
export declare const FONT_COMPATIBILITY: readonly Readonly<{requestedFamily:string;substitutes:readonly string[];compatibility:"metric"|"visual";weights?:readonly number[];source?:string;note:string}>[];
export declare const EXPERIMENTAL_FONT_CANDIDATES: readonly Readonly<{requestedFamily:string;substitute:string;source:string;note:string}>[];
export interface FontRegistry {
  textMeasurement: TextMeasurement & {outlineBounds: NonNullable<TextMeasurement['outlineBounds']>};
  clearSubstitutions(): void;
  resolveFont(style: TextStyle): FontResolution;
  readonly embeddedFonts: EmbeddedFont[];
  readonly substitutions: FontResolution[];
}
export declare class OPFFontError extends Error { code:string; details:Record<string,unknown>; constructor(code:string,message:string,details?:Record<string,unknown>) }
export declare function createFontRegistry(entries: FontFaceInput[], options?: FontRegistryOptions): FontRegistry;
