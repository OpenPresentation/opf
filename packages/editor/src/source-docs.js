// The documentation cards of the source editor: the panel beside the selected suggestion and the hover over a key or a value. One model, two uses,
// plain DOM (no markup is parsed from the schema: its text is shown as text).

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

/**
 * @typedef {object} DocModel
 * @property {string} title       the key, the value or the record name
 * @property {string} [type]      "string", "array of Slide", "layout"
 * @property {boolean} [required]
 * @property {boolean} [deprecated]
 * @property {string} [description]
 * @property {{ value: unknown, description?: string }[]} [values]   allowed values, shown as chips
 * @property {unknown[]} [examples]
 * @property {string} [definition]   the schema definition's name
 * @property {string[]} [notes]      extra lines (regions of a layout, where a record comes from)
 */

const MAX_CHIPS = 12;
const show = (value) => (typeof value === "string" ? value : JSON.stringify(value));

/** The card as DOM. */
export function docNode(model) {
  const root = el("div", "opf-doc");
  const head = el("div", "opf-doc-head");
  head.append(el("code", "opf-doc-title", model.title));
  if (model.type) head.append(el("span", "opf-doc-type", model.type));
  if (model.required) head.append(el("span", "opf-doc-badge", "required"));
  if (model.deprecated) head.append(el("span", "opf-doc-badge", "deprecated"));
  root.append(head);
  if (model.description) root.append(el("p", "opf-doc-text", model.description));
  for (const note of model.notes ?? []) root.append(el("p", "opf-doc-note", note));
  if (model.values?.length) {
    const chips = el("div", "opf-doc-values");
    for (const entry of model.values.slice(0, MAX_CHIPS)) {
      const chip = el("code", "opf-doc-chip", show(entry.value));
      if (entry.description) chip.title = entry.description;
      chips.append(chip);
    }
    if (model.values.length > MAX_CHIPS) chips.append(el("span", "opf-doc-more", `and ${model.values.length - MAX_CHIPS} more`));
    root.append(chips);
  }
  const example = model.examples?.find((value) => value !== undefined && !(typeof value === "string" && value.includes("...")));
  if (example !== undefined) {
    const line = el("p", "opf-doc-example");
    line.append("Example: ", el("code", undefined, typeof example === "string" ? JSON.stringify(example) : JSON.stringify(example).slice(0, 80)));
    root.append(line);
  }
  if (model.definition) root.append(el("p", "opf-doc-source", `Schema: ${model.definition}`));
  return root;
}

/** The card as plain text (what a screen reader hears and what the tests read). */
export function docText(model) {
  return [model.title, model.type, model.required ? "required" : "", model.description, ...(model.notes ?? [])].filter(Boolean).join(". ");
}

/** The model of a field described by `describeField` (`info`), named `title`. */
export function fieldDoc(info, title) {
  return {
    title,
    type: typeOfInfo(info),
    required: info.required,
    deprecated: info.deprecated,
    description: info.description,
    values: info.enum,
    examples: info.examples,
    definition: info.definition,
  };
}

function typeOfInfo(info) {
  if (info.catalogKind) return info.catalogKind.replace(/s$/, "").replace(/([A-Z])/g, " $1").toLowerCase() + " id";
  if (info.enum?.length > 1) return "enum";
  const kinds = info.types.map((type) => (type === "array" && info.itemInfo ? `array of ${info.itemInfo.definition ?? info.itemInfo.types.join(" | ")}` : type));
  return [...new Set(kinds)].join(" | ");
}

/** The model of one property of an object (a `FieldChild` of `describeField`): the card beside a key suggestion. */
export function childDoc(child) {
  return { title: child.key, type: child.typeLabel, required: child.required, deprecated: child.deprecated, description: child.description };
}
