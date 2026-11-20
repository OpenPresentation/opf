/** The shape geometry module (`@openpresentation/opf/shape-geometry`), or undefined until `loadShapeEngine()` has resolved. */
export declare function shapeEngine(): typeof import("@openpresentation/opf/shape-geometry") | undefined;
/** Load the preset geometry (once). */
export declare function loadShapeEngine(): Promise<typeof import("@openpresentation/opf/shape-geometry")>;
