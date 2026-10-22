// Fill template panel (RR-32): the DOM panel over the template model. It lists the document's variables with typed
// inputs (text, number, date, color, URL, list, and an image source with an asset pick or an uploaded file), shows
// which are filled and which still need a value, previews the result as values change, and fills the deck as one
// undoable edit. A second section inserts a variable token into the host's selected text (declaring a new variable
// in the same edit when asked). The panel owns no document state: values live in the fill session until applied.
// Importing this module does not need a DOM; mounting does.
import {
  createTemplateFill,
  insertVariableToken,
  isTemplateDocument,
  listBuiltins,
  setTemplate,
  suggestVariableId,
} from "./templates.js";
import { slideTitle } from "./slides.js";

const KIND_LABELS = { text: "Text", number: "Number", date: "Date", image: "Image", url: "Link", list: "List", color: "Color" };
const STATUS_TEXT = { filled: "Filled", default: "Default value", unfilled: "Needs a value", optional: "Optional" };
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const NEW_VARIABLE_KINDS = ["text", "number", "date", "image", "url", "list"];

let panelCounter = 0;

/** A short display of a built-in's source value. */
function builtinValueText(entry) {
  const value = entry.value;
  const text = Array.isArray(value) ? value.join(", ") : value && typeof value === "object" ? String(value.src ?? "") : String(value ?? "");
  return text.length > 60 ? `${text.slice(0, 57)}...` : text;
}

function h(doc, tag, attributes = {}, ...children) {
  const element = doc.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (value === undefined || value === false) continue;
    if (key === "class") element.className = value;
    else if (key === "text") element.textContent = value;
    else if (key.startsWith("on")) element.addEventListener(key.slice(2), value);
    else element.setAttribute(key, value === true ? "" : String(value));
  }
  for (const child of children) if (child) element.append(child);
  return element;
}

/**
 * Mount the Fill template panel. Options: `editor` (a session), `renderPreview({presentation, variables, slideIndex})`
 * returning an SVG string (or a promise of one) for the live preview (omit for no preview), `getSlideIndex`,
 * `getTarget()` returning `{path, start?, end?}` for the text field a token is inserted into, `onStatus(message,
 * {error})`, `onApply(result)`, `readFile(file)` (default: FileReader as a data URL) for image uploads.
 */
