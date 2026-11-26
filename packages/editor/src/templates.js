// Templates (RR-32): the headless model behind the Fill template panel. A template is an OPF file
// with variables; filling it resolves the variables to a concrete deck (core resolveVariables).
// Everything here reads and writes the document through the session, so a fill, a declaration
// and a token insertion are validated, undoable JSON Patch edits like any other. Importing this
// module needs no DOM.
import { coerceVariableValue, hasContentVariables, listBuiltinVariables, listVariables, resolveVariables, variableDeclarations, visibleLength } from "@openpresentation/opf";
import { OPFEditorError, getValueAtPath, opfPathToJsonPointer } from "./index.js";

const VARIABLE_ID = /^[a-z][a-z0-9-]*$/;
// A built-in variable name (core FA-04): `speakers`, or deck/speaker/organization plus one or two dotted segments.
const BUILTIN_NAME = /^(?:speakers|(?:deck|slide|speaker|organization)(?:\.[A-Za-z0-9_-]+){1,3})$/;
const KINDS = ["color", "text", "number", "date", "image", "url", "list"];

/** The form control each variable kind uses. */
export const TEMPLATE_INPUT_TYPES = Object.freeze({
  color: "color",
  text: "text",
  number: "number",
  date: "date",
  image: "image",
  url: "url",
  list: "list",
});

function fail(code, message, details) {
  return new OPFEditorError(code, message, details);
}

function checkEditor(editor) {
  if (!editor || typeof editor.applyPatch !== "function" || typeof editor.subscribe !== "function") {
    throw fail("invalid-editor", "Expected an editor session created by createEditorSession.");
  }
}

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

/** True when the document is marked as a template (`template: true`). */
export function isTemplateDocument(presentation) {
  return isObject(presentation) && presentation.template === true;
}

// FR-10: translations. A text, list, url or image variable has a `value` per language; a date variable a `format`.
const TRANSLATION_KINDS = ["text", "list", "url", "image", "date"];
const LANGUAGE_TAG = /^(?:[A-Za-z]{2,3}|[iIxX])(?:-[A-Za-z0-9]{1,8})*$/;

const declaredLanguage = (language) => {
  const tag = typeof language === "string" ? language : isObject(language) ? language.bcp47 : undefined;
  return typeof tag === "string" && tag.trim() ? tag.trim() : undefined;
};

/** The languages the deck and its slides declare, the deck's first, each once: the languages a translation is offered for first. */
export function translationLanguages(presentation) {
  const seen = new Set();
  const out = [];
  const add = (language) => {
    const tag = declaredLanguage(language);
    if (tag && !seen.has(tag.toLowerCase())) {
      seen.add(tag.toLowerCase());
      out.push(tag);
    }
  };
  if (isObject(presentation)) {
    add(presentation.language);
    if (Array.isArray(presentation.slides)) for (const slide of presentation.slides) if (isObject(slide)) add(slide.language);
  }
  return out;
}

/** What a translation control shows: a date's pattern, else the value as the kind's form field shows it. */
export function translationFieldText(kind, entry) {
  if (!isObject(entry)) return "";
  return kind === "date" ? String(entry.format ?? "") : valueToFieldText(kind, entry.value);
}

/** The translations a variable declares, in document order, as form rows: `{ tag, text, rich }`. Empty for a kind that has none. */
export function listVariableTranslations(presentation, id) {
  const declaration = isObject(presentation?.variables) ? presentation.variables[id] : undefined;
  if (!isObject(declaration) || !TRANSLATION_KINDS.includes(declaration.type) || !isObject(declaration.translations)) return [];
  return Object.entries(declaration.translations).map(([tag, entry]) => ({ tag, text: translationFieldText(declaration.type, entry), rich: declaration.type === "text" && Array.isArray(entry?.value) }));
}

function translationTarget(editor, id) {
  checkEditor(editor);
  const declaration = isObject(editor.presentation.variables) ? editor.presentation.variables[id] : undefined;
  if (!isObject(declaration)) throw fail("unknown-variable", `No variable '${id}' is declared.`, { id });
  if (!TRANSLATION_KINDS.includes(declaration.type)) throw fail("translation-kind", `A ${declaration.type} variable has no translations: they are for text, list, url, image and date variables.`, { id, kind: declaration.type });
  return declaration;
}

