const P = 'packages/pptx/src/index.js';
export default [
  [P, `  const table = deck.slideSchemeColors?.[slideIndex]?.table;
  if (table) addTransformedColors(table, reference => exportColor(reference, context, '000000'), shape.fill, shape.stroke, shape.styleRef, shape.textColor, shape.textBackdrop);`,
  `  // The slide's table is built again with its context, so the shape's derived colors are kept apart and merged when the part is written.
  const table = deck.slideSchemeColors?.[slideIndex]?.table;
  if (table) {
    const own = deck.shapeSchemeColors.get(slideIndex) ?? new Map(), view = new Map([...table, ...own]);
    addTransformedColors(view, reference => exportColor(reference, context, '000000'), shape.fill, shape.stroke, shape.styleRef, shape.textColor, shape.textBackdrop);
    for (const [hex, entry] of view) if (!table.has(hex)) own.set(hex, entry);
    deck.shapeSchemeColors.set(slideIndex, own);
  }`],
  [P, `  context.shapeBlocks = new Map();`, `  context.shapeBlocks = new Map();
  context.shapeSchemeColors = new Map();`],
  [P, `      const entry = context.slideSchemeColors[context.partSlides.get(path) ?? context.styleSlides.get(path)];
      if (entry) xml = writeSchemeColors(xml, entry.table, entry.keep);`, `      const index = context.partSlides.get(path) ?? context.styleSlides.get(path), entry = context.slideSchemeColors[index];
      // SH-02: with the derived colors of the slide's shape styles (addShapeItem).
      const shapeColors = context.shapeSchemeColors.get(index);
      if (entry) xml = writeSchemeColors(xml, shapeColors?.size ? new Map([...entry.table, ...[...shapeColors].filter(([hex]) => !entry.table.has(hex))]) : entry.table, entry.keep);`],
];
