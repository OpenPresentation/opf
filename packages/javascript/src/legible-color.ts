/** Colour helpers behind the preview-polish palettes (code syntax, metric trend): WCAG contrast and bounded lightening. */

export const channels = (hex: string) => [1, 3, 5].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16));
export const toHex = (values: number[]) => `#${values.map(value => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
export const linear = (value: number) => { const n = value / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; };
export const luminance = (hex: string) => { const [r, g, b] = channels(hex); return .2126 * linear(r!) + .7152 * linear(g!) + .0722 * linear(b!); };
export const contrast = (a: string, b: string) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
export const normalize = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  if (/^#[0-9a-f]{3}$/i.test(text)) return `#${[...text.slice(1)].map(c => c + c).join('')}`.toUpperCase();
  return /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(text) ? text.slice(0, 7).toUpperCase() : undefined;
};

export function toHsl(hex: string): [number, number, number] {
  const [r, g, b] = channels(hex).map(value => value / 255) as [number, number, number];
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (d === 0) return [0, 0, l];
  const s = l > .5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
export function fromHsl(h: number, s: number, l: number): string {
  const hue = ((h % 360) + 360) % 360, c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((hue / 60) % 2 - 1)), m = l - c / 2;
  const [r, g, b] = hue < 60 ? [c, x, 0] : hue < 120 ? [x, c, 0] : hue < 180 ? [0, c, x] : hue < 240 ? [0, x, c] : hue < 300 ? [x, 0, c] : [c, 0, x];
  return toHex([(r! + m) * 255, (g! + m) * 255, (b! + m) * 255]);
}

/**
 * Lighten (or darken) `foreground` until it reaches `minimum` against `background`: hue and
 * saturation are kept and lightness moves in 1% steps toward white (or black), so a dark brand
 * colour becomes a vivid light one instead of a grey. When that direction cannot reach the target
 * (a mid-tone background) the other direction is tried, and the last resort is black or white,
 * whichever contrasts more (always >= 4.58:1).
 */
export function legible(foreground: string, background: string, minimum: number): string {
  if (contrast(foreground, background) >= minimum) return foreground;
  const [h, s, l] = toHsl(foreground), preferred = luminance(background) < .5 ? 1 : -1;
  for (const direction of [preferred, -preferred]) {
    for (let step = 1; step <= 100; step++) {
      const lightness = l + direction * step / 100;
      if (lightness < 0 || lightness > 1) break;
      const candidate = fromHsl(h, s, lightness);
      if (contrast(candidate, background) >= minimum) return candidate;
    }
  }
  return contrast('#FFFFFF', background) >= contrast('#000000', background) ? '#FFFFFF' : '#000000';
}
