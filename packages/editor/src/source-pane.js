import { parse as parseJsonc, printParseErrorCode } from "jsonc-parser";
import { fromYaml, scanYamlComments, toYaml } from "@openpresentation/opf/yaml";
import { fromMarkdown, toMarkdown } from "@openpresentation/opf/markdown";
import { mountJsonCodeEditor } from "./json-editor.js";
import { MAX_EXACT_SOURCE_LENGTH, createSourceMemory, findDuplicateKey, updateJsonSource } from "./exact-source.js";
import { lineForPath, lineOfOffset, offsetOfLine } from "./source-lines.js";
import { errorText, normalizeFinding, rejectionFindings as findingsOfError } from "./source-findings.js";

// The source pane (RR-98): the OPF document as JSON, YAML or Markdown, with the file name, the format menu, Format, Copy
// and Download, and the findings under the code. JSON is canonical and keeps its authored bytes (exact-source); YAML and
// Markdown are written and read by core's converters. Every edit, in any format, reaches the document through the editor
// session as a patch, so it is validated and undoable like any other edit. Plain DOM; no network; the host owns storage.

const FORMATS = [
  { id: "json", label: "JSON", extension: "json", description: "The canonical OPF document.", mime: "application/json", language: "json" },
  { id: "yaml", label: "YAML", extension: "yaml", description: "Same fields, less punctuation.", mime: "text/yaml", language: "yaml" },
  { id: "md", label: "Markdown", extension: "md", description: "Settings up top, one heading per slide.", mime: "text/markdown", language: "markdown" },
];
const formatOf = (id) => FORMATS.find((format) => format.id === id) ?? FORMATS[0];

// Lucide icons (ISC license), as path data.
const ICONS = {
  Braces: '<path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1"/><path d="M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1"/>',
  Copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  Download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
  ChevronDown: '<path d="m6 9 6 6 6-6"/>',
  Check: '<path d="M20 6 9 17l-5-5"/>',
  CircleX: '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
  Info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
};
function icon(name, size = 14) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.setAttribute("class", `opf-source-icon opf-source-icon-${name.toLowerCase()}`);
  svg.innerHTML = ICONS[name];
  return svg;
}

let counter = 0;
const el = (tag, className, attributes = {}) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  for (const [key, value] of Object.entries(attributes)) if (value !== undefined) node.setAttribute(key, value);
  return node;
};
const pointer = (segments) => segments.map((part) => `/${String(part).replaceAll("~", "~0").replaceAll("/", "~1")}`).join("");
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
function same(a, b) {
  if (a === b) return true;
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((item, index) => same(item, b[index]));
  if (isObject(a)) {
    if (!isObject(b)) return false;
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every((key) => Object.hasOwn(b, key) && same(a[key], b[key]));
  }
  return false;
}
const SEVERITY = { error: 0, warning: 1, info: 2 };
const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

const JSON_ERRORS = { InvalidSymbol: "Invalid symbol", InvalidNumberFormat: "Invalid number", PropertyNameExpected: "Property name expected", ValueExpected: "Value expected", ColonExpected: "Colon expected", CommaExpected: "Comma expected", CloseBraceExpected: "Closing brace expected", CloseBracketExpected: "Closing bracket expected", EndOfFileExpected: "End of file expected", InvalidCommentToken: "Comments are not allowed in JSON", UnexpectedEndOfComment: "Unexpected end of comment", UnexpectedEndOfString: "Unexpected end of string", UnexpectedEndOfNumber: "Unexpected end of number", InvalidUnicode: "Invalid unicode escape", InvalidEscapeCharacter: "Invalid escape character", InvalidCharacter: "Invalid character" };

/** Read the text of one format. `{ deck }` on success; `findings` carry the syntax errors (`syntax: true`) or the OPF findings of the parsed deck. */
function readText(format, text, catalogs) {
  if (format === "json") {
    try {
      const deck = JSON.parse(text);
      if (!isObject(deck)) return { syntax: true, findings: [normalizeFinding({ message: "An OPF document is a JSON object.", line: 1 }, "syntax")] };
      const duplicate = findDuplicateKey(text);
      if (duplicate) {
        const path = pointer([...duplicate.path, duplicate.key]);
        return { syntax: true, findings: [normalizeFinding({ path, message: `Duplicate key "${duplicate.key}". Remove the repeated key.` }, "syntax")] };
      }
      return { deck, findings: [] };
    } catch (error) {
      const errors = [];
      parseJsonc(text, errors, { allowTrailingComma: false, disallowComments: true });
      const first = errors[0];
      const message = first ? `${JSON_ERRORS[printParseErrorCode(first.error)] ?? printParseErrorCode(first.error)}.` : `${error.message}.`;
      return { syntax: true, findings: [normalizeFinding({ message, line: first ? lineOfOffset(text, first.offset) : 1 }, "syntax")] };
    }
  }
  const result = format === "yaml" ? (fromYaml(text, { catalogs })) : fromMarkdown(text, { catalogs });
  const syntax = result.findings.filter((finding) => !finding.ruleId?.startsWith("opf/"));
  if (syntax.length) return { syntax: true, findings: syntax.map((finding) => normalizeFinding(finding, "syntax")) };
  return { deck: result.presentation, findings: result.findings.map((finding) => normalizeFinding(finding, "schema")) };
}

