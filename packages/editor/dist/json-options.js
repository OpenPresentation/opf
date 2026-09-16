import { catalogKinds, catalogSchemaNames, schemas, validateCatalogRecord, validatePresentation } from "@openpresentation/opf";
import { getCatalogOptions } from "./index.js";
import { schemaAtPath, schemaVariants } from "./schema.js";
import { applyEdits, findNodeAtLocation, findNodeAtOffset, getNodePath, modify, parseTree } from "jsonc-parser";
import { populateLayoutPlaceholders } from "./layout-placeholders.js";
function catalogFor(description) {
    return catalogKinds.find(kind => description.includes(`catalogs.${kind}`)
        || new RegExp(`\\b${kind}['’]? catalog`).test(description));
}
// Compare declared placeholders, including multiplicity. This describes a layout
// contract, not a claim that arbitrary slide content will render without overflow.
function layoutTypes(record) {
    if (!Array.isArray(record?.placeholders))
        return undefined;
    return record.placeholders.map(p => p.type).sort();
}
function placeholderSummary(types) {
    if (!types)
        return "Placeholders not specified";
    if (!types.length)
        return "No placeholders";
    const labels = { title: "Title", subtitle: "Subtitle", text: "Text", metric: "Metric", list: "List", picture: "Image", chart: "Chart", table: "Table", code: "Code", media: "Video", quote: "Quote", timeline: "Timeline", tag: "Tag", diagram: "Image" };
    const order = ["title", "subtitle", "text", "metric", "list", "picture", "chart", "table", "code", "media", "quote", "timeline", "tag", "diagram"];
    return [...new Set(types)].sort((a, b) => order.indexOf(a) - order.indexOf(b)).map(type => {
        const count = types.filter(value => value === type).length;
        return `${labels[type] ?? type}${count > 1 ? ` × ${count}` : ""}`;
    }).join(" + ");
}
const sourceDetails = {
    "Built-in catalog": ["Standard OPF", "Included with OPF and available offline."],
    "Loaded catalog": ["Provided by app", "Additional records supplied to the preview by this app; these are not fetched from a URL."],
    "Document catalog": ["In this document", "Defined in this document’s catalogs. Takes precedence over app and standard records with the same ID."],
    "Current value": ["Custom value", "The current value is not in the available catalogs."],
    "Schema": ["OPF option", "Allowed by the OPF schema."],
};
const layoutGroups = ["Current layout", "Same placeholders", "Compatible placeholders", "Different counts", "Other layouts", "Unspecified placeholders"];
function describeOptions(choices, records, current, catalog) {
    const currentRecord = records.get(String(current));
    const currentTypes = layoutTypes(currentRecord);
    const signature = (types) => JSON.stringify(types);
    const compatible = (types) => types.map(type => type === "subtitle" ? "text" : type).sort();
    for (const option of choices) {
        const [label, description] = sourceDetails[option.source];
        option.sourceLabel = label;
        option.sourceDescription = description;
        if (catalog !== "layouts")
            continue;
        const types = layoutTypes(option.value === current ? currentRecord : records.get(String(option.value)));
        option.placeholderTypes = records.get(String(option.value))?.placeholders?.map(placeholder => placeholder.type);
        option.placeholders = placeholderSummary(types);
        const same = types && currentTypes && signature(types) === signature(currentTypes);
        const equivalent = types && currentTypes && signature(compatible(types)) === signature(compatible(currentTypes));
        const sameKinds = types && currentTypes && signature([...new Set(compatible(types))]) === signature([...new Set(compatible(currentTypes))]);
        option.layoutGroup = option.value === current ? "Current layout" : !types ? "Unspecified placeholders"
            : same ? "Same placeholders" : equivalent ? "Compatible placeholders" : sameKinds ? "Different counts" : "Other layouts";
        option.related = option.value === current || Boolean(same || equivalent);
        option.suggested = Boolean(same || equivalent);
    }
    const priority = (option) => option.source === "Document catalog" ? 2 : option.source === "Loaded catalog" ? 1 : 0;
    return choices.sort((a, b) => (catalog === "layouts"
        ? layoutGroups.indexOf(a.layoutGroup) - layoutGroups.indexOf(b.layoutGroup)
        : priority(b) - priority(a)) || a.label.localeCompare(b.label, "en", { numeric: true }) || String(a.value).localeCompare(String(b.value), "en"));
}
// The installed schema identifies fields; a document field merely named "layout"
// inside arbitrary metadata is not mistaken for an OPF layout reference.
export function getJsonFieldContext(source, position, loadedCatalogs = {}) {
    let document;
    try {
        document = JSON.parse(source);
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
    const schema = schemaAtPath(document, path.map(String));
    const variants = schemaVariants(schema);
    const description = String(schema.description ?? "");
    let catalog = catalogFor(description);
    // Audience arrays inherit the catalog context from the array property.
    if (!catalog && typeof path.at(-1) === "number")
        catalog = catalogFor(String(schemaAtPath(document, path.slice(0, -1).map(String)).description ?? ""));
    const options = new Map();
    const records = new Map();
    let unloadedSource = false;
    if (catalog && typeof node.value === "string") {
        const entries = document.catalogs;
        const local = entries?.[catalog];
        unloadedSource = Boolean(local?.source);
        for (const option of getCatalogOptions(catalog)) {
            records.set(option.id, option.record);
            options.set(option.id, { value: option.id, label: option.label, description: typeof option.record.description === "string" ? option.record.description : undefined,
                source: "Built-in catalog" });
        }
        for (const { value, source } of [...(Array.isArray(loadedCatalogs?.[catalog]) ? loadedCatalogs[catalog] : []).map(value => ({ value, source: "Loaded catalog" })),
            ...(Array.isArray(local?.records) ? local.records : []).map(value => ({ value, source: "Document catalog" }))]) {
            if (!value || typeof value !== "object")
                continue;
            const record = value;
            if (typeof record.id !== "string")
                continue;
            // Inline records may omit the standalone document's $schema marker.
            // Supply it only for validation; never change the authored record.
            const schemaId = schemas[catalogSchemaNames[catalog]].$id;
            if (!validateCatalogRecord(catalog, { $schema: schemaId, ...record }).valid) {
                options.delete(record.id);
                records.delete(record.id);
                continue;
            }
            records.set(record.id, record);
            options.set(record.id, { value: record.id, label: typeof record.name === "string" ? record.name : record.id,
                description: typeof record.description === "string" ? record.description : undefined,
                source });
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
    const document = JSON.parse(next);
    if (context.path.reduce((current, key) => current?.[key], document) !== value)
        throw new Error("This field has a duplicate key. Resolve it in the JSON before choosing an option.");
    const types = context.options.find(option => option.value === value).placeholderTypes;
    if (value !== context.value && types && context.catalog === 'layouts' && context.path.length === 3
        && context.path[0] === 'slides' && context.path[2] === 'layout' && validatePresentation(document).valid) {
        const populated = populateLayoutPlaceholders(document, context.path[1], types);
        next = updateSource(next, document, populated);
    }
    const result = validatePresentation(JSON.parse(next));
    if (!result.valid && validatePresentation(JSON.parse(context.source)).valid)
        throw new Error(result.errors[0]?.message ?? "This option is not valid here.");
    return next;
}

// Keep existing scalar spellings and unrelated source bytes when adding slots.
function updateSource(source, before, after) {
    const indent = source.match(/^[\t ]+(?=\S)/m)?.[0] ?? '  ';
    const formattingOptions = {insertSpaces: !indent.includes('\t'), tabSize: indent.length, eol: source.includes('\r\n') ? '\r\n' : '\n'};
    function visit(a, b, path) {
        if (JSON.stringify(a) === JSON.stringify(b)) return;
        if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
            for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) visit(a[key], b[key], [...path, key]);
        } else if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) {
            b.forEach((value, index) => visit(a[index], value, [...path, index]));
        } else {
            const node = findNodeAtLocation(parseTree(source), path);
            if (node && b !== undefined) source = source.slice(0, node.offset) + JSON.stringify(b) + source.slice(node.offset + node.length);
            else source = applyEdits(source, modify(source, path, b, {formattingOptions}));
        }
    }
    visit(before, after, []);
    return source;
}

/** One source edit so layout changes and new slots share one undo step. */
export function fieldOptionEdit(context, value) {
    const next = replaceFieldOption(context, value), source = context.source;
    let from = 0, to = source.length, end = next.length;
    while (from < to && from < end && source[from] === next[from]) from++;
    while (to > from && end > from && source[to - 1] === next[end - 1]) { to--; end--; }
    return {from, to, insert: next.slice(from, end)};
}
