// The shape controls (SH-06): the DOM section of the design controls for a selected shape block. It edits every property of the block: the preset
// (the picker), its adjust values, the fill (none, color, gradient, pattern) and opacity, the line (color or gradient, width, dash, cap, join, miter
// limit, compound, alignment, arrowheads, sketch), the theme style, the six effects, rotation and flip, the text (its anchor, padding and direction) and
// the accessibility keys (alt text, decorative, hidden, link). A color is any ColorRef, with PowerPoint's lighter and darker tints. Every control commits
// one validated, undoable change through `setShapeProperties`, `setShapePreset` or `setShapeAdjust` (shape-options.js), so Undo, Redo and every host
// subscription work as for any other edit; the section owns no document state and `load(path)` re-reads the block after every change.
// `createShapeControls(ctx)` takes the panel's helpers (`h`, `selectField`, `textField`, `numberField`, `checkField`, `run`, ...) as design-controls builds them.
import { SHAPE_STYLES } from "@openpresentation/opf/composition";
import { COLOR_NAMES, PATTERN_PRESETS } from "./background-options.js";
import { createShapePicker, shapeThumbnailNode } from "./shape-picker.js";
import { loadShapeEngine, shapeEngine } from "./shape-engine.js";
import { readShape, readShapeAdjust, setShapeAdjust, setShapePreset, setShapeProperties, shapeLabel } from "./shape-options.js";
import { CONNECTOR_ROUTES, detachOverlay, listConnectionEnds, moveOverlayLayer, readOverlay, removeOverlay, setConnector, setOverlayFrame, slideIsRtl } from "./shape-overlays.js";

// The groups open when the section does; the rest open on a click.
const OPEN = new Set(["shape-preset-group", "shape-fill-group", "shape-line-group", "shape-text-group", "shape-placement-group", "shape-stack-group", "shape-connector-group"]);
const DASHES = ["solid", "dot", "dash", "longDash", "dashDot", "longDashDot", "longDashDotDot", "sysDot", "sysDash", "sysDashDot", "sysDashDotDot"];
const ARROWS = ["triangle", "stealth", "diamond", "oval", "arrow"];
const SIZES = ["small", "medium", "large"];
const GRADIENTS = ["linear", "radial", "rectangle", "shape"];
const SHADOWS = ["soft", "hard", "perspective"];
const cap = (text) => text.charAt(0).toUpperCase() + text.slice(1);
const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const num = (text) => (text === "" || text === null || text === undefined ? undefined : Number(text));
const show = (value) => (value === undefined || value === null ? "" : String(value));
const DEFAULT_GRADIENT = () => ({ type: "linear", angle: 90, stops: [{ color: "accent1", position: 0 }, { color: { color: "accent1", darken: 0.4 }, position: 1 }] });

/**
 * Build the shape section into `body` and return `{ load(path), refresh(), destroy() }`. `ctx`: `editor`, `doc`, `h`, `nextId`, `selectField`, `textField`,
 * `numberField`, `checkField`, `button`, `run(action, done)`, `geometryFor(path)` (the slide's composed geometry, to read the frame's size) and
 * `body`, the element to build into. `load(path)` fills the controls from the shape block at `path`.
 */
