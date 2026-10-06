// Design controls (RR-06): the DOM panel for the dimension switches, the design options, block
// conversion, chart type and table style/merge. Every control commits one validated, undoable
// change through the session (switchDimension, setDesignOption, setLogoVariant,
// setHeaderFooterZone, convertBlock, setTableStyle, mergeTableCells, ...), so a host that already
// subscribes to the session redraws on every change, on Undo and on Redo. The panel owns no
// document state: it reads the session, mirrors it into native form controls, and reports
// problems in a live region. Importing this module does not need a DOM; mounting does.
import { compatibleChartTypes, currentSwitchValue, listSwitchOptions, switchDimension } from "./switches.js";
import { DEFAULT_MAX_IMAGE_BYTES, IMAGE_ACCEPT, applyImageUpload, assetIdOf, setAssetAlt } from "./assets.js";
import {
  COLOR_NAMES,
  IMAGE_BACKGROUND_FITS,
  PATTERN_GROUPS,
  THEME_BACKGROUND_SLOTS,
  prepareBackground,
  readBackground,
  setBackground,
} from "./background-options.js";
import { BLOCK_KIND_LABELS, blockConversionTargets, blockPathForSelection, readBlockContent } from "./block-convert.js";
import {
  DATE_FORMAT_TOKENS,
  HEADER_FOOTER_ZONES,
  LOGO_VARIANTS,
  designWarnings,
  getDesignOption,
  headerFooterState,
  prepareHeaderFooterZone,
  prepareLogoVariant,
  prepareDesignOption,
  readHeaderFooterZone,
  readLogoVariants,
  setDesignOption,
  setHeaderFooterZone,
  setLogoVariant,
} from "./design-options.js";
import { createContentControls } from "./content-controls.js";
import { describeTableCell, mergeTableCells, parseTableCellPath, readTableStyle, setTableCellStyle, setTableStyle, splitTableCell } from "./table-options.js";

/** The sections a panel can show. `selection` and `table` follow the current selection; the rest follow the deck or the current slide. */
export const DESIGN_CONTROL_SECTIONS = Object.freeze(["look", "background", "slide-image", "header-footer", "brand", "layout-options", "info", "selection", "table", "slide-content"]);

const SECTION_TITLES = {
  look: "Look and language",
  background: "Background",
  "slide-image": "Slide image",
  "header-footer": "Header and footer",
  brand: "Logo, watermark and bullets",
  "layout-options": "Alignment and arrangement",
  info: "Audience and story",
  selection: "Selected content",
  table: "Table",
  "slide-content": "Slide structure",
};
const OPEN_BY_DEFAULT = new Set(["look", "selection", "table"]);
const LOGO_VARIANT_LABELS = {
  default: "Default",
  light: "Light (for dark backgrounds)",
  dark: "Dark (for light backgrounds)",
  stacked: "Stacked",
  stackedLight: "Stacked, light",
  stackedDark: "Stacked, dark",
  icon: "Icon",
  iconLight: "Icon, light",
  iconDark: "Icon, dark",
  wordmark: "Wordmark",
  wordmarkLight: "Wordmark, light",
  wordmarkDark: "Wordmark, dark",
};
const CELL_FILLS = [
  ["", "No fill"],
  ["primary", "Primary"],
  ["secondary", "Secondary"],
  ["accent", "Accent"],
  ["surface", "Surface"],
  ["background", "Background"],
  ["text", "Text color"],
];
const SHAPES = ["rectangle", "rounded", "circle", "hexagon"];
const POSITIONS = ["background", "top", "bottom", "left", "right"];
const BLOCK_REPLACEMENTS = ["text", "list", "chart", "table", "metric", "quote", "code", "timeline", "group"];

let instances = 0;

const messageOf = (error) => error?.issues?.[0]?.message ?? error?.message ?? String(error);
const titleCase = (text) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Mount the controls into `container` and return `{ element, refresh, destroy }`.
 *
 * Options: `editor` (an editor session), `getSlideIndex()` and `getSelectedPath()` (the host's current
 * slide and selection; call `refresh()` when they change), `sections` (default: all), `scope`
 * ("deck" or "slide", the initial "Applies to" choice), `catalogs`/`catalogSources` (caller-loaded
 * catalog records), `onChange(change)`, `onStatus(message, { error })` and `onSelectPath(path)`, called
 * after a content conversion or replacement with the path to keep selected (the block, or the inline
 * payload field), because the host's old selection path may no longer exist.
 */
