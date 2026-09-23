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

// ECMA-376 Part 1, 20.1.10.51 ST_PresetPatternVal. OPF pattern presets with
// these names are DrawingML presets; any other id is engine-defined.
export const presetPatterns = new Set(['pct5', 'pct10', 'pct20', 'pct25', 'pct30', 'pct40', 'pct50', 'pct60', 'pct70', 'pct75', 'pct80', 'pct90',
  'horz', 'vert', 'ltHorz', 'ltVert', 'dkHorz', 'dkVert', 'narHorz', 'narVert', 'dashHorz', 'dashVert', 'cross',
  'dnDiag', 'upDiag', 'ltDnDiag', 'ltUpDiag', 'dkDnDiag', 'dkUpDiag', 'wdDnDiag', 'wdUpDiag', 'dashDnDiag', 'dashUpDiag', 'diagCross',
  'smCheck', 'lgCheck', 'smGrid', 'lgGrid', 'dotGrid', 'smConfetti', 'lgConfetti', 'horzBrick', 'diagBrick',
  'solidDmnd', 'openDmnd', 'dotDmnd', 'plaid', 'sphere', 'weave', 'divot', 'shingle', 'wave', 'trellis', 'zigZag']);

// Engine-defined presets drawn by the SVG preview, with their closest DrawingML
// preset. diagStripe is a 2px rising diagonal on an 8px cell, as wdUpDiag.
// Import reports the native preset name; it does not guess the OPF alias.
const patternAliases = {diagStripe: 'wdUpDiag'};
export const nativePatternPreset = preset => presetPatterns.has(preset) ? preset : Object.hasOwn(patternAliases, preset) ? patternAliases[preset] : undefined;

