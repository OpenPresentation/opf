// The preset geometry of the shape tools (SH-06): `@openpresentation/opf/shape-geometry` is about 36 KB gzipped, so the editor loads it the first
// time a shape needs it (a picker thumbnail, an adjust handle, a range check) and never in a host that edits no shapes. `loadShapeEngine()`
// resolves with the module; `shapeEngine()` is the module once loaded (synchronous, undefined before), which the commands use to pin an
// adjust value to its handle's range. Plain JS with no DOM and no Node imports.
let loaded;
let pending;

/** The shape geometry module (`presetGeometry`, `presetAdjustments`, ...), or undefined until `loadShapeEngine()` has resolved. */
export const shapeEngine = () => loaded;

/** Load the preset geometry (once). Resolves with the module of `@openpresentation/opf/shape-geometry`. */
export function loadShapeEngine() {
  pending ??= import("@openpresentation/opf/shape-geometry").then((module) => (loaded = module));
  return pending;
}
