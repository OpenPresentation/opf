/**
 * LH-02: the automatic scrim under text on a picture background.
 *
 * Text drawn over a photograph reads only as well as the photograph allows. When a slide's text sits on a picture background
 * and the author set no overlay, core adds a scrim in the slide's background color behind the text: a gradient from the
 * slide edge the text is near (as Claude Design draws it: from the bottom under a lower title, from the side under a text
 * column) or, for text in the middle of the slide, a band across it that fades out above and below. Its opacity is the lowest
 * (in hundredths) at which every text color reaches its target contrast over every pixel the picture could have under the
 * text: the gray ramp from black to white (the bound `opf/text-on-image` uses), or the range of gray the host measured there
 * (`ComposeSlideOptions.pictureLuminance`). Both engines draw the composed scrim: the preview as an SVG linear gradient, the
 * PPTX export as one native rectangle with a gradient (or solid) fill whose stops carry alpha.
 */

/** A rectangle in canvas pixels. */
export interface ScrimBox { x: number; y: number; width: number; height: number }
/** A physical slide edge. */
export type ScrimEdge = 'left' | 'right' | 'top' | 'bottom';

/** One automatic scrim of a picture background (SlideComposition.backgroundImage.scrims). */
export interface ComposedScrim {
  /** The key that controls it: the background's `overlay` (an overlay of the author's replaces the scrim, `false` turns it off). */
  path: string;
  /** Scrim color: the slide's background color (`roles.background`, bg1 of the slide's variant), opaque `#RRGGBB`. */
  color: string;
  /** Opacity under the text, 0 to 1 in hundredths: the lowest at which the text reads at `target` over every possible pixel. */
  opacity: number;
  /** `gradient`: solid from `edge` to past the text, then fading out; `band`: solid across the text, fading out on both sides. */
  form: 'gradient' | 'band';
  /** The slide edge a gradient starts from (physical, so already mirrored in a right-to-left deck). Absent for a band. */
  edge?: ScrimEdge;
  /** The rectangle drawn: the full slide width (top, bottom and band) or height (left and right), clipped to the slide. */
  box: ScrimBox;
  /** The axis the stops run along: `vertical` from the box's top edge, `horizontal` from its left edge. */
  axis: 'vertical' | 'horizontal';
  /** Opacity stops along the axis, positions 0 to 1 ascending; every stop is either 0 or `opacity`. */
  stops: { position: number; opacity: number }[];
  /** The region the scrim covers at full opacity: its group's text boxes plus a margin, clipped to the slide. */
  text: ScrimBox;
  /** The contrast the slide text color reaches over the worst pixel through the scrim. */
  contrast: number;
  /** The contrast the opacity was chosen for (4.5:1). */
  target: number;
  /** `worst-case`: any pixel from black to white; `sampled`: the gray range the host measured under the text (`grays`). */
  basis: 'worst-case' | 'sampled';
  /** The darkest and lightest gray (0 to 255, sRGB) of the picture under the text, when sampled. */
  grays?: [number, number];
}

/** A luminance grid of a picture: `values` are WCAG relative luminances (0 to 1), `columns` × `rows` cells in row order over the whole picture. */
export interface PictureLuminance { columns: number; rows: number; values: ArrayLike<number> }

/** The contrast a scrim keeps under text over a picture: 4.5:1, WCAG's normal-text minimum, for every size. */
export const SCRIM_TARGET_CONTRAST = 4.5;
/** Margin around the text the scrim covers at full opacity, in reference pixels (a 720 px tall slide). */
export const SCRIM_MARGIN = 24;
/** How far a scrim fades out past its solid part, as a share of the slide along the scrim's axis. */
export const SCRIM_FADE = 0.2;

