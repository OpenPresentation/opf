const B = 'packages/javascript/src/bind-regions.ts';
const L = 'packages/javascript/src/layout-template.ts';
export default [
  [B, `const FIELDS = ['text', 'items', 'bullets', 'image', 'video', 'chart', 'table', 'code', 'metric', 'quote', 'timeline', 'diagram'] as const;`,
    `const FIELDS = ['text', 'items', 'bullets', 'image', 'video', 'chart', 'table', 'code', 'metric', 'quote', 'timeline', 'diagram', 'shape', 'path'] as const;`],
  [B, `const FIELD_KINDS: Readonly<Record<string, RegionKind>> = { text: 'text', bullets: 'text', items: 'list', image: 'image', video: 'video', chart: 'chart', table: 'table', code: 'code', metric: 'metric', quote: 'quote',`,
    `const FIELD_KINDS: Readonly<Record<string, RegionKind>> = { text: 'text', bullets: 'text', items: 'list', image: 'image', video: 'video', chart: 'chart', table: 'table', code: 'code', metric: 'metric', quote: 'quote', shape: 'shape', path: 'shape',`],
  [B, `  if (Array.isArray(value.blocks)) return 'group';
  if (typeof value.type === 'string'`, `  if (Array.isArray(value.blocks)) return 'group';
  // SH-02: a preset without an image, or a custom path, is a shape block (with its text inside).
  if (isShapeBlock(value)) return 'shape';
  if (typeof value.type === 'string'`],
  [B, `  const kind = blockKind(block);
  if (region.accepts.includes(kind)) return true;`, `  const kind = blockKind(block);
  if (region.accepts.includes(kind)) return true;
  // SH-02: a shape is a figure, so a region that takes pictures takes it too.
  if (kind === 'shape' && region.accepts.includes('image')) return true;`],
  [B, `import `, `import { isShapeBlock } from './shape-block.js';\nimport `],
  [L, `export const REGION_KINDS = ['text', 'list', 'image', 'video', 'chart', 'table', 'code', 'metric', 'quote', 'timeline', 'diagram', 'group'] as const;`,
    `export const REGION_KINDS = ['text', 'list', 'image', 'video', 'chart', 'table', 'code', 'metric', 'quote', 'timeline', 'diagram', 'shape', 'group'] as const;`],
];
