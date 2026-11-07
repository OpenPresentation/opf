import fs from 'node:fs';
const f = 'C:/opf-work/sh-07-native-diagrams/packages/cli/src/convert-command.ts';
let s = fs.readFileSync(f, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing ' + a.slice(0, 80)); s = s.replace(a, b); };
rep(`"raster", "text", "charts", "provenance",`, `"raster", "text", "charts", "diagrams", "provenance",`);
rep(`"scale", "text", "charts", "provenance",`, `"scale", "text", "charts", "diagrams", "provenance",`);
rep(`  pptx             --charts <auto|native|picture>  --images <compatible|preserve>  --provenance <full|references-only|none>
`, `  pptx             --charts <auto|native|picture>  --images <compatible|preserve>  --provenance <full|references-only|none>
                   --diagrams <picture|shapes>    picture (the default): each diagram one SVG picture. shapes: native shapes
                                                  and connectors for the diagram families that passed their comparison with
                                                  the preview in PowerPoint; the others stay pictures (diagram-shapes-unavailable)
`);
rep(`	oneOf("--charts", options.charts, ["auto", "native", "picture"] as const);
`, `	oneOf("--charts", options.charts, ["auto", "native", "picture"] as const);
	oneOf("--diagrams", options.diagrams, ["picture", "shapes"] as const);
`);
rep(`			charts: text("charts"),
`, `			charts: text("charts"),
			diagrams: text("diagrams"),
`);
fs.writeFileSync(f, s);
console.log('ok');
