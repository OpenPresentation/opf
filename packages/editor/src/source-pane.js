import { fromYaml, scanYamlComments, toYaml } from "@openpresentation/opf/yaml";
import { fromMarkdown, toMarkdown } from "@openpresentation/opf/markdown";
import { mountJsonCodeEditor } from "./json-editor.js";
import { MAX_EXACT_SOURCE_LENGTH, createSourceMemory, updateJsonSource } from "./exact-source.js";
import { lineForPath, offsetOfLine } from "./source-lines.js";
import { errorText, normalizeFinding, rejectionFindings as findingsOfError } from "./source-findings.js";
import { formatSource } from "./source-format.js";
import { buildProblems, summarize } from "./source-problems.js";
import { analyzeSyntax, findDuplicateKeys } from "./source-syntax.js";
import { withSyntaxFixes } from "./source-fixes-syntax.js";
import { detailsFor } from "./source-details.js";
import { schemaAtPath, schemaVariants } from "./schema.js";
import { locateText } from "./source-ranges.js";
import { scanMarkdown, starterValue } from "@openpresentation/opf/source";
import { listCatalogRecords } from "./catalogs.js";

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
  CircleHelp: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  Sparkles: '<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>',
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

/** The rule's explanation as the body of a row's Details: what it checks, why, what to do, an example and the documentation link. */
function fillDetails(body, details) {
  const line = (label, text) => { const row = el("p", "opf-source-finding-explain-line"); row.append(Object.assign(el("strong"), { textContent: `${label} ` }), document.createTextNode(text)); return row; };
  body.append(line("Checks:", details.summary), line("Why:", details.why), line("Fix:", details.fix));
  if (details.schema) body.append(line("Schema:", details.schema));
  if (details.example) {
    const example = el("div", "opf-source-finding-explain-example");
    example.append(Object.assign(el("code"), { textContent: details.example.problem || "(empty)" }), Object.assign(el("span", "opf-source-finding-explain-arrow"), { textContent: " becomes " }), Object.assign(el("code"), { textContent: details.example.fixed }));
    body.append(example);
  }
  if (details.docs && /^https?:/.test(details.docs)) body.append(Object.assign(el("a", "opf-source-finding-explain-link", { href: details.docs, target: "_blank", rel: "noopener noreferrer" }), { textContent: "Documentation" }));
}

