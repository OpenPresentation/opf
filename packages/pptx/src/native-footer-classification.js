// Bounded current-native fallback for generated literals whose ftr role was
// stripped. No source words, tags, geometry or fonts are replayed.
import {escapeLiteralTokens} from './furniture-fields.js';

const array = value => value === undefined ? [] : Array.isArray(value) ? value : [value];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const nameOf = shape => shape?.['p:nvSpPr']?.['p:cNvPr']?.name;
const generatedName = name => {
  const match = typeof name === 'string' && /^OPF furniture (0|[1-9]\d*) part (0|[1-9]\d*) line 0$/.exec(name);
  return match && match.slice(1).every(value => Number.isSafeInteger(Number(value))) ? {group: match[1], part: match[2]} : undefined;
};
const contains = (node, keys) => object(node) ? Object.entries(node).some(([key, value]) => keys.includes(key) || contains(value, keys)) : Array.isArray(node) && node.some(value => contains(value, keys));
const integer = value => (typeof value === 'number' || typeof value === 'string' && /^-?\d+$/.test(value)) && Number.isSafeInteger(Number(value));
const disabled = value => value === undefined || ['0','false','off'].includes(String(value));

function frame(shape, width, height) {
  const transform = shape['p:spPr']?.['a:xfrm'];
  if (!object(transform) || transform.rot !== undefined && (!integer(transform.rot) || Number(transform.rot) !== 0) || !disabled(transform.flipH) || !disabled(transform.flipV)) return undefined;
  if (![transform['a:off']?.x, transform['a:off']?.y, transform['a:ext']?.cx, transform['a:ext']?.cy].every(integer)) return undefined;
  const x = Number(transform['a:off']?.x), y = Number(transform['a:off']?.y), cx = Number(transform['a:ext']?.cx), cy = Number(transform['a:ext']?.cy);
  if (![x,y,cx,cy,width,height].every(Number.isSafeInteger) || !(cx > 0 && cy > 0 && width > 0 && height > 0)) return undefined;
  const [X,Y,CX,CY,W,H] = [x,y,cx,cy,width,height].map(BigInt);
  if (X < 0n || Y < 0n || X + CX > W || Y + CY > H || 10n * Y < 9n * H || 20n * CY > H || 3n * CX > W) return undefined;
  const center = 3n * (2n * X + CX);
  return {x,y,cx,cy,zone: center < 2n * W ? 'left' : center > 4n * W ? 'right' : 'center'};
}

function plainFrame(shape) {
  const body = shape['p:txBody'], raw = body?.['a:bodyPr'], props = raw === '' ? {} : raw;
  if (!object(body) || !object(props) || props.rot !== undefined && (!integer(props.rot) || Number(props.rot) !== 0) || ![undefined,'horz'].includes(props.vert) || ![undefined,'none'].includes(props.wrap) ||
    ['lIns','tIns','rIns','bIns'].some(key => !Number.isFinite(Number(props[key] ?? 0)) || Number(props[key] ?? 0) < 0) ||
    !disabled(shape['p:nvSpPr']?.['p:cNvPr']?.hidden) || contains(shape, ['a:hlinkClick','a:hlinkMouseOver','a:br','a:tab','a:fld','a:effectLst','a:effectDag','a14:m','m:oMath','m:oMathPara','mc:AlternateContent'])) return false;
  return true;
}

function plainShape(shape, context) {
  if (!plainFrame(shape) || shape['p:txBody']['a:bodyPr'].wrap !== 'none') return undefined;
  const body = shape['p:txBody'];
  const paragraphs = array(body['a:p']);
  if (paragraphs.length !== 1 || !object(paragraphs[0])) return undefined;
  const paragraph = paragraphs[0], run = paragraph['a:r'], pPr = paragraph['a:pPr'];
  if ([pPr, body['a:lstStyle'], run?.['a:rPr']].some(value => value !== undefined && value !== '' && !object(value))) return undefined;
  if (!object(run) || paragraph['a:fld'] !== undefined || Number(pPr?.lvl ?? 0) !== 0) return undefined;
  const text = typeof run['a:t'] === 'string' ? run['a:t'] : object(run['a:t']) && typeof run['a:t']['#text'] === 'string' ? run['a:t']['#text'] : undefined;
  if (text === undefined || /[\r\n\t]/.test(text)) return undefined;
  const other = context.inherited?.().master?.root?.['p:txStyles']?.['p:otherStyle'];
  const defaults = style => style === undefined || style === '' || object(style)
    ? [style?.['a:lvl1pPr'], style?.['a:defPPr']] : [style];
  const sources = [pPr, ...defaults(body['a:lstStyle']), ...defaults(other), ...defaults(context.defaultTextStyle)];
  for (const source of sources) {
    if (source === undefined || source === '') continue;
    if (!object(source)) return undefined;
    const membership = ['a:buNone','a:buChar','a:buAutoNum','a:buBlip'].filter(key => Object.hasOwn(source, key));
    if (membership.length) return membership.length === 1 && membership[0] === 'a:buNone' ? text : undefined;
  }
  return undefined;
}

