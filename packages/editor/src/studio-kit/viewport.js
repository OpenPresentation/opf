// CE-18, the studio kit: the viewport around a studio's frame. Zoom in steps (buttons, keys, Ctrl or Cmd with the wheel), smooth zoom (a
// trackpad pinch, two-finger touch), fit, and pan (the hand tool, a held Space, two fingers), plus the mapping from screen points to the
// frame's unit square. The zoom is a factor of the fitted size, written to a CSS variable on the root; the stylesheet sizes the stage from it.

/** The zoom steps of the Studio (STUDIO-SPEC 4.2), as factors of the fitted size. */
export const ZOOM_STEPS = Object.freeze([0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4]);

/** `value` kept between the first and the last step. */
export const clampZoom = (value, steps = ZOOM_STEPS) => Math.max(steps[0], Math.min(steps[steps.length - 1], value));

/** The next step up (`direction` 1) or down (-1) from `zoom`; a zoom between two steps goes to the nearer one in that direction. */
export function stepZoom(zoom, direction, steps = ZOOM_STEPS) {
  const at = steps.findIndex((value) => value >= zoom - 1e-9);
  const index = direction > 0 ? (steps[at] > zoom + 1e-9 ? at : at + 1) : at - 1;
  return steps[Math.max(0, Math.min(steps.length - 1, index))];
}

/** A client point as a fraction of `rect` (a DOMRect): `{ x, y }`, 0 to 1 inside it. */
export const toUnit = (point, rect) => ({ x: (point.clientX - rect.left) / (rect.width || 1), y: (point.clientY - rect.top) / (rect.height || 1) });

/**
 * The scroll position that keeps the content point under `anchor` (client coordinates, relative to the viewport's box) in place when the
 * zoom changes from `from` to `to`: `{ left, top }`.
 */
export function scrollForZoom({ left, top }, anchor, from, to) {
  const ratio = to / (from || 1);
  return { left: (left + anchor.x) * ratio - anchor.x, top: (top + anchor.y) * ratio - anchor.y };
}

/**
 * Attach zoom and pan to `viewport` (the scrolling element). Options:
 * - `root`: where the zoom variable and the `data-zoomed`, `data-panning` and `data-space` states go (default the viewport);
 * - `zoomVar`: the CSS variable (default `--opf-kit-zoom`); `steps` (default `ZOOM_STEPS`); `zoom` (the first zoom, default 1);
 * - `panEnabled()`: whether a drag pans now (the hand tool); a held Space pans as well (`holdSpace`);
 * - `wheel`: "step" (Ctrl or Cmd with the wheel steps the zoom, the default), "smooth" (it zooms continuously around the pointer) or false;
 * - `pinch`: two touch pointers zoom around their midpoint and pan (default false);
 * - `fitZoom(mode)`: the zoom of `fit(mode)` ("slide" or "width"), default 1 (the zoom is a factor of the fitted size);
 * - `onZoom(zoom)`: after each change.
 * Returns `{ zoom, panMode, setZoom, step, fit, holdSpace, toUnit, destroy }`.
 */