/** Read the text of one format. `{ deck }` on success; `findings` carry the syntax errors (`syntax: true`) or the OPF findings of the parsed deck. */
function readText(format, text, catalogs) {
  if (format === "json") {
    const problems = analyzeSyntax(text);
    if (problems.length) return { syntax: true, findings: problems.map((problem) => normalizeFinding(problem, "syntax")) };
    const deck = JSON.parse(text);
    const duplicates = findDuplicateKeys(text);
    if (duplicates.length) return { syntax: true, findings: duplicates };
    return { deck, findings: [] };
  }
  const result = format === "yaml" ? (fromYaml(text, { catalogs })) : fromMarkdown(text, { catalogs });
  // The reader's own findings: errors stop the document being read; its warnings (a numbered list that became bullets) come with the deck.
  const readerFindings = result.findings.filter((finding) => !finding.ruleId?.startsWith("opf/"));
  const errors = readerFindings.filter((finding) => finding.severity === "error");
  const syntax = (list) => withSyntaxFixes(format, text, list).map((finding) => normalizeFinding(finding, "syntax"));
  if (errors.length) return { syntax: true, findings: syntax(errors) };
  return { deck: result.presentation, findings: result.findings.map((finding) => normalizeFinding(finding, "schema")), notes: syntax(readerFindings) };
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
  // The problems now shown (rows of source-problems.js), the document they were checked as, and the pause timers of the count announcement and the
  // syntax pass.
  const rowOf = new WeakMap();
  // The problems whose Details are open (by rule, path and message), so a redraw of the panel keeps them open, and a number per key for the element ids.
  const detailsOpen = new Set();
  const detailsKeys = { ids: new Map(), id(key) { if (!this.ids.has(key)) this.ids.set(key, this.ids.size + 1); return this.ids.get(key); } };
  let problemRows = [], lastDraft = null, lastSummary = "No problems", summaryTimer = null, syntaxTimer = null, recheckTimer = null;
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
  formatAction.title = "Format (fix indentation), Shift+Alt+F";
  formatAction.setAttribute("aria-keyshortcuts", "Shift+Alt+F");
  // The old Format (a rewrite through OPF's own writer) is its own command: it drops the comments of YAML and Markdown, so it asks first.
  const canonicalAction = actionButton("Canonicalize with OPF", "Sparkles", "canonicalize");
  canonicalAction.title = "Canonicalize with OPF: rewrite the text the way OPF writes it (drops comments)";
  const copyAction = actionButton("Copy source", "Copy", "copy");
  const shortcutsAction = actionButton("Keyboard shortcuts", "CircleHelp", "shortcuts");
  shortcutsAction.setAttribute("aria-haspopup", "dialog");
  const downloadAction = actionButton("Download source", "Download", "download");
  bar.append(file, actions);

  const confirm = el("div", "opf-source-confirm", { role: "alertdialog", "aria-labelledby": `${id}-confirm-text`, hidden: "" });
  const confirmText = el("p", "opf-source-confirm-text", { id: `${id}-confirm-text` });
  const confirmAccept = Object.assign(el("button", "opf-source-confirm-accept", { type: "button" }), { textContent: "Canonicalize anyway" });
  const confirmCancel = Object.assign(el("button", "opf-source-confirm-cancel", { type: "button" }), { textContent: "Cancel" });
  confirm.append(confirmText, confirmAccept, confirmCancel);
  const code = el("div", "opf-source-code");
  const status = el("div", "opf-source-status", { role: "status", "aria-live": "polite" });

  const findingsRegion = el("section", "opf-source-findings", { "aria-label": "Source findings", hidden: "" });
  const toggle = el("button", "opf-source-findings-toggle", { type: "button", "aria-expanded": "true", "aria-controls": `${id}-findings` });
  const toggleIcon = el("span", "opf-source-findings-icon");
  const toggleText = el("span", "opf-source-findings-count");
  toggle.append(toggleIcon, toggleText, icon("ChevronDown", 14));
  const list = el("ul", "opf-source-findings-list", { id: `${id}-findings` });
  findingsRegion.append(toggle, list);

  root.append(bar, confirm, code, findingsRegion, status);
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
    smartListEnter: options.smartListEnter,
    catalogs: options.catalogs ?? editor.catalogs,
    describedBy: `${id}-findings`,
    onChange: () => schedule(),
    onFormat: () => formatDocument(),
    onFocusProblems: () => focusProblems(),
    onShowShortcuts: options.onShowShortcuts,
    // The pane supplies the problems itself (every finding, with ranges and fixes).
    syntaxProblems: false,
    historyFallback: { undo: () => stepReplace("undo"), redo: () => stepReplace("redo") },
    onError: (error) => options.onError?.(error),
  });

  // ---- Applying edits -----------------------------------------------------------------------------------------------
  function schedule() {
    closeConfirm(false);
    clearTimeout(timer);
    clearTimeout(syntaxTimer);
    if (delay === 0) { flush(); return; }
    timer = setTimeout(flush, delay);
    // Syntax problems come first, 150 ms after the last key: the rest of the checking waits for the apply delay.
    if (delay > 150) syntaxTimer = setTimeout(checkSyntax, 150);
  }
  /** Show or clear the syntax problems of the text now, without applying it to the document. */
  function checkSyntax() {
    syntaxTimer = null;
    if (destroyed || format !== "json") return;
    const problems = analyzeSyntax(control.api.getValue());
    if (!problems.length) {
      if (!syntaxFindings.length) return;
      syntaxFindings = [];
      renderFindings();
      return;
    }
    syntaxFindings = problems.map((problem) => normalizeFinding(problem, "syntax"));
    renderFindings();
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
    syntaxFindings = read.notes ?? [];
    baseline = source;
    lastDraft = read.deck;
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
    closeConfirm(false);
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
    lastDraft = null;
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

  /** Read the text as `next` (it is that format already: a YAML deck pasted into the JSON pane) without rewriting it. */
  function switchFormatKeepingText(next) {
    const target = formatOf(next);
    if (destroyed || target.id === format) return;
    flush();
    const previous = format;
    format = target.id;
    transientNotes = [];
    rejectionFindings = [];
    syntaxFindings = [];
    noteFindings = [];
    control.setLanguage(target.language);
    updateBar();
    baseline = null;
    flush();
    renderedKey = "";
    renderFindings();
    syncAttributes();
    control.api.focus();
    options.onFormatChange?.(format, previous);
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
    canonicalAction.hidden = current.id === "json";
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
  // Format document: the button and the keys (Shift+Alt+F, Cmd/Ctrl+Shift+F) do the same in every format. Whitespace only: JSON is laid out
  // token by token (also while it does not parse), YAML keeps its comments, and a rewrite that would change the document is refused.
  function formatDocument() {
    flush();
    if (readOnly) return false;
    const before = control.api.getValue();
    const result = formatSource(format, before, { unit: control.api.indentUnit() });
    control.api.focus();
    if (result.error) { announce(result.error); return false; }
    if (result.text === before) { announce("Already formatted"); return true; }
    if (format !== "json") {
      let unchanged = true;
      try {
        const was = readText(format, before, catalogs()).deck;
        unchanged = !was || same(was, readText(format, result.text, catalogs()).deck);
      } catch { unchanged = false; }
      if (!unchanged) { announce("Formatting would change the document, so the text was left as it is."); return false; }
    }
    control.api.replaceDiff(result.text);
    flush();
    announce("Formatted");
    return true;
  }
  formatAction.addEventListener("click", () => { formatDocument(); });
  // The "?" button, and the "?" key from anywhere in the pane that is not a place to type, open the list of shortcuts.
  const chord = control.getShortcuts().find((row) => row.id === "help.shortcuts")?.keys[0];
  shortcutsAction.title = `Keyboard shortcuts${chord ? ` (${chord})` : ""}`;
  shortcutsAction.setAttribute("aria-label", shortcutsAction.title);
  shortcutsAction.addEventListener("click", () => { control.showShortcuts(); });
  root.addEventListener("keydown", (event) => {
    if (event.key !== "?" || event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return;
    const target = event.target;
    if (target.closest?.(".cm-editor, input, textarea, select, [contenteditable=true]")) return;
    event.preventDefault();
    control.showShortcuts();
  });

  // Canonicalize with OPF: the text rewritten through core's writer (the old Format). Unlike Format it drops comments, so it asks first and says how many.
  function droppedComments(text) {
    if (format === "yaml") return scanYamlComments(text).count;
    if (format !== "md") return 0;
    const scan = scanMarkdown(text);
    let count = scan.comments.filter((comment) => comment.kind === "comment").length;
    if (scan.frontMatter) count += scanYamlComments(text.slice(scan.frontMatter.yamlFrom, scan.frontMatter.yamlTo)).count;
    for (const fence of scan.fences) if (fence.kind === "opf-slide" || fence.kind === "opf-block") count += scanYamlComments(text.slice(fence.bodyFrom, fence.bodyTo)).count;
    return count;
  }
  let pendingCanonical = null;
  function closeConfirm(returnFocus) {
    if (confirm.hidden) return;
    confirm.hidden = true;
    pendingCanonical = null;
    if (returnFocus) control.api.focus();
  }
  /** Rewrite the text through OPF's own writer. Asks first when that drops comments (`confirmed: true` has asked already). Returns "applied", "unchanged", "confirm" (waiting for the answer) or "refused". */
  function canonicalize({ confirmed = false } = {}) {
    flush();
    if (readOnly || format === "json" || destroyed) return "refused";
    if (dirty) { announce("Fix the errors first: the text cannot be read as a document."); control.api.say("Fix the errors first: the text cannot be read as a document."); return "refused"; }
    let written;
    try { written = write(format, deck()); } catch (error) { announce(`Cannot canonicalize: ${errorText(error)}`); return "refused"; }
    const before = control.api.getValue();
    if (written.text === before) { announce("Already canonical"); control.api.say("Already canonical"); return "unchanged"; }
    const count = droppedComments(before);
    if (count > 0 && !confirmed) {
      pendingCanonical = written.text;
      confirmText.textContent = `Canonicalizing rewrites the text the way OPF writes it, and drops ${plural(count, "comment")}. Undo brings ${count === 1 ? "it" : "them"} back.`;
      confirm.hidden = false;
      confirmAccept.focus();
      control.api.say(confirmText.textContent);
      return "confirm";
    }
    closeConfirm(false);
    control.api.replaceDiff(written.text);
    flush();
    control.api.focus();
    announce("Canonicalized");
    control.api.say(count > 0 ? `Canonicalized. ${plural(count, "comment")} dropped.` : "Canonicalized");
    return "applied";
  }
  canonicalAction.addEventListener("click", () => { canonicalize(); });
  confirmAccept.addEventListener("click", () => { closeConfirm(false); canonicalize({ confirmed: true }); });
  confirmCancel.addEventListener("click", () => closeConfirm(true));
  confirm.addEventListener("keydown", (event) => {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeConfirm(true); }
    else if (event.key === "Tab") {
      const order = [confirmAccept, confirmCancel], at = order.indexOf(document.activeElement);
      event.preventDefault();
      order[(at + (event.shiftKey ? order.length - 1 : 1)) % order.length].focus();
    }
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
        const key = `${finding.severity}|${finding.path}|${finding.message}|${finding.range?.from ?? ""}`;
        if (seen.has(key)) continue;
        keys.push(key);
        all.push(finding);
      }
      for (const key of keys) seen.add(key);
    }
    return all;
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
  // What the messages and the quick fixes read: the document being checked (the typed draft, else the session's) and its schema.
  const attempt = (run, fallback) => { try { return run(); } catch { return fallback; } };
  function problemContext() {
    const draft = lastDraft ?? deck();
    return {
      document: draft,
      format,
      unit: control.api.indentUnit(),
      valueAt: (segments) => segments.reduce((value, key) => (value !== null && typeof value === "object" ? value[key] : undefined), draft),
      keysOf: (segments) => attempt(() => [...new Set(schemaVariants(schemaAtPath(draft, segments)).flatMap((variant) => Object.keys(variant.properties ?? {})))], []),
      catalogCount: (kind) => attempt(() => listCatalogRecords(draft, kind, { catalogs: catalogs() }).length, 0),
      starter: (segments, property) => attempt(() => starterValue(draft, segments, property), undefined),
    };
  }
  /** Select the field a core "focus" fix names: its path, else the field inside it, else the nearest place there is one. */
  function focusField(focus) {
    flush();
    const text = control.api.getValue();
    const segments = String(focus.path ?? "").replace(/^\//, "").split("/").filter(Boolean).map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"));
    const wanted = focus.field ? locateText(format, text, [...segments, focus.field], "value") : null;
    const where = wanted?.exact ? wanted : locateText(format, text, segments, "value");
    if (where) { control.api.setSelection(where.from, where.to); control.api.focus(); return; }
    focusPath(focus.path ?? "");
  }
  const fixActions = {
    applyPatch(patch) {
      flush();
      try { editor.applyPatch(patch, { source: "source-pane", format }); } catch (error) { rejectionFindings = findingsOfError(error); renderedKey = ""; renderFindings(); }
      control.api.focus();
    },
    focusField,
    switchFormat(next) { switchFormatKeepingText(next); },
  };
  /** Problems the author is in the middle of typing (a key with a list of keys open next to it) are not shown yet. */
  function withheld(row) {
    if (row.finding.kind !== "syntax" || row.from === undefined || !control.isCompleting()) return false;
    const [caret] = control.api.getSelection();
    return caret >= row.from - 1 && caret <= row.to + 1;
  }
  function renderFindings() {
    paintFindings();
    if (!destroyed && invalid !== shownInvalid) syncAttributes();
  }
  function paintFindings() {
    if (destroyed) return;
    const text = control.api.getValue();
    let rows = buildProblems({ format, text, findings: collect(), context: problemContext(), actions: fixActions, lineOf });
    const hidden = rows.filter(withheld);
    if (hidden.length) {
      rows = rows.filter((row) => !hidden.includes(row));
      clearTimeout(recheckTimer);
      recheckTimer = setTimeout(() => { if (!destroyed) { renderedKey = ""; renderFindings(); } }, 600);
    }
    problemRows = rows;
    invalid = rows.some((row) => row.severity === "error");
    const key = JSON.stringify([format, collapsed, rows.map((row) => [row.severity, row.path, row.message, row.next, row.finding.kind, row.line, row.column, row.from, row.to, row.fixes.map((fix) => fix.title)])]);
    if (key === renderedKey) return;
    renderedKey = key;
    // The same problems are drawn in the text, with their tooltips and quick fixes.
    control.setProblems(rows.filter((row) => row.from !== undefined).flatMap((row) => [row, ...(row.finding.related ?? []).map((range) => ({ ...row, from: range.from, to: range.to }))])
      .map((row) => ({ from: row.from, to: row.to, severity: row.severity, message: row.message, next: row.next, rule: row.rule, fixes: row.fixes })));
    announceSummary(rows);
    findingsRegion.hidden = rows.length === 0;
    root.dataset.findings = String(rows.length);
    if (!rows.length) { list.replaceChildren(); return; }
    const errors = rows.filter((row) => row.severity === "error");
    const warnings = rows.filter((row) => row.severity === "warning");
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
    list.replaceChildren(...shown.map((row) => {
      const { finding } = row;
      const item = el("li", "opf-source-finding-item");
      const button = el("button", "opf-source-finding", { type: "button", "data-severity": row.severity });
      if (finding.kind) button.dataset.kind = finding.kind;
      const word = row.severity === "error" ? "Error" : row.severity === "warning" ? "Warning" : "Note";
      const severity = Object.assign(el("span", "opf-source-finding-severity"), { textContent: `${word}: ` });
      const path = row.path ? el("code", "opf-source-finding-path") : null;
      if (path) path.textContent = row.path;
      const message = Object.assign(el("span", "opf-source-finding-message"), { textContent: row.message });
      const next = row.next ? Object.assign(el("span", "opf-source-finding-next"), { textContent: `Next: ${row.next}` }) : null;
      const where = Object.assign(el("span", "opf-source-finding-line"), { textContent: row.line ? (row.column ? `Ln ${row.line}, Col ${row.column}` : `Ln ${row.line}`) : "" });
      const rule = row.rule ? Object.assign(el("span", "opf-source-finding-rule"), { textContent: row.rule }) : null;
      rowOf.set(button, row);
      const head = el("span", "opf-source-finding-head");
      head.append(...(path ? [path] : []), message);
      button.append(severity, head, ...(next ? [next] : []), where, ...(rule ? [rule] : []));
      button.addEventListener("click", () => {
        const target = selectRow(row);
        options.onFindingSelect?.(finding, target);
      });
      item.append(button);
      const details = detailsFor(finding);
      if (row.fixes.length || details) {
        const fixes = el("span", "opf-source-finding-fixes");
        for (const fix of row.fixes.slice(0, 3)) {
          const fixButton = Object.assign(el("button", "opf-source-finding-fix", { type: "button", "aria-label": `${fix.title}: ${row.message}` }), { textContent: fix.title });
          fixButton.addEventListener("click", () => applyFix(fix, row));
          fixes.append(fixButton);
        }
        if (details) {
          // The rule's own explanation, behind a disclosure that stays open across the panel's redraws.
          const key = `${row.rule}|${row.path}|${row.message}`;
          const body = el("div", "opf-source-finding-explain", { id: `${id}-explain-${detailsKeys.id(key)}`, role: "region", "aria-label": `About ${row.rule}` });
          const toggleDetails = Object.assign(el("button", "opf-source-finding-details", { type: "button", "aria-expanded": String(detailsOpen.has(key)), "aria-controls": body.id }), { textContent: "Details" });
          body.hidden = !detailsOpen.has(key);
          fillDetails(body, details);
          toggleDetails.addEventListener("click", () => {
            const open = body.hidden;
            body.hidden = !open;
            toggleDetails.setAttribute("aria-expanded", String(open));
            if (open) detailsOpen.add(key); else detailsOpen.delete(key);
            if (open) control.api.say(`${details.summary} ${details.fix}`);
          });
          fixes.append(toggleDetails);
          item.append(fixes, body);
          return item;
        }
        item.append(fixes);
      }
      return item;
    }));
    if (rows.length > shown.length) list.append(Object.assign(el("li", "opf-source-finding-more"), { textContent: `${rows.length - shown.length} more not shown.` }));
  }
  toggle.addEventListener("click", () => { collapsed = !collapsed; renderedKey = ""; renderFindings(); });
  /** "2 problems: 1 error, 1 warning" in the live region once the problems stop changing for a moment. */
  function announceSummary(rows) {
    const summary = summarize(rows);
    clearTimeout(summaryTimer);
    if (summary === lastSummary) return;
    summaryTimer = setTimeout(() => { if (!destroyed) { lastSummary = summary; control.api.say(summary); } }, 600);
  }
  /** Run a fix of a row: its edits as one undoable change in the text, or its own action. */
  function applyFix(fix, row) {
    if (readOnly) return;
    control.applyFix(fix, row);
  }
  /** Put the caret on a row's place in the text, selecting the range when it has one. Returns the line. */
  function selectRow(row) {
    flush();
    const text = control.api.getValue();
    if (row.from !== undefined) {
      control.api.setSelection(Math.min(row.from, text.length), Math.min(row.to, text.length));
      control.api.focus();
      return row.line ?? 1;
    }
    return focusPath(row.path, row.finding);
  }
  // The panel with the keyboard: arrows, Home and End move between rows, Escape returns to the code, Cmd/Ctrl+. applies the first fix of the row.
  list.addEventListener("keydown", (event) => {
    const rows = [...list.querySelectorAll(".opf-source-finding")];
    const at = rows.indexOf(document.activeElement);
    const move = (to) => { event.preventDefault(); rows[Math.max(0, Math.min(rows.length - 1, to))]?.focus(); };
    if (event.key === "ArrowDown") move(at + 1);
    else if (event.key === "ArrowUp") move(at - 1);
    else if (event.key === "Home") move(0);
    else if (event.key === "End") move(rows.length - 1);
    else if (event.key === "Escape") { event.preventDefault(); control.api.focus(); }
    else if (event.key === "." && (event.metaKey || event.ctrlKey) && at >= 0) {
      const row = rowOf.get(rows[at]);
      const fix = row?.fixes[0];
      if (fix) { event.preventDefault(); applyFix(fix, row); } else control.api.say("No quick fixes available");
    }
  });
  /** Move focus to the first problem of the panel (Cmd/Ctrl+Shift+M in the code). */
  function focusProblems() {
    if (findingsRegion.hidden) { control.api.say("No problems"); return true; }
    if (collapsed) { collapsed = false; renderedKey = ""; renderFindings(); }
    list.querySelector(".opf-source-finding")?.focus();
    return true;
  }

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
  canonicalAction.disabled = readOnly;
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
    /** Canonicalize with OPF (rewrite through core's writer; asks before dropping comments). See `canonicalize` in the pane. */
    canonicalize,
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
      canonicalAction.disabled = readOnly;
      control.setReadOnly(readOnly);
    },
    /** The problems drawn in the text now, in position order: `{ from, to, severity, message, next, rule, fixes }` at source offsets. */
    getProblems: () => control.getProblems(),
    /** Select the next problem in the text (F8) and say what it is; wraps. */
    nextProblem: () => control.nextProblem(),
    /** Select the previous problem in the text (Shift+F8); wraps. */
    previousProblem: () => control.previousProblem(),
    /** Select problem number `index` (zero-based, position order) and say what it is. */
    showProblem(index) {
      const problems = control.getProblems(), problem = problems[index];
      if (!problem) return false;
      control.api.setSelection(problem.from, problem.to);
      control.api.focus();
      control.api.say(`${problem.severity === "error" ? "Error" : problem.severity === "warning" ? "Warning" : "Note"}: ${problem.message}`);
      return true;
    },
    /** Open the suggestion list at the caret, as Ctrl+Space does. */
    triggerCompletion: () => control.triggerCompletion(),
    /** Every key binding of the editor for `platform` ("mac", "win" or "linux"; default: the page's): `{ id, title, group, keys, symbols, strokes, when? }`. */
    getShortcuts: (platform) => control.getShortcuts(platform),
    /** Open the keyboard shortcuts dialog (the "?" button, F1, Cmd/Ctrl+K Cmd/Ctrl+S); `onShowShortcuts(shortcuts)` returning true replaces it. */
    showShortcuts: () => control.showShortcuts(),
    /** Open the symbol picker (Cmd/Ctrl+Shift+O). */
    showSymbols: () => control.showSymbols(),
    /** The code editor, for hosts that focus or measure it. */
    editor: control,
    destroy() {
      if (destroyed) return;
      flush();
      destroyed = true;
      clearTimeout(timer);
      clearTimeout(copyTimer);
      clearTimeout(summaryTimer);
      clearTimeout(syntaxTimer);
      clearTimeout(recheckTimer);
      unsubscribe();
      document.removeEventListener("pointerdown", outside, true);
      control.destroy();
      root.remove();
    },
  };
}
