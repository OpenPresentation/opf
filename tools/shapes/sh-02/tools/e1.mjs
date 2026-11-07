export default [
  ['packages/javascript/src/schema-check.ts',
    '  const colorRef = (entry: unknown, path: string): void => {\n    if (typeof entry !== "string" || !entry.startsWith("var:")) return;',
    '  const colorRef = (entry: unknown, path: string): void => {\n    // SH-02: the lighter or darker form names its base in `color`.\n    if (isRecord(entry) && entry.color !== undefined) { colorRef(entry.color, pathFor(path, "color")); return; }\n    if (typeof entry !== "string" || !entry.startsWith("var:")) return;'],
  ['packages/javascript/src/schema-check.ts',
    '  const runColor = (entry: unknown, path: string): void => {\n    if (typeof entry !== "string") return;',
    '  const runColor = (entry: unknown, path: string): void => {\n    if (isRecord(entry)) { colorRef(entry, path); return; }\n    if (typeof entry !== "string") return;'],
  ['packages/pptx/src/theme-colors.js',
    'const hex = hex6Of(resolve(value)), base = hex6Of(resolve(transform.color));',
    "const six = color => typeof color === 'string' ? hex6Of(color.trim().replace(/^#/, '').slice(0, 6)) : undefined;\n      const hex = six(resolve(value)), base = six(resolve(transform.color));"],
];
