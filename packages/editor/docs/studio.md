# The Studio (CE-20)

The Presentation and Slide Studio is `createOpfEditor(el, { layout: "studio" })`: a Figma Auto Layout-style editor for OPF decks, over the same session, canvas, source pane, presenter, Review and export as every other layout of the embeddable editor ([embedding.md](embedding.md)). The interaction spec is `artifacts/oss-first/STUDIO-SPEC.md` in the repository.

Slides stay auto-layout (decision D2): you select frames and children, reorder within the flow, move into another group or region, wrap a selection in a group, resize tracks (weights) and set gap and padding. There is no free x/y positioning, no corner handle, no rotation.

```js
import "@openpresentation/opf-editor/styles.css";
import { createOpfEditor } from "@openpresentation/opf-editor/workspace";

const editor = createOpfEditor(element, {
  layout: "studio",                 // or "playground": the same editor arranged for first contact
  document, catalogs: [gallery], fonts,
  studio: {
    panels: { source: "split-right" },                    // the source split opens here ("split-bottom", false)
    hostPanels: [{ id: "agent", label: "Agent", mount(el, editor) { /* ... */ return () => {}; } }],
    fileItems: [{ id: "share", label: "Share…", run: (editor) => share(editor.getDocument()) }],
    commands: [{ id: "host.share", label: "Share", keys: ["Mod-Shift-s"], run: () => share() }],
    keymap: { "studio.source.toggle": ["Mod-Alt-s"] },
    sizes: { key: "my-app", storage: { get: (k) => localStorage.getItem(k), set: (k, v) => localStorage.setItem(k, v) } },
  },
  slots: { topbarEnd: shareButton },
});
await editor.ready;
editor.selection;                    // [{ key, path, idPath, kind }]: siblings, the last is the primary
editor.select(["/slides/@intro/blocks/@kpi"]); // keys or paths (JSON Pointer or dotted)
editor.setZoom(1.5); editor.fit("width");
editor.commands.list(); editor.commands.run("studio.group");
editor.setLayout("playground");      // same session, history, slide and selection
editor.openLayout();                 // "Edit layout": the current slide's layout in Layout Studio
editor.on("selection", ({ items, primary, source }) => {});
```

From React, host panels are rendered through portals into the Studio's panels, so they share the host's context:

```jsx
import { OpfEditor, useOpfCommands, useOpfSelection } from "@openpresentation/opf-editor/react";

<OpfEditor layout="studio" document={deck} fonts={fonts} catalogs={[gallery]} onEditor={setEditor}
  hostPanels={[{ id: "agent", label: "Agent", render: () => <AgentPanel /> }]} />;
const selection = useOpfSelection(editor);        // the list
const { commands, run } = useOpfCommands(editor);  // for a host palette
```

`react-dom` is an optional peer, needed only for `hostPanels`.

## The shell

