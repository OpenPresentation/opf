export interface CopyPreviewFontsOptions {
  /** The directory to fill (served as the `fonts` root of `<opf-deck>`). */
  outDir: string;
  /** Noto script faces to include (they are large): `false` (default), `"all"`, or ISO 15924 codes such as `["Jpan", "Arab"]`. */
  scripts?: false | "all" | readonly string[];
  /** Where optional script packages are looked up when they are not installed beside this package. */
  cwd?: string;
  manifest?: unknown;
}

export interface CopyPreviewFontsResult { copied: number; verified: number; bytes: number; files: string[]; packages: number; missing: string[] }

/** Copy the pinned preview fonts into `outDir`, verifying every file's SHA-256 and writing every license notice to `LICENSES.txt`. */
export declare function copyPreviewFonts(options: CopyPreviewFontsOptions): CopyPreviewFontsResult;

/** RR-106: a font-policy family that OPF previews with a replacement face, as a fontconfig alias. */
export interface FontconfigAlias { family: string; prefer: string; compatibility: "metric" | "visual" | string }

/** One alias per font-policy family OPF previews with a replacement (Aptos to Intos, Calibri to Carlito, ...). */
export declare function fontconfigAliases(policy?: { families: readonly unknown[] }): FontconfigAlias[];

export interface FontconfigConfOptions {
  /** The directory of the copied preview fonts, added as a font directory. */
  fontDir?: string;
  aliases?: readonly FontconfigAlias[];
  /** Include /etc/fonts/fonts.conf: a whole configuration for FONTCONFIG_FILE instead of a conf.d file. */
  includeSystem?: boolean;
  cacheDir?: string;
}

/** A fontconfig file with the aliases and the preview font directory (for ~/.config/fontconfig/conf.d/, or FONTCONFIG_FILE with includeSystem). */
export declare function fontconfigConf(options?: FontconfigConfOptions): string;
