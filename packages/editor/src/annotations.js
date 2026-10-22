// Footnotes, citations and captions (RR-34). Headless helpers that edit the core fields as one
// validated, undoable session change each: `caption` on image, chart, table and video blocks, the
// deck's `references` list, and `cite` / `footnote` on a text, bullet or list item run. Every
// `prepare*` returns the guarded patches (a test on the edited container plus one replace) and the
// validated candidate without applying them; the matching verb commits through the session so the
// canvas redraws and Undo restores the document. Nothing here invents text or ids: a reference is
// what the caller supplies, and removing a cited reference refuses unless `force` also removes its
// cites. Numbering comes from core (`collectCitations`), so the panel shows what the engines draw.
import { getValueAtPath, opfPathToJsonPointer, splitOpfPath } from "./index.js";
import { checkedDocument, fail } from "./edit-helpers.js";
import { captionSettings, collectCitations, referencesSlide, walkCitationRuns } from "@openpresentation/opf/composition";
import { checkFormat } from "./checks.js";

export const CAPTION_POSITIONS = Object.freeze(["below", "above"]);
export const CAPTION_ALIGNMENTS = Object.freeze(["left", "center", "right"]);
export const CAPTIONABLE_FIELDS = Object.freeze(["image", "chart", "table", "video"]);
// Fields whose runs can carry a marker: the slide heading group (FA-10) plus text, quote text, bullets and items.
const TEXT_FIELDS = ["title", "subtitle", "tag", "text", "bullets", "items"];

const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const clone = (value) => structuredClone(value);
const isRichText = (value) => typeof value === "string" || (Array.isArray(value) && value.every((run) => typeof run === "string" || (isObject(run) && typeof run.text === "string")));

function checkEditor(editor) {
  if (!editor || typeof editor.applyPatch !== "function" || typeof editor.subscribe !== "function") throw fail("invalid-editor", "Expected an editor session created by createEditorSession.");
}
function commit(editor, prepared, meta = {}) {
  const { presentation, patches, ...summary } = prepared;
  void presentation;
  if (!prepared.changed) return { ...summary, presentation: editor.presentation, patches: [], inversePatches: [], validation: editor.validation };
  const change = editor.applyPatch(patches, { ...meta, source: meta.source ?? "annotation", action: prepared.action, path: prepared.path });
  return { ...change, ...summary };
}
// One guarded replace of the container at `parts`; the candidate must validate when the document did.
function transaction(presentation, parts, next, extra) {
  const current = getValueAtPath(presentation, parts);
  const pointer = opfPathToJsonPointer(parts);
  const changed = JSON.stringify(current) !== JSON.stringify(next);
  const patches = changed ? [{ op: "test", path: pointer, value: clone(current) }, { op: "replace", path: pointer, value: clone(next) }] : [];
  const before = checkFormat(presentation);
  const result = changed ? checkedDocument(presentation, patches, before) : presentation;
  return { ...extra, path: parts.join("."), presentation: clone(result), patches, changed };
}

// --- captions -----------------------------------------------------------------------------------

function captionHost(presentation, blockPath) {
  let parts;
  try { parts = splitOpfPath(blockPath); } catch { throw fail("invalid-path", `Invalid block path ${JSON.stringify(blockPath)}.`); }
  const host = getValueAtPath(presentation, parts);
  if (!isObject(host)) throw fail("invalid-path", `No block at ${parts.join(".")}.`);
  if (Array.isArray(host.blocks)) throw fail("caption-unsupported", "A group cannot carry a caption; choose one of its blocks.", { path: parts.join(".") });
  const fields = CAPTIONABLE_FIELDS.filter((field) => host[field] !== undefined);
  if (fields.length !== 1) throw fail("caption-unsupported", fields.length ? "This slide root holds several captionable payloads; put the caption on a block." : "Only an image, chart, table or video payload takes a caption.", { path: parts.join("."), fields });
  return { parts, host, field: fields[0] };
}

/** Normalize a caption value to `{ text, position, align }`, or undefined. */
export function normalizeCaption(value) {
  return captionSettings(value);
}

