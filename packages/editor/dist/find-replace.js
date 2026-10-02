// Deck-wide find and replace (RR-25): the headless model. `collectSearchFields` lists every piece of text in a
// document (titles, subtitles, tags, text and its runs, list items, quotes, metrics, timelines, table cells, chart
// labels, image alt text, header and footer text, speaker notes); `findMatches` searches them; `planReplace`,
// `replaceMatch` and `replaceAll` build and apply the replacement as one undoable session change.
//
// Matching runs on a field's text. A field is either a plain string or a run array (rich text); the text of a run
// array is its runs joined, so a phrase that crosses a bold/plain boundary is still found. Replacement behaviour:
//   - a match inside one run: only that run's text changes; every run keeps its formatting;
//   - a match that spans several runs: the replacement takes the formatting of the run that holds the FIRST
//     matched character (the Word and Google Docs rule). The matched characters of the later runs are removed and
//     the text before and after the match keeps the formatting it had. A run left empty by the removal is dropped
//     (a field never ends up with no run: its first run stays, empty).
//   - a run written as a plain string stays a plain string when its text is the only thing that changed.
// Fields that are numbers, ids, asset references, URLs, colours and layout names are never searched or changed.
import { OPFEditorError, getValueAtPath, opfPathToJsonPointer } from "./index.js";

/** At most this many matches are collected; `truncated` says so. */
export const MAX_MATCHES = 10000;

const REGION_KEY = /^(?:top|middle|bottom|left|center|right)(?:[+:]|$)/;
const WORD_BEFORE = "(?<![\\p{L}\\p{N}_])";
const WORD_AFTER = "(?![\\p{L}\\p{N}_])";

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const runText = (run) => (typeof run === "string" ? run : isObject(run) && typeof run.text === "string" ? run.text : "");
const isRuns = (value) => Array.isArray(value) && value.length > 0 && value.every((run) => typeof run === "string" || (isObject(run) && typeof run.text === "string"));

/** The plain text of a string or a run array. */
export function textOf(value) {
  return typeof value === "string" ? value : Array.isArray(value) ? value.map(runText).join("") : "";
}

function field(fields, state, segments, value, label, kind = "body") {
  if (typeof value === "string" ? value === "" : !isRuns(value)) return;
  const text = textOf(value);
  if (!text) return;
  fields.push({
    pointer: opfPathToJsonPointer(segments),
    path: segments.join("."),
    slideIndex: state.slideIndex,
    label,
    kind,
    runs: typeof value !== "string",
    text,
  });
}

function textField(fields, state, segments, value, label, kind) {
  if (typeof value === "string" || isRuns(value)) field(fields, state, segments, value, label, kind);
}

function itemFields(fields, state, base, items, noun) {
  if (!Array.isArray(items)) return;
  items.forEach((item, index) => {
    const label = `${noun} ${index + 1}`;
    if (typeof item === "string" || isRuns(item)) textField(fields, state, [...base, String(index)], item, label);
    else if (isObject(item)) textField(fields, state, [...base, String(index), "text"], item.text, label);
  });
}

function cellFields(fields, state, base, cell, label) {
  if (isObject(cell) && "value" in cell) cellFields(fields, state, [...base, "value"], cell.value, label);
  else if (typeof cell === "string" || isRuns(cell)) textField(fields, state, base, cell, label, "table");
}

