// Icons (LH-166, OPF 0.32): the `icon` of a list entry, a metric and a group, edited as one undoable step each. An icon is one string:
// "<set>:<name>" (an icon of a registered or embedded set), a bare name from the deck's `icons` map, or an SVG source. Pasting an SVG
// stores it in `icons` under a name and references that name, in the same patch list, so one undo takes both back. The editor bundles no
// icon set: the host registers them as a catalog's `iconSets` (the gallery's are `galleryIconSets` of `@openpresentation/gallery/icon-sets`),
// and search reads whatever is registered. A set icon or an SVG that cannot be drawn is refused with the validator's own finding message
// (`opf/icon-unknown`, `opf/icon-invalid`). Plain JS with no DOM and no Node imports, so it runs in a browser, a Worker or Node.
import { ensureIcons, parseIconReference, resolveIcon, validate } from "@openpresentation/opf";
import { applyJsonPatch, getValueAtPath, opfPathToJsonPointer, splitOpfPath } from "./index.js";
import { checkedDocument, fail } from "./edit-helpers.js";
import { checkFormat } from "./checks.js";
import { mergeCatalogs } from "./catalogs.js";

const INDEX = /^(0|[1-9][0-9]*)$/;
const DECK_NAME = /^[a-z][a-z0-9-]*$/;
const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const refuse = (message, details) => fail("content-action-refused", message, details);

/** What an `icon` can mark: a first-level list entry (`item`), a metric (`metric`) or a group of blocks (`group`). */
export const ICON_TARGETS = Object.freeze(["item", "metric", "group"]);

// --- finding the target ---------------------------------------------------------------------------------------------------------

/**
 * The list entry, metric or group that the path prefix `parts.slice(0, length)` is, as `{ target, path }`, else undefined. `parts` is the whole
 * selection: a metric held inline by a slide or region counts only when the selection goes into its `metric` key, and a group counts only
 * when it is the selection itself (a block inside a group has no icon of the group's).
 */
function targetAt(presentation, parts, length) {
  const at = parts.slice(0, length), value = getValueAtPath(presentation, at);
  if (value === undefined || value === null || typeof value === "number" || typeof value === "boolean") return undefined;
  const last = at.at(-1), before = at.at(-2);
  // A list entry: `items.<n>` of any list (a slide's own, a block's). It is a string, a run array or an object.
  if (before === "items" && INDEX.test(last ?? "")) return { target: "item", path: at.join(".") };
  if (!isObject(value)) return undefined;
  const explicit = before === "blocks" && INDEX.test(last ?? "");
  if (value.metric !== undefined && !Array.isArray(value.blocks) && (explicit || parts[length] === "metric")) return { target: "metric", path: [...at, "metric"].join(".") };
  if (explicit && Array.isArray(value.blocks) && length === parts.length) return { target: "group", path: at.join(".") };
  return undefined;
}

/**
 * The target an icon would go on for a selection: the list entry (`slides.0.blocks.1.items.2.text` gives `slides.0.blocks.1.items.2`), the
 * metric (the block `slides.0.blocks.1`, or a selection inside it, gives `slides.0.blocks.1.metric`) or the group block when it is the
 * selection itself. Returns `{ target, path }`, or undefined for a selection with no icon of its own.
 */
export function iconTargetForSelection(presentation, selectedPath) {
  let parts;
  try {
    parts = splitOpfPath(selectedPath);
  } catch {
    return undefined;
  }
  if (parts[0] !== "slides" || !INDEX.test(parts[1] ?? "") || !presentation?.slides?.[Number(parts[1])]) return undefined;
  for (let length = parts.length; length >= 2; length -= 1) {
    const found = targetAt(presentation, parts, length);
    if (found) return found;
  }
  return undefined;
}

/**
 * The icon state of the target a path points at (a selection works, see `iconTargetForSelection`):
 * `{ target, path, icon, scalar, nested }`. `path` is the entry, the metric's own path or the group block; `icon` is the value written
 * (undefined when there is none); `scalar` is true when the entry is a bare string or run array or the metric a bare value (setting an
 * icon then makes it an object); `nested` is true for an entry below the first level, which icons never mark. Undefined when the path
 * has no icon of its own.
 */
