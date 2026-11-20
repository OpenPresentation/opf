// SH-03: the six shape effects (shadow, innerShadow, glow, softEdge, reflection, blur) as a DrawingML a:effectLst.
//
// OPF units are reference pixels at a 720-pixel short edge, fractions 0 to 1 and degrees; DrawingML takes EMU (9525 a reference
// pixel on a 7.5-inch short edge, times `scale` for another slide size), 60000ths of a degree and 1/100000 fractions. CT_EffectList
// is a sequence, so the children are written in the schema's order (blur, glow, innerShdw, outerShdw, reflection, softEdge); the
// order PowerPoint draws them in does not depend on it. The shadow presets are written as a:outerShdw (a:prstShdw is excluded).
// The preview's twin is opf-render src/effects.js; both read the presets and defaults below from the same numbers.

const EMU_PER_PX = 9525;

/**
 * The three `shadow` presets, chosen to look like PowerPoint's Shadow gallery entries (Format Shape > Effects > Shadow):
 * - soft: "Offset: Bottom" (Outer), black at 60% transparency, blur 4 pt, distance 3 pt, angle 90 degrees.
 * - hard: a crisp offset with no blur, black at 75% transparency, distance 6 pt down and to the right (45 degrees).
 * - perspective: "Perspective: Below", black at 85% transparency, blur 12 pt, distance 25 pt, angle 90 degrees, the shape's
 *   outline scaled to 90% wide and flipped to 19% tall from its bottom edge, so it reads as a shadow on the floor.
 * Lengths are reference pixels (1 pt = 4/3 px on the 1280 x 720 reference).
 */
export const SHADOW_PRESETS = Object.freeze({
  soft: Object.freeze({ color: '#000000', opacity: 0.4, blur: 16 / 3, distance: 4, angle: 90, size: 1 }),
  hard: Object.freeze({ color: '#000000', opacity: 0.25, blur: 0, distance: 8, angle: 45, size: 1 }),
  perspective: Object.freeze({ color: '#000000', opacity: 0.15, blur: 16, distance: 100 / 3, angle: 90, scaleX: 0.9, scaleY: -0.19, align: 'b' }),
});

/** Defaults for the object forms (a key left out takes these). */
export const EFFECT_DEFAULTS = Object.freeze({
  shadow: SHADOW_PRESETS.soft,
  innerShadow: Object.freeze({ color: '#000000', opacity: 0.5, blur: 20 / 3, distance: 16 / 3, angle: 45 }),
  glow: Object.freeze({ color: 'accent', opacity: 0.4, radius: 20 / 3 }),
  reflection: Object.freeze({ opacity: 0.5, size: 0.35, distance: 0, blur: 2 / 3 }),
});

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = (value, fallback) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);
const clamp01 = value => Math.min(1, Math.max(0, value));

/**
 * The effects of a block normalized to resolved numbers (OPF units), or undefined for each effect that is absent or off.
 * Shared by effectsXml here and by the preview (opf-render src/effects.js keeps the same function).
 */
export function normalizeEffects(effects = {}) {
  if (!isObject(effects)) return {};
  const out = {};
  const shadow = effects.shadow;
  if (typeof shadow === 'string' && Object.hasOwn(SHADOW_PRESETS, shadow)) out.shadow = { preset: shadow, ...SHADOW_PRESETS[shadow] };
  else if (isObject(shadow)) {
    const base = EFFECT_DEFAULTS.shadow;
    const size = Math.max(0, finite(shadow.size, 1));
    out.shadow = {
      color: shadow.color ?? base.color,
      opacity: clamp01(finite(shadow.opacity, base.opacity)),
      blur: Math.max(0, finite(shadow.blur, base.blur)),
      distance: Math.max(0, finite(shadow.distance, base.distance)),
      angle: finite(shadow.angle, base.angle),
      size,
    };
  }
  if (isObject(effects.innerShadow)) {
    const value = effects.innerShadow, base = EFFECT_DEFAULTS.innerShadow;
    out.innerShadow = {
      color: value.color ?? base.color,
      opacity: clamp01(finite(value.opacity, base.opacity)),
      blur: Math.max(0, finite(value.blur, base.blur)),
      distance: Math.max(0, finite(value.distance, base.distance)),
      angle: finite(value.angle, base.angle),
    };
  }
  if (isObject(effects.glow)) {
    const value = effects.glow, base = EFFECT_DEFAULTS.glow;
    const radius = Math.max(0, finite(value.radius, base.radius));
    if (radius > 0) out.glow = { color: value.color ?? base.color, opacity: clamp01(finite(value.opacity, base.opacity)), radius };
  }
  const softEdge = Math.max(0, finite(effects.softEdge, 0));
  if (softEdge > 0) out.softEdge = softEdge;
  if (isObject(effects.reflection)) {
    const value = effects.reflection, base = EFFECT_DEFAULTS.reflection;
    out.reflection = {
      opacity: clamp01(finite(value.opacity, base.opacity)),
      size: clamp01(finite(value.size, base.size)),
      distance: Math.max(0, finite(value.distance, base.distance)),
      blur: Math.max(0, finite(value.blur, base.blur)),
    };
  }
  const blur = Math.max(0, finite(effects.blur, 0));
  if (blur > 0) out.blur = blur;
  return out;
}

