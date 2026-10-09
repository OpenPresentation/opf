import {
  createEditorSession,
  mergeCatalogs,
  opfPathToJsonPointer,
  applyJsonPatch,
  getValueAtPath,
  splitOpfPath,
} from "./index.js";
import {
  toSvg,
  resolvePresentation,
} from "@openpresentation/opf-render/svg";
import {
  getEditableFields,
  emptyLike,
  fieldChoices,
  parseCanvasValue,
  createCanvasDraft,
} from "./canvas-fields.js";
import { createBlockControls } from "./block-controls.js";
import { createLayoutHandles } from "./layout-handles.js";
import { createRichTextInput } from "./rich-text-input.js";
import { textInputOffsetAtPoint } from "./text-pointer.js";
import { createRichTextToolbar } from "./rich-text-toolbar.js";
import { createImageCropper } from "./image-cropper.js";
import { FONTS_PENDING, fontGate, fontsPendingError, whenFontsReady } from "./font-gate.js";
import { checkFormat, firstErrorMessage } from "./checks.js";
export { getEditableFields } from "./canvas-fields.js";
export { whenFontsReady, FONTS_PENDING, FONTS_UNAVAILABLE } from "./font-gate.js";

/** Allocated placeholder or internal-part bounds for the selection outline, not glyph ink. */
export function allocatedSelectionBox(node, item) {
  const traced = {
    x: Number(node.dataset?.opfBoxX),
    y: Number(node.dataset?.opfBoxY),
    width: Number(node.dataset?.opfBoxWidth),
    height: Number(node.dataset?.opfBoxHeight),
  };
  const hasTraced = [traced.x, traced.y, traced.width, traced.height].every(Number.isFinite) && (traced.width > 0 || traced.height > 0);
  const partRole = typeof node.hasAttribute === "function" && (
    node.hasAttribute("data-opf-code-role") ||
    node.hasAttribute("data-opf-metric-role") ||
    node.hasAttribute("data-opf-source-text")
  );
  if (partRole && hasTraced) return traced;
  if (item?.box && [item.box.x, item.box.y, item.box.width, item.box.height].every(Number.isFinite)) {
    return { x: item.box.x, y: item.box.y, width: item.box.width, height: item.box.height };
  }
  if (hasTraced) return traced;
  let bounds = typeof node.getBBox === "function" ? node.getBBox() : { x: 0, y: 0, width: 0, height: 0 };
  const lines = JSON.parse(node.getAttribute?.("data-opf-rich-lines") ?? "[]");
  if (!bounds.width && !bounds.height && lines.length) {
    return {
      x: lines[0].x,
      y: lines[0].y,
      width: Number(node.getAttribute("data-opf-box-width")) || 8,
      height: lines.reduce((sum, line) => sum + line.height, 0),
    };
  }
  return bounds;
}

