import {readFileSync, writeFileSync} from 'node:fs';
const edit = (path, pairs) => {
  let s = readFileSync(path, 'utf8');
  for (const [a, b] of pairs) { if (!s.includes(a)) throw new Error(`${path}: missing ${a.slice(0, 70)}`); s = s.replace(a, b); }
  writeFileSync(path, s);
};
edit('docs/smartart.md', [
[`1. **Live SmartArt** (\`"live"\`, the default), for PowerPoint's design where the instance lies in the domain below. The slide holds a \`p:graphicFrame\` of the
   diagram (\`dgm:relIds\`), and the package:`,
`1. **Live SmartArt** (\`"live"\`, the default), for PowerPoint's design where the instance lies in the domain below. The slide holds a \`p:graphicFrame\` of the
   diagram (\`dgm:relIds\`) inside an \`mc:AlternateContent\` whose \`mc:Fallback\` is OPF's picture of it ([in other apps](#in-other-apps)), and the package:`],
[`   - **no layout part.** OPF never writes a SmartArt layout definition. \`r:lo\` is empty, and PowerPoint resolves its built-in layout
     from \`loTypeId\` (see [the layout relationship](#the-layout-relationship)).`,
`   - **no layout part.** OPF never writes a SmartArt layout definition. \`r:lo\` is empty, and PowerPoint resolves its built-in layout
     from \`loTypeId\` (see [the layout relationship](#the-layout-relationship));
   - the fallback picture: an SVG (\`asvg:svgBlip\`) over its PNG raster, the picture path SH-07's diagrams use.

   Live SmartArt needs that picture, so it needs opf-render (an optional peer) to draw the slide and an SVG rasterizer for the PNG (the
   default in Node is opf-render's; a browser passes \`svgRasterizer\`). Without either the arrangement is written as native shapes and
   \`smartart-unavailable\` says so.`],
[`### What PowerPoint does on edit`,
`### In other apps

Many apps that open PPTX files do not lay SmartArt out. Each live SmartArt is therefore written as an \`mc:AlternateContent\` (ECMA-376
Part 3, markup compatibility): the \`mc:Choice\` holds the SmartArt frame and requires the namespace
\`http://schemas.microsoft.com/office/drawing/2016/12/diagram\` (prefix \`dgm1612\`, Office 2016's SmartArt extensions), and the
\`mc:Fallback\` holds a picture of the same frame, id and name. **PowerPoint** understands the namespace and shows the live SmartArt.
**Every other app**, one that does not claim the namespace, takes the fallback and shows OPF's own drawing: the preview of that frame
(opf-render's SVG of the slide, cut to the arrangement and its entries, the text as glyph outlines in the deck's fonts when the export
has the fonts handle), transparent around the drawing, as an SVG with a PNG raster at 192 dpi of the frame for apps without SVG. Its
alt text is the outline, one entry a line in entry order (\`Pyramid of 4 levels, top to bottom:\` then each level). SH-09's drawing part
stays in the package for readers that draw the cached SmartArt shapes.

The namespace was chosen through COM (PowerPoint for Microsoft 365 on Windows 11, 2026-11-06), on a pyramid and a matrix whose
\`mc:Choice\` required each candidate in turn: \`dgm1612\` (2016/12 diagram), \`dgm1611\` (2016/11 diagram), \`dgm14\` (2010 diagram),
\`dsp\` (2008 diagram drawing), \`dgm\` (the ECMA diagram namespace) and \`p14\` (PowerPoint 2010) all opened as live SmartArt
(\`HasSmartArt\`, Basic Pyramid or Basic Matrix, every entry a node, the slide exported as the SmartArt); a namespace PowerPoint does not
know took the fallback, which PowerPoint drew as the preview does (mean pixel difference 1.27 and 1.14 of 255 over the slide). The
chosen namespace is the narrowest of those: only Office's SmartArt uses it, whereas an app that reads the ECMA diagram markup or the
cached drawing, or claims the PowerPoint 2010 extensions, could claim the others without laying SmartArt out. No third-party app was
run (LibreOffice and the Open XML SDK were not installed); the pptx tests check the markup with a markup-compatibility reader that does
not know the namespace, which takes the fallback picture and finds a well-formed SVG and a PNG.

**Saved again in PowerPoint**, the file keeps the live SmartArt (COM: \`SaveCopyAs\`, reopened, \`HasSmartArt\` and every node) but not
the wrapper: PowerPoint writes the bare SmartArt frame and its own drawing and layout parts, and drops the fallback picture and its
media. Other apps then see what any PowerPoint-saved SmartArt gives them, typically its cached drawing. Import reads the file as
before.

### What PowerPoint does on edit`],
[`SmartArt layout part. Native-shape arrangements (\`OPF_ARRANGEMENT_V1\` on every node) are the layout's`,
`SmartArt layout part. A wrapped frame is read from its \`mc:Choice\`. A file in which only the fallback picture survived (an app without
SmartArt saved it) imports the same way in \`full\` provenance: the picture carries \`OPF_SMARTART_V1\` too, with the media keys of its
SVG and PNG, so a picture still named for its list whose SVG or PNG is the one written is that list on its layout again; a replaced
picture reports \`invalid-smartart-provenance\` and imports as a picture, as does any fallback without the record. Native-shape arrangements (\`OPF_ARRANGEMENT_V1\` on every node) are the layout's`],
]);
edit('docs/shapes.md', [[`See [Pyramids, matrices and live SmartArt](smartart.md) for the geometry, the domain PowerPoint was compared on and what PowerPoint does when a node is edited.`,
`Each live SmartArt is an \`mc:AlternateContent\` whose fallback is OPF's preview of the frame as an SVG picture over a PNG: PowerPoint shows the live SmartArt, an app that does not lay SmartArt out shows OPF's drawing, and import reads either. See [Pyramids, matrices and live SmartArt](smartart.md) for the geometry, the domain PowerPoint was compared on, what each app shows and what PowerPoint does when a node is edited or the file is saved again.`]]);
edit('skills/opf-export/SKILL.md', [[`\`--smart-art shapes\` (\`smartArt: 'shapes'\`) always writes native shapes. A node edited in PowerPoint keeps OPF's text size; PowerPoint lays the SmartArt out again with its own rules |`,
`\`--smart-art shapes\` (\`smartArt: 'shapes'\`) always writes native shapes. Each live SmartArt carries OPF's preview of its frame as an \`mc:Fallback\` picture (SVG over PNG, the outline as alt text), which every app that does not lay SmartArt out shows; it needs opf-render and an SVG rasterizer (a browser passes \`svgRasterizer\`), without which the arrangement is native shapes. A node edited in PowerPoint keeps OPF's text size; PowerPoint lays the SmartArt out again with its own rules, and saving there drops the fallback |`]]);
console.log('docs edited');
