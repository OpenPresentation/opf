export {parseTabularData, createDataContent, OPFDataImportError} from "@openpresentation/opf/data";
import { opfPathToJsonPointer } from "./index.js";
import { fail } from "./edit-helpers.js";

/** The id pattern of a top-level dataset (the assets id pattern). */
export const DATASET_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

/**
 * Store imported data as a shared dataset (RR-54), as `opf import-data --dataset <id>` does. `content` is what `createDataContent` returns
 * (`{ table }` or `{ chart: { type, data } }`). Returns `{ id, content, patches, replaced }`: `content` is the same table or chart holding
 * `{ dataset: id }` instead of the rows, and `patches` write `datasets.<id>` (the imported columns and rows replace those of an existing
 * dataset of that id, which keeps its title, description and source; `source` is merged into its `source`). Apply `patches` and the patch that
 * places `content` in one `applyPatch` call so the import is one undoable edit. Throws `dataset-id-invalid`.
 */
export function prepareDatasetImport(document, content, options = {}) {
  const id = options.id;
  if (typeof id !== "string" || !DATASET_ID_PATTERN.test(id)) throw fail("dataset-id-invalid", 'A dataset id starts with a letter or digit and holds letters, digits, ".", "_" or "-".', { id });
  const isTable = isObject(content) && isObject(content.table);
  if (!isTable && !(isObject(content) && isObject(content.chart) && isObject(content.chart.data))) throw fail("dataset-content-invalid", "Give the table or chart that createDataContent returned.", {});
  const data = isTable ? content.table : content.chart.data;
  const datasets = isObject(document) && isObject(document.datasets) ? document.datasets : undefined;
  const previous = datasets && Object.hasOwn(datasets, id) && isObject(datasets[id]) ? datasets[id] : undefined;
  const origin = isObject(options.source) && typeof options.source.src === "string" ? options.source : undefined;
  const entry = {
    ...(previous ?? {}),
    columns: structuredClone(data.columns),
    rows: structuredClone(data.rows),
    ...(origin ? { source: { ...(isObject(previous?.source) ? previous.source : {}), ...origin } } : {}),
  };
  const pointer = opfPathToJsonPointer(["datasets", id]);
  const patches = !datasets
    ? [{ op: "add", path: "/datasets", value: { [id]: entry } }]
    : previous
      ? [{ op: "test", path: pointer, value: structuredClone(previous) }, { op: "replace", path: pointer, value: entry }]
      : [{ op: "add", path: pointer, value: entry }];
  const referenced = isTable ? { table: { dataset: id } } : { chart: { type: content.chart.type, data: { dataset: id } } };
  return { id, content: referenced, patches, replaced: Boolean(previous) };
}