export function createDesignControls(container, options = {}) {
  const editor = options.editor;
  if (!editor || typeof editor.applyPatch !== "function" || typeof editor.subscribe !== "function") throw new TypeError("createDesignControls needs an editor session.");
  if (!container || typeof container.appendChild !== "function") throw new TypeError("createDesignControls needs a container element.");
  const doc = container.ownerDocument;
  const uid = `opf-dc-${++instances}`;
  const sections = (options.sections ?? DESIGN_CONTROL_SECTIONS).filter((name) => DESIGN_CONTROL_SECTIONS.includes(name));
  const getSlide = () => options.getSlideIndex?.() ?? 0;
  const getSelected = () => options.getSelectedPath?.();
  const catalogOptions = () => ({ catalogs: options.catalogs, catalogSources: options.catalogSources });
  const state = { scope: options.scope === "slide" ? "slide" : "deck" };
  const syncs = [];
  let destroyed = false;
  // After a refused change the field the person typed in is reset too, even though it still has focus.
  let restoring = false;
  // The background form is a draft until Apply; edits to it survive unrelated refreshes.
  let backgroundDirty = false;
  const maxImageBytes = options.maxImageBytes ?? DEFAULT_MAX_IMAGE_BYTES;
  const sizeLabel = `${maxImageBytes >= 1024 * 1024 ? `${+(maxImageBytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(maxImageBytes / 1024)} KB`}`;

  const h = (tag, attrs = {}, ...children) => {
    const node = doc.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (value === undefined || value === false || value === null) continue;
      if (key === "class") node.className = value;
      else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
      else if (value === true) node.setAttribute(key, "");
      else node.setAttribute(key, String(value));
    }
    for (const child of children.flat()) if (child !== undefined && child !== null && child !== false) node.append(child);
    return node;
  };

  const root = h("div", { class: "opf-design-controls", "data-opf-component": "design-controls" });
  const statusEl = h("p", { class: "opf-dc-status", role: "status", "aria-live": "polite" });
  const errorEl = h("p", { class: "opf-dc-error", role: "alert" });

  const say = (message) => {
    errorEl.textContent = "";
    statusEl.textContent = message;
    options.onStatus?.(message, { error: false });
  };
  const complain = (message) => {
    statusEl.textContent = "";
    errorEl.textContent = message;
    options.onStatus?.(message, { error: true });
  };
  const reselect = (blockPath) => {
    if (!blockPath || !options.onSelectPath) return;
    const content = readBlockContent(editor.document, blockPath);
    options.onSelectPath(content && !content.explicit ? `${blockPath}.${content.key}` : blockPath);
  };
  /** Run a change; report its outcome; on failure restore every control to the document. */
  const run = (action, done) => {
    try {
      const change = action();
      const warnings = change?.warnings?.length ? ` ${change.warnings.map((warning) => warning.message).join(" ")}` : "";
      if (change && change.changed === false) say("Already set. Nothing changed.");
      else say(`${typeof done === "function" ? done(change) : (done ?? "Changed.")}${warnings} Undo restores the previous state.`);
      options.onChange?.(change);
    } catch (error) {
      complain(messageOf(error));
      restoring = true;
      try {
        sync();
      } finally {
        restoring = false;
      }
    }
  };

  // --- field builders ----------------------------------------------------------------------------

  let fieldCount = 0;
  const nextId = (name) => `${uid}-${name}-${++fieldCount}`;

  function wrapField(id, label, control, { help, extra } = {}) {
    const note = h("span", { class: "opf-dc-note" });
    const labelEl = h("label", { for: id }, label, note);
    const helpEl = help ? h("p", { class: "opf-dc-help", id: `${id}-help` }, help) : undefined;
    if (helpEl) control.setAttribute("aria-describedby", helpEl.id);
    const wrap = h("div", { class: "opf-dc-field" }, labelEl, control, extra, helpEl);
    return { wrap, note, label: labelEl };
  }

  function selectField(name, label, { empty, help, multiple, size, onChange } = {}) {
    const id = nextId(name);
    const select = h("select", { id, multiple: multiple || undefined, size: multiple ? (size ?? 6) : undefined });
    const { wrap, note } = wrapField(id, label, select, { help });
    let signature = "";
    const api = {
      wrap,
      select,
      setOptions(list) {
        const next = JSON.stringify(list.map((entry) => [entry.value, entry.label, entry.disabled ?? false, entry.title ?? "", entry.group ?? ""]));
        if (next === signature) return;
        signature = next;
        const entries = empty === undefined ? list : [{ value: "", label: empty }, ...list];
        const optionNode = (entry) => h("option", { value: entry.value, disabled: entry.disabled || undefined, title: entry.title }, entry.label);
        const nodes = [];
        for (const entry of entries) {
          if (!entry.group) nodes.push(optionNode(entry));
          else {
            let groupNode = nodes.find((node) => node.tagName === "OPTGROUP" && node.label === entry.group);
            if (!groupNode) nodes.push((groupNode = h("optgroup", { label: entry.group })));
            groupNode.append(optionNode(entry));
          }
        }
        select.replaceChildren(...nodes);
      },
      set(value, noteText = "") {
        note.textContent = noteText ? ` (${noteText})` : "";
        if (multiple) {
          const wanted = new Set(Array.isArray(value) ? value : value === undefined ? [] : [value]);
          for (const option of select.options) option.selected = wanted.has(option.value);
          return;
        }
        const wanted = value === undefined || value === null ? "" : String(value);
        select.querySelector("option[data-custom]")?.remove();
        if (![...select.options].some((option) => option.value === wanted)) {
          select.append(h("option", { value: wanted, "data-custom": "", disabled: true }, wanted === "" ? "Not set" : `${wanted} (custom)`));
        }
        select.value = wanted;
      },
    };
    if (onChange) select.addEventListener("change", () => onChange(multiple ? [...select.selectedOptions].map((option) => option.value) : select.value));
    return api;
  }

  function textField(name, label, { help, placeholder, list, onCommit, type = "text" } = {}) {
    const id = nextId(name);
    const input = h("input", { id, type, placeholder, list: list ? `${id}-list` : undefined, autocomplete: "off", spellcheck: "false" });
    const datalist = list ? h("datalist", { id: `${id}-list` }) : undefined;
    const { wrap, note } = wrapField(id, label, input, { help, extra: datalist });
    const api = {
      wrap,
      input,
      setList(values) {
        if (datalist) datalist.replaceChildren(...values.map((value) => h("option", { value })));
      },
      set(value, noteText = "") {
        note.textContent = noteText ? ` (${noteText})` : "";
        // Never overwrite what the person is typing; they commit with Enter or by leaving the field.
        if (restoring || doc.activeElement !== input) input.value = value ?? "";
      },
    };
    if (onCommit) input.addEventListener("change", () => onCommit(input.value));
    return api;
  }

  function numberField(name, label, { min, max, step, help, onCommit } = {}) {
    const field = textField(name, label, { help, type: "number", onCommit: onCommit ? (value) => onCommit(value === "" ? null : Number(value)) : undefined });
    for (const [key, value] of Object.entries({ min, max, step })) if (value !== undefined) field.input.setAttribute(key, String(value));
    return field;
  }

  function checkField(name, label, { help, onChange } = {}) {
    const id = nextId(name);
    const input = h("input", { id, type: "checkbox" });
    const helpEl = help ? h("p", { class: "opf-dc-help", id: `${id}-help` }, help) : undefined;
    if (helpEl) input.setAttribute("aria-describedby", helpEl.id);
    const note = h("span", { class: "opf-dc-note" });
    const wrap = h("div", { class: "opf-dc-field opf-dc-check" }, input, h("label", { for: id }, label, note), helpEl);
    if (onChange) input.addEventListener("change", () => onChange(input.checked));
    return {
      wrap,
      input,
      set(checked, noteText = "") {
        note.textContent = noteText ? ` (${noteText})` : "";
        input.checked = Boolean(checked);
      },
    };
  }

  const button = (label, onClick, { quiet = false, title } = {}) => h("button", { type: "button", class: quiet ? "quiet" : "secondary", title, onclick: onClick }, label);

  /**
   * Source text, file upload and alt text for one image. `apply(ref | null)` commits a typed source (null removes it);
   * `build(ref, document)` prepares the change an upload makes, after its asset patch, in the same undo step.
   */
  function imageCluster(name, label, { apply, build, help }) {
    const source = textField(`${name}-source`, `${label} source`, {
      list: true,
      placeholder: "asset:photo or https://…",
      help: help ?? "An asset reference, a web address or a data address. Press Enter to apply; clear the field to remove it.",
      onCommit: (value) => {
        const ref = value.trim();
        run(() => apply(ref === "" ? null : ref), ref === "" ? `${label} removed.` : `${label} changed.`);
      },
    });
    const fileId = nextId(`${name}-file`);
    const input = h("input", { id: fileId, type: "file", accept: IMAGE_ACCEPT, "aria-describedby": `${fileId}-help` });
    const fileWrap = h(
      "div",
      { class: "opf-dc-field" },
      h("label", { for: fileId }, `Upload ${label.toLowerCase()} file`),
      input,
      h("p", { class: "opf-dc-help", id: `${fileId}-help` }, `PNG, JPEG, GIF, WebP or SVG, up to ${sizeLabel}. It is added to the presentation's assets (or handed to your app) and used here in one undoable step.`),
    );
    let lastRef = "";
    let lastKey = "";
    const alt = textField(`${name}-alt`, `${label} alt text`, {
      help: "Describes the image for screen readers. Saved with the image's asset; typed before an upload, it is used for that upload. Press Enter to apply.",
      onCommit: (value) => {
        const id = assetIdOf(lastRef);
        if (!id || editor.document.assets?.[id] === undefined) return;
        run(() => setAssetAlt(editor, id, value), "Alt text saved.");
      },
    });
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      input.value = "";
      if (!file) return;
      statusEl.textContent = `Adding ${file.name}…`;
      errorEl.textContent = "";
      try {
        const change = await applyImageUpload(editor, file, build, { alt: alt.input.value, maxBytes: maxImageBytes, onAddAsset: options.onAddAsset });
        const warnings = change.prepared?.warnings?.length ? ` ${change.prepared.warnings.map((warning) => warning.message).join(" ")}` : "";
        say(`${label} set to ${file.name}${change.assetId ? `, added to assets as ${change.assetId}` : ""}.${warnings} Undo restores the previous state.`);
        options.onChange?.(change);
      } catch (error) {
        complain(messageOf(error));
        sync();
      }
    });
    const wrap = h("div", { class: "opf-dc-cluster" }, source.wrap, fileWrap, alt.wrap);
    return {
      wrap,
      source,
      alt,
      refreshAssets: () => source.setList(assetList()),
      // `key` names what the image is for (variant, zone, slide, scope): alt text typed for one target is not offered to another.
      set(ref, note = "", key = "") {
        const targetChanged = (ref ?? "") !== lastRef || key !== lastKey;
        lastKey = key;
        lastRef = ref ?? "";
        source.setList(assetList());
        source.set(lastRef, note);
        const id = assetIdOf(lastRef);
        const entry = id ? editor.document.assets?.[id] : undefined;
        // Alt text belongs to one image: another target (variant, zone, slide) never inherits what was typed for the last one.
        alt.set(entry && typeof entry === "object" && typeof entry.alt === "string" ? entry.alt : "");
        // The field keeps what is being typed, except when the image it describes has changed.
        if (targetChanged) alt.input.value = entry && typeof entry === "object" && typeof entry.alt === "string" ? entry.alt : "";
      },
    };
  }

  function group(section) {
    const body = h("div", { class: "opf-dc-body" });
    const details = h("details", { class: "opf-dc-group", "data-section": section, open: OPEN_BY_DEFAULT.has(section) || undefined }, h("summary", {}, SECTION_TITLES[section]), body);
    return { details, body };
  }

  // --- scope --------------------------------------------------------------------------------------

  const target = () => `${state.scope}:${state.scope === "slide" ? getSlide() : ""}`;
  const scopeIndex = () => (state.scope === "slide" ? getSlide() : undefined);
  const scoped = (extra = {}) => (state.scope === "slide" ? { slideIndex: getSlide(), ...extra } : extra);
  const sourceNote = (scope, inherited) => (state.scope === "slide" ? (scope === "slide" ? "set on this slide" : inherited ? "from the presentation" : "default") : "");
  const scopeNeeded = sections.some((name) => ["look", "background", "slide-image", "header-footer", "brand", "layout-options"].includes(name));
  let scopeField;
  if (scopeNeeded) {
    scopeField = selectField("scope", "Applies to", {
      help: "Choose the whole presentation, or only the slide you are looking at.",
      onChange: (value) => {
        state.scope = value === "slide" ? "slide" : "deck";
        sync();
      },
    });
    scopeField.setOptions([
      { value: "deck", label: "Whole presentation" },
      { value: "slide", label: "This slide only" },
    ]);
    scopeField.set(state.scope);
    root.append(scopeField.wrap);
  }

  const assetList = () => Object.keys(editor.document.assets ?? {}).map((id) => `asset:${id}`);
  const stringOf = (value) => (typeof value === "string" ? value : value && typeof value === "object" && typeof value.src === "string" ? value.src : "");
  const isCustomObject = (value) => Boolean(value) && typeof value === "object";

  const built = {};
  for (const section of sections) built[section] = group(section);
  // RR-26: list levels, grouping, regions and images between content and design (content-controls.js).
  const contentControls = built.selection || built["slide-content"] ? createContentControls({ editor, h, selectField, run, nextId, getSlide, reselect }) : undefined;

  // --- look and language --------------------------------------------------------------------------

  if (built.look) {
    const { body } = built.look;
    const catalogField = (name, label, dimension, { help, perSlide = true } = {}) => {
      const field = selectField(name, label, {
        help,
        onChange: (value) => run(() => switchDimension(editor, dimension, value, { ...(perSlide ? scoped() : {}), ...catalogOptions() }), `${label} set to ${field.select.selectedOptions[0]?.textContent ?? value}.`),
      });
      body.append(field.wrap);
      syncs.push(() => {
        field.setOptions(listSwitchOptions(editor.document, dimension, catalogOptions()).map((entry) => ({ value: entry.id, label: entry.label })));
        const current = currentSwitchValue(editor.document, dimension, perSlide ? scoped() : {});
        field.set(current.value, perSlide ? sourceNote(current.scope, current.value !== undefined) : "");
      });
      return field;
    };
    catalogField("theme", "Theme", "themes", { help: "A theme also sets its color scheme, font scheme and background." });
    catalogField("color-scheme", "Color scheme", "color-schemes");
    catalogField("font-scheme", "Font scheme", "font-schemes", { help: "Fonts the preview and export use. The preview shows an open look-alike where a font is not bundled." });
    catalogField("language", "Language", "languages", { perSlide: false, help: "Sets the language for the whole presentation, including its script fonts." });
    // RR-41: one size for the whole presentation; the slides recompose and the export writes the matching slide size.
    const slideSize = selectField("slide-size", "Slide size", {
      help: "The size and shape of every slide. The preview recomposes at the new size.",
      onChange: (value) => run(() => switchDimension(editor, "slide-sizes", value), `Slide size set to ${slideSize.select.selectedOptions[0]?.textContent ?? value}.`),
    });
    body.append(slideSize.wrap);
    syncs.push(() => {
      slideSize.setOptions(listSwitchOptions(editor.document, "slide-sizes").map((entry) => ({ value: entry.id, label: entry.label })));
      const { value } = currentSwitchValue(editor.document, "slide-sizes");
      slideSize.set(value && typeof value === "object" ? "Custom size" : value);
    });

    const layout = selectField("layout", "Layout of this slide", {
      help: "Adds the blank placeholders the layout declares and keeps your content.",
      onChange: (value) => run(() => switchDimension(editor, "layouts", value, { slideIndex: getSlide(), ...catalogOptions() }), `Layout changed to ${layout.select.selectedOptions[0]?.textContent ?? value}.`),
    });
    body.append(layout.wrap);
    syncs.push(() => {
      layout.setOptions(listSwitchOptions(editor.document, "layouts", catalogOptions()).map((entry) => ({ value: entry.id, label: entry.label })));
      layout.set(currentSwitchValue(editor.document, "layouts", { slideIndex: getSlide() }).value);
    });
  }

  // --- background ---------------------------------------------------------------------------------

  if (built.background) {
    const { body } = built.background;
    const typeSelect = selectField("bg-type", "Background type", { help: "Choose a type and its settings, then Apply. Nothing changes until you apply." });
    typeSelect.setOptions([
      { value: "theme", label: "Theme color" },
      { value: "solid", label: "Solid color" },
      { value: "gradient", label: "Gradient" },
      { value: "image", label: "Image" },
      { value: "pattern", label: "Pattern" },
    ]);
    const panel = (type, title) => h("fieldset", { class: "opf-dc-fieldset", "data-bg-type": type }, h("legend", {}, title));
    const themePanel = panel("theme", "Theme color");
    const slot = selectField("bg-slot", "Theme slot", { help: "Follows the color scheme, so it changes with it." });
    slot.setOptions(THEME_BACKGROUND_SLOTS.map((value) => ({ value, label: value.replace(/(\D+)(\d)/, (_, name, n) => `${titleCase(name)} ${n}`) })));
    themePanel.append(slot.wrap);

    const colorList = [...COLOR_NAMES];
    const solidPanel = panel("solid", "Solid color");
    const solidColor = textField("bg-color", "Color", { list: true, placeholder: "#1F2937 or accent1", help: "A hex color, a scheme color such as accent1 or surface, or var:<id>." });
    solidColor.setList(colorList);
    solidPanel.append(solidColor.wrap);

    const gradientPanel = panel("gradient", "Linear gradient");
    const angle = numberField("bg-angle", "Angle in degrees", { step: 1, help: "0 runs left to right, 90 top to bottom." });
    const stopsBox = h("div", { class: "opf-dc-stops", role: "group", "aria-label": "Gradient stops" });
    const stopRows = [];
    const renderStops = () => {
      stopsBox.replaceChildren(
        ...stopRows.map((row, index) => {
          for (const [field, text] of [[row.color, `Stop ${index + 1} color`], [row.position, `Stop ${index + 1} position (0 to 1)`]]) field.wrap.querySelector("label").firstChild.textContent = text;
          const remove = h("button", { type: "button", class: "quiet", disabled: stopRows.length <= 2 || undefined, "aria-label": `Remove stop ${index + 1}`, onclick: () => { stopRows.splice(index, 1); backgroundDirty = true; renderStops(); } }, "Remove");
          return h("div", { class: "opf-dc-stop" }, row.color.wrap, row.position.wrap, remove);
        }),
      );
    };
    const addStop = (color = "", position = "") => {
      const row = { color: textField(`bg-stop-color`, "Stop color", { list: true, placeholder: "#1E40AF or accent1" }), position: numberField("bg-stop-position", "Stop position", { min: 0, max: 1, step: 0.05 }) };
      row.color.setList(colorList);
      row.color.input.value = color;
      row.position.input.value = String(position);
      stopRows.push(row);
    };
    const addStopButton = button("Add stop", () => {
      addStop("", stopRows.length ? "1" : "0");
      backgroundDirty = true;
      renderStops();
    });
    gradientPanel.append(angle.wrap, stopsBox, addStopButton);

    const imagePanel = panel("image", "Image");
    const fit = selectField("bg-fit", "Fit", { help: "Cover fills the slide, contain shows the whole image, tile repeats it." });
    fit.setOptions(IMAGE_BACKGROUND_FITS.map((value) => ({ value, label: titleCase(value) })));
    const bgImage = imageCluster("bg-image", "Background image", {
      apply: (ref) => (ref === null ? setBackground(editor, null, scoped()) : setBackground(editor, { type: "image", image: { src: ref, fit: fit.select.value || undefined }, ...(opacityValue() === undefined ? {} : { opacity: opacityValue() }) }, scoped())),
      build: (ref, doc) => prepareBackground(doc, { type: "image", image: { src: ref, fit: fit.select.value || undefined }, ...(opacityValue() === undefined ? {} : { opacity: opacityValue() }) }, scoped()),
      help: "An asset reference, a web address or a data address. Press Enter or choose a file to apply it with the settings here.",
    });
    imagePanel.append(bgImage.wrap, fit.wrap);

    const patternPanel = panel("pattern", "Pattern");
    const preset = selectField("bg-preset", "Pattern", { help: "The 54 PowerPoint presets. PPTX export writes them as native pattern fills." });
    preset.setOptions(Object.entries(PATTERN_GROUPS).flatMap(([name, ids]) => ids.map((id) => ({ value: id, label: id, group: name }))));
    const patternFg = textField("bg-pattern-fg", "Pattern color", { list: true, placeholder: "#000000 or text" });
    patternFg.setList(colorList);
    const patternBg = textField("bg-pattern-bg", "Behind the pattern", { list: true, placeholder: "#FFFFFF or background" });
    patternBg.setList(colorList);
    patternPanel.append(preset.wrap, patternFg.wrap, patternBg.wrap);

    const opacity = numberField("bg-opacity", "Opacity (0 to 1, optional)", { min: 0, max: 1, step: 0.05 });
    const opacityValue = () => (opacity.input.value === "" ? undefined : Number(opacity.input.value));
    const panels = { theme: themePanel, solid: solidPanel, gradient: gradientPanel, image: imagePanel, pattern: patternPanel };

    const draftSpec = () => {
      const type = typeSelect.select.value;
      const withOpacity = (value) => (opacityValue() === undefined ? value : { ...value, opacity: opacityValue() });
      if (type === "theme") return slot.select.value;
      if (type === "solid") return withOpacity({ type: "solid", color: solidColor.input.value.trim() });
      if (type === "gradient")
        return withOpacity({ type: "gradient", gradient: { ...(angle.input.value === "" ? {} : { angle: Number(angle.input.value) }), stops: stopRows.map((row) => ({ color: row.color.input.value.trim(), position: row.position.input.value })) } });
      if (type === "image") return withOpacity({ type: "image", image: { src: bgImage.source.input.value.trim(), fit: fit.select.value } });
      return withOpacity({ type: "pattern", pattern: { preset: preset.select.value, foregroundColor: patternFg.input.value.trim() || undefined, backgroundColor: patternBg.input.value.trim() || undefined } });
    };
    const showType = () => {
      for (const [name, element] of Object.entries(panels)) element.hidden = name !== typeSelect.select.value;
      opacity.wrap.hidden = typeSelect.select.value === "theme";
    };
    const apply = button("Apply background", () => run(() => setBackground(editor, draftSpec(), scoped()), "Background changed."));
    const remove = button("Remove background", () => run(() => setBackground(editor, null, scoped()), state.scope === "slide" ? "Background removed; this slide uses the presentation's." : "Background removed; the theme's shows."), { quiet: true });
    body.addEventListener("input", () => {
      backgroundDirty = true;
    });
    typeSelect.select.addEventListener("change", () => {
      backgroundDirty = true;
      showType();
    });
    body.append(typeSelect.wrap, themePanel, solidPanel, gradientPanel, imagePanel, patternPanel, opacity.wrap, h("div", { class: "opf-dc-actions" }, apply, remove));

    const load = () => {
      const current = readBackground(editor.document, scoped());
      const note = sourceNote(current.scope, current.type !== undefined);
      typeSelect.set(current.type ?? "theme", note);
      slot.set(current.type === "theme" ? current.slot : "light1");
      solidColor.set(current.type === "solid" ? current.color : "");
      angle.set(current.type === "gradient" && current.angle !== undefined ? String(current.angle) : "");
      stopRows.length = 0;
      if (current.type === "gradient" && current.stops?.length) for (const stop of current.stops) addStop(stop.color, stop.position);
      else {
        addStop("accent1", "0");
        addStop("accent2", "1");
      }
      renderStops();
      fit.set(current.type === "image" ? (current.fit ?? "cover") : "cover");
      bgImage.set(current.type === "image" ? (current.src ?? "") : "", "", target());
      preset.set(current.type === "pattern" ? current.preset : "pct5");
      patternFg.set(current.type === "pattern" ? (current.foregroundColor ?? "") : "");
      patternBg.set(current.type === "pattern" ? (current.backgroundColor ?? "") : "");
      opacity.set(current.opacity === undefined ? "" : String(current.opacity));
      showType();
    };
    let draftTarget = "";
    syncs.push(() => {
      // A draft belongs to the scope and slide it was started on; moving to another discards it.
      const target = `${state.scope}:${state.scope === "slide" ? getSlide() : ""}`;
      if (target !== draftTarget) {
        draftTarget = target;
        backgroundDirty = false;
      }
      // A draft being edited is kept; Undo, Redo and every other change reload it from the document.
      if (backgroundDirty) {
        bgImage.refreshAssets();
        return;
      }
      load();
    });
  }

  // --- slide image --------------------------------------------------------------------------------

  if (built["slide-image"]) {
    const { body } = built["slide-image"];
    const image = (fields, done) => run(() => setDesignOption(editor, "slideImage", fields, scoped()), done ?? "Slide image changed.");
    const position = selectField("image-position", "Position", {
      empty: "None",
      help: "Where the slide image sits. Choose None to remove it.",
      onChange: (value) => (value === "" ? run(() => setDesignOption(editor, "slideImage", null, scoped()), "Slide image removed.") : image({ position: value }, `Slide image placed ${value}.`)),
    });
    position.setOptions(POSITIONS.map((value) => ({ value, label: titleCase(value) })));
    const source = imageCluster("image", "Slide image", {
      apply: (ref) => setDesignOption(editor, "slideImage", { src: ref }, scoped()),
      build: (ref, doc) => prepareDesignOption(doc, "slideImage", { src: ref }, scoped()),
    });
    const fill = selectField("image-fill", "Fit", { empty: "Presentation default", onChange: (value) => image({ fill: value === "" ? null : value }, "Image fit changed.") });
    fill.setOptions([
      { value: "crop", label: "Crop to fill" },
      { value: "fit", label: "Fit whole image" },
    ]);
    const shape = selectField("image-shape", "Shape", { empty: "Rectangle", onChange: (value) => image({ shape: value === "" ? null : value }, "Image shape changed.") });
    shape.setOptions(SHAPES.filter((value) => value !== "rectangle").map((value) => ({ value, label: titleCase(value) })));
    const size = numberField("image-size", "Size (share of the slide, 0.1 to 0.9)", {
      min: 0.1,
      max: 0.9,
      step: 0.05,
      onCommit: (value) => image({ size: value }, "Image size changed."),
    });
    const inset = checkField("image-inset", "Inset inside the slide padding", { onChange: (checked) => image({ inset: checked ? true : null }, "Image inset changed.") });
    const placeholderFill = selectField("image-placeholder-fill", "Picture placeholders", {
      empty: "Presentation default",
      help: "How pictures fill their layout placeholders across the presentation.",
      onChange: (value) => run(() => switchDimension(editor, "image-treatments", { imageFill: value === "" ? null : value }), "Picture placeholder fill changed."),
    });
    placeholderFill.setOptions([
      { value: "crop", label: "Crop to fill" },
      { value: "fit", label: "Fit whole image" },
    ]);
    body.append(position.wrap, source.wrap, fill.wrap, shape.wrap, size.wrap, inset.wrap, placeholderFill.wrap);
    syncs.push(() => {
      const option = getDesignOption(editor.document, "slideImage", scoped());
      const value = option.value;
      const object = value && typeof value === "object" && !Array.isArray(value) && value.position ? value : undefined;
      const note = sourceNote(option.scope, option.value !== undefined);
      position.set(object?.position ?? (value === undefined ? "" : "(source only)"), note);
      source.set(stringOf(value), "", target());
      fill.set(object?.fill ?? "");
      shape.set(object?.shape && object.shape !== "rectangle" ? object.shape : "");
      size.set(object?.size === undefined ? "" : String(object.size));
      inset.set(object?.inset === true);
      // Fit, shape, size and inset only make sense once the image has a position.
      for (const control of [fill, shape, size, inset]) control.wrap.hidden = !object;
      placeholderFill.set(editor.document.design?.imageFill ?? "");
    });
  }

  // --- header and footer --------------------------------------------------------------------------

  if (built["header-footer"]) {
    const { body } = built["header-footer"];
    const pick = { which: "footer", zone: "center" };
    const which = () => pick.which;
    const zone = () => pick.zone;
    const furniture = selectField("hf-which", "Edit", { help: "The header runs along the top of every slide, the footer along the bottom." });
    furniture.setOptions([
      { value: "header", label: "Header" },
      { value: "footer", label: "Footer" },
    ]);
    furniture.set(pick.which);
    const zoneSelect = selectField("hf-zone", "Zone", { help: "Each zone stacks its parts top to bottom: logo, image, text, organization, socials, section, slide number, date." });
    zoneSelect.setOptions(HEADER_FOOTER_ZONES.map((value) => ({ value, label: titleCase(value) })));
    zoneSelect.set(pick.zone);
    furniture.select.addEventListener("change", () => {
      pick.which = furniture.select.value;
      sync();
    });
    zoneSelect.select.addEventListener("change", () => {
      pick.zone = zoneSelect.select.value;
      sync();
    });
    // Hiding is for a slide that would otherwise show the deck's furniture; at the deck, clear the zones instead.
    const hide = checkField("hf-hide", "Hide it", {
      help: "On a slide: shows nothing instead of the presentation's. Uncheck to inherit it again.",
      onChange: (checked) => run(() => switchDimension(editor, "headers-footers", { [which()]: checked ? false : null }, scoped()), checked ? `${titleCase(which())} hidden on this slide.` : `${titleCase(which())} shown again.`),
    });
    const edit = (fields, done) => run(() => setHeaderFooterZone(editor, which(), zone(), fields, scoped()), done);
    const where = () => `${titleCase(which())} ${zone()}`;
    const text = textField("hf-text", "Text", { help: "Literal text. Clear it to remove.", onCommit: (value) => edit({ text: value }, `${where()} text changed.`) });
    const logo = checkField("hf-logo", "Show the logo", { onChange: (checked) => edit({ logo: checked }, `${where()} logo ${checked ? "shown" : "removed"}.`) });
    const image = imageCluster("hf-image", "Image", {
      apply: (ref) => setHeaderFooterZone(editor, which(), zone(), { image: ref }, scoped()),
      build: (ref, doc) => prepareHeaderFooterZone(doc, which(), zone(), { image: ref }, scoped()),
      help: "A picture in this zone, such as a partner mark or badge. An asset reference, a web address or a data address. Press Enter to apply; clear the field to remove it.",
    });
    const number = checkField("hf-number", "Show the slide number", { onChange: (checked) => edit({ slideNumber: checked }, `${where()} slide number ${checked ? "shown" : "removed"}.`) });
    const numberFormat = textField("hf-number-format", "Slide number format", {
      placeholder: "Page {current} of {total}",
      help: "Must contain {current}; {total} is the number of slides. Clear it for the plain number.",
      onCommit: (value) => edit({ slideNumberFormat: value.trim() }, `${where()} slide number format changed.`),
    });
    const dateNow = checkField("hf-date-now", "Show the current date", {
      help: "Needs the host to supply today's date when it renders or exports; otherwise the part is reported as unresolved.",
      onChange: (checked) => edit({ date: checked }, `${where()} date ${checked ? "shown" : "removed"}.`),
    });
    const dateFixed = textField("hf-date-fixed", "Fixed date", {
      placeholder: "2026-10-01",
      help: "A fixed date written YYYY-MM-DD (formatted by the date format), or literal text when there is no date format. Replaces the current date.",
      onCommit: (value) => edit({ date: value.trim() }, `${where()} date changed.`),
    });
    const dateFormat = textField("hf-date-format", "Date format", {
      placeholder: "MMMM d, yyyy",
      help: `Tokens: ${DATE_FORMAT_TOKENS.join(", ")}. Text in single quotes is literal. Clear it for the default (M/d/yyyy).`,
      onCommit: (value) => edit({ dateFormat: value.trim() }, `${where()} date format changed.`),
    });
    const organization = checkField("hf-organization", "Show the organization name", { onChange: (checked) => edit({ organization: checked }, `${where()} organization ${checked ? "shown" : "removed"}.`) });
    const socials = checkField("hf-socials", "Show the organization's social profiles", { onChange: (checked) => edit({ socials: checked }, `${where()} social profiles ${checked ? "shown" : "removed"}.`) });
    const section = checkField("hf-section", "Show the section label", { onChange: (checked) => edit({ section: checked }, `${where()} section label ${checked ? "shown" : "removed"}.`) });
    const summary = h("ul", { class: "opf-dc-summary", "aria-label": "Zones in use" });
    const warnings = h("ul", { class: "opf-dc-warnings", "aria-label": "Header and footer warnings" });
    const controls = [text, logo, image, number, numberFormat, dateNow, dateFixed, dateFormat, organization, socials, section];
    body.append(furniture.wrap, hide.wrap, zoneSelect.wrap, summary, ...controls.map((control) => control.wrap), warnings);
    const describe = (fields) =>
      Object.entries(fields)
        .map(([key, value]) => (typeof value === "boolean" ? key : `${key} ${typeof value === "string" ? `“${value}”` : ""}`.trim()))
        .join(", ");
    syncs.push(() => {
      const state = headerFooterState(editor.document, which(), scoped());
      // Offered on a slide that inherits the deck's furniture or already hides it, never over zones the slide set itself; at the deck only to undo a hidden state.
      hide.wrap.hidden = scopeIndex() === undefined ? !state.hidden : state.own && !state.hidden;
      hide.set(state.hidden, state.inherited && !state.hidden ? "from the presentation" : "");
      const fields = readHeaderFooterZone(editor.document, which(), zone(), scoped());
      text.set(typeof fields.text === "string" ? fields.text : "");
      logo.set(fields.logo === true);
      image.set(stringOf(fields.image), "", `${target()}:${which()}:${zone()}`);
      number.set(fields.slideNumber === true);
      numberFormat.set(typeof fields.slideNumberFormat === "string" ? fields.slideNumberFormat : "");
      dateNow.set(fields.date === true);
      dateFixed.set(typeof fields.date === "string" ? fields.date : "");
      dateFormat.set(typeof fields.dateFormat === "string" ? fields.dateFormat : "");
      organization.set(fields.organization === true);
      socials.set(fields.socials === true);
      section.set(fields.section === true);
      for (const control of controls) for (const input of control.wrap.querySelectorAll("input,select,button")) input.disabled = state.hidden;
      summary.replaceChildren(
        ...HEADER_FOOTER_ZONES.map((name) => {
          const zoneFields = readHeaderFooterZone(editor.document, which(), name, scoped());
          return h("li", {}, `${titleCase(name)}: ${Object.keys(zoneFields).length ? describe(zoneFields) : "empty"}`);
        }),
      );
      warnings.replaceChildren(...designWarnings(editor.document, getSlide()).filter((warning) => /^design\.(header|footer)/.test(warning.path)).map((warning) => h("li", {}, warning.message)));
    });
  }

  // --- logo, watermark, bullets, accent font -------------------------------------------------------

  if (built.brand) {
    const { body } = built.brand;
    const variant = selectField("logo-variant", "Logo variant", { help: "Choose the variant to edit. Engines pick one by background: light on dark, dark on light, then the default." });
    variant.setOptions(LOGO_VARIANTS.map((value) => ({ value, label: LOGO_VARIANT_LABELS[value] })));
    variant.set("default");
    const logoSource = imageCluster("logo", "Logo", {
      apply: (ref) => setLogoVariant(editor, variant.select.value, ref, scoped()),
      build: (ref, doc) => prepareLogoVariant(doc, variant.select.value, ref, scoped()),
      help: "An asset reference, a web address or a data address for the selected variant. Press Enter to apply; clear the field to remove the variant.",
    });
    variant.select.addEventListener("change", () => sync());
    const orgLogo = imageCluster("org-logo", "Organization logo (whole presentation)", {
      apply: (ref) => setDesignOption(editor, "organizationLogo", ref),
      build: (ref, doc) => prepareDesignOption(doc, "organizationLogo", ref),
      help: "The primary organization's logo is the fallback wherever the logo is drawn.",
    });
    const bullet = selectField("list-bullet", "List bullets", {
      empty: "Default (character)",
      help: "Picture bullets draw the logo as the marker and need a logo.",
      onChange: (value) => run(() => setDesignOption(editor, "listBullet", value === "" ? null : value, scoped()), value === "image" ? "Picture bullets on." : "Character bullets."),
    });
    bullet.setOptions([
      { value: "character", label: "Character" },
      { value: "image", label: "Picture (the logo)" },
    ]);
    const accent = textField("accent-font", "Accent font", {
      placeholder: "Font family name",
      help: "The font for accent text such as tags. Press Enter to apply; clear the field to remove it.",
      onCommit: (value) => run(() => setDesignOption(editor, "accentFont", value.trim() === "" ? null : value.trim(), scoped()), value.trim() === "" ? "Accent font removed." : "Accent font changed."),
    });
    const watermarkSource = imageCluster("watermark", "Watermark", {
      apply: (ref) => setDesignOption(editor, "watermark", ref === null ? null : { src: ref }, scoped()),
      build: (ref, doc) => prepareDesignOption(doc, "watermark", { src: ref }, scoped()),
    });
    const watermarkOpacity = numberField("watermark-opacity", "Watermark opacity (0 to 1)", {
      min: 0,
      max: 1,
      step: 0.05,
      onCommit: (value) => run(() => setDesignOption(editor, "watermark", { opacity: value === null ? 0.1 : value }, scoped()), "Watermark opacity changed."),
    });
    const watermarkOff = checkField("watermark-off", "Hide the inherited watermark", {
      onChange: (checked) => run(() => setDesignOption(editor, "watermark", checked ? false : null, scoped()), checked ? "Watermark hidden." : "Watermark restored."),
    });
    body.append(variant.wrap, logoSource.wrap, orgLogo.wrap, bullet.wrap, accent.wrap, watermarkSource.wrap, watermarkOpacity.wrap, watermarkOff.wrap);
    const warningList = h("ul", { class: "opf-dc-warnings", "aria-label": "Logo warnings" });
    body.append(warningList);
    syncs.push(() => {
      const variants = readLogoVariants(editor.document, scoped());
      logoSource.set(stringOf(variants[variant.select.value]), "", `${target()}:${variant.select.value}`);
      const organization = editor.document.organization;
      const owner = Array.isArray(organization) ? organization[0] : organization;
      orgLogo.set(stringOf(owner?.logo), "", "org");
      for (const input of orgLogo.wrap.querySelectorAll("input")) input.disabled = !owner;
      const bulletOption = getDesignOption(editor.document, "listBullet", scoped());
      bullet.set(bulletOption.value ?? "", sourceNote(bulletOption.scope, bulletOption.value !== undefined));
      const accentOption = getDesignOption(editor.document, "accentFont", scoped());
      accent.set(accentOption.value ?? "", sourceNote(accentOption.scope, accentOption.value !== undefined));
      const watermark = getDesignOption(editor.document, "watermark", scoped());
      const mark = watermark.value;
      // The opacity belongs to a watermark image; without one there is nothing to fade.
      for (const input of watermarkOpacity.wrap.querySelectorAll("input")) input.disabled = !(typeof mark === "string" || (mark && typeof mark === "object" && typeof mark.src === "string"));
      watermarkSource.set(typeof mark === "string" ? mark : mark && typeof mark === "object" ? stringOf(mark) : "", sourceNote(watermark.scope, mark !== undefined), target());
      watermarkOpacity.set(mark && typeof mark === "object" && typeof mark.opacity === "number" ? String(mark.opacity) : "");
      const own = scopeIndex() === undefined ? editor.document.design?.watermark : editor.document.slides?.[scopeIndex()]?.design?.watermark;
      watermarkOff.set(own === false);
      watermarkOff.wrap.hidden = state.scope !== "slide";
      warningList.replaceChildren(...designWarnings(editor.document, getSlide()).filter((warning) => warning.path === "design.listBullet").map((warning) => h("li", {}, warning.message)));
    });
  }

  // --- alignment and arrangement -------------------------------------------------------------------

  if (built["layout-options"]) {
    const { body } = built["layout-options"];
    const enumField = (id, label, values, labels, help) => {
      const field = selectField(`opt-${id}`, label, {
        empty: "Default",
        help,
        onChange: (value) => run(() => setDesignOption(editor, id, value === "" ? null : value, scoped()), `${label} changed.`),
      });
      field.setOptions(values.map((value) => ({ value, label: labels[value] ?? titleCase(value) })));
      body.append(field.wrap);
      syncs.push(() => {
        const option = getDesignOption(editor.document, id, scoped());
        field.set(option.value ?? "", sourceNote(option.scope, option.value !== undefined));
      });
    };
    enumField("titleAlignment", "Title alignment", ["left", "center", "right"], {});
    enumField("contentAlignment", "Content alignment", ["left", "center", "right"], {});
    enumField("contentDirection", "Content direction", ["horizontal", "vertical"], { horizontal: "Horizontal (row)", vertical: "Vertical (column)" }, "The axis parallel content is arranged along when a slide sets no arrangement of its own.");
    enumField("chartPrimary", "Primary chart position", ["none", "top", "bottom", "left", "right"], { none: "None (equal)" }, "Where the main chart sits next to supporting content.");
    const box = selectField("opt-contentBox", "Content box", {
      empty: "Default",
      onChange: (value) => run(() => setDesignOption(editor, "contentBox", value === "" ? null : value === "yes", scoped()), "Content box changed."),
    });
    box.setOptions([
      { value: "yes", label: "Show a card behind content" },
      { value: "no", label: "No card" },
    ]);
    body.append(box.wrap);
    syncs.push(() => {
      const option = getDesignOption(editor.document, "contentBox", scoped());
      box.set(option.value === undefined ? "" : option.value ? "yes" : "no", sourceNote(option.scope, option.value !== undefined));
    });
  }

  // --- audience and story --------------------------------------------------------------------------

  if (built.info) {
    const { body } = built.info;
    const single = (name, label, dimension, help) => {
      const field = selectField(name, label, { help, onChange: (value) => run(() => switchDimension(editor, dimension, value, catalogOptions()), `${label} set to ${field.select.selectedOptions[0]?.textContent ?? value}.`) });
      body.append(field.wrap);
      syncs.push(() => {
        field.setOptions(listSwitchOptions(editor.document, dimension, catalogOptions()).map((entry) => ({ value: entry.id, label: entry.label })));
        field.set(currentSwitchValue(editor.document, dimension).value);
      });
    };
    single("narrative", "Narrative", "narratives", "The storyline the deck follows. Authoring metadata: the slides do not change.");
    single("tone", "Tone", "tones");
    single("purpose", "Purpose", "purposes", "What the deck is for. Authoring metadata: the slides do not change. A goal written in the JSON source shows as custom.");
    const audience = selectField("audience", "Audience", {
      multiple: true,
      size: 6,
      help: "Hold Ctrl or Shift to choose more than one.",
      onChange: (values) => {
        if (!values.length) return complain("Choose at least one audience.");
        run(() => switchDimension(editor, "audiences", values, catalogOptions()), "Audience changed.");
      },
    });
    body.append(audience.wrap);
    syncs.push(() => {
      audience.setOptions(listSwitchOptions(editor.document, "audiences", catalogOptions()).map((entry) => ({ value: entry.id, label: entry.label })));
      const value = editor.document.audience;
      audience.set(Array.isArray(value) ? value : value === undefined ? [] : [value]);
    });

    const owner = selectField("social-owner", "Socials belong to");
    const platform = selectField("social-platform", "Platform");
    const handle = textField("social-handle", "Handle or address", { placeholder: "@handle", help: "Press Enter to apply." });
    const applySocial = () => {
      const value = handle.input.value.trim();
      if (!value) return complain("Enter a handle for the platform.");
      run(() => switchDimension(editor, "socials", { platform: platform.select.value, handle: value }, { owner: owner.select.value, ...catalogOptions() }), "Social handle saved.");
    };
    handle.input.addEventListener("change", applySocial);
    body.append(owner.wrap, platform.wrap, handle.wrap, button("Save handle", applySocial));
    const showHandle = () => {
      const host = editor.document[owner.select.value];
      const target = Array.isArray(host) ? host[0] : host;
      handle.set(typeof target?.socials?.[platform.select.value] === "string" ? target.socials[platform.select.value] : "");
    };
    owner.select.addEventListener("change", showHandle);
    platform.select.addEventListener("change", showHandle);
    syncs.push(() => {
      const owners = ["speaker", "organization"].filter((name) => editor.document[name]);
      owner.setOptions(owners.length ? owners.map((name) => ({ value: name, label: titleCase(name) })) : [{ value: "speaker", label: "Speaker (add one first)", disabled: true }]);
      if (!owner.select.value || !owners.includes(owner.select.value)) owner.select.value = owners[0] ?? "speaker";
      platform.setOptions(listSwitchOptions(editor.document, "socials", catalogOptions()).map((entry) => ({ value: entry.id, label: entry.label })));
      showHandle();
    });
  }

  // --- selected content ----------------------------------------------------------------------------

  const dynamic = {};
  if (built.selection) {
    const { body, details } = built.selection;
    const summary = h("p", { class: "opf-dc-help", "data-role": "selection-summary" });
    const convert = selectField("convert", "Content type", {
      help: "Converting keeps your text and never adds content. What a type cannot carry is named below.",
      onChange: (value) => {
        if (!value) return;
        const path = dynamic.blockPath;
        run(() => switchDimension(editor, "blocks", value, { path, convert: true }), (change) => `Converted to ${BLOCK_KIND_LABELS[value]?.toLowerCase() ?? value}.${change.loss?.length ? ` Not carried over: ${change.loss.join(", ")}.` : " Nothing was lost."}`);
        reselect(path);
      },
    });
    const unavailable = h("ul", { class: "opf-dc-warnings", "aria-label": "Conversions not available" });
    const replace = selectField("replace", "Replace with new content", {
      empty: "Choose a type…",
      help: "Starts from sample content. The old content is discarded; Undo brings it back.",
      onChange: (value) => {
        if (!value) return;
        const path = dynamic.blockPath;
        run(() => switchDimension(editor, "blocks", value, { path }), `Replaced with ${BLOCK_KIND_LABELS[value]?.toLowerCase() ?? value} content.`);
        reselect(path);
      },
    });
    replace.setOptions(BLOCK_REPLACEMENTS.map((value) => ({ value, label: BLOCK_KIND_LABELS[value] })));
    const chartType = selectField("chart-type", "Chart type", {
      help: "Only types the chart's data can use as it is.",
      onChange: (value) => run(() => switchDimension(editor, "charts", value, { slideIndex: getSlide(), path: dynamic.blockPath, ...catalogOptions() }), `Chart type set to ${chartType.select.selectedOptions[0]?.textContent ?? value}.`),
    });
    body.append(summary, convert.wrap, unavailable, contentControls.nodes.metrics, contentControls.nodes.list, chartType.wrap, contentControls.nodes.arrange, replace.wrap);
    dynamic.selection = { details, summary, convert, unavailable, replace, chartType };
  }

  if (built["slide-content"]) built["slide-content"].body.append(contentControls.slideNode);

  // --- table --------------------------------------------------------------------------------------

  if (built.table) {
    const { body, details } = built.table;
    const summary = h("p", { class: "opf-dc-help", "data-role": "table-summary" });
    const applyStyle = (change, done) => run(() => setTableStyle(editor, dynamic.tablePath, change), done);
    const headerStyle = selectField("table-header", "Header row", {
      help: "The header fill. Theme uses the primary color; Plain looks like the body.",
      onChange: (value) => applyStyle({ ...dynamic.tableStyle, header: value }, "Table header changed."),
    });
    headerStyle.setOptions([
      { value: "theme", label: "Theme (primary color)" },
      { value: "plain", label: "Plain" },
      { value: "accent", label: "Accent color" },
    ]);
    const banding = checkField("table-banding", "Banded rows", {
      help: "Alternates the fill of body rows. Text color adjusts automatically.",
      onChange: (checked) => applyStyle({ ...dynamic.tableStyle, banding: checked }, checked ? "Banded rows on." : "Banded rows off."),
    });
    const borders = selectField("table-borders", "Borders", {
      onChange: (value) => applyStyle({ ...dynamic.tableStyle, borders: value }, "Table borders changed."),
    });
    borders.setOptions([
      { value: "theme", label: "Theme" },
      { value: "grid", label: "Grid" },
      { value: "horizontal", label: "Horizontal rules" },
      { value: "none", label: "None" },
    ]);
    const resetStyle = button("Reset table style", () => applyStyle("theme", "Table style reset to the theme."), { quiet: true });
    const cellLabel = h("p", { class: "opf-dc-help", "data-role": "cell-summary" });
    const columns = numberField("span-columns", "Columns to merge", { min: 1, step: 1 });
    const rows = numberField("span-rows", "Rows to merge", { min: 1, step: 1 });
    const join = checkField("merge-join", "Keep text from the merged cells", { help: "Without this, merging cells that hold text is refused so nothing is hidden." });
    const merge = button("Merge cells", () => {
      const cell = dynamic.cell;
      if (!cell) return;
      const colSpan = Number(columns.input.value || 1);
      const rowSpan = Number(rows.input.value || 1);
      run(() => mergeTableCells(editor, dynamic.tablePath, cell, { colSpan, rowSpan }, { join: join.input.checked }), `Merged ${colSpan} by ${rowSpan} cells.`);
    });
    const split = button("Split cell", () => run(() => splitTableCell(editor, dynamic.tablePath, dynamic.cell), "Cell split."));
    const fill = selectField("cell-fill", "Cell fill", { onChange: (value) => run(() => setTableCellStyle(editor, dynamic.tablePath, dynamic.cell, { fill: value === "" ? null : value }), "Cell fill changed.") });
    fill.setOptions(CELL_FILLS.map(([value, label]) => ({ value, label })));
    const align = selectField("cell-align", "Cell text alignment", { empty: "Default", onChange: (value) => run(() => setTableCellStyle(editor, dynamic.tablePath, dynamic.cell, { align: value === "" ? null : value }), "Cell alignment changed.") });
    align.setOptions(["left", "center", "right"].map((value) => ({ value, label: titleCase(value) })));
    const cellBox = h("div", { class: "opf-dc-cell" }, cellLabel, columns.wrap, rows.wrap, join.wrap, h("div", { class: "opf-dc-actions" }, merge, split), fill.wrap, align.wrap);
    body.append(summary, headerStyle.wrap, banding.wrap, borders.wrap, resetStyle, cellBox);
    dynamic.table = { details, summary, headerStyle, banding, borders, cellBox, cellLabel, columns, rows, merge, split, fill, align, join };
  }

  // --- sync -----------------------------------------------------------------------------------------

  function syncSelection() {
    const selected = getSelected();
    const document_ = editor.document;
    const blockPath = selected ? blockPathForSelection(document_, selected) : undefined;
    const content = blockPath ? readBlockContent(document_, blockPath) : undefined;
    dynamic.blockPath = blockPath;
    const ui = dynamic.selection;
    if (ui) {
      ui.details.hidden = !content;
      if (content) {
        const targets = blockConversionTargets(document_, blockPath);
        ui.summary.textContent = `${BLOCK_KIND_LABELS[content.kind] ?? content.kind} block (${blockPath})`;
        ui.convert.setOptions([
          { value: "", label: `${BLOCK_KIND_LABELS[content.kind] ?? content.kind} (current)` },
          ...targets.map((target) => ({
            value: target.kind,
            label: target.available ? `${target.label}${target.lossless ? "" : ` (loses ${target.loss.join(", ")})`}` : `${target.label} (unavailable)`,
            disabled: !target.available,
            title: target.reason,
          })),
        ]);
        ui.convert.set("");
        ui.convert.wrap.hidden = targets.length === 0;
        ui.unavailable.replaceChildren(...targets.filter((target) => !target.available).map((target) => h("li", {}, `${target.label}: ${target.reason}`)));
        ui.replace.set("");
        const charts = content.kind === "chart" ? compatibleChartTypes(document_, { slideIndex: getSlide(), path: blockPath, ...catalogOptions() }) : [];
        ui.chartType.wrap.hidden = charts.length === 0;
        if (charts.length) {
          ui.chartType.setOptions(charts.map((entry) => ({ value: entry.id, label: entry.label })));
          ui.chartType.set(content.content?.type);
        }
      }
    }
    const tableUi = dynamic.table;
    if (tableUi) {
      const parsed = selected ? parseTableCellPath(selected) : undefined;
      const tablePath = parsed?.tablePath ?? (content?.key === "table" ? `${blockPath}.table` : undefined);
      dynamic.tablePath = tablePath;
      dynamic.cell = parsed?.cell;
      // A table that shows a shared dataset (RR-54) has no cell styles or merges: the table panel is for inline tables.
      const tableValue = tablePath ? editor.get(tablePath) : undefined;
      tableUi.details.hidden = !tablePath || !Array.isArray(tableValue?.rows);
      if (tablePath && !tableUi.details.hidden) {
        const table = tableValue;
        tableUi.summary.textContent = `Table (${tablePath})`;
        const style = readTableStyle(document_, tablePath);
        dynamic.tableStyle = style.preset === "custom" ? { header: "theme", banding: false, borders: "theme" } : { header: style.header, banding: style.banding, borders: style.borders };
        tableUi.headerStyle.set(style.header);
        tableUi.banding.set(style.banding === true);
        tableUi.borders.set(style.borders);
        tableUi.cellBox.hidden = !parsed;
        if (parsed) {
          let state;
          try {
            state = describeTableCell(table, parsed.cell);
          } catch {
            state = undefined;
          }
          if (state) {
            tableUi.cellLabel.textContent = `${state.section === "header" ? "Header" : `Row ${state.row + 1}`}, column ${state.column + 1}${state.merged ? ` · merged ${state.colSpan} by ${state.rowSpan}` : ""}`;
            // A refused merge keeps the spans the person typed so they can tick "Keep text" and try again.
            if (!restoring) {
              tableUi.columns.set(String(state.colSpan));
              tableUi.rows.set(String(state.rowSpan));
            }
            tableUi.rows.input.disabled = state.section === "header";
            tableUi.split.disabled = !state.anchor;
            const fillValue = typeof state.style.fill === "string" ? state.style.fill : "";
            tableUi.fill.set(CELL_FILLS.some(([value]) => value === fillValue) ? fillValue : fillValue ? "(custom)" : "");
            tableUi.align.set(state.style.align ?? "");
          }
        }
      }
    }
    if (contentControls) {
      contentControls.sync({ blockPath, content, selectedPath: selected, slideIndex: getSlide() });
      const slideContent = built["slide-content"];
      if (slideContent) slideContent.details.hidden = [...contentControls.slideNode.children].every((node) => node.hidden);
    }
  }

  function sync() {
    if (destroyed) return;
    if (scopeField) {
      scopeField.set(state.scope);
      const slideOption = scopeField.select.querySelector('option[value="slide"]');
      if (slideOption) slideOption.textContent = `This slide only (slide ${getSlide() + 1})`;
    }
    for (const update of syncs) update();
    syncSelection();
  }

  root.append(...sections.map((name) => built[name].details), statusEl, errorEl);
  container.append(root);
  const unsubscribe = editor.subscribe(() => {
    backgroundDirty = false;
    sync();
  });
  sync();

  return {
    element: root,
    /** Re-read the session, the current slide and the current selection. Call it when the host's slide or selection changes. */
    refresh: sync,
    /** The "Applies to" choice: "deck" or "slide". */
    get scope() {
      return state.scope;
    },
    setScope(scope) {
      state.scope = scope === "slide" ? "slide" : "deck";
      sync();
    },
    destroy() {
      destroyed = true;
      unsubscribe();
      root.remove();
    },
  };
}
