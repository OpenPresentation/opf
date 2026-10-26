import assert from "node:assert/strict";
import { ZOOM_STEPS, clampZoom, createViewport, scrollForZoom, stepZoom, toUnit } from "../dist/studio-kit/viewport.js";

// CE-18, the studio kit's viewport, against the kit API only: the zoom steps, stepping and clamping, the screen-to-unit mapping, the scroll
// that keeps the point under the pointer still, and the viewport on a minimal element (wheel, hand and Space pan, two-finger pinch, fit).
// test/studio-kit-browser.mjs drives the same viewport with real pointer and wheel events.
assert.deepEqual(ZOOM_STEPS, [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4], "the Studio's steps (STUDIO-SPEC 4.2)");
assert.equal(clampZoom(10), 4);
assert.equal(clampZoom(0.1), 0.25);
assert.equal(stepZoom(1, 1), 1.5);
assert.equal(stepZoom(1, -1), 0.75);
assert.equal(stepZoom(1.2, 1), 1.5, "between two steps, up goes to the next one");
assert.equal(stepZoom(1.2, -1), 1, "and down to the previous one");
assert.equal(stepZoom(4, 1), 4);
assert.equal(stepZoom(0.25, -1), 0.25);
const layoutSteps = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
assert.equal(stepZoom(1, 1, layoutSteps), 1.25, "a studio passes its own steps");
assert.deepEqual(toUnit({ clientX: 150, clientY: 75 }, { left: 100, top: 50, width: 200, height: 100 }), { x: 0.25, y: 0.25 });
assert.deepEqual(toUnit({ clientX: 5, clientY: 5 }, { left: 0, top: 0, width: 0, height: 0 }), { x: 5, y: 5 }, "a zero box divides by one");
// At zoom 1 the point 300px into the content is under an anchor 100px into the viewport (scrolled 200px); at zoom 2 it is 600px in.
assert.deepEqual(scrollForZoom({ left: 200, top: 0 }, { x: 100, y: 0 }, 1, 2), { left: 500, top: 0 });

// A minimal element: listeners, a style, a dataset, a box and scroll offsets.
function fakeElement() {
  const listeners = {};
  return {
    listeners, scrollLeft: 0, scrollTop: 0, dataset: {}, captured: [],
    style: { props: {}, setProperty(name, value) { this.props[name] = value; } },
    addEventListener(type, fn) { (listeners[type] ??= []).push(fn); },
    removeEventListener(type, fn) { listeners[type] = (listeners[type] ?? []).filter((entry) => entry !== fn); },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 450 }),
    setPointerCapture(id) { this.captured.push(id); },
    fire(type, event) { for (const fn of listeners[type] ?? []) fn({ preventDefault() { this.prevented = true; }, stopPropagation() {}, ...event }); },
  };
}
const viewport = fakeElement(), root = fakeElement();
let hand = false;
const zooms = [];
const kit = createViewport(viewport, { root, zoomVar: "--test-zoom", panEnabled: () => hand, pinch: true, fitZoom: (mode) => (mode === "width" ? 1.25 : 1), onZoom: (zoom) => zooms.push(zoom) });
assert.equal(kit.zoom, 1);
assert.equal(root.style.props["--test-zoom"], "1");
assert.equal(root.dataset.zoomed, "false");

// Ctrl or Cmd with the wheel steps; a plain wheel scrolls (the viewport leaves it alone).
viewport.fire("wheel", { ctrlKey: true, deltaY: -10 });
assert.equal(kit.zoom, 1.5);
viewport.fire("wheel", { metaKey: true, deltaY: 10 });
assert.equal(kit.zoom, 1);
viewport.fire("wheel", { deltaY: 10 });
assert.equal(kit.zoom, 1);
assert.equal(root.dataset.zoomed, "false");
kit.step(1);
assert.equal(root.dataset.zoomed, "true");
assert.equal(kit.fit("width"), 1.25);
assert.equal(kit.fit(), 1);

// Pan: only with the hand tool or Space; the drag moves the scroll position the other way.
viewport.fire("pointerdown", { pointerType: "mouse", button: 0, clientX: 100, clientY: 100, pointerId: 1 });
assert.equal(kit.panning, false, "the select tool does not pan");
hand = true;
assert.equal(kit.panMode, true);
viewport.fire("pointerdown", { pointerType: "mouse", button: 0, clientX: 100, clientY: 100, pointerId: 1 });
assert.equal(root.dataset.panning, "true");
viewport.fire("pointermove", { clientX: 60, clientY: 80, pointerId: 1 });
assert.deepEqual([viewport.scrollLeft, viewport.scrollTop], [40, 20]);
viewport.fire("pointerup", { pointerId: 1 });
assert.equal(root.dataset.panning, undefined);
hand = false;
kit.holdSpace(true);
assert.equal(root.dataset.space, "true");
assert.equal(kit.panMode, true, "a held Space pans");
viewport.fire("pointerdown", { pointerType: "mouse", button: 2, clientX: 0, clientY: 0, pointerId: 2 });
assert.equal(kit.panning, false, "not with the right button");
kit.holdSpace(false);
assert.equal(root.dataset.space, undefined);

// Two fingers: the zoom scales with their distance, around their midpoint.
viewport.scrollLeft = 0;
viewport.scrollTop = 0;
kit.setZoom(1);
viewport.fire("pointerdown", { pointerType: "touch", clientX: 300, clientY: 200, pointerId: 11 });
viewport.fire("pointerdown", { pointerType: "touch", clientX: 500, clientY: 200, pointerId: 12 });
assert.equal(kit.panning, true);
viewport.fire("pointermove", { pointerType: "touch", clientX: 200, clientY: 200, pointerId: 11 });
viewport.fire("pointermove", { pointerType: "touch", clientX: 600, clientY: 200, pointerId: 12 });
assert.equal(kit.zoom, 2, "fingers twice as far apart zoom in twice");
assert.equal(viewport.scrollLeft, 400, "the midpoint (400px) stays under the fingers");
viewport.fire("pointerup", { pointerId: 11 });
viewport.fire("pointerup", { pointerId: 12 });
assert.equal(kit.panning, false);

// Smooth wheel zoom (a trackpad pinch) when asked for.
const smooth = createViewport(fakeElement(), { wheel: "smooth" });
smooth.setZoom(1);
const element = fakeElement();
const smoothKit = createViewport(element, { wheel: "smooth" });
element.fire("wheel", { ctrlKey: true, deltaY: -10, clientX: 0, clientY: 0 });
assert.ok(smoothKit.zoom > 1 && smoothKit.zoom < 1.5, `a small pinch zooms a little (${smoothKit.zoom})`);
smoothKit.destroy();
assert.equal(element.listeners.wheel.length, 0, "destroy removes the listeners");
assert.ok(zooms.length > 4, "onZoom runs on each change");

console.log("studio kit viewport: steps, clamp, unit mapping, anchored zoom, wheel, hand and Space pan, pinch, fit and destroy passed");
