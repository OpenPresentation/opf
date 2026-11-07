export default [
  ['skills/opf-author/references/content.md',
    "the treatments `shape` (`rectangle`, `rounded`, `circle`, `hexagon`), `cornerRadius`, `border`, `opacity`,",
    "the treatments `shape` (any of the 187 DrawingML presets: `rect`, `roundRect`, `ellipse`, `hexagon`, ...), `adjust` (a `roundRect` corner is `{\"adj\": 0.1}`), `stroke` (the picture's line; it was `border` before 0.33), `opacity`,"],
  ['skills/opf-author/references/content.md',
    "An `image`, `chart`, `table` or `video` payload takes a `caption`",
    `## Shapes

A shape block draws a PowerPoint preset with optional text inside: \`{"shape": "chevron", "text": "Plan"}\`. Use one for a process step, a callout, a badge or a labeled figure; use a list or a table when the words carry the slide. \`shape\` takes DrawingML's preset names (\`rect\`, \`roundRect\`, \`ellipse\`, \`rightArrow\`, \`chevron\`, \`wedgeRectCallout\`, \`flowChartDecision\`, all 187 in docs/shapes.md), or \`path\` gives an outline of your own (SVG path data in a 0 to 1 box). \`adjust\` moves the preset's handles in fractions and degrees (\`{"adj": 0.3}\` on a \`roundRect\`). \`fill\` is \`"none"\`, a color, \`{"gradient": {...}}\` or \`{"pattern": {...}}\`; \`stroke\` is the line (\`{"color", "width", "dash", "end": {"type": "triangle"}}\`); \`style\` (\`none\`, \`subtle\`, \`moderate\` by default, \`intense\`) is the theme's shape style for whatever you leave unset, so a bare shape already follows the deck. Text is fitted inside the preset's text rectangle at the readable size, never shrunk below \`minFontSize\`: keep it to a few words. \`anchor\`, \`padding\` and \`textDirection\` place it; \`rotate\` and \`flip\` turn the shape; \`alt\`, \`decorative\`, \`hidden\` and \`link\` set its accessibility and click. Any color can be lighter or darker: \`{"color": "accent1", "lighten": 0.4}\` is PowerPoint's "Lighter 40%".

An \`image\`, \`chart\`, \`table\` or \`video\` payload takes a \`caption\``],
  ['skills/opf-layout/SKILL.md',
    "- A diagram is a figure:",
    "- A shape block (`shape` with no `image`, or `path`) is a figure too: it takes the largest frame of its preset's proportions in its cell (1:1 for round shapes, 2:1 for horizontal arrows, 3:2 for rectangles; `aspectRatio` overrides), centered, and a region that takes `image` takes shapes. Its text fits in the preset's text rectangle; a shape too small for its text reports `opf/text-overflow` at `<block>/text`, so give it a larger cell or fewer words.\n- A diagram is a figure:"],
  ['skills/opf-export/SKILL.md',
    "| Double border, shadow, shadow spread | OPF has no key for them, so no deck carries one and neither engine draws one | none |",
    "| Shape block (`shape`, `path`) | A native shape: `a:prstGeom` with its adjust values (or `a:custGeom`), `a:ln`, `p:style` and its own text body, never autofit; PowerPoint wraps the text in the same rectangle | none |\n| `rectangle` or `shape` gradient on a shape | PowerPoint's own gradient path; the preview draws an ellipse from the center | none |\n| Sketched line (`stroke.sketch`) | PowerPoint's Sketched line; the preview, and PowerPoint before 2021, draw the plain line | none |\n| Double border, shadow, shadow spread on a table cell | OPF has no key for them, so no deck carries one and neither engine draws one | none |"],
  ['skills/opf-inspect/SKILL.md',
    "- **Layout findings:**",
    "- **Shape findings:** `opf/shape-adjust-unknown` (an adjust name the preset does not have; the finding lists the ones it has) and `opf/shape-adjust-range` (outside the handle's range; the default is drawn) are warnings; `opf/shape-option-unsupported-payload` is a shape-only key on another block; `opf/shape-link-hidden` a link on a hidden shape. Look up a preset's adjust values and default frame in docs/shapes.md (`opf docs shapes`).\n- **Layout findings:**"],
];
