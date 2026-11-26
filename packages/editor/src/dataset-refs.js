// Where charts and tables use a shared dataset (RR-54). A top-level `datasets` entry is referenced by a chart as
// `chart.data = { dataset, fields? }` and by a table as `table = { dataset, fields? }`. These helpers find those
// references anywhere in a document (slides and nested blocks), so the data grid can say how many items
// share a dataset and keep their `fields` and `mapping` names in step when a column is renamed.

const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

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

/**
 * FR-06: visit every metric linked to a dataset (`metric.data`), on a slide or in a nested block. `visit({ id, parts, metric, link })`:
 * `parts` is the metric's path, `link` its `data`.
 */
export function walkMetricLinks(presentation, visit) {
  if (!isObject(presentation) || !Array.isArray(presentation.slides)) return;
  const walk = (payload, base, depth, ancestors) => {
    if (isObject(payload.metric) && isObject(payload.metric.data) && typeof payload.metric.data.dataset === "string")
      visit({ id: payload.metric.data.dataset, parts: [...base, "metric"], metric: payload.metric, link: payload.metric.data });
    if (depth >= 32 || ancestors.includes(payload) || !Array.isArray(payload.blocks)) return;
    const nested = [...ancestors, payload];
    payload.blocks.forEach((block, index) => {
      if (isObject(block)) walk(block, [...base, "blocks", String(index)], depth + 1, nested);
    });
  };
  presentation.slides.forEach((slide, index) => {
    if (isObject(slide)) walk(slide, ["slides", String(index)], 0, []);
  });
}

/** The column names a metric link reads: its field, its filters' fields, a baseline's fields and the column that holds the change. */
export function linkFields(link) {
  const names = [link.field];
  for (const condition of Array.isArray(link.filter) ? link.filter : []) names.push(condition?.field);
  const delta = link.delta;
  if (isObject(delta)) {
    if (typeof delta.field === "string") names.push(delta.field);
    if (isObject(delta.compare) && Array.isArray(delta.compare.filter)) for (const condition of delta.compare.filter) names.push(condition?.field);
  }
  return names.filter((name) => typeof name === "string");
}

/** A copy of a metric link with its column names renamed by `rename(name)`; the same object when no name changed. */
export function renameLinkFields(link, rename) {
  const filter = (conditions) => (Array.isArray(conditions) ? conditions.map((condition) => (isObject(condition) && typeof condition.field === "string" ? { ...condition, field: rename(condition.field) } : condition)) : conditions);
  const next = { ...link, ...(typeof link.field === "string" ? { field: rename(link.field) } : {}), ...(link.filter !== undefined ? { filter: filter(link.filter) } : {}) };
  if (isObject(link.delta)) {
    const delta = { ...link.delta };
    if (typeof delta.field === "string") delta.field = rename(delta.field);
    if (isObject(delta.compare) && delta.compare.filter !== undefined) delta.compare = { ...delta.compare, filter: filter(delta.compare.filter) };
    next.delta = delta;
  }
  return JSON.stringify(next) === JSON.stringify(link) ? link : next;
}
