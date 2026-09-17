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
