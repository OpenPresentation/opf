// SH-02: the contour outline of a shape gradient (PowerPoint's a:path shape), loaded with the preset geometry (#shape-engine): only a
// shape with a shape gradient needs it.

/**
 * A polygon star-shaped about `center` whose scaled copies are a shape gradient's contours for the outline `rings`: the outline itself
 * when it is one ring that every ray from the center crosses once, otherwise its radial envelope (on each ray, the outline's farthest
 * point), sampled at every vertex's direction and every half degree. A point's place in the gradient is the least scale of the outline
 * about the center that still contains it, which is its distance over the envelope's along its ray.
 */
export function starOutline(rings: [number, number][][], center: [number, number]): [number, number][] {
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
