// Deck title (CE-28): the presentation's `name`, edited in place. It reads as plain heading text until it is hovered or focused, then shows a
// border and a focus ring. Enter or blur commits through the editor session as one undoable edit (an empty name removes the key); Escape puts the
// current name back. The field follows the document (undo, the source pane, the host) unless the person is typing. Plain DOM, no framework, no network.

const DEFAULT_LABELS = {
  /** The accessible name of the field. */
  label: "Presentation name",
  /** The placeholder shown while the deck has no name. */
  placeholder: "Untitled presentation",
};

const MIN_CHARS = 6;
const MAX_CHARS = 120;

/**
 * The JSON Patch that renames a deck: `current` is the deck's `name` now (`undefined` when it has none), `next` the text the person typed.
 * The text is trimmed. Returns `null` when nothing changes: the trimmed text equals `current`, or it is empty and there is no name to remove.
 * A non-empty name is an `add` (which also replaces); an empty one removes the key, so the deck falls back to "no name".
 */
export function deckNamePatch(current, next) {
  const name = String(next ?? "").trim();
  const before = typeof current === "string" ? current : undefined;
  if (name === "") return before === undefined ? null : [{ op: "remove", path: "/name" }];
  if (name === before) return null;
  return [{ op: "add", path: "/name", value: name }];
}

/**
 * Mount the editable deck name into `container`.
 *
 * Options: `editor` (an editor session), `placeholder`, `label` (the accessible name), `readOnly`, `density` (`"comfortable"` or `"touch"`),
 * `labels` (`label`, `placeholder`), `beforeCommit()` (return `false` to stop the rename, for example when committing an open canvas edit
 * failed; the typed text stays), `onRename({ name, previous })` (after a successful rename; `name` is `""` when the name was removed) and
 * `onError(error)` (when the session refuses the patch; the field shows the current name again).
 *
 * Returns `{ element, input, setDensity(d), setDisabled(b), setReadOnly(b), refresh(), focus(), destroy() }`.
 */
export function createDeckTitle(container, options = {}) {
  if (!container?.ownerDocument) throw new TypeError("A DOM container is required.");
  const { editor } = options;
  if (!editor || typeof editor.snapshot !== "function" || typeof editor.applyPatch !== "function") throw new TypeError("An editor session is required.");
  const doc = container.ownerDocument;
  const labels = { ...DEFAULT_LABELS, ...(options.labels ?? {}) };
  const placeholder = options.placeholder ?? labels.placeholder;
  const label = options.label ?? labels.label;
  let readOnly = Boolean(options.readOnly);
  let disabled = false;
  let editing = false;
  let painted = "";
  let disposed = false;

  const element = doc.createElement("div");
  element.className = "opf-title";
  const input = doc.createElement("input");
  input.type = "text";
  input.className = "opf-title-input";
  input.placeholder = placeholder;
  input.setAttribute("aria-label", label);
  input.setAttribute("autocomplete", "off");
  input.setAttribute("autocapitalize", "off");
  input.spellcheck = false;
  element.append(input);
  container.append(element);

  const currentName = () => {
    const name = editor.snapshot().presentation?.name;
    return typeof name === "string" ? name : undefined;
  };
  function fit() {
    // `field-sizing: content` sizes the field in current browsers; `size` is the fallback elsewhere.
    const length = (input.value || placeholder).length;
    input.size = Math.max(MIN_CHARS, Math.min(MAX_CHARS, length));
  }
  function paintState() {
    input.readOnly = readOnly || disabled;
    if (disabled) input.setAttribute("aria-disabled", "true");
    else input.removeAttribute("aria-disabled");
    element.dataset.state = disabled ? "disabled" : readOnly ? "readonly" : "editable";
    input.title = input.value;
  }
  function paint() {
    const name = currentName() ?? "";
    painted = name;
    if (input.value !== name) input.value = name;
    paintState();
    fit();
  }
  function refresh() {
    if (disposed || editing) return;
    paint();
  }

  // Put the document's name back in the field and stop the edit.
  function revert() {
    editing = false;
    paint();
  }
  // Commit the typed text. Returns "done" (applied, unchanged or refused: the field shows the document again) or "aborted" (`beforeCommit` said no).
  function commit() {
    if (!editing && input.value === painted) return "done";
    if (options.beforeCommit && options.beforeCommit() === false) return "aborted";
    const previous = currentName();
    const patch = deckNamePatch(previous, input.value);
    editing = false;
    if (!patch) {
      paint();
      return "done";
    }
    const name = patch[0].op === "remove" ? "" : patch[0].value;
    try {
      // The session's own listeners repaint this field during the call (nothing is being typed any more).
      editor.applyPatch(patch, { source: "deck-name", rejectInvalid: true });
    } catch (error) {
      paint();
      options.onError?.(error);
      return "done";
    }
    paint();
    options.onRename?.({ name, previous });
    return "done";
  }

  input.addEventListener("input", () => {
    editing = true;
    input.title = input.value;
    fit();
  });
  input.addEventListener("keydown", (event) => {
    if (readOnly || disabled) return;
    // Enter that confirms an IME candidate is not a commit (Safari reports it with keyCode 229 after compositionend).
    if (event.isComposing || event.keyCode === 229) return;
    if (event.key === "Enter") {
      event.preventDefault();
      if (commit() === "done") input.blur();
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      revert();
      input.blur();
    }
  });
  input.addEventListener("blur", () => {
    if (readOnly || disabled) return;
    commit();
  });
  input.addEventListener("focus", () => {
    if (!readOnly && !disabled) input.select();
  });

  paint();
  const unsubscribe = typeof editor.subscribe === "function" ? editor.subscribe(() => refresh()) : undefined;

  const handle = {
    element,
    input,
    setDensity(density) {
      element.dataset.density = density === "touch" ? "touch" : "comfortable";
    },
    setDisabled(value) {
      disabled = Boolean(value);
      if (disabled) revert();
      paintState();
    },
    setReadOnly(value) {
      readOnly = Boolean(value);
      if (readOnly) revert();
      paintState();
    },
    refresh,
    focus() {
      if (!disposed) input.focus();
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      unsubscribe?.();
      element.remove();
    },
  };
  handle.setDensity(options.density);
  return handle;
}
