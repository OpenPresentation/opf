// FF-41, RR-55: the font gate over the renderer's fonts handle. A document renders only after the faces it needs are loaded
// (the handle's `pending` and `ensure`); a failure is reported once and never retried by itself; a superseded document's late
// result is dropped.
import assert from "node:assert/strict";
import { FONTS_PENDING, FONTS_UNAVAILABLE, fontGate, fontsPendingError, whenFontsReady } from "../dist/font-gate.js";
import * as canvas from "../dist/canvas.js";

assert.equal(canvas.whenFontsReady, whenFontsReady, "the canvas entry re-exports whenFontsReady");
assert.equal(canvas.FONTS_PENDING, FONTS_PENDING);
assert.equal(canvas.FONTS_UNAVAILABLE, FONTS_UNAVAILABLE);
assert.equal(canvas.createFontGate, undefined, "the gate is the handle's behaviour: there is no separate createFontGate");

// A fake fonts handle: `pendingFiles` is what is still to load; ensure loads it and records its options.
function handle({ pendingFiles = [], fail = false, stuck = false } = {}) {
  const calls = [];
  const left = new Set(pendingFiles);
  return {
    calls,
    textMeasurement: { measure: () => 1 },
    pending: (presentation, renderOptions) => { calls.push(["pending", renderOptions]); return [...left]; },
    async ensure(presentation, options) {
      calls.push(["ensure", options]);
      await Promise.resolve();
      if (fail) { const error = new Error("Could not load font (503)."); error.code = "font-load-failed"; throw error; }
      if (!stuck) left.clear();
      return { scripts: [], lazy: [], uncovered: [] };
    },
  };
}
const deck = { slides: [] };

// pending lists what the handle reports; ensure loads it once and nothing is loaded again.
{
  const fonts = handle({ pendingFiles: ["fonts/intos/Intos-Regular.ttf", "@expo-google-fonts/noto-sans-jp"] });
  const gate = fontGate(fonts);
  assert.deepEqual(gate.pending(deck), ["fonts/intos/Intos-Regular.ttf", "@expo-google-fonts/noto-sans-jp"]);
  await gate.ensure(deck);
  assert.equal(fonts.calls.filter(([name]) => name === "ensure").length, 1);
  assert.deepEqual(gate.pending(deck), []);
  await gate.ensure(deck);
  assert.equal(fonts.calls.filter(([name]) => name === "ensure").length, 1, "nothing is loaded again");
  assert.equal(fontGate(gate), gate, "a gate is handed back unchanged");
}

// A handle with no loaders (a plain { textMeasurement }), no handle at all, or one that throws for a bad document, gates nothing.
assert.equal(fontGate(undefined), undefined);
assert.deepEqual(fontGate({ textMeasurement: { measure: () => 1 } }).pending(deck), []);
await fontGate({ textMeasurement: {} }).ensure(deck);
assert.deepEqual(fontGate({ pending() { throw new Error("not a document"); }, ensure: async () => {} }).pending(deck), []);

// A failure rejects with fonts-unavailable (the handle's error is the cause) and is not retried by the gate.
{
  const fonts = handle({ pendingFiles: ["@expo-google-fonts/noto-sans-jp"], fail: true });
  await assert.rejects(fontGate(fonts).ensure(deck), (error) => error.code === FONTS_UNAVAILABLE && /could not be loaded: Could not load font \(503\)/.test(error.message) && error.cause.code === "font-load-failed");
  assert.equal(fonts.calls.filter(([name]) => name === "ensure").length, 1, "one attempt per ensure call");
}

// FF-41: the render options (catalogs) reach the handle on every call, and the signal reaches ensure.
{
  const catalogs = { layouts: [{ id: "host-layout" }] };
  const fonts = handle({ pendingFiles: ["p"] });
  const gate = fontGate(fonts);
  gate.pending(deck, { catalogs });
  assert.deepEqual(fonts.calls.splice(0), [["pending", { catalogs }]], "pending passes the render options on");
  const controller = new AbortController();
  await gate.ensure(deck, { signal: controller.signal, renderOptions: { catalogs, date: "2026-10-06" } });
  const ensured = fonts.calls.find(([name]) => name === "ensure");
  assert.equal(ensured[1].catalogs, catalogs, "ensure passes the render options to the handle");
  assert.equal(ensured[1].date, "2026-10-06");
  assert.equal(ensured[1].signal, controller.signal, "and the signal");
  // whenFontsReady hands its renderOptions to the gate.
  const seen = [];
  whenFontsReady({ pending: (presentation, options) => { seen.push(options); return []; }, ensure: async () => {} }, deck, { renderOptions: { catalogs }, ready: () => {} });
  assert.deepEqual(seen, [{ catalogs }]);
}