export function readIcon(presentation, path) {
  const found = iconTargetForSelection(presentation, path);
  if (!found) return undefined;
  const value = getValueAtPath(presentation, splitOpfPath(found.path));
  const object = isObject(value);
  return {
    target: found.target,
    path: found.path,
    icon: object && typeof value.icon === "string" ? value.icon : undefined,
    scalar: !object,
    nested: found.target === "item" && object && Number(value.level) > 0,
  };
}

// --- one icon on one target -----------------------------------------------------------------------------------------------------

/** The `icon` patches for a target: the whole entry or metric becomes an object when it was bare, otherwise the key is added, replaced or removed. */
function iconPatches(presentation, found, icon) {
  const parts = splitOpfPath(found.path);
  const value = getValueAtPath(presentation, parts);
  const pointer = opfPathToJsonPointer(parts);
  if (found.scalar) {
    if (icon === null) return [];
    const next = found.target === "metric" ? { value: structuredClone(value), icon } : { text: structuredClone(value), icon };
    return [{ op: "test", path: pointer, value: structuredClone(value) }, { op: "replace", path: pointer, value: next }];
  }
  const at = opfPathToJsonPointer([...parts, "icon"]);
  if (icon === null) return value.icon === undefined ? [] : [{ op: "remove", path: at }];
  if (value.icon === icon) return [];
  return [{ op: value.icon === undefined ? "add" : "replace", path: at, value: icon }];
}

/** Whether any `icon` key in the document still names the deck icon `name`. */
function deckIconUsed(node, name) {
  if (Array.isArray(node)) return node.some((child) => deckIconUsed(child, name));
  if (!isObject(node)) return false;
  return Object.entries(node).some(([key, child]) => (key === "icon" && child === name) || (key !== "icons" && deckIconUsed(child, name)));
}

/** The patches that drop a deck icon nothing references any more (and the `icons` map when it empties), for the document after the others. */
function prunePatches(afterOthers, name) {
  const icons = afterOthers?.icons;
  if (!isObject(icons) || !Object.hasOwn(icons, name) || deckIconUsed({ ...afterOthers, icons: undefined }, name)) return [];
  if (Object.keys(icons).length === 1) return [{ op: "remove", path: "/icons" }];
  return [{ op: "remove", path: opfPathToJsonPointer(["icons", name]) }];
}

const iconPointer = (found) => opfPathToJsonPointer([...splitOpfPath(found.path), "icon"]);

/** The error a finding becomes: its rule id and message, as the validator words them. */
function findingError(finding) {
  return fail(finding.ruleId === "opf/icon-unknown" ? "icon-unknown" : "icon-invalid", finding.message, { ruleId: finding.ruleId, finding });
}

/** Refuse a candidate document whose new icon the validator reports (`opf/icon-invalid`, `opf/icon-unknown`), with the finding's message. */
function checkIcon(candidate, found, catalogs) {
  const report = validate(candidate, { only: ["opf/icon-invalid", "opf/icon-unknown"], ...(catalogs ? { catalogs } : {}) });
  const at = iconPointer(found);
  const finding = report.findings.find((entry) => entry.path === at && (entry.ruleId === "opf/icon-invalid" || entry.ruleId === "opf/icon-unknown"));
  if (finding) throw findingError(finding);
}

function describe(found, extra) {
  return { path: found.path, changed: extra.patches.length > 0, lossless: true, loss: [], target: found.target, ...extra };
}

function requireFound(presentation, path) {
  const found = readIcon(presentation, path);
  if (!found) throw refuse("Choose a list entry, a metric or a group to give it an icon.", { path });
  return found;
}

