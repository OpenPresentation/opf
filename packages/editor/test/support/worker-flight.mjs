// A heartbeat reports excess over its nominal4ms period, without knowing where within the interval that excess occurred.
// Its conservative in-flight contribution cannot exceed either that excess or the union of native-busy time it intersects.
//
// `parses` are the spans of CodeMirror's background parse (see PARSE_IDLE_TIMEOUT below), which are taken out of the busy union first. That parse is
// the code editor's own syntax-tree work, not a check: it runs the same with and without the worker, and it runs in idle time, which is exactly what
// the pane has while it waits for the worker. On Chromium each slice may take up to 100 ms, and it starts 100 ms after a change: when the worker takes
// longer than the apply delay plus that pause (a slow runner), the slice lands in the in-flight window and its whole length counted as "the main thread
// blocks while the worker checks" (CI, 2026-11-14: in flight [54,54,38,...] against 113 ms, and [87,88,82,74] against 172 ms). A check on the main thread
// (in a timer, a message handler, a promise, a frame) is not an idle callback of CodeMirror's parser and still counts in full.
export function workerFlightBlock(beats, spans, newSpans = [], parses = []) {
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  let previousEnd = -Infinity;
  for (const beat of beats) {
    if (!Array.isArray(beat) || beat.length !== 3 || !beat.every(finite) || beat[0] < 0 || beat[1] < beat[0] || beat[0] < previousEnd || beat[2] !== beat[1] - beat[0] - 4) throw new TypeError('Invalid worker-flight heartbeat clock');
    previousEnd = beat[1];
  }
  const union = [];
  for (const span of spans) if (!Array.isArray(span) || span.length !== 2 || !span.every(finite) || span[0] < 0 || span[1] < span[0]) throw new TypeError('Invalid native-busy clock');
  for (const span of parses) if (!Array.isArray(span) || span.length !== 2 || !span.every(finite) || span[0] < 0 || span[1] < span[0]) throw new TypeError('Invalid background-parse clock');
  const sameSpan = (a, b) => a[0] === b[0] && a[1] === b[1];
  for (const span of newSpans) if (!Array.isArray(span) || span.length !== 2 || !span.every(finite) || !spans.some(known => sameSpan(span, known))) throw new TypeError('New request missing from native-busy history');
  // Keep prior windows for a beat crossing collection, but do not count unrelated old requests as current participation.
  // A newly completed request still counts when its first overlapping heartbeat has not completed yet (as the old guard did).
  const relevant = spans.filter(span => newSpans.some(fresh => sameSpan(span, fresh)) || beats.some(([from, to]) => from <= span[1] && to >= span[0]));
  for (const [from, to] of relevant.map(span => [...span]).sort((a, b) => a[0] - b[0])) {
    const last = union.at(-1);
    if (last && from <= last[1]) last[1] = Math.max(last[1], to); else union.push([from, to]);
  }
  if (!union.length) return null;
  // The in-flight time that is not CodeMirror's background parse: the union minus the parse spans.
  let rest = union;
  for (const [cutFrom, cutTo] of parses) rest = rest.flatMap(([start, end]) => [[start, Math.min(end, cutFrom)], [Math.max(start, cutTo), end]].filter(([a, b]) => b > a));
  let flight = 0;
  for (const [from, to, excess] of beats) {
    let overlap = 0;
    for (const [start, end] of rest) overlap += Math.max(0, Math.min(to, end) - Math.max(from, start));
    flight = Math.max(flight, Math.min(Math.max(0, excess), overlap));
  }
  return flight;
}

