// CE-20: the Studio's commands (STUDIO-SPEC.md sections 6 and 14). One registry is the source of the keyboard map, the context menu, the bar's
// disabled states, the shortcut sheet and a host's palette (`editor.commands.list()`), so they cannot drift. Each command's `when(studio)`
// returns true, or a reason string that disables it and is shown as its title and spoken in the live region; `run(studio)` asks the Studio to
// act. Nothing here touches the DOM or the document: the Studio (src/studio.js) does, through the slide adapter (one undo step per command).
import { createCommandRegistry } from "./studio-kit/commands.js";

/** The block kinds Insert offers, in menu order (the layout region kinds, with Group last). */
export const STUDIO_INSERT_KINDS = Object.freeze(["text", "list", "image", "video", "chart", "table", "code", "metric", "quote", "timeline", "group"]);
export const STUDIO_INSERT_LABELS = Object.freeze({ text: "Text", list: "List", image: "Image", video: "Video", chart: "Chart", table: "Table", code: "Code", metric: "Metric", quote: "Quote", timeline: "Timeline", group: "Group" });
export const STUDIO_INSERT_HINTS = Object.freeze({
  text: "A paragraph of text",
  list: "Bulleted or numbered points",
  image: "A picture, with alt text",
  video: "A video with a poster frame",
  chart: "Column, bar, line or pie chart from a small table",
  table: "Rows and columns of values",
  code: "Source code with highlighting",
  metric: "One number with its label",
  quote: "A quotation and its source",
  timeline: "Dated steps in order",
  group: "A row of blocks you arrange together",
});
/** The download formats of File (`studio.file.download.<format>`). */
export const STUDIO_DOWNLOAD_FORMATS = Object.freeze(["json", "yaml", "markdown"]);

const READ_ONLY = "This editor is read-only.";
const FONTS = "Fonts are loading.";
const SOURCE = "Fix the source text first: the slide shows the last valid document.";

// The common gates of a command that changes the document.
function editable(s) {
  if (s.readOnly) return READ_ONLY;
  if (!s.inSync) return SOURCE;
  if (s.fontsLoading) return FONTS;
  return true;
}
const and = (...checks) => (s) => {
  for (const check of checks) {
    const verdict = check(s);
    if (verdict !== true) return verdict;
  }
  return true;
};
// A selection of blocks (or implicit content) on the canvas: not a heading, part, region or slide.
const blocks = (action) => (s) => {
  const nodes = s.selectedNodes();
  if (!nodes.length) return `Select a block to ${action}.`;
  if (nodes.some((node) => node.kind === "heading")) return `A heading cannot ${action === "move" ? "move" : `be ${action === "copy" ? "copied as a block" : `${action}d`}`}.`;
  if (nodes.some((node) => node.kind === "part")) return `Select the whole block to ${action} it.`;
  if (nodes.some((node) => node.kind === "region")) return "A region belongs to the slide's layout. Edit the layout to change it.";
  if (nodes.some((node) => node.kind === "slide")) return "Select a block on the slide.";
  return true;
};
const slides = (s) => (s.slideScope() ? true : "Select a slide first.");
const blocksOrSlides = (action) => (s) => (s.slideScope() ? true : blocks(action)(s));
const primaryKind = (kinds, message) => (s) => (kinds.includes(s.primaryNode()?.type) && s.primaryNode()?.kind !== "part" ? true : message);
const playground = (s) => (s.layout === "studio" ? true : "Open the Studio for this.");

/**
 * The command definitions. Keys are CodeMirror-style ("Mod-z"); Mod is Cmd on macOS and Ctrl elsewhere. `scope` "canvas" commands run
 * only while focus is on the slide, the layers or the Studio's own chrome, never in a field or the source pane (the kit's typing guard).
 */
