import type { Finding, FindingFix, FindingReport, FindingSeverity, ValidateOptions, ValidationCategory, ValidationReport } from "@openpresentation/opf";
import type { EditorChange, EditorSession, JsonPatchOperation } from "./index.js";

export type ReviewSeverity = FindingSeverity;
/** A suggested repair from core's `validate` or a hosted reviewer: core's `FindingFix` (`title`, `patch` of RFC 6902 operations, or a `focus` field). */
export type ReviewFix = FindingFix;

/** A finding of core's `validate` or of a hosted reviewer (core's `Finding`), with the fields the editor derives. */
export interface ReviewFinding extends Omit<Finding, "slide"> {
  /** Unique within the report: the source, the rule id and the path, numbered when they repeat. */
  id: string;
  /** The same path in OPF dotted form (`slides.0.text.1.color`). */
  dottedPath: string;
  /** Zero-based slide index, or null for a finding about the whole presentation. */
  slide: number | null;
}

/** What the Review panel holds: core's `FindingReport` of every source merged, the editor's findings, and the sources present (`opf`, `pptx.dev/review`, ...). */
export interface ReviewReport extends FindingReport {
  findings: ReviewFinding[];
  /** The `Finding.source` of every group of findings in the report. `opf` is core's own checks. */
  sources: string[];
}

/** The hook that brings a hosted reviewer's findings into the panel (see `createReviewPanel`). */
export type ReviewHook = (presentation: unknown, options: ReviewHookOptions) => Promise<FindingReport>;
export interface ReviewHookOptions {
  /** Aborted when the document changes while the review runs, or the panel is destroyed. */
  signal: AbortSignal;
  /** Core's report for this presentation, so a hosted reviewer need not repeat the deterministic checks. */
  report: ValidationReport | undefined;
  /** The options core's `validate` ran with (from the panel's `getValidateOptions`). */
  validateOptions: ValidateOptions;
}

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
/** Core's finding categories in report order: format, references, policy, accessibility, layout, content. */
export declare const reviewCategories: readonly ValidationCategory[];
/** The `source` of a finding that names none: core's own checks. */
export declare const CORE_SOURCE: "opf";
/** Merge core's report and a hosted reviewer's, keeping findings per `Finding.source` (a report replaces earlier findings of the sources it carries). A hook finding with no source gets `hookSource` (default `review`). */
export declare function mergeFindingReports(core: FindingReport | undefined, hook?: FindingReport | undefined, options?: { hookSource?: string }): FindingReport & { sources: string[] };
export declare function reviewFindings(report: Pick<FindingReport, "findings"> | undefined): ReviewFinding[];
export declare function countFindings(findings: readonly ReviewFinding[]): { error: number; warning: number; info: number; total: number };
export declare function filterFindings(findings: readonly ReviewFinding[], options?: { minimum?: ReviewSeverity; slide?: number | null }): ReviewFinding[];
/** The deck first, then each slide; errors before warnings before notes; then by rule and path. */
export declare function sortFindings(findings: readonly ReviewFinding[]): ReviewFinding[];
/** Findings grouped by category: core's categories in core's order, then any other category in the order it first appears. Empty categories are left out. */
export declare function groupFindings(findings: readonly ReviewFinding[]): { category: string; findings: ReviewFinding[] }[];
/** Where "go to" lands for a finding. */
export declare function findingTarget(presentation: unknown, finding: Pick<ReviewFinding, "path">): ReviewTarget;
/** Apply a `patch` fix as one undoable, validated session change; refuses a stale or unsafe patch. */
export declare function applyReviewFix(editor: EditorSession, finding: Pick<ReviewFinding, "ruleId"> | undefined, fix: ReviewFix, meta?: Record<string, unknown>): EditorChange;
/** The patch that sets (or, for `""`, marks decorative) the alt text of the picture at `pointer`; null when nothing changes. */
export declare function altTextPatch(presentation: unknown, pointer: string, text: string): JsonPatchOperation[] | null;
export declare function setReviewAltText(editor: EditorSession, pointer: string, text: string, meta?: Record<string, unknown>): { changed: boolean } & Partial<EditorChange>;
export declare function markDecorative(editor: EditorSession, pointer: string, meta?: Record<string, unknown>): { changed: boolean } & Partial<EditorChange>;
export declare function currentAltText(presentation: unknown, pointer: string): string;
