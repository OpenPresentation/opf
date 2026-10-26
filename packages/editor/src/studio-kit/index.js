// CE-18: the studio kit, the parts Layout Studio and the Studio share (STUDY.md 3.6, STUDIO-SPEC.md 17). It is internal for now: no package
// subpath exports it until a second studio uses it (then `@openpresentation/opf-editor/studio-kit`). Nothing here knows a document format;
// a studio supplies a document adapter (src/layout-adapter.js for Layout Studio).
export { ICONS, KIT_PREFIX, createDom, isMac, isTypingTarget, nextId, openMenu, pct } from "./dom.js";
export { createCommandRegistry, formatKey, isHandled, keyGuard, markHandled, matchKey, parseKey } from "./commands.js";
export { clickTarget, createSelection } from "./selection.js";
export { createGesture, createHistory } from "./gesture.js";
export { ZOOM_STEPS, clampZoom, createViewport, scrollForZoom, stepZoom, toUnit } from "./viewport.js";
export { boxesAt, createKeyedLayer, createOverlay, dividerKeyAction, inside, paintBadge, paintDivider, paintSelectable, ratioLabel, setBox } from "./overlay.js";
export { createDragController, dragGhost, trackPointer } from "./drag.js";
export { hitRow, rovingTabStop, rowDropMode, showTreeDrop, treeItem, treeKeyAction } from "./tree.js";
export { createFields, createInspectorFrame } from "./inspector.js";
