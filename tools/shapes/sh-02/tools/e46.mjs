const R = 'packages/render/src/shapes.js';
export default [
  [R, `// A gradient (core ComposedGradient) in the frame \`box\`: linear along its angle across the box; radial, rectangle and shape as an
// ellipse from the center (the preview's approximation of DrawingML's rect and shape paths, which follow the frame and the outline).`,
  `// A gradient (core ComposedGradient) in the frame \`box\` drawn as an SVG paint: linear along its angle across the box, radial (and a shape
// gradient PowerPoint draws as its circle gradient) as a circle. Rectangle and outline-following shape gradients are fans (fanElements).`],
  [R, `    // PowerPoint mixes a gradient's colors in linear light and eases each span between two stops (smoothstep): the preview samples
    // the gradient so SVG's straight sRGB mixing between samples stays within a level or two of it.`,
  `    // The preview samples the gradient as PowerPoint mixes it (sampleStops) so SVG's straight sRGB mixing between samples stays within
    // a level or two of it.`],
  [R, `// The color \`t\` of the way through gradient stops, as PowerPoint draws it: within the span of two stops eased by smoothstep and mixed
// in linear light; the alpha mixed the same way.`,
  `// The color \`t\` of the way through gradient stops, as PowerPoint 365 draws it (measured on linear and rectangle gradients): a gradient of
// exactly two stops at 0 and 1 is eased by smoothstep and mixed in linear light; any other gradient (more stops, or a stop inside) is
// mixed straight in sRGB between neighboring stops. The alpha is mixed the same way.`],
  [R, `  const a = paints[after - 1], b = paints[after], linear = b.position > a.position ? (t - a.position) / (b.position - a.position) : 1, k = linear * linear * (3 - 2 * linear);
  const channel = at => {
    const mixed = toLinear(parseInt(a.color.slice(at, at + 2), 16) / 255) * (1 - k) + toLinear(parseInt(b.color.slice(at, at + 2), 16) / 255) * k;
    return Math.round(Math.min(1, Math.max(0, toSrgb(mixed))) * 255).toString(16).padStart(2, "0");
  };`,
  `  const a = paints[after - 1], b = paints[after], linear = b.position > a.position ? (t - a.position) / (b.position - a.position) : 1;
  const eased = paints.length === 2 && paints[0].position === 0 && paints[1].position === 1;
  const k = eased ? linear * linear * (3 - 2 * linear) : linear;
  const space = eased ? [toLinear, toSrgb] : [value => value, value => value];
  const channel = at => {
    const mixed = space[0](parseInt(a.color.slice(at, at + 2), 16) / 255) * (1 - k) + space[0](parseInt(b.color.slice(at, at + 2), 16) / 255) * k;
    return Math.round(Math.min(1, Math.max(0, space[1](mixed))) * 255).toString(16).padStart(2, "0");
  };`],
];
