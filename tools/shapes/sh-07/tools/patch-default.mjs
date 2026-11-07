import fs from 'node:fs';
const root = 'C:/opf-work/sh-07-native-diagrams/';
const ed = (f, a, b) => { const s = fs.readFileSync(root + f, 'utf8'); if (!s.includes(a)) throw new Error(`${f} missing ${a.slice(0, 70)}`); fs.writeFileSync(root + f, s.replace(a, b)); };
ed('packages/javascript/src/node/export.ts',
  '`pptx`: diagrams as one native SVG picture each (`picture`, the default), or as native shapes and connectors (`shapes`) for the',
  '`pptx`: diagrams as native shapes and connectors (`shapes`, the default; SH-07) for the diagram families that passed their comparison with\n\t * the preview in PowerPoint (core DIAGRAM_SHAPE_FAMILIES), the others staying pictures, or as one native SVG picture each (`picture`). Was: for the');
ed('packages/cli/src/convert-command.ts',
  `                   --diagrams <picture|shapes>    picture (the default): each diagram one SVG picture. shapes: native shapes
                                                  and connectors for the diagram families that passed their comparison with
                                                  the preview in PowerPoint; the others stay pictures (diagram-shapes-unavailable)`,
  `                   --diagrams <shapes|picture>    shapes (the default): native shapes, text and connectors for the diagram
                                                  families that passed their comparison with the preview in PowerPoint; the
                                                  others stay pictures (diagram-shapes-unavailable). picture: each diagram one
                                                  SVG picture`);
ed('packages/pptx/src/index.d.ts',
  `   * SH-07: how diagrams are written. "picture" (default) writes each diagram as one native SVG picture over its PNG fallback. "shapes"
   * writes a diagram of a family in core's DIAGRAM_SHAPE_FAMILIES as one group of native shapes, connectors and text built from the
   * preview's own drawing (pele's laid-out geometry), with \`OPF_DIAGRAM_V1\` on the group so import reads the Mermaid source back; any
   * other diagram stays a picture and reports \`diagram-shapes-unavailable\` (info).`,
  `   * SH-07: how diagrams are written. "shapes" (default) writes a diagram of a family in core's DIAGRAM_SHAPE_FAMILIES as one group of
   * native shapes, connectors and text built from the preview's own drawing (pele's laid-out geometry), with \`OPF_DIAGRAM_V1\` on the group
   * so import reads the Mermaid source back; any other diagram (a family not compared yet, right-to-left text, a part with no native
   * form) stays a picture and reports \`diagram-shapes-unavailable\` (info). "picture" writes every diagram as one native SVG picture over
   * its PNG fallback, as before 0.33.`);
console.log('ok');