/** A framework-independent SVG canvas. Drafts render immediately; each edit commits once. */
export function createCanvasEditor(container, options = {}) {
  if (!container?.ownerDocument)
    throw new TypeError("A DOM container is required.");
  const doc = container.ownerDocument,
    win = doc.defaultView;
  const editor =
    options.editor ??
    createEditorSession(options.presentation, { rejectInvalid: true, catalogs: options.catalogs });
  // `options.fonts` is the renderer's fonts handle (`loadFonts()`): it measures the text and draws the faces. A document whose faces
  // are not loaded yet is never rendered: the canvas has the handle load them first and shows "Loading fonts…" meanwhile. Without a
  // handle every document renders at once, with core's portable text estimate.
  const handle = options.fonts, fonts = fontGate(handle);
  // The renderer draws with the session's registered catalogs (plus any `renderOptions.catalogs`): the same list core resolves with.
  const resolveOptions = () => ({ ...renderOptions, catalogs: mergeCatalogs(editor.catalogs, renderOptions.catalogs) });
  // RR-61: the handle measures, and the canvas embeds no face: the browser handle already added its faces to the page, so
  // `@font-face` data would repeat megabytes of base64 in every redraw. Exports keep the default and carry the faces they draw.
  const drawOptions = (extra) => ({ ...resolveOptions(), fonts: handle, text: "system", ...extra });
  let slideIndex = options.slideIndex ?? 0,
    // RR-32: the canvas edits the document as authored, so a template's {{tokens}} stay visible and an inline edit never
    // overwrites one with its resolved text. The Fill template panel previews the resolved deck. Pass `variables` to override.
    renderOptions = { variables: false, ...(options.renderOptions ?? {}) },
    showToken = 0,
    fontsShown = false,
    active = null,
    selectedPath = null,
    disposed = false,
    frame = 0,
    committing = false,
    pointerTaken = null,
    handledPointer = null,
    stopDrag = null;
  // How a pointer enters text editing: "click" (default; PowerPoint / Google Slides) puts the caret at the pressed
  // character on a single press and lets a press-drag select a range; "dblclick" keeps the older double-click gesture
  // but still places the caret at the pointer. Keyboard entry (Enter, Space, F2) always selects all text.
  const textEntry = options.textEntry ?? "click";
  if (textEntry !== "click" && textEntry !== "dblclick")
    throw new RangeError('textEntry must be "click" or "dblclick".');
  const root = doc.createElement("div"),
    preview = doc.createElement("div"),
    overlay = doc.createElement("div"),
    notice = doc.createElement("div");
  root.className = "opf-canvas";
  root.style.cssText = "position:relative;width:100%;isolation:isolate;touch-action:manipulation";
  preview.className = "opf-canvas-preview";
  overlay.className = "opf-canvas-overlay";
  overlay.style.cssText = "position:absolute;inset:0;pointer-events:none";
  notice.setAttribute("role", "status");
  notice.style.cssText =
    "position:absolute;left:8px;bottom:8px;max-width:calc(100% - 16px);font:12px/1.4 system-ui;background:#fff8ed;color:#875217;border:1px solid #ead5b3;border-radius:5px;padding:6px 10px;z-index:4";
  notice.hidden = true;
  const style = doc.createElement("style");
  style.textContent =
    ".opf-canvas-preview>svg{display:block;width:100%;height:auto}.opf-canvas [data-canvas-target]{cursor:text}.opf-canvas .opf-inline-input::selection{background:#8975d933;color:var(--opf-inline-selection-color,transparent)}.opf-canvas [data-canvas-target]:focus{outline:none}.opf-canvas [data-canvas-target]:hover>.opf-selection{stroke:#9c90df}.opf-canvas [data-canvas-selected]>.opf-selection,.opf-canvas [data-canvas-target]:focus-visible>.opf-selection{stroke:#7765d0}.opf-canvas button:focus-visible,.opf-canvas textarea:focus-visible,.opf-canvas input:focus-visible{outline:2px solid #8170d5;outline-offset:2px}";
  root.append(style, preview, overlay, notice);
  container.replaceChildren(root);
  const report = (error) => {
    notice.hidden = false;
    notice.textContent = error.message;
    options.onError?.(error);
  };
  const clearNotice = () => {
    notice.hidden = true;
    notice.textContent = "";
  };
  const richToolbar = createRichTextToolbar(root, { editor, report, beforeChange: commit,
    onTyping: beginEdit,
    onProperties(path) { if (commit()) openProperties(path, editor.get(path)); },
    validateChange(path, value) {
      validateRender(createCanvasDraft(editor.presentation, path, value));
    },
    onChange(path) { clearNotice(); options.onCommit?.({path, editor}); }
  });
  // RR-25: picture tools. A selected picture shows a "Crop picture" button; `cropImage(path)` opens the same layer.
  const imageCropper = options.imageTools === false ? null : createImageCropper(root, overlay, {
    editor,
    beforeOpen: () => commit(),
    getImageElement: (path) => [...preview.querySelectorAll("image[data-opf-path]")].find((node) => node.getAttribute("data-opf-path") === path) ?? null,
    report,
    onCommit: (value) => { clearNotice(); options.onCommit?.({ ...value, editor }); },
    onCancel: () => options.onCancel?.({}),
  });
  const layoutHandles = createLayoutHandles(root, {
    editor, enabled: options.layoutEditing, render: renderFor, beforeEdit: commit,
    isTextEditing: () => !!active,
    clearError: clearNotice, onError: report,
    onDraft: value => options.onDraft?.(value),
    onCommit: value => options.onCommit?.(value),
    onCancel: value => { clearNotice(); options.onCancel?.(value); },
  });
  const blockControls = createBlockControls(root, {
    editor, render: renderFor, beforeEdit: () => {if(!commit())return false;richToolbar.hide();return true;}, enabled: () => layoutHandles.enabled,
    isEditing: () => !!active || !!layoutHandles.editingPath, slideIndex: () => slideIndex,
    validate: presentation => validateRender(presentation),
    clearError: clearNotice, onError: report,
    onMove: path => choose(splitOpfPath(path).join(".")),
    onCommit: value => options.onCommit?.(value),
  });
  function targets() {
    return [...preview.querySelectorAll("[data-canvas-target]")];
  }
  function getTarget(path) {
    return targets().find(
      (node) => node.getAttribute("data-opf-path") === path,
    );
  }
  function choose(path) {
    selectedPath = path;
    imageCropper?.sync(path);
    for (const node of targets())
      node.toggleAttribute(
        "data-canvas-selected",
        node.getAttribute("data-opf-path") === path,
      );
    options.onSelect?.({
      path,
      value: editor.get(path),
      element: getTarget(path),
      editor,
    });
  }
  const pendingMessage = "Loading fonts for this document…";
  // A synchronous render or validation of a document whose faces are still loading fails with a clear "fonts-pending"
  // error and starts the load, so the next attempt succeeds. It never draws glyphs the registry cannot provide.
  function requireFonts(presentation) {
    const pending = fonts?.pending(presentation, resolveOptions()) ?? [];
    if (!pending.length) return;
    notice.hidden = false;
    notice.textContent = pendingMessage;
    fonts.ensure(presentation, { renderOptions: resolveOptions() }).then(
      () => { if (!disposed && notice.textContent === pendingMessage) clearNotice(); },
      (error) => { if (!disposed) report(error); },
    );
    throw fontsPendingError(pending);
  }
  function validateRender(presentation) {
    requireFonts(presentation);
    return toSvg(presentation, slideIndex + 1, drawOptions());
  }
  function fontsState(kind, detail) {
    fontsShown = true;
    const size = preview.firstElementChild?.getBoundingClientRect?.().height || 0;
    layoutHandles.hide();
    blockControls.hide();
    richToolbar.hide();
    const box = doc.createElement("div");
    box.className = "opf-canvas-fonts";
    box.setAttribute("role", kind === "error" ? "alert" : "status");
    box.style.cssText = `box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;min-height:${Math.max(160, Math.round(size))}px;padding:16px;text-align:center;font:14px/1.4 system-ui;background:rgba(127,127,127,.12);border-radius:4px`;
    const message = doc.createElement("span");
    message.textContent = kind === "error" ? detail.message : "Loading fonts…";
    box.append(message);
    if (kind === "error") {
      const retry = doc.createElement("button");
      retry.type = "button";
      retry.textContent = "Retry loading fonts";
      retry.addEventListener("click", () => show());
      box.append(retry);
    }
    preview.replaceChildren(box);
    if (kind === "error") options.onError?.(detail);
    options.onFonts?.(kind === "error" ? { state: "error", error: detail } : { state: "loading", pending: detail });
  }
  // Render a document the canvas did not draw itself (an editor change, a slide or option change) once its fonts are loaded.
  function show(target) {
    if (disposed) return;
    const token = ++showToken;
    return whenFontsReady(fonts, target ?? editor.presentation, {
      renderOptions: resolveOptions(),
      isCurrent: () => !disposed && token === showToken,
      loading: (pending) => fontsState("loading", pending),
      ready: () => {
        try {
          render(target);
        } catch (error) {
          if (error?.code === FONTS_PENDING) show(target);
          else report(error);
        }
      },
      failed: (error) => fontsState("error", error),
    });
  }
  // Renders now when the document's fonts are loaded (errors throw to the caller), otherwise after loading them.
  function renderFor(presentation) {
    if (fonts?.pending(presentation ?? editor.presentation, resolveOptions()).length) show(presentation);
    else render(presentation);
  }
  function render(presentation = editor.presentation) {
    if (disposed) return;
    requireFonts(presentation);
    showToken++;
    const slides = presentation.slides ?? [];
    slideIndex = Math.max(0, Math.min(slideIndex, slides.length - 1));
    const svgText = toSvg(presentation, slideIndex + 1, drawOptions({ trace: true }));
    preview.innerHTML = svgText;
    const svg = preview.querySelector("svg");
    svg.setAttribute("role", "group");
    svg.setAttribute("aria-label", "Editable slide");
    // FA-30: the renderer labels its slide root a "slide" group named by the title; the canvas is named for editing instead, so it drops
    // the roledescription rather than announce "Editable slide, slide".
    svg.removeAttribute("aria-roledescription");
    svg.removeAttribute("aria-labelledby");
    const geometry = resolvePresentation(presentation, drawOptions()).slides[
      slideIndex
    ].geometry;
    const candidates = [...svg.querySelectorAll("[data-opf-path]")];
    const seen = new Set();
    for (const node of candidates) {
      const path = node.getAttribute("data-opf-path");
      const item = geometry.items.find((item) => item.path === path);
      const value = getValueAtPath(presentation, path);
      if (
        seen.has(path) ||
        node.getAttribute('data-opf-generated') === 'true' ||
        node.closest('[data-opf-furniture-generated="true"]') ||
        (node.hasAttribute('data-opf-code-container') && typeof value === 'string') ||
        (node.hasAttribute('data-opf-metric-container') && ['string','number'].includes(typeof value)) ||
        (!item && !node.matches("g") && !node.matches("image")) ||
        value === undefined ||
        path === `slides.${slideIndex}` ||
        (path.includes(".design.")&&!node.closest('[data-opf-furniture-editable="true"]'))
      )
        continue;
      // Prefer the containing group over its duplicate text/shape trace attributes.
      if (
        !node.matches("g,image") ||
        (node.matches("g") && !node.querySelector("text,image,rect,path") && !node.hasAttribute("data-opf-rich-text"))
      )
        continue;
      seen.add(path);
      node.setAttribute("data-canvas-target", "");
      // FA-30: the renderer hides decorative drawing and a picture or chart with an empty alt (aria-hidden), and names a chart with
      // alt as an image group. An editing target is focusable, so neither it nor a group around it may be hidden or presentational:
      // an ancestor image group (the chart's alt) stays named but becomes a plain group so the targets inside it are reachable.
      for (let up = node; up && up !== svg; up = up.parentNode) {
        up.removeAttribute("aria-hidden");
        if (up !== node && up.getAttribute("role") === "img") up.setAttribute("role", "group");
      }
      node.setAttribute("role", "button");
      node.setAttribute("tabindex", "0");
      node.setAttribute(
        "aria-label",
        `Edit ${path.split(".").at(-1)}: ${["string", "number"].includes(typeof value) ? String(value).slice(0, 80) : "content properties"}`,
      );
      if (node.matches("g")) {
        const bounds = allocatedSelectionBox(node, item);
        const rect = doc.createElementNS("http://www.w3.org/2000/svg", "rect");
        // RR-25: on a touch screen a text block of a few slide units is a few pixels tall, so the target grows (up to 24 slide units
        // each way) until it is about 44 CSS pixels in each direction.
        const padX = touchPad(svg, bounds.width), padY = touchPad(svg, bounds.height);
        for (const [key, value] of Object.entries({
          x: bounds.x - padX,
          y: bounds.y - padY,
          width: Math.max(2 * padX, bounds.width + 2 * padX),
          height: Math.max(2 * padY, bounds.height + 2 * padY),
          fill: "transparent",
          stroke: "transparent",
          "stroke-width": 1.5,
          "vector-effect": "non-scaling-stroke",
          "pointer-events": "all",
        }))
          rect.setAttribute(key, value);
        rect.classList.add("opf-selection");
        node.prepend(rect);
      }
      node.addEventListener("pointerdown", (event) => pointerDown(event, path));
      // Some browsers still run mousedown's focus and text-selection defaults after a handled pointerdown.
      node.addEventListener("mousedown", (event) => { if (pointerTaken === path) event.preventDefault(); });
      node.addEventListener("click", (event) => {
        event.stopPropagation();
        if (event.target.closest("a")) event.preventDefault();
        // A mouse or pen press already entered editing on pointerdown; this click only completes that gesture.
        if (pointerTaken === path) { pointerTaken = null; return; }
        if (active && active.path !== path && !commit()) return;
        // A touch tap has no pointerdown entry (a touch press may start a scroll): it enters on the click itself.
        const kind = editKind(path);
        if (textEntry === "click" && event.detail > 0 && (kind === "text" || kind === "rich-text")) startEdit(path, { point: event });
        else choose(path);
      });
      node.addEventListener("dblclick", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const kind = editKind(path);
        startEdit(path, kind === "text" || kind === "rich-text" ? { point: event } : undefined);
      });
      node.addEventListener("keydown", (event) => {
        // Keyboard entry replaces: all text is selected.
        if (event.key === "Enter" || event.key === " " || event.key === "F2") {
          event.preventDefault();
          event.stopPropagation();
          beginEdit(path);
        }
      });
      if (path === selectedPath) node.setAttribute("data-canvas-selected", "");
    }
    layoutHandles.update(presentation, geometry);
    blockControls.update(presentation, geometry);
    imageCropper?.update();
    if (active?.kind === "text") positionInput();
    if (active?.kind === "rich-text") active.rich?.update();
    if (fontsShown) {
      fontsShown = false;
      options.onFonts?.({ state: "ready" });
    }
    options.onRender?.({
      presentation,
      slideIndex,
      svg,
      geometry,
      draft: !!active || !!layoutHandles.editingPath,
    });
  }
  const coarse = win.matchMedia?.("(pointer: coarse)");
  function touchPad(svg, size) {
    if (!coarse?.matches) return 4;
    const box = svg.getBoundingClientRect(), view = svg.viewBox?.baseVal;
    const scale = box.width && view?.width ? box.width / view.width : 0;
    return scale ? Math.max(4, Math.min(24, (44 / scale - size) / 2)) : 4;
  }
  // An in-progress edit whose text needs faces that are not loaded yet waits for them, then draws again.
  function deferDraft(draft) {
    if (!fonts?.pending(draft, resolveOptions()).length) return false;
    active.valid = false;
    notice.hidden = false;
    notice.textContent = pendingMessage;
    fonts.ensure(draft, { renderOptions: resolveOptions() }).then(
      () => {
        if (disposed) return;
        if (notice.textContent === pendingMessage) clearNotice();
        if (active) queueDraft();
      },
      (error) => { if (!disposed) report(error); },
    );
    return true;
  }
  function queueDraft() {
    if (frame) win.cancelAnimationFrame(frame);
    frame = win.requestAnimationFrame(() => {
      frame = 0;
      if (!active || active.composing) return;
      if (active.kind === "properties") {
        try {
          const draft = propertyDraft(active);
          if (deferDraft(draft)) return;
          clearNotice();
          render(draft);
          options.onDraft?.({
            presentation: draft,
            path: active.path,
            value: undefined,
          });
        } catch (error) {
          report(error);
        }
        return;
      }
      try {
        const value = active.kind === "rich-text" ? active.rich.value : parseCanvasValue(active.input.value, active.type, active.originalValue);
        const draft = createCanvasDraft(editor.presentation, active.path, value);
        if (deferDraft(draft)) return;
        clearNotice();
        active.valid = true;
        active.draft = draft;
        render(draft);
        options.onDraft?.({ presentation: draft, path: active.path, value });
      } catch (error) {
        active.valid = false;
        report(error);
      }
    });
  }
  function positionInput() {
    if (!active || active.kind !== "text") return;
    const target = getTarget(active.path),
      text = target?.matches("text") ? target : target?.querySelector("text");
    if (!text) return;
    const svg = preview.querySelector("svg"),
      svgRect = svg.getBoundingClientRect(),
      rootRect = root.getBoundingClientRect();
    const viewBox = svg.viewBox.baseVal,
      scale = svgRect.width / viewBox.width;
    const font = win.getComputedStyle(text),
      fontSize = parseFloat(font.fontSize),
      geometry = resolvePresentation(
        active.draft ?? editor.presentation,
        drawOptions(),
      ).slides[slideIndex].geometry;
    const item = geometry.items.find((item) => item.path === active.path);
    const metricLayout=geometry.items.find(item=>item.metricLayout?.parts.some(part=>part.path===active.path))?.metricLayout;
    const metricPart=metricLayout?.parts.find(part=>part.path===active.path);
    const timelinePart=geometry.items.find(item=>item.timelineLayout?.parts.some(part=>part.path===active.path))?.timelineLayout?.parts.find(part=>part.path===active.path);
    const furniturePart=geometry.furniture?.parts.find(part=>part.type==='text'&&part.path===active.path);
    const internalPart=metricPart??timelinePart??furniturePart;
    const allText = target.querySelectorAll("text");
    const lineHeight = internalPart?.fit?.lineHeight ?? (
      allText.length > 1
        ? Number(allText[1].getAttribute("y")) - Number(text.getAttribute("y"))
        : fontSize * 1.22);
    const canvas = doc.createElement("canvas"),
      ctx = canvas.getContext("2d");
    ctx.font = `${font.fontStyle} ${font.fontWeight} ${fontSize}px ${font.fontFamily}`;
    const metrics = ctx.measureText("Mg"),
      ascent = metrics.fontBoundingBoxAscent ?? fontSize * 0.9,
      descent = metrics.fontBoundingBoxDescent ?? fontSize * 0.2;
    const baseline = ascent + (lineHeight - ascent - descent) / 2;
    const x = Number(text.getAttribute("x")),
      y = Number(text.getAttribute("y")) - baseline;
    const bounds = target.getBBox(),
      anchor = text.getAttribute("text-anchor");
    const tracedWidth = Number(target.getAttribute("data-opf-box-width"));
    const width = internalPart?.box.width ?? item?.box.width ?? (tracedWidth > 0 ? tracedWidth : Math.max(80, bounds.width + 20));
    const left = internalPart?.box.x ?? (anchor === "middle" ? x - width / 2 : anchor === "end" ? x - width : x);
    const visibleText=active.composing||active.isCode||active.isMetric;
    Object.assign(active.input.style, {
      fontFamily: font.fontFamily,
      fontSize: `${fontSize * scale}px`,
      fontWeight: font.fontWeight,
      fontStyle: font.fontStyle,
      lineHeight: `${lineHeight * scale}px`,
      color: visibleText ? font.fill : "transparent",
      caretColor: font.fill,
      textAlign: furniturePart?.alignment ?? timelinePart?.alignment ?? metricLayout?.alignment ?? (anchor === "middle" ? "center" : anchor === "end" ? "right" : "left"),
      width: `${width * scale}px`,
      height: `${Math.max(lineHeight, allText.length * lineHeight) * scale + 2}px`,
      minHeight: "0",
      letterSpacing: font.letterSpacing,
    });
    active.input.style.left = `${svgRect.left - rootRect.left + (left - viewBox.x) * scale}px`;
    active.input.style.top = `${svgRect.top - rootRect.top + (y - viewBox.y) * scale}px`;
    // When the input supplies visible text, its selected text needs the same fill.
    active.input.style.setProperty('--opf-inline-selection-color',visibleText ? font.fill : 'transparent');
    // Other text keeps the canonical SVG visible beneath the transparent input.
    target.style.opacity = visibleText ? "0" : "1";
  }
  // What editing a target opens: inline text ("text"), the rich-text input ("rich-text"), or the properties form.
  function editKind(path) {
    const value = editor.get(path), target = getTarget(path);
    if (value === undefined || !target) return null;
    if ((typeof value === "string" || typeof value === "number") && target.querySelector("text") && !/\.(image|video)$/.test(path))
      return "text";
    if (Array.isArray(value) && target.hasAttribute("data-opf-rich-text")) return "rich-text";
    return "properties";
  }
  // Textarea offset nearest to a client point, from the traced SVG glyphs (see text-pointer.js).
  function textOffsetAt(edit, clientX, clientY) {
    let source = edit.input.value;
    try {
      if (edit.type === "string") source = parseCanvasValue(edit.input.value, "string", edit.originalValue);
    } catch { /* fall back to the raw input text */ }
    return textInputOffsetAtPoint({
      doc, win, target: getTarget(edit.path), path: edit.path, source, input: edit.input, clientX, clientY,
    });
  }
  function setRange(input, anchor, focus) {
    input.setSelectionRange(Math.min(anchor, focus), Math.max(anchor, focus), focus < anchor ? "backward" : "forward");
  }
  // Press-drag in plain text selects from the press point to the pointer, like PowerPoint. The textarea is not under the
  // pointer when the press lands on the SVG glyphs, so the range is tracked here.
  function trackDrag(edit, anchor, event) {
    stopDrag?.();
    const id = event.pointerId;
    const move = (next) => {
      if (next.pointerId !== id) return;
      if (active !== edit || !next.buttons) return stop();
      setRange(edit.input, anchor, textOffsetAt(edit, next.clientX, next.clientY));
    };
    const end = (next) => { if (next.pointerId === id) stop(); };
    const stop = () => {
      win.removeEventListener("pointermove", move);
      win.removeEventListener("pointerup", end);
      win.removeEventListener("pointercancel", end);
      if (stopDrag === stop) stopDrag = null;
      if (active === edit) edit.input.focus({ preventScroll: true });
    };
    win.addEventListener("pointermove", move);
    win.addEventListener("pointerup", end);
    win.addEventListener("pointercancel", end);
    stopDrag = stop;
  }
  // A mouse or pen press on editable text enters editing at that character (touch enters from its click instead).
  function pointerDown(event, path) {
    if (handledPointer === event) return;
    handledPointer = event;
    if (textEntry !== "click" || disposed || event.button !== 0 || event.pointerType === "touch") return;
    const edit = active?.path === path ? active : null;
    if (edit ? edit.kind !== "text" : !["text", "rich-text"].includes(editKind(path))) return;
    // Own the gesture: no native focus change, text selection or drag while the caret is placed.
    event.preventDefault();
    event.stopPropagation();
    pointerTaken = path;
    if (edit) {
      const at = textOffsetAt(edit, event.clientX, event.clientY);
      setRange(edit.input, at, at);
      edit.input.focus({ preventScroll: true });
      trackDrag(edit, at, event);
      return;
    }
    if (active && !commit()) return;
    startEdit(path, { point: event, drag: true });
  }
  function beginEdit(path) {
    startEdit(path);
  }
  // entry: undefined selects all text (keyboard and programmatic entry); {point} places the caret at a client point;
  // {point, drag} also selects while the pressed pointer moves.
  function startEdit(path, entry) {
    if (disposed) return;
    if (active && active.path === path) return;
    if (active && !commit()) return;
    clearNotice();
    layoutHandles.hide();
    blockControls.hide();
    richToolbar.hide();
    choose(path);
    const value = editor.get(path);
    if (value === undefined) {
      report(new Error("This content no longer exists."));
      return;
    }
    const target = getTarget(path),
      text = target?.querySelector("text");
    if (
      (typeof value === "string" || typeof value === "number") &&
      text &&
      !/\.(image|video)$/.test(path)
    ) {
      const input = doc.createElement("textarea");
      input.className = "opf-inline-input";
      input.value = String(value);
      input.setAttribute("aria-label", `Edit ${path.split(".").at(-1)} inline`);
      const isCode=text.hasAttribute('data-opf-code-role');
      const isMetric=text.hasAttribute('data-opf-metric-role');
      const isTimeline=!!text.closest('[data-opf-timeline-role]');
      const isFurniture=!!text.closest('[data-opf-furniture-editable="true"]');
      input.spellcheck = !isCode;
      input.style.cssText =
        "position:absolute;pointer-events:auto;resize:none;border:0;outline:1px solid #8975d9;outline-offset:4px;margin:0;padding:0;background:transparent;overflow:hidden;min-height:0;box-shadow:none;border-radius:0;white-space:pre-wrap;overflow-wrap:break-word;box-sizing:border-box;z-index:2";
      active = {
        kind: "text",
        path,
        base: JSON.stringify(value),
        originalValue:value,
        isCode,
        isMetric,
        type: typeof value,
        input,
        valid: true,
      };
      overlay.append(input);
      if(isCode){input.style.background='#111827';input.style.tabSize='4';input.style.overflow='auto';}
      if(isMetric){input.style.tabSize='4';input.style.overflow='auto';}
      if(isTimeline||isFurniture)input.style.tabSize='4';
      // Only offer rich text where the canonical schema accepts TextRun[].
      if (typeof value === "string") {
        try {
          createCanvasDraft(editor.presentation, path, [value]);
          const format = doc.createElement("button");
          format.type = "button";
          format.textContent = "Format text";
          format.style.cssText = "position:absolute;bottom:8px;left:8px;pointer-events:auto;z-index:4;background:#fff;color:#574774;border:1px solid #d5cce5;border-radius:5px;padding:6px 10px";
          format.onmousedown = event => event.preventDefault();
          format.onclick = () => {
            if (!commit()) return;
            try {
              editor.set(path, [editor.get(path)], {source:"canvas-rich-text", rejectInvalid:true});
              richToolbar.selectAll(path);
            } catch (error) { report(error); }
          };
          overlay.append(format);
        } catch { /* This scalar field does not accept rich text. */ }
      }
      positionInput();
      input.addEventListener("input", () => {
        // Compare each browser edit with the last canonical draft. Comparing
        // only with the value at focus would normalize untouched mixed line
        // endings between two edits in different parts of the same field.
        if (active?.input===input && active.type==='string')
          active.originalValue=parseCanvasValue(input.value,'string',active.originalValue);
        queueDraft();
      });
      input.addEventListener("compositionstart", () => {
        if (active) {
          active.composing = true;
          positionInput();
        }
      });
      input.addEventListener("compositionend", () => {
        active && (active.composing = false);
        queueDraft();
      });
      input.addEventListener("keydown", (event) => {
        if (event.isComposing) return;
        if (isCode && event.key === 'Tab' && !event.shiftKey) {
          event.preventDefault();input.setRangeText('\t',input.selectionStart,input.selectionEnd,'end');input.dispatchEvent(new win.Event('input',{bubbles:true}));
        } else if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          cancel();
        } else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          commit();
        }
      });
      input.addEventListener("blur", () => {
        if (active?.input === input && !active.composing) commit();
      });
      input.focus({ preventScroll: !!entry?.point });
      if (entry?.point) {
        const at = textOffsetAt(active, entry.point.clientX, entry.point.clientY);
        setRange(input, at, at);
        if (entry.drag) trackDrag(active, at, entry.point);
      } else input.select();
    } else if (Array.isArray(value) && target?.hasAttribute("data-opf-rich-text")) {
      active = {kind:"rich-text",path,base:JSON.stringify(value),valid:true};
      active.rich = createRichTextInput(root, overlay, {
        path, value, getTarget, selectAll: !entry?.point,
        onInput: queueDraft, onCommit: commit, onCancel: cancel, onError: report,
        onFormat(start,end) {
          if (!commit()) return;
          if(start===end)richToolbar.selectAll(path);else richToolbar.selectRange(path,start,end);
        },
      });
      active.input = active.rich.input;
      if (entry?.point) active.rich.pointerStart(entry.point);
    } else openProperties(path, value);
  }
  function propertyPatches(edit) {
    return edit.inputs.map(({ field, input }) => ({
      op: "replace",
      path: opfPathToJsonPointer(field.path),
      value: parseCanvasValue(
        field.type === "boolean" ? input.checked : input.value,
        field.type,
        field.value,
      ),
    }));
  }
  function propertyDraft(edit) {
    const draft = applyJsonPatch(editor.presentation, propertyPatches(edit)),
      validation = checkFormat(draft);
    if (!validation.valid)
      throw new Error(
        firstErrorMessage(validation, "This change is not valid OPF."),
      );
    return draft;
  }
  function openProperties(path, value) {
    const panel = doc.createElement("form");
    panel.setAttribute("aria-label", "Content properties");
    panel.style.cssText =
      "position:absolute;right:10px;top:10px;width:min(330px,calc(100% - 20px));max-height:calc(100% - 20px);overflow:auto;pointer-events:auto;background:#fff;color:#332e40;border:1px solid #dcd5eb;border-radius:8px;padding:16px;box-shadow:0 8px 35px #28203922;z-index:3;font:12px/1.5 system-ui";
    const heading = doc.createElement("strong");
    heading.textContent = `Edit ${path.split(".").at(-1)}`;
    panel.append(heading);
    const { fields, arrays } = getEditableFields(value, path),
      inputs = [];
    for (const field of fields) {
      const label = doc.createElement("label");
      label.style.cssText =
        "display:block;margin-top:10px;color:#756b85;font-size:11px";
      label.textContent = field.label;
      const choices = field.type === "string" ? fieldChoices(field) : undefined;
      const input = doc.createElement(
        choices ? "select" : field.type === "boolean" ? "input" : "textarea",
      );
      if (choices) {
        // A fixed set of values (a timeline event's status) is a menu, not free text.
        for (const choice of choices) {
          const option = doc.createElement("option");
          option.value = choice;
          option.textContent = choice;
          input.append(option);
        }
        input.value = field.value;
      } else if (field.type === "boolean") {
        input.type = "checkbox";
        input.checked = field.value;
      } else {
        input.rows = field.type === "number" ? 1 : 2;
        input.value = field.value === null ? "null" : String(field.value);
      }
      input.setAttribute("aria-label", label.textContent);
      input.style.cssText =
        "display:block;width:100%;font:12px/1.5 system-ui;padding:6px;min-height:0;box-sizing:border-box;border:1px solid #e0dae8;border-radius:4px;color:#332e40;background:white";
      if (field.type === "boolean") input.style.width = "auto";
      label.append(input);
      panel.append(label);
      inputs.push({ field, input });
      input.addEventListener("input", queueDraft);
    }
    if (/(^|\.)image($|\.)/.test(path)) {
      const upload = doc.createElement("input");
      upload.type = "file";
      upload.accept = "image/png,image/jpeg,image/gif,image/webp";
      upload.setAttribute("aria-label", "Replace image");
      upload.style.cssText = "display:block;max-width:100%;margin-top:12px";
      upload.onchange = async () => {
        const file = upload.files?.[0];
        if (!file) return;
        if (file.size > 20 * 1024 * 1024) {
          report(new Error("Choose an image smaller than 20 MB."));
          return;
        }
        const edit = active;
        const reader = new win.FileReader();
        reader.onload = () => {
          if (active !== edit) return;
          const source = inputs.find(
            ({ field }) =>
              field.path === opfPathToJsonPointer(path) ||
              splitOpfPath(field.path).at(-1) === "src",
          );
          if (source) {
            source.input.value = reader.result;
            queueDraft();
          } else
            report(
              new Error("Select an image source field to replace this image."),
            );
        };
        reader.onerror = () => report(new Error("Could not read the image."));
        reader.readAsDataURL(file);
      };
      panel.append(upload);
    }
    for (const array of arrays) {
      const row = doc.createElement("div");
      row.style.cssText =
        "display:flex;justify-content:space-between;gap:8px;margin-top:10px";
      const label = doc.createElement("span");
      label.textContent = array.label || "Items";
      row.append(label);
      for (const [label, remove] of [
        ["Add", false],
        ["Remove last", true],
      ]) {
        const button = doc.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.setAttribute("aria-label", `${label} ${array.path}`);
        button.disabled = remove && !array.length;
        button.onclick = () => {
          if (!commit()) return;
          try {
            const values = editor.get(array.path);
            const next = remove
              ? values.slice(0, -1)
              : [...values, emptyLike(values.at(-1) ?? "")];
            editor.set(array.path, next, {
              source: "canvas-collection",
              rejectInvalid: true,
            });
            beginEdit(path);
          } catch (error) {
            report(error);
          }
        };
        row.append(button);
      }
      panel.append(row);
    }
    const controls = doc.createElement("div");
    controls.style.cssText =
      "display:flex;gap:8px;justify-content:flex-end;margin-top:14px";
    for (const [title, action] of [
      ["Cancel", () => cancel()],
      ["Apply", () => commit()],
    ]) {
      const button = doc.createElement("button");
      button.type = "button";
      button.textContent = title;
      button.style.cssText =
        "border:1px solid #d5cce5;border-radius:5px;padding:5px 10px;background:#f5f2fb;color:#574774;cursor:pointer";
      button.onclick = action;
      controls.append(button);
    }
    panel.append(controls);
    panel.onsubmit = (event) => {
      event.preventDefault();
      commit();
    };
    panel.onkeydown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        cancel();
      }
    };
    active = {
      kind: "properties",
      path,
      base: JSON.stringify(value),
      panel,
      inputs,
      valid: true,
    };
    if (options.propertiesContainer) {
      panel.style.cssText =
        "position:relative;width:100%;font:12px/1.5 system-ui;color:inherit";
      options.propertiesContainer.replaceChildren(panel);
    } else overlay.append(panel);
    inputs[0]?.input.focus();
  }
  function commit() {
    if (blockControls.editingPath) return false;
    if (!committing && layoutHandles.editingPath) return layoutHandles.commit();
    if (committing || !active) return true;
    if (active.composing || active.rich?.composing) return false;
    if (JSON.stringify(editor.get(active.path)) !== active.base) {
      report(
        new Error(
          "This content changed elsewhere. Your draft was cancelled to preserve the newer edit.",
        ),
      );
      cancel(false);
      return false;
    }
    const edit = active;
    try {
      let value;
      if (edit.kind === "rich-text") value = edit.rich.value;
      else if (edit.kind === "text")
        value = parseCanvasValue(edit.input.value, edit.type, edit.originalValue);
      else value = propertyDraft(edit);
      if (edit.kind === "text" || edit.kind === "rich-text")
        validateRender(createCanvasDraft(editor.presentation, edit.path, value));
      committing = true;
      if ((edit.kind === "text" || edit.kind === "rich-text") && JSON.stringify(value) !== edit.base)
        editor.set(edit.path, value, { source: "canvas", rejectInvalid: true });
      if (edit.kind === "properties") {
        const patches = propertyPatches(edit).filter(
          (patch) =>
            JSON.stringify(editor.get(patch.path)) !==
            JSON.stringify(patch.value),
        );
        if (patches.length)
          editor.applyPatch(patches, {
            source: "canvas-properties",
            rejectInvalid: true,
          });
      }
      committing = false;
      active = null;
      edit.rich?.destroy();
      overlay.replaceChildren();
      options.propertiesContainer?.replaceChildren();
      clearNotice();
      render();
      getTarget(edit.path)?.focus();
      options.onCommit?.({ path: edit.path, editor });
      return true;
    } catch (error) {
      committing = false;
      report(error);
      return false;
    }
  }
  function cancel(clear = true) {
    if (blockControls.editingPath) { blockControls.cancel(); render(); return; }
    blockControls.cancel();
    if (layoutHandles.editingPath) { layoutHandles.cancel(clear); return; }
    const path = active?.path, rich = active?.rich;
    active = null;
    rich?.destroy();
    if (frame) {
      win.cancelAnimationFrame(frame);
      frame = 0;
    }
    overlay.replaceChildren();
    richToolbar.hide();
    options.propertiesContainer?.replaceChildren();
    if (clear) clearNotice();
    render();
    getTarget(path)?.focus();
    options.onCancel?.({ path });
  }
  function setSlide(index) {
    if (!Number.isInteger(index) || !editor.presentation.slides?.[index])
      throw new RangeError("Slide index is out of range.");
    if (index === slideIndex) {
      if (!active) renderFor();
      return true;
    }
    if (!commit()) return false;
    richToolbar.hide();
    imageCropper?.cancel();
    slideIndex = index;
    selectedPath = null;
    imageCropper?.sync(null);
    renderFor();
    return true;
  }
  // RR-25: select the content at `path`, or the closest enclosing content that is a canvas target (a list item, a table
  // cell or a quote part selects the list, table or quote it belongs to), after showing the slide the path is on. Returns
  // the path that was selected, or null when the path is not on a slide that is drawn yet (fonts still loading) or no
  // enclosing content is selectable (speaker notes, deck fields). It never moves keyboard focus unless `focus` is true.
  function reveal(path, { focus = false } = {}) {
    if (disposed || typeof path !== "string") return null;
    const slide = /^slides\.(\d+)(?:\.|$)/.exec(path);
    if (slide && Number(slide[1]) !== slideIndex && !setSlide(Number(slide[1]))) return null;
    if (active && !commit()) return null;
    const segments = path.split(".");
    for (let length = segments.length; length >= 3; length--) {
      const candidate = segments.slice(0, length).join(".");
      const node = getTarget(candidate);
      if (!node) continue;
      choose(candidate);
      node.scrollIntoView?.({ block: "nearest", inline: "nearest" });
      if (focus) node.focus?.({ preventScroll: true });
      return candidate;
    }
    return null;
  }
  const unsubscribe = editor.subscribe(() => {
    if (committing || layoutHandles.editingPath) return;
    if (active) {
      if (JSON.stringify(editor.get(active.path)) !== active.base) {
        report(
          new Error(
            "The selected content changed elsewhere; the draft was cancelled.",
          ),
        );
        cancel(false);
        return;
      }
      queueDraft();
      return;
    }
    show();
  });
  const resize = new win.ResizeObserver(() => {
    if (active?.kind === "text") positionInput();
    active?.rich?.update();
  });
  resize.observe(root);
  // The on-screen keyboard shrinks the visual viewport; keep the field being typed in visible above it.
  const keepEditVisible = () => { if (active?.input && coarse?.matches) active.input.scrollIntoView?.({ block: "center", inline: "nearest" }); };
  win.visualViewport?.addEventListener("resize", keepEditVisible);
  root.addEventListener("pointerdown", () => { pointerTaken = null; }, true);
  root.addEventListener("keydown", (event) => {
    if (
      (event.metaKey || event.ctrlKey) &&
      event.key.toLowerCase() === "z" &&
      !event.target.closest("textarea,input")
    ) {
      event.preventDefault();
      event.stopPropagation();
      event.shiftKey ? editor.redo() : editor.undo();
    }
  });
  try {
    renderFor();
  } catch (error) {
    unsubscribe();
    resize.disconnect();
    richToolbar.destroy();
    layoutHandles.destroy();
    blockControls.destroy();
    root.remove();
    throw error;
  }
  const ready = Promise.resolve(doc.fonts?.ready).then(() => {
    if (!disposed && !active) show();
  });
  return {
    editor,
    ready,
    get slideIndex() {
      return slideIndex;
    },
    get editingPath() {
      return active?.path ?? layoutHandles.editingPath ?? blockControls.editingPath ?? null;
    },
    get layoutEditing() { return layoutHandles.enabled; },
    /** True while the crop layer is open. */
    get cropping() { return !!imageCropper?.isOpen; },
    /** Open the crop layer for the picture at `path` (an image block or a slide's `image`). `tool: "focus"` starts with the focal point. */
    cropImage(path, cropOptions) {
      if (!imageCropper) return Promise.resolve(false);
      return imageCropper.open(path, cropOptions);
    },
    setLayoutEditing(enabled) {
      if (!commit()) return false;
      return layoutHandles.setEnabled(enabled);
    },
    openBlockMenu: path => blockControls.open(path),
    openInsertMenu: (containerPath,index) => blockControls.openInsert(containerPath,index),
    select: choose,
    beginEdit,
    editProperties(path) {
      if (active && !commit()) return false;
      richToolbar.hide();
      const value = editor.get(path);
      if (value === undefined) return false;
      choose(path);
      openProperties(path, value);
      return true;
    },
    commit,
    cancel,
    render,
    setSlide,
    reveal,
    setRenderOptions(next) {
      if (!commit()) return false;
      richToolbar.hide();
      renderOptions = { variables: false, ...next };
      renderFor();
      return true;
    },
    destroy() {
      disposed = true;
      stopDrag?.();
      active?.rich?.destroy();
      imageCropper?.destroy();
      richToolbar.destroy();
      layoutHandles.destroy();
      blockControls.destroy();
      unsubscribe();
      resize.disconnect();
      win.visualViewport?.removeEventListener("resize", keepEditVisible);
      if (frame) win.cancelAnimationFrame(frame);
      root.remove();
      options.propertiesContainer?.replaceChildren();
      active = null;
    },
  };
}
