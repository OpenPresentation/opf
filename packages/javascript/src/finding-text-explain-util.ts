/**
 * Shared shape of the hand-written part of `explain` (`finding-text-explain-*.ts`): a `fix` sentence and a small before/after example per rule.
 * The example sides are written as objects (stringified as JSON, two-space indent) or, for syntax errors, as the broken text itself.
 */
export interface ExplainDetail {
  /** What to do, in a sentence or two. */
  fix: string;
  /** The problem side of the example: an object (written as JSON) or the raw text. */
  problem: unknown;
  /** The repaired side. */
  fixed: unknown;
}

/** An example: the problem and its repair. */
export const ex = (fix: string, problem: unknown, fixed: unknown): ExplainDetail => ({ fix, problem, fixed });

/** An example side as text. */
export const exampleText = (side: unknown): string => (typeof side === "string" ? side : JSON.stringify(side, null, 2));

/** A one-slide deck around a slide, for examples that need the deck level. */
export const slide = (entry: Record<string, unknown>): Record<string, unknown> => entry;

/** A small column chart used by many examples. */
export const CHART = { type: "column", alt: "Revenue by quarter", data: { columns: ["Quarter", "Revenue"], rows: [["Q1", 12], ["Q2", 15]] } };
