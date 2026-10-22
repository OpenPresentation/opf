import type { ValidateOptions } from "@openpresentation/opf";
import type { EditorSession } from "./index.js";
import type { ReviewFinding, ReviewFix, ReviewHook, ReviewReport, ReviewTarget } from "./review.js";

export interface ReviewPanelOptions {
  editor: EditorSession;
  /** The slide the "This slide only" filter follows. Call `update()` when it changes. */
  getSlideIndex?: () => number;
  /** Core's `ValidateOptions` for this document, for example `{ fonts: { textMeasurement } }` from the host's fonts handle (a function of the slide index is accepted too). */
  getValidateOptions?: (presentation: unknown) => ValidateOptions;
  /** Select the content a finding is about. `target.path` is the OPF dotted path (the nearest existing field), `target.slide` the slide or null. */
  onGoTo?: (event: { finding: ReviewFinding; target: ReviewTarget }) => void;
  /** Focus a field the panel does not own (a title, text, link, language or font size) after going to it. Alt text is edited in the panel itself. */
  onFocusField?: (event: { finding: ReviewFinding; fix: ReviewFix; target: ReviewTarget }) => void;
  /** Called with every status or error message the panel shows. */
  onStatus?: (message: string, info: { error: boolean }) => void;
  /** Called after every redraw with the counts of the findings shown (after the filters and hidden checks), of all findings, and the sources present (`opf`, `pptx.dev/review`, ...). */
  onChange?: (counts: { error: number; warning: number; info: number; total: number; all: number; sources: string[]; unavailable: boolean }) => void;
  /** Rule ids hidden at the start, and a callback when the author hides or restores a check. */
  ignored?: string[];
  onIgnoredChange?: (ids: string[]) => void;
  /** Re-check after changes (default true). Set false to call `refresh()` yourself, for example after the host's fonts have loaded. */
  autoRefresh?: boolean;
  /** Milliseconds the document must be quiet after a change before the full `validate` runs again (default 300). `refresh()` checks at once. */
  delay?: number;
  /**
   * A hosted reviewer: resolves a `FindingReport` whose findings (`source`, for example `pptx.dev/review`) are listed beside core's. It runs when
   * the author presses its button, or after every re-check with `autoReview`. A finding with no `source` is listed under `review`.
   */
  review?: ReviewHook;
  /** The label of the button that runs the `review` hook (default "Run review"). */
  reviewLabel?: string;
  /** Run the `review` hook after every re-check, not only on the button (default false: a hosted review can be slow or metered). */
  autoReview?: boolean;
}

export interface ReviewPanel {
  element: HTMLElement;
  /** The latest findings before the panel's filters and hidden checks: core's and the hosted reviewer's. */
  readonly findings: ReviewFinding[];
  /** The merged report (`valid`, `findings`, `counts`, `sources`). */
  readonly report: ReviewReport | undefined;
  /** Core's `validate` report alone, or undefined when it could not run. */
  readonly validation: import("@openpresentation/opf").ValidationReport | undefined;
  /** Run core's full check again now and redraw. */
  refresh(): void;
  /** Check after `delay` milliseconds without another call (a burst of calls checks once). With `autoRefresh: false` the host calls this after each redraw. */
  schedule(): void;
  /** Run the `review` hook now; resolves once its findings are listed (or its error is shown). */
  review(): Promise<void>;
  /** Redraw without checking, after the host's slide changed. */
  update(): void;
  /** Hide (true) or show again (false) the findings of one rule in this panel. */
  setIgnored(ruleId: string, hidden: boolean): void;
  destroy(): void;
}

export { reviewSeverities } from "./review.js";

/** Mount the Review panel: core's findings by category with go-to and quick fixes, a hosted reviewer's beside them, and updates as the document changes. */
export declare function createReviewPanel(container: HTMLElement, options: ReviewPanelOptions): ReviewPanel;
