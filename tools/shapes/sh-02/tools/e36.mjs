const P = 'packages/pptx/src/index.js';
const S = 'packages/javascript/src/shape-block.ts';
export default [
  [P, `    const scheme = typeof entry === 'string' ? schemeColorValue(entry, \`#\${hex}\`, context) : undefined;
    return { hex, alpha, ...(scheme ? {scheme} : {}) };`, `    // A slot the slide's color map does not reach (dark1 on a dark variant's slide) is written by its own name (dk1), which PowerPoint
    // reads from the theme directly, where the deck theme holds exactly that color.
    const slot = typeof entry === 'string' && !context.schemeOverride ? THEME_SLOT_VALUES[entry.trim()] : undefined;
    const scheme = typeof entry === 'string' ? schemeColorValue(entry, \`#\${hex}\`, context) ?? (slot && normalizeHex(context.themeColors?.[entry.trim()] ?? '') === hex && normalizeHex(themeSlotColors(context.colorScheme)[entry.trim()] ?? '') === hex ? slot : undefined) : undefined;
    return { hex, alpha, ...(scheme ? {scheme} : {}) };`],
  [P, `// SH-02: a ColorRef as a shape's or picture line's DrawingML color:`, `const THEME_SLOT_VALUES = Object.freeze({dark1: 'dk1', light1: 'lt1', dark2: 'dk2', light2: 'lt2'});
// SH-02: a ColorRef as a shape's or picture line's DrawingML color:`],
  [S, `    case 'subtle': return { fill: { color: 'accent1', lighten: 0.8 }, stroke: { color: 'accent1', width: SHAPE_STROKE_WIDTH }, text: 'dark1', bold: false,
      ref: { line: { idx: 2, color: 'accent1' }, fill: { idx: 1, color: { color: 'accent1', lighten: 0.8 } }, effect: { idx: 0, color: 'accent1' }, font: { idx: 'minor', color: 'dark1' } } };`, `    case 'subtle': return { fill: { color: 'accent1', lighten: 0.8 }, stroke: { color: 'accent1', width: SHAPE_STROKE_WIDTH }, text: 'text', bold: false,
      ref: { line: { idx: 2, color: 'accent1' }, fill: { idx: 1, color: { color: 'accent1', lighten: 0.8 } }, effect: { idx: 0, color: 'accent1' }, font: { idx: 'minor', color: 'text' } } };`],
];
