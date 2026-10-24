// Go to definition, peek, references and rename (artifacts/source-editor/SPEC.md, section 8.3). Loaded lazily by the code editor on the first use of F12,
// Alt+F12, Shift+F12, F2 or Cmd/Ctrl+click. Each command is `(view, context) => boolean` (true: the key was taken); `context` is what the code editor
// knows: `{ format, catalogs, say, api, options, view, platform, readOnly, pointer }` (see json-editor.js `featureContext`). The reading of the text is
// source-navigation-model.js, the widgets are source-navigation-ui.js; this file joins them and says what happened.
import { layoutRegionSummary } from "./layout-templates.js";
import { NOUNS, analyze, definitionOf, lineAt, lineByNumber, lineCount, referenceList, renameBlocker, renameEdits, slideNumberAt, symbolAt, symbolKey, validateName } from "./source-navigation-model.js";
import { cardPanel, closePanel, peekPanel, referencesPanel, renamePanel, showPanel } from "./source-navigation-ui.js";

const SOURCE_LABEL = "Provided by app";
const PEEK_LINES = 10;

// The part of a line to show: all of it when it is short, else a window around `offset` (a minified deck is one line).
const EXCERPT = 200;
function excerpt(line, offset) {
  if (line.text.length <= EXCERPT) return line.text;
  const at = Math.max(0, offset - line.from);
  const start = Math.max(0, Math.min(at - 60, line.text.length - EXCERPT));
  return `${start > 0 ? "…" : ""}${line.text.slice(start, start + EXCERPT)}${start + EXCERPT < line.text.length ? "…" : ""}`;
}

const labelOf = (symbol) => `${NOUNS[symbol.kind] ?? symbol.kind} ${symbol.id}`;
const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

// The symbol under the caret, read from the text as it is now.
function readCaret(context) {
  const { api, format, catalogs } = context;
  const source = api.getValue();
  const analysis = analyze(source, format, { catalogs });
  const [from, to] = api.getSelection();
  const symbol = symbolAt(analysis, from) ?? (to !== from ? symbolAt(analysis, to) : null);
  return { analysis, symbol, source, offset: from };
}

function wordAt(view, offset) {
  const word = view.state.wordAt(Math.min(offset, view.state.doc.length));
  return word ? view.state.sliceDoc(word.from, word.to) : "";
}

const jump = (context, view, occurrence, message) => {
  closePanel(view, { focus: false });
  context.api.setSelection(occurrence.from, occurrence.to);
  view.focus();
  context.say(message);
};

// The lines of a declaration (the key through the end of its value, up to ten lines) with a line of context on each side.
function peekLines(analysis, definition) {
  const first = lineAt(analysis, definition.from).number, last = lineAt(analysis, Math.max(definition.from, definition.blockTo ?? definition.to)).number;
  const targetEnd = Math.min(last, first + PEEK_LINES - 1);
  const lines = [];
  for (let number = Math.max(1, first - 1); number <= Math.min(lineCount(analysis), targetEnd + 1); number++) {
    const line = lineByNumber(analysis, number);
    lines.push({ number, text: excerpt(line, number === first ? definition.from : line.from), target: number >= first && number <= targetEnd });
  }
  return lines;
}

function recordModel(definition, context) {
  const record = definition.record ?? {};
  const noun = NOUNS[definition.kind] ?? definition.kind;
  const name = typeof record.name === "string" && record.name ? record.name : "";
  const notes = [];
  if (definition.kind === "layouts") { const summary = layoutRegionSummary(record); if (summary) notes.push(`Regions: ${summary}`); }
  if (definition.member) {
    const member = definition.member;
    const description = definition.kind === "region" ? (member.accepts?.length ? `Accepts ${member.accepts.join(", ")}.` : "") : member.description ?? "";
    return { title: definition.id, type: `${noun} of ${definition.reference}`, description: [member.name && definition.kind === "beat" ? member.name : "", description].filter(Boolean).join(". ") || undefined, notes: [SOURCE_LABEL] };
  }
  if (name && name !== definition.id) notes.unshift(name);
  notes.push(SOURCE_LABEL);
  return { title: definition.id, type: noun, description: typeof record.description === "string" ? record.description : undefined, notes };
}

function cardFor(view, context, source, symbol, definition, analysis) {
  const model = recordModel(definition, context);
  const label = labelOf(symbol);
  const close = () => closePanel(view);
  let preview;
  try { preview = context.options?.resolvePreview?.(definition.kind, definition.id); } catch { preview = undefined; }
  showPanel(view, cardPanel({ label, title: `${label} · ${SOURCE_LABEL}`, model, preview, onClose: close }), lineAt(analysis, symbol.from).to, source);
  context.say(`${label} is provided by the app. ${model.description ?? ""}`.trim());
}