/**
 * Compute the patch that gives the list entry, metric or group at `path` the icon `icon`, or removes it with `null`. `icon` is what the
 * schema allows: "<set>:<name>" such as "lucide:truck", a name from the deck's `icons`, or an SVG source ("asset:<id>", "./icon.svg", an
 * HTTPS URL, a data:image/svg+xml URI). A bare entry or metric becomes `{ text, icon }` or `{ value, icon }`. An icon the validator would
 * report (an unknown set icon, an SVG that cannot be an icon) is refused with that finding's message (`icon-unknown`, `icon-invalid`); a
 * registered set that has not been loaded yet is not checked, as in validation (`await loadIconSets(editor)` first). Removing the last
 * use of a deck icon also removes it from `icons` unless `options.prune` is false. Entries below the first level take no icon.
 * Options: `catalogs` (the registered catalogs), `prune` (default true), `validate: false` (a dry run that skips the checks).
 * `changed` is false when the target already has that icon.
 */
export function prepareIcon(presentation, path, icon, options = {}) {
  const found = requireFound(presentation, path);
  if (icon !== null && typeof icon !== "string") throw fail("invalid-icon", 'An icon is a string: "<set>:<name>", a name from the deck\'s icons, or an SVG source; null removes it.', { icon });
  const written = icon === null ? null : icon.trim();
  if (written !== null && !parseIconReference(written)) {
    const refused = resolveIcon({}, written);
    throw fail("invalid-icon", refused.ok ? `${JSON.stringify(written)} is not an icon.` : refused.message, { icon });
  }
  if (written !== null && found.nested) throw refuse("Icons mark first-level list entries; this entry is nested, so an icon would not be drawn.", { path: found.path });
  const patches = iconPatches(presentation, found, written);
  const previous = found.icon === undefined ? undefined : parseIconReference(found.icon);
  let candidate = patches.length ? checkedDocument(presentation, patches, checkFormat(presentation)) : presentation;
  if (patches.length && written !== null && options.validate !== false) checkIcon(candidate, found, options.catalogs);
  if (patches.length && options.prune !== false && previous?.kind === "deck" && previous.name !== written) {
    const prune = prunePatches(candidate, previous.name);
    patches.push(...prune);
    if (prune.length) candidate = checkedDocument(presentation, patches, checkFormat(presentation));
  }
  return describe(found, { presentation: candidate, patches, icon: written });
}

function applyPrepared(editor, prepared, meta, source) {
  if (!prepared.changed) return { ...prepared, presentation: editor.presentation, patches: [], inversePatches: [], validation: editor.validation };
  const change = editor.applyPatch(prepared.patches, { ...meta, source: meta.source ?? source, path: prepared.path });
  return { ...change, changed: true, lossless: true, loss: [], path: prepared.path, target: prepared.target, icon: prepared.icon, ...(prepared.name !== undefined ? { name: prepared.name } : {}) };
}
function requireEditor(editor) {
  if (!editor || typeof editor.applyPatch !== "function") throw fail("invalid-editor", "Expected an editor session created by createEditorSession.");
}

/** Give the entry, metric or group at `path` an icon (`null` removes it) as one undoable step; the session's registered catalogs check a set icon. */
export function setIcon(editor, path, icon, meta = {}) {
  requireEditor(editor);
  return applyPrepared(editor, prepareIcon(editor.presentation, path, icon, { catalogs: editor.catalogs, ...(meta.prune === false ? { prune: false } : {}) }), meta, "icon");
}
/** Remove the icon of the entry, metric or group at `path` as one undoable step. */
export const removeIcon = (editor, path, meta = {}) => setIcon(editor, path, null, meta);

// --- pasting an SVG into the deck's icons -----------------------------------------------------------------------------------------

/** A deck icon name from free text: lowercase letters, digits and hyphens, starting with a letter (`"My Logo!"` is `my-logo`). */
export function deckIconName(text, fallback = "icon") {
  const name = String(text ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/^[0-9-]+/, "").slice(0, 40).replace(/-+$/, "");
  return DECK_NAME.test(name) ? name : fallback;
}

/** `name`, or `name-2`, `name-3`, ... the first one the deck's `icons` does not have. */
function freeName(icons, name) {
  if (!isObject(icons) || !Object.hasOwn(icons, name)) return name;
  for (let index = 2; ; index += 1) if (!Object.hasOwn(icons, `${name}-${index}`)) return `${name}-${index}`;
}

