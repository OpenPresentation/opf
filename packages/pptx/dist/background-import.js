import {XMLParser} from 'fast-xml-parser';
import {readNativeBackground, readBackgroundColor, colorTransforms, nativeTileScale, nativeTileAlignment} from './background.js';
import {rasterMetadata} from './image-geometry.js';

const orderedParser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '', preserveOrder: true, parseAttributeValue: false, parseTagValue: false, trimValues: false});
const defaultMapping = {bg1:'lt1',tx1:'dk1',bg2:'lt2',tx2:'dk2'};
const children = (nodes, name) => nodes?.find(node => Object.hasOwn(node, name))?.[name];
export function drawingObject(nodes) {
  const result = Object.create(null);
  for (const node of nodes ?? []) for (const [name, value] of Object.entries(node)) {
    if (name === ':@' || name === '#text') continue;
    const child = {...(node[':@'] ?? {}), ...drawingObject(value)};
    if (['a:srgbClr', 'a:sysClr', 'a:schemeClr'].includes(name)) {
      child[colorTransforms] = (value ?? []).flatMap(item => Object.keys(item)
        .filter(key => key !== ':@' && key !== '#text')
        .map(key => [key, {...(item[':@'] ?? {}), ...drawingObject(item[key])}]));
    }
    if (Object.hasOwn(result, name)) result[name] = Array.isArray(result[name]) ? [...result[name], child] : [result[name], child];
    else result[name] = child;
  }
  return result;
}

// Cache by archive entry identity. Weak keys release parsed themes when the
// input archive is collected and avoid reparsing a shared master for every slide.
const parsedParts = new WeakMap();
function parsed(bytes, parse) {
  if (!bytes) return undefined;
  if (!parsedParts.has(bytes)) {
    const tree = parse();
    parsedParts.set(bytes, {tree, value: drawingObject(tree)});
  }
  return parsedParts.get(bytes);
}

// Resolve only relationships inside the input archive; never fetch theme URLs.
export function readSlideTheme(slidePath, {part, relationships, bytes}) {
  const parsedPart = path => parsed(bytes(path), () => part(path, orderedParser));
  const value = path => parsedPart(path)?.value;
  const related = (path, type) => [...relationships(path).values()].find(rel => rel.type.endsWith('/' + type) && bytes(rel.path))?.path;
  const layoutPath = related(slidePath, 'slideLayout');
  const masterPath = layoutPath && related(layoutPath, 'slideMaster');
  const chain = [[slidePath, 'p:sld'], [layoutPath, 'p:sldLayout'], [masterPath, 'p:sldMaster']]
    .filter(([path]) => path).map(([path, root]) => ({path, root:value(path)?.[root]}));
  const master = chain.find(item => item.root?.['p:clrMap'])?.root;
  const masterMapping = {...defaultMapping, ...master?.['p:clrMap']};
  let mapping = masterMapping;
  for (const {root} of [...chain].reverse()) {
    const override = root?.['p:clrMapOvr'];
    if (override?.['a:overrideClrMapping']) mapping = {...defaultMapping, ...override['a:overrideClrMapping']};
    else if (override && Object.hasOwn(override, 'a:masterClrMapping')) mapping = masterMapping;
  }
  let colors, fonts, format, formatPath;
  for (const {path} of [...chain].reverse()) {
    for (const type of ['theme', 'themeOverride']) {
      const themePath = related(path, type);
      if (!themePath) continue;
      const doc = value(themePath);
      const elements = type === 'theme' ? doc?.['a:theme']?.['a:themeElements'] : doc?.['a:themeOverride'];
      if (elements?.['a:clrScheme']) colors = elements['a:clrScheme'];
      if (elements?.['a:fontScheme']) fonts = elements['a:fontScheme'];
      if (elements?.['a:fmtScheme']) {format = elements['a:fmtScheme'];formatPath = themePath;}
    }
  }
  return {chain, colors, mapping, fonts, format, formatPath, parsedPart};
}

export function importBackground(slidePath, dimensions, archive, report) {
  const {chain, colors, mapping, format, formatPath, parsedPart} = readSlideTheme(slidePath, archive);
  const owner = chain.find(item => item.root?.['p:cSld']?.['p:bg'] !== undefined);
  const background = owner?.root['p:cSld']['p:bg'];
  if (!background) return undefined;
  const unsupported = () => {
    report({code:'unsupported-background-fill',message:'The native background style reference or its theme color could not be resolved from this PPTX archive.'});
    return undefined;
  };
  // Picture relationships belong to the part that holds the fill.
  const context = {colors, mapping, image: fill => readImageBackground(fill, owner.path, archive, dimensions, report)};
  if (background['p:bgPr']) return readNativeBackground(background['p:bgPr'], dimensions, report, context);
  const reference = background['p:bgRef'];
  if (!/^\d+$/.test(reference?.idx ?? '')) return unsupported();
  const index = Number(reference?.idx);
  if (!Number.isInteger(index) || index < 0) return unsupported();
  if (index === 0 || index === 1000) return {type:'solid',color:'#FFFFFF',opacity:0};
  if (!format || !formatPath) return unsupported();
  // Fill lists can interleave solid, gradient and image fills. Preserve XML
  // child order when indexing them; the normal object parser groups tag names.
  const tree = parsedPart(formatPath).tree;
  const theme = children(tree, 'a:theme');
  const elements = theme ? children(theme, 'a:themeElements') : children(tree, 'a:themeOverride');
  const fmt = children(elements, 'a:fmtScheme');
  const styles = children(fmt, index < 1000 ? 'a:fillStyleLst' : 'a:bgFillStyleLst')?.filter(node => Object.keys(node).some(k => k !== '#text' && k !== ':@'));
  const style = styles?.[index < 1000 ? index - 1 : index - 1001];
  if (!style) return unsupported();
  context.placeholder = readBackgroundColor(reference, context);
  context.image = fill => readImageBackground(fill, formatPath, archive, dimensions, report);
  return readNativeBackground(drawingObject([style]), dimensions, report, context);
}

