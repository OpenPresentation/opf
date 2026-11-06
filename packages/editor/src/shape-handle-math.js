// The geometry of the adjust handles (SH-06): where a preset's handles are on the slide, and which adjust values put a handle under the pointer.
// Pure functions of the preset geometry (`presetGeometry(...).handles` of `@openpresentation/opf/shape-geometry`, passed in as `engine`), so they run
// in Node as in a browser and a test can drive every one of the 187 presets.
//
// A handle moves one or two adjust values (its axes: `horizontal`, `vertical`, `radius`, `angle`) and its position is a function of those values
// that the preset's guides define. Rather than invert each guide, the solver searches: for each axis in turn it scans the axis's range for the value
// whose handle position is nearest the target, then refines it, and repeats once for a two-axis handle. A preset's geometry evaluates in about 50
// microseconds, so a drag costs a few milliseconds a move. Ranges are the handle's own (`min`, `max`), which depend on the frame; an unbounded axis
// (a callout's tail) searches a window around its value that grows while the best value sits at its edge.

const GOLDEN = (Math.sqrt(5) - 1) / 2;
const ROLES = ["horizontal", "vertical", "radius", "angle"];

/** The axes of a handle: `{ role, adjust, min, max }` for each of `horizontal`, `vertical`, `radius` and `angle` the handle moves. */
export function handleAxes(handle) {
  return ROLES.flatMap((role) => (handle[role] ? [{ role, adjust: handle[role].adjust, min: handle[role].min, max: handle[role].max }] : []));
}

/**
 * A frame is `{ x, y, width, height, rotate?, flipH?, flipV? }` in slide coordinates, as composition reports a shape (`ComposedShape.box`,
 * `rotate`, `flipH`, `flipV`). A shape is mirrored first and rotated clockwise about its center after, as the preview draws it.
 * `toSlide` maps a point of the unrotated, unmirrored geometry (0 to width, 0 to height) onto the slide, `toLocal` maps back.
 */
export function toSlide(point, frame) {
  let { x, y } = point;
  if (frame.flipH) x = frame.width - x;
  if (frame.flipV) y = frame.height - y;
  const cx = frame.width / 2;
  const cy = frame.height / 2;
  const turn = ((frame.rotate ?? 0) * Math.PI) / 180;
  const dx = x - cx;
  const dy = y - cy;
  return { x: frame.x + cx + dx * Math.cos(turn) - dy * Math.sin(turn), y: frame.y + cy + dx * Math.sin(turn) + dy * Math.cos(turn) };
}

export function toLocal(point, frame) {
  const cx = frame.width / 2;
  const cy = frame.height / 2;
  const turn = (-(frame.rotate ?? 0) * Math.PI) / 180;
  const dx = point.x - frame.x - cx;
  const dy = point.y - frame.y - cy;
  let x = cx + dx * Math.cos(turn) - dy * Math.sin(turn);
  let y = cy + dx * Math.sin(turn) + dy * Math.cos(turn);
  if (frame.flipH) x = frame.width - x;
  if (frame.flipV) y = frame.height - y;
  return { x, y };
}

/** The handles of a preset in a frame with the block's adjust values: `[{ index, local, slide, axes, kind }]`, positions in the geometry's own units and on the slide. */
export function handleLayout(engine, preset, frame, adjust) {
  const geometry = engine.presetGeometry(preset, frame.width, frame.height, adjust);
  return geometry.handles.map((handle, index) => ({
    index,
    kind: handle.kind,
    local: { x: handle.x, y: handle.y },
    slide: toSlide({ x: handle.x, y: handle.y }, frame),
    axes: handleAxes(handle),
  }));
}

const places = (unit) => (unit === "degrees" ? 2 : 4);
const round = (value, count) => Math.round(value * 10 ** count) / 10 ** count;

/** The smallest of `f` over `[lo, hi]`: a scan, then a golden-section search in the best cell. */
function minimize(f, lo, hi, scan = 36, iterations = 22) {
  const step = (hi - lo) / scan;
  let best = lo;
  let bestValue = Infinity;
  for (let i = 0; i <= scan; i += 1) {
    const x = lo + i * step;
    const value = f(x);
    if (value < bestValue) {
      bestValue = value;
      best = x;
    }
  }
  let a = Math.max(lo, best - step);
  let b = Math.min(hi, best + step);
  let c = b - GOLDEN * (b - a);
  let d = a + GOLDEN * (b - a);
  let fc = f(c);
  let fd = f(d);
  for (let i = 0; i < iterations; i += 1) {
    if (fc < fd) {
      b = d;
      d = c;
      fd = fc;
      c = b - GOLDEN * (b - a);
      fc = f(c);
    } else {
      a = c;
      c = d;
      fc = fd;
      d = a + GOLDEN * (b - a);
      fd = f(d);
    }
  }
  const refined = (a + b) / 2;
  return f(refined) <= bestValue ? refined : best;
}

/** The adjust values in effect for a block: its own, else the preset's defaults (`{ name: value }`), and each value's `unit`. */
export function effectiveAdjust(engine, preset, size, adjust = {}) {
  const known = engine.presetAdjustments(preset, size.width, size.height);
  return Object.fromEntries(Object.entries(known).map(([name, spec]) => [name, { value: typeof adjust[name] === "number" ? adjust[name] : spec.default, unit: spec.unit }]));
}