/** Native number witnesses must already have passed higher-priority collision checks. */
export function classifyNativeFooters(context, claimed, accepted, occupied, report) {
  const result = [], candidates = [], topLevel = new Set(array(context.root?.['p:cSld']?.['p:spTree']?.['p:sp']));
  const names = new Map();
  const inventory = node => {
    if (Array.isArray(node)) return node.forEach(inventory);
    if (!object(node)) return;
    for (const [key, value] of Object.entries(node)) {
      if (key === 'p:cNvPr' && typeof value?.name === 'string') names.set(value.name, (names.get(value.name) ?? 0) + 1);
      inventory(value);
    }
  };
  inventory(context.root);
  // No complete cross-role ownership registry exists here. Any surviving
  // customer binding conservatively reserves the whole slide from this fallback.
  const tagged = contains(context.root, ['p:custDataLst']);
  const witnesses = accepted.filter(field => field.ph === 'sldNum').map(field => {
    const shape = context.shapes[field.index], name = nameOf(shape), identity = generatedName(name);
    const p = shape?.['p:txBody']?.['a:p'], fld = p?.['a:fld'];
    const withoutField = object(p) ? {...p} : {};
    delete withoutField['a:fld'];
    const bounds = shape && frame(shape, context.slideWidth, context.slideHeight);
    return !claimed.has(field.index) && !contains(fld, ['a:hlinkClick','a:hlinkMouseOver','a:br','a:tab','a14:m','m:oMath','m:oMathPara']) && identity && names.get(name) === 1 && topLevel.has(shape) && object(p) && object(fld) && plainFrame({...shape, 'p:txBody': {...shape['p:txBody'], 'a:p': withoutField}}) && fld.type === 'slidenum' && p['a:r'] === undefined && bounds
      ? {identity, bounds, index: field.index} : undefined;
  }).filter(Boolean);
  for (const [index, shape] of context.shapes.entries()) {
    const name = nameOf(shape), identity = generatedName(name);
    if (!identity || claimed.has(index) || shape['p:nvSpPr']?.['p:nvPr']?.['p:ph'] !== undefined) continue;
    const refuse = reason => report({code: 'unclassified-native-footer', path: `shapes.${index}`, message: `The current generated-name literal remains content: ${reason}.`});
    // A cleared shape is not a reason to recover words or warn about absence.
    const current = (context.paragraphs[index] ?? []).map(value => value.text).join('\n');
    if (!current.trim()) continue;
    if (tagged) {refuse('a current customer-tag binding reserves ownership'); continue;}
    const bounds = frame(shape, context.slideWidth, context.slideHeight), text = plainShape(shape, context);
    if (names.get(name) !== 1 || !topLevel.has(shape) || !bounds || text === undefined) {refuse('identity, own footer-band frame or plain unbulleted text is unsupported'); continue;}
    const anchors = witnesses.filter(anchor => anchor.identity.group === identity.group && anchor.identity.part !== identity.part && anchor.bounds.y === bounds.y && anchor.bounds.cy === bounds.cy);
    if (anchors.length !== 1) {refuse('there is no unique accepted same-group live-number row'); continue;}
    if (occupied.has(bounds.zone)) {refuse('higher-priority furniture already owns this zone'); continue;}
    candidates.push({index, identity, bounds, text, refuse});
  }
  for (const item of candidates) {
    if (candidates.filter(other => other.identity.group === item.identity.group).length !== 1 || candidates.filter(other => other.bounds.zone === item.bounds.zone).length !== 1) {item.refuse('several current literal candidates are ambiguous'); continue;}
    result.push({index: item.index, zone: item.bounds.zone, ph: 'ftr', field: 'text', value: escapeLiteralTokens(item.text), settings: {}});
  }
  return result;
}
