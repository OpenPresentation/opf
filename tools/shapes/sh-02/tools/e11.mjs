const S = 'packages/javascript/src/shape-block.ts';
export default [
  [S, `  /** True when the path does not end with Z: arrowheads draw at its ends. */
  open: boolean;
}`, `  /** True when the path does not end with Z: arrowheads draw at its ends. */
  open: boolean;
  /** An open path's two ends in slide coordinates, each with the direction (degrees, clockwise from +x) a line leaves the path there. */
  ends?: { start: ShapeEnd; end: ShapeEnd };
}
/** One end of an open path: the point, and the outward direction of the line there in degrees (clockwise from the positive x axis). */
export interface ShapeEnd { x: number; y: number; angle: number }`],
  [S, `function pathIn(path: ShapePath, box: Box): ComposedShapePath {
  const last = path.commands[path.commands.length - 1];
  return { d: translatePathData(path.d, box.x, box.y), fill: path.fill, stroke: path.stroke, open: !last || last[0] !== 'Z' };
}`, `function pathIn(path: ShapePath, box: Box): ComposedShapePath {
  const last = path.commands[path.commands.length - 1];
  const open = !last || last[0] !== 'Z';
  const ends = open ? pathEnds(path.commands, box.x, box.y) : undefined;
  return { d: translatePathData(path.d, box.x, box.y), fill: path.fill, stroke: path.stroke, open, ...(ends ? { ends } : {}) };
}

/** The two ends of an open path and the outward direction at each (from the nearest distinct control point), moved by dx, dy. */
function pathEnds(commands: ShapePath['commands'], dx: number, dy: number): { start: ShapeEnd; end: ShapeEnd } | undefined {
  const points: [number, number][] = [];
  for (const command of commands) {
    if (command[0] === 'Z') return undefined;
    const values = command.slice(1) as number[];
    for (let index = 0; index + 1 < values.length; index += 2) points.push([values[index]!, values[index + 1]!]);
  }
  if (points.length < 2) return undefined;
  const same = (a: [number, number], b: [number, number]) => Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
  const first = points[0]!, next = points.find(point => !same(point, first)), lastPoint = points[points.length - 1]!, before = [...points].reverse().find(point => !same(point, lastPoint));
  if (!next || !before) return undefined;
  const angle = (from: [number, number], to: [number, number]) => round(Math.atan2(to[1] - from[1], to[0] - from[0]) * 180 / Math.PI);
  return { start: { x: round(first[0] + dx), y: round(first[1] + dy), angle: angle(next, first) }, end: { x: round(lastPoint[0] + dx), y: round(lastPoint[1] + dy), angle: angle(before, lastPoint) } };
}`],
];