const emu = (px, scale) => Math.max(0, Math.round(px * scale * EMU_PER_PX));
const fraction = value => Math.round(value * 100000);
/** ST_PositiveFixedAngle: 0 <= dir < 21600000. */
const direction = degrees => Math.round((((degrees % 360) + 360) % 360) * 60000) % 21600000;

function hexAndAlpha(value) {
  const raw = String(value ?? '').trim().replace(/^#/, '');
  const full = /^[\da-f]{3}$/i.test(raw) ? [...raw].map(char => char + char).join('') : raw;
  if (/^[\da-f]{6}$/i.test(full)) return { hex: full.toUpperCase(), alpha: 1 };
  if (/^[\da-f]{8}$/i.test(full)) return { hex: full.slice(0, 6).toUpperCase(), alpha: parseInt(full.slice(6), 16) / 255 };
  return undefined;
}

/**
 * One DrawingML color element carrying the effect's opacity as a:alpha. `resolveColor(ref)` returns either a hex color (RRGGBB,
 * #RRGGBB or #RRGGBBAA; an alpha byte multiplies the opacity) or a color element (`<a:schemeClr val="accent1"><a:lumMod .../>
 * </a:schemeClr>`), to which a:alpha is appended as the last transform.
 */
function colorXml(ref, opacity, resolveColor) {
  const resolved = typeof resolveColor === 'function' ? resolveColor(ref) : ref;
  if (typeof resolved === 'string' && resolved.trim().startsWith('<')) {
    const element = resolved.trim();
    const alpha = opacity < 1 ? `<a:alpha val="${fraction(opacity)}"/>` : '';
    if (!alpha) return element;
    const selfClosing = element.match(/^<(a:\w+)([^>]*)\/>$/);
    if (selfClosing) return `<${selfClosing[1]}${selfClosing[2]}>${alpha}</${selfClosing[1]}>`;
    return element.replace(/<\/(a:\w+)>$/, `${alpha}</$1>`);
  }
  const parsed = hexAndAlpha(resolved) ?? hexAndAlpha(ref) ?? { hex: '000000', alpha: 1 };
  const alpha = clamp01(opacity * parsed.alpha);
  return alpha < 1 ? `<a:srgbClr val="${parsed.hex}"><a:alpha val="${fraction(alpha)}"/></a:srgbClr>` : `<a:srgbClr val="${parsed.hex}"/>`;
}

/**
 * The shape's effects as `<a:effectLst>...</a:effectLst>`, or '' when it has none. `effects` holds the block's effect keys
 * ({ shadow, innerShadow, glow, softEdge, reflection, blur }); `resolveColor` maps a ColorRef to a hex color or a color element;
 * `options.scale` is the slide's short edge over the 7.5-inch reference (min(width, height in inches) * 96 / 720), default 1.
 */
export function effectsXml(effects, resolveColor, { scale = 1 } = {}) {
  const fx = normalizeEffects(effects);
  const parts = [];
  if (fx.blur) parts.push(`<a:blur rad="${emu(fx.blur, scale)}" grow="1"/>`);
  if (fx.glow) parts.push(`<a:glow rad="${emu(fx.glow.radius, scale)}">${colorXml(fx.glow.color, fx.glow.opacity, resolveColor)}</a:glow>`);
  if (fx.innerShadow) {
    const value = fx.innerShadow;
    parts.push(`<a:innerShdw blurRad="${emu(value.blur, scale)}" dist="${emu(value.distance, scale)}" dir="${direction(value.angle)}">${colorXml(value.color, value.opacity, resolveColor)}</a:innerShdw>`);
  }
  if (fx.shadow) {
    const value = fx.shadow;
    const sx = value.scaleX ?? value.size ?? 1, sy = value.scaleY ?? value.size ?? 1;
    const scaled = sx !== 1 || sy !== 1 ? ` sx="${fraction(sx)}" sy="${fraction(sy)}"` : '';
    // A scaled shadow grows from the shape's center (PowerPoint's "Offset: Center" preset); the perspective preset from its bottom.
    const align = value.align ?? (scaled ? 'ctr' : 'tl');
    parts.push(`<a:outerShdw blurRad="${emu(value.blur, scale)}" dist="${emu(value.distance, scale)}" dir="${direction(value.angle)}"${scaled} algn="${align}" rotWithShape="0">${colorXml(value.color, value.opacity, resolveColor)}</a:outerShdw>`);
  }
  if (fx.reflection) {
    const value = fx.reflection;
    parts.push(`<a:reflection blurRad="${emu(value.blur, scale)}" stA="${fraction(value.opacity)}" stPos="0" endA="0" endPos="${fraction(value.size)}" dist="${emu(value.distance, scale)}" dir="5400000" sy="-100000" algn="bl" rotWithShape="0"/>`);
  }
  if (fx.softEdge) parts.push(`<a:softEdge rad="${emu(fx.softEdge, scale)}"/>`);
  return parts.length ? `<a:effectLst>${parts.join('')}</a:effectLst>` : '';
}