function translationEntry(kind, text) {
  if (kind === "date") {
    if (typeof text !== "string" || text.trim() === "") return { ok: false, message: "A date translation needs a display pattern, such as d. MMMM yyyy." };
    return { ok: true, entry: { format: text.trim() } };
  }
  const parsed = fieldTextToValue(kind, text);
  if (!parsed.ok) return parsed;
  if (parsed.value === undefined) {
    if (kind === "text") return { ok: true, entry: { value: "" } };
    return { ok: false, message: "A translation needs a value." };
  }
  return { ok: true, entry: { value: parsed.value } };
}

/**
 * Set a variable's translation for a language (adding it, or replacing the one for the same tag whatever its case) as one undoable edit.
 * `text` is what a form control holds (a date: its display pattern). `from` renames: the entry of that tag moves to `tag`.
 */
export function setVariableTranslation(editor, id, tag, text, { from, meta = {} } = {}) {
  const declaration = translationTarget(editor, id);
  if (typeof tag !== "string" || !LANGUAGE_TAG.test(tag)) throw fail("invalid-language-tag", `'${tag}' is not a language tag: write one such as de, de-AT or zh-Hant.`, { tag });
  const parsed = translationEntry(declaration.type, text);
  if (!parsed.ok) throw fail("invalid-translation", parsed.message, { id, tag });
  const translations = isObject(declaration.translations) ? declaration.translations : undefined;
  const sameTag = (key) => key.toLowerCase() === tag.toLowerCase();
  const patches = [];
  if (!translations) patches.push({ op: "add", path: opfPathToJsonPointer(["variables", id, "translations"]), value: { [tag]: parsed.entry } });
  else {
    if (from !== undefined && Object.hasOwn(translations, from) && !sameTag(from)) patches.push({ op: "remove", path: opfPathToJsonPointer(["variables", id, "translations", from]) });
    const existing = Object.keys(translations).find((key) => sameTag(key) && key !== from);
    patches.push({ op: existing ? "replace" : "add", path: opfPathToJsonPointer(["variables", id, "translations", existing ?? tag]), value: parsed.entry });
  }
  return editor.applyPatch(patches, { source: "template-translation", rejectInvalid: true, ...meta });
}

/** Remove a variable's translation for a language, and the `translations` map with its last entry, as one undoable edit. */
export function removeVariableTranslation(editor, id, tag, meta = {}) {
  const declaration = translationTarget(editor, id);
  const translations = isObject(declaration.translations) ? declaration.translations : {};
  const key = Object.keys(translations).find((entry) => entry === tag) ?? Object.keys(translations).find((entry) => entry.toLowerCase() === String(tag).toLowerCase());
  if (key === undefined) throw fail("unknown-translation", `'${id}' has no translation for '${tag}'.`, { id, tag });
  const patches = Object.keys(translations).length === 1
    ? [{ op: "remove", path: opfPathToJsonPointer(["variables", id, "translations"]) }]
    : [{ op: "remove", path: opfPathToJsonPointer(["variables", id, "translations", key]) }];
  return editor.applyPatch(patches, { source: "template-translation", rejectInvalid: true, ...meta });
}

/** True when the document is a template or declares a variable that is not a color. */
export function hasTemplateVariables(presentation) {
  return hasContentVariables(presentation);
}

/**
 * The presentation's built-in variables (read-only values from its own speaker, organization and deck metadata) with
 * kind, label, current value, whether the presentation has a source value and where each is used.
 */
export function listBuiltins(presentation) {
  return listBuiltinVariables(presentation);
}

