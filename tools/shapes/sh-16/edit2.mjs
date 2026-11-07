import {readFileSync, writeFileSync} from 'node:fs';
const p = process.argv[2];
let s = readFileSync(p, 'utf8');
const swap = (a, b) => { if (!s.includes(a)) throw new Error('missing: ' + a.slice(0, 90)); s = s.replace(a, b); };
swap(`/**
 * SH-16: OPF's preview of one SmartArt frame, from the slide's SVG as opf-render draws it with \`trace\`: the arrangement's drawing and
 * its entries' text (each element with its ancestors, so their transforms and clips apply), with the definitions they use, cropped to
 * the frame. Nothing else of the slide is drawn, so the picture is transparent around the drawing.
 */
export function smartArtRegionSvg(svg, arrangement) {`,
`// The miter limit opf-render strokes the arrangement's nodes with (stroke-miterlimit) and the antialiasing margin of the fallback picture.
const MITER_LIMIT = 8, ANTIALIAS = 1;

/**
 * SH-16: how far the preview's ink reaches outside the SmartArt frame (canvas px): the nodes' outlines, centered on their edges, with
 * the miter joins of a polygon's corners (a pyramid level's base corners reach furthest), plus a pixel of antialiasing. The fallback
 * picture grows by it on every side, so it draws everything the preview draws. Rounded up to whole EMU.
 */
export function smartArtBleed(arrangement) {
  const {frame} = arrangement, half = arrangement.lineWidth / 2, points = [];
  if (arrangement.background) {
    const {x, y, width, height} = arrangement.background;
    points.push([x, y], [x + width, y + height]);
  }
  for (const node of arrangement.nodes) {
    if (!node.points) {
      const {x, y, width, height} = node.box;
      points.push([x - half, y - half], [x + width + half, y + height + half]);
      continue;
    }
    node.points.forEach((point, index, all) => {
      const unit = ([dx, dy]) => { const length = Math.hypot(dx, dy) || 1; return [dx / length, dy / length]; };
      const previous = all[(index + all.length - 1) % all.length], next = all[(index + 1) % all.length];
      const u = unit([previous[0] - point[0], previous[1] - point[1]]), v = unit([next[0] - point[0], next[1] - point[1]]);
      // Each edge's stroke reaches half the width either side of it; a miter join reaches half the width over sin(angle / 2).
      for (const [dx, dy] of [u, v]) points.push([point[0] - dy * half, point[1] + dx * half], [point[0] + dy * half, point[1] - dx * half]);
      const sine = Math.sqrt(Math.max(0, (1 - (u[0] * v[0] + u[1] * v[1])) / 2));
      if (sine > 0 && 1 / sine <= MITER_LIMIT) {
        const bisector = unit([u[0] + v[0], u[1] + v[1]]);
        points.push([point[0] - bisector[0] * half / sine, point[1] - bisector[1] * half / sine]);
      }
    });
  }
  const reach = Math.max(0, ...points.flatMap(([x, y]) => [frame.x - x, frame.y - y, x - frame.x - frame.width, y - frame.y - frame.height]));
  return Math.ceil((reach + ANTIALIAS) * EMU) / EMU;
}

/**
 * SH-16: OPF's preview of one SmartArt frame, from the slide's SVG as opf-render draws it with \`trace\`: the arrangement's drawing and
 * its entries' text (each element with its ancestors, so their transforms and clips apply), with the definitions they use, cropped to
 * the frame grown by \`bleed\` on every side (smartArtBleed). Nothing else of the slide is drawn, so the picture is transparent around
 * the drawing.
 */
export function smartArtRegionSvg(svg, arrangement, bleed = 0) {`);
swap(`  const [x, y, width, height] = [frame.x, frame.y, frame.width, frame.height].map(svgNumber);`,
`  const [x, y, width, height] = [frame.x - bleed, frame.y - bleed, frame.width + 2 * bleed, frame.height + 2 * bleed].map(svgNumber);`);
// The export's faces in safe mode.
swap(`  if (!options.fonts) return toSvg(presentation, slideNumber, base);
  try { return toSvg(presentation, slideNumber, {...base, fonts: options.fonts, text: 'paths'}); }
  catch (error) {
    if (error?.code !== 'text-as-paths-needs-fonts') throw error;
    return toSvg(presentation, slideNumber, {...base, fonts: options.fonts});
  }`,
`  if (!options.fonts) return toSvg(presentation, slideNumber, base);
  // \`typefaces: "safe"\`: the slide is laid out and drawn with the Office-safe families the export writes, as the export lays it out.
  const fonts = options.safeTypeface && options.fonts.textMeasurement
    ? Object.create(options.fonts, {textMeasurement: {value: safeMeasurement(options.fonts.textMeasurement, options.safeTypeface), enumerable: true}}) : options.fonts;
  try { return toSvg(presentation, slideNumber, {...base, fonts, text: 'paths'}); }
  catch (error) {
    if (error?.code !== 'text-as-paths-needs-fonts') throw error;
    return toSvg(presentation, slideNumber, {...base, fonts});
  }`);
swap(`import {svgBlipRelationship} from './svg-image.js';`, `import {safeMeasurement} from './safe-typefaces.js';
import {svgBlipRelationship} from './svg-image.js';`);
// addArrangements: the placing function returns the bleed.
swap(`      picture();
      const tag =`, `      const bleed = picture();
      const tag =`);
swap(`fallback: {name: fallbackName, alt, tag}});`, `fallback: {name: fallbackName, alt, tag, bleed}});`);
writeFileSync(p, s);
console.log('ok');
