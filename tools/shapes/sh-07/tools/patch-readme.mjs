import fs from 'node:fs';
const f = 'C:/opf-work/sh-07-native-diagrams/packages/pptx/README.md';
const s = fs.readFileSync(f, 'utf8');
const anchor = 'With `provenance: "references-only"` or `false` no diagram source is stored and the picture imports as an SVG image.';
if (!s.includes(anchor)) throw new Error('anchor');
const add = `

SH-07: \`toPptx(deck, {diagrams: "shapes"})\` (default \`"picture"\`, the path above) writes a diagram of a family in core's \`DIAGRAM_SHAPE_FAMILIES\` as one \`p:grpSp\` \`OPF diagram N\` of native shapes built by \`src/diagram-shapes.js\` from the same painted SVG (with pele's classes kept): presets where pele's outline is exactly one (rect, roundRect, ellipse, diamond, hexagon, parallelogram, trapezoid, triangle, checked against SH-01's geometry), custom geometry otherwise, transforms flattened, fills and lines with alpha, gradients, dashes, caps and joins, labels as real text at pele's baselines (exact line spacing, first baseline at three quarters of the pitch, as PowerPoint places it), a node's label as the node's own text, a straight edge without arrowheads as a \`straightConnector1\` glued (\`a:stCxn\`, \`a:endCxn\`) to the node sites it touches, and every other edge as one custom shape of its exact line and arrowheads (PowerPoint refuses custom geometry in \`p:cxnSp\`). The group's description is the alt text; in \`full\` provenance its \`OPF_DIAGRAM_V1\` manifest has \`shapes: true\` and the group's signature, so an unchanged group imports as the diagram and an edited one as its shapes with \`invalid-diagram-provenance\`. A family not in the list, or a drawing with a clip path, mask, filter, pattern, image, text path or right-to-left text, stays the picture with \`diagram-shapes-unavailable\` (info). See core \`docs/diagrams.md#native-shapes-in-powerpoint\`.`;
fs.writeFileSync(f, s.replace(anchor, anchor + add));
console.log('ok');