type Rgb = [number, number, number];
const channels = (hex: string): Rgb => [1, 3, 5].map(at => Number.parseInt(hex.slice(at, at + 2), 16)) as Rgb;
const linear = (c: number) => { const n = c / 255; return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4; };
const luminanceOf = ([r, g, b]: Rgb) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
// Compositing in sRGB with whole channel values, as every renderer and the contrast rules (rule-design blend) do.
const over = (fg: Rgb, bg: Rgb, alpha: number): Rgb => fg.map((c, i) => Math.max(0, Math.min(255, Math.round(c * alpha + bg[i]! * (1 - alpha))))) as Rgb;
const opaque = (value: string | undefined): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const hex = value.trim();
  if (/^#[0-9a-f]{3}$/i.test(hex)) return `#${[...hex.slice(1)].map(c => c + c).join('')}`.toUpperCase();
  if (/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(hex)) return hex.slice(0, 7).toUpperCase();
  return undefined;
};
/** The sRGB gray (0 to 255) whose relative luminance is `value`. */
export function grayOfLuminance(value: number): number {
  const v = Math.max(0, Math.min(1, value));
  return 255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);
}

/**
 * The lowest opacity, in hundredths, of `scrim` over every pixel in `pixels` at which each text color reaches its target; 1 when
 * a color cannot reach it even on the solid scrim (it then reads as on the plain slide). Each pixel is opaque `#RRGGBB`.
 */
export function scrimOpacity(texts: readonly { color: string; target: number }[], scrim: string, pixels: readonly string[]): { opacity: number; contrast: number } {
  const fill = channels(opaque(scrim) ?? '#000000'), under = pixels.map(pixel => channels(opaque(pixel) ?? '#000000'));
  const colors = texts.flatMap(text => { const hex = opaque(text.color); return hex ? [{ luminance: luminanceOf(channels(hex)), target: text.target }] : []; });
  const worst = (alpha: number, luminance: number) => Math.min(...under.map(pixel => contrast(luminance, luminanceOf(over(fill, pixel, alpha)))));
  // A color the solid scrim cannot carry to its target asks for no more than the solid scrim gives it.
  const goals = colors.map(color => ({ ...color, goal: Math.min(color.target, worst(1, color.luminance)) }));
  const reads = (alpha: number) => goals.every(color => worst(alpha, color.luminance) >= color.goal - 1e-9);
  let low = 0, high = 100;
  if (reads(0)) high = 0;
  else while (high - low > 1) { const middle = (low + high) >> 1; if (reads(middle / 100)) high = middle; else low = middle; }
  const opacity = high / 100;
  return { opacity, contrast: colors.length ? Math.round(worst(opacity, colors[0]!.luminance) * 100) / 100 : 21 };
}

/** The union of boxes. */
function union(boxes: readonly ScrimBox[]): ScrimBox {
  const x = Math.min(...boxes.map(box => box.x)), y = Math.min(...boxes.map(box => box.y));
  const right = Math.max(...boxes.map(box => box.x + box.width)), bottom = Math.max(...boxes.map(box => box.y + box.height));
  return { x, y, width: right - x, height: bottom - y };
}
const r4 = (value: number) => Math.round(value * 1e4) / 1e4;
const r2 = (value: number) => Math.round(value * 100) / 100;

/**
 * The form of a scrim over `text` (the union of the text boxes) on a `width` × `height` slide: a gradient from the bottom edge when the
 * text sits in the lower part of the slide, from the top when it sits in the upper part, from the side when it is a column at the
 * left or right; else a band across the text. `margin` pads the text; the scrim fades out over `fade` of the slide past its solid part.
 */
export function scrimGeometry(text: ScrimBox, width: number, height: number, margin: number): Pick<ComposedScrim, 'form' | 'edge' | 'box' | 'axis' | 'text'> & { solid: [number, number] } {
  const padded = { x: Math.max(0, text.x - margin), y: Math.max(0, text.y - margin), right: Math.min(width, text.x + text.width + margin), bottom: Math.min(height, text.y + text.height + margin) };
  const covered: ScrimBox = { x: padded.x, y: padded.y, width: padded.right - padded.x, height: padded.bottom - padded.y };
  const bottomGap = height - (text.y + text.height), rightGap = width - (text.x + text.width);
  const vertical = (edge: ScrimEdge | undefined) => {
    const fade = SCRIM_FADE * height;
    const top = edge === 'top' ? 0 : Math.max(0, padded.y - fade), bottom = edge === 'bottom' ? height : Math.min(height, padded.bottom + fade);
    return { form: edge ? 'gradient' as const : 'band' as const, ...(edge ? { edge } : {}), axis: 'vertical' as const, box: { x: 0, y: top, width, height: bottom - top }, text: covered, solid: [edge === 'top' ? 0 : padded.y, edge === 'bottom' ? height : padded.bottom] as [number, number] };
  };
  if (bottomGap <= 0.3 * height && text.y >= 0.35 * height) return vertical('bottom');
  if (text.y <= 0.3 * height && text.y + text.height <= 0.65 * height) return vertical('top');
  if (text.width <= 0.5 * width && (text.x <= 0.25 * width || rightGap <= 0.25 * width)) {
    const edge: ScrimEdge = text.x <= rightGap ? 'left' : 'right', fade = SCRIM_FADE * width;
    const left = edge === 'left' ? 0 : Math.max(0, padded.x - fade), right = edge === 'right' ? width : Math.min(width, padded.right + fade);
    return { form: 'gradient', edge, axis: 'horizontal', box: { x: left, y: 0, width: right - left, height }, text: covered, solid: [edge === 'left' ? 0 : padded.x, edge === 'right' ? width : padded.right] };
  }
  return vertical(undefined);
}