/** Every block (and one-payload slide root) that can carry a caption, with its current caption. */
export function captionTargets(presentation) {
  const targets = [];
  const visit = (host, path) => {
    if (!isObject(host)) return;
    if (Array.isArray(host.blocks)) { host.blocks.forEach((block, index) => visit(block, `${path}.blocks.${index}`)); return; }
    const fields = CAPTIONABLE_FIELDS.filter((field) => host[field] !== undefined);
    if (fields.length === 1) targets.push({ blockPath: path, field: fields[0], caption: normalizeCaption(host.caption) });
  };
  (presentation?.slides ?? []).forEach((slide, index) => {
    if (!isObject(slide)) return;
    const regions = Object.keys(slide).filter((key) => /^(top|middle|bottom|left|center|right)([+:]|$)/.test(key) && isObject(slide[key])).sort();
    if (regions.length) for (const key of regions) visit(slide[key], `slides.${index}.${key}`);
    else visit(slide, `slides.${index}`);
  });
  return targets;
}

/** The caption of the block at `blockPath` (`{ field, caption }`; `caption` undefined when none). */
export function readCaption(presentation, blockPath) {
  const { host, field } = captionHost(presentation, blockPath);
  return { blockPath: splitOpfPath(blockPath).join("."), field, caption: normalizeCaption(host.caption) };
}

/**
 * Set (a string, TextRun[] or `{ text, position?, align? }`) or remove (`null`) the caption of the
 * block at `blockPath`. A caption at the default position and alignment is stored in its short form.
 */
export function prepareCaption(presentation, blockPath, caption) {
  const { parts, host, field } = captionHost(presentation, blockPath);
  const next = clone(host);
  if (caption === null || caption === undefined) delete next.caption;
  else {
    const settings = normalizeCaption(caption);
    const objectForm = isObject(caption);
    if (!settings || !isRichText(settings.text) || (objectForm && caption.position !== undefined && !CAPTION_POSITIONS.includes(caption.position)) || (objectForm && caption.align !== undefined && !CAPTION_ALIGNMENTS.includes(caption.align)))
      throw fail("invalid-caption", "A caption is a string, TextRun[] or { text, position: below|above, align: left|center|right }.");
    next.caption = settings.position === "below" && settings.align === "left" ? clone(settings.text) : { text: clone(settings.text), position: settings.position, align: settings.align };
  }
  return transaction(presentation, parts, next, { action: "caption", field });
}
export function setCaption(editor, blockPath, caption, meta = {}) {
  checkEditor(editor);
  return commit(editor, prepareCaption(editor.presentation, blockPath, caption), meta);
}

// --- references ---------------------------------------------------------------------------------

function referenceList(presentation) {
  return Array.isArray(presentation?.references) ? presentation.references : [];
}
function checkReference(reference, existing, { allowExisting = false } = {}) {
  if (!isObject(reference) || typeof reference.id !== "string" || !reference.id) throw fail("invalid-reference", "A reference needs a non-empty string id.");
  if (!isRichText(reference.text) || (typeof reference.text === "string" && !reference.text)) throw fail("invalid-reference", "A reference needs text (a string or TextRun[]).", { id: reference.id });
  if (reference.url !== undefined && (typeof reference.url !== "string" || !reference.url)) throw fail("invalid-reference", "A reference url is a non-empty string.", { id: reference.id });
  if (!allowExisting && existing.some((item) => item?.id === reference.id)) throw fail("duplicate-reference", `Reference '${reference.id}' already exists.`, { id: reference.id });
  const result = { id: reference.id, text: clone(reference.text) };
  if (reference.url !== undefined) result.url = reference.url;
  return result;
}

