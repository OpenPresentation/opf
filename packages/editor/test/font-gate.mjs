// FF-41: the font gate. A document renders only after the faces it needs are loaded; a failure is reported once and never
// retried by itself; a superseded document's late result is dropped.
import assert from "node:assert/strict";
import { FONTS_PENDING, FONTS_UNAVAILABLE, createFontGate, fontsPendingError, whenFontsReady } from "../dist/font-gate.js";
import * as canvas from "../dist/canvas.js";

assert.equal(canvas.createFontGate, createFontGate, "the canvas entry re-exports the gate");
assert.equal(canvas.whenFontsReady, whenFontsReady);

// A fake browser registry: `lazy` and `scripts` are what is still to load; ensure* load them and record the order.
function registry({ lazy = [], scripts = [], failScripts = false, stuck = false } = {}) {
  const calls = [];
  const pendingLazy = new Set(lazy), pendingScripts = new Set(scripts);
  return {
    calls,
    pendingLazyFonts: () => [...pendingLazy].map((file) => ({ file })),
    pendingScripts: () => [...pendingScripts],
    async ensureLazyFonts() { calls.push("lazy"); await Promise.resolve(); if (!stuck) pendingLazy.clear(); },
    async ensureScripts() {
      calls.push("scripts");
      await Promise.resolve();
      if (failScripts) { const error = new Error("Could not load font (503)."); error.code = "font-load-failed"; throw error; }
      if (!stuck) pendingScripts.clear();
    },
  };
}
const deck = { slides: [] };

// pending lists vendored files then script packages; ensure loads vendored first, then scripts.
{
  const fake = registry({ lazy: ["fonts/intos/Intos-Regular.ttf"], scripts: ["@expo-google-fonts/noto-sans-jp"] });
  const gate = createFontGate(fake);
  assert.deepEqual(gate.pending(deck), ["fonts/intos/Intos-Regular.ttf", "@expo-google-fonts/noto-sans-jp"]);
  await gate.ensure(deck);
  assert.deepEqual(fake.calls, ["lazy", "scripts"], "vendored faces load before script faces");
  assert.deepEqual(gate.pending(deck), []);
  await gate.ensure(deck);
  assert.deepEqual(fake.calls, ["lazy", "scripts"], "nothing is loaded again");
}

// A registry without the loaders (renderer 0.10.0 and older), or one that throws for a bad document, gates nothing.
assert.deepEqual(createFontGate({}).pending(deck), []);
await createFontGate({}).ensure(deck);
assert.deepEqual(createFontGate({ pendingScripts() { throw new Error("not a document"); } }).pending(deck), []);

// A failure rejects with fonts-unavailable (the registry's error is the cause) and is not retried by the gate.
{
  const fake = registry({ scripts: ["@expo-google-fonts/noto-sans-jp"], failScripts: true });
  const gate = createFontGate(fake);
  await assert.rejects(gate.ensure(deck), (error) => error.code === FONTS_UNAVAILABLE && /could not be loaded: Could not load font \(503\)/.test(error.message) && error.cause.code === "font-load-failed");
  assert.deepEqual(fake.calls, ["scripts"], "one attempt per ensure call, and only the source with something pending is asked");
}

// FF-41: the render options (catalogs) reach every registry call: the canvas passes its current ones, the gate may hold defaults
// (an object, or a getter for options that change), and a call's own options win.
{
  const seen = [];
  let scriptsDone = false;
  const fake = {
    pendingLazyFonts: (_document, options) => { seen.push(["pendingLazyFonts", options]); return []; },
    pendingScripts: (_document, options) => { seen.push(["pendingScripts", options]); return scriptsDone ? [] : ["p"]; },
    ensureLazyFonts: async (_document, options) => { seen.push(["ensureLazyFonts", options]); },
    ensureScripts: async (_document, options) => { seen.push(["ensureScripts", options]); scriptsDone = true; },
  };
  const catalogs = { layouts: [{ id: "host-layout" }] };
  const gate = createFontGate(fake);
  gate.pending(deck, { catalogs });
  assert.deepEqual(seen.splice(0), [["pendingScripts", { catalogs }], ["pendingLazyFonts", { catalogs }]], "pending passes the render options to both loaders");
  const controller = new AbortController();
  await gate.ensure(deck, { signal: controller.signal, renderOptions: { catalogs } });
  const ensured = seen.find(([name]) => name === "ensureScripts");
  assert.equal(ensured[1].catalogs, catalogs, "ensure passes the render options to the loader");
  assert.equal(ensured[1].signal, controller.signal, "and the signal");
  seen.length = 0;
  let current = { catalogs: { layouts: [{ id: "first" }] }, date: "2026-09-30" };
  scriptsDone = false;
  const withGetter = createFontGate(fake, { renderOptions: () => current });
  withGetter.pending(deck);
  assert.equal(seen[0][1].catalogs.layouts[0].id, "first");
  current = { catalogs: { layouts: [{ id: "second" }] } };
  seen.length = 0;
  withGetter.pending(deck);
  assert.equal(seen[0][1].catalogs.layouts[0].id, "second", "a getter gives the options current at each call");
  seen.length = 0;
  createFontGate(fake, { renderOptions: { date: "2026-09-30", catalogs } }).pending(deck, { catalogs: { layouts: [] } });
  assert.equal(seen[0][1].date, "2026-09-30", "gate defaults stay");
  assert.deepEqual(seen[0][1].catalogs, { layouts: [] }, "the call's own options win");
  // whenFontsReady hands its renderOptions to the gate.
  const gateCalls = [];
  const stub = { pending: (document, options) => { gateCalls.push(["pending", options]); return []; }, ensure: async () => {} };
  whenFontsReady(stub, deck, { renderOptions: { catalogs }, ready: () => {} });
  assert.deepEqual(gateCalls, [["pending", { catalogs }]]);
}

