// SH-02: the lazy build of the shape engine, the `browser`, `workerd`, `worker` and `edge-light` conditions of `#shape-engine`
// (package.json "imports"). SH-01's preset geometry (the evaluator and the table of the 187 presets, about 35 KB gzipped) is a module of its
// own that a bundler splits into a chunk, loaded the first time a deck has a shape block or a picture masked by a preset beyond the four
// built-in masks (rect, roundRect, ellipse, hexagon): `ensureShapes` loads it, as `ensureDiagrams` loads diagram types. A host that
// never draws a shape does not carry it. Until it is loaded, composition draws such a shape as loading (no outline) and reports nothing.
import type * as Geometry from './shape-geometry.js';

let loaded: typeof Geometry | undefined;
let loading: Promise<typeof Geometry> | undefined;

/** The loaded shape geometry module, or undefined until `loadShapeGeometry` has resolved. */
export const shapeGeometry = (): typeof Geometry | undefined => loaded;

/** Load the shape geometry once; later calls return the same promise. */
export function loadShapeGeometry(): Promise<typeof Geometry> {
  loading ??= import('./shape-geometry.js').then((module) => (loaded = module));
  return loading;
}
