// CE-18, the studio kit: the selection model. An ordered list of node keys whose last entry is the primary; nothing selected means the
// document itself (a layout, a deck). Multi-select holds siblings only: adding a node of another parent replaces the selection. The model
// knows nothing about the document: a small adapter tells it whether a key exists and how keys relate. No DOM.

/**
 * Create a selection over `adapter`:
 * - `equals(a, b)` (default `===`), `copy(key)` (default identity);
 * - `exists(key)`: whether the key names a selectable node now;
 * - `parent(key)`: the parent's key, or null for a top-level node;
 * - `firstChild(key)`: the first child's key, or null when it has none or is not a container;
 * - `sibling(key, delta)`: the key `delta` places away in the same parent, or null past either end;
 * - `first()`: the key to select when nothing is and the person moves to a sibling, or null;
 * - `siblings(key)` (optional): the keys of the parent's children in order, for `selectSiblings` and `range`.
 * `onChange({ source })` runs after each change made by a select call (not after `replace` or `prune`).
 */
export function createSelection(adapter, { onChange } = {}) {
  const equals = adapter.equals ?? ((a, b) => a === b);
  const copy = adapter.copy ?? ((key) => key);
  let items = [];
  const has = (key) => items.some((entry) => equals(entry, key));
  const existing = (keys) => (keys ?? []).filter((key) => adapter.exists(key));
  const sameParent = (a, b) => { const pa = adapter.parent(a), pb = adapter.parent(b); return pa === null || pb === null ? pa === pb : equals(pa, pb); };

  /** Select `keys` (those that exist, in order). Returns false when the selection is already exactly that. */
  function set(keys, { source } = {}) {
    const next = existing(keys).map(copy);
    if (next.length === items.length && next.every((key, index) => equals(key, items[index]))) return false;
    items = next;
    onChange?.({ source });
    return true;
  }

  return {
    get items() { return items; },
    get primary() { return items[items.length - 1] ?? null; },
    has,
    /** The keys of `keys` that exist now. */
    existing,
    set,
    /** Replace the list as it is, without checks or a change event (history restore, a command's own result). */
    replace(keys) { items = keys; },
    /** Drop the keys that no longer exist, without a change event. */
    prune() { items = existing(items); },
    /** Copies of the keys, for a history snapshot. */
    snapshot: () => items.map(copy),
    /** Shift-click: add a sibling of the selection or remove a selected one; a node of another parent replaces the selection. */
    add(key, options) {
      if (!items.length || !existing([key]).length) return set([key], options);
      if (!sameParent(items[0], key)) return set([key], options);
      return set(has(key) ? items.filter((entry) => !equals(entry, key)) : [...items, key], options);
    },
    /** Cmd-click in a list: the same as `add`, by name. */
    toggle(key, options) { return this.add(key, options); },
    /** Shift-click in the layers: every sibling from the primary to `key`, in order (needs `adapter.siblings`). */
    range(key, options) {
      const anchor = items[items.length - 1];
      if (!anchor || !adapter.siblings || !sameParent(anchor, key)) return set([key], options);
      const list = adapter.siblings(key);
      const from = list.findIndex((entry) => equals(entry, anchor)), to = list.findIndex((entry) => equals(entry, key));
      if (from < 0 || to < 0) return set([key], options);
      const span = from <= to ? list.slice(from, to + 1) : list.slice(to, from + 1).reverse();
      return set(span, options);
    },
    /** Esc: the primary's parent, or nothing for a top-level node. */
    selectParent(options) {
      const key = items[items.length - 1];
      if (key === undefined) return false;
      const parent = adapter.parent(key);
      return set(parent === null ? [] : [parent], options);
    },
    /** Enter: the primary's first child, when it is a container with children. */
    selectChild(options) {
      const key = items[items.length - 1];
      if (key === undefined) return false;
      const child = adapter.firstChild(key);
      return child === null || child === undefined ? false : set([child], options);
    },
    /** Arrow keys: the primary's sibling `delta` away, or `first()` when nothing is selected. */
    selectSibling(delta, options) {
      const key = items[items.length - 1];
      if (key === undefined) { const first = adapter.first(); return set(first === null || first === undefined ? [] : [first], options); }
      const next = adapter.sibling(key, delta);
      return next === null || next === undefined ? false : set([next], options);
    },
    /** Mod+A: every sibling of the primary (needs `adapter.siblings`). */
    selectSiblings(options) {
      const key = items[items.length - 1];
      if (key === undefined || !adapter.siblings) return false;
      return set(adapter.siblings(key), options);
    },
  };
}

/**
 * What a click on a stack of nodes selects. `chain` is the nodes under the pointer from the outermost to the deepest. The deepest is the
 * answer, except that when the primary is a container in the chain (and Shift is not held), the click goes one level into it.
 */
export function clickTarget(chain, primary, { shift = false, equals = (a, b) => a === b, keyOf = (node) => node.key, isContainer = () => false } = {}) {
  if (!chain.length) return null;
  const deepest = chain[chain.length - 1];
  if (primary !== null && primary !== undefined && !shift) {
    const at = chain.findIndex((node) => equals(keyOf(node), primary));
    if (at >= 0 && isContainer(chain[at]) && at < chain.length - 1) return chain[at + 1];
  }
  return deepest;
}