// FF-41: each source answers on its own. A document the lazy font loader cannot resolve (it throws what renderSvg throws) still
// reports its pending script faces, and only the loader with something pending is asked to load.
{
  const calls = [];
  let scriptsPending = ["@expo-google-fonts/noto-sans-jp"];
  const fake = {
    pendingLazyFonts() { throw Object.assign(new Error("Could not resolve layouts reference 'x'."), { code: "catalog-resolution-failed" }); },
    pendingScripts: () => scriptsPending,
    async ensureLazyFonts() { calls.push("lazy"); throw new Error("must not be asked"); },
    async ensureScripts() { calls.push("scripts"); scriptsPending = []; },
  };
  const gate = createFontGate(fake);
  assert.deepEqual(gate.pending(deck), ["@expo-google-fonts/noto-sans-jp"], "a lazy loader that throws does not hide pending scripts");
  await gate.ensure(deck);
  assert.deepEqual(calls, ["scripts"], "the throwing loader is not asked to load");
  const both = createFontGate({ pendingScripts() { throw new Error("no"); }, pendingLazyFonts: () => [{ file: "fonts/intos/Intos-Regular.ttf" }] });
  assert.deepEqual(both.pending(deck), ["fonts/intos/Intos-Regular.ttf"], "and the other way round");
}

// A load that never finishes stops after a few rounds instead of looping.
{
  const fake = registry({ scripts: ["@expo-google-fonts/noto-sans-jp"], stuck: true });
  await assert.rejects(createFontGate(fake).ensure(deck), (error) => error.code === FONTS_UNAVAILABLE && /did not finish loading/.test(error.message));
  assert.ok(fake.calls.length <= 8, `bounded rounds: ${fake.calls.length}`);
}

// An aborted call rejects with the abort reason, not fonts-unavailable.
{
  const controller = new AbortController();
  controller.abort(new DOMException("stop", "AbortError"));
  await assert.rejects(createFontGate(registry({ scripts: ["x"] })).ensure(deck, { signal: controller.signal }), (error) => error.name === "AbortError");
}

// whenFontsReady: synchronous when nothing is pending; loading, then ready, when something is.
{
  const order = [];
  const idle = createFontGate(registry());
  const result = whenFontsReady(idle, deck, { loading: () => order.push("loading"), ready: () => order.push("ready") });
  assert.deepEqual(order, ["ready"], "nothing pending: ready ran synchronously");
  await result;
  order.length = 0;
  const busy = createFontGate(registry({ scripts: ["a"] }));
  const waiting = busy.run(deck, { loading: (pending) => order.push(`loading:${pending}`), ready: () => order.push("ready") });
  assert.deepEqual(order, ["loading:a"], "ready has not run before the faces load");
  await waiting;
  assert.deepEqual(order, ["loading:a", "ready"]);
  // No gate at all means ready.
  order.length = 0;
  await whenFontsReady(undefined, deck, { ready: () => order.push("ready") });
  assert.deepEqual(order, ["ready"]);
}

// A superseded document's late result is dropped: neither ready nor failed runs.
{
  const order = [];
  let current = true;
  const gate = createFontGate(registry({ scripts: ["a"] }));
  const waiting = whenFontsReady(gate, deck, { isCurrent: () => current, ready: () => order.push("ready"), failed: () => order.push("failed") });
  current = false;
  await waiting;
  assert.deepEqual(order, []);
  const failing = createFontGate(registry({ scripts: ["a"], failScripts: true }));
  const late = whenFontsReady(failing, deck, { isCurrent: () => false, ready: () => order.push("ready"), failed: () => order.push("failed") });
  await late;
  assert.deepEqual(order, []);
}

// Failures go to failed; an exception from ready goes to failed too (sync and async); without failed they are rethrown.
{
  const errors = [];
  await whenFontsReady(createFontGate(registry({ scripts: ["a"], failScripts: true })), deck, { ready: () => errors.push("ready"), failed: (error) => errors.push(error.code) });
  assert.deepEqual(errors, [FONTS_UNAVAILABLE]);
  errors.length = 0;
  whenFontsReady(createFontGate(registry()), deck, { ready: () => { throw new Error("render failed"); }, failed: (error) => errors.push(error.message) });
  assert.deepEqual(errors, ["render failed"], "a synchronous ready that throws is reported through failed");
  await whenFontsReady(createFontGate(registry({ scripts: ["a"] })), deck, { ready: () => { throw new Error("late render failed"); }, failed: (error) => errors.push(error.message) });
  assert.deepEqual(errors, ["render failed", "late render failed"]);
  assert.throws(() => whenFontsReady(createFontGate(registry()), deck, { ready: () => { throw new Error("no handler"); } }), /no handler/);
  await assert.rejects(whenFontsReady(createFontGate(registry({ scripts: ["a"], failScripts: true })), deck, {}), (error) => error.code === FONTS_UNAVAILABLE);
}

// The pending error a synchronous render raises is recognisable.
{
  const error = fontsPendingError(["a"]);
  assert.equal(error.code, FONTS_PENDING);
  assert.deepEqual(error.pending, ["a"]);
}
console.log("Font gate: loads vendored then script faces, reports one failure without retrying, bounds its rounds, drops superseded results.");
