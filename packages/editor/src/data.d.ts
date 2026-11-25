export {parseTabularData, ingest, OPFDataImportError} from "@openpresentation/opf/data";
export type {TabularData, DataImportOptions, IngestOptions} from "@openpresentation/opf/data";
import type { JsonPatchOperation } from "./index.js";

/** The id pattern of a top-level dataset (the assets id pattern). */
export declare const DATASET_ID_PATTERN: RegExp;
export interface DatasetImportOptions {
  /** The dataset id: letters, digits, ".", "_" or "-", starting with a letter or digit. */
  id: string;
  /**
   * Where the rows came from, written in the dataset's own keys (merged into those it has: an inline `datasource` object into an inline one it
   * already has). A string `datasource` is the id of an entry of the root `datasources` map. Engines never read, fetch or refresh it.
   */
  provenance?: {
    datasource?: string | { title?: string; description?: string; connector?: string; src?: string; license?: string; refresh?: string; extensions?: Record<string, unknown> };
    query?: string;
    retrieved?: string;
    version?: string;
    sha256?: string;
    generator?: { kind: "human" | "model"; name: string };
  };
}
export interface DatasetImport {
  id: string;
  /** The imported table or chart, holding `{ dataset: id }` instead of its rows. */
  content: { table: { dataset: string } } | { chart: { type: string; data: { dataset: string } } };
  /** Patches that write `datasets.<id>`; apply them with the patch that places `content`, in one call. */
  patches: JsonPatchOperation[];
  /** True when a dataset of that id existed and its columns and rows were replaced. */
  replaced: boolean;
}
/** Store imported data (the result of `ingest`) as a shared dataset, as `opf ingest --dataset <id>` does. Throws `dataset-id-invalid`. */
export declare function prepareDatasetImport(presentation: unknown, content: { table: unknown } | { chart: { type: string; data: unknown } }, options: DatasetImportOptions): DatasetImport;
