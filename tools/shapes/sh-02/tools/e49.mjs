const S = 'packages/javascript/src/shape-block.ts';
export default [
  [S, `    geometry.paths.forEach((path, index) => { if (path.fill !== 'none') paths[index]!.gradientOutline = [starOutline(flat[index]!, center).map(([x, y]) => [round(x), round(y)] as [number, number])]; });`,
   `    const EXP_UNION = (globalThis as any).process?.env?.OPF_EXP === 'union';
    const filled = geometry.paths.flatMap((path, index) => path.fill !== 'none' ? flat[index]! : []);
    const union = EXP_UNION ? [starOutline(filled.length > 1 ? filled : filled, center).map(([x, y]) => [round(x), round(y)] as [number, number])] : undefined;
    geometry.paths.forEach((path, index) => { if (path.fill !== 'none') paths[index]!.gradientOutline = union ?? [starOutline(flat[index]!, center).map(([x, y]) => [round(x), round(y)] as [number, number])]; });`],
];
