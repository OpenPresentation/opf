const C = 'packages/javascript/src/composition.ts';
export default [
  [C, `const fields = ["text", "items", "bullets", "image", "video", "chart", "table", "code", "metric", "quote", "timeline", "diagram"];`,
    `// SH-02: \`shape\` and \`path\` make a shape block (isShapeBlock); on an image block \`shape\` is the frame's mask, never a leaf of its own.
const fields = ["text", "items", "bullets", "image", "video", "chart", "table", "code", "metric", "quote", "timeline", "diagram", "shape", "path"];
const leafFields = (host: Record<string, any>) => fields.filter(field => host[field] !== undefined && field !== 'shape' && field !== 'path');`],
  // collect: a shape block is one leaf.
  [C, `    // RR-34: a caption belongs to the host's one captionable payload (image, chart, table or video).
    const captioned = host.caption !== undefined ? fields.filter(field => host[field] !== undefined && CAPTIONABLE_FIELDS.includes(field)) : [];`,
    `    // SH-02: a shape block is one leaf, its preset (or custom path) with its text inside.
    if (isShapeBlock(host)) {
      const key = host.shape !== undefined || host.path === undefined ? 'shape' : 'path';
      return [{ field: 'shape', type: 'shape', value: host[key], path: \`\${basePath}.\${key}\`, payload: shapePayload(host), host, hostPath: basePath, ...(cardCells.has(basePath) ? { cardCell: true } : {}) }];
    }
    // RR-34: a caption belongs to the host's one captionable payload (image, chart, table or video).
    const captioned = host.caption !== undefined ? fields.filter(field => host[field] !== undefined && CAPTIONABLE_FIELDS.includes(field)) : [];`],
  [C, `    return fields.filter(field => host[field] !== undefined).map(field => ({ field, type: host.type ?? kind(field), value: fieldValue(field),`,
    `    return leafFields(host).map(field => ({ field, type: host.type ?? kind(field), value: fieldValue(field),`],
  // placement
  [C, `    if (lone) { box = lone; frame = undefined; metricReferenceHeight = undefined; contentSized.add(node); }
    const onSurface = emphasized || insideEmphasis;`,
    `    if (lone) { box = lone; frame = undefined; metricReferenceHeight = undefined; contentSized.add(node); }
    // SH-02: a shape block draws its own fill and outline, so it takes no card; its frame sits in the cell, its text in its text rectangle.
    if (node.field === 'shape') { placeShape(node, box, settings, anchor); return; }
    const onSurface = emphasized || insideEmphasis;`],
  [C, `  const placeNode = (node: Pending, box: LayoutBox, settings: Composition, cards = hasCards, listColumns?: 'auto' | 1, metricReferenceHeight?: number, anchor: RegionAnchor = 'top', frame?: LayoutBox): void => {`,
    `  // SH-02: a shape block in its cell (shape-block.ts composeShape): the frame at the preset's aspect (or the block's aspectRatio), placed by the
  // region's anchor, and its text fitted in the text rectangle less the insets by the measured fonts, from the body size down to the
  // readability floor and never below it (a text that does not fit there overflows with a finding).
  const placeShape = (node: Pending, cell: LayoutBox, settings: Composition, anchor: RegionAnchor): void => {
    const host = node.host ?? {}, hostPath = node.hostPath ?? node.path, textPath = \`\${hostPath}.text\`;
    const shape = composeShape(host, roundBox(cell), { scale, anchorY: anchor === 'bottom' ? 'bottom' : anchor === 'top' ? 'top' : 'middle' });
    const value = host.text;
    let text: TextFit | RichTextFit | undefined;
    if (value !== undefined && value !== '' && !(Array.isArray(value) && value.length === 0)) {
      const drawn = shape.textDirection === 'stacked' ? stackedText(value) : value;
      const floor = snapFontSizeUp((settings.minFontSize ?? 16) * scale), start = Math.max(floor, contentNominalSize('text') * scale);
      text = fitContent('text', drawn, contentText('text', drawn) ?? '', shape.textBox, start, floor, textPath, undefined, 'center');
      if (text.overflow) diagnostics.push({ code: 'text-overflow', path: textPath, message: 'The text does not fit inside the shape at the readable minimum size; give the shape more room (a larger cell or another aspectRatio), shorten the text or lower its padding.' });
    }
    items.push({ path: node.path, field: 'shape', type: 'shape', value: node.value, payload: node.payload, box: { ...shape.box }, shape, ...(text ? { text } : {}), textStyle: { ...styleFor('text', textPath), ...(shape.textBold ? { fontWeight: 700 } : {}) }, composition: settings, alignment: 'center' });
  };
  const placeNode = (node: Pending, box: LayoutBox, settings: Composition, cards = hasCards, listColumns?: 'auto' | 1, metricReferenceHeight?: number, anchor: RegionAnchor = 'top', frame?: LayoutBox): void => {`],
  [C, `    else if (item.text?.overflow) diagnostics.push({ code: "text-overflow", path: item.path, message: "Text exceeds its cell at the minimum font size; shorten it, increase its space, or split the slide." });`,
    `    else if (item.text?.overflow && item.field !== 'shape') diagnostics.push({ code: "text-overflow", path: item.path, message: "Text exceeds its cell at the minimum font size; shorten it, increase its space, or split the slide." });`],
  [C, `    if (node.field === 'image' || node.field === 'video' || node.field === 'diagram') placeNode(node, cell, settings, hasCards, undefined, undefined, 'middle');`,
    `    if (node.field === 'image' || node.field === 'video' || node.field === 'diagram' || node.field === 'shape') placeNode(node, cell, settings, hasCards, undefined, undefined, 'middle');`],
  [C, `    if (node.field === 'chart' || node.field === 'diagram') return frame(SPLIT_CHART_SHAPE);`,
    `    if (node.field === 'chart' || node.field === 'diagram') return frame(SPLIT_CHART_SHAPE);
    if (node.field === 'shape') return frame(Number(record(node.host).aspectRatio) > 0 ? Number(record(node.host).aspectRatio) : presetAspect(typeof record(node.host).shape === 'string' ? record(node.host).shape : undefined));`],
  [C, `      const figures = units.flatMap((unit, index) => unit.field === 'chart' || unit.field === 'image' || unit.field === 'diagram' ? [index] : []);`,
    `      const figures = units.flatMap((unit, index) => unit.field === 'chart' || unit.field === 'image' || unit.field === 'diagram' || unit.field === 'shape' ? [index] : []);`],
  [C, `import {composeShape,composeStroke,isShapeBlock,presetMask,stackedText,PICTURE_STROKE_WIDTH,type ComposedShape,type ComposedStroke} from './shape-block.js';`,
    `import {composeShape,composeStroke,isShapeBlock,presetAspect,presetMask,stackedText,PICTURE_STROKE_WIDTH,SHAPE_BLOCK_KEYS,type ComposedShape,type ComposedStroke} from './shape-block.js';`],
  // payload of a shape item
  [C, `const assetSource = (value: unknown): unknown => typeof value === 'string' ? value : record(value).src;`,
    `const assetSource = (value: unknown): unknown => typeof value === 'string' ? value : record(value).src;
/** SH-02: the payload a composed shape item reports: the block's shape keys and its text. */
const SHAPE_PAYLOAD_KEYS = ['shape', 'adjust', 'stroke', 'opacity', 'aspectRatio', 'text', ...SHAPE_BLOCK_KEYS] as const;
const shapePayload = (host: Record<string, any>): Record<string, unknown> => {
  const payload: Record<string, unknown> = { type: 'shape' };
  for (const key of SHAPE_PAYLOAD_KEYS) if (host[key] !== undefined) payload[key] = host[key];
  return payload;
};`],
  // ComposedItem.shape
  [C, `  /** Picture geometry and treatments of an image item (\`field\` image); absent on every other item. */
  image?: ComposedImage;`,
    `  /** Picture geometry and treatments of an image item (\`field\` image); absent on every other item. */
  image?: ComposedImage;
  /** SH-02: the drawing of a shape block (\`field\` shape, shape-block.ts ComposedShape); \`text\` is its text, fitted in \`shape.textBox\`. Absent on every other item. */
  shape?: ComposedShape;`],
];