export function createTemplatePanel(container, options) {
  const { editor, renderPreview, getTarget, onStatus, onApply } = options;
  const doc = container.ownerDocument;
  const fill = createTemplateFill(editor);
  const id = `opf-template-${++panelCounter}`;
  let previewSlide = options.getSlideIndex?.() ?? 0;
  let previewToken = 0;
  let destroyed = false;
  const rows = new Map();

  const root = h(doc, "section", { class: "opf-template-panel", "data-opf-component": "template-panel", "aria-label": "Fill template" });
  const summary = h(doc, "p", { class: "opf-template-summary", id: `${id}-summary` });
  const modeLabel = h(doc, "label", { class: "opf-template-mode" });
  const modeBox = h(doc, "input", { type: "checkbox", id: `${id}-mode` });
  modeLabel.append(modeBox, " This presentation is a template (it may have unfilled variables)");
  const fieldList = h(doc, "div", { class: "opf-template-fields" });
  // Built-in variables: read-only values from the document's own speaker, organization and deck fields.
  const builtinList = h(doc, "ul", { class: "opf-template-builtin-list" });
  const builtinSection = h(doc, "details", { class: "opf-template-builtins", "data-opf-component": "template-builtins" },
    h(doc, "summary", { text: "Built-in variables" }),
    h(doc, "p", { class: "opf-template-help", text: "Read from the presentation's own speaker, organization and deck fields; edit those fields to change them. Use them like any variable: {{speaker.name}} inside text, or var:speaker.photo as a whole image field. Slide number, section and slide count vary per slide: write them as {{slide.number}}, {{slide.section}} and {{deck.slideCount}} inside any text, not as a whole var: field. The organization logos are images that follow each slide's background (light or dark artwork): place one as a whole image field, for example var:organization.logo.icon in a header or footer zone's image, or choose it with Insert logo." }),
    builtinList);
  const live = h(doc, "p", { class: "opf-template-live", role: "status", "aria-live": "polite" });
  const applyButton = h(doc, "button", { type: "button", class: "opf-template-apply primary", text: "Fill the presentation" });
  const partialButton = h(doc, "button", { type: "button", class: "opf-template-partial secondary", text: "Fill what is ready" });
  const resetButton = h(doc, "button", { type: "button", class: "opf-template-reset quiet", text: "Clear values" });
  const actions = h(doc, "div", { class: "opf-template-actions" }, applyButton, partialButton, resetButton);
  const slideSelect = h(doc, "select", { id: `${id}-slide` });
  const previewStatus = h(doc, "p", { class: "opf-template-preview-status", role: "status" });
  const previewBox = h(doc, "div", { class: "opf-template-preview", "aria-label": "Preview with these values" });
  const previewSection = renderPreview ? h(doc, "div", { class: "opf-template-preview-section" }, h(doc, "label", { for: `${id}-slide`, text: "Preview" }), slideSelect, previewStatus, previewBox) : null;

  // Insert a variable into the selected text.
  const insertSelect = h(doc, "select", { id: `${id}-insert-variable` });
  const insertButton = h(doc, "button", { type: "button", class: "opf-template-insert secondary", text: "Insert into selected text" });
  const newName = h(doc, "input", { type: "text", id: `${id}-new-name`, placeholder: "e.g. Client name" });
  const newKind = h(doc, "select", { id: `${id}-new-kind` }, ...NEW_VARIABLE_KINDS.map((kind) => h(doc, "option", { value: kind, text: KIND_LABELS[kind] })));
  const newSample = h(doc, "input", { type: "text", id: `${id}-new-sample`, placeholder: "Sample or current value" });
  const newButton = h(doc, "button", { type: "button", class: "opf-template-new secondary", text: "Create and insert" });
  const insertSection = getTarget
    ? h(doc, "details", { class: "opf-template-insert-section" },
      h(doc, "summary", { text: "Insert a variable into text" }),
      h(doc, "p", { class: "opf-template-help", text: "Select a text field on the slide, then choose a variable. The token {{name}} is replaced by its value when the presentation is filled." }),
      h(doc, "label", { for: `${id}-insert-variable`, text: "Variable" }), insertSelect, insertButton,
      h(doc, "fieldset", { class: "opf-template-new-variable" },
        h(doc, "legend", { text: "New variable" }),
        h(doc, "label", { for: `${id}-new-name`, text: "Name" }), newName,
        h(doc, "label", { for: `${id}-new-kind`, text: "Kind" }), newKind,
        h(doc, "label", { for: `${id}-new-sample`, text: "Sample value" }), newSample, newButton))
    : null;

  root.append(summary, modeLabel, fieldList, builtinSection, actions, live);
  if (previewSection) root.append(previewSection);
  if (insertSection) root.append(insertSection);
  container.append(root);

  const say = (message, error = false) => {
    live.textContent = message;
    live.dataset.error = error ? "true" : "false";
    onStatus?.(message, { error });
  };
  const messageOf = (error) => error?.issues?.[0]?.message ?? error?.message ?? String(error);

  function readUpload(file) {
    if (options.readFile) return Promise.resolve(options.readFile(file));
    return new Promise((resolve, reject) => {
      const reader = new (doc.defaultView.FileReader)();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("The file could not be read."));
      reader.readAsDataURL(file);
    });
  }

  function control(field) {
    const base = { id: `${id}-field-${field.id}`, "aria-describedby": `${id}-help-${field.id} ${id}-error-${field.id}` };
    let input;
    switch (field.kind) {
      case "list":
        input = h(doc, "textarea", { ...base, rows: 4, placeholder: field.placeholder });
        break;
      case "date":
        input = h(doc, "input", { ...base, type: "date" });
        break;
      case "url":
        input = h(doc, "input", { ...base, type: "url", placeholder: field.placeholder, inputmode: "url" });
        break;
      case "number":
        input = h(doc, "input", { ...base, type: "text", inputmode: "decimal", placeholder: field.placeholder });
        break;
      case "color":
        input = h(doc, "input", { ...base, type: "text", placeholder: field.placeholder || "#0F4C81", maxlength: 9 });
        break;
      default:
        input = h(doc, "input", { ...base, type: "text", placeholder: field.placeholder });
    }
    input.value = field.text;
    return input;
  }

  function buildRow(field) {
    const input = control(field);
    const error = h(doc, "p", { class: "opf-template-error", id: `${id}-error-${field.id}`, role: "alert", hidden: true });
    const status = h(doc, "span", { class: "opf-template-status" });
    const help = h(doc, "p", { class: "opf-template-help", id: `${id}-help-${field.id}` });
    const useDefault = h(doc, "button", { type: "button", class: "opf-template-default quiet", text: "Use default" });
    const extras = [];
    let colorInput;
    let assetSelect;
    let fileInput;
    if (field.kind === "color") {
      colorInput = h(doc, "input", { type: "color", "aria-label": `${field.label} color picker` });
      colorInput.addEventListener("input", () => {
        input.value = colorInput.value.toUpperCase();
        commit();
      });
      extras.push(colorInput);
    }
    if (field.kind === "image") {
      const assets = editor.presentation.assets && typeof editor.presentation.assets === "object" ? Object.keys(editor.presentation.assets) : [];
      if (assets.length) {
        assetSelect = h(doc, "select", { "aria-label": `${field.label}: pick a registered asset` }, h(doc, "option", { value: "", text: "Pick an asset…" }), ...assets.map((key) => h(doc, "option", { value: `asset:${key}`, text: key })));
        assetSelect.addEventListener("change", () => {
          if (!assetSelect.value) return;
          input.value = assetSelect.value;
          commit();
          assetSelect.value = "";
        });
        extras.push(assetSelect);
      }
      fileInput = h(doc, "input", { type: "file", accept: "image/*", "aria-label": `${field.label}: upload an image` });
      fileInput.addEventListener("change", async () => {
        const file = fileInput.files?.[0];
        if (!file) return;
        if (file.size > MAX_IMAGE_BYTES) {
          showError(`That image is ${(file.size / 1048576).toFixed(1)} MB; the limit is 5 MB.`);
          return;
        }
        try {
          input.value = await readUpload(file);
          commit();
        } catch (failure) {
          showError(messageOf(failure));
        }
      });
      extras.push(fileInput);
    }
    const label = h(doc, "label", { for: input.id }, field.label, field.required ? h(doc, "span", { class: "opf-required", "aria-hidden": "true", text: " *" }) : null, h(doc, "span", { class: "opf-template-kind", text: ` (${KIND_LABELS[field.kind]})` }));
    const element = h(doc, "div", { class: "opf-template-field", "data-variable": field.id, "data-kind": field.kind }, label, status, input, ...extras, help, error, useDefault);

    function showError(message) {
      error.hidden = !message;
      error.textContent = message ?? "";
      input.setAttribute("aria-invalid", message ? "true" : "false");
    }
    function commit() {
      const parsed = fill.setText(field.id, input.value);
      showError(parsed.ok ? undefined : parsed.message);
    }
    input.addEventListener("input", commit);
    useDefault.addEventListener("click", () => {
      input.value = "";
      fill.clear(field.id);
      showError(undefined);
    });
    return { element, input, status, help, useDefault, colorInput, showError };
  }

  function rebuild() {
    fill.prune();
    const fields = fill.fields();
    rows.clear();
    fieldList.replaceChildren();
    if (!fields.length) {
      fieldList.append(h(doc, "p", { class: "opf-template-empty", text: "This presentation has no variables yet. Declare variables in the source, or insert one from a text field below." }));
    }
    for (const field of fields) {
      const row = buildRow(field);
      rows.set(field.id, row);
      fieldList.append(row.element);
    }
    const builtins = listBuiltins(editor.presentation);
    insertSelect.replaceChildren(
      ...fields.map((field) => h(doc, "option", { value: field.id, text: `${field.label} (${KIND_LABELS[field.kind]})` })),
      // A slide-scoped image (an organization logo) is a whole-field var: reference, not a {{ }} token for text.
      ...(builtins.length ? [h(doc, "optgroup", { label: "Built-in variables" }, ...builtins.filter((entry) => !(entry.scope === "slide" && entry.kind === "image")).map((entry) => h(doc, "option", { value: entry.name, text: `${entry.label} (${entry.name})` })))] : []),
    );
    builtinSection.hidden = !builtins.length;
    builtinList.replaceChildren(...builtins.map((entry) => {
      const uses = entry.uses.length;
      // A slide-scoped built-in has no single value: each slide gets its own when it is drawn or exported (FA-31).
      const slideScoped = entry.scope === "slide";
      // RR-71: an organization logo is an image placed by var:, and the artwork follows each slide's background.
      const logoImage = slideScoped && entry.kind === "image";
      const shown = logoImage ? h(doc, "em", { text: "image; light or dark artwork per slide" }) : slideScoped ? h(doc, "em", { text: "varies per slide" }) : entry.available ? builtinValueText(entry) : h(doc, "em", { text: "not set" });
      return h(doc, "li", { "data-builtin": entry.name, "data-kind": entry.kind, "data-scope": entry.scope, "data-available": entry.available ? "true" : "false" },
        h(doc, "code", { text: logoImage ? `var:${entry.name}` : `{{${entry.name}}}` }), ` ${entry.label}: `, shown, slideScoped && !logoImage && !entry.available ? " (no slide has one yet)" : "", logoImage && !entry.available ? " (no logo yet)" : "", uses ? ` (used ${uses} time${uses === 1 ? "" : "s"})` : "");
    }));
    slideSelect.replaceChildren(...(editor.presentation.slides ?? []).map((slide, index) => h(doc, "option", { value: String(index), text: `${index + 1}. ${slideTitle(slide) || "Untitled"}` })));
    previewSlide = Math.min(previewSlide, Math.max(0, (editor.presentation.slides?.length ?? 1) - 1));
    slideSelect.value = String(previewSlide);
    modeBox.checked = isTemplateDocument(editor.presentation);
    update();
  }

  function update() {
    const fields = fill.fields();
    const status = fill.status();
    for (const field of fields) {
      const row = rows.get(field.id);
      if (!row) continue;
      row.element.dataset.status = field.status;
      row.status.textContent = STATUS_TEXT[field.status];
      row.useDefault.hidden = field.status !== "filled";
      const uses = field.uses.length;
      row.help.textContent = [
        field.description,
        uses ? `Used in ${uses} place${uses === 1 ? "" : "s"}.` : "Not used anywhere yet.",
        field.kind === "list" ? "One entry per line." : undefined,
        field.kind === "number" ? "Digits only, no thousands separators." : undefined,
        field.kind === "date" ? "A calendar date." : undefined,
        field.rich ? "Rich text: its formatting stays until you type a replacement." : undefined,
        field.format ? `Shown as ${field.format}.` : undefined,
      ].filter(Boolean).join(" ");
      if (row.colorInput) {
        const hex = /^#[0-9a-fA-F]{6}$/.test(row.input.value) ? row.input.value : /^#[0-9a-fA-F]{6}$/.test(field.placeholder) ? field.placeholder : "#000000";
        row.colorInput.value = hex.toLowerCase();
      }
    }
    const waiting = status.unfilled.length;
    summary.textContent = status.fieldCount
      ? waiting
        ? `${status.filledRequiredCount} of ${status.requiredCount} required variables filled. Still needed: ${status.unfilled.join(", ")}.`
        : `All ${status.requiredCount} required variables have a value.`
      : "No variables.";
    applyButton.disabled = !status.fieldCount || waiting > 0;
    partialButton.disabled = !status.fieldCount || waiting === 0 || waiting === status.fieldCount;
    resetButton.disabled = Object.keys(fill.values).length === 0;
    insertButton.disabled = !insertSelect.options.length;
    drawPreview();
  }

  async function drawPreview() {
    if (!renderPreview) return;
    const token = ++previewToken;
    try {
      const svg = await renderPreview({ presentation: editor.presentation, variables: fill.values, slideIndex: previewSlide });
      if (token !== previewToken || destroyed) return;
      previewBox.innerHTML = svg;
      const preview = fill.preview();
      const sample = preview.examplesUsed.length;
      previewStatus.textContent = sample ? `Previewing with example values for: ${preview.examplesUsed.join(", ")}.` : "";
    } catch (error) {
      if (token !== previewToken || destroyed) return;
      previewBox.replaceChildren();
      previewStatus.textContent = `Preview unavailable: ${messageOf(error)}`;
    }
  }

  async function apply(partial) {
    try {
      const result = fill.apply({ partial });
      say(partial && !result.complete ? `Filled what was ready. Still needed: ${result.unfilled.join(", ")}.` : "Filled the presentation. Undo restores the template.");
      onApply?.(result);
    } catch (error) {
      say(messageOf(error), true);
    }
  }
  applyButton.addEventListener("click", () => apply(false));
  partialButton.addEventListener("click", () => apply(true));
  resetButton.addEventListener("click", () => {
    fill.reset();
    for (const row of rows.values()) {
      row.input.value = "";
      row.showError(undefined);
    }
    say("Cleared the values.");
  });
  slideSelect.addEventListener("change", () => {
    previewSlide = Number(slideSelect.value) || 0;
    drawPreview();
  });
  modeBox.addEventListener("change", () => {
    try {
      setTemplate(editor, modeBox.checked);
      say(modeBox.checked ? "Marked as a template." : "Marked as a normal presentation.");
    } catch (error) {
      modeBox.checked = isTemplateDocument(editor.presentation);
      say(messageOf(error), true);
    }
  });

  function insertTarget() {
    const target = getTarget?.();
    if (!target?.path) {
      say("Select a text field first.", true);
      return undefined;
    }
    return target;
  }
  insertButton.addEventListener("click", () => {
    const target = insertTarget();
    if (!target || !insertSelect.value) return;
    try {
      const result = insertVariableToken(editor, target.path, insertSelect.value, { start: target.start, end: target.end });
      say(`Inserted ${result.token}.`);
    } catch (error) {
      say(messageOf(error), true);
    }
  });
  newButton.addEventListener("click", () => {
    const target = insertTarget();
    if (!target) return;
    const name = newName.value.trim();
    if (!name) {
      say("Give the new variable a name.", true);
      return;
    }
    const variableId = suggestVariableId(editor.presentation, name);
    const kind = newKind.value;
    const declaration = { type: kind, label: name };
    const sample = newSample.value.trim();
    if (sample) {
      // A template keeps the sample as an example (the slot stays unfilled); a normal deck needs a real value.
      const field = isTemplateDocument(editor.presentation) ? "example" : "value";
      declaration[field] = kind === "number" && Number.isFinite(Number(sample)) ? Number(sample) : kind === "list" ? sample.split(/\r?\n|,/).map((entry) => entry.trim()).filter(Boolean) : sample;
    }
    try {
      const result = insertVariableToken(editor, target.path, variableId, { start: target.start, end: target.end, declare: declaration });
      newName.value = "";
      newSample.value = "";
      say(`Created ${variableId} and inserted ${result.token}.`);
    } catch (error) {
      say(messageOf(error), true);
    }
  });

  const unsubscribeEditor = editor.subscribe(() => rebuild());
  const unsubscribeFill = fill.subscribe(() => update());
  rebuild();

  return {
    element: root,
    fill,
    /** Re-read the session (after the host changed the document or the slide). */
    refresh() {
      previewSlide = options.getSlideIndex?.() ?? previewSlide;
      rebuild();
    },
    destroy() {
      destroyed = true;
      unsubscribeEditor();
      unsubscribeFill();
      root.remove();
    },
  };
}