// ---- F12 ----------------------------------------------------------------------------------------------------------------------------
/** F12, Cmd/Ctrl+click: jump to where the id under the caret is defined (or open the record's card). */
export function goToDefinition(view, context) {
  const { analysis, symbol, source } = readCaret(context);
  // A click that finds nothing is a plain click.
  const quiet = context.pointer === true;
  if (!symbol) { if (!quiet) context.say(`No definition found${wordAt(view, context.api.getSelection()[0]) ? ` for '${wordAt(view, context.api.getSelection()[0])}'` : ""}`); return true; }
  const definition = definitionOf(analysis, symbol);
  if (!definition) { if (!quiet) context.say(`No definition found for '${symbol.id}'`); return true; }
  if (definition.where === "built-in") { if (!quiet) context.say(`${symbol.id} is a built-in variable; it has no definition in the document`); return true; }
  if (definition.where === "app") { cardFor(view, context, source, symbol, definition, analysis); return true; }
  const target = definition.occurrence;
  // On the declaration itself the key lists the uses, as VS Code does.
  if (target === symbol) { showReferences(view, context, analysis, symbol, source); return true; }
  jump(context, view, target, `Definition of ${labelOf(symbol)}, line ${lineAt(analysis, target.from).number}`);
  return true;
}

// ---- Alt+F12 ------------------------------------------------------------------------------------------------------------------------
/** Alt+F12: show the definition inline. */
export function peekDefinition(view, context) {
  const { analysis, symbol, source } = readCaret(context);
  if (!symbol) { context.say(`No definition found${wordAt(view, context.api.getSelection()[0]) ? ` for '${wordAt(view, context.api.getSelection()[0])}'` : ""}`); return true; }
  const definition = definitionOf(analysis, symbol);
  if (!definition) { context.say(`No definition found for '${symbol.id}'`); return true; }
  if (definition.where === "built-in") { context.say(`${symbol.id} is a built-in variable; it has no definition in the document`); return true; }
  if (definition.where === "app") { cardFor(view, context, source, symbol, definition, analysis); return true; }
  const target = definition.occurrence;
  if (target === symbol) { showReferences(view, context, analysis, symbol, source); return true; }
  const label = labelOf(symbol), line = lineAt(analysis, target.from).number;
  const close = () => closePanel(view);
  showPanel(view, peekPanel({
    label, title: label, where: `Line ${line}`, lines: peekLines(analysis, target),
    onGo: () => jump(context, view, target, `Definition of ${label}, line ${line}`),
    onClose: close,
  }), lineAt(analysis, symbol.from).to, source);
  context.say(`Peek definition of ${label}, line ${line}. Enter goes to it, Escape closes.`);
  return true;
}

// ---- Shift+F12 ----------------------------------------------------------------------------------------------------------------------
function showReferences(view, context, analysis, symbol, source) {
  const list = referenceList(analysis, symbol);
  const label = labelOf(symbol);
  const rows = list.map((occurrence) => {
    const line = lineAt(analysis, occurrence.from);
    return { number: line.number, slide: slideNumberAt(analysis, occurrence.from), text: excerpt(line, occurrence.from), declaration: occurrence.role === "def" };
  });
  const count = plural(list.length, "reference");
  const close = () => closePanel(view);
  showPanel(view, referencesPanel({
    label, title: `${count} to ${label}`, rows,
    onPick: (index) => jump(context, view, list[index], `${label}, ${list[index].role === "def" ? "declaration" : "reference"} at line ${rows[index].number}`),
    onClose: close,
  }), lineAt(analysis, symbol.from).to, source);
  context.say(`${count} to ${label}`);
}

/** Shift+F12: list the places that use the id under the caret. */
export function findReferences(view, context) {
  const { analysis, symbol, source } = readCaret(context);
  if (!symbol) { context.say("No references found"); return true; }
  showReferences(view, context, analysis, symbol, source);
  return true;
}

// ---- F2 -----------------------------------------------------------------------------------------------------------------------------
/** F2: rename the id under the caret in its definition and every reference, as one undo step. */
export function renameSymbol(view, context) {
  const { analysis, symbol, source } = readCaret(context);
  if (!symbol) { context.say(context.readOnly ? "Cannot rename: the editor is read-only" : "Cannot rename: there is no id at the caret"); return true; }
  const blocker = renameBlocker(analysis, symbol, { readOnly: view.state.readOnly });
  if (blocker) { context.say(blocker); return true; }
  const label = labelOf(symbol), key = symbolKey(symbol);
  const close = () => closePanel(view);
  const apply = (name) => {
    // Read the text again: the author may have typed since the input opened.
    const now = analyze(context.api.getValue(), context.format, { catalogs: context.catalogs });
    // The occurrence the caret was on (the nearest one of the symbol, when the text moved).
    const same = now.occurrences.filter((occurrence) => symbolKey(occurrence) === key);
    const current = same.reduce((best, occurrence) => (!best || Math.abs(occurrence.from - symbol.from) < Math.abs(best.from - symbol.from) ? occurrence : best), null);
    if (!current) { close(); context.say(`Rename cancelled: ${label} is no longer in the text`); return; }
    const problem = validateName(now, current, name);
    if (problem) { context.say(problem); return; }
    const result = renameEdits(now, current, name);
    closePanel(view, { focus: false });
    if (!result) { view.focus(); context.say(`${label} keeps its name`); return; }
    // The selection goes to the same occurrence it was on when the input opened.
    const places = result.edits.length;
    context.api.applyEdits(result.edits, { select: result.caret, userEvent: "input.rename" });
    view.focus();
    context.say(`Renamed ${label} to ${name} in ${plural(places, "place")}`);
  };
  showPanel(view, renamePanel({
    label, current: symbol.id, validate: (name) => validateName(analysis, symbol, name),
    onSubmit: apply, onClose: close, say: context.say,
  }), lineAt(analysis, symbol.from).to, source);
  context.say(`Rename ${label}. Type the new name and press Enter, or Escape to cancel.`);
  return true;
}
