// The Data section of the metric inspector (FR-06): link a metric to a dataset of the deck (dataset, field, aggregate, filter rows), choose
// how its change is computed (the previous row, a baseline, a fixed number or a column), say which direction is good (`better`) and how a
// number value is written (`format`). With a link that resolves, the value and change fields show the computed numbers, and the written
// numbers that differ from them are listed with an Update button that applies the safe fix. Nothing here owns document state: `sync`
// re-reads the session after every change, Undo and Redo included, and each change is one undoable session change.
import { METRIC_AGGREGATES, METRIC_BETTER, METRIC_CHANGES, metricChangeKind, readMetricData, setMetricData, updateMetricData } from "./content-actions.js";

const OPERATORS = ["!=", "<=", ">=", "=", "<", ">"];
const titleCase = (value) => value.charAt(0).toUpperCase() + value.slice(1);
const CHANGE_LABELS = { none: "No change", previous: "Previous row", baseline: "A baseline (rows)", value: "A fixed number", column: "A column that holds it" };
const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

const scalarOf = (text) => {
  const raw = text.trim();
  if (raw === "null") return null;
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(raw)) return Number(raw);
  if (raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"')) {
    try {
      return JSON.parse(raw);
    } catch {
      return raw.slice(1, -1);
    }
  }
  return raw;
};
const scalarText = (value) => (typeof value === "string" ? (/^(?:null|true|false|-?\d[\d.]*)$/.test(value) || /^\s|\s$|[;,"]/.test(value) ? JSON.stringify(value) : value) : String(value));

/**
 * Rows as the Data section writes them: `Region = EMEA; Month >= 2026-09; Month in 2026-10, 2026-11`. A condition is a column, one of
 * `= != < <= > >= in` and a value (a number, `null`, `true`, `false`, or text; quote a text that looks like one).
 * Returns the filter, or undefined for text that reads as no condition; throws a `TypeError` that names the condition it could not read.
 */
export function parseFilterText(text) {
  const conditions = String(text ?? "").split(";").map((part) => part.trim()).filter(Boolean);
  if (!conditions.length) return undefined;
  return conditions.map((condition) => {
    const inMatch = /^(.+?)\s+in\s+(.+)$/.exec(condition);
    if (inMatch) return { field: inMatch[1].trim(), op: "in", value: inMatch[2].split(",").map(scalarOf) };
    for (const op of OPERATORS) {
      const at = condition.indexOf(op);
      if (at > 0) return { field: condition.slice(0, at).trim(), op, value: scalarOf(condition.slice(at + op.length)) };
    }
    throw new TypeError(`Write each condition as column, operator and value, such as Region = EMEA (operators: = != < <= > >= in); "${condition}" has none.`);
  });
}

/** The text a filter is edited as: the inverse of `parseFilterText`. */
export function filterText(filter) {
  return (Array.isArray(filter) ? filter : []).map((condition) => `${condition.field} ${condition.op === "in" ? "in" : condition.op} ${Array.isArray(condition.value) ? condition.value.map(scalarText).join(", ") : scalarText(condition.value)}`).join("; ");
}

/**
 * Build the Data section. `ctx` supplies the panel's helpers: `h`, `selectField`, `textField`, `button`, `run(action, done)` and `editor`.
 * Returns `{ node, sync(blockPath, document) }`; `node.hidden` is true while the selection is not a metric.
 */
export function createMetricDataControls(ctx) {
  const { editor, h, selectField, textField, button, run } = ctx;
  let blockPath;
  let state;

  const current = () => (blockPath ? readMetricData(editor.presentation, blockPath) : undefined);
  /** Write the link `next` (or remove it with null) as one change. */
  const setLink = (next, done = "Metric data changed.") => run(() => setMetricData(editor, blockPath, { data: next }), done);
  const link = () => state?.link ?? {};
  const columnsOf = (datasetId) => state?.datasets.find((entry) => entry.id === datasetId)?.columns ?? [];

  const dataset = selectField("metric-dataset", "Computed from", {
    empty: "Not linked (typed)",
    help: "A dataset of this deck: the value and the change are computed from its rows",
    onChange: (value) => {
      if (value === "") return setLink(null, "Metric unlinked; it shows its written numbers.");
      const columns = columnsOf(value);
      const first = columns.find((column) => column.role === "measure") ?? columns[0];
      return setLink({ dataset: value, field: first?.name ?? "", aggregate: link().aggregate ?? "last" }, "Metric linked to the data.");
    },
  });
  const field = selectField("metric-field", "Column", { help: "The column whose cells are combined", onChange: (value) => setLink({ ...link(), field: value }, "Metric column changed.") });
  const aggregate = selectField("metric-aggregate", "Combine with", {
    help: "How the cells of the kept rows are combined: the last row's cell, the sum, the count of rows, ...",
    onChange: (value) => setLink({ ...link(), aggregate: value }, "Metric aggregate changed."),
  });
  aggregate.setOptions(METRIC_AGGREGATES.map((value) => ({ value, label: titleCase(value) })));
  const rows = textField("metric-rows", "Only rows where", {
    help: "Conditions on the dataset's columns, joined by ;  Example: Region = EMEA; Month >= 2026-09",
    placeholder: "Region = EMEA",
    onCommit: (text) => {
      const filter = parseFilterText(text);
      const { filter: _old, ...rest } = link();
      return setLink(filter ? { ...rest, filter } : rest, filter ? "Metric rows chosen." : "Metric uses every row.");
    },
  });
  const change = selectField("metric-change", "Change", { help: "What the change is computed against", onChange: (value) => setChange(value) });
  change.setOptions(METRIC_CHANGES.map((value) => ({ value, label: CHANGE_LABELS[value] })));
  const baseline = textField("metric-baseline", "Baseline rows", {
    help: "The rows the change is compared with; they replace the rows above. Example: Month = 2026-09",
    placeholder: "Month = 2026-09",
    onCommit: (text) => {
      const filter = parseFilterText(text);
      if (!filter) return undefined;
      return setLink({ ...link(), delta: { ...(link().delta ?? {}), compare: { filter } } }, "Metric baseline chosen.");
    },
  });
  const fixed = textField("metric-fixed", "Compared with", {
    help: "A number to compare with: a plan, a budget, last year's figure",
    type: "number",
    onCommit: (text) => {
      if (text === "" || !Number.isFinite(Number(text))) return undefined;
      return setLink({ ...link(), delta: { ...(link().delta ?? {}), compare: { value: Number(text) } } }, "Metric comparison value set.");
    },
  });
  const deltaField = selectField("metric-change-column", "Change column", {
    help: "A column that already holds the change",
    onChange: (value) => {
      if (value === "") return undefined;
      const { compare: _compare, ...delta } = link().delta ?? {};
      return setLink({ ...link(), delta: { ...delta, field: value } }, "Metric change column set.");
    },
  });
  const as = selectField("metric-as", "Change as", {
    help: "A difference, or a percent of the base",
    onChange: (value) => setLink({ ...link(), delta: { ...(link().delta ?? {}), as: value } }, "Metric change kind set."),
  });
  as.setOptions([{ value: "difference", label: "Difference" }, { value: "percent", label: "Percent" }]);
  const deltaFormat = textField("metric-change-format", "Change format", {
    help: "How the change is drawn, such as +0.0;-0.0;0 or +0%;-0%;0%. Empty: derived from the value's format",
    placeholder: "+0.0;-0.0;0",
    onCommit: (text) => {
      const { format: _format, ...delta } = link().delta ?? {};
      return setLink({ ...link(), delta: text.trim() ? { ...delta, format: text.trim() } : delta }, "Metric change format set.");
    },
  });
  const better = selectField("metric-better", "Good news is", {
    empty: "Up (default)",
    help: "Which direction of change is good: it decides the color of the arrow and the change",
    onChange: (value) => run(() => setMetricData(editor, blockPath, { better: value === "" ? null : value }), value === "" ? "Direction reset." : `Good news is ${value}.`),
  });
  better.setOptions(METRIC_BETTER.map((value) => ({ value, label: titleCase(value) })));
  const format = textField("metric-format", "Number format", {
    help: "How a number value is written, such as 0.0% or $#,##0.0M. Empty: the column's format, else the number rules",
    placeholder: "0.0%",
    onCommit: (text) => run(() => setMetricData(editor, blockPath, { format: text.trim() === "" ? null : text.trim() }), "Metric number format set."),
  });
  const shown = h("p", { class: "opf-dc-note", "data-role": "metric-computed", role: "status" });
  const update = button("Update the written numbers", () => run(() => updateMetricData(editor, blockPath), "The written value and change now show the computed numbers."), { title: "Write the computed numbers into the metric's value and change, for readers that do not compute" });
  const unlink = button("Unlink", () => setLink(null, "Metric unlinked; it shows its written numbers."), { quiet: true });

  function setChange(kind) {
    const base = { ...link() };
    const { delta: _delta, ...withoutDelta } = base;
    const columns = columnsOf(base.dataset);
    if (kind === "none") return setLink(withoutDelta, "The metric computes no change.");
    if (kind === "previous") return setLink({ ...withoutDelta, delta: { compare: "previous", ...(base.delta?.as ? { as: base.delta.as } : {}) } }, "The change is against the previous row.");
    if (kind === "baseline") return setLink({ ...withoutDelta, delta: { compare: { filter: base.delta?.compare?.filter ?? [{ field: columns[0]?.name ?? "", op: "=", value: "" }] } } }, "Choose the baseline rows.");
    if (kind === "value") return setLink({ ...withoutDelta, delta: { compare: { value: base.delta?.compare?.value ?? 0 } } }, "Set the number to compare with.");
    return setLink({ ...withoutDelta, delta: { field: base.delta?.field ?? columns.find((column) => column.name !== base.field)?.name ?? "" } }, "Choose the column that holds the change.");
  }

  const body = h("div", { class: "opf-dc-metric-data", "data-role": "metric-data" }, dataset.wrap, field.wrap, aggregate.wrap, rows.wrap, change.wrap, baseline.wrap, fixed.wrap, deltaField.wrap, as.wrap, deltaFormat.wrap, better.wrap, format.wrap, shown, update, unlink);
  const node = h("details", { class: "opf-dc-details", "data-role": "metric-data-section", open: true }, h("summary", {}, "Data"), body);

  return {
    node,
    sync(path) {
      blockPath = path;
      state = current();
      node.hidden = !state;
      if (!state) return;
      const data = state.link;
      dataset.setOptions(state.datasets.map((entry) => ({ value: entry.id, label: entry.title ? `${entry.title} (${entry.id})` : entry.id })));
      dataset.set(data?.dataset ?? "");
      const columns = columnsOf(data?.dataset);
      const columnOptions = columns.map((column) => ({ value: column.name, label: column.role === "measure" ? `${column.name} (measure)` : column.name }));
      field.setOptions(columnOptions);
      field.set(data?.field ?? "");
      aggregate.set(data?.aggregate ?? "last");
      const linked = Boolean(data);
      for (const control of [field, aggregate, rows, change, better]) control.wrap.hidden = control === better ? false : !linked;
      rows.set(filterText(data?.filter));
      const kind = metricChangeKind(data);
      change.set(linked ? kind : "none");
      baseline.wrap.hidden = !linked || kind !== "baseline";
      baseline.set(filterText(data?.delta?.compare?.filter));
      fixed.wrap.hidden = !linked || kind !== "value";
      fixed.set(isObject(data?.delta?.compare) && "value" in data.delta.compare ? String(data.delta.compare.value) : "");
      deltaField.wrap.hidden = !linked || kind !== "column";
      deltaField.setOptions(columnOptions);
      deltaField.set(data?.delta?.field ?? "");
      as.wrap.hidden = !linked || kind === "none";
      as.set(data?.delta?.as ?? "difference");
      deltaFormat.wrap.hidden = !linked || kind === "none";
      deltaFormat.set(data?.delta?.format ?? "");
      better.set(state.better ?? "");
      format.set(state.format ?? "");
      unlink.hidden = !linked;
      const computed = state.resolved ? [`Shows ${state.value?.text ?? ""}`, state.delta ? `with ${state.delta.text}` : ""].filter(Boolean).join(" ") : linked ? (state.diagnostics.find((entry) => entry.severity === "error" || entry.code.startsWith("metric-data-"))?.message ?? "The link does not resolve; the written numbers are shown.") : "";
      shown.textContent = computed;
      shown.hidden = computed === "";
      update.hidden = state.stale.length === 0;
      update.title = state.stale.map((entry) => entry.message).join(" ") || update.title;
    },
  };
}
