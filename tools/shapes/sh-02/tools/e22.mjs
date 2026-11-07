const S = 'packages/render/src/shapes.js';
export default [
  [S, `    // PowerPoint mixes a gradient's colors in linear light: the preview samples each span between two stops so SVG's sRGB mixing between
    // samples stays within a level of it.`, `    // PowerPoint mixes a gradient's colors in linear light and eases each span between two stops (smoothstep): the preview samples
    // the gradient so SVG's straight sRGB mixing between samples stays within a level or two of it.`],
  [S, `  // PowerPoint's path gradients (circle, measured on PowerPoint 365's export) do not run evenly from the center: the share of the way
  // through the stops at u = distance / half size follows RADIAL_CURVE, reaching the last stop at u = 1.16. The preview draws the
  // curve as stops on an ellipse of 1.16 times the half width and height, and pads beyond it.
  const reach = RADIAL_CURVE[RADIAL_CURVE.length - 1][0];
  const samples = RADIAL_CURVE.map(([u, t]) => stop(u / reach, t)).join("");`, `  // PowerPoint's path gradients run from the center to the frame's corners (an ellipse of sqrt(2) times the half width and height),
  // eased and mixed as a linear one (measured on PowerPoint 365's export of a:path circle).
  const reach = Math.SQRT2;
  const samples = Array.from({ length: GRADIENT_SAMPLES + 1 }, (_, index) => index / GRADIENT_SAMPLES).map(offset => stop(offset, offset)).join("");`],
  [S, `const GRADIENT_SAMPLES = 16;
// [u, t]: u the distance from the center over the half size, t the share of the way through the stops (PowerPoint 365, a:path circle).
const RADIAL_CURVE = Object.freeze([[0, 0], [0.125, 0.03], [0.25, 0.087], [0.38, 0.172], [0.5, 0.279], [0.6, 0.391], [0.7, 0.503], [0.8, 0.624], [0.9, 0.736], [0.96, 0.789], [1, 0.83], [1.08, 0.915], [1.16, 1]]);`, `const GRADIENT_SAMPLES = 24;`],
  [S, `// The color \`t\` of the way through gradient stops, mixed in linear light (as PowerPoint mixes gradient colors), and its alpha.`, `// The color \`t\` of the way through gradient stops, as PowerPoint draws it: within the span of two stops eased by smoothstep and mixed
// in linear light; the alpha mixed the same way.`],
  [S, `  const a = paints[after - 1], b = paints[after], k = b.position > a.position ? (t - a.position) / (b.position - a.position) : 1;
  const channel = at => {`, `  const a = paints[after - 1], b = paints[after], linear = b.position > a.position ? (t - a.position) / (b.position - a.position) : 1, k = linear * linear * (3 - 2 * linear);
  const channel = at => {`],
];