export function createShapeControls(ctx) {
  const { editor, doc, h, selectField, textField, numberField, checkField, button, run, geometryFor, body, reselect } = ctx;
  let path;
  let adjustSignature = "";
  let destroyed = false;
  let picker;
  const root = h("div", { class: "opf-shape-controls", "data-role": "shape-controls" });
  body.append(root);

  const commit = (fields, done, meta) => run(() => setShapeProperties(editor, path, fields, meta), done);
  const group = (title, role, ...children) => h("details", { class: "opf-sc-group", "data-role": role, open: OPEN.has(role) || undefined }, h("summary", {}, title), ...children);

  // --- a color: any ColorRef, with PowerPoint's lighter and darker tints -------------------------------------------------------------
  /** `{ wrap, value(), set(ref) }`: a text box (names, hex, var:id), a swatch picker and an optional tint. `value()` is the ColorRef, or undefined when empty. */
  function colorControl(name, label, onChange) {
    let nested;
    const text = textField(`${name}-color`, label, { list: true, placeholder: "accent1, #0F4C81 or var:id", help: "A theme color, hex or var:<id>. Clear to remove.", onCommit: () => onChange() });
    text.setList(COLOR_NAMES);
    const swatchId = ctx.nextId(`${name}-swatch`);
    const swatch = h("input", { id: swatchId, type: "color", class: "opf-sc-swatch", "aria-label": `${label} picker`, title: `Pick ${label.toLowerCase()}`, value: "#2874a6" });
    swatch.addEventListener("change", () => {
      text.input.value = swatch.value;
      onChange();
    });
    const tint = selectField(`${name}-tint`, `${label} tint`, { empty: "No tint", help: "PowerPoint's Lighter and Darker", onChange: () => { amount.wrap.hidden = tint.select.value === ""; if (tint.select.value !== "" && amount.input.value === "") amount.input.value = "0.4"; onChange(); } });
    tint.setOptions([{ value: "lighten", label: "Lighter" }, { value: "darken", label: "Darker" }]);
    const amount = numberField(`${name}-tint-amount`, `${label} tint amount`, { min: 0, max: 1, step: 0.05, help: "0.4 is Lighter 40%", onCommit: () => onChange() });
    amount.wrap.hidden = true;
    const wrap = h("div", { class: "opf-sc-color", "data-role": `${name}-color-control` }, text.wrap, h("div", { class: "opf-dc-field" }, h("label", { class: "opf-dc-row-label", for: swatchId }, "Pick"), swatch), tint.wrap, amount.wrap);
    return {
      wrap,
      text,
      value() {
        if (nested !== undefined && text.input.value === nested.shown) return nested.value;
        const base = text.input.value.trim();
        if (!base) return undefined;
        const how = tint.select.value;
        const size = num(amount.input.value);
        return how && size !== undefined ? { color: base, [how]: size } : base;
      },
      set(ref) {
        nested = undefined;
        let base = "";
        let how = "";
        let size = "";
        if (typeof ref === "string") base = ref;
        else if (isObject(ref) && typeof ref.color === "string") {
          base = ref.color;
          how = ref.lighten !== undefined ? "lighten" : "darken";
          size = show(ref.lighten ?? ref.darken);
        } else if (isObject(ref)) {
          // A tint of a tint: kept as written until the person types another color.
          base = "(custom color)";
          nested = { shown: base, value: ref };
        }
        text.set(base);
        tint.set(how);
        amount.set(size);
        amount.wrap.hidden = how === "";
        if (/^#[0-9a-f]{6}$/i.test(base)) swatch.value = base.toLowerCase();
      },
    };
  }

  // --- a gradient: type, angle and stops ----------------------------------------------------------------------------------------------
  function gradientEditor(name, label, onChange) {
    const type = selectField(`${name}-type`, `${label} type`, { onChange: () => { sync(); onChange(); } });
    type.setOptions(GRADIENTS.map((value) => ({ value, label: cap(value) })));
    const angle = numberField(`${name}-angle`, `${label} angle`, { min: -360, max: 360, step: 5, help: "Degrees: 0 left to right, 90 top to bottom (linear only)", onCommit: () => onChange() });
    const stopsBox = h("div", { class: "opf-sc-stops", "data-role": `${name}-stops` });
    const add = button("Add stop", () => {
      const next = value();
      next.stops.push({ color: next.stops.at(-1)?.color ?? "accent1", position: 1 });
      set(next);
      onChange();
    }, { quiet: true });
    let stops = [];
    const wrap = h("div", { class: "opf-sc-gradient", "data-role": `${name}-gradient` }, type.wrap, angle.wrap, stopsBox, add);
    function drawStops(list) {
      stops = list.map((stop, at) => {
        const color = colorControl(`${name}-stop-${at + 1}`, `${label} stop ${at + 1} color`, () => onChange());
        color.set(stop.color);
        const position = numberField(`${name}-stop-${at + 1}-position`, `${label} stop ${at + 1} position`, { min: 0, max: 1, step: 0.05, help: "0 to 1", onCommit: () => onChange() });
        position.set(show(stop.position));
        const remove = button("Remove", () => {
          const next = value();
          if (next.stops.length <= 2) return ctx.say("A gradient needs at least two stops.");
          next.stops.splice(at, 1);
          set(next);
          onChange();
        }, { quiet: true, title: `Remove stop ${at + 1}` });
        remove.setAttribute("aria-label", `Remove ${label.toLowerCase()} stop ${at + 1}`);
        return { color, position, node: h("div", { class: "opf-sc-stop", "data-role": `${name}-stop` }, color.wrap, position.wrap, remove) };
      });
      stopsBox.replaceChildren(...stops.map((stop) => stop.node));
    }
    function sync() {
      angle.wrap.hidden = type.select.value !== "linear";
    }
    function value() {
      return {
        type: type.select.value || "linear",
        ...(type.select.value === "linear" || type.select.value === "" ? { angle: num(angle.input.value) ?? 90 } : {}),
        stops: stops.map((stop) => ({ color: stop.color.value() ?? "accent1", position: num(stop.position.input.value) ?? 0 })),
      };
    }
    function set(gradient) {
      const g = gradient ?? DEFAULT_GRADIENT();
      type.set(g.type ?? "linear");
      angle.set(show(g.angle ?? 90));
      const list = Array.isArray(g.stops) && g.stops.length >= 2 ? g.stops : DEFAULT_GRADIENT().stops;
      // Redraw the stops only when their number changed or the document's differ from what is shown, so typing in a stop is never interrupted.
      if (list.length !== stops.length) drawStops(list);
      else
        list.forEach((stop, at) => {
          stops[at].color.set(stop.color);
          stops[at].position.set(show(stop.position));
        });
      sync();
    }
    set(undefined);
    return { wrap, value, set };
  }

  // --- the shape: preset, adjust values, frame ratio --------------------------------------------------------------------------------------
  const preview = h("span", { class: "opf-sc-preview", "aria-hidden": "true" });
  const presetValue = h("code", { class: "opf-sc-value", "data-role": "shape-preset" }, "");
  const change = h("button", { type: "button", class: "secondary", "data-role": "shape-change", "aria-expanded": "false" }, "Change shape…");
  const pickerHost = h("div", { class: "opf-sc-panel", "data-role": "shape-picker-panel", hidden: true });
  const current = h("div", { class: "opf-sc-current" }, h("span", { class: "opf-sc-now" }, preview, presetValue), change);
  change.addEventListener("click", () => {
    const open = pickerHost.hidden;
    pickerHost.hidden = !open;
    change.setAttribute("aria-expanded", String(open));
    if (open) {
      picker ??= createShapePicker(pickerHost, {
        idPrefix: "opf-sc",
        onPick: (name) => {
          pickerHost.hidden = true;
          change.setAttribute("aria-expanded", "false");
          run(() => setShapePreset(editor, path, name), `Shape changed to ${shapeLabel(name)}.`);
        },
      });
      picker.reset();
      picker.setSelected(readShape(editor.presentation, path)?.preset);
      picker.focus();
    }
  });
  const adjustBox = h("div", { class: "opf-sc-adjust", "data-role": "shape-adjust" });
  const aspect = numberField("shape-aspect", "Frame ratio", { min: 0.1, max: 10, step: 0.05, placeholder: "width / height", help: "1 for a square, 2 for twice as wide as high. Clear for the preset's own.", onCommit: (value) => commit({ aspectRatio: value }, "Frame ratio changed.") });
  const resetAdjust = button("Reset handles", () => commit({ adjust: null }, "Adjust values reset to the preset's."), { quiet: true, title: "Remove the adjust values: the preset's own are drawn" });
  resetAdjust.dataset.role = "shape-adjust-reset";
  const shapeGroup = group("Shape", "shape-preset-group", current, pickerHost, h("p", { class: "opf-dc-hint" }, "Drag the yellow handles on the slide, or type the values."), adjustBox, resetAdjust, aspect.wrap);

  // --- fill ---------------------------------------------------------------------------------------------------------------------------
  const fillCommit = () => {
    const kind = fillKind.select.value;
    let value;
    if (kind === "") value = null;
    else if (kind === "none") value = "none";
    else if (kind === "color") value = fillColor.value() ?? "accent1";
    else if (kind === "gradient") value = { gradient: fillGradient.value() };
    else value = { pattern: { preset: patternPreset.select.value || "ltUpDiag", ...(patternFg.value() ? { foregroundColor: patternFg.value() } : {}), ...(patternBg.value() ? { backgroundColor: patternBg.value() } : {}) } };
    commit({ fill: value }, kind === "" ? "Fill follows the style." : `Fill: ${kind}.`);
  };
  const fillKind = selectField("shape-fill-kind", "Fill", { empty: "From style", help: "None, a color, a gradient or a pattern. From style takes the theme style's fill.", onChange: () => { syncFill(); fillCommit(); } });
  fillKind.setOptions([{ value: "none", label: "None" }, { value: "color", label: "Color" }, { value: "gradient", label: "Gradient" }, { value: "pattern", label: "Pattern" }]);
  const fillColor = colorControl("shape-fill", "Fill color", fillCommit);
  const fillGradient = gradientEditor("shape-fill-gradient", "Gradient", fillCommit);
  const patternPreset = selectField("shape-pattern", "Pattern", { onChange: fillCommit });
  patternPreset.setOptions(PATTERN_PRESETS.map((value) => ({ value, label: value })));
  const patternFg = colorControl("shape-pattern-fg", "Pattern foreground", fillCommit);
  const patternBg = colorControl("shape-pattern-bg", "Pattern background", fillCommit);
  const patternBox = h("div", { "data-role": "shape-pattern-box" }, patternPreset.wrap, patternFg.wrap, patternBg.wrap);
  const opacity = numberField("shape-opacity", "Opacity", { min: 0, max: 1, step: 0.05, help: "The fill's opacity, 0 to 1. Clear for opaque.", onCommit: (value) => commit({ opacity: value }, "Opacity changed.") });
  const syncFill = () => {
    const kind = fillKind.select.value;
    fillColor.wrap.hidden = kind !== "color";
    fillGradient.wrap.hidden = kind !== "gradient";
    patternBox.hidden = kind !== "pattern";
    opacity.wrap.hidden = kind === "" || kind === "none";
  };
  const fillGroup = group("Fill", "shape-fill-group", fillKind.wrap, fillColor.wrap, fillGradient.wrap, patternBox, opacity.wrap);

  // --- line ---------------------------------------------------------------------------------------------------------------------------
  const strokeCommit = () => {
    const mode = strokeMode.select.value;
    if (mode === "") return commit({ stroke: null }, "Line follows the style.");
    if (mode === "none") return commit({ stroke: "none" }, "Line removed.");
    const out = {};
    if (strokeGradientOn.input.checked) out.gradient = strokeGradient.value();
    else if (strokeColor.value() !== undefined) out.color = strokeColor.value();
    const width = num(strokeWidth.input.value);
    if (width !== undefined) out.width = width;
    const dash = strokeDash.select.value;
    if (dash === "custom") {
      const parts = strokeCustomDash.input.value.split(/[\s,]+/).filter(Boolean).map(Number);
      if (parts.length >= 2 && parts.every((part) => Number.isFinite(part) && part > 0)) out.dash = parts;
      else return ctx.complain("A custom dash is at least two numbers (dash, gap, ...), each above 0, in line widths: 4, 2.");
    } else if (dash) out.dash = dash;
    for (const [key, field] of [["cap", strokeCap], ["join", strokeJoin], ["compound", strokeCompound], ["align", strokeAlign], ["sketch", strokeSketch]]) if (field.select.value) out[key] = field.select.value;
    const miter = num(strokeMiter.input.value);
    if (miter !== undefined && strokeJoin.select.value !== "round" && strokeJoin.select.value !== "bevel") out.miterLimit = miter;
    for (const [key, arrow] of [["start", startArrow], ["end", endArrow]]) {
      const type = arrow.type.select.value;
      if (type) out[key] = { type, ...(arrow.width.select.value ? { width: arrow.width.select.value } : {}), ...(arrow.length.select.value ? { length: arrow.length.select.value } : {}) };
    }
    // A line of your own with nothing set yet starts at a visible width.
    if (!Object.keys(out).length) out.width = 1.5;
    return commit({ stroke: out }, "Line changed.");
  };
  const strokeMode = selectField("shape-stroke-mode", "Line", { empty: "From style", help: "None, or your own line. From style takes the theme style's line.", onChange: () => { syncStroke(); strokeCommit(); } });
  strokeMode.setOptions([{ value: "none", label: "None" }, { value: "custom", label: "Custom" }]);
  const strokeColor = colorControl("shape-stroke", "Line color", strokeCommit);
  const strokeGradientOn = checkField("shape-stroke-gradient-on", "Gradient line", { onChange: () => { syncStroke(); strokeCommit(); } });
  const strokeGradient = gradientEditor("shape-stroke-gradient", "Line gradient", strokeCommit);
  const strokeWidth = numberField("shape-stroke-width", "Line width", { min: 0, max: 64, step: 0.5, help: "Reference pixels (1.33 is one point). 0 removes the line.", onCommit: strokeCommit });
  const strokeDash = selectField("shape-stroke-dash", "Dash", { empty: "Solid (default)", onChange: () => { syncStroke(); strokeCommit(); } });
  strokeDash.setOptions([...DASHES.slice(1).map((value) => ({ value, label: value })), { value: "custom", label: "Custom…" }]);
  const strokeCustomDash = textField("shape-stroke-dash-custom", "Custom dash", { placeholder: "4, 2", help: "Dash and gap lengths in line widths, at least two numbers", onCommit: strokeCommit });
  const strokeCap = selectField("shape-stroke-cap", "Cap", { empty: "Flat (default)", onChange: strokeCommit });
  strokeCap.setOptions(["round", "square"].map((value) => ({ value, label: cap(value) })));
  const strokeJoin = selectField("shape-stroke-join", "Join", { empty: "Miter (default)", onChange: () => { syncStroke(); strokeCommit(); } });
  strokeJoin.setOptions(["round", "bevel"].map((value) => ({ value, label: cap(value) })));
  const strokeMiter = numberField("shape-stroke-miter", "Miter limit", { min: 1, max: 100, step: 1, help: "How far a sharp corner may point (default 8)", onCommit: strokeCommit });
  const strokeCompound = selectField("shape-stroke-compound", "Compound", { empty: "Single (default)", onChange: strokeCommit });
  strokeCompound.setOptions(["double", "thickThin", "thinThick", "triple"].map((value) => ({ value, label: value })));
  const strokeAlign = selectField("shape-stroke-align", "Alignment", { empty: "Center (default)", help: "Inside keeps the line within a closed outline", onChange: strokeCommit });
  strokeAlign.setOptions([{ value: "inside", label: "Inside" }]);
  const strokeSketch = selectField("shape-stroke-sketch", "Sketch", { empty: "None", help: "PowerPoint's Sketched line", onChange: strokeCommit });
  strokeSketch.setOptions(["curved", "freehand", "scribble"].map((value) => ({ value, label: cap(value) })));
  const arrowControls = (name, label) => {
    const type = selectField(`shape-${name}-arrow`, `${label} arrowhead`, { empty: "None", help: "Arrowheads draw on an open outline: a line, an arc or a path that is not closed", onChange: strokeCommit });
    type.setOptions(ARROWS.map((value) => ({ value, label: cap(value) })));
    const width = selectField(`shape-${name}-arrow-width`, `${label} arrowhead width`, { empty: "Medium", onChange: strokeCommit });
    width.setOptions(SIZES.filter((value) => value !== "medium").map((value) => ({ value, label: cap(value) })));
    const length = selectField(`shape-${name}-arrow-length`, `${label} arrowhead length`, { empty: "Medium", onChange: strokeCommit });
    length.setOptions(SIZES.filter((value) => value !== "medium").map((value) => ({ value, label: cap(value) })));
    return { type, width, length, wrap: h("div", { class: "opf-sc-row", "data-role": `shape-${name}-arrow-row` }, type.wrap, width.wrap, length.wrap) };
  };
  const startArrow = arrowControls("start", "Start");
  const endArrow = arrowControls("end", "End");
  const strokeDetail = h("div", { "data-role": "shape-stroke-detail" }, strokeGradientOn.wrap, strokeColor.wrap, strokeGradient.wrap, strokeWidth.wrap, strokeDash.wrap, strokeCustomDash.wrap, strokeCap.wrap, strokeJoin.wrap, strokeMiter.wrap, strokeCompound.wrap, strokeAlign.wrap, strokeSketch.wrap, startArrow.wrap, endArrow.wrap);
  const syncStroke = () => {
    strokeDetail.hidden = strokeMode.select.value !== "custom";
    const gradient = strokeGradientOn.input.checked;
    strokeColor.wrap.hidden = gradient;
    strokeGradient.wrap.hidden = !gradient;
    strokeCustomDash.wrap.hidden = strokeDash.select.value !== "custom";
    strokeMiter.wrap.hidden = strokeJoin.select.value !== "";
  };
  const lineGroup = group("Line", "shape-line-group", strokeMode.wrap, strokeDetail);

  // --- theme style ---------------------------------------------------------------------------------------------------------------------
  const style = selectField("shape-style", "Style", { empty: "Theme default (moderate)", help: "The theme shape style, as PowerPoint's Shape Styles: it decides what the shape does not set itself", onChange: (value) => commit({ style: value === "" ? null : value }, "Style changed.") });
  style.setOptions(SHAPE_STYLES.map((value) => ({ value, label: cap(value) })));

  // --- effects -------------------------------------------------------------------------------------------------------------------------
  const effectCommit = (key, build) => () => commit({ [key]: build() }, `${cap(key.replace(/([A-Z])/g, " $1").toLowerCase())} changed.`);
  const shadowCommit = () => {
    const kind = shadowKind.select.value;
    if (kind === "") return commit({ shadow: null }, "Shadow removed.");
    if (SHADOWS.includes(kind)) return commit({ shadow: kind }, `Shadow: ${kind}.`);
    const out = {};
    if (shadowColor.value() !== undefined) out.color = shadowColor.value();
    for (const [key, field] of [["opacity", shadowOpacity], ["blur", shadowBlur], ["distance", shadowDistance], ["angle", shadowAngle], ["size", shadowSize]]) if (num(field.input.value) !== undefined) out[key] = num(field.input.value);
    return commit({ shadow: out }, "Shadow changed.");
  };
  const shadowKind = selectField("shape-shadow", "Shadow", { empty: "None", onChange: () => { syncEffects(); shadowCommit(); } });
  shadowKind.setOptions([...SHADOWS.map((value) => ({ value, label: cap(value) })), { value: "custom", label: "Custom…" }]);
  const shadowColor = colorControl("shape-shadow", "Shadow color", shadowCommit);
  const shadowOpacity = numberField("shape-shadow-opacity", "Shadow opacity", { min: 0, max: 1, step: 0.05, onCommit: shadowCommit });
  const shadowBlur = numberField("shape-shadow-blur", "Shadow blur", { min: 0, max: 200, step: 1, onCommit: shadowCommit });
  const shadowDistance = numberField("shape-shadow-distance", "Shadow distance", { min: 0, max: 200, step: 1, onCommit: shadowCommit });
  const shadowAngle = numberField("shape-shadow-angle", "Shadow angle", { min: 0, max: 360, step: 5, help: "Degrees clockwise from the right; 90 points down", onCommit: shadowCommit });
  const shadowSize = numberField("shape-shadow-size", "Shadow size", { min: 0.1, max: 2, step: 0.05, onCommit: shadowCommit });
  const shadowDetail = h("div", { "data-role": "shape-shadow-detail" }, shadowColor.wrap, shadowOpacity.wrap, shadowBlur.wrap, shadowDistance.wrap, shadowAngle.wrap, shadowSize.wrap);

  /** An effect that is an object: a check to turn it on and its numbers. */
  function objectEffect(key, label, fields, defaults) {
    const pieces = {};
    const toggle = checkField(`shape-${key}-on`, label, { onChange: (checked) => { sync(); commit({ [key]: checked ? defaults : null }, checked ? `${label} on.` : `${label} off.`); } });
    const build = () => {
      const out = {};
      if (pieces.color?.value() !== undefined) out.color = pieces.color.value();
      for (const [name, field] of Object.entries(pieces)) if (name !== "color" && num(field.input.value) !== undefined) out[name] = num(field.input.value);
      return out;
    };
    const wrapped = effectCommit(key, build);
    const nodes = [];
    for (const [name, spec] of Object.entries(fields)) {
      if (name === "color") pieces.color = colorControl(`shape-${key}`, `${label} color`, wrapped);
      else pieces[name] = numberField(`shape-${key}-${name}`, `${label} ${spec.label}`, { min: spec.min, max: spec.max, step: spec.step, help: spec.help, onCommit: wrapped });
      nodes.push((pieces[name] ?? pieces.color).wrap);
    }
    const detail = h("div", { "data-role": `shape-${key}-detail` }, ...nodes);
    function sync() {
      detail.hidden = !toggle.input.checked;
    }
    return {
      wrap: h("div", { class: "opf-sc-effect", "data-role": `shape-${key}-effect` }, toggle.wrap, detail),
      set(value) {
        toggle.set(value !== undefined);
        if (isObject(value)) {
          pieces.color?.set(value.color);
          for (const [name, field] of Object.entries(pieces)) if (name !== "color") field.set(show(value[name]));
        } else {
          pieces.color?.set(undefined);
          for (const [name, field] of Object.entries(pieces)) if (name !== "color") field.set("");
        }
        sync();
      },
    };
  }
  const inner = objectEffect("innerShadow", "Inner shadow", { color: {}, opacity: { label: "opacity", min: 0, max: 1, step: 0.05 }, blur: { label: "blur", min: 0, max: 200, step: 1 }, distance: { label: "distance", min: 0, max: 200, step: 1 }, angle: { label: "angle", min: 0, max: 360, step: 5 } }, {});
  const glow = objectEffect("glow", "Glow", { color: {}, opacity: { label: "opacity", min: 0, max: 1, step: 0.05 }, radius: { label: "radius", min: 0, max: 200, step: 1 } }, {});
  const reflection = objectEffect("reflection", "Reflection", { opacity: { label: "opacity", min: 0, max: 1, step: 0.05 }, size: { label: "size", min: 0, max: 1, step: 0.05, help: "How much of the shape's height the reflection takes to fade out" }, distance: { label: "distance", min: 0, max: 200, step: 1 }, blur: { label: "blur", min: 0, max: 200, step: 1 } }, {});
  const softEdge = numberField("shape-soft-edge", "Soft edges", { min: 0, max: 200, step: 1, help: "Radius in reference pixels over which the outline fades. Clear for none.", onCommit: (value) => commit({ softEdge: value }, "Soft edges changed.") });
  const blur = numberField("shape-blur", "Blur", { min: 0, max: 200, step: 1, help: "Radius in reference pixels. Clear for none.", onCommit: (value) => commit({ blur: value }, "Blur changed.") });
  const syncEffects = () => {
    shadowDetail.hidden = shadowKind.select.value !== "custom";
  };
  const effectsGroup = group("Effects", "shape-effects-group", shadowKind.wrap, shadowDetail, inner.wrap, glow.wrap, reflection.wrap, softEdge.wrap, blur.wrap);

  // --- rotation and flip ---------------------------------------------------------------------------------------------------------------
  const rotate = numberField("shape-rotate", "Rotate", { min: -360, max: 360, step: 5, help: "Degrees clockwise about the center", onCommit: (value) => commit({ rotate: value }, "Rotation changed.") });
  const flip = selectField("shape-flip", "Flip", { empty: "None", onChange: (value) => commit({ flip: value === "" ? null : value }, "Flip changed.") });
  flip.setOptions([{ value: "horizontal", label: "Horizontal" }, { value: "vertical", label: "Vertical" }, { value: "both", label: "Both" }]);
  const positionGroup = group("Rotate and flip", "shape-transform-group", rotate.wrap, flip.wrap);

  // --- text ----------------------------------------------------------------------------------------------------------------------------
  const text = textField("shape-text", "Text", { multiline: true, help: "The text inside the shape. Enter applies; Shift+Enter starts a new line.", onCommit: (value) => commit({ text: value }, value === "" ? "Text removed." : "Text changed.") });
  const anchor = selectField("shape-anchor", "Text anchor", { empty: "Middle (default)", onChange: (value) => commit({ anchor: value === "" ? null : value }, "Text anchor changed.") });
  anchor.setOptions([{ value: "top", label: "Top" }, { value: "bottom", label: "Bottom" }]);
  const padding = textField("shape-padding", "Padding", { placeholder: "9.6 or 4.8 9.6 4.8 9.6", help: "Text insets in reference pixels: one number, or top right bottom left. Clear for the default.", onCommit: (value) => {
    const parts = value.split(/[\s,]+/).filter(Boolean).map(Number);
    if (parts.length === 0) return commit({ padding: null }, "Padding reset.");
    if (!parts.every(Number.isFinite) || ![1, 4].includes(parts.length)) return ctx.complain("Padding is one number, or four: top right bottom left.");
    return commit({ padding: parts.length === 1 ? parts[0] : { top: parts[0], right: parts[1], bottom: parts[2], left: parts[3] } }, "Padding changed.");
  } });
  const direction = selectField("shape-text-direction", "Text direction", { empty: "Horizontal (default)", onChange: (value) => commit({ textDirection: value === "" ? null : value }, "Text direction changed.") });
  direction.setOptions([{ value: "vertical", label: "Vertical (turned 90 degrees)" }, { value: "vertical270", label: "Vertical (turned 270 degrees)" }, { value: "stacked", label: "Stacked letters" }]);
  const textGroup = group("Text", "shape-text-group", text.wrap, anchor.wrap, padding.wrap, direction.wrap);

  // --- accessibility and links -----------------------------------------------------------------------------------------------------------
  const alt = textField("shape-alt", "Alt text", { help: "Read by screen readers. Without it the shape's text is read.", onCommit: (value) => commit({ alt: value }, value.trim() === "" ? "Alt text removed." : "Alt text changed.") });
  const decorative = checkField("shape-decorative", "Decorative", { help: "Screen readers skip the shape", onChange: (checked) => commit({ decorative: checked }, checked ? "Marked decorative." : "No longer decorative.") });
  const hidden = checkField("shape-hidden", "Hidden", { help: "Kept in the file but not drawn; it keeps its room", onChange: (checked) => commit({ hidden: checked }, checked ? "Shape hidden." : "Shape shown.") });
  const link = textField("shape-link", "Link", { placeholder: "https://…", help: "An http(s) URL, mailto: or tel: opened when the shape is clicked in a slide show", onCommit: (value) => commit({ link: value }, value.trim() === "" ? "Link removed." : "Link set.") });
  const accessGroup = group("Alt text and link", "shape-access-group", alt.wrap, decorative.wrap, hidden.wrap, link.wrap);

  // --- an overlay shape: where it is, what is over it (Part B) -----------------------------------------------------------------------------
  const place = (change, done) => run(() => setOverlayFrame(editor, path, change), done);
  const percent = (key, label, help) => numberField(`shape-frame-${key}`, label, { min: 0, max: 100, step: 1, help, onCommit: (value) => { if (value !== null) place({ [key]: Math.round(value * 100) / 10000 }, `${label} changed.`); } });
  const frameX = percent("x", "X", "Percent of the slide from its start edge (the left, in a left-to-right deck)");
  const frameY = percent("y", "Y", "Percent of the slide from its top");
  const frameWidth = percent("width", "Width", "Percent of the slide's width");
  const frameHeight = percent("height", "Height", "Percent of the slide's height");
  const anchorInfo = h("p", { class: "opf-dc-hint", "data-role": "shape-anchor-info" });
  const anchorOffset = numberField("shape-anchor-offset", "Offset", { min: -720, max: 720, step: 1, help: "Reference pixels from the block's edge (negative overlaps it)", onCommit: (value) => { if (value !== null) place({ offset: value }, "Offset changed."); } });
  const anchorWidth = numberField("shape-anchor-width", "Anchored width", { min: 0.001, max: 1280, step: 1, help: "A fraction of the block's width up to 1, else reference pixels", onCommit: (value) => { if (value !== null) place({ width: value }, "Width changed."); } });
  const anchorHeight = numberField("shape-anchor-height", "Anchored height", { min: 0.001, max: 1280, step: 1, help: "A fraction of the block's height up to 1, else reference pixels", onCommit: (value) => { if (value !== null) place({ height: value }, "Height changed."); } });
  const free = button("Free from block", () => {
    const geometry = geometryFor?.(path);
    const entry = geometry?.overlayShapes?.find((candidate) => candidate.kind === "shape" && candidate.path === path);
    if (!entry) return ctx.complain("This shape is not drawn right now, so its place cannot be read.");
    const box = entry.shape.box;
    const rtl = slideIsRtl(editor.presentation, Number(path.split(".")[1]));
    run(() => detachOverlay(editor, path, { x: rtl ? (geometry.width - box.x - box.width) / geometry.width : box.x / geometry.width, y: box.y / geometry.height, width: box.width / geometry.width, height: box.height / geometry.height }), "The shape no longer follows its block.");
  }, { quiet: true, title: "Keep the shape where it is, with its own x, y, width and height" });
  free.dataset.role = "shape-free";
  const fractionBox = h("div", { class: "opf-sc-row", "data-role": "shape-frame-fields" }, frameX.wrap, frameY.wrap, frameWidth.wrap, frameHeight.wrap);
  const anchorBox = h("div", { "data-role": "shape-anchor-fields" }, anchorInfo, anchorOffset.wrap, anchorWidth.wrap, anchorHeight.wrap, free);
  const placementGroup = group("Place on the slide", "shape-placement-group", fractionBox, anchorBox);

  const layer = (label, where, role) => {
    const control = button(label, () => run(() => { const change = moveOverlayLayer(editor, path, where); if (change.changed) reselect?.(change.path); return change; }, `${label}.`), { quiet: true });
    control.dataset.role = role;
    return control;
  };
  const layerButtons = [layer("Bring to front", "front", "overlay-front"), layer("Bring forward", "forward", "overlay-forward"), layer("Send backward", "backward", "overlay-backward"), layer("Send to back", "back", "overlay-back")];
  const remove = button("Delete", () => {
    const slideIndex = path.split(".")[1];
    run(() => removeOverlay(editor, path), "Deleted.");
    reselect?.(`slides.${slideIndex}.title`);
  }, { quiet: true, title: "Delete this overlay (and the connectors that end on it)" });
  remove.dataset.role = "overlay-remove";
  const stackGroup = group("Stacking", "shape-stack-group", h("div", { class: "opf-sc-row", "data-role": "overlay-layers" }, ...layerButtons), remove);

  // --- a connector: its route and ends -------------------------------------------------------------------------------------------------------
  const connectorChange = (change, done) => run(() => setConnector(editor, path, change), done);
  const route = selectField("shape-connector-route", "Connector route", { help: "Straight, elbow (right angles) or curved", onChange: (value) => connectorChange({ route: value }, `Route: ${value}.`) });
  route.setOptions(CONNECTOR_ROUTES.map((value) => ({ value, label: cap(value) })));
  const endField = (key, label) => selectField(`shape-connector-${key}`, label, { help: "A block or an overlay shape of this slide. One without an id gets one.", onChange: (value) => { if (value) connectorChange({ [key]: value }, `${label} changed.`); } });
  const fromEnd = endField("from", "Connector start");
  const toEnd = endField("to", "Connector end");
  const siteField = (key, label) => numberField(`shape-connector-${key}`, label, { min: 0, step: 1, placeholder: "automatic", help: "The connection site of the shape the connector leaves from, by number (the shape's own sites, from 0). Clear to choose the facing sites.", onCommit: (value) => connectorChange({ [key]: value }, value === null ? `${label} is automatic.` : `${label} set.`) });
  const fromSite = siteField("fromSite", "Start site");
  const toSite = siteField("toSite", "End site");
  const connectorGroup = group("Connector", "shape-connector-group", route.wrap, fromEnd.wrap, toEnd.wrap, h("div", { class: "opf-sc-row" }, fromSite.wrap, toSite.wrap));

  const shapeOnly = [shapeGroup, fillGroup, effectsGroup, positionGroup, textGroup];
  const styleWrap = h("div", { class: "opf-sc-style" }, style.wrap);
  root.append(connectorGroup, placementGroup, shapeGroup, fillGroup, lineGroup, styleWrap, effectsGroup, positionGroup, textGroup, accessGroup, stackGroup);

  /** Show the groups that belong to what is selected: a block's shape, an overlay shape (placed and stacked) or an overlay connector. */
  function applyKind(kind) {
    const connector = kind === "connector";
    const overlay = kind === "overlay" || connector;
    for (const part of [...shapeOnly, styleWrap]) part.hidden = connector;
    connectorGroup.hidden = !connector;
    placementGroup.hidden = kind !== "overlay";
    stackGroup.hidden = !overlay;
    aspect.wrap.hidden = overlay;
    link.wrap.hidden = connector;
    decorative.wrap.hidden = false;
  }

  syncFill();
  syncStroke();
  syncEffects();

  // --- adjust values -------------------------------------------------------------------------------------------------------------------
  /** The frame's size as composition drew it, for the handle ranges (they depend on it), else undefined (the default frame). */
  function frameSize() {
    const geometry = geometryFor?.(path);
    const block = path.replace(/\.(shape|path|text)$/, "");
    const item = geometry?.items?.find((entry) => entry.field === "shape" && String(entry.path).replace(/\.(shape|path|text)$/, "") === block);
    const box = item?.shape?.box;
    return box ? { width: box.width, height: box.height } : undefined;
  }
  function drawAdjust(found) {
    const size = frameSize();
    const state = found.preset && shapeEngine() ? readShapeAdjust(editor.presentation, found.path, size) : undefined;
    const signature = JSON.stringify([found.path, found.preset, state && Object.entries(state).map(([name, entry]) => [name, entry.value, entry.min, entry.max])]);
    if (signature === adjustSignature) return;
    adjustSignature = signature;
    adjustBox.replaceChildren();
    const names = state ? Object.keys(state) : [];
    adjustBox.hidden = resetAdjust.hidden = names.length === 0;
    for (const name of names) {
      const entry = state[name];
      const range = entry.min === null && entry.max === null ? "any value" : `${entry.min ?? "any"} to ${entry.max ?? "any"}`;
      const field = numberField(`shape-adjust-${name}`, `Adjust ${name}`, {
        min: entry.min ?? undefined,
        max: entry.max ?? undefined,
        step: entry.unit === "degrees" ? 1 : 0.01,
        placeholder: String(entry.default),
        help: `${entry.unit === "degrees" ? "Degrees" : "A fraction of the shape"}, ${range}. The preset's default is ${entry.default}.`,
        onCommit: (value) => run(() => setShapeAdjust(editor, path, { [name]: value }, { size: frameSize() }), value === null ? `${name} reset.` : `${name} set to ${value}.`),
      });
      field.set(entry.set ? String(entry.value) : "");
      field.wrap.dataset.adjust = name;
      adjustBox.append(field.wrap);
    }
  }

  /** Fill the controls from the shape block at `blockPath` (a selection in it works). */
  /** The connector's route, ends and sites. */
  function loadConnector(overlay) {
    const connector = overlay.entry.connector;
    route.set(connector.route ?? "straight");
    const ends = listConnectionEnds(editor.presentation, overlay.slideIndex);
    const options = ends.map((end) => ({ value: end.path, label: `${end.label}${end.id ? ` (${end.id})` : " (no id yet)"}`, id: end.id }));
    for (const [field, id] of [[fromEnd, connector.from], [toEnd, connector.to]]) {
      field.setOptions(options.map(({ value, label }) => ({ value, label })));
      field.set(options.find((option) => option.id === id)?.value ?? "", options.some((option) => option.id === id) ? "" : `${id} is missing`);
    }
    fromSite.set(show(connector.fromSite));
    toSite.set(show(connector.toSite));
  }

  /** The overlay shape's place: fractions of the slide, or its anchor. */
  function loadPlacement(overlay) {
    const entry = overlay.entry;
    const anchored = overlay.placement === "at";
    fractionBox.hidden = anchored;
    anchorBox.hidden = !anchored;
    if (anchored) {
      anchorInfo.textContent = `Attached to ${entry.at.block}, ${entry.at.edge}. It follows the block when composition moves it.`;
      anchorOffset.set(show(entry.at.offset ?? 0));
      anchorWidth.set(show(entry.at.width));
      anchorHeight.set(show(entry.at.height));
      return;
    }
    const percentOf = (value) => (typeof value === "number" ? String(Math.round(value * 10000) / 100) : "");
    frameX.set(percentOf(entry.x));
    frameY.set(percentOf(entry.y));
    frameWidth.set(percentOf(entry.width));
    frameHeight.set(percentOf(entry.height));
  }

  function load(blockPath) {
    if (destroyed) return;
    const overlay = readOverlay(editor.presentation, blockPath);
    const connector = overlay?.kind === "connector";
    const found = connector ? undefined : readShape(editor.presentation, blockPath);
    if (!found && !connector) return;
    path = connector ? overlay.path : found.path;
    applyKind(connector ? "connector" : overlay ? "overlay" : "block");
    const block = connector ? overlay.entry : found.block;
    if (overlay) loadPlacement(overlay);
    if (connector) loadConnector(overlay);
    if (found) {
      // The preset and its thumbnail (once the geometry has loaded).
      presetValue.textContent = found.preset ? `${shapeLabel(found.preset)} (${found.preset})` : "Custom outline";
      change.disabled = found.custom;
      const engine = shapeEngine();
      if (engine && found.preset) preview.replaceChildren(shapeThumbnailNode(doc, engine, found.preset, 30));
      else {
        preview.replaceChildren();
        if (!engine) loadShapeEngine().then(() => { if (!destroyed && path === found.path) load(path); }, () => {});
      }
      drawAdjust(found);
    }
    aspect.set(show(block.aspectRatio));
    resetAdjust.disabled = !isObject(block.adjust);
    // Fill.
    const fill = block.fill;
    const kind = fill === undefined ? "" : fill === "none" ? "none" : isObject(fill) && fill.gradient ? "gradient" : isObject(fill) && fill.pattern ? "pattern" : "color";
    fillKind.set(kind);
    fillColor.set(kind === "color" ? fill : undefined);
    fillGradient.set(kind === "gradient" ? fill.gradient : undefined);
    patternPreset.set(kind === "pattern" ? (fill.pattern.preset ?? "ltUpDiag") : "ltUpDiag");
    patternFg.set(kind === "pattern" ? fill.pattern.foregroundColor : undefined);
    patternBg.set(kind === "pattern" ? fill.pattern.backgroundColor : undefined);
    opacity.set(show(block.opacity));
    syncFill();
    // Line.
    const stroke = block.stroke;
    strokeMode.set(stroke === undefined ? "" : stroke === "none" ? "none" : "custom");
    const line = isObject(stroke) ? stroke : {};
    strokeGradientOn.set(line.gradient !== undefined);
    strokeColor.set(line.color);
    strokeGradient.set(line.gradient);
    strokeWidth.set(show(line.width));
    strokeDash.set(Array.isArray(line.dash) ? "custom" : (line.dash === "solid" ? "" : (line.dash ?? "")));
    strokeCustomDash.set(Array.isArray(line.dash) ? line.dash.join(", ") : "");
    strokeCap.set(line.cap === "flat" ? "" : (line.cap ?? ""));
    strokeJoin.set(line.join === "miter" ? "" : (line.join ?? ""));
    strokeMiter.set(show(line.miterLimit));
    strokeCompound.set(line.compound === "single" ? "" : (line.compound ?? ""));
    strokeAlign.set(line.align === "center" ? "" : (line.align ?? ""));
    strokeSketch.set(line.sketch ?? "");
    for (const [arrow, value] of [[startArrow, line.start], [endArrow, line.end]]) {
      arrow.type.set(value && value.type && value.type !== "none" ? value.type : "");
      arrow.width.set(value?.width === "medium" ? "" : (value?.width ?? ""));
      arrow.length.set(value?.length === "medium" ? "" : (value?.length ?? ""));
    }
    syncStroke();
    // Style, effects, transform, text and accessibility.
    style.set(block.style ?? "");
    const shadow = block.shadow;
    shadowKind.set(shadow === undefined ? "" : typeof shadow === "string" ? shadow : "custom");
    const custom = isObject(shadow) ? shadow : {};
    shadowColor.set(custom.color);
    for (const [key, field] of [["opacity", shadowOpacity], ["blur", shadowBlur], ["distance", shadowDistance], ["angle", shadowAngle], ["size", shadowSize]]) field.set(show(custom[key]));
    syncEffects();
    inner.set(block.innerShadow);
    glow.set(block.glow);
    reflection.set(block.reflection);
    softEdge.set(show(block.softEdge));
    blur.set(show(block.blur));
    rotate.set(show(block.rotate));
    flip.set(block.flip ?? "");
    text.input.disabled = !found?.explicit;
    text.input.title = found?.explicit ? "" : "This shape sits directly in its slide or region; add it as a block of the slide to give it text.";
    text.set(typeof block.text === "string" ? block.text : Array.isArray(block.text) ? block.text.map((run) => (typeof run === "string" ? run : (run?.text ?? ""))).join("") : "");
    // Rich text (runs) cannot be edited as plain text without losing its formatting: it is edited on the slide.
    if (Array.isArray(block.text)) {
      text.input.disabled = true;
      text.input.title = "This text has formatting. Edit it on the slide.";
    }
    anchor.set(block.anchor === "middle" ? "" : (block.anchor ?? ""));
    padding.set(isObject(block.padding) ? [block.padding.top ?? 4.8, block.padding.right ?? 9.6, block.padding.bottom ?? 4.8, block.padding.left ?? 9.6].join(" ") : show(block.padding));
    direction.set(block.textDirection === "horizontal" ? "" : (block.textDirection ?? ""));
    alt.set(show(block.alt));
    decorative.set(block.decorative === true);
    hidden.set(block.hidden === true);
    link.set(show(block.link));
  }

  return {
    load,
    destroy() {
      destroyed = true;
      picker?.destroy();
      root.remove();
    },
  };
}