// Self-contained for page.evaluate. Only this pane is wrapped; every native method keeps its receiver/arguments/result/error.
// Besides the pane's `data-opf-checking` edges it times CodeMirror's background parse: @codemirror/language asks `requestIdleCallback` for it with
// `{ timeout: 400 }` (its MaxPause 500 minus MinPause 100) and looks the global up at each call, so a wrapper installed now sees every later slice. No
// other code of the page asks for an idle callback (the editor's src has none); one with any other timeout is passed on untimed, so it counts as busy.
export function installWorkerFlightClock() {
  const root = demo.pane.element, dataset = root.dataset;
  if (root.hasAttribute('data-opf-checking')) throw new Error('Install the native-busy clock only on an idle pane');
  const ownDataset = Object.getOwnPropertyDescriptor(root, 'dataset'), ownRemove = Object.getOwnPropertyDescriptor(root, 'removeAttribute');
  const remove = root.removeAttribute, limits = { beats: 131072, nativeEdges: 8192, moEdges: 8192, longtasks: 8192, samples: 128, parses: 8192 };
  const ownIdle = Object.getOwnPropertyDescriptor(window, 'requestIdleCallback'), idle = window.requestIdleCallback;
  const buffers = Object.fromEntries(Object.keys(limits).map(key => [key, []])), overflow = {};
  const spans = [], parses = [], faults = [], restoreErrors = [];
  let opened = null, cursor = 0, lastClock = -Infinity, restored = false;
  const record = (kind, value) => { if (buffers[kind].length < limits[kind]) buffers[kind].push(value); else overflow[kind] = (overflow[kind] ?? 0) + 1; };
  const clock = () => {
    const value = performance.now();
    if (!Number.isFinite(value) || value < 0 || value < lastClock) { if (faults.length < 16) faults.push('Invalid or decreasing native clock'); else overflow.clockFaults = (overflow.clockFaults ?? 0) + 1; }
    if (Number.isFinite(value)) lastClock = value;
    return value;
  };
  const mutate = (operation, action) => {
    const before = clock(); let failed = false;
    try { return action(); } catch (error) { failed = true; throw error; }
    finally {
      const after = clock(), on = root.hasAttribute('data-opf-checking');
      record('nativeEdges', { operation, before, after, on, failed });
      if (failed) { if (faults.length < 16) faults.push('Native mutation threw'); else overflow.clockFaults = (overflow.clockFaults ?? 0) + 1; }
      if (on && opened === null) opened = before;
      else if (!on && opened !== null) {
        if (spans.length < limits.nativeEdges) spans.push([opened, after]); else overflow.spans = (overflow.spans ?? 0) + 1;
        opened = null;
      }
    }
  };
  const proxy = new Proxy(dataset, {
    get(target, key) { return Reflect.get(target, key, target); },
    set(target, key, value) { return key === 'opfChecking' ? mutate('dataset.opfChecking=set', () => Reflect.set(target, key, value, target)) : Reflect.set(target, key, value, target); },
  });
  const validate = () => {
    if (opened !== null || faults.length || Object.keys(overflow).length) throw new Error('Native worker-flight clock incomplete, invalid or overflowed');
  };
  const restore = () => {
    const attempt = action => { try { action(); } catch (error) { restoreErrors.push(String(error?.message ?? error)); } };
    attempt(() => { if (ownDataset) Object.defineProperty(root, 'dataset', ownDataset); else delete root.dataset; });
    attempt(() => { if (ownRemove) Object.defineProperty(root, 'removeAttribute', ownRemove); else delete root.removeAttribute; });
    attempt(() => { if (ownIdle) Object.defineProperty(window, 'requestIdleCallback', ownIdle); else delete window.requestIdleCallback; });
    restored = root.dataset === dataset && root.removeAttribute === remove && window.requestIdleCallback === idle && !restoreErrors.length;
  };
  /** The parse slice as an idle callback that records its own span; any other idle callback is passed on as it is. */
  const timedIdle = function (callback, options, ...rest) {
    const receiver = this ?? window;
    if (typeof callback !== 'function' || options?.timeout !== 400) return Reflect.apply(idle, receiver, [callback, options, ...rest]);
    return Reflect.apply(idle, receiver, [function (...args) {
      const from = clock();
      try { return Reflect.apply(callback, this, args); } finally {
        const to = clock(), span = [from, to];
        record('parses', span);
        if (parses.length < limits.parses) parses.push(span); else overflow.parseSpans = (overflow.parseSpans ?? 0) + 1;
      }
    }, options, ...rest]);
  };
  window.__workerFlight = {
    record, restore, validate,
    takeSpans() { validate(); const result = { spans: spans.slice(), newSpans: spans.slice(cursor), parses: parses.slice() }; cursor = spans.length; return result; },
    snapshot: () => ({ clock: { timeOrigin: performance.timeOrigin, unit: 'performance.now milliseconds' }, limits, buffers, spans, parses, opened, faults, overflow, restored, restoreErrors }),
  };
  try {
    Object.defineProperty(root, 'dataset', { configurable: true, enumerable: ownDataset?.enumerable ?? true, get: () => proxy });
    Object.defineProperty(root, 'removeAttribute', { configurable: true, writable: true, value: function (...args) { return this === root && args[0] === 'data-opf-checking' ? mutate('removeAttribute', () => Reflect.apply(remove, this, args)) : Reflect.apply(remove, this, args); } });
    if (typeof idle === 'function') Object.defineProperty(window, 'requestIdleCallback', { configurable: true, enumerable: ownIdle?.enumerable ?? true, writable: true, value: timedIdle });
  } catch (error) { restore(); throw error; }
}
