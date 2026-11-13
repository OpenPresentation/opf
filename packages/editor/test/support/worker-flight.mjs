// A heartbeat reports excess over its nominal4ms period, without knowing where within the interval that excess occurred.
// Its conservative in-flight contribution cannot exceed either that excess or the union of native-busy time it intersects.
export function workerFlightBlock(beats, spans, newSpans = []) {
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  let previousEnd = -Infinity;
  for (const beat of beats) {
    if (!Array.isArray(beat) || beat.length !== 3 || !beat.every(finite) || beat[0] < 0 || beat[1] < beat[0] || beat[0] < previousEnd || beat[2] !== beat[1] - beat[0] - 4) throw new TypeError('Invalid worker-flight heartbeat clock');
    previousEnd = beat[1];
  }
  const union = [];
  for (const span of spans) if (!Array.isArray(span) || span.length !== 2 || !span.every(finite) || span[0] < 0 || span[1] < span[0]) throw new TypeError('Invalid native-busy clock');
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
  let flight = 0;
  for (const [from, to, excess] of beats) {
    let overlap = 0;
    for (const [start, end] of union) overlap += Math.max(0, Math.min(to, end) - Math.max(from, start));
    flight = Math.max(flight, Math.min(Math.max(0, excess), overlap));
  }
  return flight;
}

// Self-contained for page.evaluate. Only this pane is wrapped; every native method keeps its receiver/arguments/result/error.
export function installWorkerFlightClock() {
  const root = demo.pane.element, dataset = root.dataset;
  if (root.hasAttribute('data-opf-checking')) throw new Error('Install the native-busy clock only on an idle pane');
  const ownDataset = Object.getOwnPropertyDescriptor(root, 'dataset'), ownRemove = Object.getOwnPropertyDescriptor(root, 'removeAttribute');
  const remove = root.removeAttribute, limits = { beats: 131072, nativeEdges: 8192, moEdges: 8192, longtasks: 8192, samples: 128 };
  const buffers = Object.fromEntries(Object.keys(limits).map(key => [key, []])), overflow = {};
  const spans = [], faults = [], restoreErrors = [];
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
    restored = root.dataset === dataset && root.removeAttribute === remove && !restoreErrors.length;
  };
  window.__workerFlight = {
    record, restore, validate,
    takeSpans() { validate(); const result = { spans: spans.slice(), newSpans: spans.slice(cursor) }; cursor = spans.length; return result; },
    snapshot: () => ({ clock: { timeOrigin: performance.timeOrigin, unit: 'performance.now milliseconds' }, limits, buffers, spans, opened, faults, overflow, restored, restoreErrors }),
  };
  try {
    Object.defineProperty(root, 'dataset', { configurable: true, enumerable: ownDataset?.enumerable ?? true, get: () => proxy });
    Object.defineProperty(root, 'removeAttribute', { configurable: true, writable: true, value: function (...args) { return this === root && args[0] === 'data-opf-checking' ? mutate('removeAttribute', () => Reflect.apply(remove, this, args)) : Reflect.apply(remove, this, args); } });
  } catch (error) { restore(); throw error; }
}
