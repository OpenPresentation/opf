import {XMLParser} from 'fast-xml-parser';
import {readNativeBackground, readBackgroundColor, colorTransforms} from './background.js';

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
  const background = chain.map(item => item.root?.['p:cSld']?.['p:bg']).find(value => value !== undefined);
  if (!background) return undefined;
  const unsupported = () => {
    report({code:'unsupported-background-fill',message:'The native background style reference or its theme color could not be resolved from this PPTX archive.'});
    return undefined;
  };
  const context = {colors, mapping};
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
  return readNativeBackground(drawingObject([style]), dimensions, report, context);
}
