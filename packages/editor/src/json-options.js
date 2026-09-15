import { catalogKinds, catalogSchemaNames, schemas, validateCatalogRecord, validatePresentation } from "@openpresentation/opf";
import { getCatalogOptions } from "./index.js";
import { schemaAtPath, schemaVariants } from "./schema.js";
import { findNodeAtOffset, getNodePath, parseTree } from "jsonc-parser";
function catalogFor(description) {
  return catalogKinds.find((kind) => description.includes(`catalogs.${kind}`) || new RegExp(`\\b${kind}['\u2019]? catalog`).test(description));
}
function layoutFits(record, slide) {
  const required = /* @__PURE__ */ new Set();
  const aliases = { title: "title", subtitle: "text", text: "text", items: "list", bullets: "list", image: "picture", chart: "chart", table: "table", code: "code", video: "media", metric: "text", quote: "text" };
  const visit = (value) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (aliases[key] && child !== void 0) required.add(aliases[key]);
      if (key === "blocks" || key === "regions") visit(child);
      if (key === "regions" && child && typeof child === "object") Object.values(child).forEach(visit);
    }
  };
  visit(slide);
  const slots = new Set((Array.isArray(record.placeholders) ? record.placeholders : []).map((p) => p.type === "subtitle" ? "text" : p.type));
  return required.size > 0 && [...required].every((type) => slots.has(type)) && [...slots].every((type) => required.has(type) || type === "title" || type === "text");
}
function getJsonFieldContext(source, position, loadedCatalogs = {}) {
  let document;
  try {
    document = JSON.parse(source);
  } catch {
    return null;
  }
  const root = parseTree(source);
  if (!root) return null;
  let node = findNodeAtOffset(root, position, true);
  if (node?.parent?.type === "property" && node.parent.children?.[0] === node) node = node.parent.children[1];
  if (node?.type === "object") node = node.children?.find((property) => property.children?.[0]?.value === "id")?.children?.[1];
  if (!node || !["string", "number", "boolean"].includes(node.type)) return null;
  const path = getNodePath(node);
  if (!path.length) return null;
  const schema = schemaAtPath(document, path.map(String));
  const variants = schemaVariants(schema);
  const description = String(schema.description ?? "");
  let catalog = catalogFor(description);
  if (!catalog && typeof path.at(-1) === "number") catalog = catalogFor(String(schemaAtPath(document, path.slice(0, -1).map(String)).description ?? ""));
  const options = /* @__PURE__ */ new Map();
  let unloadedSource = false;
  if (catalog && typeof node.value === "string") {
    const entries = document.catalogs;
    const local = entries?.[catalog];
    unloadedSource = Boolean(local?.source);
    const slide = path[0] === "slides" && typeof path[1] === "number" ? document.slides?.[path[1]] : void 0;
    for (const option of getCatalogOptions(catalog)) {
      options.set(option.id, {
        value: option.id,
        label: option.label,
        description: typeof option.record.description === "string" ? option.record.description : void 0,
        source: "Built-in catalog",
        suggested: catalog === "layouts" && layoutFits(option.record, slide)
      });
    }
    for (const { value, source: source2 } of [
      ...(Array.isArray(loadedCatalogs?.[catalog]) ? loadedCatalogs[catalog] : []).map((value2) => ({ value: value2, source: "Loaded catalog" })),
      ...(Array.isArray(local?.records) ? local.records : []).map((value2) => ({ value: value2, source: "Document catalog" }))
    ]) {
      if (!value || typeof value !== "object") continue;
      const record = value;
      if (typeof record.id !== "string") continue;
      const schemaId = schemas[catalogSchemaNames[catalog]].$id;
      if (!validateCatalogRecord(catalog, { $schema: schemaId, ...record }).valid) {
        options.delete(record.id);
        continue;
      }
      options.set(record.id, {
        value: record.id,
        label: typeof record.name === "string" ? record.name : record.id,
        description: typeof record.description === "string" ? record.description : void 0,
        source: source2,
        suggested: catalog === "layouts" && layoutFits(record, slide)
      });
    }
  } else {
    for (const variant of variants) for (const value of variant.enum ?? []) {
      if (["string", "number", "boolean"].includes(typeof value)) options.set(JSON.stringify(value), { value, label: String(value), source: "Schema" });
    }
    if (node.type === "boolean" && variants.some((variant) => variant.type === "boolean" && variant.const === void 0)) {
      for (const value of [true, false]) options.set(String(value), { value, label: String(value), source: "Schema" });
    }
  }
  if (!options.size) return null;
  const priority = (option) => option.source === "Document catalog" ? 2 : option.source === "Loaded catalog" ? 1 : 0;
  const choices = [...options.values()].sort((a, b) => priority(b) - priority(a) || Number(Boolean(b.suggested)) - Number(Boolean(a.suggested)) || a.label.localeCompare(b.label));
  if (!choices.some((option) => option.value === node.value)) choices.unshift({ value: node.value, label: String(node.value), source: "Current value" });
  return {
    source,
    path,
    offset: node.offset,
    length: node.length,
    value: node.value,
    label: String(path.at(-1) === "id" || typeof path.at(-1) === "number" ? path.at(-2) : path.at(-1)),
    options: choices,
    catalog,
    unloadedSource
  };
}
function replaceFieldOption(context, value) {
  if (!context.options.some((option) => option.value === value)) throw new Error("This choice is no longer available.");
  const next = context.source.slice(0, context.offset) + JSON.stringify(value) + context.source.slice(context.offset + context.length);
  const document = JSON.parse(next);
  if (context.path.reduce((current, key) => current?.[key], document) !== value) throw new Error("This field has a duplicate key. Resolve it in the JSON before choosing an option.");
  const result = validatePresentation(document);
  if (!result.valid && validatePresentation(JSON.parse(context.source)).valid) throw new Error(result.errors[0]?.message ?? "This option is not valid here.");
  return next;
}
export {
  getJsonFieldContext,
  replaceFieldOption
};