function payloadFields(fields, state, base, payload, prefix = "") {
  if (!isObject(payload)) return;
  const at = (...rest) => [...base, ...rest];
  textField(fields, state, at("text"), payload.text, `${prefix}Text`);
  itemFields(fields, state, at("items"), payload.items, `${prefix}List item`);
  itemFields(fields, state, at("bullets"), payload.bullets, `${prefix}Bullet`);
  if (typeof payload.code === "string") field(fields, state, at("code"), payload.code, `${prefix}Code`, "code");
  else if (isObject(payload.code)) field(fields, state, at("code", "source"), payload.code.source, `${prefix}Code`, "code");
  if (typeof payload.metric === "string") field(fields, state, at("metric"), payload.metric, `${prefix}Metric`);
  else if (isObject(payload.metric)) {
    for (const key of ["value", "label", "unit", "delta"]) {
      if (typeof payload.metric[key] === "string") field(fields, state, at("metric", key), payload.metric[key], `${prefix}Metric ${key}`);
    }
  }
  if (typeof payload.quote === "string") field(fields, state, at("quote"), payload.quote, `${prefix}Quote`);
  else if (isObject(payload.quote)) {
    field(fields, state, at("quote", "text"), payload.quote.text, `${prefix}Quote`);
    field(fields, state, at("quote", "attribution"), payload.quote.attribution, `${prefix}Quote attribution`);
    field(fields, state, at("quote", "source"), payload.quote.source, `${prefix}Quote source`);
  }
  const timeline = payload.timeline;
  const events = Array.isArray(timeline) ? timeline : isObject(timeline) ? timeline.events : undefined;
  const timelineBase = Array.isArray(timeline) ? at("timeline") : at("timeline", "events");
  if (isObject(timeline)) field(fields, state, at("timeline", "name"), timeline.name, `${prefix}Timeline name`);
  if (Array.isArray(events)) {
    events.forEach((event, index) => {
      if (!isObject(event)) return;
      field(fields, state, [...timelineBase, String(index), "when"], event.when, `${prefix}Timeline event ${index + 1} date`, "timeline");
      field(fields, state, [...timelineBase, String(index), "what"], event.what, `${prefix}Timeline event ${index + 1}`, "timeline");
    });
  }
  const chart = payload.chart;
  if (isObject(chart) && isObject(chart.data)) {
    const { columns, rows } = chart.data;
    if (Array.isArray(columns)) columns.forEach((value, index) => field(fields, state, at("chart", "data", "columns", String(index)), value, `${prefix}Chart label ${index + 1}`, "chart"));
    if (Array.isArray(rows)) rows.forEach((row, r) => Array.isArray(row) && row.forEach((value, c) => {
      if (typeof value === "string") field(fields, state, at("chart", "data", "rows", String(r), String(c)), value, `${prefix}Chart row ${r + 1}, column ${c + 1}`, "chart");
    }));
  }
  const table = payload.table;
  if (isObject(table)) {
    if (Array.isArray(table.columns)) table.columns.forEach((cell, c) => cellFields(fields, state, at("table", "columns", String(c)), cell, `${prefix}Table header ${c + 1}`));
    if (Array.isArray(table.rows)) table.rows.forEach((row, r) => Array.isArray(row) && row.forEach((cell, c) => cellFields(fields, state, at("table", "rows", String(r), String(c)), cell, `${prefix}Table row ${r + 1}, column ${c + 1}`)));
  }
  if (isObject(payload.image)) field(fields, state, at("image", "alt"), payload.image.alt, `${prefix}Image alt text`, "alt");
  if (isObject(payload.video)) field(fields, state, at("video", "alt"), payload.video.alt, `${prefix}Video alt text`, "alt");
  if (Array.isArray(payload.blocks)) payload.blocks.forEach((block, index) => payloadFields(fields, state, at("blocks", String(index)), block, `${prefix}Block ${index + 1} · `));
}

function furnitureFields(fields, state, base, design) {
  if (!isObject(design)) return;
  for (const part of ["header", "footer"]) {
    const zones = design[part];
    if (!isObject(zones)) continue;
    for (const zone of ["left", "center", "right"]) {
      if (isObject(zones[zone])) field(fields, state, [...base, "design", part, zone, "text"], zones[zone].text, `${part === "header" ? "Header" : "Footer"} ${zone}`, "furniture");
    }
  }
}

/**
 * Every searchable text field of a document, in reading order: deck name and description, header and footer text, then
 * each slide's own fields. A field is `{ pointer, path, slideIndex, label, kind, runs, text }`; `slideIndex` is -1 for
 * the deck, `pointer` is the JSON pointer of the string or run array, and `runs` says it is a run array. Options:
 * `notes: false` leaves speaker notes out, `slideIndex` limits the list to one slide.
 */
export function collectSearchFields(document, options = {}) {
  const fields = [];
  if (!isObject(document)) return fields;
  const only = Number.isInteger(options.slideIndex) ? options.slideIndex : undefined;
  if (only === undefined) {
    const deck = { slideIndex: -1 };
    field(fields, deck, ["name"], document.name, "Presentation name", "deck");
    field(fields, deck, ["description"], document.description, "Presentation description", "deck");
    furnitureFields(fields, deck, [], document.design);
  }
  (Array.isArray(document.slides) ? document.slides : []).forEach((slide, slideIndex) => {
    if (only !== undefined && slideIndex !== only) return;
    if (!isObject(slide)) return;
    const state = { slideIndex };
    const base = ["slides", String(slideIndex)];
    field(fields, state, [...base, "title"], slide.title, "Title");
    field(fields, state, [...base, "subtitle"], slide.subtitle, "Subtitle");
    field(fields, state, [...base, "tag"], slide.tag, "Tag");
    field(fields, state, [...base, "section"], slide.section, "Section");
    payloadFields(fields, state, base, slide);
    for (const key of Object.keys(slide)) if (REGION_KEY.test(key) && isObject(slide[key])) payloadFields(fields, state, [...base, key], slide[key], `${key} · `);
    furnitureFields(fields, state, base, slide.design);
    if (options.notes !== false) field(fields, state, [...base, "notes"], slide.notes, "Speaker notes", "notes");
  });
  return fields;
}

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Compile a search into a global RegExp. Options: `matchCase` (default false), `wholeWord` (default false) and `regex`
 * (default false: the query is literal text). Returns `{ regex }`, or `{ error }` with a readable message for an empty
 * query or an invalid regular expression. Whole word means the match is not touched by a letter, digit or underscore.
 */