function humanize(id) {
  const words = id.replaceAll("-", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The text a form control shows for a value. Rich text shows its plain text. */
export function valueToFieldText(kind, value) {
  if (value === undefined || value === null) return "";
  switch (kind) {
    case "list":
      return Array.isArray(value) ? value.join("\n") : String(value);
    case "image":
      return isObject(value) ? String(value.src ?? "") : String(value);
    case "text":
      if (Array.isArray(value)) return value.map((run) => (typeof run === "string" ? run : String(run?.text ?? ""))).join("");
      return String(value);
    default:
      return String(value);
  }
}

/**
 * Parse what a form control holds. A blank control clears the value (the declared value, if any,
 * applies again). Returns `{ ok: true, value }` (value undefined when cleared) or `{ ok: false, message }`.
 */
export function fieldTextToValue(kind, text) {
  if (typeof text !== "string") return { ok: false, message: "Expected text." };
  if (text.trim() === "") return { ok: true, value: undefined };
  const coerced = coerceVariableValue(kind, kind === "text" ? text : text.trim());
  return coerced.ok ? { ok: true, value: coerced.value } : { ok: false, message: `${coerced.message}.` };
}

/**
 * What a value uses of the limits its declaration sets (FR-09): `maxLength` counts characters as a reader sees them, `maxItems` the
 * entries of a list. `maxLines` has no count here: the line count depends on the box where the variable is drawn, so composition
 * reports it (`opf/variable-overflow`). Undefined when the variable sets no limit this value can be counted against.
 */
export function limitUsage(kind, value, limits) {
  if (kind === "text" && limits.maxLength !== undefined) {
    const used = visibleLength(valueToFieldText("text", value));
    return { unit: "characters", used, max: limits.maxLength, over: used > limits.maxLength };
  }
  if (kind === "list" && limits.maxItems !== undefined) {
    const used = Array.isArray(value) ? value.length : 0;
    return { unit: "items", used, max: limits.maxItems, over: used > limits.maxItems };
  }
  return undefined;
}

/**
 * The variables of a document as form fields, with the state a panel needs:
 * `status` is "filled" (a value was supplied), "default" (the declaration has a value), "unfilled"
 * (required, no value) or "optional" (not required, no value).
 */
export function listTemplateFields(presentation, values = {}) {
  const declared = new Map(variableDeclarations(presentation).map((declaration) => [declaration.id, declaration]));
  return listVariables(presentation, values).map((info) => {
    const declaration = declared.get(info.id);
    const supplied = Object.hasOwn(values, info.id) && values[info.id] !== undefined && values[info.id] !== null;
    const defaultValue = declaration?.value;
    const value = supplied ? info.value : defaultValue;
    const status = supplied ? "filled" : defaultValue !== undefined ? "default" : info.required ? "unfilled" : "optional";
    return {
      id: info.id,
      kind: info.kind,
      input: TEMPLATE_INPUT_TYPES[info.kind],
      label: info.label ?? humanize(info.id),
      description: info.description,
      required: info.required,
      format: info.format,
      example: info.example,
      value,
      defaultValue,
      text: supplied ? valueToFieldText(info.kind, value) : "",
      placeholder: valueToFieldText(info.kind, defaultValue !== undefined ? defaultValue : info.example),
      rich: info.kind === "text" && Array.isArray(value),
      ...(declaration?.maxLength !== undefined ? { maxLength: declaration.maxLength } : {}),
      ...(declaration?.maxLines !== undefined ? { maxLines: declaration.maxLines } : {}),
      ...(declaration?.maxItems !== undefined ? { maxItems: declaration.maxItems } : {}),
      // FR-10: a kind with translations lists them; a value typed here replaces them when the deck is filled.
      ...(TRANSLATION_KINDS.includes(info.kind) ? { translations: listVariableTranslations(presentation, info.id), translationLanguages: translationLanguages(presentation) } : {}),
      status,
      uses: info.uses,
    };
  });
}

/** The summary a panel shows: how many required variables still need a value. */
export function templateStatus(presentation, values = {}) {
  const fields = listTemplateFields(presentation, values);
  const required = fields.filter((field) => field.required);
  const unfilled = fields.filter((field) => field.status === "unfilled").map((field) => field.id);
  return {
    template: isTemplateDocument(presentation),
    fieldCount: fields.length,
    requiredCount: required.length,
    filledRequiredCount: required.length - unfilled.length,
    unfilled,
    complete: unfilled.length === 0,
  };
}

/**
 * Preview data for the supplied values: the concrete deck with each unfilled variable's example (or its
 * token when it has none). Never throws for missing values; the diagnostics say what was unfilled.
 */
export function previewTemplate(presentation, values = {}) {
  return resolveVariables(presentation, values, { examples: true, partial: true });
}

/**
 * A fill session over an editor: values live here until `apply()` fills the document with them as one
 * undoable edit. `set`/`setText`/`clear` change a value, `preview()` shows the result without touching the
 * document, `subscribe` notifies listeners (a panel redraws on it).
 */
export function createTemplateFill(editor, options = {}) {
  checkEditor(editor);
  let values = {};
  const listeners = new Set();
  const emit = () => {
    for (const listener of listeners) listener(api);
  };
  const declared = () => new Set(variableDeclarations(editor.presentation).map((declaration) => declaration.id));
  const kindOf = (id) => variableDeclarations(editor.presentation).find((declaration) => declaration.id === id)?.kind;
  const api = {
    get values() {
      return structuredClone(values);
    },
    fields() {
      return listTemplateFields(editor.presentation, values);
    },
    status() {
      return templateStatus(editor.presentation, values);
    },
    preview() {
      return previewTemplate(editor.presentation, values);
    },
    set(id, value) {
      if (!declared().has(id)) throw fail("unknown-variable", `No variable '${id}' is declared.`, { id });
      if (value === undefined || value === null) {
        delete values[id];
      } else {
        const coerced = coerceVariableValue(kindOf(id), value);
        if (!coerced.ok) throw fail("invalid-variable-value", `Value for '${id}': ${coerced.message}.`, { id });
        values[id] = coerced.value;
      }
      emit();
      return api;
    },
    setText(id, text) {
      if (!declared().has(id)) throw fail("unknown-variable", `No variable '${id}' is declared.`, { id });
      const parsed = fieldTextToValue(kindOf(id), text);
      if (!parsed.ok) return parsed;
      api.set(id, parsed.value);
      return { ok: true, value: parsed.value };
    },
    clear(id) {
      return api.set(id, undefined);
    },
    /** Drop values for variables the document no longer declares (after an edit removed one). */
    prune() {
      const known = declared();
      let changed = false;
      for (const id of Object.keys(values)) if (!known.has(id)) { delete values[id]; changed = true; }
      if (changed) emit();
      return api;
    },
    reset() {
      values = {};
      emit();
      return api;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /**
     * Fill the document: the variables are resolved with the values, and the concrete deck replaces the
     * document as one undoable, validated edit. Unfilled required variables refuse the fill unless
     * `partial` is set (the unfilled ones stay declared for a later pass).
     */
    apply({ partial = false, meta = {} } = {}) {
      const presentation = editor.presentation;
      const result = resolveVariables(presentation, values, { partial, template: false });
      const errors = result.diagnostics.filter((entry) => entry.severity === "error");
      if (errors.length) {
        const unfilled = errors.some((entry) => entry.code === "variable-unfilled");
        throw fail(unfilled ? "unfilled-variables" : "invalid-variables", errors[0].message, { issues: errors, unfilled: result.unfilled });
      }
      const change = editor.applyPatch([{ op: "replace", path: "", value: result.presentation }], {
        source: "template-fill",
        rejectInvalid: true,
        ...meta,
        ...options.meta,
      });
      values = {};
      emit();
      return { ...change, unfilled: result.unfilled, complete: result.complete, diagnostics: result.diagnostics };
    },
  };
  return api;
}

/** The token text for a variable or a built-in name: `{{id}}`, or `{{id|format}}` with a one-off format. */
export function variableToken(id, format) {
  if (!VARIABLE_ID.test(id) && !BUILTIN_NAME.test(id)) throw fail("invalid-variable-id", "A variable id is lowercase kebab-case: letters, digits and hyphens, starting with a letter.", { id });
  return format ? `{{${id}|${format}}}` : `{{${id}}}`;
}

/** An unused variable id derived from a label, for a "new variable" form. */
export function suggestVariableId(presentation, label = "value") {
  const base = String(label).normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/^[^a-z]+/, "") || "value";
  const taken = new Set(isObject(presentation?.variables) ? Object.keys(presentation.variables) : []);
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

function declarationPatches(presentation, id, declaration) {
  if (!VARIABLE_ID.test(id)) throw fail("invalid-variable-id", "A variable id is lowercase kebab-case: letters, digits and hyphens, starting with a letter.", { id });
  const entry = typeof declaration === "string" ? declaration : structuredClone(declaration);
  if (typeof entry !== "string" && !(isObject(entry) && KINDS.includes(entry.type))) {
    throw fail("invalid-variable", `A variable declaration is a hex color or an object whose type is one of ${KINDS.join(", ")}.`, { id });
  }
  const variables = presentation.variables;
  if (variables !== undefined && !isObject(variables)) throw fail("invalid-variable", "The document's variables field is not an object.", { id });
  if (variables && Object.hasOwn(variables, id)) throw fail("variable-exists", `A variable '${id}' is already declared.`, { id });
  return variables === undefined
    ? [{ op: "add", path: "/variables", value: { [id]: entry } }]
    : [{ op: "add", path: opfPathToJsonPointer(["variables", id]), value: entry }];
}

/** Declare a variable as one undoable edit. The resulting document must validate (a required variable with no value needs `template: true`). */
export function declareVariable(editor, id, declaration, meta = {}) {
  checkEditor(editor);
  return editor.applyPatch(declarationPatches(editor.presentation, id, declaration), { source: "template-variable", rejectInvalid: true, ...meta });
}

/** Mark the document as a template (or, with `false`, as a normal deck) as one undoable edit. */
export function setTemplate(editor, enabled, meta = {}) {
  checkEditor(editor);
  const presentation = editor.presentation;
  const present = Object.hasOwn(presentation, "template");
  const patches = enabled
    ? [{ op: present ? "replace" : "add", path: "/template", value: true }]
    : present
      ? [{ op: "remove", path: "/template" }]
      : [];
  if (!patches.length) return { presentation, patches: [], inversePatches: [], validation: editor.validation };
  return editor.applyPatch(patches, { source: "template-mode", rejectInvalid: true, ...meta });
}

/**
 * Insert a variable token into a text field as one undoable edit. `path` addresses a string, or a TextRun[]
 * (`runIndex` picks the run, default the last). `start`/`end` are UTF-16 offsets into that string (a
 * selection is replaced; default: the end). To use a variable that is not declared yet pass `declare`,
 * the declaration, and both changes commit together.
 */
export function insertVariableToken(editor, path, id, { start, end, runIndex, format, declare, meta = {} } = {}) {
  checkEditor(editor);
  const presentation = editor.presentation;
  const token = variableToken(id, format);
  const patches = [];
  // A built-in needs no declaration; an unknown built-in path fails the validated edit.
  const declaredNow = BUILTIN_NAME.test(id) || (isObject(presentation.variables) && Object.hasOwn(presentation.variables, id));
  if (!declaredNow) {
    if (declare === undefined) throw fail("unknown-variable", `No variable '${id}' is declared. Declare it first, or pass its declaration.`, { id });
    patches.push(...declarationPatches(presentation, id, declare));
  }
  const pointer = opfPathToJsonPointer(path);
  const current = getValueAtPath(presentation, path);
  const splice = (text) => {
    const from = start === undefined ? text.length : start;
    const to = end === undefined ? from : end;
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < from || to > text.length) {
      throw fail("invalid-selection", "The selection is outside the text.", { start: from, end: to });
    }
    return `${text.slice(0, from)}${token}${text.slice(to)}`;
  };
  if (typeof current === "string") {
    patches.push({ op: "replace", path: pointer, value: splice(current) });
  } else if (Array.isArray(current) && current.length) {
    const index = runIndex ?? current.length - 1;
    const run = current[index];
    if (typeof run === "string") patches.push({ op: "replace", path: `${pointer}/${index}`, value: splice(run) });
    else if (isObject(run) && typeof run.text === "string") patches.push({ op: "replace", path: `${pointer}/${index}/text`, value: splice(run.text) });
    else throw fail("not-text", "That run has no text to insert into.", { path });
  } else {
    throw fail("not-text", "Select a text field (a string or rich text runs) to insert a variable.", { path });
  }
  const change = editor.applyPatch(patches, { source: "template-token", rejectInvalid: true, ...meta });
  return { ...change, token };
}
