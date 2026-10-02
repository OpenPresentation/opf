// The in-canvas crop tool (RR-25): the DOM over the image-crop model. Selecting a picture on the canvas shows a "Crop picture"
// button; it opens a crop layer over the slide with the whole picture, a crop rectangle with eight drag handles, an
// aspect lock (Free, Original, the frame's own shape, common ratios; Shift while dragging keeps the current ratio), a focal
// point tool for the frame's shape with a zoom, exact numbers, Reset, Restore original, Cancel and Apply. Apply is one
// undoable change (see image-crop.js for what it writes). Pointer events with capture serve mouse, pen and touch (the
// handles have 44px touch targets on a touch screen); the rectangle takes arrow keys (move; Shift resizes; +/- scale),
// Enter applies and Esc cancels. On a phone or tablet the layer fills the screen. Importing this module does not need a DOM.
import {
  CROP_ASPECTS,
  MIN_CROP_SIDE,
  applyCrop,
  aspectRatioFor,
  clampRect,
  describeImage,
  fitAspect,
  focalPointOf,
  focalWindow,
  fullRect,
  isFullRect,
  loadImagePixels,
  moveRect,
  prepareRestore,
  resizeRect,
  restoreOriginal,
  roundRect,
} from "./image-crop.js";

const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const STYLE_ID = "opf-crop-style";
const CSS = `
.opf-crop-pill{position:absolute;pointer-events:auto;z-index:3;min-height:32px;padding:5px 12px;font:600 12px/1.2 system-ui,sans-serif;color:#fff;background:#4b3fb4;border:1px solid #fff;border-radius:16px;box-shadow:0 2px 8px #0004;cursor:pointer}
.opf-crop-pill:focus-visible{outline:3px solid #ffd45a;outline-offset:2px}
.opf-crop-pill[hidden]{display:none}
.opf-crop{position:absolute;inset:0;z-index:6;display:flex;flex-direction:column;background:rgba(22,20,31,.94);color:#f4f2fa;font:13px/1.45 system-ui,sans-serif;pointer-events:auto;touch-action:none;overflow:hidden}
.opf-crop[data-fullscreen]{position:fixed;z-index:2147483000}
.opf-crop *{box-sizing:border-box}
.opf-crop-stage{position:relative;overflow:hidden;flex:1 1 auto;min-height:120px;display:flex;align-items:center;justify-content:center;padding:12px}
.opf-crop-box{position:relative;flex:none;touch-action:none;user-select:none;-webkit-user-select:none;overflow:visible}
.opf-crop-box>img{position:absolute;inset:0;width:100%;height:100%;display:block;user-select:none;-webkit-user-drag:none;pointer-events:none}
.opf-crop-rect{position:absolute;box-shadow:0 0 0 9999px rgba(8,6,16,.62);outline:2px solid #fff;cursor:move;touch-action:none;background-image:linear-gradient(to right,transparent calc(33.33% - .5px),#fff6 calc(33.33% - .5px),#fff6 calc(33.33% + .5px),transparent calc(33.33% + .5px),transparent calc(66.66% - .5px),#fff6 calc(66.66% - .5px),#fff6 calc(66.66% + .5px),transparent calc(66.66% + .5px)),linear-gradient(to bottom,transparent calc(33.33% - .5px),#fff6 calc(33.33% - .5px),#fff6 calc(33.33% + .5px),transparent calc(33.33% + .5px),transparent calc(66.66% - .5px),#fff6 calc(66.66% - .5px),#fff6 calc(66.66% + .5px),transparent calc(66.66% + .5px))}
.opf-crop-rect:focus-visible{outline:3px solid #ffd45a;outline-offset:1px}
.opf-crop-handle{position:absolute;width:14px;height:14px;margin:-7px 0 0 -7px;background:#fff;border:2px solid #4b3fb4;border-radius:3px;touch-action:none}
.opf-crop-handle::after{content:"";position:absolute;inset:-12px}
.opf-crop-handle[data-handle=nw]{left:0;top:0}.opf-crop-handle[data-handle=n]{left:50%;top:0}.opf-crop-handle[data-handle=ne]{left:100%;top:0}.opf-crop-handle[data-handle=e]{left:100%;top:50%}.opf-crop-handle[data-handle=se]{left:100%;top:100%}.opf-crop-handle[data-handle=s]{left:50%;top:100%}.opf-crop-handle[data-handle=sw]{left:0;top:100%}.opf-crop-handle[data-handle=w]{left:0;top:50%}
@media (pointer:coarse){.opf-crop-handle{width:22px;height:22px;margin:-11px 0 0 -11px}.opf-crop-handle::after{inset:-11px}}
.opf-crop-handle[data-handle=n],.opf-crop-handle[data-handle=s]{cursor:ns-resize}.opf-crop-handle[data-handle=e],.opf-crop-handle[data-handle=w]{cursor:ew-resize}.opf-crop-handle[data-handle=nw],.opf-crop-handle[data-handle=se]{cursor:nwse-resize}.opf-crop-handle[data-handle=ne],.opf-crop-handle[data-handle=sw]{cursor:nesw-resize}
.opf-crop[data-tool=focus] .opf-crop-handle{display:none}
.opf-crop[data-tool=focus] .opf-crop-box{cursor:crosshair}
.opf-crop-focus{position:absolute;width:26px;height:26px;margin:-13px 0 0 -13px;border:3px solid #ffd45a;border-radius:50%;box-shadow:0 0 0 2px #0008;pointer-events:none}
.opf-crop-focus::before,.opf-crop-focus::after{content:"";position:absolute;background:#ffd45a;left:50%;top:50%}
.opf-crop-focus::before{width:2px;height:40px;margin:-20px 0 0 -1px}.opf-crop-focus::after{height:2px;width:40px;margin:-1px 0 0 -20px}
.opf-crop-focus[hidden]{display:none}
.opf-crop-bar{position:relative;z-index:1;flex:none;display:flex;flex-direction:column;gap:8px;padding:10px 12px 12px;background:#26233a;border-top:1px solid #3d3957;max-height:48%;overflow:auto;touch-action:pan-y}
.opf-crop-row{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px}
.opf-crop-row[hidden]{display:none}
.opf-crop label{display:inline-flex;align-items:center;gap:6px;font-size:12px}
.opf-crop select,.opf-crop input[type=number]{min-height:34px;padding:4px 8px;font:inherit;color:#f4f2fa;background:#171524;border:1px solid #55507a;border-radius:6px}
.opf-crop input[type=number]{width:84px}
.opf-crop input[type=range]{width:min(220px,50vw);accent-color:#9d92f2}
.opf-crop button{min-height:34px;padding:5px 12px;font:inherit;font-weight:600;color:#f4f2fa;background:#37335a;border:1px solid #5b5686;border-radius:6px;cursor:pointer}
.opf-crop button[aria-pressed=true]{background:#6559cf;border-color:#a79cf6}
.opf-crop button.opf-crop-apply{background:#6559cf;border-color:#a79cf6}
.opf-crop button:disabled{opacity:.5;cursor:default}
.opf-crop button:focus-visible,.opf-crop select:focus-visible,.opf-crop input:focus-visible{outline:3px solid #ffd45a;outline-offset:2px}
.opf-crop details{font-size:12px}.opf-crop summary{cursor:pointer;min-height:28px;display:flex;align-items:center}
.opf-crop-readout{margin:0;font-size:12px;color:#cfcae8;min-height:1.4em}
.opf-crop-error{margin:0;font-size:12px;color:#ffb4a3}.opf-crop-error:empty{display:none}
.opf-crop-actions{display:flex;flex-wrap:wrap;gap:8px;margin-left:auto}
.opf-crop-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media (pointer:coarse){.opf-crop button,.opf-crop select,.opf-crop input[type=number]{min-height:44px}.opf-crop select,.opf-crop input[type=number]{font-size:16px}}
`;

