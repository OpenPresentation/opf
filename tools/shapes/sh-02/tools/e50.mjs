const S = 'packages/javascript/src/shape-block.ts';
export default [
  [S, `  const outlineGradient = gradientType === 'shape' && engine ? (!preset || CIRCLE_SHAPE_GRADIENTS.has(preset) ? 'circle' as const : 'outline' as const) : undefined;`,
   `  const EXP_MODE = (globalThis as any).process?.env?.OPF_EXP_MODE;
  const outlineGradient = gradientType === 'shape' && engine ? (EXP_MODE ? EXP_MODE as 'circle' : !preset || CIRCLE_SHAPE_GRADIENTS.has(preset) ? 'circle' as const : 'outline' as const) : undefined;`],
];