export function createViewport(viewport, options = {}) {
  const root = options.root ?? viewport;
  const steps = options.steps ?? ZOOM_STEPS;
  const zoomVar = options.zoomVar ?? "--opf-kit-zoom";
  const wheelMode = options.wheel === undefined ? "step" : options.wheel;
  let zoom = 1;
  let spaceHeld = false;
  let pan = null;
  const touches = new Map();
  let pinch = null;
  const panMode = () => Boolean(options.panEnabled?.()) || spaceHeld;

  function setZoom(value, { anchor } = {}) {
    const next = clampZoom(value, steps);
    const before = zoom;
    zoom = next;
    root.style.setProperty(zoomVar, String(zoom));
    root.dataset.zoomed = String(zoom !== 1);
    if (anchor && before !== next) {
      const box = viewport.getBoundingClientRect();
      const scroll = scrollForZoom({ left: viewport.scrollLeft, top: viewport.scrollTop }, { x: anchor.clientX - box.left, y: anchor.clientY - box.top }, before, next);
      viewport.scrollLeft = scroll.left;
      viewport.scrollTop = scroll.top;
    }
    options.onZoom?.(zoom);
    return zoom;
  }
  const step = (direction, opts) => setZoom(stepZoom(zoom, direction, steps), opts);
  const fit = (mode = "slide") => setZoom(options.fitZoom ? options.fitZoom(mode) : 1);

  // Pan: a drag with the hand tool or Space; the capture phase keeps the drag from reaching the frame below.
  const onDown = (event) => {
    if (options.pinch && event.pointerType === "touch") {
      touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (touches.size === 2) { startPinch(); event.preventDefault(); event.stopPropagation(); return; }
    }
    if (!panMode() || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.preventDefault();
    event.stopPropagation();
    pan = { x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop };
    root.dataset.panning = "true";
    viewport.setPointerCapture?.(event.pointerId);
  };
  const onMove = (event) => {
    if (touches.has(event.pointerId)) {
      touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pinch) { movePinch(); return; }
    }
    if (!pan) return;
    viewport.scrollLeft = pan.left - (event.clientX - pan.x);
    viewport.scrollTop = pan.top - (event.clientY - pan.y);
  };
  const endPan = (event) => {
    if (event && touches.delete(event.pointerId) && pinch && touches.size < 2) { pinch = null; delete root.dataset.panning; }
    pan = null;
    delete root.dataset.panning;
  };

  // Two fingers: the distance between them scales the zoom from where it was, and the content point first under their midpoint stays
  // under it (so moving both fingers pans).
  const pair = () => { const [a, b] = [...touches.values()]; return { distance: Math.hypot(b.x - a.x, b.y - a.y) || 1, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } }; };
  function startPinch() {
    pan = null;
    const { distance, mid } = pair();
    const box = viewport.getBoundingClientRect();
    pinch = { distance, zoom, point: { x: (viewport.scrollLeft + mid.x - box.left) / zoom, y: (viewport.scrollTop + mid.y - box.top) / zoom } };
    root.dataset.panning = "true";
  }
  function movePinch() {
    const { distance, mid } = pair();
    const next = setZoom(pinch.zoom * (distance / pinch.distance));
    const box = viewport.getBoundingClientRect();
    viewport.scrollLeft = pinch.point.x * next - (mid.x - box.left);
    viewport.scrollTop = pinch.point.y * next - (mid.y - box.top);
  }

  const onWheel = (event) => {
    if (!wheelMode || !(event.ctrlKey || event.metaKey)) return;
    event.preventDefault();
    if (wheelMode === "smooth") setZoom(zoom * Math.exp(-event.deltaY * 0.01), { anchor: event });
    else step(event.deltaY < 0 ? 1 : -1);
  };

  viewport.addEventListener("pointerdown", onDown, true);
  viewport.addEventListener("pointermove", onMove);
  viewport.addEventListener("pointerup", endPan);
  viewport.addEventListener("pointercancel", endPan);
  viewport.addEventListener("wheel", onWheel, { passive: false });
  setZoom(options.zoom ?? 1);

  return {
    get zoom() { return zoom; },
    get panMode() { return panMode(); },
    get panning() { return pan !== null || pinch !== null; },
    setZoom,
    step,
    fit,
    /** Space held (true) or released (false): a drag pans while it is held. */
    holdSpace(on) {
      spaceHeld = Boolean(on);
      if (spaceHeld) root.dataset.space = "true"; else delete root.dataset.space;
    },
    /** A pointer event's position as a fraction of `element`'s box. */
    toUnit: (event, element) => toUnit(event, element.getBoundingClientRect()),
    destroy() {
      viewport.removeEventListener("pointerdown", onDown, true);
      viewport.removeEventListener("pointermove", onMove);
      viewport.removeEventListener("pointerup", endPan);
      viewport.removeEventListener("pointercancel", endPan);
      viewport.removeEventListener("wheel", onWheel);
    },
  };
}
