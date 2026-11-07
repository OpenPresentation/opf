const C = 'packages/javascript/src/composition.ts';
export default [
  // ImageShape: every preset.
  [C, `/** A frame mask. path follows the ECMA-376 preset formula for preset/adjust exactly, in reference pixels. */
export interface ImageShape {
  kind: 'rectangle' | 'rounded' | 'circle' | 'hexagon';
  preset: 'rect' | 'roundRect' | 'ellipse' | 'hexagon';
  /** DrawingML avLst guide values (for example adj and vf), in 1/100000 units. */
  adjust: Record<string, number>;
  path: string;
}`, `/**
 * A frame mask (SH-02: any of the 187 DrawingML presets). \`path\` is SH-01's evaluated preset outline at the frame, in reference pixels;
 * \`kind\` and \`preset\` are the preset name.
 */
export interface ImageShape {
  kind: string;
  preset: string;
  /** DrawingML avLst guide values the block set (for example adj), in 1/100000 units or 60000ths of a degree. */
  adjust: Record<string, number>;
  path: string;
}`],
  [C, `const IMAGE_OPTION_KEYS = ['fit', 'focus', 'aspectRatio', 'shape', 'cornerRadius', 'border', 'opacity', 'recolor', 'overlay', 'placement', 'portrait'] as const;`,
    `const IMAGE_OPTION_KEYS = ['fit', 'focus', 'aspectRatio', 'shape', 'adjust', 'stroke', 'opacity', 'recolor', 'overlay', 'placement', 'portrait'] as const;`],
  [C, `const IMAGE_SHAPES = { rectangle: 'rect', rounded: 'roundRect', circle: 'ellipse', hexagon: 'hexagon' } as const;\n`, ''],
  [C, /export function imageShape\(kind: ImageShape\['kind'\], box: LayoutBox, cornerRadius = 1 \/ 6\): ImageShape \{[\s\S]*?\n\}\n/, null],
  [C, `  if (edge && shape.kind !== 'rectangle') {
    diagnostics.push({ code: 'unsupported-image-treatment', path: \`\${path}.edge\`, message: 'An edge overlay needs a rectangle frame; a band cannot follow a rounded, circular or hexagonal mask as one native shape. Remove edge or use shape rectangle.' });`,
  `  if (edge && shape.preset !== 'rect') {
    diagnostics.push({ code: 'unsupported-image-treatment', path: \`\${path}.edge\`, message: 'An edge overlay needs a rectangle frame; a band cannot follow another preset mask as one native shape. Remove edge or use shape rect.' });`],
  [C, `box, shape: edge ? imageShape('rectangle', box) : shape };`, `box, shape: edge ? imageShape('rect', box) : shape };`],
  [C, `  const kindName: ImageShape['kind'] = Object.hasOwn(IMAGE_SHAPES, host.shape) ? host.shape : 'rectangle';`, `  const kindName = isPresetShape(host.shape) ? host.shape : 'rect';`],
  [C, `  const aspect = kindName === 'circle' ? 1 : finite(host.aspectRatio, Number.MIN_VALUE, 10);`, `  const aspect = kindName === 'ellipse' ? 1 : finite(host.aspectRatio, Number.MIN_VALUE, 10);`],
  [C, `  const shape = imageShape(kindName, box, finite(host.cornerRadius, 0, 0.5));
  const result: ComposedImage = { region: roundBox(region), box, fit, ...(requested === 'auto' ? { autoFit: true as const } : {}), focus, shape };
  const border = record(host.border), borderWidth = finite(border.width, 0, 64);
  if (border.color !== undefined && borderWidth) result.border = { color: border.color, width: round(borderWidth * scale) };`,
  `  const shape = imageShape(kindName, box, record(host.adjust));
  const result: ComposedImage = { region: roundBox(region), box, fit, ...(requested === 'auto' ? { autoFit: true as const } : {}), focus, shape };
  // SH-02: the picture's line takes the whole stroke vocabulary; a stroke without a color is the slide's neutral line (engines' border color).
  const stroke = host.stroke === undefined ? undefined : composeStroke(host.stroke, scale, { width: PICTURE_STROKE_WIDTH, join: 'miter' });
  if (stroke) result.stroke = stroke;`],
  [C, `  /** Line centered on the shape outline; width in reference pixels, already scaled to the canvas. */
  border?: { color: unknown; width: number };`, `  /** SH-02: the line along the shape outline (\`stroke\`, renamed from \`border\`); width in reference pixels, already scaled to the canvas. */
  stroke?: ComposedStroke;`],
  [C, `const overlay = composeOverlay(background.overlay, box, imageShape('rectangle', box), \`\${at}.overlay\`, mirrorSide, diagnostics);`, `const overlay = composeOverlay(background.overlay, box, imageShape('rect', box), \`\${at}.overlay\`, mirrorSide, diagnostics);`],
  [C, `shape: imageShape('rounded', frame, CARD_RADIUS * scale / Math.min(width, height)), focus: portraitFocus()};`, `shape: imageShape('roundRect', frame, {adj: Math.min(.5, CARD_RADIUS * scale / Math.min(width, height))}), focus: portraitFocus()};`],
  [C, `shape:imageShape('circle',selected.photoBox)};`, `shape:imageShape('ellipse',selected.photoBox)};`],
  [C, `photo.shape = imageShape('circle', photo.box); }`, `photo.shape = imageShape('ellipse', photo.box); }`],
  [C, `(host.shape !== undefined && host.shape !== 'rectangle' && host.shape !== 'rounded')) return base;`, `(host.shape !== undefined && host.shape !== 'rect' && host.shape !== 'roundRect')) return base;`],
  [C, `host.aspectRatio !== undefined || host.shape === 'circle') return undefined;`, `host.aspectRatio !== undefined || host.shape === 'ellipse') return undefined;`],
  [C, `const host = record(person.image.host), shape = host.shape === undefined || host.shape === 'circle' ? 'rounded' : host.shape, first = items.length;
    portraitHosts.set(person.image.path, { ...host, shape, fit: host.fit ?? 'cover', focus: host.focus ?? portraitFocus(), ...(shape === 'rounded' && host.cornerRadius === undefined ? { cornerRadius: CARD_RADIUS * scale / Math.min(picture.width, picture.height) } : {}) });`,
  `const host = record(person.image.host), shape = host.shape === undefined || host.shape === 'ellipse' ? 'roundRect' : host.shape, first = items.length;
    portraitHosts.set(person.image.path, { ...host, shape, fit: host.fit ?? 'cover', focus: host.focus ?? portraitFocus(), ...(shape === 'roundRect' && record(host.adjust).adj === undefined ? { adjust: { ...record(host.adjust), adj: Math.min(.5, CARD_RADIUS * scale / Math.min(picture.width, picture.height)) } } : {}) });`],
  [C, `imageHost.cornerRadius === undefined && (imageHost.shape === undefined || imageHost.shape === 'rectangle') && !(record(imageHost.border).color !== undefined && record(imageHost.border).width)) {
      const radius = Math.min(.5, CARD_RADIUS * scale / Math.max(scale, Math.min(frameBox.width, frameBox.height))), host = { ...imageHost, shape: 'rounded', cornerRadius: radius };`,
  `imageHost.adjust === undefined && (imageHost.shape === undefined || imageHost.shape === 'rect') && (imageHost.stroke === undefined || imageHost.stroke === 'none' || record(imageHost.stroke).width === 0)) {
      const radius = Math.min(.5, CARD_RADIUS * scale / Math.max(scale, Math.min(frameBox.width, frameBox.height))), host = { ...imageHost, shape: 'roundRect', adjust: { adj: radius } };`],
];
