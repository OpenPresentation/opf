const S = 'packages/render/src/shapes.js';
export default [
  [S, `  if (fill.type === "gradient") return { fill: \`url(#\${id})\`, defs: gradientDef(fill.gradient, id, box, helpers, mode, alpha) };`,
    `  if (fill.type === "gradient") {
    // Rectangle and shape gradients: their contours are the frame (rectangle) or the outline (shape) scaled about the frame's center, so
    // they are drawn exactly as a fan of triangles from the center, each a linear gradient across it to its edge.
    const outline = fill.gradient.type === "rectangle" ? [[[box.x, box.y], [box.x + box.width, box.y], [box.x + box.width, box.y + box.height], [box.x, box.y + box.height]]]
      : fill.gradient.type === "shape" && shape?.shapeGradient === "outline" ? shape.gradientOutline : undefined;
    if (outline) return { fan: fanElements(fill.gradient, outline, id, box, helpers, mode, alpha) };
    // A shape gradient PowerPoint draws as its circle gradient (shape.shapeGradient circle).
    const gradient = fill.gradient.type === "shape" ? { ...fill.gradient, type: "radial" } : fill.gradient;
    return { fill: \`url(#\${id})\`, defs: gradientDef(gradient, id, box, helpers, mode, alpha) };
  }`],
  [S, `function fillPaint(fill, mode, id, box, helpers) {`, `/**
 * A fan of triangles from the frame's center to each edge of \`outline\` (polygons), each filled with a linear gradient from the center
 * (the first stop) to the edge's line (the last stop): within a triangle the contour lines are parallel to its edge, so together they are
 * the outline scaled about the center. Each triangle is widened a little so neighbors overlap without a seam (they agree where they meet).
 */
function fanElements(gradient, outline, id, box, helpers, mode, alpha) {
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2, defs = [], shapes = [];
  let index = 0;
  for (const ring of outline) {
    for (let at = 0; at < ring.length; at++) {
      const [px, py] = ring[at], [qx, qy] = ring[(at + 1) % ring.length];
      const ex = qx - px, ey = qy - py, length = Math.hypot(ex, ey);
      if (length < 1e-6) continue;
      // The foot of the perpendicular from the center to the edge's line: where the last stop is.
      const k = ((cx - px) * ex + (cy - py) * ey) / (length * length), fx = px + ex * k, fy = py + ey * k;
      if (Math.hypot(fx - cx, fy - cy) < 1e-6) continue;
      const gid = \`\${id}-fan-\${index++}\`;
      defs.push(helpers.tag("linearGradient", { id: gid, gradientUnits: "userSpaceOnUse", x1: number(cx), y1: number(cy), x2: number(fx), y2: number(fy) }, sampledStops(gradient, helpers, mode, alpha)));
      const ux = ex / length, uy = ey / length, grow = 0.75;
      const far = point => [cx + (point[0] - cx) * 1.03, cy + (point[1] - cy) * 1.03];
      const [ax, ay] = far([px - ux * grow, py - uy * grow]), [bx, by] = far([qx + ux * grow, qy + uy * grow]);
      shapes.push(helpers.tag("path", { d: \`M\${number(cx)} \${number(cy)}L\${number(ax)} \${number(ay)}L\${number(bx)} \${number(by)}Z\`, fill: \`url(#\${gid})\` }));
    }
  }
  return { defs: defs.join(""), body: shapes.join("") };
}

// The stops of a gradient sampled as PowerPoint mixes them (sampleStops), from offset 0 to 1.
function sampledStops(gradient, helpers, mode, alpha) {
  const offsets = [...new Set([...gradient.stops.map(entry => entry.position), ...Array.from({ length: GRADIENT_SAMPLES + 1 }, (_, index) => index / GRADIENT_SAMPLES)])].sort((a, b) => a - b);
  return offsets.map(offset => {
    const color = sampleStops(gradient.stops, offset, helpers);
    return helpers.tag("stop", { offset: precise(offset), "stop-color": shadeColor(color.color, mode), "stop-opacity": color.alpha * alpha < 1 ? precise(color.alpha * alpha) : undefined });
  }).join("");
}

function fillPaint(fill, mode, id, box, helpers, shape) {`],
  [S, `    const fill = fillPaint(shape.fill, path.fill, \`\${id}-fill-\${index}\`, box, helpers);
    if (fill.defs) defs.push(fill.defs);
    const closed = !path.open;`, `    const fill = fillPaint(shape.fill, path.fill, \`\${id}-fill-\${index}\`, box, helpers, shape);
    if (fill.defs) defs.push(fill.defs);
    const closed = !path.open;
    if (fill.fan) {
      // The fan is clipped to the path it fills.
      defs.push(fill.fan.defs, helpers.tag("clipPath", { id: \`\${id}-fill-\${index}-clip\` }, helpers.tag("path", { d: path.d })));
      parts.push(helpers.tag("g", { ...HIDDEN, "clip-path": \`url(#\${id}-fill-\${index}-clip)\` }, fill.fan.body));
    }`],
];