/** The deck's references with their marker numbers and whether a run cites them. */
export function listReferences(presentation) {
  const list = referenceList(presentation);
  const citations = collectCitations(presentation);
  return list.map((reference, index) => {
    const note = citations.references.find((item) => item.id === reference?.id);
    return { index, id: reference?.id, text: reference?.text, url: reference?.url, cited: Boolean(note), ...(note ? { number: note.number } : {}) };
  });
}
/** Append a reference `{ id, text, url? }`; ids must be unique. */
export function prepareReference(presentation, reference) {
  const list = referenceList(presentation);
  const next = [...clone(list), checkReference(reference, list)];
  return transaction(presentation, ["references"], next, { action: "add-reference", id: reference.id });
}
export function addReference(editor, reference, meta = {}) {
  checkEditor(editor);
  return commit(editor, prepareReference(editor.presentation, reference), meta);
}
/** Change the text and/or url of the reference `id` (`url: null` removes the url); the id itself does not change. */
export function prepareReferenceUpdate(presentation, id, fields) {
  const list = referenceList(presentation), index = list.findIndex((item) => item?.id === id);
  if (index < 0) throw fail("unknown-reference", `No reference '${id}'.`, { id });
  const merged = { ...list[index], ...(fields?.text !== undefined ? { text: fields.text } : {}), ...(fields?.url !== undefined ? { url: fields.url } : {}) };
  if (fields?.url === null) delete merged.url;
  const next = clone(list);
  next[index] = checkReference(merged, list, { allowExisting: true });
  return transaction(presentation, ["references"], next, { action: "update-reference", id });
}
export function updateReference(editor, id, fields, meta = {}) {
  checkEditor(editor);
  return commit(editor, prepareReferenceUpdate(editor.presentation, id, fields), meta);
}
/** Remove the reference `id`. Refuses while a run cites it unless `force`, which also removes those cites. */
export function prepareReferenceRemoval(presentation, id, { force = false } = {}) {
  const list = referenceList(presentation), index = list.findIndex((item) => item?.id === id);
  if (index < 0) throw fail("unknown-reference", `No reference '${id}'.`, { id });
  const citing = [];
  (presentation.slides ?? []).forEach((slide, slideIndex) => walkCitationRuns(slide, `slides.${slideIndex}`, (entry) => { if (entry.cite.includes(id)) citing.push(entry.path); }));
  if (citing.length && !force) throw fail("reference-cited", `Reference '${id}' is cited by ${citing.length} run${citing.length === 1 ? "" : "s"}; pass force to remove the citations too.`, { id, runs: citing });
  const next = clone(presentation);
  next.references = list.filter((_, position) => position !== index);
  if (!next.references.length) delete next.references;
  for (const runPath of citing) {
    const { parts, index: runIndex, run } = runAt(next, runPath);
    const runs = getValueAtPath(next, parts);
    runs[runIndex] = withoutCite(run, id);
  }
  const pointer = "";
  const changed = JSON.stringify(presentation) !== JSON.stringify(next);
  const patches = changed ? [{ op: "test", path: pointer, value: clone(presentation) }, { op: "replace", path: pointer, value: clone(next) }] : [];
  const before = checkFormat(presentation);
  const result = changed ? checkedDocument(presentation, patches, before) : presentation;
  return { action: "remove-reference", id, removedCites: citing, path: "references", presentation: clone(result), patches, changed };
}
export function removeReference(editor, id, options = {}, meta = {}) {
  checkEditor(editor);
  return commit(editor, prepareReferenceRemoval(editor.presentation, id, options), meta);
}

// --- citations and footnotes --------------------------------------------------------------------

function withoutCite(run, id) {
  const next = typeof run === "string" ? { text: run } : { ...run };
  const ids = (Array.isArray(next.cite) ? next.cite : next.cite !== undefined ? [next.cite] : []).filter((item) => item !== id);
  if (!ids.length) delete next.cite; else next.cite = ids.length === 1 ? ids[0] : ids;
  return simplifyRun(next);
}
const simplifyRun = (run) => Object.keys(run).length === 1 && typeof run.text === "string" ? run.text : run;

/** The run at `runPath` (`slides.0.text.2`, `slides.0.blocks.1.items.0.text.1`): its run array path, index and value. */
export function runAt(presentation, runPath) {
  let parts;
  try { parts = splitOpfPath(runPath); } catch { throw fail("invalid-path", `Invalid run path ${JSON.stringify(runPath)}.`); }
  if (parts.length < 3 || !/^(0|[1-9]\d*)$/.test(parts[parts.length - 1])) throw fail("invalid-path", `${parts.join(".")} is not a run path.`);
  const arrayParts = parts.slice(0, -1), index = Number(parts[parts.length - 1]);
  const runs = getValueAtPath(presentation, arrayParts);
  const field = [...arrayParts].reverse().find((segment) => TEXT_FIELDS.includes(segment));
  if (!Array.isArray(runs) || !field || !(index in runs)) throw fail("invalid-path", `${parts.join(".")} is not a run of a title, subtitle, tag, text, bullets or items field.`);
  const run = runs[index];
  if (typeof run !== "string" && !(isObject(run) && typeof run.text === "string")) throw fail("invalid-path", `${parts.join(".")} is not a text run.`);
  return { parts: arrayParts, index, run };
}

