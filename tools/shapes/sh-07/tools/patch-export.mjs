import fs from 'node:fs';
const f = 'C:/opf-work/sh-07-native-diagrams/packages/javascript/src/node/export.ts';
let s = fs.readFileSync(f, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing ' + a.slice(0, 80)); s = s.replace(a, b); };
rep(`	/** \`pptx\`: what the file records about where media came from. */
	provenance?:`, `	/**
	 * \`pptx\`: diagrams as one native SVG picture each (\`picture\`, the default), or as native shapes and connectors (\`shapes\`) for the
	 * diagram families that passed their comparison with the preview in PowerPoint (core DIAGRAM_SHAPE_FAMILIES); the others stay pictures.
	 */
	diagrams?: "picture" | "shapes";
	/** \`pptx\`: what the file records about where media came from. */
	provenance?:`);
rep(`	const charts = oneOf("charts", options.charts, ["auto", "native", "picture"] as const);
`, `	const charts = oneOf("charts", options.charts, ["auto", "native", "picture"] as const);
	const diagrams = oneOf("diagrams", options.diagrams, ["picture", "shapes"] as const);
`);
rep(`	if ((charts !== undefined || provenance !== undefined || images !== undefined || bodyText !== undefined || slideNumbers !== undefined || typefaces !== undefined || as !== undefined) && format !== "pptx") throw invalid("charts, provenance, images, bodyText, slideNumbers, typefaces and as apply to format pptx.");`,
`	if ((charts !== undefined || diagrams !== undefined || provenance !== undefined || images !== undefined || bodyText !== undefined || slideNumbers !== undefined || typefaces !== undefined || as !== undefined) && format !== "pptx") throw invalid("charts, diagrams, provenance, images, bodyText, slideNumbers, typefaces and as apply to format pptx.");`);
rep(`	if (as === "images" && (charts !== undefined || provenance !== undefined || images !== undefined || bodyText !== undefined || slideNumbers !== undefined || typefaces !== undefined)) throw invalid("charts, provenance, images, bodyText, slideNumbers and typefaces do not apply to as: \\"images\\", where each slide is one picture.");`,
`	if (as === "images" && (charts !== undefined || diagrams !== undefined || provenance !== undefined || images !== undefined || bodyText !== undefined || slideNumbers !== undefined || typefaces !== undefined)) throw invalid("charts, diagrams, provenance, images, bodyText, slideNumbers and typefaces do not apply to as: \\"images\\", where each slide is one picture.");`);
rep(`				...(options.provenance ? { provenance:`, `				...(options.diagrams ? { diagrams: options.diagrams } : {}),
				...(options.provenance ? { provenance:`);
fs.writeFileSync(f, s);
console.log('ok');