/**
 * Compute the patch that puts a pasted SVG into the deck's `icons` under a name and gives the target that name as its icon, in one patch
 * list. The same SVG already in `icons` is reused by its name. `options.name` (default: the SVG's `<title>`, else "icon") is made a valid
 * name; a name the deck already has for a different SVG is refused (`icon-name-taken`) unless `options.replace` is true, and without a
 * name given the next free one (`icon-2`) is taken. An SVG that cannot be an icon (a script, an event handler, an external reference, a
 * raster, no size, text that is not SVG) is refused with the `opf/icon-invalid` finding's message and nothing changes. Returns the prepared
 * change with `name`.
 */
export function prepareSvgIcon(presentation, path, svg, options = {}) {
  const found = requireFound(presentation, path);
  if (typeof svg !== "string" || !svg.trim()) throw fail("icon-invalid", "Paste the SVG text of the icon (it starts with <svg).", { ruleId: "opf/icon-invalid" });
  if (found.nested) throw refuse("Icons mark first-level list entries; this entry is nested, so an icon would not be drawn.", { path: found.path });
  const text = svg.trim();
  const icons = isObject(presentation.icons) ? presentation.icons : undefined;
  const same = icons ? Object.entries(icons).find(([, value]) => typeof value === "string" && value.trim() === text) : undefined;
  const titled = /<title[^>]*>([^<]{1,60})<\/title>/i.exec(text)?.[1];
  const wanted = options.name === undefined || options.name === null || options.name === "" ? undefined : deckIconName(options.name);
  let name = same?.[0];
  if (name === undefined) {
    if (wanted !== undefined && icons && Object.hasOwn(icons, wanted) && options.replace !== true)
      throw fail("icon-name-taken", `The deck already has an icon named ${wanted}. Choose another name, or replace it.`, { name: wanted });
    name = wanted ?? freeName(icons, deckIconName(titled));
  }
  const patches = [];
  if (same === undefined) {
    if (!icons) patches.push({ op: "add", path: "/icons", value: { [name]: text } });
    else patches.push({ op: Object.hasOwn(icons, name) ? "replace" : "add", path: opfPathToJsonPointer(["icons", name]), value: text });
  }
  const withIcons = patches.length ? applyJsonPatch(presentation, patches) : presentation;
  patches.push(...iconPatches(withIcons, found, name));
  const previous = found.icon === undefined ? undefined : parseIconReference(found.icon);
  let candidate = checkedDocument(presentation, patches, checkFormat(presentation));
  if (options.validate !== false) checkIcon(candidate, found, options.catalogs);
  if (options.prune !== false && previous?.kind === "deck" && previous.name !== name) {
    const prune = prunePatches(candidate, previous.name);
    patches.push(...prune);
    if (prune.length) candidate = checkedDocument(presentation, patches, checkFormat(presentation));
  }
  return describe(found, { presentation: candidate, patches, icon: name, name });
}

/** Paste an SVG as the icon of the entry, metric or group at `path`: stored in the deck's `icons` and referenced by name, as one undoable step. */
export function setSvgIcon(editor, path, svg, options = {}, meta = {}) {
  requireEditor(editor);
  return applyPrepared(editor, prepareSvgIcon(editor.presentation, path, svg, { catalogs: editor.catalogs, ...options }), meta, "icon-svg");
}

// --- the icon sets a host registered ----------------------------------------------------------------------------------------------

/** A registered set is its record or a function that loads it (a module whose default export is the record also does). */
const recordOf = (module) => (isObject(module) && isObject(module.default) && !isObject(module.icons) ? module.default : module);
const isRecord = (value) => isObject(value) && isObject(value.icons) && Array.isArray(value.viewBox);
const loading = new WeakMap();

/** The catalogs a call reads: an editor session's registered ones, `options.catalogs`, and the deck's embedded sets. */
function sourceOf(source) {
  const catalogs = mergeCatalogs(Array.isArray(source) ? source : source?.catalogs);
  const presentation = source?.presentation;
  return { catalogs, presentation };
}