/** Make the run at `runPath` cite `ids` (a string or array; replaces its current cites). The ids must exist in references. */
export function prepareCite(presentation, runPath, ids) {
  const list = Array.isArray(ids) ? ids : [ids];
  if (!list.length || !list.every((id) => typeof id === "string" && id)) throw fail("invalid-reference", "cite needs one or more reference ids.");
  const known = new Set(referenceList(presentation).map((item) => item?.id));
  const unknown = list.filter((id) => !known.has(id));
  if (unknown.length) throw fail("unknown-reference", `Unknown reference${unknown.length === 1 ? "" : "s"} ${unknown.map((id) => `'${id}'`).join(", ")}; add them with addReference first.`, { ids: unknown });
  const { parts, index, run } = runAt(presentation, runPath);
  const runs = clone(getValueAtPath(presentation, parts));
  const next = typeof run === "string" ? { text: run } : { ...clone(run) };
  if (!next.text) throw fail("invalid-run", "An empty run cannot carry a marker.", { path: runPath });
  const unique = [...new Set(list)];
  next.cite = unique.length === 1 ? unique[0] : unique;
  runs[index] = next;
  return transaction(presentation, parts, runs, { action: "cite", runPath: [...parts, index].join("."), ids: unique });
}
export function citeRun(editor, runPath, ids, meta = {}) {
  checkEditor(editor);
  return commit(editor, prepareCite(editor.presentation, runPath, ids), meta);
}
/** Remove every cite from the run at `runPath`. */
export function prepareUncite(presentation, runPath) {
  const { parts, index, run } = runAt(presentation, runPath);
  const runs = clone(getValueAtPath(presentation, parts));
  const next = typeof run === "string" ? run : { ...clone(run) };
  if (typeof next === "object") delete next.cite;
  runs[index] = typeof next === "object" ? simplifyRun(next) : next;
  return transaction(presentation, parts, runs, { action: "uncite", runPath: [...parts, index].join(".") });
}
export function unciteRun(editor, runPath, meta = {}) {
  checkEditor(editor);
  return commit(editor, prepareUncite(editor.presentation, runPath), meta);
}
/** Set (a string or TextRun[]) or remove (`null`) the inline footnote of the run at `runPath`. */
export function prepareFootnote(presentation, runPath, text) {
  const { parts, index, run } = runAt(presentation, runPath);
  const runs = clone(getValueAtPath(presentation, parts));
  const next = typeof run === "string" ? { text: run } : { ...clone(run) };
  if (text === null || text === undefined) delete next.footnote;
  else {
    if (!isRichText(text) || (typeof text === "string" && !text) || (Array.isArray(text) && !text.length)) throw fail("invalid-footnote", "A footnote is a non-empty string or TextRun[].");
    if (!next.text) throw fail("invalid-run", "An empty run cannot carry a marker.", { path: runPath });
    next.footnote = clone(text);
  }
  runs[index] = simplifyRun(next);
  return transaction(presentation, parts, runs, { action: "footnote", runPath: [...parts, index].join(".") });
}
export function setFootnote(editor, runPath, text, meta = {}) {
  checkEditor(editor);
  return commit(editor, prepareFootnote(editor.presentation, runPath, text), meta);
}

/** The deck numbering the engines draw: notes in number order, cited references, per-slide markers, unused ids. */
export function listCitations(presentation) {
  const citations = collectCitations(presentation);
  return {
    notes: citations.notes.map((note) => ({ ...note })),
    references: citations.references.map((note) => ({ ...note })),
    unused: [...citations.unused],
    slides: [...citations.slides.entries()].map(([slideIndex, slide]) => ({ slideIndex, markers: slide.marked.map((marker) => ({ path: marker.path, text: marker.text, numbers: [...marker.numbers] })), notes: slide.notes.map((note) => note.number) })),
  };
}
/** An ordinary list slide of the cited references (core `referencesSlide`), ready for `prepareBlockInsert` or a slide insert. */
export function referencesSlideFor(presentation, options = {}) {
  return referencesSlide(presentation, options);
}