/**
 * Mount the source pane in `container`.
 *
 * @param {HTMLElement} container
 * @param {object} options see `source-pane.d.ts`
 */
export function createSourcePane(container, options = {}) {
  const editor = options.editor;
  if (!editor || typeof editor.applyPatch !== "function" || typeof editor.subscribe !== "function") throw new TypeError("createSourcePane needs an editor session (options.editor).");
  const id = `opf-source-${++counter}`;
  const memory = createSourceMemory();
  const delay = Math.max(0, options.applyDelay ?? 250);
  let name = sanitizeName(options.name ?? "deck");
  let format = formatOf(options.format).id;
  let density = options.density === "touch" ? "touch" : "comfortable";
  let readOnly = Boolean(options.readOnly);
  let hostFindings = Array.isArray(options.findings) ? options.findings : null;
  let version = 0;
  let applying = false;
  let destroyed = false;
  let timer = null;
  let jsonText = null;
  let baseline = "";
  let dirty = false;
  const drafts = {};
  let syntaxFindings = [], rejectionFindings = [], noteFindings = [], transientNotes = [];
  let collapsed = false;
  let copyTimer = null;
  let renderedKey = "";
  // Whether the findings include an error, and what the editor's `aria-invalid` currently says (null: not yet set).
  let invalid = false, shownInvalid = null;
  const lineCache = { key: "", values: new Map() };
  // The exact text of the documents `replaceDocument` replaced and opened, per format, so Undo and Redo show it again byte for byte
  // (a YAML comment, the author's JSON spelling). Keyed by format and document; the oldest entries go first.
  const exactTexts = new Map();
  const rememberText = (target, value, text) => {
    if (typeof text !== "string" || text.length > MAX_EXACT_SOURCE_LENGTH) return;
    const key = `${target}|${JSON.stringify(value)}`;
    exactTexts.delete(key);
    exactTexts.set(key, text);
    while (exactTexts.size > 8) exactTexts.delete(exactTexts.keys().next().value);
  };
  const exactText = (target, value) => exactTexts.get(`${target}|${JSON.stringify(value)}`);

  // ---- DOM ----------------------------------------------------------------------------------------------------------
  const root = el("div", "opf-source opf-ui", { "data-density": density });
  const bar = el("div", "opf-source-bar");
  const file = el("div", "opf-source-file");
  const nameButton = el("button", "opf-source-name", { type: "button", title: "Rename" });
  const nameInput = el("input", "opf-source-name-input", { type: "text", "aria-label": "File name", spellcheck: "false", autocomplete: "off", hidden: "" });
  const formatButton = el("button", "opf-source-format", { type: "button", "aria-label": "Source format", "aria-haspopup": "menu", "aria-expanded": "false", "aria-controls": `${id}-menu` });
  const formatLabel = el("span", "opf-source-format-label");
  formatButton.append(formatLabel, icon("ChevronDown", 12));
  const menu = el("div", "opf-source-menu", { role: "menu", id: `${id}-menu`, "aria-label": "Source format", hidden: "" });
  menu.append(Object.assign(el("div", "opf-source-menu-heading", { "aria-hidden": "true" }), { textContent: "Source format" }));
  const menuItems = FORMATS.map((entry) => {
    const item = el("button", "opf-source-menu-item", { type: "button", role: "menuitemradio", "aria-checked": "false", tabindex: "-1", "data-format": entry.id });
    const check = el("span", "opf-source-menu-check");
    check.append(icon("Check", 14));
    const body = el("span", "opf-source-menu-body");
    body.append(Object.assign(el("span", "opf-source-menu-label"), { textContent: entry.label }), Object.assign(el("span", "opf-source-menu-description"), { textContent: entry.description }));
    item.append(check, body, Object.assign(el("span", "opf-source-menu-extension"), { textContent: `.opf.${entry.extension}` }));
    menu.append(item);
    return item;
  });
  file.append(nameButton, nameInput, formatButton, menu);

  const actions = el("div", "opf-source-actions");
  const actionButton = (label, glyph, key) => {
    const button = el("button", `opf-source-action opf-source-action-${key}`, { type: "button", "aria-label": label, title: label });
    button.append(icon(glyph, 14));
    actions.append(button);
    return button;
  };
  const formatAction = actionButton("Format (fix indentation)", "Braces", "format");
  const copyAction = actionButton("Copy source", "Copy", "copy");
  const downloadAction = actionButton("Download source", "Download", "download");
  bar.append(file, actions);

  const code = el("div", "opf-source-code");
  const status = el("div", "opf-source-status", { role: "status", "aria-live": "polite" });

  const findingsRegion = el("section", "opf-source-findings", { "aria-label": "Source findings", hidden: "" });
  const toggle = el("button", "opf-source-findings-toggle", { type: "button", "aria-expanded": "true", "aria-controls": `${id}-findings` });
  const toggleIcon = el("span", "opf-source-findings-icon");
  const toggleText = el("span", "opf-source-findings-count");
  toggle.append(toggleIcon, toggleText, icon("ChevronDown", 14));
  const list = el("ul", "opf-source-findings-list", { id: `${id}-findings` });
  findingsRegion.append(toggle, list);

  root.append(bar, code, findingsRegion, status);
  container.append(root);

  // ---- Document <-> text --------------------------------------------------------------------------------------------
  const deck = () => editor.presentation;
  const prettyJson = (value) => JSON.stringify(value, null, 2);
  function syncJson(value) {
    try { jsonText = updateJsonSource(jsonText ?? prettyJson(value), value, memory); }
    catch { jsonText = prettyJson(value); }
    return jsonText;
  }
  function write(target, value) {
    if (target === "json") return { text: syncJson(value), notes: [] };
    if (target === "yaml") return { text: toYaml(value).yaml, notes: [] };
    const result = toMarkdown(value);
    return { text: result.markdown, notes: markdownNotes(result.report) };
  }
  function markdownNotes(report) {
    const notes = report.embedded.map((part) => normalizeFinding({ path: part.path, message: `Markdown has no syntax for this, so it is kept as YAML in a fenced block (${part.reason}).`, severity: "warning" }, "format"));
    for (const entry of report.loss) {
      const at = entry.indexOf(": ");
      notes.push(normalizeFinding({ path: at > 0 ? entry.slice(0, at) : "", message: `Left out of the Markdown: ${at > 0 ? entry.slice(at + 2) : entry}.`, severity: "warning" }, "format"));
    }
    return notes;
  }

  if (typeof options.source === "string") {
    try { if (same(JSON.parse(options.source), deck())) jsonText = options.source; } catch { /* Use the session's document. */ }
  }
  syncJson(deck());
  let initial;
  {
    let first;
    try { first = write(format, deck()); }
    catch { format = "json"; first = write("json", deck()); }
    initial = first.text;
    baseline = first.text;
    noteFindings = first.notes;
  }

  const catalogs = () => editor.catalogs ?? options.catalogs;
  const control = mountJsonCodeEditor(code, {
    code: initial,
    label: options.label ?? "OPF source",
    lineNumbers: true,
    language: formatOf(format).language,
    readOnly,
    completions: options.completions !== false,
    catalogs: options.catalogs ?? editor.catalogs,
    describedBy: `${id}-findings`,
    onChange: () => schedule(),
    historyFallback: { undo: () => stepReplace("undo"), redo: () => stepReplace("redo") },
    onError: (error) => options.onError?.(error),
  });

  // ---- Applying edits -----------------------------------------------------------------------------------------------
  function schedule() {
    clearTimeout(timer);
    if (delay === 0) { flush(); return; }
    timer = setTimeout(flush, delay);
  }
  /** Apply any edit still waiting for its delay. */
  function flush() {
    clearTimeout(timer);
    timer = null;
    if (destroyed || control.api.getValue() === baseline) return;
    applyEdit();
  }

  function applyEdit() {
    const source = control.api.getValue();
    transientNotes = [];
    const read = readText(format, source, catalogs());
    rejectionFindings = [];
    if (!read.deck) {
      syntaxFindings = read.findings;
      dirty = true;
      baseline = source;
      renderFindings();
      return;
    }
    syntaxFindings = [];
    baseline = source;
    const before = deck();
    if (!same(read.deck, before)) {
      applying = true;
      try {
        // Remember the spelling of the document being replaced so Undo restores it exactly, then keep what was typed.
        syncJson(before);
        editor.applyPatch([{ op: "replace", path: "", value: read.deck }], { source: "source-pane", format });
      } catch (error) {
        dirty = true;
        // Every issue of the refusal is its own finding, with its path; a format's own findings stand in when the error names none.
        rejectionFindings = error?.issues?.length || !read.findings.length ? findingsOfError(error) : read.findings.map((finding) => ({ ...finding, kind: "rejected" }));
        applying = false;
        renderFindings();
        return;
      } finally { applying = false; }
      version++;
    }
    dirty = false;
    if (format === "json") jsonText = source;
    else syncJson(deck());
    if (format === "md") refreshNotes();
    renderFindings();
    syncAttributes();
  }
  function refreshNotes() {
    try { noteFindings = markdownNotes(toMarkdown(deck()).report); } catch { noteFindings = []; }
  }
  /** `aria-invalid` follows the findings: set while any finding is an error (syntax, a refused draft, the session's or the host's), cleared with them. */
  function syncAttributes() {
    shownInvalid = invalid;
    control.update(control.api.getValue(), invalid, null, `${id}-findings`);
  }

  /** Show `value` as the text of the current format, as an external change. */
  function show(value) {
    baseline = value;
    shownInvalid = false;
    control.update(value, false, null, `${id}-findings`);
  }
  function fromSession(notice) {
    clearTimeout(timer);
    timer = null;
    for (const key of Object.keys(drafts)) delete drafts[key];
    syntaxFindings = [];
    rejectionFindings = [];
    transientNotes = [];
    dirty = false;
    let written;
    try { written = write(format, deck()); }
    catch (error) {
      syncJsonSafe();
      rejectionFindings = [normalizeFinding({ message: `The document cannot be written as ${formatOf(format).label}: ${errorText(error)}. The text below is the last version that could be.`, kind: "rejected" })];
      renderFindings();
      return;
    }
    if (format === "yaml" && notice !== false) {
      const before = control.api.getValue(), comments = scanYamlComments(before).count;
      if (comments > 0 && written.text !== before) transientNotes = [normalizeFinding({ message: `${plural(comments, "comment")} in the YAML ${comments === 1 ? "was" : "were"} dropped when the document changed outside the source.`, severity: "warning" }, "format")];
    }
    // A document `replaceDocument` opened or replaced comes back with the exact text it had.
    written = preferExact(format, deck(), written);
    noteFindings = written.notes;
    if (format !== "json") syncJsonSafe();
    if (written.text !== control.api.getValue()) show(written.text);
    else baseline = written.text;
    renderFindings();
    syncAttributes();
  }
  /** The remembered text of `value` in `target` (what `replaceDocument` was given or replaced) when it still reads as `value`; else `written`. */
  function preferExact(target, value, written) {
    const exact = exactText(target, value);
    if (exact === undefined || exact === written.text) return written;
    try {
      if (!same(readText(target, exact, catalogs()).deck, value)) return written;
    } catch { return written; }
    if (target === "json") jsonText = exact;
    return { ...written, text: exact };
  }
  function syncJsonSafe() { try { syncJson(deck()); } catch { /* Keep the last JSON. */ } }

  const unsubscribe = editor.subscribe((event) => {
    if (destroyed) return;
    if (event.type === "catalogs") { control.setCatalogs(options.catalogs ?? editor.catalogs); renderFindings(); return; }
    if (applying) return;
    version++;
    // Undo, Redo, a restore and a whole-document replace by the host move the text under the typed edits CodeMirror remembers; they
    // would no longer fit it.
    if (event.type === "undo" || event.type === "redo" || event.type === "restore" || event.meta?.replaceDocument) control.resetHistory();
    fromSession();
  });

  // ---- Replacing the whole document ----------------------------------------------------------------------------------
  /**
   * Which format the text is, among those that read as exactly `opened`: the declared `format` (which must read so), else JSON first
   * (the form `replaceDocument` always took), then the pane's own format, then the others. Null when none reads as the document.
   */
  function sourceFormatOf(text, opened, declared) {
    const order = declared ? [declared] : [...new Set(["json", format, "yaml", "md"])];
    for (const candidate of order) {
      try {
        const read = readText(candidate, text, catalogs());
        if (read.deck && same(read.deck, opened)) return candidate;
      } catch { /* Not this format. */ }
    }
    return null;
  }
  /**
   * Open `input` (a document, or JSON text) as the whole document with `editor.replaceDocument`: one undoable change, no catalog record
   * forked. The text shown is the original text of the document when `source` (or `input`, when it is JSON text) is that text in the
   * pane's format, and the document written by core's converter otherwise. The original text of any format is kept for the pane's other
   * formats and for Undo and Redo, which bring each document's text back exactly.
   */
  function replaceDocument(input, replaceOptions = {}) {
    if (destroyed) throw new Error("The source pane was destroyed.");
    if (replaceOptions.format !== undefined && !FORMATS.some((entry) => entry.id === replaceOptions.format)) throw new TypeError(`replaceDocument: format must be "json", "yaml" or "md", not ${JSON.stringify(replaceOptions.format)}.`);
    flush();
    const before = deck();
    const beforeText = dirty ? undefined : control.api.getValue();
    transientNotes = [];
    let change;
    applying = true;
    try {
      // Remember the spelling of the document being replaced, then open the new one.
      syncJson(before);
      change = editor.replaceDocument(input, { format, ...replaceOptions.meta });
    } catch (error) {
      rejectionFindings = error?.issues?.length ? findingsOfError(error) : [normalizeFinding({ message: errorText(error), kind: "rejected" })];
      renderFindings();
      throw error;
    } finally { applying = false; }
    clearTimeout(timer);
    timer = null;
    for (const key of Object.keys(drafts)) delete drafts[key];
    syntaxFindings = [];
    rejectionFindings = [];
    dirty = false;
    version++;
    // The typed edits CodeMirror remembers belong to the document that was replaced.
    control.resetHistory();
    const opened = deck();
    // The original text: JSON text given as `input` is that document's JSON; `source` is its text in `format` (inferred when not given).
    let authoredJson = null;
    const originals = [];
    if (typeof input === "string") originals.push({ text: input, format: "json" });
    if (typeof replaceOptions.source === "string" && (typeof input !== "string" || replaceOptions.format)) originals.push({ text: replaceOptions.source, format: replaceOptions.format });
    for (const original of originals) {
      const kind = sourceFormatOf(original.text, opened, original.format);
      if (kind === "json") authoredJson ??= original.text;
      else if (kind) rememberText(kind, opened, original.text);
    }
    if (replaceOptions.name !== undefined) { name = sanitizeName(replaceOptions.name) || "deck"; updateBar(); }
    let written;
    try { written = format === "json" && authoredJson !== null ? { text: authoredJson, notes: [] } : write(format, opened); }
    catch (error) {
      syncJsonSafe();
      rejectionFindings = [normalizeFinding({ message: `The document cannot be written as ${formatOf(format).label}: ${errorText(error)}. The text below is the last version that could be.`, kind: "rejected" })];
      renderFindings();
      return change;
    }
    if (authoredJson !== null) jsonText = authoredJson; else syncJsonSafe();
    // The text shown now is what Undo and Redo bring back for this document, in the format shown.
    if (!(format === "json" && authoredJson !== null)) written = preferExact(format, opened, written);
    rememberText(format, opened, written.text);
    rememberText(format, before, beforeText);
    noteFindings = written.notes;
    if (written.text !== control.api.getValue()) show(written.text); else baseline = written.text;
    renderedKey = "";
    renderFindings();
    syncAttributes();
    return change;
  }

  /**
   * Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z (Ctrl+Y) after CodeMirror's own history has nothing left: step the session over a whole-document
   * replace, as its Undo and Redo buttons do, so the text comes back exactly. Undo steps back over the nearest `replaceDocument` together
   * with the pane's own edits typed on it (CodeMirror already undid the typing); an edit made elsewhere (the canvas, a panel) stops it.
   * Redo steps forward over a replace only. Returns whether it did something.
   */
  function stepReplace(direction) {
    if (destroyed || readOnly || typeof editor.exportHistory !== "function") return false;
    flush();
    if (dirty || !(direction === "undo" ? editor.canUndo : editor.canRedo)) return false;
    const history = editor.exportHistory();
    if (direction === "redo") {
      if (!history.redo.at(-1)?.meta?.replaceDocument) return false;
      editor.redo({ source: "source-pane" });
      return true;
    }
    let index = history.undo.length - 1;
    while (index >= 0 && !history.undo[index].meta?.replaceDocument && history.undo[index].meta?.source === "source-pane") index -= 1;
    if (index < 0 || !history.undo[index].meta?.replaceDocument) return false;
    for (let steps = history.undo.length - index; steps > 0; steps -= 1) editor.undo({ source: "source-pane" });
    return true;
  }

  // ---- Format -------------------------------------------------------------------------------------------------------
  function setFormatInternal(next, notify) {
    const target = formatOf(next);
    if (target.id === format) return true;
    flush();
    const previous = format;
    let written;
    const draft = drafts[target.id];
    if (draft && draft.version === version) written = { text: draft.text, notes: [], draft: true };
    else {
      try { written = preferExact(target.id, deck(), write(target.id, deck())); }
      catch (error) {
        rejectionFindings = [normalizeFinding({ message: `The document cannot be written as ${target.label}: ${errorText(error)} Fix the findings first.`, kind: "rejected" })];
        renderFindings();
        return false;
      }
    }
    if (dirty) drafts[previous] = { text: control.api.getValue(), version };
    delete drafts[target.id];
    format = target.id;
    transientNotes = [];
    rejectionFindings = [];
    syntaxFindings = [];
    noteFindings = written.notes;
    dirty = false;
    control.setLanguage(target.language);
    show(written.text);
    if (format === "md") refreshNotes();
    // A draft the document never accepted is checked and applied again, so its findings come back with it.
    if (written.draft) { baseline = null; flush(); }
    updateBar();
    renderFindings();
    syncAttributes();
    if (notify) options.onFormatChange?.(format, previous);
    return true;
  }

  // ---- Menu ---------------------------------------------------------------------------------------------------------
  const menuOpen = () => !menu.hidden;
  function openMenu(focus = "checked") {
    menu.hidden = false;
    formatButton.setAttribute("aria-expanded", "true");
    const target = focus === "last" ? menuItems[menuItems.length - 1] : menuItems.find((item) => item.getAttribute("aria-checked") === "true") ?? menuItems[0];
    target.focus();
    document.addEventListener("pointerdown", outside, true);
  }
  function closeMenu(returnFocus) {
    if (menu.hidden) return;
    menu.hidden = true;
    formatButton.setAttribute("aria-expanded", "false");
    document.removeEventListener("pointerdown", outside, true);
    if (returnFocus) formatButton.focus();
  }
  function outside(event) { if (!file.contains(event.target)) closeMenu(false); }
  formatButton.addEventListener("click", () => { if (menuOpen()) closeMenu(true); else openMenu(); });
  formatButton.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") { event.preventDefault(); if (!menuOpen()) openMenu(); else menuItems[0].focus(); }
    else if (event.key === "ArrowUp") { event.preventDefault(); if (!menuOpen()) openMenu("last"); }
    else if (event.key === "Escape" && menuOpen()) { event.preventDefault(); closeMenu(true); }
  });
  menu.addEventListener("keydown", (event) => {
    const index = menuItems.indexOf(document.activeElement);
    const move = (to) => { event.preventDefault(); menuItems[(to + menuItems.length) % menuItems.length].focus(); };
    if (event.key === "ArrowDown") move(index + 1);
    else if (event.key === "ArrowUp") move(index - 1);
    else if (event.key === "Home") move(0);
    else if (event.key === "End") move(menuItems.length - 1);
    else if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeMenu(true); }
    else if (event.key === "Tab") closeMenu(false);
  });
  for (const item of menuItems) {
    item.addEventListener("click", () => {
      const chosen = item.dataset.format;
      closeMenu(true);
      setFormatInternal(chosen, true);
    });
  }

  // ---- Rename -------------------------------------------------------------------------------------------------------
  function sanitizeName(value) { return String(value).replace(/[/\\\s]/g, "-"); }
  const widthFor = (value) => `${Math.max(3, value.length) + 1.5}ch`;
  function startRename() {
    if (readOnly) return;
    closeMenu(false);
    nameInput.value = name;
    nameInput.style.width = widthFor(name);
    nameButton.hidden = true;
    nameInput.hidden = false;
    nameInput.focus();
    nameInput.select();
  }
  let committing = false;
  function commitRename() {
    if (nameInput.hidden || committing) return;
    committing = true;
    const next = sanitizeName(nameInput.value) || "deck";
    const changed = next !== name;
    const hadFocus = document.activeElement === nameInput;
    name = next;
    nameInput.hidden = true;
    nameButton.hidden = false;
    if (hadFocus) nameButton.focus();
    updateBar();
    committing = false;
    if (changed) options.onRename?.(name);
  }
  nameButton.addEventListener("click", startRename);
  nameInput.addEventListener("input", () => {
    const start = nameInput.selectionStart;
    const clean = sanitizeName(nameInput.value);
    if (clean !== nameInput.value) { nameInput.value = clean; nameInput.setSelectionRange(start, start); }
    nameInput.style.width = widthFor(clean);
  });
  nameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === "Escape") { event.preventDefault(); event.stopPropagation(); commitRename(); }
  });
  nameInput.addEventListener("blur", commitRename);

  function updateBar() {
    const current = formatOf(format);
    nameButton.textContent = name;
    nameButton.setAttribute("aria-label", `Rename ${name}`);
    formatLabel.textContent = `.opf.${current.extension}`;
    root.dataset.format = current.id;
    for (const item of menuItems) item.setAttribute("aria-checked", String(item.dataset.format === current.id));
  }

  // ---- Actions ------------------------------------------------------------------------------------------------------
  const announce = (message) => {
    status.textContent = message;
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => { status.textContent = ""; copyAction.replaceChildren(icon("Copy", 14)); }, 1500);
  };
  function currentFile() {
    flush();
    const current = formatOf(format);
    return { name, filename: `${name}.opf.${current.extension}`, text: control.api.getValue(), format: current.id, mime: current.mime };
  }
  formatAction.addEventListener("click", () => {
    flush();
    if (readOnly) return;
    if (format === "json") { control.api.format(); control.api.focus(); return; }
    const read = readText(format, control.api.getValue(), catalogs());
    if (!read.deck) { renderFindings(); return; }
    let written;
    try { written = write(format, read.deck); }
    catch (error) {
      rejectionFindings = [normalizeFinding({ message: `Cannot rewrite the ${formatOf(format).label}: ${errorText(error)}`, kind: "rejected" })];
      renderFindings();
      return;
    }
    const before = control.api.getValue();
    if (written.text !== before) {
      const comments = format === "yaml" ? scanYamlComments(before).count : 0;
      control.api.replace(0, before.length, written.text);
      flush();
      transientNotes = comments > 0 ? [normalizeFinding({ message: `${plural(comments, "comment")} in the YAML ${comments === 1 ? "was" : "were"} dropped when the text was rewritten.`, severity: "warning" }, "format")] : [];
      renderedKey = "";
      renderFindings();
    }
    control.api.focus();
  });
  copyAction.addEventListener("click", async () => {
    const info = currentFile();
    try {
      if (options.onCopy) await options.onCopy(info);
      else await navigator.clipboard.writeText(info.text);
      copyAction.replaceChildren(icon("Check", 14));
      announce("Copied");
    } catch (error) {
      announce("Copy failed");
      options.onError?.(error);
    }
  });
  downloadAction.addEventListener("click", async () => {
    const info = currentFile();
    try {
      if (options.onDownload) await options.onDownload(info);
      else {
        const url = URL.createObjectURL(new Blob([info.text], { type: `${info.mime};charset=utf-8` }));
        const link = el("a", "", { href: url, download: info.filename, hidden: "" });
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 0);
      }
    } catch (error) { options.onError?.(error); }
  });

  // ---- Findings -----------------------------------------------------------------------------------------------------
  function sessionFindings() {
    try { return (editor.validation?.findings ?? []).map((finding) => normalizeFinding(finding, finding.ruleId === "opf/schema" ? "schema" : finding.category)); }
    catch { return []; }
  }
  function collect() {
    let host;
    if (typeof options.getFindings === "function") {
      try { host = (options.getFindings({ editor, format, text: control.api.getValue() }) ?? []).map((finding) => normalizeFinding(finding)); }
      catch (error) { options.onError?.(error); host = []; }
    } else if (hostFindings) host = hostFindings.map((finding) => normalizeFinding(finding));
    else host = sessionFindings();
    // A finding repeated by an earlier group is dropped; repeats inside one group stay, so a refusal lists every issue the validator found.
    const seen = new Set();
    const all = [];
    for (const group of [syntaxFindings, rejectionFindings, transientNotes, noteFindings, host]) {
      const keys = [];
      for (const finding of group) {
        const key = `${finding.severity}|${finding.path}|${finding.message}`;
        if (seen.has(key)) continue;
        keys.push(key);
        all.push(finding);
      }
      for (const key of keys) seen.add(key);
    }
    return all.map((finding, index) => ({ finding, index })).sort((a, b) => SEVERITY[a.finding.severity] - SEVERITY[b.finding.severity] || a.index - b.index).map((entry) => entry.finding);
  }
  function lineOf(finding) {
    const value = control.api.getValue();
    if (lineCache.key !== `${format}|${value}`) { lineCache.key = `${format}|${value}`; lineCache.values.clear(); }
    const explicit = finding.line;
    if (explicit && (finding.kind === "syntax" || finding.path === "")) return explicit;
    const cacheKey = finding.path;
    if (!lineCache.values.has(cacheKey)) lineCache.values.set(cacheKey, finding.path === "" ? null : lineForPath(format, value, finding.path));
    return lineCache.values.get(cacheKey) ?? explicit ?? null;
  }
  function renderFindings() {
    paintFindings();
    if (!destroyed && invalid !== shownInvalid) syncAttributes();
  }
  function paintFindings() {
    if (destroyed) return;
    const all = collect();
    const rows = all.map((finding) => ({ finding, line: lineOf(finding) }));
    invalid = rows.some((row) => row.finding.severity === "error");
    const key = JSON.stringify([format, collapsed, rows.map(({ finding, line }) => [finding.severity, finding.path, finding.message, finding.kind, line])]);
    if (key === renderedKey) return;
    renderedKey = key;
    findingsRegion.hidden = rows.length === 0;
    root.dataset.findings = String(rows.length);
    if (!rows.length) { list.replaceChildren(); return; }
    const errors = rows.filter((row) => row.finding.severity === "error");
    const warnings = rows.filter((row) => row.finding.severity === "warning");
    const infos = rows.length - errors.length - warnings.length;
    const parts = [];
    if (errors.length) parts.push(plural(errors.length, errors.every((row) => row.finding.kind === "schema" || !row.finding.kind) ? "schema error" : "error"));
    if (warnings.length) parts.push(plural(warnings.length, "warning"));
    if (infos) parts.push(plural(infos, "note"));
    toggleText.textContent = parts.join(" · ");
    const tone = errors.length ? "error" : warnings.length ? "warning" : "info";
    findingsRegion.dataset.tone = tone;
    toggleIcon.replaceChildren(icon(tone === "error" ? "CircleX" : "Info", 13));
    toggle.setAttribute("aria-expanded", String(!collapsed));
    list.hidden = collapsed;
    const shown = rows.slice(0, 200);
    list.replaceChildren(...shown.map(({ finding, line }) => {
      const item = el("li", "opf-source-finding-item");
      const button = el("button", "opf-source-finding", { type: "button", "data-severity": finding.severity });
      if (finding.kind) button.dataset.kind = finding.kind;
      const path = finding.path ? el("code", "opf-source-finding-path") : null;
      if (path) path.textContent = finding.path;
      const message = Object.assign(el("span", "opf-source-finding-message"), { textContent: finding.message });
      const where = Object.assign(el("span", "opf-source-finding-line"), { textContent: line ? `Ln ${line}` : "" });
      button.append(...(path ? [path] : []), message, where);
      button.addEventListener("click", () => {
        const target = focusPath(finding.path, finding);
        options.onFindingSelect?.(finding, target);
      });
      item.append(button);
      return item;
    }));
    if (rows.length > shown.length) list.append(Object.assign(el("li", "opf-source-finding-more"), { textContent: `${rows.length - shown.length} more not shown.` }));
  }
  toggle.addEventListener("click", () => { collapsed = !collapsed; renderedKey = ""; renderFindings(); });

  // ---- Public API ---------------------------------------------------------------------------------------------------
  function focusPath(path, finding) {
    flush();
    const value = control.api.getValue();
    let line = path === "" || path === undefined ? null : lineForPath(format, value, path);
    if (line === null && finding) line = lineOf(finding);
    if (line === null) line = 1;
    control.api.setSelection(offsetOfLine(value, line));
    control.api.focus();
    return line;
  }

  updateBar();
  root.toggleAttribute("data-readonly", readOnly);
  nameButton.disabled = readOnly;
  formatAction.disabled = readOnly;
  renderFindings();
  syncAttributes();

  return {
    element: root,
    /**
     * Open a different document: `editor.replaceDocument` as one undoable change that forks no catalog record, with the text shown in
     * the current format. `options.source` is the JSON text the document was read from (kept byte for byte); `options.name` renames the file.
     */
    replaceDocument,
    /** Re-read the document from the session (for example after the host changed it without events). */
    refresh() { version++; fromSession(false); },
    /** Replace the host findings; `setFindings(null)` returns to the session's own validation. */
    setFindings(findings) {
      hostFindings = Array.isArray(findings) ? findings : null;
      renderedKey = "";
      renderFindings();
    },
    /** Switch the source format ("json", "yaml" or "md"). Returns false when the document cannot be written in it. */
    setFormat: (next) => setFormatInternal(next, false),
    getFormat: () => format,
    /** Move the cursor to the line of a JSON Pointer in the current format (best effort for YAML and Markdown). Returns the line. */
    focusPath: (path) => focusPath(path),
    /** The source text exactly as shown, with any edit still waiting applied first. */
    getText() { flush(); return control.api.getValue(); },
    getName: () => name,
    setName(value) { name = sanitizeName(value) || "deck"; updateBar(); },
    setDensity(value) { density = value === "touch" ? "touch" : "comfortable"; root.dataset.density = density; },
    setReadOnly(value) {
      readOnly = Boolean(value);
      root.toggleAttribute("data-readonly", readOnly);
      nameButton.disabled = readOnly;
      formatAction.disabled = readOnly;
      control.setReadOnly(readOnly);
    },
    /** The code editor, for hosts that focus or measure it. */
    editor: control,
    destroy() {
      if (destroyed) return;
      flush();
      destroyed = true;
      clearTimeout(timer);
      clearTimeout(copyTimer);
      unsubscribe();
      document.removeEventListener("pointerdown", outside, true);
      control.destroy();
      root.remove();
    },
  };
}