// A load that does not finish is reported, not looped on: the handle's ensure resolved but faces are still pending.
await assert.rejects(fontGate(handle({ pendingFiles: ["@expo-google-fonts/noto-sans-jp"], stuck: true })).ensure(deck), (error) => error.code === FONTS_UNAVAILABLE && /did not finish loading/.test(error.message));

// An aborted call rejects with the abort reason, not fonts-unavailable.
{
  const controller = new AbortController();
  controller.abort(new DOMException("stop", "AbortError"));
  await assert.rejects(fontGate(handle({ pendingFiles: ["x"] })).ensure(deck, { signal: controller.signal }), (error) => error.name === "AbortError");
}

// whenFontsReady takes the handle itself: synchronous when nothing is pending; loading, then ready, when something is.
{
  const order = [];
  const result = whenFontsReady(handle(), deck, { loading: () => order.push("loading"), ready: () => order.push("ready") });
  assert.deepEqual(order, ["ready"], "nothing pending: ready ran synchronously");
  await result;
  order.length = 0;
  const waiting = whenFontsReady(handle({ pendingFiles: ["a"] }), deck, { loading: (pending) => order.push(`loading:${pending}`), ready: () => order.push("ready") });
  assert.deepEqual(order, ["loading:a"], "ready has not run before the faces load");
  await waiting;
  assert.deepEqual(order, ["loading:a", "ready"]);
  // No handle at all means ready.
  order.length = 0;
  await whenFontsReady(undefined, deck, { ready: () => order.push("ready") });
  assert.deepEqual(order, ["ready"]);
}

// A superseded document's late result is dropped: neither ready nor failed runs.
{
  const order = [];
  let current = true;
  const waiting = whenFontsReady(handle({ pendingFiles: ["a"] }), deck, { isCurrent: () => current, ready: () => order.push("ready"), failed: () => order.push("failed") });
  current = false;
  await waiting;
  assert.deepEqual(order, []);
  const late = whenFontsReady(handle({ pendingFiles: ["a"], fail: true }), deck, { isCurrent: () => false, ready: () => order.push("ready"), failed: () => order.push("failed") });
  await late;
  assert.deepEqual(order, []);
}

// Failures go to failed; an exception from ready goes to failed too (sync and async); without failed they are rethrown.
{
  const errors = [];
  await whenFontsReady(handle({ pendingFiles: ["a"], fail: true }), deck, { ready: () => errors.push("ready"), failed: (error) => errors.push(error.code) });
  assert.deepEqual(errors, [FONTS_UNAVAILABLE]);
  errors.length = 0;
  whenFontsReady(handle(), deck, { ready: () => { throw new Error("render failed"); }, failed: (error) => errors.push(error.message) });
  assert.deepEqual(errors, ["render failed"], "a synchronous ready that throws is reported through failed");
  await whenFontsReady(handle({ pendingFiles: ["a"] }), deck, { ready: () => { throw new Error("late render failed"); }, failed: (error) => errors.push(error.message) });
  assert.deepEqual(errors, ["render failed", "late render failed"]);
  assert.throws(() => whenFontsReady(handle(), deck, { ready: () => { throw new Error("no handler"); } }), /no handler/);
  await assert.rejects(whenFontsReady(handle({ pendingFiles: ["a"], fail: true }), deck, {}), (error) => error.code === FONTS_UNAVAILABLE);
}

// The pending error a synchronous render raises is recognisable.
{
  const error = fontsPendingError(["a"]);
  assert.equal(error.code, FONTS_PENDING);
  assert.deepEqual(error.pending, ["a"]);
}
console.log("Font gate: gates on the fonts handle's pending and ensure, reports one failure without retrying, drops superseded results.");
