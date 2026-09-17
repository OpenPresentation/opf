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
