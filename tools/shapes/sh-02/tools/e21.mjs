const T = 'packages/pptx/src/content-topology.js';
export default [
  [T, `export const CONTENT_KINDS = Object.freeze(['text', 'list', 'image', 'video', 'chart', 'table', 'code', 'metric', 'quote', 'timeline', 'diagram']);`,
    `export const CONTENT_KINDS = Object.freeze(['text', 'list', 'image', 'video', 'chart', 'table', 'code', 'metric', 'quote', 'timeline', 'diagram', 'shape']);`],
  [T, `function blockKind(block) {
  if (typeof block.type === 'string' && block.type !== 'group') return CONTENT_KINDS.includes(block.type) ? block.type : null;`, `function blockKind(block) {
  if (typeof block.type === 'string' && block.type !== 'group') return CONTENT_KINDS.includes(block.type) ? block.type : null;
  // SH-02: a preset with no picture, or a custom path, is a shape block (its text is inside it).
  if (block.image === undefined && (typeof block.shape === 'string' || block.path !== undefined)) return 'shape';`],
];
