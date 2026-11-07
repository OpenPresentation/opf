export default [
  ['packages/javascript/src/core.ts', `export { diagramsPending, ensureDiagrams } from "./diagram.js";`, `export { diagramsPending, ensureDiagrams } from "./diagram.js";
// SH-02: and the preset geometry the first time a deck has a shape block or a picture mask beyond rect, roundRect, ellipse and hexagon.
export { ensureShapes, shapesPending } from "./shape-block.js";`],
  ['packages/editor/src/image-options.js', `import { PRESET_SHAPES } from "@openpresentation/opf/shape-geometry";`, `import { SHAPE_PRESETS } from "@openpresentation/opf/composition";`],
  ['packages/editor/src/image-options.js', `export const IMAGE_SHAPES = PRESET_SHAPES;`, `export const IMAGE_SHAPES = SHAPE_PRESETS;`],
  ['packages/pptx/src/index.js', `  await ensureDiagrams(presentation);
  // LH-14:`, `  await ensureDiagrams(presentation);
  // SH-02: and the preset geometry when the deck has shapes (a no-op in Node).
  await ensureShapes(presentation);
  // LH-14:`],
  ['packages/pptx/src/index.js', `diagramPalette, ensureDiagrams, ensureIcons,`, `diagramPalette, ensureDiagrams, ensureIcons, ensureShapes,`],
  ['packages/render/src/fonts-browser.js', `import { diagramsPending, ensureDiagrams, ensureIcons, iconsPending } from "@openpresentation/opf/composition";`, `import { diagramsPending, ensureDiagrams, ensureIcons, ensureShapes, iconsPending, shapesPending } from "@openpresentation/opf/composition";`],
  ['packages/render/src/fonts-browser.js', `    ...diagramsPending(presentation).map((type) => \`diagram:\${type}\`),`, `    ...diagramsPending(presentation).map((type) => \`diagram:\${type}\`),
    ...shapesPending(presentation),`],
  ['packages/render/src/fonts-browser.js', `      const diagrams = await ensureDiagrams(presentation);`, `      const diagrams = await ensureDiagrams(presentation);
      // SH-02: the preset geometry, the first time the deck has a shape (core loads it on demand in a browser).
      await ensureShapes(presentation);`],
  ['packages/mcp/src/server.ts', `			await ensureDiagrams(deck);
			// LH-14:`, `			await ensureDiagrams(deck);
			await ensureShapes(deck);
			// LH-14:`],
  ['packages/mcp/src/server.ts', `	const loaded = (await ensureDiagrams(first.presentation)).length +`, `	const loaded = (await ensureDiagrams(first.presentation)).length + (await ensureShapes(first.presentation)).length +`],
  ['packages/mcp/src/server.ts', `catalogKinds, ensureDiagrams, ensureIcons,`, `catalogKinds, ensureDiagrams, ensureIcons, ensureShapes,`],
];
