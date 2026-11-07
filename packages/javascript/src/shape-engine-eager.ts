// SH-02: the eager build of the shape engine, the `default` condition of `#shape-engine` (package.json "imports"). Node, Bun and Deno
// load SH-01's preset geometry (the evaluator and its table of the 187 presets) with core, so composition draws any shape at once and
// nothing is ever pending.
import * as geometry from './shape-engine-module.js';

/** The loaded shape geometry module, or undefined while it loads (never, in this build). */
export const shapeGeometry = (): typeof geometry | undefined => geometry;

/** Load the shape geometry: already loaded here. */
export const loadShapeGeometry = async (): Promise<typeof geometry> => geometry;
