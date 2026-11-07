const R = 'packages/render/src/shapes.js';
export default [
  [R, `    // Rectangle and shape gradients: their contours are the frame (rectangle) or the outline (shape) scaled about the frame's center, so
    // they are drawn exactly as a fan of triangles from the center, each a linear gradient across it to its edge.
    const outline = fill.gradient.type === "rectangle" ? [[[box.x, box.y], [box.x + box.width, box.y], [box.x + box.width, box.y + box.height], [box.x, box.y + box.height]]]
      : fill.gradient.type === "shape" && shape?.shapeGradient === "outline" ? path?.gradientOutline : undefined;
    if (outline) return { fan: fanElements(fill.gradient, outline, id, box, helpers, mode, alpha) };
    // A shape gradient PowerPoint draws as its circle gradient (shape.shapeGradient circle).
    const gradient = fill.gradient.type === "shape" ? { ...fill.gradient, type: "radial" } : fill.gradient;
    return { fill: \`url(#\${id})\`, defs: gradientDef(gradient, id, box, helpers, mode, alpha) };`,
  `    // Every gradient spans the bounds of the shape's outline (core gradientBox; the frame for most presets). Rectangle and shape gradients:
    // their contours are those bounds (rectangle) or the outline (shape) scaled about the bounds' center, so they are drawn exactly as a
    // fan of triangles from the center, each a linear gradient across it to its edge.
    const span = shape?.gradientBox ?? box;
    const outline = fill.gradient.type === "rectangle" ? [[[span.x, span.y], [span.x + span.width, span.y], [span.x + span.width, span.y + span.height], [span.x, span.y + span.height]]]
      : fill.gradient.type === "shape" && shape?.shapeGradient === "outline" ? path?.gradientOutline : undefined;
    if (outline) return { fan: fanElements(fill.gradient, outline, id, span, helpers, mode, alpha) };
    // A shape gradient PowerPoint draws as its circle gradient (shape.shapeGradient circle).
    const gradient = fill.gradient.type === "shape" ? { ...fill.gradient, type: "radial" } : fill.gradient;
    return { fill: \`url(#\${id})\`, defs: gradientDef(gradient, id, span, helpers, mode, alpha) };`],
];
