import type {FontRegistry,FontRegistryOptions,EmbeddedFont} from "./fonts.js";
export declare function loadBundledFontRegistry(options?: FontRegistryOptions): Promise<FontRegistry & {fontFiles:string[]}>;

export declare function loadOfficeFontRegistry(options?: FontRegistryOptions & {includeBaseFonts?:boolean}): Promise<FontRegistry & {fontFiles:string[]}>;

export interface BundledFontManifest {
  readonly version: number;
  readonly packages: readonly Readonly<{
    name:string; version:string; pack:"base"|"office"; source:string;
    license:string; licenseFile:string; licenseSha256:string;
    faces:readonly Readonly<{file:string; family:string; weight:number; italic:boolean; sha256:string}>[];
  }>[];
}
export declare const BUNDLED_FONT_MANIFEST: BundledFontManifest;
export interface PreparedNodeFonts {
  registry: FontRegistry & {fontFiles:string[]};
  manifest: BundledFontManifest;
  options: {
    textMeasurement: FontRegistry["textMeasurement"];
    embeddedFonts: EmbeddedFont[];
    fontFiles: string[];
    useBundledFonts: false;
    loadSystemFonts: false;
  };
}
export declare function prepareNodeFonts(options?: FontRegistryOptions & {pack?:"base"|"office"; includeBaseFonts?:boolean}): Promise<PreparedNodeFonts>;
