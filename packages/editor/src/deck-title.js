// Deck title (CE-28): the presentation's `name`, edited in place. It reads as plain heading text until it is hovered or focused. Focusing it opens
// an edit: the field stretches over the whole row it sits in (the row's other controls give way, the row keeps its height) with a Save and a Cancel
// button at its end. Enter or Save commits through the editor session as one undoable edit (an empty name removes the key); Escape or Cancel puts
// the current name back. After Save or Cancel the focus stays in the field without an edit; a click or tap, Enter, F2 or typing opens it again. Leaving the field does not commit and does not close the edit: the draft stays until one of those four. The field follows
// the document (undo, the source pane, the host) unless an edit is open. Plain DOM, no framework, no network.

const DEFAULT_LABELS = {
  /** The accessible name of the field. */
  label: "Presentation name",
  /** The placeholder shown while the deck has no name. */
  placeholder: "Untitled presentation",
  /** The button that commits the name being edited. */
  save: "Save",
  /** The button that drops the name being edited. */
  cancel: "Cancel",
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
 * `labels` (`label`, `placeholder`, `save`, `cancel`), `row` (the element the field stretches over while editing: an element or a function
 * returning one; default the nearest ancestor with `data-opf-title-row`, else the container's parent), `beforeCommit()` (return `false` to stop
 * the rename, for example when committing an open canvas edit failed; the typed text stays), `onRename({ name, previous })` (after a successful
 * rename; `name` is `""` when the name was removed) and `onError(error)` (when the session refuses the patch; the field shows the current name again).
 *
 * Returns `{ element, input, saveButton, cancelButton, editing, setDensity(d), setDisabled(b), setReadOnly(b), refresh(), focus(), destroy() }`.
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
  let open = false; // an edit is open: the field is stretched and Save and Cancel are shown
  let reentering = false; // the focus is being put back in the field by this part: that must not open an edit
  let row = null;
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
  const actions = doc.createElement("span");
  actions.className = "opf-title-actions";
  actions.hidden = true;
  const makeButton = (kind, text) => {
    const button = doc.createElement("button");
    button.type = "button";
    button.className = "opf-title-button";
    button.dataset.action = kind;
    button.textContent = text;
    return button;
  };
  const saveButton = makeButton("save", labels.save);
  const cancelButton = makeButton("cancel", labels.cancel);
  actions.append(saveButton, cancelButton);
  element.append(input, actions);
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
    if (input.value !== name) input.value = name;
    paintState();
    fit();
  }
  function refresh() {
    if (disposed || open) return;
    paint();
  }

  const resolveRow = () => {
    const given = typeof options.row === "function" ? options.row() : options.row;
    return given ?? container.closest("[data-opf-title-row]") ?? container.parentElement;
  };
  // Open an edit: the field takes the whole row (an overlay, so the row keeps its height and its other controls stay where they are, hidden).
  function begin() {
    if (open || disposed || readOnly || disabled) return;
    open = true;
    row = resolveRow();
    // The part keeps the room it had, so what sits beside it does not move while it is out of the flow.
    const box = element.getBoundingClientRect();
    element.style.minWidth = `${box.width}px`;
    element.style.minHeight = `${box.height}px`;
    if (row && row !== container) {
      const style = doc.defaultView.getComputedStyle(row);
      if (style.position === "static") row.setAttribute("data-opf-title-relative", "");
      element.style.setProperty("--opf-title-pad-start", style.paddingLeft);
      element.style.setProperty("--opf-title-pad-end", style.paddingRight);
      row.setAttribute("data-opf-title-editing", "");
    }
    element.dataset.editing = "true";
    actions.hidden = false;
  }
  function end() {
    if (!open) return;
    open = false;
    delete element.dataset.editing;
    actions.hidden = true;
    for (const property of ["min-width", "min-height", "--opf-title-pad-start", "--opf-title-pad-end"]) element.style.removeProperty(property);
    row?.removeAttribute("data-opf-title-editing");
    row?.removeAttribute("data-opf-title-relative");
    row = null;
  }
  // Open an edit from the user's intent (click, tap, Enter, F2) with the name selected, as a first focus does. No-op while one is open.
  function reopen() {
    if (open || disposed || readOnly || disabled) return;
    begin();
    input.select();
  }
  // Put the focus back in the field without opening an edit.
  function refocus(select = false) {
    reentering = true;
    try {
      input.focus();
      if (select) input.select();
    } finally {
      reentering = false;
    }
  }

  // Put the document's name back in the field and close the edit.
  function revert() {
    end();
    paint();
  }
  // Commit the typed text. Returns "done" (applied, unchanged or refused: the field shows the document again) or "aborted" (`beforeCommit` said no).
  function commit() {
    if (!open) return "done";
    if (options.beforeCommit && options.beforeCommit() === false) return "aborted";
    const previous = currentName();
    const patch = deckNamePatch(previous, input.value);
    end();
    if (!patch) {
      paint();
      return "done";
    }
    const name = patch[0].op === "remove" ? "" : patch[0].value;
    try {
      // The session's own listeners repaint this field during the call (no edit is open any more).
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
  // Commit, from Enter or Save. When `beforeCommit` stops it the edit stays open with the text typed. The focus ends in the field either way
  // (the name selected after a commit, so typing again replaces it): moving it would drop it on the page's body, where neither the editor's
  // keys nor a screen reader's place in the bar survive.
  function save() {
    if (readOnly || disabled) return;
    refocus(commit() === "done");
  }
  // Drop the draft, from Escape or Cancel: the field shows the document's name again and keeps the focus.
  function cancel() {
    if (readOnly || disabled) return;
    revert();
    refocus(true);
  }

  input.addEventListener("input", () => {
    begin();
    input.title = input.value;
    fit();
  });
  input.addEventListener("keydown", (event) => {
    if (readOnly || disabled) return;
    // Enter that confirms an IME candidate is not a commit (Safari reports it with keyCode 229 after compositionend).
    if (event.isComposing || event.keyCode === 229) return;
    if (event.key === "Enter") {
      event.preventDefault();
      if (open) save();
      else reopen();
    } else if (event.key === "F2" && !open) {
      event.preventDefault();
      reopen();
    }
  });
  // The field already has the focus after Save or Cancel (which put it back without an edit), so no focus event comes: a click or tap is the
  // intent to edit, and it opens the edit with the name selected, as a first focus does. With an edit open a click only places the caret.
  // The press must not move the caret on its way (the browser would collapse the selection after the click); the click then selects the name.
  input.addEventListener("mousedown", (event) => {
    if (!open && !readOnly && !disabled && event.button === 0 && doc.activeElement === input) event.preventDefault();
  });
  input.addEventListener("click", () => reopen());
  // Escape closes an open edit from the field or from Save and Cancel; with no edit open it leaves the field.
  element.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || readOnly || disabled || event.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    event.stopPropagation();
    if (open) cancel();
    else if (event.target === input) input.blur();
  });
  saveButton.addEventListener("click", () => save());
  cancelButton.addEventListener("click", () => cancel());
  // Leaving the field neither commits nor closes the edit: only Enter, Save, Escape and Cancel end it.
  input.addEventListener("focus", () => {
    if (readOnly || disabled) return;
    input.select();
    if (!reentering) begin();
  });

  paint();
  const unsubscribe = typeof editor.subscribe === "function" ? editor.subscribe(() => refresh()) : undefined;

  const handle = {
    element,
    input,
    saveButton,
    cancelButton,
    get editing() {
      return open;
    },
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
      end();
      element.remove();
    },
  };
  handle.setDensity(options.density);
  return handle;
}
