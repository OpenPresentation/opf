const schemeColorSlots = new Set([
  'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6',
  'dark1', 'dark2', 'light1', 'light2', 'hyperlink', 'followedHyperlink',
]);

const schemeColorRoles = new Set([
  'primary', 'secondary', 'accent', 'background', 'surface', 'text', 'textSecondary',
]);

const defaultRoleSlots: Record<string, string> = {
  primary: 'accent1',
  secondary: 'accent2',
  accent: 'accent3',
  background: 'light1',
  surface: 'light2',
  text: 'dark1',
  textSecondary: 'dark2',
};

/** Normalize a literal hex color to uppercase #RRGGBB. */
export function normalizeHexColor(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  let hex = value.trim();
  if (/^#[0-9a-f]{3}$/i.test(hex)) hex = `#${[...hex.slice(1)].map((char) => char + char).join('')}`;
  if (/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(hex)) return hex.length === 9 ? `#${hex.slice(1, 7).toUpperCase()}` : hex.toUpperCase();
  return undefined;
}

export type ResolveColorRefRoles = Partial<Record<
  'primary' | 'secondary' | 'accent' | 'background' | 'surface' | 'text' | 'textSecondary',
  string
>>;

export interface ResolveColorRefOptions {
  /** Effective color scheme after design resolution (OOXML slots plus optional role hex overrides). */
  colorScheme: Record<string, unknown>;
  /** Optional resolved chrome colors (e.g. renderer `design.colors` with `textSecondary` mapped to `mutedText`). */
  roles?: ResolveColorRefRoles;
  /** Top-level presentation `variables` map. */
  variables?: Record<string, unknown>;
  /** Theme text color returned when a reference cannot be resolved. */
  fallback: string;
}

function schemeSlot(colorScheme: Record<string, unknown>, slot: string, fallback: string): string {
  return normalizeHexColor(colorScheme[slot]) ?? fallback;
}

function resolveVariable(variables: Record<string, unknown>, id: string, fallback: string): string {
  const entry = variables[id];
  if (typeof entry === 'string') return normalizeHexColor(entry) ?? fallback;
  if (entry && typeof entry === 'object' && (entry as { type?: string }).type === 'color') {
    return normalizeHexColor((entry as { value?: unknown }).value) ?? fallback;
  }
  return fallback;
}

/** Resolve a ColorRef or TextRun.color string to a literal hex color. */
export function resolveColorRef(reference: string, options: ResolveColorRefOptions): string {
  const { colorScheme, roles, variables = {}, fallback } = options;
  const literal = normalizeHexColor(reference);
  if (literal) return literal;

  if (reference.startsWith('var:')) {
    const id = reference.slice('var:'.length);
    if (/^[a-z][a-z0-9-]*$/.test(id)) return resolveVariable(variables, id, fallback);
    return fallback;
  }

  if (schemeColorRoles.has(reference)) {
    const roleKey = reference as keyof ResolveColorRefRoles;
    const fromRoles = roles?.[roleKey];
    if (fromRoles) return normalizeHexColor(fromRoles) ?? fallback;
    const fromScheme = normalizeHexColor(colorScheme[reference]);
    if (fromScheme) return fromScheme;
    const slot = defaultRoleSlots[reference];
    return slot ? schemeSlot(colorScheme, slot, fallback) : fallback;
  }

  if (schemeColorSlots.has(reference)) return schemeSlot(colorScheme, reference, fallback);

  return fallback;
}

/** WCAG relative luminance below which a slide background counts as dark (the point where white and black text contrast equally). */
export const DARK_BACKGROUND_LUMINANCE = 0.179;

/** True when text on this color should be light: its relative luminance is under {@link DARK_BACKGROUND_LUMINANCE}. An unreadable color is not dark. */
export function isDarkColor(color: unknown): boolean {
  const hex = normalizeHexColor(color);
  const value = hex ? luminance(hex) : undefined;
  return value !== undefined && value < DARK_BACKGROUND_LUMINANCE;
}

/**
 * The slide background a color scheme implies when the design names no single-color background: the scheme's
 * `background` role override, else its light1 slot, else white. Gradient and picture backgrounds use it too.
 */
export function defaultSlideBackground(colorScheme: Record<string, unknown>): string {
  return keepAlpha(colorScheme.background) ?? slotKeepingAlpha(colorScheme, 'light1', '#FFFFFF');
}

/** A hex color as uppercase #RRGGBB, keeping an #RRGGBBAA alpha byte (a translucent scheme surface stays translucent). */
function keepAlpha(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const hex = value.trim();
  if (/^#[0-9a-f]{8}$/i.test(hex)) return hex.toUpperCase();
  return normalizeHexColor(hex);
}

function slotKeepingAlpha(colorScheme: Record<string, unknown>, slot: string, fallback: string): string {
  return keepAlpha(colorScheme[slot]) ?? fallback;
}

/** The OOXML theme hyperlink colors a scheme without hyperlink slots gets (the Office theme values the PPTX export writes). */
const DEFAULT_HYPERLINK = '#0563C1';
const DEFAULT_FOLLOWED_HYPERLINK = '#954F72';

/** The link color a slide draws: the scheme's, unless it is hard to read on this background (the rule the slide tag follows for the primary color). */
const MIN_LINK_CONTRAST = 4.5;
function readableLink(link: string, background: string, text: string): string {
  const linkHex = normalizeHexColor(link), backgroundHex = normalizeHexColor(background);
  const contrast = linkHex && backgroundHex ? colorContrast(linkHex, backgroundHex) : undefined;
  return contrast !== undefined && contrast < MIN_LINK_CONTRAST ? text : link;
}

export interface ResolvedColorRoles {
  /** Role override, else accent1. */
  primary: string;
  /** Role override, else accent2. */
  secondary: string;
  /** Role override, else accent3. */
  accent: string;
  /** The slide background: the resolved single-color background of the slide, else {@link defaultSlideBackground}. */
  background: string;
  /** Role override, else dark2 on a dark background and light2 on a light one. */
  surface: string;
  /** Default text. On a dark background light1. On a light background the `text` role override, else dark1. */
  text: string;
  /** Role override, else light2 on a dark background and dark2 on a light one. */
  textSecondary: string;
  /** The color of a link run that sets no color of its own: the scheme's hyperlink slot (OOXML hlink), unless that has under 4.5:1 contrast against the slide background, then the slide `text` color. */
  hyperlink: string;
  /** Followed-hyperlink slot (OOXML folHlink). */
  followedHyperlink: string;
  /** Whether the slide background is dark; text, surface and textSecondary defaults follow it. */
  dark: boolean;
}

export interface ResolveColorRolesOptions {
  /** The slide's resolved single-color background (solid, theme-slot or pattern background color). Omit for a gradient, picture or no background. */
  background?: string | null;
}

/**
 * Resolve a color scheme's abstract roles for one slide: the single definition the opf-render preview, the
 * PPTX export and the audit share, so the same deck draws the same colors in all three. Role overrides on the
 * scheme (`primary`, `secondary`, `accent`, `background`, `surface`, `text`, `textSecondary`) win over the slots they
 * default to. The background-dependent roles follow {@link isDarkColor} of the slide background; a `text`
 * override applies only on a light background, so a dark slide always gets readable light1 text.
 * Values are uppercase #RRGGBB, or #RRGGBBAA where the scheme color carries an alpha byte.
 */
export function resolveColorRoles(colorScheme: Record<string, unknown>, options: ResolveColorRolesOptions = {}): ResolvedColorRoles {
  const slot = (name: string, fallback: string) => slotKeepingAlpha(colorScheme, name, fallback);
  const background = keepAlpha(options.background) ?? defaultSlideBackground(colorScheme);
  const dark = isDarkColor(background);
  const text = dark ? slot('light1', '#FFFFFF') : (keepAlpha(colorScheme.text) ?? slot('dark1', '#111827'));
  return {
    primary: keepAlpha(colorScheme.primary) ?? slot('accent1', '#2563EB'),
    secondary: keepAlpha(colorScheme.secondary) ?? slot('accent2', '#0F766E'),
    accent: keepAlpha(colorScheme.accent) ?? slot('accent3', '#F59E0B'),
    background,
    surface: keepAlpha(colorScheme.surface) ?? (dark ? slot('dark2', '#1E293B') : slot('light2', '#F8FAFC')),
    text,
    textSecondary: keepAlpha(colorScheme.textSecondary) ?? (dark ? slot('light2', '#E2E8F0') : slot('dark2', '#334155')),
    hyperlink: readableLink(slot('hyperlink', DEFAULT_HYPERLINK), background, text),
    followedHyperlink: slot('followedHyperlink', DEFAULT_FOLLOWED_HYPERLINK),
    dark,
  };
}

/** Relative luminance contrast for opaque #RGB/#RRGGBB/#RRGGBBFF colors.
 * Unknown or translucent colors need a resolved backdrop and remain unmeasured.
 * https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
 */
function luminance(value: string): number | undefined {
  if (typeof value !== 'string') return undefined;
  let hex = value.trim();
  if (/^#[0-9a-f]{3}$/i.test(hex)) hex = `#${[...hex.slice(1)].map(c => c + c).join('')}`;
  if (/^#[0-9a-f]{6}ff$/i.test(hex)) hex = hex.slice(0, 7);
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return undefined;
  return [.2126, .7152, .0722].reduce((sum, weight, index) => {
    const offset = index * 2 + 1;
    const n = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return sum + weight * (n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4);
  }, 0);
}

export function colorContrast(foreground: string, background: string): number | undefined {
  const a = luminance(foreground), b = luminance(background);
  return a === undefined || b === undefined ? undefined : (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}

/** Keep an inherited text color at >=4.5:1; otherwise select black or white.
 * Callers must preserve explicit text-color overrides before using this fallback.
 * An unresolved/translucent fill preserves the preferred color, without a contrast claim.
 */
export function textColorForFill(fill: string, preferred: string): string {
  const background = luminance(fill), contrast = colorContrast(preferred, fill);
  if (background === undefined || contrast === undefined || contrast >= 4.5) return preferred;
  return (background + .05) / .05 >= 1.05 / (background + .05) ? '#000000' : '#FFFFFF';
}

/** Keep an inherited chart mark at >=3:1 against its opaque panel. Otherwise
 * mix toward black or white in bounded 1/255 steps, choosing the first passing
 * step (higher contrast breaks a tie). This retains a recognizable palette;
 * it does not establish distinction between adjacent series or colorblind safety.
 * Explicit mark overrides belong to the caller; unresolved alpha is preserved.
 */
export function chartColorForFill(fill: string, preferred: string): string {
  const contrast = colorContrast(preferred, fill);
  if (contrast === undefined || contrast >= 3) return preferred;
  let hex = preferred.trim();
  if (hex.length === 4) hex = `#${[...hex.slice(1)].map(c => c + c).join('')}`;
  const channels = [1, 3, 5].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16));
  for (let step = 1; step <= 255; step++) {
    const candidates = [0, 255].map(target => {
      const color = `#${channels.map(channel => Math.round(channel + (target - channel) * step / 255).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
      return {color, contrast: colorContrast(color, fill) ?? 0};
    }).sort((a, b) => b.contrast - a.contrast);
    const best = candidates[0];
    if (best && best.contrast >= 3) return best.color;
  }
  // Black or white always exceeds 3:1 for an opaque sRGB fill.
  return textColorForFill(fill, preferred);
}

// --------------------------------------------------------------- chart palettes

/** Smallest CIE L* step kept between neighbouring series (a printed or greyscale chart tells them apart by lightness alone). */
export const CHART_SERIES_MIN_LIGHTNESS_STEP = 11;
/** Smallest CIE76 colour difference kept between any two series that were at least that far apart before the surface adjustment. */
export const CHART_SERIES_MIN_DIFFERENCE = 12;

type Lab = [number, number, number];
const D65 = [0.95047, 1, 1.08883] as const;

function opaqueChannels(value: string): [number, number, number] | undefined {
  if (luminance(value) === undefined) return undefined;
  let hex = value.trim();
  if (hex.length === 4) hex = `#${[...hex.slice(1)].map(c => c + c).join('')}`;
  return [1, 3, 5].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16)) as [number, number, number];
}
const toLinear = (channel: number) => { const n = channel / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; };
const fromLinear = (value: number) => 255 * (value <= .0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - .055);

function labOf(channels: readonly number[]): Lab {
  const [r, g, b] = channels.map(toLinear) as [number, number, number];
  const f = (t: number) => t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116;
  const fx = f((.4124564 * r + .3575761 * g + .1804375 * b) / D65[0]), fy = f(.2126729 * r + .7151522 * g + .072175 * b), fz = f((.0193339 * r + .119192 * g + .9503041 * b) / D65[2]);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** Linear sRGB for a Lab colour, or undefined outside the sRGB gamut. */
function labToLinear([l, a, b]: Lab): [number, number, number] | undefined {
  const fy = (l + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
  const inverse = (t: number) => t ** 3 > 216 / 24389 ? t ** 3 : (116 * t - 16) / (24389 / 27);
  const x = inverse(fx) * D65[0], y = l > 8 ? fy ** 3 : l / (24389 / 27), z = inverse(fz) * D65[2];
  const rgb: [number, number, number] = [
    3.2404542 * x - 1.5371385 * y - .4985314 * z,
    -.969266 * x + 1.8760108 * y + .041556 * z,
    .0556434 * x - .2040259 * y + 1.0572252 * z,
  ];
  return rgb.every(channel => channel >= -.0005 && channel <= 1.0005) ? rgb : undefined;
}

const hexOfChannels = (channels: readonly number[]) => `#${channels.map(channel => Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, '0')).join('').toUpperCase()}`;

/** The colour of the given lightness that keeps the hue and as much of the chroma as fits in sRGB. */
function labWithLightness(l: number, a: number, b: number): string {
  const chroma = Math.hypot(a, b), hue = Math.atan2(b, a);
  const at = (scale: number): [number, number, number] | undefined => labToLinear([l, Math.cos(hue) * chroma * scale, Math.sin(hue) * chroma * scale]);
  let linear = at(1);
  if (!linear) {
    let low = 0, high = 1;
    for (let step = 0; step < 24; step++) { const mid = (low + high) / 2; if (at(mid)) low = mid; else high = mid; }
    linear = at(low) ?? [0, 0, 0];
  }
  return hexOfChannels(linear.map(channel => fromLinear(Math.max(0, Math.min(1, channel)))));
}

/** CIE76 difference of two opaque #RRGGBB colours (0 when either is not opaque). */
function labDifference(a: Lab, b: Lab): number { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }

/** Cost, in CIE L* points of movement, of each point a placement falls short of the separation from a neighbouring series. */
const CHART_SERIES_SHORTFALL_WEIGHT = 8;

/** Series colours for a chart drawn on `fill`: the palette in order, each colour adjusted for contrast
 * (`chartColorForFill`) without letting the adjustment merge series.
 *
 * Lifting or darkening a colour for a dark or mid-tone surface moves every failing colour towards the same
 * few lightness values, so two blues that differ on white can end up identical on a dark card. Colours that
 * already have >= 3:1 contrast against `fill` are kept exactly. A colour the contrast adjustment would move is
 * placed again on the lightness axis, keeping its hue and as much of its chroma as sRGB allows, subject to
 * >= 3:1 contrast against `fill` and these separations from the other series (each capped at the separation
 * that pair had in `palette`, so a pair the palette itself made close is not asked to be far apart):
 *
 * - a colour difference (CIE76) of at least {@link CHART_SERIES_MIN_DIFFERENCE} from every other series;
 * - a lightness step of at least {@link CHART_SERIES_MIN_LIGHTNESS_STEP} (CIE L*) from the neighbouring
 *   series, which is what keeps neighbours apart on a greyscale print;
 * - the same lightness step from the remaining series, as a weaker aim.
 *
 * Series are placed in order against the kept colours and the colours placed before them. The placement
 * with the lowest cost wins: its distance (in L*) from the contrast-adjusted colour plus a penalty for
 * every point it falls short of those separations, so a colour that is already clear of the others is
 * simply the adjusted colour, a near miss is not worth a large change, and a collision is resolved at the
 * nearest lightness that clears it. The result is deterministic and in series order. An unresolved or
 * translucent fill or colour is passed through, like `chartColorForFill`.
 *
 * It depends only on the surface and the palette, so every chart on a surface gets the same series colours,
 * and preview and export (which both call this function) draw the same ones.
 */
export function chartPaletteForFill(fill: string, palette: readonly string[]): string[] {
  const opaqueFill = colorContrast(fill, fill) !== undefined;
  const preferredLab = palette.map(color => { const channels = opaqueChannels(color); return channels ? labOf(channels) : undefined; });
  const adjusted = palette.map(color => chartColorForFill(fill, color));
  // Colours the surface keeps stay put; only the ones it moves are placed again.
  const kept = palette.map((color, index) => opaqueFill && preferredLab[index] !== undefined && adjusted[index] === color);
  const placed: (string | undefined)[] = palette.map((_, index) => kept[index] || !opaqueFill || !preferredLab[index] ? adjusted[index] : undefined);
  const placedLab: (Lab | undefined)[] = placed.map(color => { const channels = color === undefined ? undefined : opaqueChannels(color); return channels ? labOf(channels) : undefined; });
  palette.forEach((_, index) => {
    const wanted = preferredLab[index], base = adjusted[index]!;
    if (placed[index] !== undefined || !wanted) return;
    const baseLab = labOf(opaqueChannels(base)!);
    // The separation every placed series must keep from this one: what the palette itself had, capped at the floor.
    const needs = palette.flatMap((_, other) => {
      const before = preferredLab[other], lab = placedLab[other];
      return other !== index && before && lab && placed[other] !== undefined
        ? [{ lab, adjacent: Math.abs(other - index) === 1, wide: Math.min(labDifference(before, wanted), CHART_SERIES_MIN_DIFFERENCE), step: Math.min(Math.abs(before[0] - wanted[0]), CHART_SERIES_MIN_LIGHTNESS_STEP) }]
        : [];
    });
    // How far a candidate is from the required separations (>= 0 when it meets them): the colour difference from every
    // series and the lightness step from the neighbours first, then the lightness step from the others.
    const shortfall = (candidate: Lab): { near: number; far: number } => needs.reduce((worst, need) => {
      const lightness = Math.abs(need.lab[0] - candidate[0]) - need.step, difference = labDifference(need.lab, candidate) - need.wide;
      return need.adjacent ? { near: Math.min(worst.near, difference, lightness), far: worst.far } : { near: Math.min(worst.near, difference), far: Math.min(worst.far, lightness) };
    }, { near: Infinity, far: Infinity });
    // Cost of a placement: how far it moves from the adjusted colour, plus a penalty for every point it falls short
    // of the required separations (neighbours and colour difference count most). Cheapest wins; ties keep the nearer one.
    const deficit = (value: number) => Math.max(0, -value - 1e-9);
    const cost = (candidate: { moved: number; near: number; far: number }) => candidate.moved + CHART_SERIES_SHORTFALL_WEIGHT * deficit(candidate.near) + deficit(candidate.far);
    const start = shortfall(baseLab);
    if (deficit(start.near) === 0 && deficit(start.far) === 0) { placed[index] = base; placedLab[index] = baseLab; return; }
    // Re-place the colour on the lightness axis, around where the surface adjustment left it.
    let best: { color: string; lab: Lab; cost: number; moved: number } | undefined = { color: base, lab: baseLab, cost: cost({ moved: 0, ...start }), moved: 0 };
    for (let step = 0; step <= 400; step++) {
      const color = labWithLightness(step / 4, wanted[1], wanted[2]), contrast = colorContrast(color, fill);
      if (contrast === undefined || contrast < 3) continue;
      const lab = labOf(opaqueChannels(color)!), moved = Math.abs(lab[0] - baseLab[0]), total = cost({ moved, ...shortfall(lab) });
      if (total < best.cost - 1e-9 || (Math.abs(total - best.cost) <= 1e-9 && moved < best.moved)) best = { color, lab, cost: total, moved };
    }
    placed[index] = best.color;
    placedLab[index] = best.lab;
  });
  return placed as string[];
}
