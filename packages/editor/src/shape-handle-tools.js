// What the canvas's adjust handles need, loaded together the first time a preset shape is selected (SH-06): the preset geometry, the handle math and
// the shape commands. `shape-handles.js` imports this on demand, so a host that never selects a shape never loads the geometry.
export { loadShapeEngine, shapeEngine } from "./shape-engine.js";
export { effectiveAdjust, handleLayout, keyTarget, solveHandle, toLocal, toSlide } from "./shape-handle-math.js";
export { prepareShapeProperties, setShapeAdjust } from "./shape-options.js";
