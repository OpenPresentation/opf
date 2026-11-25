/** A chart or table that references a dataset: `chart.data = { dataset, fields? }` or `table = { dataset, fields? }`. */
export interface DatasetItem {
  kind: "chart" | "table";
  id: string;
  /** Path parts of the chart or table. */
  parts: string[];
  item: Record<string, any>;
  /** Path parts of the object that holds `dataset` and `fields` (`chart.data`, or the table itself). */
  refParts: string[];
  ref: Record<string, any>;
}
/** The dataset reference test (core's `isDatasetRef`). */
export declare function isDatasetRef(value: unknown): boolean;
/** Visit every chart and table that references a dataset (slides and nested blocks). */
export declare function walkDatasetItems(presentation: unknown, visit: (entry: DatasetItem) => void): void;
/** The charts and tables that use dataset `id`, in document order. */
export declare function datasetUsage(presentation: unknown, id: string): Array<{ kind: "chart" | "table"; path: string; parts: string[] }>;

/** A metric linked to a dataset (FR-06): its dataset id, its path, the metric and its `data` link. */
export interface MetricLinkEntry { id: string; parts: string[]; metric: Record<string, unknown>; link: Record<string, unknown> }
/** Visit every metric linked to a dataset, on a slide or in a nested block. */
export declare function walkMetricLinks(presentation: unknown, visit: (entry: MetricLinkEntry) => void): void;
/** The column names a metric link reads. */
export declare function linkFields(link: Record<string, unknown>): string[];
/** A copy of a metric link with its column names renamed; the same object when no name changed. */
export declare function renameLinkFields<T extends Record<string, unknown>>(link: T, rename: (name: string) => string): T;
