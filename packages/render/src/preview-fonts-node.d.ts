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
