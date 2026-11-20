// SH-02: what `#shape-engine` loads: SH-01's preset geometry, the sketched line (shape-sketch.ts) and the shape gradient's outline
// (shape-gradient.ts), in one module, so a browser or edge bundle loads them in one chunk the first time a deck has a shape, a masked
// picture or a sketched picture line (shapesPending).
export * from './shape-geometry.js';
export { sketchPathData, sketchSeed } from './shape-sketch.js';
export { starOutline } from './shape-gradient.js';
