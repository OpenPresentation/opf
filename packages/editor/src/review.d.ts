import type { EditorChange, EditorSession, JsonPatchOperation } from "./index.js";

export type ReviewSeverity = "error" | "warning" | "info";

/** A suggested repair from core's audit (the structural subset the editor uses). */
export interface ReviewFix {
  id: string;
  label: string;
  kind: "patch" | "focus";
  /** True when the change cannot alter what the content says. */
  safe: boolean;
  patch?: JsonPatchOperation[];
  focus?: { path: string; field: "alt" | "title" | "text" | "link" | "language" | "fontSize"; value?: unknown };
}

/** One finding of core's audit, with the fields the editor adds. */
export interface ReviewFinding {
  /** Unique within the report: the rule id and the path, numbered when they repeat. */
  id: string;
  ruleId: string;
  severity: ReviewSeverity;
  /** JSON Pointer of the content the finding is about. */
  path: string;
  /** The same path in OPF dotted form (`slides.0.text.1.color`). */
  dottedPath: string;
  /** Zero-based slide index, or null for a finding about the whole presentation. */
  slide: number | null;
  message: string;
  help: string;
  category?: "accessibility" | "design" | "content";
  measured?: Record<string, number | string | boolean | null>;
  fixes?: ReviewFix[];
}

export interface ReviewReport {
  valid: boolean;
  documentValid: boolean;
  diagnostics: Omit<ReviewFinding, "id" | "dottedPath">[];
  counts: Record<ReviewSeverity, number>;
  [key: string]: unknown;
}

/** Core's `AuditOptions` (severity per rule, `ignore`, `only`, `thresholds`, `textMeasurement`, ...). */
export type ReviewAuditOptions = Record<string, unknown> & {
  /** Use this audit function instead of core's `auditPresentation`. */
  audit?: (document: unknown, options?: Record<string, unknown>) => ReviewReport;
};

export interface ReviewTarget {
  /** The slide the finding is on, or null for the presentation. */
  slide: number | null;
  /** OPF dotted path of the deepest existing field on the finding's way. */
  path: string;
  pointer: string;
  /** False when the finding is about a missing field and `path` is its parent. */
  exact: boolean;
}

export declare const reviewSeverities: readonly ReviewSeverity[];
/** True when the installed core ships the audit (`@openpresentation/opf` after 0.11.4). */
export declare function auditAvailable(): boolean;
/** Audit a document with core's `auditPresentation`. Throws `audit-unavailable` when core has none. */
export declare function runAudit(document: unknown, options?: ReviewAuditOptions): ReviewReport;
export declare function reviewFindings(report: ReviewReport | undefined): ReviewFinding[];
export declare function countFindings(findings: readonly ReviewFinding[]): { error: number; warning: number; info: number; total: number };
export declare function filterFindings(findings: readonly ReviewFinding[], options?: { minimum?: ReviewSeverity; slide?: number | null }): ReviewFinding[];
/** Where "go to" lands for a finding. */
export declare function findingTarget(document: unknown, finding: Pick<ReviewFinding, "path">): ReviewTarget;
/** Apply a `patch` fix as one undoable, validated session change; refuses a stale or unsafe patch. */
export declare function applyReviewFix(editor: EditorSession, finding: Pick<ReviewFinding, "ruleId"> | undefined, fix: ReviewFix, meta?: Record<string, unknown>): EditorChange;
/** The patch that sets (or, for `""`, marks decorative) the alt text of the picture at `pointer`; null when nothing changes. */
export declare function altTextPatch(document: unknown, pointer: string, text: string): JsonPatchOperation[] | null;
export declare function setReviewAltText(editor: EditorSession, pointer: string, text: string, meta?: Record<string, unknown>): { changed: boolean } & Partial<EditorChange>;
export declare function markDecorative(editor: EditorSession, pointer: string, meta?: Record<string, unknown>): { changed: boolean } & Partial<EditorChange>;
export declare function currentAltText(document: unknown, pointer: string): string;
