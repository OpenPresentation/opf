/**
 * Types for the OPF font policy table (font-fidelity-everywhere FF-31).
 * The data lives in spec/reference/font-policy.json; see docs/font-fidelity.md.
 */

/**
 * - `open`: the family itself is openly licensed (OFL-1.1, Apache-2.0). OPF may bundle it for
 *   rendering; it reaches a PPTX file only through an explicit embed path, never by default.
 * - `proprietary-standard`: proprietary, and shipped with Windows, macOS, Microsoft Office or as a
 *   Microsoft 365 cloud font. OPF never bundles or embeds it; the PPTX names it and viewers resolve it.
 * - `proprietary-nonstandard`: proprietary and not shipped with those products. Viewers may lack it.
 */
export type FontLicenseClass = "open" | "proprietary-standard" | "proprietary-nonstandard";

/**
 * Where a viewer can get the family without the author's help:
 * - `windows`: default install of Windows 10/11.
 * - `windows-optional`: a Windows 10/11 language "Supplemental Fonts" feature on demand.
 * - `macos`: installed or downloadable on current macOS (not "document support" only).
 * - `office`: installed by Microsoft Office desktop.
 * - `office-cloud`: a Microsoft 365 cloud font, downloaded on demand by Office apps.
 */
export type FontAvailability = "windows" | "windows-optional" | "macos" | "office" | "office-cloud";

/** `metric`: the replacement is documented as metric-compatible within the stated styles.
 * `visual`: approximate appearance; expect reflow against the real font. */
export type FontReplacementCompatibility = "metric" | "visual";

/** Shaped advance-width comparison of the replacement against the real font. */
export interface FontReplacementMeasurement {
  /** The replacement family that was measured. */
  replacement: string;
  /** Mean over measured styles and corpus strings of |replacement / reference - 1|. */
  meanAbsWidthDelta: number;
  /** Signed mean: positive means the replacement is wider. */
  meanWidthDelta: number;
  /** Largest |replacement / reference - 1| on any single corpus string. */
  maxAbsWidthDelta: number;
  /** Styles compared (regular, bold, italic, bold italic that both fonts have). */
  styles: number;
  /** Reference font version string that was measured (the file itself is never redistributed). */
  reference: string;
}

export interface FontReplacement {
  /** Openly licensed family used only for preview measurement and drawing. Never written to PPTX. */
  family: string;
  compatibility: FontReplacementCompatibility;
  /** Set when the family and compatibility come from a provisional owner decision (provisionalDecisions). */
  decision?: string;
  /** Weight to select in the replacement when the requested family encodes weight in its name
   * (for example Segoe UI Semibold -> 600, Arial Black -> 900). */
  weight?: number;
  /** Null when the reference font was not available to the measuring host. */
  measured: FontReplacementMeasurement | null;
  /** Upstream statement of compatibility, when one exists. */
  source?: string;
}

export interface FontPolicyEntry {
  family: string;
  licenseClass: FontLicenseClass;
  /** SPDX id for open families, otherwise a short proprietary owner statement. */
  license: string;
  availability: FontAvailability[];
  /** True only for open families. Even then OPF embeds only through an explicit embed path. */
  embeddableByOpf: boolean;
  /** Required for proprietary families; null for open families, which render as themselves. */
  replacement: FontReplacement | null;
  /** Further open families a renderer may use when the replacement is not loaded. */
  alternates?: string[];
  sources: string[];
  note?: string;
}

/** A provisional owner decision. Rows naming it take family and compatibility from here. */
export interface FontPolicyDecision {
  replacement: string;
  compatibility: FontReplacementCompatibility;
  note?: string;
}

export interface FontPolicyTable {
  /** The one place provisional owner decisions live (FF-31). */
  provisionalDecisions: {
    status: string;
    note: string;
    decisions: Record<string, FontPolicyDecision>;
  };
  description: string;
  version: number;
  measurement: {
    tool: string;
    corpus: string;
    evidence: string;
    definition: string;
  };
  families: FontPolicyEntry[];
}