export function studioCommandDefinitions() {
  const list = [
    // Tools
    { id: "studio.tool.select", label: "Select tool", group: "Tools", keys: ["v"], when: playground, run: (s) => s.setTool("select") },
    { id: "studio.tool.hand", label: "Hand tool", group: "Tools", keys: ["h"], when: playground, run: (s) => s.setTool("hand") },
    { id: "studio.tool.text", label: "Text tool", group: "Tools", keys: ["t"], when: and(playground, editable), run: (s) => s.setTool("text") },
    // View
    { id: "studio.zoom.in", label: "Zoom in", group: "View", keys: ["Mod-=", "Mod-+", "Shift-Mod-=", "Shift-Mod-+"], run: (s) => s.zoomBy(1) },
    { id: "studio.zoom.out", label: "Zoom out", group: "View", keys: ["Mod--"], run: (s) => s.zoomBy(-1) },
    { id: "studio.zoom.100", label: "Zoom to 100%", group: "View", keys: ["Shift-0", "Shift-)"], run: (s) => s.setZoom(1) },
    { id: "studio.zoom.fit", label: "Zoom to fit", group: "View", keys: ["Shift-1", "Shift-!"], run: (s) => s.fit("slide") },
    { id: "studio.panels.toggle", label: "Show or hide panels", group: "View", keys: ["Mod-\\"], when: playground, run: (s) => s.togglePanels() },
    { id: "studio.source.toggle", label: "Show or hide the source", group: "View", keys: ["Ctrl-`"], when: (s) => (s.hasSource ? true : "This editor has no source pane."), run: (s) => s.toggleSource() },
    { id: "studio.layout.playground", label: "Switch to the Playground", group: "View", when: (s) => (s.layout === "playground" ? "The Playground is open." : true), run: (s) => s.setLayout("playground") },
    { id: "studio.layout.studio", label: "Open in Studio", group: "View", when: (s) => (s.layout === "studio" ? "The Studio is open." : true), run: (s) => s.setLayout("studio") },
    // Selection
    { id: "studio.select.parent", label: "Select parent", group: "Selection", keys: ["Shift-Enter"], scope: "canvas", when: (s) => (s.selectedKeys().length ? true : "Nothing is selected."), run: (s) => s.selectParent() },
    { id: "studio.select.children", label: "Select children", group: "Selection", keys: ["Enter"], scope: "canvas", when: (s) => (s.primaryNode()?.children?.length ? true : "This has nothing inside it."), run: (s) => s.selectChildren() },
    { id: "studio.select.next", label: "Select next", group: "Selection", keys: ["Tab", "ArrowRight", "ArrowDown"], scope: "canvas", when: (s) => s.hasSibling(1), run: (s) => s.selectSibling(1) },
    { id: "studio.select.previous", label: "Select previous", group: "Selection", keys: ["Shift-Tab", "ArrowLeft", "ArrowUp"], scope: "canvas", when: (s) => s.hasSibling(-1), run: (s) => s.selectSibling(-1) },
    { id: "studio.select.siblings", label: "Select all", group: "Selection", keys: ["Mod-a"], scope: "canvas", when: (s) => (s.selectedKeys().length ? true : "Select something first."), run: (s) => s.selectSiblings() },
    // Edit
    { id: "studio.cut", label: "Cut", group: "Edit", keys: ["Mod-x"], scope: "canvas", when: and(editable, blocksOrSlides("cut")), run: (s) => s.cut() },
    { id: "studio.copy", label: "Copy", group: "Edit", keys: ["Mod-c"], scope: "canvas", when: blocksOrSlides("copy"), run: (s) => s.copy() },
    { id: "studio.paste", label: "Paste", group: "Edit", keys: ["Mod-v"], scope: "canvas", when: and(editable, (s) => (s.hasClipboard() ? true : "The clipboard is empty.")), run: (s) => s.paste() },
    { id: "studio.duplicate", label: "Duplicate", group: "Edit", keys: ["Mod-d"], scope: "canvas", when: and(editable, blocksOrSlides("duplicate")), run: (s) => s.duplicate() },
    { id: "studio.delete", label: "Delete", group: "Edit", keys: ["Delete", "Backspace"], scope: "canvas", when: and(editable, blocksOrSlides("delete")), run: (s) => s.remove() },
    { id: "studio.undo", label: "Undo", group: "Edit", keys: ["Mod-z"], when: and((s) => (s.readOnly ? READ_ONLY : true), (s) => (s.canUndo() ? true : "Nothing to undo.")), run: (s) => s.undo() },
    { id: "studio.redo", label: "Redo", group: "Edit", keys: ["Shift-Mod-z", "Ctrl-y"], when: and((s) => (s.readOnly ? READ_ONLY : true), (s) => (s.canRedo() ? true : "Nothing to redo.")), run: (s) => s.redo() },
    // Structure
    { id: "studio.move.earlier", label: "Move up", group: "Structure", keys: ["[", "Alt-ArrowUp", "Alt-ArrowLeft"], scope: "canvas", when: and(editable, blocks("move")), run: (s) => s.moveBy(-1) },
    { id: "studio.move.later", label: "Move down", group: "Structure", keys: ["]", "Alt-ArrowDown", "Alt-ArrowRight"], scope: "canvas", when: and(editable, blocks("move")), run: (s) => s.moveBy(1) },
    { id: "studio.move.intoPrevious", label: "Move into the group before", group: "Structure", keys: ["Shift-[", "Shift-{"], scope: "canvas", when: and(editable, blocks("move"), (s) => s.groupBeside(-1)), run: (s) => s.moveInto(-1) },
    { id: "studio.move.intoNext", label: "Move into the group after", group: "Structure", keys: ["Shift-]", "Shift-}"], scope: "canvas", when: and(editable, blocks("move"), (s) => s.groupBeside(1)), run: (s) => s.moveInto(1) },
    { id: "studio.group", label: "Group", group: "Structure", keys: ["Mod-g"], scope: "canvas", when: and(editable, blocks("group")), run: (s) => s.group() },
    { id: "studio.ungroup", label: "Ungroup", group: "Structure", keys: ["Shift-Mod-g"], scope: "canvas", when: and(editable, (s) => (s.primaryNode()?.kind === "group" && s.selectedKeys().length === 1 ? true : "Select a group to ungroup.")), run: (s) => s.ungroup() },
    { id: "studio.regions.place", label: "Place in regions…", group: "Structure", when: and(editable, (s) => s.canPlaceInRegions()), run: (s) => s.placeInRegions() },
    { id: "studio.regions.release", label: "Back to blocks", group: "Structure", when: and(editable, (s) => s.canReleaseRegions()), run: (s) => s.releaseRegions() },
    // Content
    { id: "studio.text.edit", label: "Edit text", group: "Content", keys: ["F2"], scope: "canvas", when: and(editable, (s) => (s.textTarget() ? true : "Select text to edit it.")), run: (s) => s.editText() },
    { id: "studio.data.edit", label: "Edit data", group: "Content", when: and(editable, primaryKind(["chart", "table"], "Select a chart or a table.")), run: (s) => s.editData() },
    { id: "studio.image.crop", label: "Crop picture", group: "Content", when: and(editable, primaryKind(["image"], "Select a picture.")), run: (s) => s.cropImage() },
    // Slides
    { id: "studio.slide.new", label: "New slide", group: "Slides", when: editable, run: (s) => s.newSlide() },
    { id: "studio.slide.duplicate", label: "Duplicate slide", group: "Slides", when: editable, run: (s) => s.duplicateSlide() },
    { id: "studio.slide.delete", label: "Delete slide", group: "Slides", when: and(editable, (s) => (s.slideCount() > 1 ? true : "A presentation keeps at least one slide.")), run: (s) => s.deleteSlide() },
    { id: "studio.slide.hide", label: "Hide slide", group: "Slides", when: editable, run: (s) => s.hideSlide() },
    { id: "studio.slide.next", label: "Next slide", group: "Slides", keys: ["PageDown"], when: (s) => (s.slideIndex < s.slideCount() - 1 ? true : "This is the last slide."), run: (s) => s.goSlide(1) },
    { id: "studio.slide.previous", label: "Previous slide", group: "Slides", keys: ["PageUp"], when: (s) => (s.slideIndex > 0 ? true : "This is the first slide."), run: (s) => s.goSlide(-1) },
    { id: "studio.layout.edit", label: "Edit layout", group: "Slides", when: and(editable, (s) => s.canEditLayout()), run: (s) => s.editLayout() },
    // Deck
    { id: "studio.present", label: "Present from the start", group: "Deck", keys: ["F5"], when: (s) => (s.inSync ? true : SOURCE), run: (s) => s.present(true) },
    { id: "studio.present.current", label: "Present from this slide", group: "Deck", keys: ["Shift-F5", "Mod-Alt-Enter"], when: (s) => (s.inSync ? true : SOURCE), run: (s) => s.present(false) },
    { id: "studio.find", label: "Find", group: "Deck", hint: "", when: (s) => (s.hasFind ? true : "Find is not part of this editor."), run: (s) => s.find(false) },
    { id: "studio.replace", label: "Find and replace", group: "Deck", hint: "", when: and(editable, (s) => (s.hasFind ? true : "Find is not part of this editor.")), run: (s) => s.find(true) },
    { id: "studio.export", label: "Export…", group: "Deck", when: (s) => (s.hasExport ? (s.inSync ? true : SOURCE) : "Export is not part of this editor."), run: (s) => s.openExport() },
    { id: "studio.file.open", label: "Open…", group: "Deck", when: (s) => (s.readOnly ? READ_ONLY : true), run: (s) => s.openFile() },
    { id: "studio.file.new", label: "New presentation", group: "Deck", when: (s) => (s.readOnly ? READ_ONLY : true), run: (s) => s.newDocument() },
    ...STUDIO_DOWNLOAD_FORMATS.map((format) => ({ id: `studio.file.download.${format}`, label: `Download as ${format === "markdown" ? "Markdown" : format.toUpperCase()}`, group: "Deck", when: (s) => (s.inSync ? true : SOURCE), run: (s) => s.download(format) })),
    { id: "studio.file.copy", label: "Copy as OPF JSON", group: "Deck", when: (s) => (s.inSync ? true : SOURCE), run: (s) => s.copyDocument() },
    { id: "studio.shortcuts", label: "Keyboard shortcuts", group: "Deck", keys: ["?", "Shift-?", "F1", "Mod-/"], run: (s) => s.openShortcuts() },
  ];
  for (const kind of STUDIO_INSERT_KINDS) {
    list.push({ id: `studio.insert.${kind}`, label: `Insert ${STUDIO_INSERT_LABELS[kind].toLowerCase()}`, group: "Content", when: and(editable, playground, (s) => s.canInsert(kind)), run: (s) => s.insert(kind) });
  }
  // Convert to: one command per kind, enabled when the primary block converts to it.
  for (const kind of STUDIO_INSERT_KINDS.filter((entry) => entry !== "group" && entry !== "video")) {
    list.push({ id: `studio.convert.${kind}`, label: `Convert to ${STUDIO_INSERT_LABELS[kind].toLowerCase()}`, group: "Structure", when: and(editable, blocks("convert"), (s) => s.canConvert(kind)), run: (s) => s.convert(kind) });
  }
  return list;
}

