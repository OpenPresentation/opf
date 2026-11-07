import fs from 'node:fs';
const f = 'C:/opf-work/sh-07-native-diagrams/packages/pptx/src/index.d.ts';
let s = fs.readFileSync(f, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing ' + a.slice(0, 80)); s = s.replace(a, b); };
rep(`export interface ContentPlaceholderDiagnostic {`, `/**
 * SH-07, \`diagrams: "shapes"\`: a diagram that stays one SVG picture (info). \`family\` is its diagram type (pele's name, such as
 * \`flowchart\`): a family not in core's DIAGRAM_SHAPE_FAMILIES (its native shapes have not passed the comparison with the preview in
 * PowerPoint), or a drawing with a part that has no native form (the message names it).
 */
export interface DiagramShapesUnavailableDiagnostic { code: "diagram-shapes-unavailable"; path: string; family: string; message: string }
export interface ContentPlaceholderDiagnostic {`);
rep(`| TypefaceReplacedDiagnostic | VariableExampleUsedDiagnostic) => void;`, `| TypefaceReplacedDiagnostic | VariableExampleUsedDiagnostic | DiagramShapesUnavailableDiagnostic) => void;`);
rep(`  /** Default compatible converts WebP to a static PNG. Preserve embeds original WebP bytes. */
  imageFormat?:`, `  /**
   * SH-07: how diagrams are written. "picture" (default) writes each diagram as one native SVG picture over its PNG fallback. "shapes"
   * writes a diagram of a family in core's DIAGRAM_SHAPE_FAMILIES as one group of native shapes, connectors and text built from the
   * preview's own drawing (pele's laid-out geometry), with \`OPF_DIAGRAM_V1\` on the group so import reads the Mermaid source back; any
   * other diagram stays a picture and reports \`diagram-shapes-unavailable\` (info).
   */
  diagrams?: "picture" | "shapes";
  /** Default compatible converts WebP to a static PNG. Preserve embeds original WebP bytes. */
  imageFormat?:`);
fs.writeFileSync(f, s);
console.log('ok');
