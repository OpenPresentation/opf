import { checkFormat, firstErrorMessage } from "./checks.js";
import { listCatalogRecords } from "./catalogs.js";
import { resolveSchema, schemaAtPath, schemaVariants } from "./schema.js";
import { findNodeAtOffset, getNodePath, parse as parseJsonc, parseTree } from "jsonc-parser";
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
// The choices a field offers, shared by the field menu and live completions: catalog records for a reference field (when the
// value is a string), schema enum values and booleans otherwise.
function fieldOptions(presentation, path, loadedCatalogs, { string, boolean }) {
    const schema = schemaAtPath(presentation, path.map(String));
    const variants = schemaVariants(schema);
    const catalog = catalogAtPath(path);
    const options = new Map();
    const records = new Map();
    // A document group whose source no registered catalog matches: its records beyond the embedded ones are not available here.
    const registered = new Set((Array.isArray(loadedCatalogs) ? loadedCatalogs : []).map(entry => entry?.source));
    const unloadedSource = Boolean(catalog) && Object.entries(presentation.catalogs ?? {}).some(([name, group]) => name !== "custom" && group && typeof group === "object" && typeof group.source === "string" && !registered.has(group.source));
    if (catalog && string) {
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
        if (boolean && variants.some(variant => variant.type === "boolean" && variant.const === undefined)) {
            for (const value of [true, false])
                options.set(String(value), { value, label: String(value), source: "Schema" });
        }
    }
    return { options, records, catalog, unloadedSource };
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
    const { options, records, catalog, unloadedSource } = fieldOptions(presentation, path, loadedCatalogs, { string: typeof node.value === "string", boolean: node.type === "boolean" });
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

// ---- Live completions ----------------------------------------------------------------------------------------------------------
// What the editor offers while you type: the property names the schema allows at the cursor's object, and the same enum, boolean and
// catalog choices the field menu lists at a value. The draft is usually not valid JSON mid-keystroke, so the token under the cursor
// is swapped for a placeholder string and the rest is read with the tolerant parser.
const PLACEHOLDER = "__opf_completion__";
const WORD = /[A-Za-z0-9_.-]/;
// The token being typed: inside a string (a quote opened earlier on this line) or a bare word. JSON strings never span lines.
function tokenAt(text, position, explicit) {
    const lineStart = Math.max(text.lastIndexOf("\n", position - 1), text.lastIndexOf("\r", position - 1)) + 1;
    let open = -1;
    for (let index = lineStart; index < position; index++) {
        if (open >= 0) { if (text[index] === "\\") index++; else if (text[index] === '"') open = -1; }
        else if (text[index] === '"') open = index;
    }
    if (open >= 0) {
        let close = -1;
        for (let index = position; index < text.length && text[index] !== "\n" && text[index] !== "\r"; index++) {
            if (text[index] === "\\") index++;
            else if (text[index] === '"') { close = index; break; }
        }
        return { quoted: true, closed: close >= 0, start: open, end: close >= 0 ? close + 1 : position, from: open + 1, to: close >= 0 ? close : position };
    }
    let start = position, end = position;
    while (start > lineStart && WORD.test(text[start - 1])) start--;
    while (end < text.length && WORD.test(text[end])) end++;
    if (start === position && !explicit) return null;
    let before = start - 1;
    while (before >= lineStart && /\s/.test(text[before])) before--;
    // A bare word starts a key or a value only after `{`, `,`, `:` or `[` (or at the start of an empty line).
    const previous = before >= lineStart ? text[before] : (text.slice(0, lineStart).trimEnd().at(-1) ?? "");
    if (!["{", ",", ":", "["].includes(previous)) return null;
    return { quoted: false, closed: false, start, end, from: start, to: end };
}

// Schema descriptions run to paragraphs; the popup shows the first sentence, at most 200 characters.
function brief(text) {
    if (typeof text !== "string" || !text.trim()) return undefined;
    const flat = text.replace(/\s+/g, " ").trim();
    const sentence = /^.*?[.!?](?=\s|$)/.exec(flat)?.[0] ?? flat;
    return sentence.length <= 200 ? sentence : `${sentence.slice(0, 199).trimEnd()}…`;
}

/**
 * The completions at `position` of a JSON draft (it need not parse): `{ kind: "key" | "value", from, to, quoted, closed, options }`,
 * or null when nothing is offered. `from` and `to` bound the text being typed (inside the quotes of a string); each option is
 * `{ value, label, detail?, info?, boost }`. A key option's `value` is the property name; a value option's is the JSON value.
 * `explicit` also offers choices where nothing has been typed yet.
 */
export function getJsonCompletions(source, position, loadedCatalogs = [], { explicit = false } = {}) {
    const token = tokenAt(source, position, explicit);
    if (!token) return null;
    const draft = source.slice(0, token.start) + JSON.stringify(PLACEHOLDER) + source.slice(token.end);
    const root = parseTree(draft, [], { allowTrailingComma: true });
    if (!root) return null;
    const node = findNodeAtOffset(root, token.start + 1, true);
    if (node?.type !== "string" || node.value !== PLACEHOLDER) return null;
    const presentation = parseJsonc(draft, [], { allowTrailingComma: true });
    if (presentation === null || typeof presentation !== "object" || Array.isArray(presentation)) return null;
    const range = { from: token.from, to: token.to, quoted: token.quoted, closed: token.closed };
    try {
        if (node.parent?.type === "property" && node.parent.children?.[0] === node) {
            const object = node.parent.parent;
            const present = new Set((object?.children ?? []).filter(property => property !== node.parent).map(property => property.children?.[0]?.value));
            const properties = new Map();
            for (const variant of schemaVariants(schemaAtPath(presentation, getNodePath(object).map(String))))
                for (const [key, child] of Object.entries(variant.properties ?? {}))
                    if (!present.has(key) && !properties.has(key)) properties.set(key, { child, required: (variant.required ?? []).includes(key) });
            if (!properties.size) return null;
            const options = [...properties].map(([key, { child, required }], index) => {
                const resolved = resolveSchema(child);
                const type = Array.isArray(resolved.type) ? resolved.type.join(" | ") : resolved.type ?? (resolved.enum ? "enum" : resolved.oneOf || resolved.anyOf ? "choice" : "");
                return { value: key, label: key, detail: type || undefined, info: brief(child.description ?? resolved.description), boost: Math.max(-99, (required ? 50 : 0) - index) };
            });
            return { kind: "key", ...range, options };
        }
        const path = getNodePath(node);
        if (!path.length) return null;
        const { options: found, records, catalog } = fieldOptions(presentation, path, loadedCatalogs, { string: true, boolean: true });
        if (!found.size) return null;
        const choices = describeOptions([...found.values()], records, undefined, catalog);
        const options = choices.map((option, index) => ({
            value: option.value,
            label: String(option.value),
            detail: String(option.label) !== String(option.value) ? String(option.label) : option.sourceLabel,
            info: [brief(option.description), option.regions].filter(Boolean).join("\n") || undefined,
            boost: Math.max(-99, 50 - index),
        }));
        return { kind: "value", ...range, options };
    }
    catch {
        return null;
    }
}