/** The ids every Studio has (STUDIO-SPEC section 14), for the coverage test and a host palette. */
export const STUDIO_COMMAND_IDS = Object.freeze(studioCommandDefinitions().map((command) => command.id));

/** A registry with the Studio's commands, then `extra` host commands, with the host's `keymap` overrides (`{ id: keys | null }`). */
export function createStudioCommands({ extra = [], keymap } = {}) {
  const registry = createCommandRegistry({ commands: studioCommandDefinitions() });
  for (const command of extra) registry.register(command);
  if (keymap) registry.setKeymap(keymap);
  return registry;
}

/** The context menu of a selection (STUDIO-SPEC 4.7), as groups of command ids; the Studio adds the "Move into" and "Convert to" submenus. */
export function contextMenuGroups({ slide = false } = {}) {
  const groups = [
    ["studio.cut", "studio.copy", "studio.paste", "studio.duplicate", "studio.delete"],
    ["studio.group", "studio.ungroup", "studio.move.earlier", "studio.move.later"],
    ["studio.text.edit", "studio.data.edit", "studio.image.crop"],
  ];
  if (slide) groups.push(["studio.regions.place", "studio.regions.release"], ["studio.slide.new", "studio.slide.duplicate", "studio.slide.hide", "studio.layout.edit"]);
  return groups;
}
