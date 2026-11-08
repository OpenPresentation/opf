/** SH-21: Basic Venn's geometry, measured in 20 frame sizes for each of 1 to 7 entries.
 * One to four entries put text inside their circles. Five to seven put labels around the circles; the labels are not the node outlines.
 * All coordinates below are proportions of a fitted frame, independent of text or slide size. No entry count is clamped.
 */
export interface VennBox { x: number; y: number; width: number; height: number }
export interface VennNode { index: number; box: VennBox; textBox: VennBox; preset: 'ellipse'; adjust: 0; beside?: true }
type Rect = readonly [number, number, number, number];
/** Canonical circle and label rectangles around the frame's center, measured in a 600 x 400 pt frame. */
const OUTSIDE: Readonly<Record<5 | 6 | 7, { width: number; circles: readonly Rect[]; labels: readonly Rect[] }>> = {
  5: { width: 560, circles: [[230,114,140,140],[283.256,152.68,140,140],[262.928,215.32,140,140],[197.072,215.32,140,140],[176.744,152.68,140,140]],
    labels: [[218.8,0,162.4,94],[434.4,124,145.6,102],[412,298,145.6,102],[42.4,298,145.6,102],[20,124,145.6,102]] },
  6: { width: 514, circles: [[238.32,92.08,123.36,123.36],[278.3606,115.2,123.36,123.36],[278.3606,161.44,123.36,123.36],[238.32,184.6,123.36,123.36],[198.2794,161.44,123.36,123.36],[198.2794,115.2,123.36,123.36]],
    labels: [[222.9,0,154.2,84],[410.8698,80,146.1302,92],[410.8698,217.2,146.1302,102.8],[222.9,316,154.2,84],[43,217.2,146.1302,102.8],[43,80,146.1302,102.8]] },
  7: { width: 543.6, circles: [[234.768,101.84,130.464,130.48],[273.0374,120.24,130.464,130.48],[282.4417,161.64,130.464,130.48],[255.9684,194.84,130.464,130.48],[213.5676,194.84,130.464,130.48],[187.0943,161.64,130.464,130.48],[196.4985,120.24,130.464,130.48]],
    labels: [[225.255,0,149.49,80],[419.592,76,141.336,88],[433.182,188,138.618,94],[373.386,314,149.49,86],[77.124,314,149.49,86],[28.2,188,138.618,94],[39.072,76,141.336,88]] },
};
/** PowerPoint's Basic Venn nodes in any nonempty frame; counts outside the measured 1–7 domain are refused. */
export function vennNodes(frame: VennBox, count: number): VennNode[] {
  if (!Number.isInteger(count) || count < 1 || count > 7) throw new RangeError('Basic Venn geometry is measured for 1 to 7 entries');
  if (![frame.x, frame.y, frame.width, frame.height].every(Number.isFinite) || frame.width <= 0 || frame.height <= 0) throw new RangeError('Venn frame must be finite with positive width and height');
  const cx = frame.x + frame.width / 2, cy = frame.y + frame.height / 2;
  const inside = (index: number, x: number, y: number, diameter: number): VennNode => { const box = { x, y, width: diameter, height: diameter }; return { index, box, textBox: { ...box }, preset: 'ellipse', adjust: 0 }; };
  if (count === 1) { const d = Math.min(frame.width, frame.height); return [inside(0, cx - d / 2, cy - d / 2, d)]; }
  if (count === 2) { const w = Math.min(frame.width, 1.792 * frame.height), d = .555 * w; return [-1, 1].map((side, index) => inside(index, cx + side * .2 * w - d / 2, cy - d / 2, d)); }
  if (count === 3) { const h = Math.min(frame.height, frame.width / 1.033), d = .6 * h; return [[0,-.4875],[.2165,-.1125],[-.2165,-.1125]].map(([x,y],index) => inside(index,cx + x! * h - d / 2,cy + y! * h,d)); }
  if (count === 4) { const h = Math.min(frame.width, frame.height), d = .52 * h; return [[0,-.23],[.23,0],[0,.23],[-.23,0]].map(([x,y],index) => inside(index,cx + x! * h - d / 2,cy + y! * h - d / 2,d)); }
  const design = OUTSIDE[count as 5 | 6 | 7], scale = Math.min(frame.width / design.width, frame.height / 400);
  const box = ([x,y,width,height]: Rect): VennBox => ({x:cx + (x - 300) * scale,y:cy + (y - 200) * scale,width:width * scale,height:height * scale});
  return design.circles.map((circle,index) => ({ index, box:box(circle), textBox:box(design.labels[index]!), preset:'ellipse', adjust:0, beside:true }));
}
