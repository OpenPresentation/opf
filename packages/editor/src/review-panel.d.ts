import type { EditorSession } from "./index.js";
import type { ReviewAuditOptions, ReviewFinding, ReviewFix, ReviewReport, ReviewTarget } from "./review.js";

export interface ReviewPanelOptions {
  editor: EditorSession;
  /** The slide the "This slide only" filter follows. Call `update()` when it changes. */
  getSlideIndex?: () => number;
  /** Core's `AuditOptions` for this document, for example `{ textMeasurement }` from the host's font registry. */
  getAuditOptions?: (document: unknown) => ReviewAuditOptions;
  /** Select the content a finding is about. `target.path` is the OPF dotted path (the nearest existing field), `target.slide` the slide or null. */
  onGoTo?: (event: { finding: ReviewFinding; target: ReviewTarget }) => void;
  /** Focus a field the panel does not own (a title, text, link, language or font size) after going to it. Alt text is edited in the panel itself. */
  onFocusField?: (event: { finding: ReviewFinding; fix: ReviewFix; target: ReviewTarget }) => void;
  /** Called with every status or error message the panel shows. */
  onStatus?: (message: string, info: { error: boolean }) => void;
  /** Called after every redraw with the counts of the findings shown (after the filters and hidden checks) and of all findings. */
  onChange?: (counts: { error: number; warning: number; info: number; total: number; all: number; unavailable: boolean }) => void;
  /** Rule ids hidden at the start, and a callback when the author hides or restores a check. */
  ignored?: string[];
  onIgnoredChange?: (ids: string[]) => void;
  /** Re-audit after every session change (default true). Set false to call `refresh()` yourself, for example after the host's fonts have loaded. */
  autoRefresh?: boolean;
  /** Use another audit function instead of core's `auditPresentation`. */
  audit?: ReviewAuditOptions["audit"];
}

export interface ReviewPanel {
  element: HTMLElement;
  /** The latest findings before the panel's filters and hidden checks. */
  readonly findings: ReviewFinding[];
  readonly report: ReviewReport | undefined;
  /** Audit the document again and redraw. */
  refresh(): void;
  /** Redraw without auditing, after the host's slide changed. */
  update(): void;
  /** Hide (true) or show again (false) the findings of one rule in this panel. */
  setIgnored(ruleId: string, hidden: boolean): void;
  destroy(): void;
}

export { auditAvailable, reviewSeverities } from "./review.js";

/** Mount the Review panel: the audit's findings with go-to, safe quick fixes and live updates as the document changes. */
export declare function createReviewPanel(container: HTMLElement, options: ReviewPanelOptions): ReviewPanel;
