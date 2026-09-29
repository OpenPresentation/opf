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

export declare function loadOfficeFontRegistry(options?: FontRegistryOptions & ScriptPackOptions & {includeBaseFonts?:boolean; /** Leave out the open families font schemes select (FF-31); default true. */ includeOpenFonts?:boolean}): Promise<FontRegistry & {fontFiles:string[]}>;

export type BundledFontPackage = Readonly<{
  /** An npm package name, or a plain id for a vendored entry of a git upstream. */
  name:string;
  /** The exact npm version, or for a git-upstream vendored entry the pinned upstream commit. */
  version:string; pack:"base"|"office"|"open"|"scripts"; source:string;
  /** FF-31: directory inside this package (for example `fonts/carlito`) that holds the vendored faces and notice (`file` and `licenseFile` are relative to it); absent for npm packages. */
  vendored?: string;
  /** ISO 15924 scripts served by a script-pack package. */
  scripts?: readonly string[];
  license:string; licenseFile:string; licenseSha256:string;
  /** Vendored from a git upstream: the commit-pinned URL of the notice. Vendored from npm: the notice's path in the npm package. */
  upstreamLicenseUrl?:string; npmLicenseFile?:string;
  /** The family this package is the renamed successor of; requests for the old name draw these faces, reported visual. */
  renamedFrom?:string;
  reservedFontNames:readonly string[]; upstream:string; copyright:string;
  faces:readonly Readonly<{file:string; family:string; weight:number; italic:boolean; sha256:string;
    /** FF-31: the byte-identical upstream release file this face is (sha256 equals the face's own). */
    upstreamFile?: Readonly<{url:string; sha256:string}>;
    /** FF-31: for a vendored npm-derived (instanced) face, its path in the npm package it was copied from. */
    npmFile?: string}>[];
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
export declare function prepareNodeFonts(options?: FontRegistryOptions & ScriptPackOptions & {pack?:"base"|"office"; includeBaseFonts?:boolean; /** With pack "office": leave out the open families (FF-31); default true. */ includeOpenFonts?:boolean; /** Embed script faces in SVG (large); default false. */ embedScriptFonts?:boolean;}): Promise<PreparedNodeFonts>;