const imageEffects = new Set(['r:embed', 'r:link', 'cstate', 'a:alphaModFix', 'a:lum', 'a:extLst']);
const inset = (rect, key) => Number(rect?.[key] ?? 0) / 100000;
const near = (a, b) => Math.abs(a - b) <= .005;

// Import an embedded raster picture fill as an OPF image background. OPF's
// cover/contain/tile fits are recovered from the stretch/tile geometry; any
// other stretch (off-center crop, distortion) or unsupported picture effect is
// imported as the closest centered cover and reported.
function readImageBackground(fill, partPath, {relationships, bytes}, dimensions, report) {
  const blip = fill['a:blip'] ?? {};
  const relationship = blip['r:embed'] && relationships(partPath).get(blip['r:embed']);
  const data = relationship && relationship.targetMode !== 'External' ? bytes(relationship.path) : undefined;
  const metadata = data && rasterMetadata(data);
  if (!metadata) {
    report({code: 'unsupported-background-image', message: 'The native background picture is linked, missing, or not an embedded PNG, JPEG, GIF or WebP raster; its background was not imported.'});
    return undefined;
  }
  const approximate = reason => report({code: 'approximate-background-image', message: `The native background picture ${reason}; it was imported as the closest OPF image background.`});
  const lum = blip['a:lum'];
  if (Object.keys(blip).some(key => !imageEffects.has(key)) || (lum && Object.keys(lum).length)) approximate('uses picture effects outside OPF opacity');
  const amount = blip['a:alphaModFix'] ? Number(blip['a:alphaModFix'].amt ?? 100000) / 100000 : 1;
  const opacity = Number.isFinite(amount) ? Math.max(0, Math.min(1, amount)) : 1;
  let fit = 'cover';
  if (fill['a:tile']) {
    fit = 'tile';
    // OPF tile has one geometry: top-left min(w,h)/4 cells holding the whole
    // image (the default contain imageFill), at the raster's own resolution.
    const tile = fill['a:tile'], crop = fill['a:srcRect'];
    const expected = nativeTileScale(metadata, dimensions);
    const x = (1 - expected.cell / (metadata.width * expected.scale)) / 2, y = (1 - expected.cell / (metadata.height * expected.scale)) / 2;
    const value = (raw, fallback) => raw === undefined ? fallback : Number(raw);
    const scaled = (raw, target) => Math.abs(value(raw, 100000) - target) <= Math.max(2, target * .005);
    const matches = scaled(tile.sx, expected.sx) && scaled(tile.sy, expected.sy)
      && Object.entries(nativeTileAlignment).every(([key, native]) => String(tile[key] ?? native) === native)
      && near(inset(crop, 'l'), x) && near(inset(crop, 'r'), x) && near(inset(crop, 't'), y) && near(inset(crop, 'b'), y);
    if (!matches) approximate('tiles with a scale, offset, alignment, flip or crop that the OPF tile fit does not express');
  } else {
    const crop = fill['a:srcRect'], box = fill['a:stretch']?.['a:fillRect'];
    const [l, t, r, b] = ['l', 't', 'r', 'b'].map(key => inset(crop, key));
    const [fl, ft, fr, fb] = ['l', 't', 'r', 'b'].map(key => inset(box, key));
    const source = metadata.width * (1 - l - r) / (metadata.height * (1 - t - b));
    const target = dimensions.width * (1 - fl - fr) / (dimensions.height * (1 - ft - fb));
    const aspect = Number.isFinite(source) && Number.isFinite(target) && source > 0 && target > 0 && Math.abs(source / target - 1) <= .005;
    const noCrop = [l, t, r, b].every(value => near(value, 0)), noInset = [fl, ft, fr, fb].every(value => near(value, 0));
    if (aspect && noInset && near(l, r) && near(t, b) && Math.min(l, t) >= 0) fit = 'cover';
    else if (aspect && noCrop && near(fl, fr) && near(ft, fb) && Math.min(fl, ft) >= 0) fit = 'contain';
    else approximate('is cropped off-center, distorted or offset');
  }
  const binary = typeof Buffer !== 'undefined' ? Buffer.from(data).toString('base64') : btoa(Array.from(data, byte => String.fromCharCode(byte)).join(''));
  return {type: 'image', image: {src: `data:${metadata.mediaType};base64,${binary}`, fit}, ...(opacity === 1 ? {} : {opacity})};
}
