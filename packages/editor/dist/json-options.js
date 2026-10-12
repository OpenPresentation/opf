import { checkFormat, firstErrorMessage } from "./checks.js";
import { listCatalogRecords } from "./catalogs.js";
import { schemaAtPath, schemaVariants } from "./schema.js";
import { findNodeAtOffset, getNodePath, parseTree } from "jsonc-parser";
import { LAYOUT_INTENT_GROUPS, layoutRegionSummary } from "./layout-templates.js";
// The catalog kind a field references (OPF 0.15: every content kind is `id` or `name:id`), read from where the field sits.
const ROOT_REFERENCES = { narrative: "narratives", audience: "audiences", purpose: "purposes", tone: "tones" };
const DESIGN_REFERENCES = { theme: "themes", colorScheme: "colorSchemes", fontScheme: "fontSchemes" };
function catalogAtPath(path) {
    const parts = path.map(String);
    // A reference's object form names its record with `id`; an audience array's entries are references too.
    const field = parts.at(-1) === "id" ? parts.slice(0, -1) : parts;
    const tail = /^\d+$/.test(field.at(-1) ?? "") && field.at(-2) === "audience" ? field.slice(0, -1) : field;
    const key = tail.at(-1);
    if (tail.length === 3 && tail[0] === "slides" && key === "layout") return "layouts";
    if (tail.length === 1 && ROOT_REFERENCES[key]) return ROOT_REFERENCES[key];
    if (DESIGN_REFERENCES[key] && ((tail.length === 2 && tail[0] === "design") || (tail.length === 4 && tail[0] === "slides" && tail[2] === "design"))) return DESIGN_REFERENCES[key];
    // Inside an embedded record: a theme's colour or font scheme.
    if (tail.length === 5 && tail[0] === "catalogs" && tail[2] === "themes" && (key === "colorScheme" || key === "fontScheme")) return DESIGN_REFERENCES[key];
    return undefined;
}
const sourceDetails = {
    "Loaded catalog": ["Provided by app", "Records from a catalog this app registered; nothing is fetched from a URL. Saving embeds the record in the document."],
    "Document catalog": ["In this document", "Embedded in this document’s catalogs. Takes precedence over the app’s records with the same reference."],
    "Current value": ["Custom value", "The current value is not in the available catalogs."],
    "Schema": ["OPF option", "Allowed by the OPF schema."],
};
const layoutGroups = ["Current layout", ...LAYOUT_INTENT_GROUPS.map(group => group.name), "Custom layouts"];
function describeOptions(choices, records, current, catalog) {
    for (const option of choices) {
        const [label, description] = sourceDetails[option.source];
        option.sourceLabel = label;
        option.sourceDescription = description;
        if (catalog !== "layouts") continue;
        const id = String(option.value).replace(/^default:/, "");
        option.regions = layoutRegionSummary(records.get(String(option.value)));
        option.layoutGroup = option.value === current ? "Current layout" : LAYOUT_INTENT_GROUPS.find(group => group.ids.includes(id))?.name ?? "Custom layouts";
    }
    const priority = option => option.source === "Document catalog" ? 2 : option.source === "Loaded catalog" ? 1 : 0;
    return choices.sort((a, b) => (catalog === "layouts" ? layoutGroups.indexOf(a.layoutGroup) - layoutGroups.indexOf(b.layoutGroup) : priority(b) - priority(a)) || a.label.localeCompare(b.label, "en", {numeric: true}) || String(a.value).localeCompare(String(b.value), "en"));
}
// The installed schema identifies fields; a document field merely named "layout"
// inside arbitrary metadata is not mistaken for an OPF layout reference.
export function getJsonFieldContext(source, position, loadedCatalogs = []) {
    let presentation;
    try {
        presentation = JSON.parse(source);
    }
    catch {
        return null;
    }
    const root = parseTree(source);
    if (!root)
        return null;
    let node = findNodeAtOffset(root, position, true);
    if (node?.parent?.type === "property" && node.parent.children?.[0] === node)
        node = node.parent.children[1];
    if (node?.type === "object")
        node = node.children?.find(property => property.children?.[0]?.value === "id")?.children?.[1];
    if (!node || !["string", "number", "boolean"].includes(node.type))
        return null;
    const path = getNodePath(node);
    if (!path.length)
        return null;
    const schema = schemaAtPath(presentation, path.map(String));
    const variants = schemaVariants(schema);
    const catalog = catalogAtPath(path);
    const options = new Map();
    const records = new Map();
    // A document group whose source no registered catalog matches: its records beyond the embedded ones are not available here.
    const registered = new Set((Array.isArray(loadedCatalogs) ? loadedCatalogs : []).map(entry => entry?.source));
    const unloadedSource = Boolean(catalog) && Object.entries(presentation.catalogs ?? {}).some(([name, group]) => name !== "custom" && group && typeof group === "object" && typeof group.source === "string" && !registered.has(group.source));
    if (catalog && typeof node.value === "string") {
        const hostCatalogs = Array.isArray(loadedCatalogs) ? loadedCatalogs : [];
        // A draft whose own catalogs are malformed still offers the host's records; a malformed host list offers nothing.
        const attempt = (document) => { try { return listCatalogRecords(document, catalog, { catalogs: hostCatalogs }); } catch { return undefined; } };
        const available = attempt(presentation) ?? attempt({ ...presentation, catalogs: undefined }) ?? [];
        for (const option of available) {
            records.set(option.id, option.record);
            options.set(option.id, { value: option.id, label: option.label, description: option.description,
                source: option.origin === "document" ? "Document catalog" : "Loaded catalog" });
        }
    }
    else {
        for (const variant of variants)
            for (const value of variant.enum ?? []) {
                if (["string", "number", "boolean"].includes(typeof value))
                    options.set(JSON.stringify(value), { value, label: String(value), source: "Schema" });
            }
        if (node.type === "boolean" && variants.some(variant => variant.type === "boolean" && variant.const === undefined)) {
            for (const value of [true, false])
                options.set(String(value), { value, label: String(value), source: "Schema" });
        }
    }
    if (!options.size)
        return null;
    const choices = [...options.values()];
    if (!choices.some(option => option.value === node.value))
        choices.unshift({ value: node.value, label: String(node.value), source: "Current value" });
    describeOptions(choices, records, node.value, catalog);
    return { source, path, offset: node.offset, length: node.length, value: node.value,
        label: String(path.at(-1) === "id" || typeof path.at(-1) === "number" ? path.at(-2) : path.at(-1)), options: choices, catalog, unloadedSource };
}
export function replaceFieldOption(context, value) {
    if (!context.options.some(option => option.value === value))
        throw new Error("This choice is no longer available.");
    let next = context.source.slice(0, context.offset) + JSON.stringify(value) + context.source.slice(context.offset + context.length);
    const presentation = JSON.parse(next);
    if (context.path.reduce((current, key) => current?.[key], presentation) !== value)
        throw new Error("This field has a duplicate key. Resolve it in the JSON before choosing an option.");
    const result = checkFormat(JSON.parse(next));
    if (!result.valid && checkFormat(JSON.parse(context.source)).valid)
        throw new Error(firstErrorMessage(result, "This option is not valid here."));
    return next;
}

/** One source edit for an undoable reference change. */
export function fieldOptionEdit(context, value) {
    const next = replaceFieldOption(context, value), source = context.source;
    let from = 0, to = source.length, end = next.length;
    while (from < to && from < end && source[from] === next[from]) from++;
    while (to > from && end > from && source[to - 1] === next[end - 1]) { to--; end--; }
    return {from, to, insert: next.slice(from, end)};
}
