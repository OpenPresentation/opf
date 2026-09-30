import type {FontRegistry,FontRegistryOptions,EmbeddedFont,FontFaceInput,ScriptFontProfile} from "./fonts.js";
import type {RenderSvgOptions} from "./svg.js";
/** A caller-supplied face (FF-31), for example a licensed copy of the real font. Node callers may pass a file path. */
export type CallerFontFace = FontFaceInput | (Omit<FontFaceInput, "data"> & {path: string});
/** "all" or ISO 15924 codes (`Jpan`, `Hans`, `Hant`, `Kore`, `Arab`, `Hebr`, `Deva`, `Thai`, ...). */
export type ScriptSelection = "all" | string[];
/** What `scripts: "auto"` chose for a presentation (FF-19). */
export interface AutoScriptSelection {
  /** Scripts the presentation's drawn text uses, other than Latin, Greek and Cyrillic. */
  detected: string[];
  /** The detected scripts a pinned package serves; the input for `scriptFontPackages`. */
  scripts: string[];
  /** Detected scripts no pinned open font serves; that text uses the design font. */
  unavailable: string[];
}
/** Script-pack packages that `scripts: "auto"` loaded or found not installed. */
export interface AppliedScriptSelection extends AutoScriptSelection { packages: string[]; notInstalled: string[]; /** Drawn CJK characters no loaded face covers (glyph fallback stopped at its cap). */ uncovered?: string[] }
/** Script keys whose faces a preview of the presentation needs: text decides, the document language only tells Han scripts apart. */
/** `options` may also carry the `renderSvg` options the document resolves with (`catalogs`): a font scheme that exists only in the host's catalogs and names a script font selects that font's script (FF-41). */
export declare function detectPresentationScripts(presentation: unknown, options?: { profile?: ScriptFontProfile } & Partial<RenderSvgOptions>): string[];
export declare function autoScriptSelection(presentation: unknown, options?: { profile?: ScriptFontProfile } & Partial<RenderSvgOptions>): AutoScriptSelection;
export interface ScriptPackOptions {
  /** Caller-supplied faces, loaded first so a licensed real font resolves as an exact face (FF-31). */
  faces?: readonly CallerFontFace[];
  /**
   * Also load the optional, hash-pinned OFL Noto script pack for these scripts (FF-19).
   * `"auto"` loads only the scripts `presentation` draws (and needs it); a script package that is not installed
   * is reported through `onDiagnostic` instead of failing.
   */
  scripts?: ScriptSelection | "auto";
  /** The presentation whose text decides `scripts: "auto"`. */
  presentation?: unknown;
  /** The `renderSvg` options the presentation resolves with (`catalogs`, ...), for the font schemes `scripts: "auto"` reads (FF-41). */
  renderOptions?: Partial<RenderSvgOptions>;
  /** Receives `script-font-unavailable` and `script-font-not-installed` for `scripts: "auto"`. */
  onDiagnostic?: (diagnostic: {code: string; message: string; script?: string; package?: string; scripts?: string[]}) => void;
}
/** A vendored face that an SVG embeds only when its text names the family (the open families and Intos), and that browser hosts load on demand from a separate hash-pinned file. */
export interface LazyFont { readonly package: string; readonly family: string; readonly weight: number; readonly italic: boolean; /** Path relative to the package root, for example fonts/intos/Intos-Regular.ttf. */ readonly file: string; readonly sha256: string; readonly license: string; readonly renamedFrom?: string; /** Set on a host's extra lazy face (`extraLazyFonts`, `package: "host"`): where the host serves the file from. */ readonly url?: string }
export type ScriptFontRegistry = FontRegistry & {fontFiles:string[]; /** Set for `scripts: "auto"`. */ scriptSelection?: AppliedScriptSelection};
export type NodeFontRegistry = ScriptFontRegistry & {/** The embed "used" faces this registry holds, with the files a host copies to serve them itself. */ lazyFonts: readonly LazyFont[]};
export declare function loadBundledFontRegistry(options?: FontRegistryOptions & ScriptPackOptions): Promise<NodeFontRegistry>;

export declare function loadOfficeFontRegistry(options?: FontRegistryOptions & ScriptPackOptions & {includeBaseFonts?:boolean; /** Leave out the open families font schemes select (FF-31); default true. */ includeOpenFonts?:boolean}): Promise<NodeFontRegistry>;

export type BundledFontPackage = Readonly<{
  /** An npm package name, or a plain id for a vendored entry of a git upstream. */
  name:string;
  /** The exact npm version, or for a git-upstream vendored entry the pinned upstream commit. */
  version:string; pack:"base"|"office"|"open"|"scripts"; source:string;
  /** FF-31: directory inside this package (for example `fonts/carlito`) that holds the vendored faces and notice (`file` and `licenseFile` are relative to it); absent for npm packages. */
  vendored?: string;
  /** "used": the package's faces are embedded in an SVG only when its text names the family, and browsers load them on demand (the open pack always does). */
  embed?: "used";
  /** An authored provenance and copyright notice in `vendored`, hash-pinned beside the license and appended to it. */
  noticeFile?: string; noticeSha256?: string;
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
  registry: NodeFontRegistry;
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