export function compileSearch(query, options = {}) {
  if (typeof query !== "string" || query === "") return { error: undefined, empty: true };
  let source = options.regex ? query : escapeRegExp(query);
  if (options.wholeWord) source = `${WORD_BEFORE}(?:${source})${WORD_AFTER}`;
  try {
    return { regex: new RegExp(source, `g${options.matchCase ? "" : "i"}mu`) };
  } catch (error) {
    return { error: `Not a valid regular expression: ${String(error.message).replace(/^Invalid regular expression: /, "").replace(/^\/.*\/[a-z]*: /, "")}` };
  }
}

function snippet(text, start, end) {
  const lead = Math.max(0, start - 28);
  const tail = Math.min(text.length, end + 40);
  const clean = (value) => value.replace(/\s+/g, " ");
  return {
    before: (lead > 0 ? "…" : "") + clean(text.slice(lead, start)),
    match: clean(text.slice(start, end)),
    after: clean(text.slice(end, tail)) + (tail < text.length ? "…" : ""),
  };
}

/**
 * Search a document. Returns `{ matches, fieldCount, slideCount, truncated, error }`. A match is `{ id, pointer, path,
 * slideIndex, label, runs, start, end, text, groups, named, context: { before, match, after } }` where `start` and `end`
 * are offsets into the field's text. Options: those of `compileSearch`, plus `notes` and `slideIndex` of
 * `collectSearchFields`. Matches that are empty (a regular expression that matches nothing) are skipped.
 */
export function findMatches(document, query, options = {}) {
  const compiled = compileSearch(query, options);
  const result = { matches: [], fieldCount: 0, slideCount: 0, truncated: false, error: compiled.error };
  if (!compiled.regex) return result;
  const slides = new Set();
  const fields = collectSearchFields(document, options);
  outer: for (const item of fields) {
    compiled.regex.lastIndex = 0;
    let found;
    let hit = false;
    while ((found = compiled.regex.exec(item.text))) {
      if (found[0] === "") {
        compiled.regex.lastIndex += 1;
        continue;
      }
      if (result.matches.length >= MAX_MATCHES) {
        result.truncated = true;
        break outer;
      }
      hit = true;
      result.matches.push({
        id: `${item.pointer}@${found.index}`,
        pointer: item.pointer,
        path: item.path,
        slideIndex: item.slideIndex,
        label: item.label,
        kind: item.kind,
        runs: item.runs,
        start: found.index,
        end: found.index + found[0].length,
        text: found[0],
        groups: found.slice(1).map((group) => group ?? ""),
        named: found.groups ? { ...found.groups } : undefined,
        context: snippet(item.text, found.index, found.index + found[0].length),
      });
    }
    if (hit) {
      result.fieldCount += 1;
      slides.add(item.slideIndex);
    }
  }
  result.slideCount = slides.size;
  return result;
}

/**
 * Expand a replacement for one match. With `regex: true` the template reads `$&` (the match), `$1`..`$99` (groups),
 * `$<name>`, `` $` `` and `$'` (the text before and after the match in its field) and `$$` (a dollar sign); anything
 * else is literal. Without it the replacement is literal text.
 */
export function expandReplacement(template, match, fieldText, regex) {
  if (!regex) return template;
  return template.replace(/\$(\$|&|`|'|\d{1,2}|<[^>]*>)/g, (all, token) => {
    if (token === "$") return "$";
    if (token === "&") return match.text;
    if (token === "`") return fieldText.slice(0, match.start);
    if (token === "'") return fieldText.slice(match.end);
    if (token[0] === "<") return match.named && Object.hasOwn(match.named, token.slice(1, -1)) ? match.named[token.slice(1, -1)] ?? "" : all;
    const index = Number(token);
    if (index >= 1 && index <= match.groups.length) return match.groups[index - 1];
    if (token.length === 2 && Number(token[0]) >= 1 && Number(token[0]) <= match.groups.length) return match.groups[Number(token[0]) - 1] + token[1];
    return all;
  });
}

/**
 * Apply replacements to a string or run array. `edits` is a list of `{ start, end, replacement }` over the field's
 * text, sorted and not overlapping. See the file header for what happens to formatting when a range spans runs.
 */