/**
 * The adjust values that put handle `index` of `preset` nearest `target` (a point of the unrotated, unmirrored geometry, see `toLocal`) in a frame of
 * `size` with the block's own `adjust` values. Returns `{ values, position, distance }`: `values` has one number for each axis of the handle, in OPF
 * units (fractions to 4 places, degrees to 2), kept inside the handle's range; `position` is where the handle then is; `distance` how far from the target.
 * A handle of two axes first descends from the values it has (one axis at a time, which settles most of them in one pass); when that stops short of the
 * target it scans the two axes' ranges as a grid and descends again from the best cell, so a handle that goes round (an arc's end, a ring's width and
 * angle) is found wherever the pointer is.
 */
export function solveHandle(engine, preset, size, adjust, index, target) {
  const base = engine.presetGeometry(preset, size.width, size.height, adjust);
  const handle = base.handles[index];
  if (!handle) return undefined;
  const axes = handleAxes(handle);
  const known = engine.presetAdjustments(preset, size.width, size.height);
  const at = (candidate) => engine.presetGeometry(preset, size.width, size.height, { ...adjust, ...candidate }).handles[index];
  const cost = (candidate) => {
    const where = at(candidate);
    return (where.x - target.x) ** 2 + (where.y - target.y) ** 2;
  };
  // A handle's range, widened to hold the preset's default: a few presets (star24, star32, mathDivide) report a range that leaves their own default out,
  // and a drag must not snap the value away from it.
  const bounds = (axis) => {
    const fallback = known[axis.adjust]?.default;
    return {
      min: axis.min === null ? null : Math.min(axis.min, fallback ?? axis.min),
      max: axis.max === null ? null : Math.max(axis.max, fallback ?? axis.max),
    };
  };
  const clamp = (axis, value) => {
    const range = bounds(axis);
    return Math.min(range.max ?? Infinity, Math.max(range.min ?? -Infinity, value));
  };
  const current = Object.fromEntries(axes.map((axis) => [axis.adjust, typeof adjust?.[axis.adjust] === "number" ? adjust[axis.adjust] : (known[axis.adjust]?.default ?? 0)]));

  const descend = (from) => {
    const values = { ...from };
    for (let pass = 0; pass < (axes.length > 1 ? 2 : 1); pass += 1) {
      for (const axis of axes) {
        const here = values[axis.adjust];
        const f = (value) => cost({ ...values, [axis.adjust]: value });
        const range = bounds(axis);
        let lo = range.min ?? here - 3;
        let hi = range.max ?? here + 3;
        let found = minimize(f, lo, hi);
        // An unbounded axis (a callout's tail) widens its window while the best value sits at an edge of it.
        for (let widen = 0; widen < 3 && (range.min === null || range.max === null); widen += 1) {
          const span = hi - lo;
          const nearLow = range.min === null && found - lo < span * 0.02;
          const nearHigh = range.max === null && hi - found < span * 0.02;
          if (!nearLow && !nearHigh) break;
          if (range.min === null) lo -= span * 2;
          if (range.max === null) hi += span * 2;
          found = minimize(f, lo, hi, 48);
        }
        // Never worse than where the axis already is.
        values[axis.adjust] = clamp(axis, f(found) <= f(here) ? found : here);
      }
    }
    return { values, cost: cost(values) };
  };

  let best = descend(current);
  if (axes.length > 1 && best.cost > 0.09) {
    // Scan both axes' ranges for the cell nearest the target, and descend from it.
    const GRID = 18;
    const span = (axis, from) => [bounds(axis).min ?? from - 3, bounds(axis).max ?? from + 3];
    const [first, second] = axes;
    const [lo1, hi1] = span(first, current[first.adjust]);
    const [lo2, hi2] = span(second, current[second.adjust]);
    let start = { values: current, cost: Infinity };
    for (let i = 0; i <= GRID; i += 1) {
      for (let j = 0; j <= GRID; j += 1) {
        const candidate = { ...current, [first.adjust]: lo1 + ((hi1 - lo1) * i) / GRID, [second.adjust]: lo2 + ((hi2 - lo2) * j) / GRID };
        const value = cost(candidate);
        if (value < start.cost) start = { values: candidate, cost: value };
      }
    }
    const again = descend(start.values);
    if (again.cost < best.cost) best = again;
  }
  const rounded = {};
  for (const axis of axes) rounded[axis.adjust] = clamp(axis, round(best.values[axis.adjust], places(known[axis.adjust]?.unit)));
  const position = at(rounded);
  return { values: rounded, position: { x: position.x, y: position.y }, distance: Math.hypot(position.x - target.x, position.y - target.y) };
}

/**
 * The target a key press moves a handle to: `step` geometry units along the key's direction (in the frame's own, unrotated axes) from where the
 * handle is. Feed it to `solveHandle`. Arrow keys only; anything else returns undefined.
 */
export function keyTarget(local, key, step) {
  const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[key];
  return delta ? { x: local.x + delta[0] * step, y: local.y + delta[1] * step } : undefined;
}