/** Every set id with its entry: a loader, a record, and whether the deck embeds a record under that id. */
function setEntries({ catalogs, presentation }) {
  const entries = new Map();
  for (const catalog of catalogs)
    if (isObject(catalog.iconSets)) for (const [id, set] of Object.entries(catalog.iconSets)) if (!entries.has(id) && (typeof set === "function" || isObject(set))) entries.set(id, { id, set, source: catalog.source });
  for (const group of Object.values(isObject(presentation?.catalogs) ? presentation.catalogs : {}))
    if (isObject(group) && isObject(group.iconSets)) for (const [id, set] of Object.entries(group.iconSets)) if (!entries.has(id) && isRecord(set)) entries.set(id, { id, set, source: "document" });
  return entries;
}

/**
 * The icon sets available to a session (or `{ catalogs, presentation }`): the registered catalogs' `iconSets`, then the sets the deck embeds.
 * `[{ id, name, license, copyright, version, icons, loaded, embedded }]`; a set that registers a loader and has not been loaded has only its
 * `id` (and `loaded: false`) until `loadIconSets` resolves.
 */
export function listIconSets(source) {
  return [...setEntries(sourceOf(source)).values()].map(({ id, set, source: origin }) => {
    const record = isRecord(set) ? set : isRecord(loading.get(set)?.record) ? loading.get(set).record : undefined;
    return { id, ...(record ? { name: record.name, license: record.license, copyright: record.copyright, ...(record.version ? { version: record.version } : {}), icons: Object.keys(record.icons).length } : { name: id }), loaded: Boolean(record), embedded: origin === "document" };
  });
}

/**
 * Load the registered icon sets (each registered loader once; the second call is free) and prime core's own registry, so a deck that
 * names a set draws it (`composeSlide`, the renderer and the exporter read what `ensureIcons` loaded). Resolves with the records by id.
 * `ids` limits it to some sets; an id nothing registers is ignored.
 */
export async function loadIconSets(source, ids) {
  const context = sourceOf(source), entries = [...setEntries(context).values()].filter((entry) => ids === undefined || ids.includes(entry.id));
  const records = await Promise.all(entries.map(async ({ id, set }) => {
    if (isRecord(set)) return [id, set];
    if (typeof set !== "function") return [id, undefined];
    let entry = loading.get(set);
    if (!entry) {
      entry = { promise: Promise.resolve().then(set).then(recordOf), record: undefined };
      entry.promise.then((record) => { entry.record = record; }, () => loading.delete(set));
      loading.set(set, entry);
    }
    try {
      return [id, await entry.promise];
    } catch {
      return [id, undefined];
    }
  }));
  const loaded = new Map(records.filter(([, record]) => isRecord(record)));
  if (loaded.size) await ensureIcons({ slides: [{ items: [...loaded.keys()].map((id) => ({ text: id, icon: `${id}:probe` })) }] }, { catalogs: context.catalogs });
  return loaded;
}

/**
 * Search the registered icon sets by name and keyword (the same ranking as the MCP's `search_icons`): every word of `query` must be in the
 * icon's name or tags; a whole name ranks first, then a word of the name, part of it, then a keyword, and the first registered set breaks
 * ties. An empty query lists the sets' icons by name. `options`: `set` (only this set), `limit` (default 40), `offset` (default 0).
 * Loads the sets it reads. Resolves with `{ query, total, returned, icons: [{ icon, set, name, tags }], sets }`.
 */