export function applyTextEdits(value, edits) {
  if (!edits.length) return value;
  if (typeof value === "string") {
    let out = "";
    let cursor = 0;
    for (const edit of edits) {
      out += value.slice(cursor, edit.start) + edit.replacement;
      cursor = edit.end;
    }
    return out + value.slice(cursor);
  }
  const result = [];
  let offset = 0;
  let nextEdit = 0;
  for (const run of value) {
    const original = runText(run);
    const runStart = offset;
    const runEnd = offset + original.length;
    let text = "";
    let cursor = runStart;
    let touched = false;
    // Skip edits that ended before this run began.
    while (nextEdit < edits.length && edits[nextEdit].end <= runStart) nextEdit += 1;
    for (let index = nextEdit; index < edits.length && edits[index].start < runEnd; index += 1) {
      const edit = edits[index];
      if (edit.end <= runStart) continue;
      touched = true;
      const from = Math.max(edit.start, runStart);
      text += original.slice(cursor - runStart, Math.max(from, cursor) - runStart);
      // The edit's replacement belongs to the run that holds its first matched character.
      if (edit.start >= runStart) text += edit.replacement;
      cursor = Math.max(cursor, Math.min(edit.end, runEnd));
    }
    text += original.slice(cursor - runStart);
    offset = runEnd;
    if (!touched) {
      result.push(run);
    } else if (text !== "") {
      result.push(typeof run === "string" ? text : { ...run, text });
    }
  }
  if (!result.length) {
    const first = value[0];
    result.push(typeof first === "string" ? "" : { ...first, text: "" });
  }
  return result;
}

function readField(document, match) {
  const value = getValueAtPath(document, match.pointer);
  return typeof value === "string" || Array.isArray(value) ? value : undefined;
}

/**
 * The patches that replace matches. `matches` is the list to replace (from `findMatches` on this document). Returns
 * `{ patches, count, fieldCount }`; a replacement that leaves a field unchanged adds no patch. Throws `stale-match`
 * when a match no longer reads the same text in the document.
 */
export function planReplace(document, matches, replacement, options = {}) {
  const byField = new Map();
  for (const match of matches) {
    if (!byField.has(match.pointer)) byField.set(match.pointer, []);
    byField.get(match.pointer).push(match);
  }
  const patches = [];
  let count = 0;
  for (const [pointer, list] of byField) {
    const value = readField(document, list[0]);
    const text = value === undefined ? undefined : textOf(value);
    const ordered = [...list].sort((a, b) => a.start - b.start);
    if (text === undefined || ordered.some((match) => text.slice(match.start, match.end) !== match.text)) {
      throw new OPFEditorError("stale-match", "The text changed since this search. Search again.", { path: list[0].path });
    }
    const edits = ordered.map((match) => ({ start: match.start, end: match.end, replacement: expandReplacement(replacement, match, text, options.regex) }));
    const next = applyTextEdits(value, edits);
    count += ordered.length;
    if (JSON.stringify(next) !== JSON.stringify(value)) patches.push({ op: "replace", path: pointer, value: next });
  }
  return { patches, count, fieldCount: byField.size };
}

function search(document, query, options) {
  const found = findMatches(document, query, options);
  if (found.error) throw new OPFEditorError("invalid-search", found.error, {});
  return found;
}

/**
 * Replace every match of a search in one undoable session change. Returns `{ count, fieldCount, change }`; `change` is
 * the session's result (or null when nothing changed). One undo restores every replaced field.
 */
export function replaceAll(editor, query, replacement, options = {}) {
  const found = search(editor.document, query, options);
  const plan = planReplace(editor.document, found.matches, String(replacement ?? ""), options);
  if (!plan.patches.length) return { count: 0, fieldCount: 0, change: null };
  const change = editor.applyPatch(plan.patches, { source: "find-replace", rejectInvalid: true, replaced: plan.count });
  return { count: plan.count, fieldCount: plan.fieldCount, change };
}

/**
 * Replace one match (an element of `findMatches(...).matches`) as one undoable change. The match is found again in the
 * current document first: `stale-match` is thrown when the text changed underneath it.
 */
export function replaceMatch(editor, match, query, replacement, options = {}) {
  const found = search(editor.document, query, options);
  const current = found.matches.find((candidate) => candidate.pointer === match.pointer && candidate.start === match.start && candidate.end === match.end && candidate.text === match.text);
  if (!current) throw new OPFEditorError("stale-match", "That match is no longer in the document. Search again.", { path: match.path });
  const plan = planReplace(editor.document, [current], String(replacement ?? ""), options);
  if (!plan.patches.length) return { count: 0, change: null };
  const change = editor.applyPatch(plan.patches, { source: "find-replace", rejectInvalid: true, replaced: 1 });
  return { count: 1, change };
}
