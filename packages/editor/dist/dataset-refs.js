// Where charts and tables use a shared dataset (RR-54). A top-level `datasets` entry is referenced by a chart as
// `chart.data = { dataset, fields? }` and by a table as `table = { dataset, fields? }`. These helpers find those
// references anywhere in a document (slides, nested blocks and promoted regions), so the data grid can say how many items
// share a dataset and keep their `fields` and `mapping` names in step when a column is renamed.

const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const REGION_KEY = /^(?:top|middle|bottom|left|center|right)(?:[+:]|$)/;

/** The dataset reference test (the same as core's `isDatasetRef`): an object with a string `dataset`. */
export const isDatasetRef = (value) => isObject(value) && typeof value.dataset === "string";

/**
 * Visit every chart and table that references a dataset. `visit({ kind, id, parts, item, refParts, ref })`:
 * `item` is the chart or table object, `parts` its path, and `ref` the object that holds `dataset` and `fields`
 * (`chart.data` for a chart, the table itself for a table) at `refParts`.
 */
export function walkDatasetItems(presentation, visit) {
  if (!isObject(presentation) || !Array.isArray(presentation.slides)) return;
  const walk = (payload, base, depth, ancestors) => {
    if (isObject(payload.chart) && isDatasetRef(payload.chart.data))
      visit({ kind: "chart", id: payload.chart.data.dataset, parts: [...base, "chart"], item: payload.chart, refParts: [...base, "chart", "data"], ref: payload.chart.data });
    if (isObject(payload.table) && isDatasetRef(payload.table))
      visit({ kind: "table", id: payload.table.dataset, parts: [...base, "table"], item: payload.table, refParts: [...base, "table"], ref: payload.table });
    if (depth >= 32 || ancestors.includes(payload) || !Array.isArray(payload.blocks)) return;
    const nested = [...ancestors, payload];
    payload.blocks.forEach((block, index) => {
      if (isObject(block)) walk(block, [...base, "blocks", String(index)], depth + 1, nested);
    });
  };
  presentation.slides.forEach((slide, index) => {
    if (!isObject(slide)) return;
    const base = ["slides", String(index)];
    walk(slide, base, 0, []);
    for (const [key, value] of Object.entries(slide)) if (isObject(value) && REGION_KEY.test(key)) walk(value, [...base, key], 1, [slide]);
  });
}

/** The charts and tables that use dataset `id`: `[{ kind, path, parts }]` in document order. */
export function datasetUsage(presentation, id) {
  const items = [];
  walkDatasetItems(presentation, (entry) => {
    if (entry.id === id) items.push({ kind: entry.kind, path: entry.parts.join("."), parts: entry.parts });
  });
  return items;
}