export async function searchIcons(source, query = "", options = {}) {
  const available = listIconSets(source).map((entry) => entry.id);
  if (options.set !== undefined && !available.includes(options.set)) throw fail("unknown-icon-set", `No icon set ${options.set} is registered${available.length ? ` (sets: ${available.join(", ")})` : ""}.`, { set: options.set });
  const ids = options.set === undefined ? available : [options.set];
  const loaded = await loadIconSets(source, ids);
  const words = String(query).toLowerCase().split(/[\s,]+/).filter(Boolean);
  const found = [];
  for (const [id, record] of loaded) {
    const bonus = id === available[0] ? 0.5 : 0;
    for (const name of Object.keys(record.icons)) {
      const tags = [...(record.tags?.[name] ?? [])];
      const hay = [name, ...tags].join(" ").toLowerCase();
      if (!words.every((word) => hay.includes(word))) continue;
      const score = words.reduce((sum, word) => sum + (name === word ? 8 : name.split("-").includes(word) ? 4 : name.includes(word) ? 2 : 1), 0) - name.length / 100 + bonus;
      found.push({ score, icon: { icon: `${id}:${name}`, set: id, name, tags } });
    }
  }
  found.sort((a, b) => b.score - a.score || a.icon.icon.localeCompare(b.icon.icon));
  const limit = Math.max(1, Math.floor(options.limit ?? 40)), offset = Math.max(0, Math.floor(options.offset ?? 0));
  const icons = found.slice(offset, offset + limit).map((item) => item.icon);
  return {
    query: String(query),
    total: found.length,
    returned: icons.length,
    icons,
    sets: [...loaded].map(([id, record]) => ({ id, name: record.name, license: record.license, copyright: record.copyright, ...(record.version ? { version: record.version } : {}), icons: Object.keys(record.icons).length })),
  };
}

// --- drawing an icon in a picker --------------------------------------------------------------------------------------------------

/**
 * How to draw one icon of a set record in the picker, as plain data (no DOM): `{ viewBox, parts: [{ d, mode }], strokeWidth, linecap,
 * linejoin }` where `mode` is "stroke" or "fill" and `d` the path data. Undefined for a name the record does not have.
 */
export function setIconGlyph(record, name) {
  if (!isRecord(record) || !Object.hasOwn(record.icons, name)) return undefined;
  const icon = record.icons[name];
  const parts = typeof icon === "string"
    ? [{ d: icon, mode: record.style === "fill" ? "fill" : "stroke" }]
    : [...(icon.fill ? [{ d: icon.fill, mode: "fill" }] : []), ...(icon.stroke ? [{ d: icon.stroke, mode: "stroke" }] : [])];
  return { viewBox: record.viewBox.join(" "), parts, strokeWidth: record.strokeWidth ?? 2, linecap: record.strokeLinecap ?? "round", linejoin: record.strokeLinejoin ?? "round" };
}

const num = (value) => String(Math.round(value * 1000) / 1000);
const commandsToPath = (commands) => commands.map(([op, ...args]) => `${op}${args.map(num).join(" ")}`).join("");

/**
 * How to draw the icon an entry, metric or group has, whatever its form: a set's icon, a deck icon or an SVG source core has read. The same
 * plain data as `setIconGlyph` (in a 0 0 24 24 viewBox), or `{ picture: { svg, width, height } }` for a multicolor SVG that keeps its own
 * colors. Undefined when the icon does not resolve (a set that is not loaded yet, an unknown name).
 */
export function iconGlyph(presentation, reference, options = {}) {
  const resolved = resolveIcon(presentation, reference, options.catalogs ? { catalogs: options.catalogs } : {});
  if (!resolved.ok) return undefined;
  const icon = resolved.icon;
  if (icon.picture) return { picture: icon.picture };
  return {
    viewBox: "0 0 24 24",
    parts: icon.parts.map((part) => ({ d: commandsToPath(part.commands), mode: part.fill ? "fill" : "stroke", ...(part.fill && part.evenOdd ? { evenOdd: true } : {}), ...(part.stroke !== undefined ? { strokeWidth: part.stroke, linecap: part.linecap, linejoin: part.linejoin } : {}) })),
    strokeWidth: icon.parts.find((part) => part.stroke !== undefined)?.stroke ?? 2,
    linecap: "round",
    linejoin: "round",
  };
}

/** The deck's own icons, `[{ name, kind }]`: `glyph` (one color, recolorable), `picture` (own colors), `source` (a file or asset not read here) or `invalid`. */
export function deckIcons(presentation, options = {}) {
  const icons = isObject(presentation?.icons) ? presentation.icons : {};
  return Object.keys(icons).sort().map((name) => {
    const resolved = resolveIcon(presentation, name, options.catalogs ? { catalogs: options.catalogs } : {});
    return { name, kind: resolved.ok ? (resolved.icon.picture ? "picture" : "glyph") : resolved.code === "icon-unloaded" ? "source" : "invalid" };
  });
}
