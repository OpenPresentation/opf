// The slide half of `createOpfEditor` (src/workspace.js), loaded on demand: the renderer, every part that shows or edits slides and the Studio. A host
// whose editor mounts only the source pane never loads this chunk (and so never loads the renderer); every other layout loads it once, before
// its parts mount. Internal: only workspace.js imports it.
export { toSvg } from "@openpresentation/opf-render/svg";
export { createCanvasEditor } from "./canvas.js";
export { createSlideNavigator } from "./slide-navigator.js";
export { createThumbnailStrip } from "./thumbnail-strip.js";
export { createThumbnailCache } from "./thumbnail-cache.js";
export { createSlideManager } from "./slide-manager.js";
export { createOutlineView } from "./outline-view.js";
export { createExportMenu } from "./export-menu.js";
export { bindPresentShortcut, createPresentButton, createPresenter } from "./presenter.js";
export { createReviewPanel } from "./review-panel.js";
export { createFindPanel, installFindShortcuts } from "./find-panel.js";
export { createDesignControls } from "./design-controls.js";
export { prepareDimensionSwitch } from "./switches.js";
export { mergeSlides, splitSlideByBlocks } from "./content-actions.js";
export { installCanvasVariableEditing } from "./canvas-variables.js";
export { createLayoutStudio } from "./workspace-layouts.js";
export { buildStudioShell, createStudio } from "./studio.js";
