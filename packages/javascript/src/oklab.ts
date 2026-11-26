/**
 * OKLab (Björn Ottosson, 2020): a perceptually even color space. Pure functions over opaque `#RRGGBB` colors, no dependencies.
 * A mix of two colors in OKLab has even perceived steps and no muddy middle; the table color scale and every later scale use it.
 */

export type Oklab = readonly [lightness: number, a: number, b: number];

const toLinear = (channel: number): number => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
const fromLinear = (value: number): number => value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;

/** The sRGB channels (0..255) of `#RGB` or `#RRGGBB` (an alpha byte is ignored); undefined for anything else. */
export function hexChannels(hex: string): [number, number, number] | undefined {
  let value = typeof hex === 'string' ? hex.trim() : '';
  if (/^#[0-9a-f]{3}$/i.test(value)) value = `#${[...value.slice(1)].map(c => c + c).join('')}`;
  if (!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(value)) return undefined;
  return [1, 3, 5].map(offset => Number.parseInt(value.slice(offset, offset + 2), 16)) as [number, number, number];
}

/** Uppercase `#RRGGBB` from sRGB channels (0..255, clamped and rounded). */
export function channelsHex(channels: readonly number[]): string {
  return `#${channels.map(channel => Math.round(Math.min(255, Math.max(0, channel))).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

/** An sRGB color as OKLab `[L, a, b]`: L is 0 for black and 1 for white. */
export function srgbToOklab(hex: string): Oklab {
  const [r, g, b] = (hexChannels(hex) ?? [0, 0, 0]).map(channel => toLinear(channel / 255)) as [number, number, number];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}

/** OKLab `[L, a, b]` as uppercase `#RRGGBB`; a color outside the sRGB gamut is clamped per channel. */
export function oklabToSrgb(color: Oklab): string {
  const [lightness, a, b] = color;
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
  return channelsHex(linear.map(value => fromLinear(Math.min(1, Math.max(0, value))) * 255));
}

/**
 * The color `t` of the way from `from` to `to`, mixed in OKLab (`t` clamped to 0..1). The two ends come back as themselves, exactly
 * (uppercase `#RRGGBB`), not as a round trip through OKLab.
 */
export function mixOklab(from: string, to: string, t: number): string {
  const start = channelsHex(hexChannels(from) ?? [0, 0, 0]), end = channelsHex(hexChannels(to) ?? [0, 0, 0]);
  if (!(t > 0)) return start;
  if (!(t < 1)) return end;
  const a = srgbToOklab(start), b = srgbToOklab(end);
  return oklabToSrgb([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
}