- **Bar:** File, the presentation's name, the Select (V), Hand (H) and Text (T) tools, Insert, + Slide, Undo and Redo, the zoom menu, Source, Present, the host's `topbarEnd` and Export.
- **Left:** Slides (the filmstrip: click, Shift and Cmd or Ctrl to select, Alt+arrows and drag to reorder, Enter adds a slide after the focused one with its layout, Delete removes) over Layers (the current slide's tree). The divider between them and the panel's width are resizable.
- **Center:** the slide in a viewport (zoom 25% to 400%, Fit, Fit width; Ctrl or Cmd with the wheel, a trackpad pinch, two fingers; Space or the hand tool to pan), with the source as a split to the right or below (Ctrl+\`).
- **Right:** Design (bound to the selection), Review and the host's tabs.
- **Status:** validity (a click opens Review, or the source when it has errors), the slide counter, the format, autosave, the live messages and the zoom controls.

Below 1100px the left panel is a rail of two buttons; below 760px the canvas fills the screen and Slides, Layers, Design and Review open in a bottom sheet.

## Selection and editing

- A click selects the deepest block under the pointer; a selected group passes the next click one level in. Cmd or Ctrl+click selects a part (a list item, a metric's value).
- Shift+click adds or removes a sibling. Multiple selection works within one group; a block of another group replaces the selection and the status line says so.
- Esc selects the parent (block, group, region, slide, the deck); Enter goes into a container, or edits a text block; Shift+Enter selects the parent; Tab and the arrow keys move to siblings.
- Double-click text to edit it with the caret at the pointer, a picture to crop it, a chart or table to edit its data. Typing a character on a selected text block replaces its text. Esc commits and keeps the block selected.
- Drag a selected block past 4px to move it (on touch, hold 150ms first): a blue line shows where it lands, a group or region it would go into is highlighted, and a drop that is refused shows a red line and its reason. Esc cancels.
- The dividers of the selected container resize its tracks, snapping to whole numbers and halves (Shift is free), with a ratio badge; a double-click or Enter equalizes, and the arrow keys nudge. A column whose rows are sized to their content starts from what is drawn (the last row takes the empty space), so the first resize does not jump.
- Insert adds a block of a kind after the selection (or drag an item onto the slide); + Slide adds a slide with a layout after the current one.

Every command is one validated, undoable change through the slide adapter, and undo restores the selection of the change it undoes. There is one history, shared with the source pane.

## Keyboard

| Keys | Command |
| --- | --- |
| V, H, T | Select, Hand and Text tools |
| Space (hold) | Pan |
| Mod+=, Mod+- | Zoom in, out |
| Shift+0, Shift+1 | 100%, Fit |
| Esc | Leave text editing, cancel a drag or menu, else select the parent |
| Enter, Shift+Enter | Edit text or select the first child; select the parent |
| Tab, arrows | Next or previous sibling |
| `[`, `]`, Alt+arrows | Move earlier or later |
| Shift+`[`, Shift+`]` | Move into the group before or after |
| Mod+A | Select all siblings |
| Mod+D, Delete | Duplicate, delete |
| Mod+C, Mod+X, Mod+V | Copy, cut, paste (blocks, or slides in the filmstrip) |
| Mod+G, Shift+Mod+G | Group, ungroup |
| F2 | Edit text |
| PageUp, PageDown | Previous or next slide |
| Ctrl+\` | Show or hide the source |
| Mod+\ | Hide or show the side panels |
| ?, F1, Mod+/ | The shortcut sheet (with a search field) |
| Mod+F, Mod+H | Find, Find and replace |
| F5, Shift+F5, Mod+Alt+Enter | Present from the start, from this slide |
| Mod+Z, Shift+Mod+Z, Ctrl+Y | Undo, redo |
| Shift+F10, ContextMenu | The context menu |

Shortcuts never fire while you type in a field or the source pane (Ctrl+\` excepted). A key of a command that is off says why in the status line (read-only, nothing to paste). The registry is the source of the shortcut sheet, the context menu and `editor.commands.list()`, so they cannot drift.

## The Playground preset

`layout: "playground"` arranges the same editor for first contact: source and slide side by side (Source, Both or Preview), click to type into the slide, the slide row, Export, Present and "Open in Studio". `editor.setLayout("studio" | "playground")` switches in place, keeping the document, the history, the slide and the selection (the block selection shows in the Studio only); a host can keep the preset in its URL (the harness writes `?mode=playground`).

## Accessibility and theming

The slide's SVG is `aria-hidden`; each selectable node has a focusable overlay box (`role="button"`, `aria-pressed`) whose name says its kind, label, place ("2 of 3 in a row") and findings, and focus follows the selection. Dividers are `role="separator"` with `aria-valuenow` and `aria-valuetext`. One polite live region (the status line) announces every structural result and refusal ("Moved Chart before Table"). The selection ring is `--opf-ui-selection` between two rings of `--opf-ui-surface`, so it keeps 4.5:1 on any slide; forced-colors mode uses `Highlight`. The Studio's tokens are `selection`, `hover` and `canvasBackground` ([theming.md](theming.md)). Touch gets 44px targets, a long-press context menu, hold-then-drag and a floating action bar (Duplicate, Delete, Group, Up, Down).

## Known limits

- Not in the MVP (STUDIO-SPEC 1): the command palette UI (the registry and the sheet are in), marquee selection, zoom to selection, copy and paste of properties, lock and hide in layers, comment, history, proposal and presence overlays (the marker layer exists), i18n.
- Performance at 300 slides: a selection paints in about 13ms (p95); a structural commit takes about 400ms (p95) against the 150ms budget, most of it the font gate's whole-deck face analysis (`test/studio-perf-browser.mjs` prints the numbers).
- The layers tree does not virtualize long slides yet.

Try it locally: `pnpm run build:playground` in `packages/editor`, then serve `artifacts/playground` and open `studio.html` (`?mode=playground`, `?dark=1`, `?readonly=1`, `?source=right`, `?density=touch`).
