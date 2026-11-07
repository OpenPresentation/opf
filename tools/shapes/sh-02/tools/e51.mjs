const S = 'packages/javascript/src/shape-block.ts';
export default [
  [S, `const union = EXP_UNION ? [starOutline(filled.length > 1 ? filled : filled, center)`, `const firstFilled = flat[geometry.paths.findIndex(path => path.fill !== 'none')]!;
    const union = EXP_UNION ? [starOutline(filled.length > 1 ? filled : filled, center)`],
  [S, `    geometry.paths.forEach((path, index) => { if (path.fill !== 'none') paths[index]!.gradientOutline = union ?? [`, `    const first = (globalThis as any).process?.env?.OPF_EXP === 'first' ? [starOutline(firstFilled, center).map(([x, y]) => [round(x), round(y)] as [number, number])] : undefined;
    geometry.paths.forEach((path, index) => { if (path.fill !== 'none') paths[index]!.gradientOutline = first ?? union ?? [`],
];
