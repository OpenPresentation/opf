const D = 'docs/image-treatments.md';
export default [
  [D, `{ "image": { "src": "asset:hero", "alt": "Harbour" }, "fit": "cover", "focus": { "x": 0.3, "y": 0.5 }, "shape": "rounded", "border": { "color": "accent5", "width": 1 } }`,
    `{ "image": { "src": "asset:hero", "alt": "Harbour" }, "fit": "cover", "focus": { "x": 0.3, "y": 0.5 }, "shape": "roundRect", "stroke": { "color": "accent5", "width": 1 } }`],
  [D, `| \`aspectRatio\` | The largest centered frame with this width/height ratio (\`circle\` uses 1). | frame geometry | frame geometry |
| \`shape\` | \`rectangle\`, \`rounded\`, \`circle\` or \`hexagon\`. | \`a:prstGeom\` \`rect\` / \`roundRect\` / \`ellipse\` / \`hexagon\` with core's guide values | \`clipPath\` with core's outline of the same preset formula |
| \`cornerRadius\` | Radius of a \`rounded\` frame as a share of the shorter side. Default 0.16667. | \`roundRect\` \`adj\` | circular arcs with the same radius |
| \`border\` | \`{ color, width }\`. The line is centered on the outline, and its width is in reference pixels. | \`a:ln\` with \`solidFill\`, \`algn="ctr"\` and a miter join | \`stroke\` on the same outline, miter join |`,
    `| \`aspectRatio\` | The largest centered frame with this width/height ratio (\`ellipse\` uses 1). | frame geometry | frame geometry |
| \`shape\` | Any of the 187 DrawingML presets ([shapes](shapes.md#presets)): \`rect\` (the default), \`roundRect\`, \`ellipse\`, \`hexagon\`, \`chevron\`, \`star5\` and the rest. 0.33 renamed \`rectangle\`, \`rounded\` and \`circle\` to \`rect\`, \`roundRect\` and \`ellipse\`. | \`a:prstGeom\` with the block's adjust values | \`clipPath\` with core's evaluated outline of the same preset (SH-01) |
| \`adjust\` | The preset's adjust values ([shapes](shapes.md#adjust-values)): a \`roundRect\` frame's corner is \`{ "adj": 0.05 }\`, a share of the shorter side (default 0.16667). Replaces \`cornerRadius\` (0.33). | \`a:avLst\` | the evaluated outline |
| \`stroke\` | The line along the outline, renamed from \`border\` in 0.33: \`{ color, width }\` plus every stroke property of a shape ([stroke](shapes.md#stroke)): dash, cap, join, compound, alignment. Width in reference pixels (default 2); without a color the slide's neutral line. A picture's line is centered with a miter join unless it says otherwise. | \`a:ln\` | \`stroke\` on the same outline |`],
  [D, `Colors accept the usual \`ColorRef\` forms: hex, scheme slot or role, or \`var:<id>\`. Eight-digit hex alpha is kept as native \`a:alpha\` and SVG opacity. Alt text comes from the image's asset.`,
    `Colors accept the usual \`ColorRef\` forms: hex, scheme slot or role, \`var:<id>\`, or a lighter or darker color (\`{ "color": "accent1", "lighten": 0.4 }\`, [shapes](shapes.md#lighter-and-darker-colors)). Eight-digit hex alpha is kept as native \`a:alpha\` and SVG opacity. Alt text comes from the image's asset.`],
  [D, `the \`shape\` with its DrawingML preset and SVG outline, \`border\`, \`opacity\`,`, `the \`shape\` with its DrawingML preset and SVG outline, \`stroke\`, \`opacity\`,`],
  [D, `A \`circle\` (or unshaped) picture is drawn in a frame rounded as a card is (8 px); another \`shape\` is kept.`, `An \`ellipse\` (or unshaped) picture is drawn in a frame rounded as a card is (8 px); another \`shape\` is kept.`],
  [D, `| masked-shape | image block, \`shape: hexagon, aspectRatio: 1.1547, placement: {edge: right, inset: true}\` | supported | Masks are limited to the four presets. Arbitrary polygon and custom-geometry masks are not in the vocabulary. |
| circular-crop | image block, \`shape: circle, placement: {edge: left, size: 0.4, inset: true}\` | supported | The gallery's small shadow is not drawn (see shadows). |
| rounded-card | image block, \`shape: rounded, cornerRadius: 0.05, border: {color: accent5, width: 1}\` | supported, without shadow | The optional card shadow is unsupported (see shadows). |`,
    `| masked-shape | image block, \`shape: hexagon, aspectRatio: 1.1547, placement: {edge: right, inset: true}\` | supported | Any of the 187 presets is a mask (0.33). A custom-geometry mask is not in the vocabulary. |
| circular-crop | image block, \`shape: ellipse, placement: {edge: left, size: 0.4, inset: true}\` | supported | The gallery's small shadow is not drawn (see shadows). |
| rounded-card | image block, \`shape: roundRect, adjust: {adj: 0.05}, stroke: {color: accent5, width: 1}\` | supported, without shadow | The optional card shadow is unsupported (see shadows). |`],
  [D, `| device-frame | image block, \`aspectRatio: 0.5, shape: rounded, cornerRadius: 0.12, border: {color: dark1, width: 12}, placement: {edge: right, inset: true}\` | partial |`,
    `| device-frame | image block, \`aspectRatio: 0.5, shape: roundRect, adjust: {adj: 0.12}, stroke: {color: dark1, width: 12}, placement: {edge: right, inset: true}\` | partial |`],
];
