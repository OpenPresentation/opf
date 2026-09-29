import type {FontRegistry,FontRegistryOptions,EmbeddedFont,FontFaceInput} from "./fonts.js";
/** A caller-supplied face (FF-31), for example a licensed copy of the real font. Node callers may pass a file path. */
export type CallerFontFace = FontFaceInput | (Omit<FontFaceInput, "data"> & {path: string});
/** "all" or ISO 15924 codes (`Jpan`, `Hans`, `Hant`, `Kore`, `Arab`, `Hebr`, `Deva`, `Thai`, ...). */
export type ScriptSelection = "all" | string[];
export interface ScriptPackOptions {
  /** Caller-supplied faces, loaded first so a licensed real font resolves as an exact face (FF-31). */
  faces?: readonly CallerFontFace[];
  /** Also load the optional, hash-pinned OFL Noto script pack for these scripts (FF-19). */
  scripts?: ScriptSelection;
}
export declare function loadBundledFontRegistry(options?: FontRegistryOptions & ScriptPackOptions): Promise<FontRegistry & {fontFiles:string[]}>;

export declare function loadOfficeFontRegistry(options?: FontRegistryOptions & ScriptPackOptions & {includeBaseFonts?:boolean}): Promise<FontRegistry & {fontFiles:string[]}>;

export type BundledFontPackage = Readonly<{
  /** An npm package name, or a plain id for a vendored entry. */
  name:string;
  /** The exact npm version, or for a vendored entry the pinned upstream commit. */
  version:string; pack:"base"|"office"|"scripts"; source:string;
  /** FF-31: directory inside this package (for example `fonts/carlito`) that holds unmodified upstream files; absent for npm packages. */
  vendored?: string;
  /** ISO 15924 scripts served by a script-pack package. */
  scripts?: readonly string[];
  license:string; licenseFile:string; licenseSha256:string;
  reservedFontNames:readonly string[]; upstream:string; copyright:string;
  faces:readonly Readonly<{file:string; family:string; weight:number; italic:boolean; sha256:string;
    /** FF-31: the byte-identical upstream release file this face is (sha256 equals the face's own). */
    upstreamFile?: Readonly<{url:string; sha256:string}>}>[];
}>;
export interface BundledFontManifest {
  readonly version: number;
  readonly packages: readonly BundledFontPackage[];
}
export declare const BUNDLED_FONT_MANIFEST: BundledFontManifest;
export declare function scriptFontPackages(scripts: ScriptSelection): BundledFontPackage[];
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
export declare function prepareNodeFonts(options?: FontRegistryOptions & ScriptPackOptions & {pack?:"base"|"office"; includeBaseFonts?:boolean; /** Embed script faces in SVG (large); default false. */ embedScriptFonts?:boolean}): Promise<PreparedNodeFonts>;