/** The opacity stops of a scrim along its axis: 0 where it fades out, `opacity` over its solid part. */
function scrimStops(box: ScrimBox, axis: 'vertical' | 'horizontal', solid: [number, number], opacity: number): ComposedScrim['stops'] {
  const start = axis === 'vertical' ? box.y : box.x, span = (axis === 'vertical' ? box.height : box.width) || 1;
  const from = r4((solid[0] - start) / span), to = r4((solid[1] - start) / span);
  const stops = [...(from > 0 ? [{ position: 0, opacity: 0 }] : []), { position: Math.max(0, from), opacity }, { position: Math.min(1, to), opacity }, ...(to < 1 ? [{ position: 1, opacity: 0 }] : [])];
  return stops;
}

/** Min and max gray of a luminance grid over a region given as fractions (0 to 1) of the picture; undefined when the grid is unusable. */
export function sampledGrays(grid: PictureLuminance | undefined, region: { left: number; top: number; right: number; bottom: number }): [number, number] | undefined {
  if (!grid || !Number.isInteger(grid.columns) || !Number.isInteger(grid.rows) || grid.columns < 1 || grid.rows < 1 || grid.values?.length !== grid.columns * grid.rows) return undefined;
  const c0 = Math.max(0, Math.floor(region.left * grid.columns)), c1 = Math.min(grid.columns - 1, Math.ceil(region.right * grid.columns) - 1);
  const r0 = Math.max(0, Math.floor(region.top * grid.rows)), r1 = Math.min(grid.rows - 1, Math.ceil(region.bottom * grid.rows) - 1);
  if (c1 < c0 || r1 < r0) return undefined;
  let low = Infinity, high = -Infinity;
  for (let row = r0; row <= r1; row++) for (let column = c0; column <= c1; column++) {
    const value = Number(grid.values[row * grid.columns + column]);
    if (!Number.isFinite(value)) return undefined;
    low = Math.min(low, value); high = Math.max(high, value);
  }
  return [Math.floor(grayOfLuminance(low)), Math.ceil(grayOfLuminance(high))];
}

/** Inputs of one picture background's scrims. */
export interface ScrimInput {
  /** The background's path (`slides.N.design.background`, `design.background` or `theme`). */
  path: string;
  width: number;
  height: number;
  /**
   * The boxes whose text is drawn straight on the picture (not on a card, panel or emphasis surface), in groups that each get a scrim
   * of their own: the body and headings, the header, the footer. Groups whose solid parts meet along the same axis share one scrim.
   */
  groups: readonly (readonly ScrimBox[])[];
  /** The text colors drawn there with the contrast each must reach. */
  texts: readonly { color: string; target: number }[];
  /** The scrim color (the slide's background color). */
  color: string;
  /** The canvas colors a translucent picture shows through to (the slide background, and white, which the contrast rules assume). */
  bases: readonly string[];
  /** Picture opacity below 1. */
  opacity?: number;
  /** The picture's whole rectangle on the slide (its fit placement), when known: sampling maps the text region into it. */
  picture?: ScrimBox;
  /** The host's luminance grid of the picture, when it measured one (and the picture is not recolored). */
  luminance?: PictureLuminance;
  /** Reference pixels per canvas pixel: min(width, height) / 720. */
  scale: number;
}

