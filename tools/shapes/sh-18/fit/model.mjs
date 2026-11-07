// Prototype of core's Basic Cycle model, checked against the COM measurements.
export const CYCLE_DIAMETER = [890 / 1024, 818 / 2048, 774 / 2048, 570 / 2048, 538 / 2048, 890 / 4096, 830 / 4096, 723 / 4096];
export const CYCLE_RADIUS = [0, .30020853, .32775022, .29551553, .3352411, .32594411, .35059968, .34594921];
export const aspect = n => n === 2 ? 1.8 : 1.15;
export function cycle(frame, n) {
  const W = frame.width, d = CYCLE_DIAMETER[n - 1] * W, r = CYCLE_RADIUS[n - 1] * W;
  const cx = frame.x + W / 2, cy = frame.y + frame.height / 2 + (n % 2 && n > 1 ? r * (1 - Math.cos(Math.PI / n)) / 2 : 0);
  const angle = k => n === 2 ? (k ? Math.PI / 2 : -Math.PI / 2) : 2 * Math.PI * k / n;
  const centers = Array.from({ length: n }, (_, k) => n === 1 ? [cx, cy] : [cx + r * Math.sin(angle(k)), cy - r * Math.cos(angle(k))]);
  const nodes = centers.map(([x, y]) => ({ x: x - d / 2, y: y - d / 2, w: d, h: d }));
  const arrows = [];
  if (n === 2) {
    const L = .2491013 * W, off = .18876154 * W, t = .48825813;
    for (const k of [0, 1]) {
      const [px, py] = centers[k], sign = k ? -1 : 1, x = px + sign * t * 2 * r, y = py - sign * off;
      arrows.push({ x: x - L / 2, y: y - .3375 * d / 2, w: L, h: .3375 * d, rot: k ? 180 : 0 });
    }
  } else if (n > 2) for (let k = 0; k < n; k++) {
    const [px, py] = centers[k], [qx, qy] = centers[(k + 1) % n], len = Math.hypot(qx - px, qy - py), ux = (qx - px) / len, uy = (qy - py) / len;
    const gap = len - d, L = .53 * gap, along = d / 2 + .22 * gap + L / 2, x = px + ux * along, y = py + uy * along;
    let rot = Math.atan2(uy, ux) * 180 / Math.PI; if (rot < 0) rot += 360;
    arrows.push({ x: x - L / 2, y: y - .3375 * d / 2, w: L, h: .3375 * d, rot });
  }
  return { nodes, arrows };
}
