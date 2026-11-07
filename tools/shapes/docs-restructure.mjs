import fs from 'node:fs';
const p='docs/shapes.md';
let s=fs.readFileSync(p,'utf8');
const cut=(start,end)=>{const a=s.indexOf(start), b=s.indexOf(end,a+1); if(a<0||b<0) throw Error('missing '+start); const part=s.slice(a,b); s=s.slice(0,a)+s.slice(b); return part;};
const editing=cut('## Editing shapes\n','## Effects\n');
const at=s.indexOf('## Validation\n'); if(at<0) throw Error('validation');
const diagrams=`## Native diagrams

A [diagram](diagrams.md) (Mermaid source in a \`diagram\` block) is drawn with the same shapes in PowerPoint. The PPTX export writes it as native shapes, connectors and text by default (\`diagrams: "shapes"\`; \`"picture"\` writes one SVG picture, \`--diagrams picture\` in the CLI), built from the diagram engine's own laid-out drawing, the geometry the preview draws:

- a node whose outline is a preset is that preset (\`rect\`, \`roundRect\`, \`ellipse\`, \`diamond\`, \`hexagon\` and the others, checked against the [preset geometry](#preset-geometry)); any other outline is a custom geometry of its exact path, with the four connection sites of a rectangle;
- a straight edge without arrowheads is a connector glued to the connection sites of the nodes it touches, written as an [overlay connector](#connectors) is (one \`p:cxnSp\` with \`a:stCxn\` and \`a:endCxn\` on the native shape ids and the sites' indexes), so it follows a node moved in PowerPoint; every other edge is one shape of custom geometry holding its line and its arrowheads, because PowerPoint opens no connector of custom geometry and its line ends are shorter than the diagram's arrowheads;
- labels are real text at the preview's size and baseline;
- everything is one group named \`OPF diagram N\`, with the diagram's \`alt\` as its description.

A family is written as shapes once PowerPoint's drawing of it has passed the comparison with the preview (all 32 families have; the list is core's \`DIAGRAM_SHAPE_FAMILIES\`). A diagram whose family is not in the list, or whose drawing needs what PowerPoint has no native form for (a clip path, a mask, a filter, an embedded image, text on a path, right-to-left text), stays a picture and is reported as \`pptx/diagram-shapes-unavailable\`.

On import an unchanged group is its diagram again (the Mermaid source and \`alt\`), and none of its members become overlay shapes or connectors. An edited group (a member moved, resized, retyped, added or removed) imports as its shapes, [as PowerPoint's shapes do](#a-deck-powerpoint-wrote): the nodes as overlay shapes with their presets, fills, lines and text, the glued edges as connectors between them; \`invalid-diagram-provenance\` reports that the source is not reconstructed. See [native shapes in PowerPoint](diagrams.md#native-shapes-in-powerpoint) for the comparison and the families.

`;
s=s.slice(0,at)+editing+diagrams+s.slice(at);
// The intro names every part of the page.
const intro='The full reference deck is [`examples/technical/shapes.opf.json`](../examples/technical/shapes.opf.json): one slide per group of properties.\n';
if(!s.includes(intro)) throw Error('intro');
s=s.replace(intro, intro+'\nThis page covers [shape blocks](#a-shape-block) and their properties, [overlay shapes and connectors](#overlay-shapes-and-connectors) drawn over a composed slide, [importing shapes](#importing-shapes-from-powerpoint) from PowerPoint, [editing shapes](#editing-shapes) in the editor, and [native diagrams](#native-diagrams), Mermaid diagrams written as PowerPoint shapes; then validation, loading in browsers, the preset geometry and the property map.\n');
// Loading: overlays and native diagrams.
const load='A browser bundle or an edge Worker loads it the first time a deck has a shape block, a custom `path`,';
if(!s.includes(load)) throw Error('load');
s=s.replace(load,'A browser bundle or an edge Worker loads it the first time a deck has a shape block, an overlay shape or connector, a custom `path`,');
const pend='`shapesPending(presentation)` lists what it would load.';
if(!s.includes(pend)) throw Error('pend');
s=s.replace(pend,'`shapesPending(presentation)` lists what it would load. A PPTX export with native diagrams (the default) also needs it for a deck with a diagram, which `ensureShapes(presentation, { diagrams: true })` covers; `toPptx` calls it so.');
fs.writeFileSync(p,s);
let d=fs.readFileSync('docs/diagrams.md','utf8');
d=d.replace('To get one SVG picture per diagram instead, as releases before SH-07 did, opt out:','To get one SVG picture per diagram instead, as earlier releases did, opt out:');
fs.writeFileSync('docs/diagrams.md',d);