function h(doc, tag, attributes = {}, ...children) {
  const element = doc.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (value === undefined || value === false) continue;
    if (key === "class") element.className = value;
    else if (key === "text") element.textContent = value;
    else element.setAttribute(key, value === true ? "" : String(value));
  }
  for (const child of children) if (child) element.append(child);
  return element;
}

function ensureStyle(doc) {
  if (doc.getElementById(STYLE_ID)) return;
  const style = h(doc, "style", { id: STYLE_ID });
  style.textContent = CSS;
  (doc.head ?? doc.documentElement).append(style);
}

const dimensions = (rect) => `${Math.round(rect.width)} × ${Math.round(rect.height)}`;

/**
 * Create the crop tool for a canvas. `root` is the canvas root (positioned), `overlay` its overlay layer (the pill goes
 * there). Options: `editor`, `getImageElement(path)` (the traced `<image>` of a picture, for the frame's shape and the
 * pill's position), `beforeOpen()` (finish an inline edit; return false to stop), `onCommit({ path })`, `onCancel()`,
 * `report(error)`, `fullscreen` (true, false, or omitted: a screen at most 900px wide, or a short canvas, gets a full-screen layer).
 */
export function createImageCropper(root, overlay, options) {
  const { editor } = options;
  const doc = root.ownerDocument;
  const win = doc.defaultView;
  ensureStyle(doc);

  const pill = h(doc, "button", { type: "button", class: "opf-crop-pill", "aria-label": "Crop picture or set its focal point", title: "Crop picture or set focal point", text: "Crop picture", hidden: true });
  // The pill lives on the root: the canvas clears its overlay layer after every edit.
  root.append(pill);

  let selected = null;
  let session = null;
  let destroyed = false;

  const frameImage = (path) => options.getImageElement?.(path) ?? null;
  const frameRatio = (path) => {
    const node = frameImage(path);
    const width = Number(node?.getAttribute?.("width"));
    const height = Number(node?.getAttribute?.("height"));
    return width > 0 && height > 0 ? width / height : undefined;
  };

  function placePill() {
    const target = selected && !session ? frameImage(selected) : null;
    if (!target || !editor || describeImage(editor.document, selected).error) { pill.hidden = true; return; }
    const box = target.getBoundingClientRect();
    const base = root.getBoundingClientRect();
    if (!box.width || !box.height) { pill.hidden = true; return; }
    pill.hidden = false;
    const left = Math.max(4, Math.min(box.left - base.left + 8, base.width - pill.offsetWidth - 4));
    const top = Math.max(4, Math.min(box.top - base.top + 8, base.height - pill.offsetHeight - 4));
    pill.style.left = `${left}px`;
    pill.style.top = `${top}px`;
  }

  async function open(path, openOptions = {}) {
    if (destroyed || session) return false;
    if (options.beforeOpen && !options.beforeOpen()) return false;
    const image = describeImage(editor.document, path);
    if (image.error) {
      options.report?.(new Error(image.error));
      return false;
    }
    const opener = doc.activeElement;
    const s = (session = {
      path,
      opener,
      image,
      loaded: null,
      rect: null,
      tool: openOptions.tool === "focus" ? "focus" : "crop",
      aspectId: "free",
      zoom: 1,
      focal: { x: 0.5, y: 0.5 },
      busy: false,
      frame: frameRatio(path),
      scrollLock: null,
    });
    pill.hidden = true;
    const fullscreen = options.fullscreen ?? (win.matchMedia?.("(max-width: 900px)").matches || root.clientHeight < 460);
    const layer = h(doc, "div", { class: "opf-crop", role: "dialog", "aria-modal": "true", "aria-label": "Crop picture", "data-tool": s.tool, "data-opf-component": "image-cropper" });
    if (fullscreen) {
      layer.setAttribute("data-fullscreen", "");
      s.scrollLock = doc.documentElement.style.overflow;
      doc.documentElement.style.overflow = "hidden";
    }
    const stage = h(doc, "div", { class: "opf-crop-stage" });
    const box = h(doc, "div", { class: "opf-crop-box" });
    const img = h(doc, "img", { alt: "", draggable: "false", src: image.assetSrc });
    const rectEl = h(doc, "div", { class: "opf-crop-rect", tabindex: "0", role: "group", "aria-label": "Crop area" });
    for (const handle of HANDLES) rectEl.append(h(doc, "span", { class: "opf-crop-handle", "data-handle": handle, "aria-hidden": "true" }));
    const focusEl = h(doc, "span", { class: "opf-crop-focus", "aria-hidden": "true", hidden: true });
    box.append(img, rectEl, focusEl);
    stage.append(box);

    const toolCrop = h(doc, "button", { type: "button", "aria-pressed": "true", text: "Crop" });
    const toolFocus = h(doc, "button", { type: "button", "aria-pressed": "false", text: "Focal point" });
    const tools = h(doc, "div", { class: "opf-crop-row", role: "group", "aria-label": "Tool" }, toolCrop, toolFocus);
    const aspectSelect = h(doc, "select", { "aria-label": "Aspect ratio" });
    for (const aspect of CROP_ASPECTS) aspectSelect.append(h(doc, "option", { value: aspect.id, text: aspect.id === "frame" ? "Frame shape" : aspect.label }));
    const aspectLabel = h(doc, "label", {}, "Aspect", aspectSelect);
    const zoomInput = h(doc, "input", { type: "range", min: "100", max: "400", step: "5", value: "100", "aria-label": "Zoom" });
    const zoomLabel = h(doc, "label", { hidden: true }, "Zoom", zoomInput);
    const optionsRow = h(doc, "div", { class: "opf-crop-row" }, tools, aspectLabel, zoomLabel);

    const numbers = {};
    const exact = h(doc, "details", { class: "opf-crop-exact" }, h(doc, "summary", { text: "Exact crop (pixels)" }));
    const exactRow = h(doc, "div", { class: "opf-crop-row" });
    for (const [key, label] of [["x", "Left"], ["y", "Top"], ["width", "Width"], ["height", "Height"]]) {
      numbers[key] = h(doc, "input", { type: "number", min: "0", step: "1", inputmode: "numeric", "aria-label": label });
      exactRow.append(h(doc, "label", {}, label, numbers[key]));
    }
    exact.append(exactRow);
    if (!fullscreen) exact.setAttribute("open", "");
    const readout = h(doc, "p", { class: "opf-crop-readout", "aria-hidden": "true" });
    const announce = h(doc, "p", { class: "opf-crop-sr", role: "status", "aria-live": "polite" });
    const errorLine = h(doc, "p", { class: "opf-crop-error", role: "alert" });
    const resetButton = h(doc, "button", { type: "button", text: "Reset" });
    const restoreButton = h(doc, "button", { type: "button", text: "Restore original", hidden: true });
    const cancelButton = h(doc, "button", { type: "button", text: "Cancel" });
    const applyButton = h(doc, "button", { type: "button", class: "opf-crop-apply", text: "Apply crop", "aria-keyshortcuts": "Enter" });
    const actions = h(doc, "div", { class: "opf-crop-actions" }, resetButton, restoreButton, cancelButton, applyButton);
    const bar = h(doc, "div", { class: "opf-crop-bar" }, optionsRow, exact, readout, announce, errorLine, h(doc, "div", { class: "opf-crop-row" }, actions));
    layer.append(stage, bar);
    // Full screen: a layer inside the canvas could not rise above the host page's own fixed bars, so it goes on the body.
    (fullscreen ? doc.body : root).append(layer);
    s.layer = layer;
    s.box = box;
    s.rectEl = rectEl;

    const close = (result) => {
      if (session !== s) return;
      session = null;
      resizeObserver.disconnect();
      layer.remove();
      if (s.scrollLock !== null) doc.documentElement.style.overflow = s.scrollLock;
      placePill();
      (s.opener && doc.contains(s.opener) && !s.opener.hidden ? s.opener : pill)?.focus?.({ preventScroll: true });
      if (result === "cancel") options.onCancel?.();
    };
    s.close = close;
    s.cancel = () => cancelButton.click();
    // A key pressed in the layer belongs to it: the page's undo, find and other shortcuts must not run underneath.
    layer.addEventListener("keydown", (event) => { if (event.ctrlKey || event.metaKey) event.stopPropagation(); });

    // ---- drawing
    const bounds = () => ({ width: s.loaded.width, height: s.loaded.height });
    const ratio = () => (s.tool === "focus" ? (s.frame ?? aspectRatioFor("original", bounds())) : aspectRatioFor(s.aspectId, { ...bounds(), frame: s.frame }));
    function layout() {
      if (!s.loaded) return;
      const space = stage.getBoundingClientRect();
      const scale = Math.min((space.width - 24) / s.loaded.width, (space.height - 24) / s.loaded.height);
      const factor = Math.max(0.01, scale);
      box.style.width = `${s.loaded.width * factor}px`;
      box.style.height = `${s.loaded.height * factor}px`;
    }
    function draw({ announceNow = false } = {}) {
      const b = bounds();
      const r = s.rect;
      Object.assign(rectEl.style, { left: `${(r.x / b.width) * 100}%`, top: `${(r.y / b.height) * 100}%`, width: `${(r.width / b.width) * 100}%`, height: `${(r.height / b.height) * 100}%` });
      const rounded = roundRect(r, b);
      for (const key of Object.keys(numbers)) if (doc.activeElement !== numbers[key]) numbers[key].value = String(rounded[key]);
      for (const key of ["x", "width"]) numbers[key].max = String(b.width);
      for (const key of ["y", "height"]) numbers[key].max = String(b.height);
      const share = Math.round(((rounded.width * rounded.height) / (b.width * b.height)) * 100);
      const text = `${dimensions(rounded)} px of ${b.width} × ${b.height} (${share}% of the picture)`;
      readout.textContent = text;
      rectEl.setAttribute("aria-label", `Crop area, ${text}, from ${rounded.x}, ${rounded.y}. Arrow keys move it, Shift with arrow keys resizes it, plus and minus scale it.`);
      if (s.tool === "focus") {
        focusEl.hidden = false;
        focusEl.style.left = `${s.focal.x * 100}%`;
        focusEl.style.top = `${s.focal.y * 100}%`;
      } else focusEl.hidden = true;
      applyButton.disabled = s.busy;
      if (announceNow) announce.textContent = text;
    }
    function setError(message) {
      errorLine.textContent = message ?? "";
    }
    function setTool(tool) {
      if (s.tool === tool) return;
      s.tool = tool;
      layer.dataset.tool = tool;
      toolCrop.setAttribute("aria-pressed", String(tool === "crop"));
      toolFocus.setAttribute("aria-pressed", String(tool === "focus"));
      aspectLabel.hidden = tool === "focus";
      zoomLabel.hidden = tool !== "focus";
      exact.hidden = tool === "focus";
      if (tool === "focus") {
        const a = ratio();
        const whole = fitAspect(fullRect(s.loaded.width, s.loaded.height), a);
        s.focal = focalPointOf(s.rect, bounds());
        s.zoom = Math.max(1, Math.min(4, whole.width / Math.max(1, s.rect.width)));
        zoomInput.value = String(Math.round(s.zoom * 100));
        s.rect = focalWindow(bounds(), a, s.focal, s.zoom);
      } else {
        s.aspectId = s.frame ? "frame" : "free";
        aspectSelect.value = s.aspectId;
      }
      setError("");
      draw({ announceNow: true });
    }
    function setAspect(id) {
      s.aspectId = id;
      const a = ratio();
      s.rect = a ? clampRect(fitAspect(s.rect, a), bounds()) : s.rect;
      draw({ announceNow: true });
    }
    function reset() {
      s.rect = fullRect(s.loaded.width, s.loaded.height);
      s.focal = { x: 0.5, y: 0.5 };
      s.zoom = 1;
      zoomInput.value = "100";
      if (s.tool === "focus") s.rect = focalWindow(bounds(), ratio(), s.focal, 1);
      else {
        s.aspectId = "free";
        aspectSelect.value = "free";
      }
      setError("");
      draw({ announceNow: true });
    }

    // ---- pointer: move, resize, focal point
    const toSource = (event) => {
      const rect = box.getBoundingClientRect();
      return { x: ((event.clientX - rect.left) / rect.width) * s.loaded.width, y: ((event.clientY - rect.top) / rect.height) * s.loaded.height, scale: s.loaded.width / rect.width };
    };
    let drag = null;
    box.addEventListener("pointerdown", (event) => {
      if (s.busy || (event.pointerType === "mouse" && event.button !== 0)) return;
      const handle = event.target.closest?.("[data-handle]")?.getAttribute("data-handle");
      const point = toSource(event);
      if (s.tool === "focus") {
        drag = { id: event.pointerId, mode: "focus" };
        s.focal = { x: Math.max(0, Math.min(1, point.x / s.loaded.width)), y: Math.max(0, Math.min(1, point.y / s.loaded.height)) };
        s.rect = focalWindow(bounds(), ratio(), s.focal, s.zoom);
      } else if (handle) drag = { id: event.pointerId, mode: "resize", handle, start: { ...s.rect }, aspect: ratio() };
      else if (event.target === rectEl || rectEl.contains(event.target)) drag = { id: event.pointerId, mode: "move", start: { ...s.rect }, from: point };
      else return;
      event.preventDefault();
      rectEl.focus({ preventScroll: true });
      // A touch pointer is captured by its target already; capturing it again made Chromium drop the next tap's click.
      if (event.pointerType !== "touch") box.setPointerCapture?.(event.pointerId);
      draw();
    });
    box.addEventListener("pointermove", (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      const point = toSource(event);
      if (drag.mode === "focus") {
        s.focal = { x: Math.max(0, Math.min(1, point.x / s.loaded.width)), y: Math.max(0, Math.min(1, point.y / s.loaded.height)) };
        s.rect = focalWindow(bounds(), ratio(), s.focal, s.zoom);
      } else if (drag.mode === "move") s.rect = moveRect(drag.start, point.x - drag.from.x, point.y - drag.from.y, bounds());
      else {
        // Shift keeps the current shape when the aspect is free.
        const aspect = drag.aspect ?? (event.shiftKey ? drag.start.width / drag.start.height : undefined);
        s.rect = resizeRect(drag.start, drag.handle, point, bounds(), { aspect });
      }
      draw();
    });
    const endDrag = (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      drag = null;
      if (event.pointerType !== "touch") box.releasePointerCapture?.(event.pointerId);
      draw({ announceNow: true });
    };
    box.addEventListener("pointerup", endDrag);
    box.addEventListener("pointercancel", endDrag);

    // ---- keyboard
    const step = () => Math.max(1, Math.round(Math.max(s.loaded.width, s.loaded.height) * 0.01));
    rectEl.addEventListener("keydown", (event) => {
      const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
      if (arrows) {
        event.preventDefault();
        const amount = step() * (event.altKey ? 0.2 : 1);
        if (s.tool === "focus") {
          const move = (event.shiftKey ? 5 : 1) / 100;
          s.focal = { x: Math.max(0, Math.min(1, s.focal.x + arrows[0] * move)), y: Math.max(0, Math.min(1, s.focal.y + arrows[1] * move)) };
          s.rect = focalWindow(bounds(), ratio(), s.focal, s.zoom);
        } else if (event.shiftKey) {
          const a = ratio();
          const corner = { x: s.rect.x + s.rect.width, y: s.rect.y + s.rect.height };
          let point;
          if (a) {
            const grow = arrows[0] + arrows[1] > 0 ? 1 : -1;
            point = { x: corner.x + grow * amount, y: corner.y + (grow * amount) / a };
          } else point = { x: corner.x + arrows[0] * amount, y: corner.y + arrows[1] * amount };
          s.rect = resizeRect(s.rect, "se", point, bounds(), { aspect: a });
        } else s.rect = moveRect(s.rect, arrows[0] * amount, arrows[1] * amount, bounds());
        draw({ announceNow: true });
      } else if (event.key === "+" || event.key === "=" || event.key === "-" || event.key === "_") {
        event.preventDefault();
        const grow = event.key === "+" || event.key === "=";
        if (s.tool === "focus") setZoom(s.zoom + (grow ? 0.1 : -0.1));
        else {
          const factor = grow ? 0.95 : 1 / 0.95;
          const a = ratio();
          const next = { width: s.rect.width * factor, height: s.rect.height * factor };
          const center = { x: s.rect.x + s.rect.width / 2, y: s.rect.y + s.rect.height / 2 };
          const fitted = a ? fitAspect({ x: center.x - next.width / 2, y: center.y - next.height / 2, ...next }, a) : { x: center.x - next.width / 2, y: center.y - next.height / 2, ...next };
          s.rect = clampRect(fitted, bounds());
          draw({ announceNow: true });
        }
      }
    });
    layer.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        cancelButton.click();
      } else if (event.key === "Enter" && !/^(BUTTON|SELECT|SUMMARY)$/.test(event.target.tagName)) {
        event.preventDefault();
        applyButton.click();
      } else if (event.key === "Tab") {
        // The layer is modal: Tab stays inside it.
        const focusable = [...layer.querySelectorAll("button:not([disabled]):not([hidden]),select,input,summary,[tabindex='0']")].filter((node) => node.offsetParent !== null || node === rectEl);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable.at(-1);
        if (event.shiftKey && doc.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && doc.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
    function setZoom(value) {
      s.zoom = Math.max(1, Math.min(4, Math.round(value * 100) / 100));
      zoomInput.value = String(Math.round(s.zoom * 100));
      s.rect = focalWindow(bounds(), ratio(), s.focal, s.zoom);
      draw({ announceNow: true });
    }

    toolCrop.addEventListener("click", () => setTool("crop"));
    toolFocus.addEventListener("click", () => setTool("focus"));
    aspectSelect.addEventListener("change", () => setAspect(aspectSelect.value));
    zoomInput.addEventListener("input", () => setZoom(Number(zoomInput.value) / 100));
    for (const key of Object.keys(numbers)) {
      numbers[key].addEventListener("change", () => {
        const value = Number(numbers[key].value);
        if (!Number.isFinite(value)) return;
        const a = ratio();
        let next = { ...roundRect(s.rect, bounds()), [key]: value };
        if (a && key === "width") next.height = next.width / a;
        else if (a && key === "height") next.width = next.height * a;
        s.rect = clampRect(next, bounds());
        if (a) s.rect = fitAspect(clampRect(next, bounds()), a);
        draw({ announceNow: true });
      });
    }
    resetButton.addEventListener("click", reset);
    cancelButton.addEventListener("click", () => close("cancel"));
    restoreButton.addEventListener("click", () => {
      try {
        const done = restoreOriginal(editor, path);
        if (!done) return;
        close("done");
        options.onCommit?.({ path, restored: true });
      } catch (error) {
        setError(error.message);
      }
    });
    applyButton.addEventListener("click", async () => {
      if (s.busy || !s.loaded) return;
      setError("");
      if (isFullRect(roundRect(s.rect, bounds()), bounds()) && s.tool === "crop") {
        setError("The whole picture is selected. Drag a handle to choose what to keep.");
        return;
      }
      s.busy = true;
      applyButton.disabled = true;
      applyButton.textContent = "Applying…";
      try {
        const changed = await applyCrop(editor, path, s.rect, { loaded: s.loaded, meta: { tool: s.tool } });
        if (session !== s) return;
        close("done");
        options.onCommit?.({ path, assetId: changed.assetId });
      } catch (error) {
        if (session !== s) return;
        s.busy = false;
        applyButton.textContent = "Apply crop";
        applyButton.disabled = false;
        setError(error.message);
      }
    });

    // ---- load the picture
    const resizeObserver = new win.ResizeObserver(() => layout());
    resizeObserver.observe(stage);
    announce.textContent = "Loading the picture…";
    readout.textContent = "Loading the picture…";
    const controls = [toolCrop, toolFocus, aspectSelect, zoomInput, resetButton, applyButton, ...Object.values(numbers)];
    for (const control of controls) control.disabled = true;
    layer.setAttribute("aria-busy", "true");
    try {
      s.loaded = await loadImagePixels(image.assetSrc, { document: doc });
    } catch (error) {
      if (session !== s) return false;
      close("error");
      options.report?.(error);
      return false;
    }
    if (session !== s) return false;
    for (const control of controls) control.disabled = false;
    layer.removeAttribute("aria-busy");
    const frame = s.frame;
    aspectSelect.querySelector('option[value="frame"]').disabled = !frame;
    s.rect = fullRect(s.loaded.width, s.loaded.height);
    layout();
    restoreButton.hidden = !prepareRestore(editor.document, path);
    if (s.tool === "focus") {
      s.tool = "crop";
      setTool("focus");
    }
    draw({ announceNow: true });
    rectEl.focus({ preventScroll: true });
    return true;
  }

  pill.addEventListener("click", () => { if (selected) open(selected); });
  const resize = new win.ResizeObserver(() => placePill());
  resize.observe(root);

  return {
    /** Open the crop layer for the picture at `path` (`{ tool: "focus" }` starts with the focal point tool). Resolves to whether it opened. */
    open,
    get isOpen() { return !!session; },
    get path() { return session?.path ?? null; },
    /** Leave the crop layer without changing anything. */
    cancel() { session?.cancel?.(); },
    /** The canvas selected `path`: show the Crop picture button when it is a picture. */
    sync(path) { selected = path ?? null; placePill(); },
    /** The canvas redrew: put the button back on its picture. */
    update() { placePill(); },
    get pill() { return pill; },
    destroy() {
      destroyed = true;
      session?.close?.("cancel");
      resize.disconnect();
      pill.remove();
    },
  };
}