// The SVG preview paints the pattern background color and foreground marks,
// defaulting to white and the slide text color. Other engine-defined presets
// have no DrawingML equivalent; like the preview, only their background color remains.
// `scheme(reference, hex)` names the theme color for an authored slot/role
// reference whose drawn color the deck theme holds exactly (FF-24); pattern
// colors then become a:schemeClr, keeping any background opacity as alpha.
export function nativeBackgroundFill(background, {width, height}, fallback = 'FFFFFF', foreground = '000000', scheme = () => undefined) {
  if (typeof background === 'string' && /^#[\da-f]{3}(?:[\da-f]{3}(?:[\da-f]{2})?)?$/i.test(background)) background = {type: 'solid', color: background};
  if (!background || typeof background !== 'object') return null;
  const opacity = background.opacity ?? 1;
  if (background.type === 'solid' || background.type === 'theme') return `<a:solidFill>${colorXml(background.type === 'theme' ? fallback : background.color, opacity, fallback)}</a:solidFill>`;
  if (background.type === 'pattern') {
    const paint = (value, base) => {
      const c = color(value, base), themeValue = c.alpha === 1 ? scheme(value, c.hex) : undefined;
      if (!themeValue) return colorXml(value, opacity, base);
      const alpha = Math.round(clamp(opacity) * 100000);
      return `<a:schemeClr val="${themeValue}">${alpha === 100000 ? '' : `<a:alpha val="${alpha}"/>`}</a:schemeClr>`;
    };
    const pattern = background.pattern ?? {}, back = paint(pattern.backgroundColor, 'FFFFFF');
    const preset = nativePatternPreset(pattern.preset);
    if (!preset) return `<a:solidFill>${back}</a:solidFill>`;
    return `<a:pattFill prst="${preset}"><a:fgClr>${paint(pattern.foregroundColor, foreground)}</a:fgClr><a:bgClr>${back}</a:bgClr></a:pattFill>`;
  }
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

const rectXml = (name, rect = {}) => `<a:${name}${['l', 't', 'r', 'b'].filter(key => rect[key]).map(key => ` ${key}="${rect[key]}"`).join('')}/>`;
const percent = value => Math.round(value * 100000);

// Picture fill for an OPF image background, following the SVG preview:
// cover crops the centered source to the slide aspect, contain letterboxes it
// with fill-rectangle insets, and tile repeats square cells of min(w,h)/4
// from the top-left corner. Each cell holds the image by the deck imageFill
// (crop = cover, otherwise contain; negative source insets are transparent
// padding). With dpi="0", DrawingML sizes a tile from the raster's own
// resolution (PNG pHYs, JPEG JFIF or EXIF; 96 dpi when absent), while the
// preview draws CSS pixels, so the tile scale compensates on each axis.
export const nativeTileAlignment = {tx: '0', ty: '0', flip: 'none', algn: 'tl'};
export function nativeTileScale(image, {width, height, imageFill = 'fit'}) {
  const cell = Math.min(width, height) / 4;
  const scale = (imageFill === 'crop' ? Math.max : Math.min)(cell / image.width, cell / image.height);
  return {cell, scale, sx: percent(scale * (image.dpiX ?? 96) / 96), sy: percent(scale * (image.dpiY ?? 96) / 96)};
}
export function nativeImageBackgroundFill(relationshipId, image, {fit = 'cover', opacity = 1, width, height, imageFill = 'fit'}) {
  const alpha = clamp(opacity);
  const blip = `<a:blip r:embed="${relationshipId}">${alpha === 1 ? '' : `<a:alphaModFix amt="${percent(alpha)}"/>`}</a:blip>`;
  if (fit === 'tile') {
    const {cell, scale, sx, sy} = nativeTileScale(image, {width, height, imageFill});
    const x = percent((1 - cell / (image.width * scale)) / 2), y = percent((1 - cell / (image.height * scale)) / 2);
    const {tx, ty, flip, algn} = nativeTileAlignment;
    return `<a:blipFill dpi="0" rotWithShape="1">${blip}${rectXml('srcRect', {l: x, t: y, r: x, b: y})}<a:tile tx="${tx}" ty="${ty}" sx="${sx}" sy="${sy}" flip="${flip}" algn="${algn}"/></a:blipFill>`;
  }
  if (fit === 'contain') {
    const scale = Math.min(width / image.width, height / image.height);
    const x = percent((1 - image.width * scale / width) / 2), y = percent((1 - image.height * scale / height) / 2);
    return `<a:blipFill dpi="0" rotWithShape="1">${blip}<a:srcRect/><a:stretch>${rectXml('fillRect', {l: x, t: y, r: x, b: y})}</a:stretch></a:blipFill>`;
  }
  const scale = Math.max(width / image.width, height / image.height);
  const x = percent((1 - width / (image.width * scale)) / 2), y = percent((1 - height / (image.height * scale)) / 2);
  return `<a:blipFill dpi="0" rotWithShape="1">${blip}${rectXml('srcRect', {l: x, t: y, r: x, b: y})}<a:stretch><a:fillRect/></a:stretch></a:blipFill>`;
}

// Internal metadata supplied by the ordered XML reader. A Symbol cannot collide
// with a document attribute, and repeated transforms keep their original order.
export const colorTransforms = Symbol('DrawingML color transforms');
const transformNames = new Set(['a:alpha', 'a:alphaMod', 'a:alphaOff', 'a:lum', 'a:lumMod', 'a:lumOff']);
function luminanceColor(hex) {
  const rgb = hex.match(/../g).map(value => parseInt(value, 16) / 255);
  const max = Math.max(...rgb), min = Math.min(...rgb), l = (max + min) / 2, delta = max - min;
  // Retain hue/saturation across consecutive luminance changes, even when an
  // intermediate luminance clips to black or white.
  return {l, saturation: delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1)), direction: rgb.map(c => delta ? (c - l) / delta : 0)};
}
function luminanceHex({l, saturation, direction}) {
  const chroma = (1 - Math.abs(2 * l - 1)) * saturation;
  return '#' + direction.map(c => Math.round(clamp(l + c * chroma) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
}
export function readBackgroundColor(node, context = {}, seen = new Set()) {
  const kinds = ['a:srgbClr', 'a:sysClr', 'a:schemeClr'].filter(k => node?.[k]);
  if (kinds.length !== 1) return null;
  const kind = kinds[0], c = node[kind];
  if (Array.isArray(c) || Object.keys(c).some(k => !['val', 'lastClr'].includes(k) && !transformNames.has(k))) return null;
  const entries = Object.entries(c).filter(([key]) => key.startsWith('a:'));
  // The legacy object shape is safe for one transform only. Never guess the
  // order of repeated/interleaved operations after an unordered parser.
  const transforms = c[colorTransforms] ?? (entries.length <= 1 && entries.every(([,value]) => !Array.isArray(value)) ? entries : null);
  if (!transforms) return null;
  let resolved;
  if (kind === 'a:schemeClr') {
    if (c.val === 'phClr') resolved = context.placeholder;
    else {
      const slot = context.mapping?.[c.val] ?? c.val;
      if (seen.has(slot)) return null;
      resolved = readBackgroundColor(context.colors?.['a:' + slot], context, new Set([...seen, slot]));
    }
  } else {
    const hex = kind === 'a:sysClr' ? c.lastClr : c.val;
    if (!/^[\da-f]{6}$/i.test(hex ?? '')) return null;
    resolved = {hex: '#' + hex.toUpperCase(), alpha: 1, luminance: luminanceColor(hex)};
  }
  if (!resolved) return null;
  let alpha = resolved.alpha;
  const luminance = {...(resolved.luminance ?? luminanceColor(resolved.hex.slice(1)))};
  for (const [name, attributes] of transforms) {
    if (!transformNames.has(name) || !attributes || Object.keys(attributes).some(key => key !== 'val')) return null;
    const raw = attributes.val;
    if (!/^[+-]?\d+$/.test(raw ?? '')) return null;
    const value = Number(raw) / 100000;
    if (!Number.isFinite(value)) return null;
    if ((name === 'a:alpha' || name === 'a:lum') && (value < 0 || value > 1)) return null;
    if (name === 'a:alphaMod' && value < 0) return null;
    if (name === 'a:alphaOff' && Math.abs(value) > 1) return null;
    if (name === 'a:alpha') alpha = value;
    if (name === 'a:alphaMod') alpha = clamp(alpha * value);
    if (name === 'a:alphaOff') alpha = clamp(alpha + value);
    if (name === 'a:lum') luminance.l = value;
    if (name === 'a:lumMod') luminance.l = clamp(luminance.l * value);
    if (name === 'a:lumOff') luminance.l = clamp(luminance.l + value);
  }
  return {hex: luminanceHex(luminance), alpha, luminance};
}

// A preset pattern with explicit foreground and background colors. ECMA-376
// defines no default colors, so a pattern missing either one is not guessed.
function readNativePattern(pattern, report, context) {
  const foreground = pattern['a:fgClr'] && readBackgroundColor(pattern['a:fgClr'], context);
  const background = pattern['a:bgClr'] && readBackgroundColor(pattern['a:bgClr'], context);
  if (!presetPatterns.has(pattern.prst) || !foreground || !background) {
    report({code: 'unsupported-background-fill', message: 'This native pattern needs a DrawingML preset with resolvable foreground and background colors to become an OPF pattern background.'});
    return undefined;
  }
  const uniform = foreground.alpha === background.alpha;
  const hex = c => c.hex + (!uniform && c.alpha !== 1 ? Math.round(c.alpha * 255).toString(16).padStart(2, '0').toUpperCase() : '');
  return {type: 'pattern', pattern: {preset: pattern.prst, foregroundColor: hex(foreground), backgroundColor: hex(background)},
    ...(uniform && foreground.alpha !== 1 ? {opacity: foreground.alpha} : {})};
}

export function readNativeBackground(properties, {width, height}, report = () => {}, context = {}) {
  if (!properties) return undefined;
  if (Object.hasOwn(properties, 'a:noFill')) return {type: 'solid', color: '#FFFFFF', opacity: 0};
  const solid = readBackgroundColor(properties['a:solidFill'], context);
  if (solid) return {type: 'solid', color: solid.hex, ...(solid.alpha === 1 ? {} : {opacity: solid.alpha})};
  if (properties['a:pattFill']) return readNativePattern(properties['a:pattFill'], report, context);
  if (properties['a:blipFill'] && context.image) return context.image(properties['a:blipFill']);
  const gradient = properties['a:gradFill'];
  if (!gradient) {
    report({code: 'unsupported-background-fill', message: 'This native background fill or color cannot be represented by the OPF background importer.'});
    return undefined;
  }
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
    const c = readBackgroundColor(stop, context), position = (Number(stop.pos) / 100000 - .5) * span + .5;
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
