export default [
  ['packages/javascript/src/shape-block.ts', "  return out.join(' ').replace(/ ?([A-Za-z]) ?/g, (_, letter: string) => ` ${letter}`).trim().replace(/^ /, '');", "  return out.join(' ');"],
  ['packages/javascript/src/shape-block.ts', "host.stroke !== undefined ? { color: 'text', width: SHAPE_STROKE_WIDTH, join: 'round' } : undefined);", "host.stroke !== undefined ? { color: style === 'none' ? 'text' : { color: 'accent1', darken: 0.5 }, width: SHAPE_STROKE_WIDTH, join: 'round' } : undefined);"],
];
