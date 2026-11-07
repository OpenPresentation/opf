const S = 'packages/javascript/src/shape-block.ts';
export default [
  [S, `  /**
   * For a filled path of a shape whose \`shapeGradient\` is \`outline\`: the path flattened to polygons in slide coordinates. The gradient's
   * contours are these polygons scaled about the frame's center.
   */
  gradientOutline?: [number, number][][];`, `  /**
   * For a filled path of a shape whose \`shapeGradient\` is \`outline\`: one polygon in slide coordinates, star-shaped about the center of
   * \`gradientBox\`, whose copies scaled about that center are the gradient's contours (the path itself when it is star-shaped from the
   * center, otherwise its radial envelope: along each ray from the center the farthest point of the outline).
   */
  gradientOutline?: [number, number][][];`],
  [S, `  /**
   * How a \`shape\` gradient fill is drawn, as PowerPoint draws it: \`outline\`, contours that are the outline scaled about the frame's center
   * (each filled path's \`gradientOutline\`), or \`circle\`, PowerPoint's circle gradient (some presets and every custom path).
   */
  shapeGradient?: 'outline' | 'circle';`, `  /**
   * For a gradient fill: the box the gradient spans, the bounds of the shape's whole outline in slide coordinates (PowerPoint lays a
   * gradient across the geometry's bounds, which for most presets are the frame and for \`arc\`, \`blockArc\` and the like are smaller).
   */
  gradientBox?: Box;
  /**
   * How a \`shape\` gradient fill is drawn, as PowerPoint draws it: \`outline\`, contours that are the outline scaled about the center of
   * \`gradientBox\` (each filled path's \`gradientOutline\`), or \`circle\`, PowerPoint's circle gradient (some presets and every custom path).
   */
  shapeGradient?: 'outline' | 'circle';`],
  [S, `  // A shape gradient's contours are the outline scaled about the frame's center: the engines fill each filled path with a fan of triangles
  // from the center to the edges of that path (flattened), as PowerPoint shades each sub-path along its own outline. PowerPoint draws some presets' and every custom path's shape gradient as its
  // circle gradient instead (CIRCLE_SHAPE_GRADIENTS, measured on PowerPoint 365); the engines draw what PowerPoint draws.
  const fillSpec = record(host.fill ?? {}).gradient;
  const outlineGradient = record(fillSpec).type === 'shape' && engine ? (!preset || CIRCLE_SHAPE_GRADIENTS.has(preset) ? 'circle' as const : 'outline' as const) : undefined;
  const flatten = (path: ShapePath) => engine!.flattenShapePath(path.commands, 16).map(ring => ring.map(point => [round(box.x + point.x), round(box.y + point.y)] as [number, number]));
  if (outlineGradient === 'outline') geometry.paths.forEach((path, index) => { if (path.fill !== 'none') paths[index]!.gradientOutline = flatten(path); });`,
  `  // A gradient spans the bounds of the whole outline (gradientBox). A shape gradient's contours are each filled path's outline scaled about
  // the center of those bounds: the engines fill the path with a fan of triangles from that center to the edges of its gradientOutline.
  // PowerPoint draws some presets' and every custom path's shape gradient as its circle gradient instead (CIRCLE_SHAPE_GRADIENTS, measured
  // on PowerPoint 365); the engines draw what PowerPoint draws.
  const fillSpec = record(host.fill ?? {}).gradient;
  const gradientType = record(fillSpec).type;
  const outlineGradient = gradientType === 'shape' && engine ? (!preset || CIRCLE_SHAPE_GRADIENTS.has(preset) ? 'circle' as const : 'outline' as const) : undefined;
  const flat = fillSpec !== undefined && engine ? geometry.paths.map(path => engine.flattenShapePath(path.commands, 16).map(ring => ring.map(point => [box.x + point.x, box.y + point.y] as [number, number]))) : undefined;
  const gradientBox = flat ? boundsOf(flat.flat(2)) : undefined;
  if (outlineGradient === 'outline' && flat && gradientBox) {
    const center: [number, number] = [gradientBox.x + gradientBox.width / 2, gradientBox.y + gradientBox.height / 2];
    geometry.paths.forEach((path, index) => { if (path.fill !== 'none') paths[index]!.gradientOutline = [starOutline(flat[index]!, center).map(([x, y]) => [round(x), round(y)] as [number, number])]; });
  }`],
  [S, `...(outlineGradient ? { shapeGradient: outlineGradient } : {}), `, `...(gradientBox ? { gradientBox } : {}), ...(outlineGradient ? { shapeGradient: outlineGradient } : {}), `],
  [S, `/** The default frame aspect (width / height) of a preset:`, `/** The bounds of points, rounded. */
function boundsOf(points: [number, number][]): Box | undefined {
  if (!points.length) return undefined;
  const xs = points.map(point => point[0]), ys = points.map(point => point[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x: round(x), y: round(y), width: round(Math.max(...xs) - x), height: round(Math.max(...ys) - y) };
}

/**
 * A polygon star-shaped about \`center\` whose scaled copies are a shape gradient's contours for the outline \`rings\`: the outline itself
 * when it is one ring that every ray from the center crosses once, otherwise its radial envelope (on each ray, the outline's farthest
 * point), sampled at every vertex's direction and every half degree. A point's place in the gradient is the least scale of the outline
 * about the center that still contains it, which is its distance over the envelope's along its ray.
 */
function starOutline(rings: [number, number][][], center: [number, number]): [number, number][] {
  const [cx, cy] = center;
  const edges: [number, number, number, number][] = [];
  for (const ring of rings) for (let at = 0; at < ring.length; at++) {
    const [px, py] = ring[at]!, [qx, qy] = ring[(at + 1) % ring.length]!;
    if (px !== qx || py !== qy) edges.push([px, py, qx, qy]);
  }
  if (rings.length === 1) {
    const turns = edges.map(([px, py, qx, qy]) => (px - cx) * (qy - py) - (py - cy) * (qx - px));
    if (turns.every(turn => turn >= -1e-9) || turns.every(turn => turn <= 1e-9)) return rings[0]!;
  }
  const angles = new Set<number>();
  for (const [px, py] of edges) angles.add(Math.atan2(py - cy, px - cx));
  for (let step = 0; step < 720; step++) angles.add(-Math.PI + step * Math.PI / 360);
  return [...angles].sort((a, b) => a - b).map(angle => {
    const dx = Math.cos(angle), dy = Math.sin(angle);
    let far = 0;
    for (const [px, py, qx, qy] of edges) {
      const ex = qx - px, ey = qy - py, denominator = dx * ey - dy * ex;
      if (Math.abs(denominator) < 1e-12) continue;
      const t = ((px - cx) * ey - (py - cy) * ex) / denominator, u = ((px - cx) * dy - (py - cy) * dx) / denominator;
      if (t > far && u >= -1e-9 && u <= 1 + 1e-9) far = t;
    }
    return [cx + dx * far, cy + dy * far] as [number, number];
  });
}

/** The default frame aspect (width / height) of a preset:`],
];
