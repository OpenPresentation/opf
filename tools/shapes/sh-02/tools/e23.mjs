export default [
  ['packages/javascript/src/color.ts', `  return colors.map(entry => {
    if (typeof entry !== 'string') return undefined;
    const resolved = resolveColorRef(entry.trim(), { colorScheme, roles: context.roles, variables: context.variables, fallback: '' });
    return normalizeHexColor(resolved);
  });`, `  return colors.map(entry => {
    // SH-02: the lighter or darker form of a ColorRef resolves its base and applies its transform.
    const transform = colorTransform(entry);
    if (transform) { const base = resolveChartColors([transform.color], colorScheme, context)[0]; return base === undefined ? undefined : normalizeHexColor(applyColorTransform(base, transform)); }
    if (typeof entry !== 'string') return undefined;
    const resolved = resolveColorRef(entry.trim(), { colorScheme, roles: context.roles, variables: context.variables, fallback: '' });
    return normalizeHexColor(resolved);
  });`],
];
