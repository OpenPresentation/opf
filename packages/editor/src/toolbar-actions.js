// CE-29, toolbar actions: the `actions` item. The host's own buttons in the editor's toolbar ("Share", "Publish", "Save as template"), each with a visible
// label, an optional icon and optional enabled and pressed state. The editor never decides what they do: `run()` is the host's. Plain DOM, no framework,
// no network. An icon is an SVG element (copied into the toolbar's document) or SVG path data (24x24, stroked like the editor's own icons).
import { resolveIcon } from "./icons.js";

const DEFAULT_LABELS = {
  /** The accessible name of the group of buttons. */
  group: "Actions",
};

function checkAction(action, seen) {
  if (!action || typeof action !== "object") throw new TypeError("An action must be an object.");
  if (typeof action.id !== "string" || !action.id) throw new TypeError("An action needs a string id.");
  if (typeof action.label !== "string" || !action.label) throw new TypeError(`The action "${action.id}" needs a label.`);
  if (typeof action.run !== "function") throw new TypeError(`The action "${action.id}" needs a run() function.`);
  if (seen.has(action.id)) throw new TypeError(`Two actions have the id "${action.id}".`);
  seen.add(action.id);
}

function iconNode(doc, action) {
  return action.icon ? resolveIcon(doc, action.icon, null, { name: action.id, className: "opf-actions-icon" }) : null;
}

/**
 * Mount the host's action buttons into `container`.
 *
 * Options: `actions` (`[{ id, label, icon?, title?, run(), enabled?(), pressed?(), primary? }]`), `density` (`"comfortable"` or `"touch"`), `labels`
 * (`group`).
 *
 * Returns `{ element, setActions(actions), refresh(), setDensity(density), setDisabled(disabled), menuItems(), destroy() }`. `refresh()` reads every
 * `enabled()` and `pressed()` again (they are not watched); a button also refreshes after its own `run()`.
 */
export function createToolbarActions(container, options = {}) {
  if (!container?.ownerDocument) throw new TypeError("A DOM container is required.");
  const doc = container.ownerDocument;
  const labels = { ...DEFAULT_LABELS, ...(options.labels ?? {}) };
  let density = options.density === "touch" ? "touch" : "comfortable";
  let disabled = false;
  let destroyed = false;
  let actions = [];
  let buttons = new Map();

  const element = doc.createElement("div");
  element.className = "opf-actions";
  element.dataset.density = density;
  element.setAttribute("role", "group");
  element.setAttribute("aria-label", labels.group);
  container.append(element);

  const isEnabled = (action) => {
    if (typeof action.enabled !== "function") return true;
    try { return action.enabled() !== false; } catch { return false; }
  };
  const isPressed = (action) => {
    if (typeof action.pressed !== "function") return undefined;
    try { return Boolean(action.pressed()); } catch { return false; }
  };

  function refresh() {
    if (destroyed) return;
    for (const action of actions) {
      const button = buttons.get(action.id);
      if (!button) continue;
      button.disabled = disabled || !isEnabled(action);
      const pressed = isPressed(action);
      if (pressed === undefined) button.removeAttribute("aria-pressed"); else button.setAttribute("aria-pressed", String(pressed));
    }
  }

  function run(action) {
    if (destroyed || disabled || !isEnabled(action)) return undefined;
    const result = action.run();
    refresh();
    return result;
  }

  function build(action) {
    const button = doc.createElement("button");
    button.type = "button";
    button.className = `opf-actions-button${action.primary ? " is-primary" : ""}`;
    button.dataset.action = action.id;
    if (action.title) button.title = action.title;
    const icon = iconNode(doc, action);
    if (icon) button.append(icon);
    const label = doc.createElement("span");
    label.className = "opf-actions-label";
    label.textContent = action.label;
    button.append(label);
    button.addEventListener("click", () => { run(action); });
    return button;
  }

  function setActions(next) {
    if (destroyed) return;
    const list = Array.isArray(next) ? next : [];
    const seen = new Set();
    for (const action of list) checkAction(action, seen);
    // A focused button keeps the focus across the rebuild.
    const focused = element.contains(doc.activeElement) ? doc.activeElement.dataset.action : null;
    actions = list.slice();
    buttons = new Map(actions.map((action) => [action.id, build(action)]));
    element.replaceChildren(...buttons.values());
    element.hidden = actions.length === 0;
    refresh();
    if (focused && buttons.has(focused) && !buttons.get(focused).disabled) buttons.get(focused).focus({ preventScroll: true });
  }
  setActions(options.actions);

  return {
    element,
    setActions,
    refresh,
    setDensity(next) {
      density = next === "touch" ? "touch" : "comfortable";
      element.dataset.density = density;
    },
    setDisabled(next) {
      disabled = Boolean(next);
      refresh();
    },
    /** `[{ id: "actions:<id>", label, disabled, pressed?, run }]`, one per action, in order. */
    menuItems() {
      return actions.map((action) => {
        const pressed = isPressed(action);
        return { id: `actions:${action.id}`, label: action.label, disabled: disabled || !isEnabled(action), ...(pressed === undefined ? {} : { pressed }), run: () => run(action) };
      });
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      element.remove();
      buttons.clear();
      actions = [];
    },
  };
}