type Geometry = ReturnType<typeof scrimGeometry>;
/** Two scrims along one axis whose solid parts meet are one scrim over both texts; scrims across each other stay apart. */
const meets = (a: Geometry, b: Geometry) => a.axis === b.axis && a.solid[0] <= b.solid[1] && b.solid[0] <= a.solid[1];

/**
 * The automatic scrims of one picture background, in paint order: one per group of text (the body, the header, the footer), merged
 * where they meet, all at one opacity. Empty when no text sits on the picture or the picture needs none (opacity 0).
 */
export function pictureScrims(input: ScrimInput): ComposedScrim[] {
  const margin = SCRIM_MARGIN * input.scale;
  let groups = input.groups.map(group => group.filter(box => box.width > 0 && box.height > 0)).filter(group => group.length).map(group => union(group));
  if (!groups.length || !input.texts.length) return [];
  let shapes = groups.map(text => scrimGeometry(text, input.width, input.height, margin));
  for (let merged = true; merged;) {
    merged = false;
    for (let i = 0; i < shapes.length && !merged; i++) for (let j = i + 1; j < shapes.length && !merged; j++) if (meets(shapes[i]!, shapes[j]!)) {
      groups = [...groups.filter((_, k) => k !== i && k !== j), union([groups[i]!, groups[j]!])];
      shapes = groups.map(text => scrimGeometry(text, input.width, input.height, margin));
      merged = true;
    }
  }
  const color = opaque(input.color) ?? '#000000';
  // The pixels the text can sit on: the sampled grays under the text, else every gray; a picture that does not cover the text shows the canvas.
  let grays: [number, number] | undefined, outside = false;
  const picture = input.picture && input.picture.width > 0 && input.picture.height > 0 ? input.picture : undefined;
  // Without the picture's placement (core could not read its proportions), the whole picture's range bounds any crop of it.
  if (input.luminance && !picture) grays = sampledGrays(input.luminance, { left: 0, top: 0, right: 1, bottom: 1 });
  else if (input.luminance && picture) {
    const ranges = shapes.map(({ text }) => sampledGrays(input.luminance, { left: (text.x - picture.x) / picture.width, top: (text.y - picture.y) / picture.height, right: (text.x + text.width - picture.x) / picture.width, bottom: (text.y + text.height - picture.y) / picture.height }));
    if (ranges.every(range => range)) grays = [Math.min(...ranges.map(range => range![0])), Math.max(...ranges.map(range => range![1]))];
    outside = shapes.some(({ text }) => text.x < picture.x - 0.5 || text.y < picture.y - 0.5 || text.x + text.width > picture.x + picture.width + 0.5 || text.y + text.height > picture.y + picture.height + 0.5);
  }
  const [low, high] = grays ?? [0, 255];
  const ramp: string[] = [];
  for (let gray = low; gray <= high; gray++) {
    const hex = `#${gray.toString(16).padStart(2, '0').repeat(3)}`.toUpperCase();
    if (input.opacity === undefined || input.opacity >= 1) ramp.push(hex);
    else for (const base of input.bases) { const canvas = opaque(base); if (canvas) ramp.push(`#${over(channels(hex), channels(canvas), input.opacity).map(c => c.toString(16).padStart(2, '0')).join('')}`.toUpperCase()); }
  }
  if (outside) for (const base of input.bases) { const canvas = opaque(base); if (canvas) ramp.push(canvas); }
  const { opacity, contrast: reached } = scrimOpacity(input.texts, color, ramp);
  if (opacity <= 0) return [];
  return shapes.map(({ solid, ...shape }) => ({
    path: `${input.path}.overlay`, color, opacity, ...shape,
    box: { x: r2(shape.box.x), y: r2(shape.box.y), width: r2(shape.box.width), height: r2(shape.box.height) },
    text: { x: r2(shape.text.x), y: r2(shape.text.y), width: r2(shape.text.width), height: r2(shape.text.height) },
    stops: scrimStops(shape.box, shape.axis, solid, opacity), contrast: reached, target: SCRIM_TARGET_CONTRAST,
    basis: grays ? 'sampled' as const : 'worst-case' as const, ...(grays ? { grays } : {}),
  }));
}
