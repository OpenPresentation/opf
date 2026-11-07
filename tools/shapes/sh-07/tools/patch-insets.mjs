import fs from 'node:fs';
const f = 'C:/opf-work/sh-07-native-diagrams/packages/pptx/src/diagram-shapes.js';
let s = fs.readFileSync(f, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing ' + a.slice(0, 80)); s = s.replace(a, b); };
rep(`import { presetMask, shapeSites } from '@openpresentation/opf/composition';`, `import { composeShape, presetMask, shapeSites } from '@openpresentation/opf/composition';`);
rep(`    const body = textBody(item, options, owner.shape.preset?.frame ?? owner.shape.bounds);
    if (!body) continue;
    owner.text = body;`, `    const frame = owner.shape.preset?.frame ?? owner.shape.bounds;
    const body = textBody(item, options, frame, textRectOf(owner.shape));
    if (!body) continue;
    owner.text = body;
    owner.textRect = textRectOf(owner.shape);`);
rep(`  const body = text ? bodyXml(text, insetsFor(text, frame)) :`, `  const body = text ? bodyXml(text, insetsFor(text, frame, item.textRect)) :`);
rep(`function textBody(item, options, frame) {`, `function textBody(item, options, frame, textRect) {`);
rep(`    const insets = insetsFor(body, frame);
    if (!insets) return undefined;`, `    const insets = insetsFor(body, frame, textRect);
    if (!insets) return undefined;`);
rep(`// The insets that put a body's text where it is inside \`frame\` (top anchored, aligned by its anchor), or undefined when it does not fit.
function insetsFor(body, frame) {
  const slack = 0.5;
  const top = body.box.y - frame.y, bottom = frame.y + frame.height - (body.box.y + body.box.height);
  // The text is the shape's own only when it lies inside the shape (its pitch's leading may reach past the bottom).
  if (top < -slack || bottom < -body.pitch * (1 - DIAGRAM_BASELINE_SHARE) - slack) return undefined;
  if (body.box.x < frame.x - slack || body.box.x + body.box.width > frame.x + frame.width + slack) return undefined;
  let left = 0, right = 0;
  if (body.anchor === 'middle') {
    const d = 2 * (body.origin[0] - frame.x) - frame.width;
    if (d >= 0) left = d; else right = -d;
  } else if (body.anchor === 'end') right = frame.x + frame.width - body.origin[0];
  else left = body.origin[0] - frame.x;
  if (left < -slack || right < -slack || left > frame.width || right > frame.width) return undefined;
  return { left: Math.max(0, left), top: Math.max(0, top), right: Math.max(0, right), bottom: Math.max(0, Math.min(bottom, frame.height)) };
}`, `// The text rectangle of a shape: its preset's (SH-01's, through core composeShape: the insets of a shape's text count from it), else the
// whole frame of a custom outline (written with a:rect l t r b).
function textRectOf(shape) {
  if (!shape.preset) return shape.bounds;
  const { frame, name, adjust } = shape.preset;
  try {
    const composed = composeShape({ shape: name, ...(adjust ? { adjust } : {}), aspectRatio: frame.width / Math.max(frame.height, 1e-9) }, { x: frame.x, y: frame.y, width: frame.width, height: frame.height }, { scale: 1 });
    if (composed.preset !== name) return undefined;
    const rect = composed.textRect;
    // A flipped shape mirrors its text rectangle about the frame's center.
    return { x: shape.preset.flipH ? 2 * frame.x + frame.width - rect.x - rect.width : rect.x, y: shape.preset.flipV ? 2 * frame.y + frame.height - rect.y - rect.height : rect.y, width: rect.width, height: rect.height };
  } catch { return undefined; }
}

// The insets that put a body's text where it is (top anchored, aligned by its anchor) inside the text rectangle \`rect\` of a shape whose
// frame is \`frame\`, or undefined when the text does not lie inside the shape or cannot be placed from that rectangle.
function insetsFor(body, frame, rect = frame) {
  if (!rect) return undefined;
  const slack = 0.5;
  const bottom = frame.y + frame.height - (body.box.y + body.box.height);
  // The text is the shape's own only when it lies inside the shape (its pitch's leading may reach past the bottom).
  if (body.box.y < frame.y - slack || bottom < -body.pitch * (1 - DIAGRAM_BASELINE_SHARE) - slack) return undefined;
  if (body.box.x < frame.x - slack || body.box.x + body.box.width > frame.x + frame.width + slack) return undefined;
  const top = body.box.y - rect.y;
  let left = 0, right = 0;
  if (body.anchor === 'middle') {
    const d = 2 * (body.origin[0] - rect.x) - rect.width;
    if (d >= 0) left = d; else right = -d;
  } else if (body.anchor === 'end') right = rect.x + rect.width - body.origin[0];
  else left = body.origin[0] - rect.x;
  if (top < -slack || left < -slack || right < -slack || left > rect.width || right > rect.width) return undefined;
  return { left: Math.max(0, left), top: Math.max(0, top), right: Math.max(0, right), bottom: Math.max(0, Math.min(rect.y + rect.height - (body.box.y + body.box.height), rect.height)) };
}`);
fs.writeFileSync(f, s);
console.log('ok');
