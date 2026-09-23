import { fontPolicySource } from "./generated/font-policy.js";
import type { FontPolicyEntry, FontPolicyTable } from "./font-policy-types.js";

export type {
  FontAvailability,
  FontLicenseClass,
  FontPolicyDecision,
  FontPolicyEntry,
  FontPolicyTable,
  FontReplacement,
  FontReplacementCompatibility,
  FontReplacementMeasurement,
} from "./font-policy-types.js";

/**
 * OPF font policy (font-fidelity-everywhere FF-31).
 *
 * One row per font family that OPF catalogs, defaults or renderer rules name: license class,
 * where viewers get it, whether OPF may ever embed it, and the openly licensed replacement a
 * renderer previews it with. Renderers use the replacement for measurement and drawing only.
 * Exporters always write the chosen family and never embed a proprietary one.
 * Data: spec/reference/font-policy.json. Guide: docs/font-fidelity.md.
 */
const freeze = <T>(value: T): T => {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};

/**
 * Apply provisional owner decisions (the one place they live, `provisionalDecisions`): a row whose
 * replacement names a decision takes its family and compatibility from it. A recorded measurement
 * of a different family no longer describes the replacement, so it becomes null (unmeasured).
 */
export function applyFontPolicyDecisions(source: unknown): FontPolicyTable {
  const table = structuredClone(source) as FontPolicyTable;
  const decisions = table.provisionalDecisions?.decisions ?? {};
  for (const row of table.families) {
    const replacement = row.replacement;
    if (!replacement?.decision) continue;
    const decision = decisions[replacement.decision];
    if (!decision) throw new Error(`Font policy row '${row.family}' names unknown decision '${replacement.decision}'.`);
    replacement.family = decision.replacement;
    replacement.compatibility = decision.compatibility;
    if (replacement.measured && replacement.measured.replacement !== decision.replacement) replacement.measured = null;
  }
  return table;
}

export const FONT_POLICY: Readonly<FontPolicyTable> = freeze(applyFontPolicyDecisions(fontPolicySource));

const byFamily = new Map(FONT_POLICY.families.map((entry) => [entry.family.toLowerCase(), entry]));

/** The policy row for a family name (case-insensitive), or undefined when OPF has no row. */
export function fontPolicyFor(family: string): Readonly<FontPolicyEntry> | undefined {
  return typeof family === "string" ? byFamily.get(family.trim().toLowerCase()) : undefined;
}

export type FontAvailabilityCode =
  | "font-policy-unknown"
  | "font-viewer-nonstandard"
  | "font-viewer-cloud-only"
  | "font-viewer-optional-feature";

export interface FontAvailabilityDiagnostic {
  code: FontAvailabilityCode;
  severity: "warning" | "info";
  family: string;
  message: string;
}

/**
 * What a PPTX viewer needs for each named family. OPF never embeds a proprietary family, so
 * these notes describe the viewer's side only. Open families and families that ship with
 * Windows or macOS by default produce no diagnostic.
 */
export function fontAvailabilityDiagnostics(families: Iterable<string>): FontAvailabilityDiagnostic[] {
  const diagnostics: FontAvailabilityDiagnostic[] = [];
  const seen = new Set<string>();
  for (const raw of families) {
    if (typeof raw !== "string" || !raw.trim() || raw.startsWith("+")) continue;
    const family = raw.trim();
    if (seen.has(family.toLowerCase())) continue;
    seen.add(family.toLowerCase());
    const entry = fontPolicyFor(family);
    if (!entry) {
      diagnostics.push({
        code: "font-policy-unknown",
        severity: "info",
        family,
        message: `'${family}' is not in the OPF font policy table, so OPF cannot say whether viewers have it or which open font previews it. The PPTX still names '${family}'. Supply its font files to the renderer, or choose a listed family.`,
      });
      continue;
    }
    if (entry.licenseClass === "open") continue;
    if (entry.licenseClass === "proprietary-nonstandard") {
      diagnostics.push({
        code: "font-viewer-nonstandard",
        severity: "warning",
        family,
        message: `'${family}' is proprietary and does not ship with Windows, macOS or Microsoft Office. The PPTX names it, but viewers without a license substitute another font.`,
      });
      continue;
    }
    const has = (value: string) => entry.availability.includes(value as never);
    if (has("windows") || has("macos") || has("office")) continue;
    if (has("office-cloud") && !has("windows-optional")) {
      diagnostics.push({
        code: "font-viewer-cloud-only",
        severity: "info",
        family,
        message: `'${family}' is a Microsoft 365 cloud font. Microsoft 365 apps download it on demand; older Office versions, LibreOffice, Keynote and Google Slides substitute another font.`,
      });
      continue;
    }
    diagnostics.push({
      code: "font-viewer-optional-feature",
      severity: "info",
      family,
      message: `'${family}' ships in an optional Windows language "Supplemental Fonts" feature (and as a Microsoft 365 cloud font). Viewers without that language feature or Microsoft 365 substitute another font.`,
    });
  }
  return diagnostics;
}
