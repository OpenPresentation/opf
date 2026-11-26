/** One condition of a metric's rows, as the Data section writes it. */
export interface MetricCondition { field: string; op: "=" | "!=" | "<" | "<=" | ">" | ">=" | "in"; value: string | number | boolean | null | (string | number | boolean | null)[] }
/** Rows as the Data section writes them: `Region = EMEA; Month >= 2026-09`. Undefined for text with no condition; throws a `TypeError` for a condition it cannot read. */
export declare function parseFilterText(text: string): MetricCondition[] | undefined;
/** The text a filter is edited as: the inverse of `parseFilterText`. */
export declare function filterText(filter: unknown): string;
