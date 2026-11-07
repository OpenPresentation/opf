const S = 'packages/render/src/shapes.js';
export default [
  [S, `  return helpers.tag("radialGradient", { id, gradientUnits: "userSpaceOnUse", cx: 0, cy: 0, r: 1, gradientTransform: \`matrix(\${number(box.width / Math.SQRT2)} 0 0 \${number(box.height / Math.SQRT2)} \${number(cx)} \${number(cy)})\` }, stops);
}`, `  // PowerPoint's path gradients run from the center as the square of the distance: at d from the center, a share 0.6 (d / r)^2 of the
  // way through the stops, r the frame's half width or height (measured on PowerPoint 365's circle path). The preview samples that
  // curve at RADIAL_SAMPLES stops on an ellipse that reaches the last stop at r / sqrt(0.6), and pads beyond it.
  const samples = Array.from({ length: RADIAL_SAMPLES + 1 }, (_, index) => index / RADIAL_SAMPLES).map(offset => {
    const color = sampleStops(gradient.stops, offset * offset, helpers);
    return helpers.tag("stop", { offset: precise(offset), "stop-color": shadeColor(color.color, mode), "stop-opacity": color.alpha * alpha < 1 ? precise(color.alpha * alpha) : undefined });
  }).join("");
  const reach = 1 / Math.sqrt(RADIAL_SHARE);
  return helpers.tag("radialGradient", { id, gradientUnits: "userSpaceOnUse", cx: 0, cy: 0, r: 1, gradientTransform: \`matrix(\${number(box.width / 2 * reach)} 0 0 \${number(box.height / 2 * reach)} \${number(cx)} \${number(cy)})\` }, samples);
}
const RADIAL_SHARE = 0.6, RADIAL_SAMPLES = 16;
// The color \`t\` of the way through gradient stops, interpolated on sRGB values and alpha as SVG does.
function sampleStops(stops, t, helpers) {
  const paints = stops.map(stop => ({ position: stop.position, ...paintOf(stop.color, helpers, "#000000") }));
  if (t <= paints[0].position) return paints[0];
  const after = paints.findIndex(stop => stop.position >= t);
  if (after < 0) return paints[paints.length - 1];
  const a = paints[after - 1], b = paints[after], k = b.position > a.position ? (t - a.position) / (b.position - a.position) : 1;
  const channel = at => Math.round(parseInt(a.color.slice(at, at + 2), 16) * (1 - k) + parseInt(b.color.slice(at, at + 2), 16) * k).toString(16).padStart(2, "0");
  return { color: \`#\${channel(1)}\${channel(3)}\${channel(5)}\`.toUpperCase(), alpha: a.alpha * (1 - k) + b.alpha * k };
}`],
  [S, `// A gradient (core ComposedGradient) in the frame \`box\`: linear along its angle across the box; radial, rectangle and shape as an
// ellipse from the center through the corners (the preview's approximation of DrawingML's rect and shape paths).`, `// A gradient (core ComposedGradient) in the frame \`box\`: linear along its angle across the box; radial, rectangle and shape as an
// ellipse from the center (the preview's approximation of DrawingML's rect and shape paths, which follow the frame and the outline).`],
];
