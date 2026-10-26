import { Compartment } from "@codemirror/state";
import { EditorView, ViewPlugin } from "@codemirror/view";

// Selection contrast: CodeMirror styles an editor as light or dark through the `EditorView.darkTheme` facet, and its own base theme paints a selection
// by that flag (`#d7d4f0` for a light editor, drawn behind the text). The editor's colors come from the `--opf-ui-*` tokens, so the flag has to follow
// the color scheme those tokens resolve to, or a dark surface keeps light text on a light selection. `colorSchemeExtension(parent)` is that facet,
// kept in step with the page: it reads the `color-scheme` the surface resolves to (the tokens set it with the scheme), and looks again when a class,
// `data-theme` or `style` attribute changes on the editor or any ancestor, when `prefers-color-scheme` changes (a surface left to `light dark`) and
// when the editor takes focus.

/** True when `element` is drawn in a dark color scheme: its resolved `color-scheme` is `dark`, or lists both and the system prefers dark. */
export function prefersDark(element) {
  const win = element?.ownerDocument?.defaultView;
  if (!win || !element.isConnected) return false;
  const scheme = win.getComputedStyle(element).colorScheme.split(/\s+/);
  if (scheme.includes("dark")) return scheme.includes("light") ? Boolean(win.matchMedia?.("(prefers-color-scheme: dark)").matches) : true;
  return false;
}

const DARK = EditorView.darkTheme.of(true);

/** The extension for a view that will be mounted in `parent`: the dark flag now, and the plugin that keeps it in step. */
export function colorSchemeExtension(parent) {
  const scheme = new Compartment();
  const watcher = ViewPlugin.fromClass(class {
    constructor(view) {
      this.view = view;
      this.dark = prefersDark(parent.isConnected ? parent : view.dom);
      this.dead = false;
      this.queued = false;
      const win = view.dom.ownerDocument.defaultView;
      this.observer = typeof win?.MutationObserver === "function" ? new win.MutationObserver(() => this.queue()) : null;
      for (let node = view.dom; node; node = node.parentElement) this.observer?.observe(node, { attributes: true, attributeFilter: ["class", "data-theme", "style"] });
      this.media = win?.matchMedia?.("(prefers-color-scheme: dark)") ?? null;
      this.onMedia = () => this.queue();
      this.media?.addEventListener?.("change", this.onMedia);
      // The surface may not be in the document yet (the host mounts it first, attaches it after): look again once this update is over.
      this.queue();
    }
    update(update) { if (update.focusChanged) this.queue(); }
    queue() {
      if (this.queued || this.dead) return;
      this.queued = true;
      queueMicrotask(() => { this.queued = false; this.sync(); });
    }
    sync() {
      if (this.dead) return;
      const dark = prefersDark(this.view.dom);
      if (dark === this.dark) return;
      this.dark = dark;
      this.view.dispatch({ effects: scheme.reconfigure(dark ? DARK : []) });
    }
    destroy() {
      this.dead = true;
      this.observer?.disconnect();
      this.media?.removeEventListener?.("change", this.onMedia);
    }
  });
  return [scheme.of(prefersDark(parent) ? DARK : []), watcher];
}
