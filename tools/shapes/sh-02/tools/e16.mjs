const S = 'spec/schemas/opf.schema.json';
export default [
  [S, `PPTX export writes a:custGeom with the same path; a subpath that ends without Z is an open path, which takes a line and arrowheads but no fill.`, `PPTX export writes a:custGeom with the same path. A subpath that ends without Z is open: arrowheads draw at its ends (its fill closes it, as in PowerPoint).`],
  [S, `Line width in reference pixels at a 720-pixel short edge. 0 removes the line. Default 1 on a shape, 2 on a picture.`, `Line width in reference pixels at a 720-pixel short edge. 0 removes the line. Default 4/3 (1 point, PowerPoint's default line) on a shape, 2 on a picture.`],
  [S, `Default 10 left and right, 5 top and bottom, PowerPoint's 0.1 and 0.05 inch.`, `Default 9.6 left and right, 4.8 top and bottom, PowerPoint's 0.1 and 0.05 inch.`],
  [S, `intense a solid accent1 fill with no line, light bold text and the theme's intense effect.`, `intense accent1 25% darker with no line, light bold text and the soft shadow.`],
];
