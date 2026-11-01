import type { OpfIcons } from "./icons.js";
/** What the workspace's `review` event carries (and the Review panel's `onChange`). */
export interface ReviewPillCounts {
  error: number;
  warning: number;
  info: number;
  /** Findings shown in the panel. 0 reads "Valid". */
  total: number;
  /** Every finding, shown or not. The pill reads `total`. */
  all?: number;
  sources?: string[];
  /** True when the review could not run: the pill reads "Review unavailable" and is disabled. */
  unavailable?: boolean;
}
/** What the pill shows, from `describeReview`. */
export interface ReviewPillView {
  state: "checking" | "unavailable" | "valid" | "issues";
  /** The most severe level present, or null. */
  severity: "error" | "warning" | "info" | null;
  total: number;
  /** The visible text. */
  text: string;
  /** The non-zero severities, for example `["2 errors", "1 warning"]`. */
  parts: string[];
}
export interface ReviewPillLabels {
  /** Default: "Checking…". */
  checking?: string;
  /** Default: "Valid". */
  valid?: string;
  /** Default: "Review unavailable". */
  unavailable?: string;
  /** The visible text with findings. Default: "1 issue" / "3 issues". */
  issues?: (total: number) => string;
  /** One severity in the accessible name. Defaults: "1 error" / "2 errors". */
  error?: (count: number) => string;
  /** Default: "1 warning" / "2 warnings". */
  warning?: (count: number) => string;
  /** Default: "1 note" / "2 notes". */
  info?: (count: number) => string;
  /** The accessible name. Default: "Review: Valid", "Review: 3 issues (2 errors, 1 warning)", "Review unavailable". */
  name?: (view: ReviewPillView) => string;
  /** The overflow menu label. Default: "Review" or "Review (3)". */
  menu?: (total: number) => string;
}
export interface ReviewPillOptions {
  /** Called when the pill is pressed or its menu item runs. The workspace opens the Review panel here. Not called while the pill is disabled. */
  onOpen?: () => void;
  /** `"comfortable"` (32px, default) or `"touch"` (40px; 44px under a coarse pointer either way). */
  density?: "comfortable" | "touch";
  labels?: ReviewPillLabels;
  /**
   * Replace the glyph of a state: `valid` (no findings), `error`, `warning` and `info` (the most severe level present), `checking` (before the
   * first update) and `unavailable` (the review could not run). See `OpfIcon`. The glyph is `.opf-review-pill-icon`; `data-opf-icon` names it.
   */
  icons?: OpfIcons<"valid" | "error" | "warning" | "info" | "checking" | "unavailable">;
}
export interface ReviewPillMenuItem {
  id: "review";
  label: string;
  disabled: boolean;
  run(): void;
}
export interface ReviewPill {
  /** The status button. `data-state` is `checking`, `valid`, `issues` or `unavailable`; `data-severity` is `error`, `warning` or `info` with issues. */
  readonly element: HTMLButtonElement;
  /** Show the counts of a `review` event; null or undefined goes back to "Checking…". */
  update(counts: ReviewPillCounts | null | undefined): void;
  setDensity(density: "comfortable" | "touch"): void;
  setDisabled(disabled: boolean): void;
  /** The overflow menu entry: `[{ id: "review", label: "Review (3)", disabled, run }]`. */
  menuItems(): ReviewPillMenuItem[];
  /** Removes the element and listener. Safe twice. */
  destroy(): void;
}
/** What the pill shows for a `review` event payload, without a DOM. */
export declare function describeReview(counts: ReviewPillCounts | null | undefined, labels?: ReviewPillLabels): ReviewPillView;
/**
 * The review pill: a compact status button ("Valid", "3 issues", "Checking…", "Review unavailable") with a glyph and the color of the most severe
 * level. The accessible name carries the counts. When the review is unavailable the pill stays visible, muted and disabled (hiding it would make a
 * broken check look like a clean deck).
 */
export declare function createReviewPill(container: HTMLElement, options?: ReviewPillOptions): ReviewPill;
