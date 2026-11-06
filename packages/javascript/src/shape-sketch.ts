/**
 * SH-02: the sketched line of `stroke.sketch` (PowerPoint's Sketched line, `ask:lineSketchStyleProps`). PowerPoint does not compute a
 * sketch when it opens a file: it draws the line along the outline stored in the extension. OPF computes that outline here,
 * deterministically from a seed (the extension's `sd`), and both engines draw the same one: the preview strokes it and the PPTX stores it,
 * so PowerPoint draws exactly what the preview draws.
 *
 * The wobble is OPF's own, made to look like PowerPoint's three styles: `curved` bows each side gently, `freehand` wavers along it with
 * corners kept, and `scribble` draws freehand twice, each pass a little different and running past the corners.
 */

export type SketchStyle = 'curved' | 'freehand' | 'scribble';
type Point = [number, number];

/** A stable seed for `text` (FNV-1a), below 2^31 as PowerPoint writes `sd`. */
export function sketchSeed(text: string): number {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619) >>> 0;
  return hash % 2147483647;
}

/** mulberry32: a small deterministic random stream in [0, 1). */
function stream(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Absolute SVG path data (M, L, H, V, C, Q, A, Z, as core writes outlines) flattened to polylines, each with whether it closes; undefined
 * for anything else (relative commands).
 */
function polylines(d: string): { points: Point[]; closed: boolean }[] | undefined {
  const tokens = d.match(/[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) ?? [];
  const lines: { points: Point[]; closed: boolean }[] = [];
  let line: Point[] = [], at = 0, command = '', x = 0, y = 0;
  const read = () => Number(tokens[at++]);
  const push = (px: number, py: number) => { line.push([px, py]); x = px; y = py; };
  while (at < tokens.length) {
    if (/^[A-Za-z]$/.test(tokens[at]!)) command = tokens[at++]!;
    if (!/^[MLHVCQAZ]$/.test(command)) return undefined;
    if (command === 'Z') {
      if (line.length > 1) lines.push({ points: line, closed: true });
      const first = line[0];
      line = [];
      if (first) { x = first[0]; y = first[1]; }
      continue;
    }
    if (command === 'M') { if (line.length > 1) lines.push({ points: line, closed: false }); line = []; push(read(), read()); command = 'L'; continue; }
    if (command === 'L') { push(read(), read()); continue; }
    if (command === 'H') { push(read(), y); continue; }
    if (command === 'V') { push(x, read()); continue; }
    if (command === 'C' || command === 'Q') {
      const c = command === 'C' ? [read(), read(), read(), read(), read(), read()] : [read(), read(), read(), read()];
      const x0 = x, y0 = y;
      for (let step = 1; step <= 16; step++) {
        const t = step / 16, u = 1 - t;
        if (command === 'C') push(u * u * u * x0 + 3 * u * u * t * c[0]! + 3 * u * t * t * c[2]! + t * t * t * c[4]!, u * u * u * y0 + 3 * u * u * t * c[1]! + 3 * u * t * t * c[3]! + t * t * t * c[5]!);
        else push(u * u * x0 + 2 * u * t * c[0]! + t * t * c[2]!, u * u * y0 + 2 * u * t * c[1]! + t * t * c[3]!);
      }
      continue;
    }
    // A: the endpoint arc as its center parameterization (SVG 1.1 F.6.5), sampled every 1/16 of a quarter turn.
    const [rx0, ry0, rotation, large, sweep, ex, ey] = [read(), read(), read(), read(), read(), read(), read()] as number[];
    let rx = Math.abs(rx0!), ry = Math.abs(ry0!);
    if (!rx || !ry) { push(ex!, ey!); continue; }
    const phi = rotation! * Math.PI / 180, cos = Math.cos(phi), sin = Math.sin(phi);
    const dx = (x - ex!) / 2, dy = (y - ey!) / 2, x1 = cos * dx + sin * dy, y1 = -sin * dx + cos * dy;
    const lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
    if (lambda > 1) { rx *= Math.sqrt(lambda); ry *= Math.sqrt(lambda); }
    const sign = large === sweep ? -1 : 1, num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
    const k = sign * Math.sqrt(Math.max(0, num / (rx * rx * y1 * y1 + ry * ry * x1 * x1)));
    const cx1 = k * rx * y1 / ry, cy1 = -k * ry * x1 / rx;
    const cx = cos * cx1 - sin * cy1 + (x + ex!) / 2, cy = sin * cx1 + cos * cy1 + (y + ey!) / 2;
    const angle = (ux: number, uy: number, vx: number, vy: number) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    const start = angle(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry);
    let delta = angle((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry);
    if (!sweep && delta > 0) delta -= 2 * Math.PI;
    if (sweep && delta < 0) delta += 2 * Math.PI;
    const steps = Math.max(4, Math.ceil(Math.abs(delta) / (Math.PI / 32)));
    for (let step = 1; step <= steps; step++) {
      const t = start + delta * step / steps, px = rx * Math.cos(t), py = ry * Math.sin(t);
      push(step === steps ? ex! : cos * px - sin * py + cx, step === steps ? ey! : sin * px + cos * py + cy);
    }
  }
  if (line.length > 1) lines.push({ points: line, closed: false });
  return lines;
}

const STYLE = {
  // spacing between wobble points (px), side bow (fraction of the side, capped), wave amplitude (px), jitter (px), corner overshoot (px)
  curved: { spacing: 48, bow: 0.012, wave: 1.1, jitter: 0, overshoot: 0 },
  freehand: { spacing: 14, bow: 0.006, wave: 1.2, jitter: 0.45, overshoot: 0 },
  scribble: { spacing: 14, bow: 0.01, wave: 1.8, jitter: 0.6, overshoot: 3 },
} as const;

/**
 * The sketch of an outline `d` (absolute path data in slide pixels) in `style` from `seed`, as path data of cubic curves: `outline`, one
 * continuous wobbly pass along each subpath (closed where it closes), which is also what the fill fills, and `line`, what the line
 * strokes (the outline, and for scribble a second pass of strokes that run past the corners). `scale` is the canvas scale (wobble sizes
 * are in reference pixels). Undefined when `d` cannot be read.
 */
export function sketchPathData(d: string, seed: number, style: SketchStyle, scale = 1): { outline: string; line: string } | undefined {
  const lines = polylines(d);
  if (!lines?.length) return undefined;
  const random = stream(seed), spec = STYLE[style];
  const outline: string[] = [], extra: string[] = [];
  const number = (value: number) => String(Math.round(value * 100) / 100);
  for (const { points: raw, closed } of lines) {
    const points = raw.filter((point, index) => index === 0 || Math.hypot(point[0] - raw[index - 1]![0], point[1] - raw[index - 1]![1]) > 1e-6);
    if (closed && points.length > 2 && Math.hypot(points[0]![0] - points.at(-1)![0], points[0]![1] - points.at(-1)![1]) < 1e-6) points.pop();
    if (points.length < 2) continue;
    // Corners: where the line turns by more than 35 degrees (and an open line's ends). A side runs from one corner to the next.
    const count = points.length;
    const turn = (index: number) => {
      const p = points[(index - 1 + count) % count]!, q = points[index]!, r = points[(index + 1) % count]!;
      const u = Math.atan2(q[1] - p[1], q[0] - p[0]), v = Math.atan2(r[1] - q[1], r[0] - q[0]);
      return Math.abs(Math.atan2(Math.sin(v - u), Math.cos(v - u)));
    };
    const corners = points.map((_, index) => closed || (index > 0 && index < count - 1) ? turn(index) > 35 * Math.PI / 180 : true).flatMap((corner, index) => corner ? [index] : []);
    const sides: Point[][] = [];
    if (!corners.length) sides.push([...points, points[0]!]);
    else {
      const first = corners[0]!, ordered = closed ? [...points.slice(first), ...points.slice(0, first), points[first]!] : points;
      const marks = closed ? [...corners.map(index => index - first), count] : corners;
      for (let index = 0; index + 1 < marks.length; index++) sides.push(ordered.slice(marks[index]!, marks[index + 1]! + 1));
    }
    // The first pass: one continuous line through the sides (each side's first point is the previous side's last).
    const all: Point[] = [];
    sides.map(side => wobble(side, spec, random, scale, 0)).forEach((side, index) => all.push(...(index ? side.slice(1) : side)));
    const smooth = closed && !corners.length;
    outline.push(curveThrough(smooth ? all.slice(0, -1) : all, smooth, number) + (closed ? 'Z' : ''));
    // Scribble's second pass: each side its own stroke, running past its corners.
    if (spec.overshoot > 0) for (const side of sides) extra.push(curveThrough(wobble(side, spec, random, scale, 1), false, number));
  }
  if (!outline.length) return undefined;
  return { outline: outline.join(''), line: outline.join('') + extra.join('') };
}

/** A side's points, resampled every `spacing` and moved across the side by a bow, a slow wave and a little jitter. */
function wobble(side: Point[], spec: (typeof STYLE)[SketchStyle], random: () => number, scale: number, pass: number): Point[] {
  const lengths = [0];
  for (let index = 1; index < side.length; index++) lengths.push(lengths[index - 1]! + Math.hypot(side[index]![0] - side[index - 1]![0], side[index]![1] - side[index - 1]![1]));
  const total = lengths.at(-1)!;
  if (total < 1e-6) return side;
  const samples = Math.max(2, Math.round(total / (spec.spacing * scale)));
  const bow = Math.min(spec.bow * total, 4 * scale) * (random() * 2 - 1), phase = random() * Math.PI * 2, waves = Math.max(0.5, total / (90 * scale)) * (0.8 + random() * 0.4);
  const over = pass ? spec.overshoot * scale : 0;
  const at = (distance: number): [Point, Point] => {
    const clamped = Math.min(total, Math.max(0, distance));
    let index = 1;
    while (index < side.length - 1 && lengths[index]! < clamped) index++;
    const a = side[index - 1]!, b = side[index]!, span = lengths[index]! - lengths[index - 1]! || 1, t = (clamped - lengths[index - 1]!) / span;
    const tangent: Point = [(b[0] - a[0]) / span, (b[1] - a[1]) / span];
    return [[a[0] + (b[0] - a[0]) * t + tangent[0] * (distance - clamped), a[1] + (b[1] - a[1]) * t + tangent[1] * (distance - clamped)], tangent];
  };
  const result: Point[] = [];
  for (let step = 0; step <= samples; step++) {
    const s = step / samples, [point, tangent] = at(-over + (total + 2 * over) * s);
    const ends = pass ? 1 : Math.sin(Math.PI * s);
    const offset = bow * Math.sin(Math.PI * s) + spec.wave * scale * Math.sin(phase + waves * Math.PI * 2 * s) * ends + spec.jitter * scale * (random() * 2 - 1) * (step === 0 || step === samples ? 0.5 : 1);
    result.push([point[0] - tangent[1] * offset, point[1] + tangent[0] * offset]);
  }
  return result;
}

/** Path data of a Catmull-Rom curve through `points` as cubic Bézier segments (closing back to the first point when `closed`). */
function curveThrough(points: Point[], closed: boolean, number: (value: number) => string): string {
  const count = points.length, get = (index: number) => closed ? points[(index + count) % count]! : points[Math.min(count - 1, Math.max(0, index))]!;
  let d = `M${number(points[0]![0])} ${number(points[0]![1])}`;
  for (let index = 0; index < (closed ? count : count - 1); index++) {
    const p0 = get(index - 1), p1 = get(index), p2 = get(index + 1), p3 = get(index + 2);
    d += `C${number(p1[0] + (p2[0] - p0[0]) / 6)} ${number(p1[1] + (p2[1] - p0[1]) / 6)} ${number(p2[0] - (p3[0] - p1[0]) / 6)} ${number(p2[1] - (p3[1] - p1[1]) / 6)} ${number(p2[0])} ${number(p2[1])}`;
  }
  return d;
}
