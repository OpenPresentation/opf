// SVG uses an object-bounding-box gradient. DrawingML's unscaled angle is
// measured in slide coordinates. Convert the normal and stop interval together;
// copying the angle alone changes diagonal gradients on non-square slides.
const turn = angle => ((angle % 360) + 360) % 360;
const clamp = value => Math.max(0, Math.min(1, value));
const list = value => value === undefined ? [] : Array.isArray(value) ? value : [value];
function color(value, fallback = 'FFFFFF') {
  if (!/^[\da-f]{6}$/i.test(fallback)) fallback = 'FFFFFF';
  let hex = typeof value === 'string' ? value.trim().replace(/^#/, '') : fallback;
  if (/^[\da-f]{3}$/i.test(hex)) hex = [...hex].map(c => c + c).join('');
  if (!/^[\da-f]{6}([\da-f]{2})?$/i.test(hex)) hex = fallback;
  return {hex: hex.slice(0, 6).toUpperCase(), alpha: hex.length === 8 ? parseInt(hex.slice(6), 16) / 255 : 1};
}
function colorXml(value, opacity, fallback) {
  const c = color(value, fallback), alpha = Math.round(c.alpha * opacity * 100000);
  return `<a:srgbClr val="${c.hex}">${alpha === 100000 ? '' : `<a:alpha val="${alpha}"/>`}</a:srgbClr>`;
}

export function nativeBackgroundFill(background, {width, height}, fallback = 'FFFFFF') {
  if (typeof background === 'string' && /^#[\da-f]{3}(?:[\da-f]{3}(?:[\da-f]{2})?)?$/i.test(background)) background = {type: 'solid', color: background};
  if (!background || typeof background !== 'object') return null;
  const opacity = background.opacity ?? 1;
  if (background.type === 'solid') return `<a:solidFill>${colorXml(background.color, opacity, fallback)}</a:solidFill>`;
  if (background.type !== 'gradient') return null;
  const stops = background.gradient?.stops ?? [];
  if (!stops.length) return '<a:noFill/>';
  if (stops.length === 1) return `<a:solidFill>${colorXml(stops[0].color, opacity, fallback)}</a:solidFill>`;
  const radians = turn(background.gradient?.angle ?? 0) * Math.PI / 180;
  const c = Math.cos(radians), s = Math.sin(radians), span = Math.abs(c) + Math.abs(s);
  const angle = Math.round(turn(Math.atan2(s / height, c / width) * 180 / Math.PI) * 60000) % 21600000;
  let prior = 0;
  const nativeStops = stops.map(stop => {
    // SVG clamps a descending stop to the preceding position.
    prior = Math.max(prior, stop.position);
    const position = Math.round(((prior - .5) / span + .5) * 100000);
    return `<a:gs pos="${position}">${colorXml(stop.color, opacity, fallback)}</a:gs>`;
  }).join('');
  return `<a:gradFill rotWithShape="0"><a:gsLst>${nativeStops}</a:gsLst><a:lin ang="${angle}" scaled="0"/></a:gradFill>`;
}

function readColor(node) {
  const c = node?.['a:srgbClr'];
  if (!c || !/^[\da-f]{6}$/i.test(c.val) || Object.keys(c).some(k => k !== 'val' && k !== 'a:alpha')) return null;
  const alpha = Number(c['a:alpha']?.val ?? 100000) / 100000;
  if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1) return null;
  return {hex: '#' + c.val.toUpperCase(), alpha};
}

export function readNativeBackground(properties, {width, height}, report = () => {}) {
  if (!properties) return undefined;
  if (Object.hasOwn(properties, 'a:noFill')) return {type: 'solid', color: '#FFFFFF', opacity: 0};
  const solid = readColor(properties['a:solidFill']);
  if (solid) return {type: 'solid', color: solid.hex, ...(solid.alpha === 1 ? {} : {opacity: solid.alpha})};
  const gradient = properties['a:gradFill'];
  if (!gradient) return undefined;
  const unsupported = () => {
    report({code: 'unsupported-background-gradient', message: 'This native gradient uses geometry or color transforms outside the OPF linear-gradient contract; its background was not imported.'});
    return undefined;
  };
  const lin = gradient['a:lin'];
  if (!lin || gradient['a:path'] || (gradient.flip && gradient.flip !== 'none')
    || Object.values(gradient['a:tileRect'] ?? {}).some(value => Number(value) !== 0)) return unsupported();
  let radians = Number(lin.ang ?? 0) / 60000 * Math.PI / 180;
  if (!Number.isFinite(radians)) return unsupported();
  // DrawingML scaled=true first scales the direction by the fill dimensions.
  if (lin.scaled === '1' || lin.scaled === 'true') radians = Math.atan2(height * Math.sin(radians), width * Math.cos(radians));
  const angle = turn(Math.atan2(height * Math.sin(radians), width * Math.cos(radians)) * 180 / Math.PI);
  const a = angle * Math.PI / 180, span = Math.abs(Math.cos(a)) + Math.abs(Math.sin(a));
  const stops = list(gradient['a:gsLst']?.['a:gs']).map(stop => {
    const c = readColor(stop), position = (Number(stop.pos) / 100000 - .5) * span + .5;
    // Allow only native integer rounding, not a lossy clamping of arbitrary
    // corner-to-corner gradients that OPF's fixed endpoints cannot represent.
    if (!c || !Number.isFinite(position) || position < -.00002 || position > 1.00002) return null;
    return {...c, position: clamp(position)};
  });
  if (!stops.length || stops.some(stop => !stop)) return unsupported();
  const alpha = stops[0].alpha, uniform = stops.every(stop => stop.alpha === alpha);
  return {type: 'gradient', gradient: {angle, stops: stops.map(stop => ({position: stop.position,
    color: stop.hex + (!uniform && stop.alpha !== 1 ? Math.round(stop.alpha * 255).toString(16).padStart(2, '0').toUpperCase() : '')}))},
    ...(uniform && alpha !== 1 ? {opacity: alpha} : {})};
}
