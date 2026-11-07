const I = 'packages/javascript/src/validation-rule-info.ts';
const F = 'packages/javascript/src/finding-text-format.ts';
const X = 'packages/javascript/src/finding-text-explain-format.ts';
const H = 'packages/javascript/src/finding-text-helpers.ts';
const T = 'packages/javascript/test/finding-text-rules.test.mjs';
const K = 'packages/javascript/test/support/finding-text-corpus.mjs';
export default [
  [I, "'`fit`, `focus`, the image treatments (`shape`, `cornerRadius`, `border`, `opacity`, `recolor`, `overlay`, `aspectRatio`), `placement` and `portrait` describe how a picture is drawn; a group, text or chart block has no picture for them to apply to.', { standard: SCHEMA }),",
    "'`fit`, `focus`, the image treatments (`shape`, `adjust`, `stroke`, `opacity`, `recolor`, `overlay`, `aspectRatio`), `placement` and `portrait` describe how a picture is drawn; a group, text or chart block has no picture for them to apply to. A shape block takes `shape`, `adjust`, `stroke`, `opacity` and `aspectRatio` too.', { standard: SCHEMA }),\n" +
    "\trule('shape-option-unsupported-payload', 'format', 'error', 'A shape option is on a payload that is not a shape block.', '`fill`, `style`, `rotate`, `flip`, `anchor`, `padding`, `textDirection`, `alt`, `decorative`, `hidden`, `link` and the effects (`shadow`, `innerShadow`, `glow`, `softEdge`, `reflection`, `blur`) describe how a shape block is drawn; a text, chart or image block, or a group, has no shape for them to apply to.', { standard: SCHEMA }),\n" +
    "\trule('shape-adjust-unknown', 'format', 'warning', 'An adjust value names a guide the preset does not have.', 'Each preset has its own adjust handles (DrawingML\\'s avLst guides: `adj`, `adj1`, `adj2`, ...); a name the preset does not have changes nothing, and a custom `path` has none. The preset\\'s default is drawn.', { standard: 'ECMA-376 Part 1, 20.1.10.56 (ST_ShapeType) and presetShapeDefinitions.xml' }),\n" +
    "\trule('shape-adjust-range', 'format', 'warning', 'An adjust value is outside the range of the preset\\'s handle.', 'An adjust value outside the range its handle allows is pinned by the preset\\'s own formulas, so the shape is not drawn as the value says; core draws the preset\\'s default instead and both engines agree.', { standard: 'ECMA-376 Part 1, 20.1.10.56 (ST_ShapeType) and presetShapeDefinitions.xml', approximations: 'Ranges are checked at a square shape of the default size; a handle whose range depends on the shape\\'s proportions is checked at those proportions when the shape is drawn.' }),\n" +
    "\trule('shape-link-hidden', 'format', 'warning', 'A hidden shape carries a link.', 'A hidden shape (`hidden: true`) is not drawn, so its `link` can never be clicked in a slide show.', { standard: SCHEMA }),"],
  [H, 'quote: "a quote", timeline: "a timeline", group: "a group" };', 'quote: "a quote", timeline: "a timeline", shape: "a shape", group: "a group" };'],
  [F, `const imagePlacementInvalid: RuleText = (finding) => {`, `const shapeOptionUnsupportedPayload: RuleText = (finding) => {
  const field = text(params(finding).field) ?? match(finding.message, /^(\\w+) is only valid on a shape block/)?.[1];
  const type = text(params(finding).type) ?? match(finding.message, /; this payload is '(.+?)'/)?.[1];
  const kind = type ?? (/a group cannot carry them/.test(finding.message) ? "group" : undefined);
  if (!field) return undefined;
  return {
    message: \`\${code(field)} only applies to shapes; this block is \${kind ? kindPhrase(kind) : "not a shape"}.\`,
    next: \`remove \${code(field)}, or make the block a shape with \\\`shape\\\` (a preset such as roundRect) or \\\`path\\\`.\`,
  };
};

const shapeAdjustUnknown: RuleText = (finding) => {
  const { name, shape, known } = params(finding);
  if (typeof name !== "string") return undefined;
  const names = Array.isArray(known) ? known.filter((entry): entry is string => typeof entry === "string") : [];
  if (shape === "path") return { message: \`\${code(\`adjust.\${name}\`)} has no effect on a custom \\\`path\\\`: adjust values belong to presets.\`, next: \`remove \${code(\`adjust.\${name}\`)}.\` };
  return {
    message: \`\${text(shape) ?? "This preset"} has no adjust value \${code(name)}\${names.length ? \`; it has \${names.map(code).join(", ")}\` : "; it has none"}.\`,
    next: names.length ? \`use \${names.map(code).join(" or ")}, or remove \${code(name)}.\` : \`remove \${code(\`adjust.\${name}\`)}.\`,
  };
};

const shapeAdjustRange: RuleText = (finding) => {
  const { name, shape, value, min, max, unit } = params(finding);
  if (typeof name !== "string" || typeof value !== "number") return undefined;
  const range = \`\${typeof min === "number" ? min : "no minimum"} to \${typeof max === "number" ? max : "no maximum"}\`;
  return {
    message: \`\${code(\`adjust.\${name}\`)} of \${text(shape) ?? "this preset"} is \${value}, outside \${range}\${unit === "degrees" ? " degrees" : ""}, so the preset's default is drawn.\`,
    next: \`set it between \${range}.\`,
  };
};

const shapeLinkHidden: RuleText = () => ({
  message: "This shape is hidden, so its \`link\` can never be clicked.",
  next: "remove \`hidden\`, or remove the \`link\`.",
});

const imagePlacementInvalid: RuleText = (finding) => {`],
  [F, `  "opf/image-placement-invalid": imagePlacementInvalid,`, `  "opf/image-placement-invalid": imagePlacementInvalid,
  "opf/shape-option-unsupported-payload": shapeOptionUnsupportedPayload,
  "opf/shape-adjust-unknown": shapeAdjustUnknown,
  "opf/shape-adjust-range": shapeAdjustRange,
  "opf/shape-link-hidden": shapeLinkHidden,`],
  [X, `  "opf/image-placement-invalid": ex(`, `  "opf/shape-option-unsupported-payload": ex(
    "Remove the shape option, or make the block a shape block with \`shape\` (a preset such as roundRect) or \`path\`. Options such as \`fill\`, \`style\` and \`rotate\` describe how a shape is drawn.",
    { title: "Plan", blocks: [{ text: "Launch", fill: "accent2" }] },
    { title: "Plan", blocks: [{ shape: "roundRect", text: "Launch", fill: "accent2" }] },
  ),
  "opf/shape-adjust-unknown": ex(
    "Use an adjust name the preset has (docs/shapes.md lists them; roundRect has \`adj\`, rightArrow \`adj1\` and \`adj2\`), or remove it.",
    { title: "Plan", blocks: [{ shape: "roundRect", adjust: { adj1: 0.3 } }] },
    { title: "Plan", blocks: [{ shape: "roundRect", adjust: { adj: 0.3 } }] },
  ),
  "opf/shape-adjust-range": ex(
    "Set the adjust value inside its handle's range: roundRect's corner \`adj\` runs from 0 to 0.5 of the shorter side.",
    { title: "Plan", blocks: [{ shape: "roundRect", adjust: { adj: 0.8 } }] },
    { title: "Plan", blocks: [{ shape: "roundRect", adjust: { adj: 0.5 } }] },
  ),
  "opf/shape-link-hidden": ex(
    "Show the shape, or drop its link: a hidden shape cannot be clicked.",
    { title: "Plan", blocks: [{ shape: "rect", text: "Pricing", link: "https://example.com/pricing", hidden: true }] },
    { title: "Plan", blocks: [{ shape: "rect", text: "Pricing", link: "https://example.com/pricing" }] },
  ),
  "opf/image-placement-invalid": ex(`],
  [T, `  "image-placement-invalid": [`, `  "shape-option-unsupported-payload": ["\`fill\` only applies to shapes; this block is text.", "remove \`fill\`, or make the block a shape with \`shape\` (a preset such as roundRect) or \`path\`."],
  "shape-adjust-unknown": ["roundRect has no adjust value \`adj1\`; it has \`adj\`.", "use \`adj\`, or remove \`adj1\`."],
  "shape-adjust-range": ["\`adjust.adj\` of roundRect is 0.8, outside 0 to 0.5, so the preset's default is drawn.", "set it between 0 to 0.5."],
  "shape-link-hidden": ["This shape is hidden, so its \`link\` can never be clicked.", "remove \`hidden\`, or remove the \`link\`."],
  "image-placement-invalid": [`],
  [K, `	{ name: 'image-placement-invalid', rule: 'opf/image-placement-invalid',`, `	{ name: 'shape-option-unsupported-payload', rule: 'opf/shape-option-unsupported-payload', input: deck([{ title: 'T', blocks: [{ text: 'x', fill: 'accent2' }] }]) },
	{ name: 'shape-adjust-unknown', rule: 'opf/shape-adjust-unknown', input: deck([{ title: 'T', blocks: [{ shape: 'roundRect', adjust: { adj1: 0.3 } }] }]) },
	{ name: 'shape-adjust-range', rule: 'opf/shape-adjust-range', input: deck([{ title: 'T', blocks: [{ shape: 'roundRect', adjust: { adj: 0.8 } }] }]) },
	{ name: 'shape-link-hidden', rule: 'opf/shape-link-hidden', input: deck([{ title: 'T', blocks: [{ shape: 'rect', text: 'x', link: 'https://example.com', hidden: true }] }]) },
	{ name: 'image-placement-invalid', rule: 'opf/image-placement-invalid',`],
];
