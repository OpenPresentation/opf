const S = 'packages/render/src/shapes.js';
export default [
  [S, `// DrawingML path fill modes: lighten is a 60% tint, lightenLess 80%, darken a 60% shade, darkenLess 80%, in linear RGB.`, `// DrawingML path fill modes as PowerPoint draws them: lighten mixes 40% white into the fill, lightenLess 20%, darken scales it to 60%,
// darkenLess to 80%, on the sRGB values (measured in PowerPoint 365's export of can, cube and bevel).`],
  [S, `  const channels = [1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16) / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  const mixed = channels.map(value => kind === "shade" ? value * amount : value * amount + (1 - amount));
  return \`#\${mixed.map(value => value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055).map(value => Math.round(Math.min(1, Math.max(0, value)) * 255).toString(16).padStart(2, "0")).join("").toUpperCase()}\`;`,
  `  const channels = [1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16) / 255);
  const mixed = channels.map(value => kind === "shade" ? value * amount : value * amount + (1 - amount));
  return \`#\${mixed.map(value => Math.round(Math.min(1, Math.max(0, value)) * 255).toString(16).padStart(2, "0")).join("").toUpperCase()}\`;`],
];
