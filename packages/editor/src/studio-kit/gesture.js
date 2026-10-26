// CE-18, the studio kit: gesture history. A gesture (a divider drag, a scrub) shows drafts while it runs and lands as one history step;
// `createGesture` is that begin / update / end / cancel cycle over an adapter. `createHistory` is the snapshot history with coalescing that an
// adapter without an editor session keeps (Layout Studio's record); a slide adapter uses the session's history instead. No DOM.

/**
 * A gesture over `adapter`:
 * - `snapshot()`: the state to return to on cancel (taken at `begin`);
 * - `preview(draft, message)`: show a draft (no history, no change callbacks);
 * - `commit(start, { label, message })`: land the gesture as one step; returns whether anything changed;
 * - `restore(start)`: put the state taken at `begin` back.
 */
export function createGesture(adapter) {
  let active = null;
  return {
    get active() { return active !== null; },
    get label() { return active?.label ?? null; },
    /** Start a gesture; false while one is running. */
    begin(label) {
      if (active) return false;
      active = { label, start: adapter.snapshot() };
      return true;
    },
    /** Show a draft; false when no gesture runs. */
    update(draft, message) {
      if (!active) return false;
      adapter.preview(draft, message);
      return true;
    },
    /** Land the gesture as one step (`message`, else the label). Returns what `commit` returned, false when no gesture ran. */
    end(message) {
      if (!active) return false;
      const { start, label } = active;
      active = null;
      return Boolean(adapter.commit(start, { label, message: message ?? label }));
    },
    /** Drop the gesture and restore the state from its start. */
    cancel() {
      if (!active) return false;
      const { start } = active;
      active = null;
      adapter.restore(start);
      return true;
    },
    /** Forget a running gesture without restoring anything (the document was replaced under it). */
    reset() { active = null; },
  };
}

/**
 * A snapshot history: `reset(snapshot)` starts it, `push(snapshot, coalesce)` adds a step (a step with the same `coalesce` key within
 * `coalesceMs` of the head replaces it, so typing in a field is one step), `append(snapshot)` adds one after the current step without the
 * limit, and `go(-1 | 1)` moves and returns the step (null past either end). At most `limit` steps are kept; the oldest are dropped.
 */
export function createHistory({ limit = 200, coalesceMs = 1500, now = () => Date.now() } = {}) {
  let entries = [];
  let index = 0;
  return {
    get index() { return index; },
    get size() { return entries.length; },
    get head() { return entries[index]; },
    reset(snapshot) { entries = [{ ...snapshot }]; index = 0; },
    push(snapshot, coalesce) {
      const head = entries[index];
      const time = now();
      if (coalesce && head?.coalesce === coalesce && time - head.time < coalesceMs && index === entries.length - 1 && index > 0) {
        entries[index] = { ...snapshot, coalesce, time };
        return;
      }
      entries.length = index + 1;
      entries.push({ ...snapshot, coalesce, time });
      if (entries.length > limit) entries.shift(); else index++;
    },
    append(snapshot) {
      entries.length = index + 1;
      entries.push({ ...snapshot, time: now() });
      index++;
    },
    canUndo: () => index > 0,
    canRedo: () => index < entries.length - 1,
    go(step) {
      const target = index + step;
      if (target < 0 || target >= entries.length) return null;
      index = target;
      return entries[target];
    },
  };
}
