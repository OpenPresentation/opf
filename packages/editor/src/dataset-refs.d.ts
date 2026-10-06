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
/** Visit every chart and table that references a dataset (slides, nested blocks and promoted regions). */
export declare function walkDatasetItems(document: unknown, visit: (entry: DatasetItem) => void): void;
/** The charts and tables that use dataset `id`, in document order. */
export declare function datasetUsage(document: unknown, id: string): Array<{ kind: "chart" | "table"; path: string; parts: string[] }>;
