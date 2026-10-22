// Raw, deterministic per-shape signals for a PPTX (`fromPptx(bytes, {signals: true})`).
//
// The importer turns a native deck into OPF with fixed rules. A deck that did
// not come from this package carries no OPF provenance, so structure such as
// code, metrics, quotes, timelines or regions has to be inferred by something
// that can judge meaning. That judgement is not made here: this module only
// reports what is in the package, as plain JSON, so a host can run its own
// classifier (a model, a rules engine, a human) over it. It reads the archive
// only: no network, no models, no clock, no randomness, nothing guessed.
//
// Every value is read from the PPTX. Text properties are the effective values
// the way PowerPoint resolves them: the run, its paragraph, the shape's list
// style, the layout and master placeholder, the master text styles, the
// presentation defaults and the theme (font tokens and scheme colours). A value
// that no part of that chain states is omitted rather than defaulted, except
// paragraph alignment (PowerPoint's own default, left).

import {XMLParser} from 'fast-xml-parser';
import {drawingObject, readSlideTheme} from './background-import.js';
import {readBackgroundColor} from './background.js';
import {mergeNativeRunProperties} from './native-text-style.js';
import {rasterMetadata} from './image-geometry.js';
import {FONT_WEIGHT_WORDS} from './font-weights.js';
import {readThemeSlotColors} from './theme-colors.js';

export const SIGNALS_VERSION = 1;

/** Default bounds. Every one can be lowered or raised (up to SIGNAL_LIMIT_CAPS) with `signals: {…}`. */
export const DEFAULT_SIGNAL_LIMITS = Object.freeze({
  maxSlides: 300,
  maxShapesPerSlide: 300,
  maxTotalShapes: 5000,
  maxParagraphsPerShape: 200,
  maxTextCharsPerShape: 8000,
  maxTextCharsTotal: 400000,
  maxTableCells: 400,
  maxTableCellChars: 200,
  maxGroupDepth: 12
});
export const SIGNAL_LIMIT_CAPS = Object.freeze({
  maxSlides: 5000, maxShapesPerSlide: 5000, maxTotalShapes: 100000, maxParagraphsPerShape: 5000, maxTextCharsPerShape: 200000,
  maxTextCharsTotal: 5000000, maxTableCells: 10000, maxTableCellChars: 5000, maxGroupDepth: 32
});

const EMU_PER_PX = 9525; // 914400 EMU per inch / 96 reference px per inch
const MAX_TRUNCATIONS = 50;
const MAX_URL = 500;

const parser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '', preserveOrder: true, parseAttributeValue: false, parseTagValue: false, trimValues: false, htmlEntities: true});

const asArray = value => value === undefined || value === null ? [] : Array.isArray(value) ? value : [value];
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const tagOf = node => { for (const key in node) if (key !== ':@' && key !== '#text') return key; return undefined; };
const kidsOf = node => { const tag = tagOf(node); return tag ? node[tag] ?? [] : []; };
const attrsOf = node => node?.[':@'] ?? {};
const findKid = (kids, tag) => (kids ?? []).find(node => Object.hasOwn(node, tag));
const filterKids = (kids, tag) => (kids ?? []).filter(node => Object.hasOwn(node, tag));
const propsOf = node => node ? drawingObject([node])[tagOf(node)] : undefined;
const textOf = kids => (kids ?? []).map(node => node['#text'] ?? '').join('');
const round = (value, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits;
const number = value => value === undefined || value === '' ? undefined : Number.isFinite(Number(value)) ? Number(value) : undefined;
const bool = value => value === '1' || value === 'true' || value === 'on' ? true : value === '0' || value === 'false' || value === 'off' ? false : undefined;
const clip = (value, max) => value.length > max ? value.slice(0, max) : value;

/** Validate the `signals` option. Returns null (off) or the effective limits. */
export function normalizeSignalOptions(value, createError) {
  if (value === undefined || value === false || value === null) return null;
  if (value === true) return {...DEFAULT_SIGNAL_LIMITS};
  if (!isObject(value)) throw createError('invalid-signals-option', 'signals must be true or an object of limits.', {path: 'options.signals'});
  const limits = {...DEFAULT_SIGNAL_LIMITS};
  for (const [key, entry] of Object.entries(value)) {
    if (!Object.hasOwn(DEFAULT_SIGNAL_LIMITS, key)) throw createError('invalid-signals-option', `Unknown signals option ${key}.`, {path: `options.signals.${key}`});
    if (!Number.isInteger(entry) || entry < 1 || entry > SIGNAL_LIMIT_CAPS[key]) throw createError('invalid-signals-option', `signals.${key} must be an integer from 1 to ${SIGNAL_LIMIT_CAPS[key]}.`, {path: `options.signals.${key}`});
    limits[key] = entry;
  }
  return limits;
}

// ---------------------------------------------------------------------------
// Fonts

const MONOSPACE_FAMILIES = new Set([
  'consolas', 'courier', 'courier new', 'lucida console', 'lucida sans typewriter', 'menlo', 'monaco', 'andale mono', 'source code pro',
  'fira code', 'fira mono', 'jetbrains mono', 'cascadia code', 'cascadia mono', 'sf mono', 'sfmono-regular', 'roboto mono', 'ibm plex mono',
  'inconsolata', 'dejavu sans mono', 'liberation mono', 'ubuntu mono', 'hack', 'droid sans mono', 'noto sans mono', 'pt mono', 'space mono',
  'anonymous pro', 'overpass mono', 'dm mono', 'courier prime', 'nimbus mono', 'lucida sans typewriter', 'ocr a extended', 'terminal', 'fixedsys',
  'letter gothic', 'prestige elite', 'monospace', 'victor mono', 'iosevka', 'input mono', 'mononoki', 'go mono', 'red hat mono', 'geist mono'
]);

/** True for a family known to be fixed-width (a list, then a `mono`/`code`/`courier`/`typewriter` word in its name). */
export function isMonospaceFamily(family) {
  if (typeof family !== 'string') return false;
  const name = family.trim().toLowerCase();
  if (!name) return false;
  if (MONOSPACE_FAMILIES.has(name)) return true;
  return /(^|[\s_-])(mono|monospace|typewriter|courier)([\s_-]|$)/.test(name) || /mono$/.test(name);
}

const weightWords = new Map(FONT_WEIGHT_WORDS);
// "Segoe UI Semibold" names its own weight; an explicit b="1" always means bold.
function familyWeight(family) {
  const last = family.trim().split(/\s+/).at(-1)?.toLowerCase();
  return last && last !== 'regular' && last !== 'normal' && last !== 'book' ? weightWords.get(last) : undefined;
}

// ---------------------------------------------------------------------------
// Slide inheritance context: theme, colours, layout and master placeholders

const PH_TYPE_ALIASES = {ctrTitle: 'title', subTitle: 'body', obj: 'body'};
const placeholderKey = ph => PH_TYPE_ALIASES[ph?.type ?? 'obj'] ?? ph?.type ?? 'obj';

function placeholdersOf(root) {
  return asArray(root?.['p:cSld']?.['p:spTree']?.['p:sp'])
    .map(sp => ({ph: sp?.['p:nvSpPr']?.['p:nvPr']?.['p:ph'], sp})).filter(entry => entry.ph !== undefined);
}

function findPlaceholder(list, ph) {
  if (!ph) return undefined;
  if (ph.idx !== undefined) {
    const exact = list.find(entry => entry.ph.idx === ph.idx && placeholderKey(entry.ph) === placeholderKey(ph)) ?? list.find(entry => entry.ph.idx === ph.idx);
    if (exact) return exact;
  }
  return list.find(entry => placeholderKey(entry.ph) === placeholderKey(ph));
}

function buildContext(slidePath, archive) {
  const theme = readSlideTheme(slidePath, archive);
  const related = (path, type) => [...archive.relationships(path).values()].find(rel => rel.type.endsWith('/' + type) && archive.bytes(rel.path))?.path;
  const layoutPath = related(slidePath, 'slideLayout');
  const masterPath = layoutPath ? related(layoutPath, 'slideMaster') : undefined;
  const layout = layoutPath ? theme.parsedPart(layoutPath)?.value?.['p:sldLayout'] : undefined;
  const master = masterPath ? theme.parsedPart(masterPath)?.value?.['p:sldMaster'] : undefined;
  const presentation = theme.parsedPart('ppt/presentation.xml')?.value?.['p:presentation'];
  const themePath = masterPath ? related(masterPath, 'theme') : undefined;
  return {
    themeName: themePath ? theme.parsedPart(themePath)?.value?.['a:theme']?.name : undefined,
    colors: theme.colors, mapping: theme.mapping, fonts: theme.fonts, format: theme.format,
    layoutPath, masterPath, layout, master,
    layoutPlaceholders: placeholdersOf(layout), masterPlaceholders: placeholdersOf(master),
    defaultTextStyle: presentation?.['p:defaultTextStyle'], txStyles: master?.['p:txStyles']
  };
}

function resolveColor(node, context) {
  if (!isObject(node)) return undefined;
  const kind = ['a:srgbClr', 'a:sysClr', 'a:schemeClr', 'a:prstClr', 'a:hslClr', 'a:scrgbClr'].find(key => node[key] !== undefined);
  if (!kind) return undefined;
  const result = {};
  const value = readBackgroundColor(node, {colors: context.colors, mapping: context.mapping});
  if (value) {
    result.color = value.hex;
    if (value.alpha !== 1) result.alpha = round(value.alpha, 3);
  }
  if (kind === 'a:schemeClr' && node[kind]?.val) result.colorRef = node[kind].val;
  return Object.keys(result).length ? result : undefined;
}

function resolveFontToken(typeface, context) {
  if (typeof typeface !== 'string' || !typeface) return undefined;
  const match = /^\+(mj|mn)-lt$/.exec(typeface);
  if (!match) return typeface.startsWith('+') ? undefined : typeface;
  return context.fonts?.[match[1] === 'mj' ? 'a:majorFont' : 'a:minorFont']?.['a:latin']?.typeface || undefined;
}

// ---------------------------------------------------------------------------
// Geometry

const ALIGNMENTS = {l: 'left', ctr: 'center', r: 'right', just: 'justify', dist: 'distributed', justLow: 'justify', thaiDist: 'distributed'};

function readXfrm(node) {
  if (!isObject(node)) return null;
  const off = node['a:off'], ext = node['a:ext'];
  const x = number(off?.x), y = number(off?.y), cx = number(ext?.cx), cy = number(ext?.cy);
  if ([x, y, cx, cy].some(value => value === undefined)) return null;
  const chOff = node['a:chOff'], chExt = node['a:chExt'];
  return {
    x, y, cx, cy, rot: number(node.rot) ?? 0, flipH: bool(node.flipH) === true, flipV: bool(node.flipV) === true,
    child: chOff && chExt && number(chOff.x) !== undefined && number(chOff.y) !== undefined && number(chExt.cx) !== undefined && number(chExt.cy) !== undefined
      ? {x: number(chOff.x), y: number(chOff.y), cx: number(chExt.cx), cy: number(chExt.cy)} : null
  };
}

const IDENTITY = Object.freeze({sx: 1, sy: 1, tx: 0, ty: 0, approximate: false});

function boxOf(xfrm, transform, source) {
  const x = transform.tx + transform.sx * xfrm.x, y = transform.ty + transform.sy * xfrm.y;
  const w = transform.sx * xfrm.cx, h = transform.sy * xfrm.cy;
  const emu = {x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h)};
  return {px: {x: round(x / EMU_PER_PX), y: round(y / EMU_PER_PX), w: round(w / EMU_PER_PX), h: round(h / EMU_PER_PX)}, emu, source,
    ...(transform.approximate ? {approximate: true} : {})};
}

function childTransform(parent, xfrm) {
  const child = xfrm.child;
  const rx = child && child.cx ? xfrm.cx / child.cx : 1, ry = child && child.cy ? xfrm.cy / child.cy : 1;
  const ox = child ? child.x : 0, oy = child ? child.y : 0;
  return {
    sx: parent.sx * rx, sy: parent.sy * ry,
    tx: parent.tx + parent.sx * (xfrm.x - ox * rx), ty: parent.ty + parent.sy * (xfrm.y - oy * ry),
    approximate: parent.approximate || xfrm.rot !== 0 || xfrm.flipH || xfrm.flipV
  };
}

// ---------------------------------------------------------------------------
// Text

function mergeParagraphLevels(levels) {
  const out = {attrs: {}, rpr: {}};
  for (const level of levels) {
    if (!isObject(level)) continue;
    for (const [key, value] of Object.entries(level)) {
      if (typeof value !== 'object' || value === null) out.attrs[key] = value;
      else if (key === 'a:defRPr') out.rpr = mergeNativeRunProperties(out.rpr, value);
      else if (['a:buNone', 'a:buChar', 'a:buAutoNum', 'a:buBlip'].includes(key)) out.bullet = {key, value};
      else if (['a:spcBef', 'a:spcAft', 'a:lnSpc'].includes(key)) out[key] = value;
    }
  }
  return out;
}

function bulletOf(bullet) {
  if (!bullet || bullet.key === 'a:buNone') return null;
  if (bullet.key === 'a:buChar') return {kind: 'char', ...(bullet.value.char ? {char: clip(String(bullet.value.char), 8)} : {})};
  if (bullet.key === 'a:buAutoNum') return {kind: 'number', scheme: bullet.value.type ?? 'arabicPeriod', ...(number(bullet.value.startAt) !== undefined ? {startAt: number(bullet.value.startAt)} : {})};
  return {kind: 'picture'};
}

function spacing(node, suffix) {
  if (!isObject(node)) return {};
  const pts = number(node['a:spcPts']?.val), pct = number(node['a:spcPct']?.val);
  if (pts !== undefined) return {[`${suffix}Pt`]: round(pts / 100)};
  if (pct !== undefined) return {[`${suffix}Pct`]: round(pct / 1000, 1)};
  return {};
}

function runSignal(text, properties, context, relationships, extra) {
  const run = {text};
  const font = resolveFontToken(properties['a:latin']?.typeface, context);
  if (font) {
    run.font = font;
    if (isMonospaceFamily(font)) run.monospace = true;
  }
  const size = number(properties.sz);
  if (size !== undefined && size > 0) run.size = round(size / 100);
  const bold = bool(properties.b), italic = bool(properties.i);
  const named = font ? familyWeight(font) : undefined;
  // Defaults are omitted: bold, italic and monospace are absent when false, weight when 400.
  if (bold === true) run.bold = true;
  if (italic === true) run.italic = true;
  const weight = bold === true ? 700 : named;
  if (weight !== undefined && weight !== 400) run.weight = weight;
  if (properties.u !== undefined && properties.u !== 'none') run.underline = true;
  if (properties.strike !== undefined && properties.strike !== 'noStrike') run.strike = true;
  const baseline = number(properties.baseline);
  if (baseline) run.baseline = baseline > 0 ? 'superscript' : 'subscript';
  if (properties.cap === 'all' || properties.cap === 'small') run.caps = properties.cap;
  if (properties['a:solidFill']) Object.assign(run, resolveColor(properties['a:solidFill'], context) ?? {});
  const link = properties['a:hlinkClick'];
  if (link) {
    const target = relationships.get(link['r:id']);
    if (target?.type.endsWith('/hyperlink') && target.targetMode === 'External' && target.target) run.link = clip(target.target, MAX_URL);
    else if (link.action) run.linkAction = clip(String(link.action), 80);
  }
  Object.assign(run, extra);
  return run;
}

const sameStyle = (a, b) => {
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) if (key !== 'text' && a[key] !== b[key]) return false;
  return true;
};

/** Read a txBody. Returns {text, summary} for shapes and table cells alike. */
function readTextBody(txBody, shape, context, relationships, limits, budget, report) {
  const bodyKids = kidsOf(txBody);
  const lstStyle = propsOf(findKid(bodyKids, 'a:lstStyle')) ?? {};
  const paragraphNodes = filterKids(bodyKids, 'a:p');
  const ph = shape.ph;
  const layoutPh = ph ? findPlaceholder(context.layoutPlaceholders, ph) : undefined;
  const masterPh = ph ? findPlaceholder(context.masterPlaceholders, layoutPh?.ph ?? ph) : undefined;
  const styleKey = !ph ? undefined : ['title', 'ctrTitle'].includes(ph.type) ? 'p:titleStyle' : ['dt', 'ftr', 'sldNum'].includes(ph.type) ? 'p:otherStyle' : 'p:bodyStyle';
  const sources = [
    context.defaultTextStyle, styleKey ? context.txStyles?.[styleKey] : undefined,
    masterPh?.sp?.['p:txBody']?.['a:lstStyle'], layoutPh?.sp?.['p:txBody']?.['a:lstStyle'], lstStyle
  ];

  const paragraphs = [];
  let chars = 0, monoChars = 0, maxSize = 0, bullets = 0, emitted = 0;
  const sizeCounts = new Map(), fontCounts = new Map();
  for (const paragraphNode of paragraphNodes) {
    const pKids = kidsOf(paragraphNode);
    const pPr = propsOf(findKid(pKids, 'a:pPr')) ?? {};
    const level = Math.max(0, Math.min(8, number(pPr.lvl) ?? 0));
    const levelKey = `a:lvl${level + 1}pPr`;
    const merged = mergeParagraphLevels([...sources.map(source => source?.[levelKey]), pPr]);
    const runs = [];
    let text = '';
    for (const node of pKids) {
      const tag = tagOf(node);
      if (tag !== 'a:r' && tag !== 'a:fld' && tag !== 'a:br') continue;
      const rPr = propsOf(findKid(kidsOf(node), 'a:rPr')) ?? {};
      const properties = mergeNativeRunProperties(merged.rpr, rPr);
      const value = tag === 'a:br' ? '\n' : textOf(kidsOf(findKid(kidsOf(node), 'a:t')));
      if (tag !== 'a:br' && value === '') continue;
      const extra = tag === 'a:fld' ? {field: attrsOf(node).type ?? 'field'} : tag === 'a:br' ? {lineBreak: true} : {};
      const signal = runSignal(value, properties, context, relationships, extra);
      // Fall back to the theme body font when no part of the chain names a Latin face.
      if (signal.font === undefined) {
        const fallback = context.fonts?.['a:minorFont']?.['a:latin']?.typeface;
        if (fallback) { signal.font = fallback; if (isMonospaceFamily(fallback)) signal.monospace = true; }
      }
      text += value;
      const last = runs.at(-1);
      if (last && !extra.field && !extra.lineBreak && !last.field && !last.lineBreak && sameStyle(last, signal)) last.text += value;
      else runs.push(signal);
    }
    const visible = text.replace(/\n/g, '');
    chars += text.length;
    for (const run of runs) {
      if (run.lineBreak) continue;
      const count = run.text.replace(/\s/g, '').length;
      if (run.monospace) monoChars += count;
      if (run.size !== undefined) { maxSize = Math.max(maxSize, run.size); sizeCounts.set(run.size, (sizeCounts.get(run.size) ?? 0) + count); }
      if (run.font) fontCounts.set(run.font, (fontCounts.get(run.font) ?? 0) + count);
    }
    const bullet = bulletOf(merged.bullet);
    if (bullet && visible !== '') bullets += 1;
    const marginLeft = number(merged.attrs.marL), indent = number(merged.attrs.indent);
    const align = ALIGNMENTS[merged.attrs.algn] ?? 'left';
    const paragraph = {
      text, ...(level ? {level} : {}), ...(align !== 'left' ? {align} : {}), ...(bullet ? {bullet} : {}),
      ...(marginLeft ? {marginLeftPx: round(marginLeft / EMU_PER_PX)} : {}),
      ...(indent ? {indentPx: round(indent / EMU_PER_PX)} : {}),
      ...spacing(merged['a:lnSpc'], 'lineSpacing'), ...spacing(merged['a:spcBef'], 'spaceBefore'), ...spacing(merged['a:spcAft'], 'spaceAfter'),
      runs
    };
    if (emitted < limits.maxParagraphsPerShape && budget.chars > 0) {
      emitted += 1;
      let remaining = Math.min(limits.maxTextCharsPerShape - paragraphs.reduce((sum, item) => sum + item.text.length, 0), budget.chars);
      if (remaining <= 0) { report('text'); paragraph.text = ''; paragraph.runs = []; paragraph.truncated = true; }
      else if (paragraph.text.length > remaining) {
        paragraph.text = paragraph.text.slice(0, remaining); paragraph.truncated = true; report('text');
        let left = remaining;
        paragraph.runs = runs.flatMap(run => { if (left <= 0) return []; const piece = {...run, text: run.text.slice(0, left)}; left -= piece.text.length; return [piece]; });
      }
      budget.chars -= paragraph.text.length;
      paragraphs.push(paragraph);
    } else report(emitted >= limits.maxParagraphsPerShape ? 'paragraphs' : 'text');
  }

  const dominant = counts => [...counts].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0];
  const bodyPr = propsOf(findKid(bodyKids, 'a:bodyPr')) ?? {};
  const inheritedBodyPr = key => [bodyPr, layoutPh?.sp?.['p:txBody']?.['a:bodyPr'], masterPh?.sp?.['p:txBody']?.['a:bodyPr']].map(item => item?.[key]).find(value => value !== undefined);
  const fitSource = [bodyPr, layoutPh?.sp?.['p:txBody']?.['a:bodyPr'], masterPh?.sp?.['p:txBody']?.['a:bodyPr']].find(item => item?.['a:normAutofit'] || item?.['a:spAutoFit'] || item?.['a:noAutofit']);
  const autofit = fitSource?.['a:normAutofit'] ? 'shrink' : fitSource?.['a:spAutoFit'] ? 'resize' : fitSource?.['a:noAutofit'] ? 'none' : undefined;
  const anchor = inheritedBodyPr('anchor');
  const total = paragraphNodes.length;
  return {
    paragraphs,
    paragraphCount: total,
    chars,
    maxFontSize: maxSize || undefined,
    dominantFont: dominant(fontCounts),
    dominantSize: dominant(sizeCounts),
    ...(monoChars ? {monospaceShare: round(monoChars / Math.max(1, [...fontCounts.values()].reduce((sum, value) => sum + value, 0)), 3)} : {}),
    ...(bullets ? {bulletedParagraphs: bullets} : {}),
    ...(anchor ? {anchor: {t: 'top', ctr: 'middle', b: 'bottom'}[anchor] ?? anchor} : {}),
    ...(autofit ? {autofit} : {}),
    ...(inheritedBodyPr('wrap') === 'none' ? {wrap: 'none'} : {}),
    ...(inheritedBodyPr('vert') && inheritedBodyPr('vert') !== 'horz' ? {vertical: inheritedBodyPr('vert')} : {}),
    ...(number(inheritedBodyPr('numCol')) > 1 ? {columns: number(inheritedBodyPr('numCol'))} : {})
  };
}

// ---------------------------------------------------------------------------
// Fill and outline

function fillSignal(spPr, chain, styleNode, context) {
  const kinds = [['a:noFill', 'none'], ['a:solidFill', 'solid'], ['a:gradFill', 'gradient'], ['a:blipFill', 'picture'], ['a:pattFill', 'pattern'], ['a:grpFill', 'group']];
  for (const owner of [spPr, ...chain]) {
    if (!owner) continue;
    const entry = kinds.find(([key]) => owner[key] !== undefined);
    if (!entry) continue;
    const [key, kind] = entry;
    const fill = {kind, ...(owner === spPr ? {} : {source: 'placeholder'})};
    if (kind === 'solid') Object.assign(fill, resolveColor(owner[key], context) ?? {});
    if (kind === 'gradient') {
      const stops = asArray(owner[key]['a:gsLst']?.['a:gs']).map(stop => ({position: round((number(stop.pos) ?? 0) / 100000, 4), ...(resolveColor(stop, context) ?? {})}));
      if (stops.length) fill.stops = stops.slice(0, 8);
      const angle = number(owner[key]['a:lin']?.ang);
      if (angle !== undefined) fill.angle = round(angle / 60000, 1);
    }
    if (kind === 'pattern') { fill.pattern = owner[key].prst; Object.assign(fill, resolveColor(owner[key]['a:fgClr'], context) ?? {}); }
    return fill;
  }
  const ref = styleNode?.['a:fillRef'];
  const idx = number(ref?.idx);
  if (idx === undefined) return undefined;
  if (idx === 0) return {kind: 'none', source: 'style'};
  return {kind: 'style', source: 'style', styleIndex: idx, ...(resolveColor(ref, context) ?? {})};
}

function outlineSignal(spPr, chain, styleNode, context) {
  for (const owner of [spPr, ...chain]) {
    const ln = owner?.['a:ln'];
    if (!ln) continue;
    const width = number(ln.w);
    const outline = {kind: ln['a:noFill'] ? 'none' : ln['a:gradFill'] ? 'gradient' : ln['a:solidFill'] ? 'solid' : ln['a:pattFill'] ? 'pattern' : 'inherited', ...(owner === spPr ? {} : {source: 'placeholder'})};
    if (ln['a:solidFill']) Object.assign(outline, resolveColor(ln['a:solidFill'], context) ?? {});
    if (width !== undefined) outline.widthPt = round(width / 12700, 3);
    if (ln['a:prstDash']?.val && ln['a:prstDash'].val !== 'solid') outline.dash = ln['a:prstDash'].val;
    if (ln['a:headEnd']?.type && ln['a:headEnd'].type !== 'none') outline.headArrow = ln['a:headEnd'].type;
    if (ln['a:tailEnd']?.type && ln['a:tailEnd'].type !== 'none') outline.tailArrow = ln['a:tailEnd'].type;
    if (outline.kind !== 'inherited' || width !== undefined) return outline;
  }
  const ref = styleNode?.['a:lnRef'];
  const idx = number(ref?.idx);
  if (idx === undefined) return undefined;
  if (idx === 0) return {kind: 'none', source: 'style'};
  const themed = asArray(context.format?.['a:lnStyleLst']?.['a:ln'])[idx - 1];
  const width = number(themed?.w);
  return {kind: 'style', source: 'style', styleIndex: idx, ...(width !== undefined ? {widthPt: round(width / 12700, 3)} : {}), ...(resolveColor(ref, context) ?? {})};
}

// ---------------------------------------------------------------------------
// Per shape readers

const GRAPHIC_TABLE = 'http://schemas.openxmlformats.org/drawingml/2006/table';
const GRAPHIC_CHART = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
const GRAPHIC_DIAGRAM = 'http://schemas.openxmlformats.org/drawingml/2006/diagram';

function chartSignal(frameKids, relationships, archive) {
  const graphicData = findKid(kidsOf(findKid(frameKids, 'a:graphic')), 'a:graphicData');
  const chartNode = findKid(kidsOf(graphicData), 'c:chart') ?? findKid(kidsOf(graphicData), 'cx:chart');
  const relId = attrsOf(chartNode)['r:id'];
  const relationship = relId ? relationships.get(relId) : undefined;
  const signal = {extended: Boolean(findKid(kidsOf(graphicData), 'cx:chart'))};
  if (!relationship?.path || !archive.bytes(relationship.path)) return signal;
  signal.part = relationship.path;
  try {
    const space = archive.part(relationship.path, parser);
    const rootNode = space.find(node => Object.hasOwn(node, 'c:chartSpace'));
    const root = propsOf(rootNode) ?? {};
    const plotArea = root['c:chart']?.['c:plotArea'];
    if (plotArea) {
      const types = Object.keys(plotArea).filter(key => /^c:\w+Chart$/.test(key));
      if (types.length) {
        signal.chartTypes = types.map(key => key.slice(2, -5));
        const first = plotArea[types[0]];
        const series = asArray(first?.['c:ser']);
        signal.seriesCount = types.reduce((sum, key) => sum + asArray(plotArea[key]?.['c:ser']).length, 0);
        const points = number(series[0]?.['c:val']?.['c:numRef']?.['c:numCache']?.['c:ptCount']?.val) ?? number(series[0]?.['c:cat']?.['c:strRef']?.['c:strCache']?.['c:ptCount']?.val);
        if (points !== undefined) signal.pointCount = points;
        if (first?.['c:barDir']?.val) signal.barDirection = first['c:barDir'].val;
        if (first?.['c:grouping']?.val) signal.grouping = first['c:grouping'].val;
      }
    }
    const titleRuns = [];
    const walk = nodes => { for (const node of nodes ?? []) { if (node['a:t'] !== undefined) titleRuns.push(textOf(node['a:t'])); else walk(kidsOf(node)); } };
    const chartKids = kidsOf(rootNode);
    const titleNode = findKid(kidsOf(findKid(chartKids, 'c:chart')), 'c:title');
    if (titleNode) walk(kidsOf(titleNode));
    if (titleRuns.length) signal.title = clip(titleRuns.join(''), 200);
  } catch { signal.unreadable = true; }
  return signal;
}

function tableSignal(frameKids, limits, budget, report) {
  const graphicData = findKid(kidsOf(findKid(frameKids, 'a:graphic')), 'a:graphicData');
  const table = findKid(kidsOf(graphicData), 'a:tbl');
  const kids = kidsOf(table);
  const tblPr = attrsOf(findKid(kids, 'a:tblPr'));
  const columns = filterKids(kidsOf(findKid(kids, 'a:tblGrid')), 'a:gridCol').map(node => number(attrsOf(node).w));
  const rows = filterKids(kids, 'a:tr');
  const cells = [];
  let spanned = false, count = 0, clipped = false;
  for (const row of rows) {
    const line = [];
    for (const cell of filterKids(kidsOf(row), 'a:tc')) {
      const attrs = attrsOf(cell);
      if (attrs.gridSpan || attrs.rowSpan || attrs.hMerge || attrs.vMerge) spanned = true;
      let text = '';
      const body = findKid(kidsOf(cell), 'a:txBody');
      const paragraphs = filterKids(kidsOf(body), 'a:p').map(paragraph => kidsOf(paragraph).map(node => {
        const tag = tagOf(node);
        return tag === 'a:r' || tag === 'a:fld' ? textOf(kidsOf(findKid(kidsOf(node), 'a:t'))) : tag === 'a:br' ? '\n' : '';
      }).join(''));
      text = paragraphs.join('\n');
      if (count >= limits.maxTableCells || budget.chars <= 0) { clipped = true; line.push(null); continue; }
      count += 1;
      const room = Math.min(limits.maxTableCellChars, budget.chars);
      if (text.length > room) { text = text.slice(0, room); clipped = true; }
      budget.chars -= text.length;
      line.push(text);
    }
    cells.push(line);
  }
  if (clipped) report('table');
  return {
    rows: rows.length, columns: columns.length,
    ...(columns.every(value => value !== undefined) ? {columnWidthsPx: columns.map(value => round(value / EMU_PER_PX))} : {}),
    firstRow: bool(tblPr.firstRow) === true, firstColumn: bool(tblPr.firstCol) === true, bandedRows: bool(tblPr.bandRow) === true,
    ...(spanned ? {merged: true} : {}),
    cells: cells.map(line => line.map(value => value ?? '')),
    ...(clipped ? {truncated: true} : {})
  };
}

function pictureSignal(picProps, picKids, relationships, archive) {
  const blip = picProps['p:blipFill']?.['a:blip'];
  const relId = blip?.['r:embed'];
  const relationship = relId ? relationships.get(relId) : undefined;
  const signal = {};
  if (relationship?.path && archive.bytes(relationship.path)) {
    const bytes = archive.bytes(relationship.path);
    const metadata = rasterMetadata(bytes);
    const extension = relationship.path.toLowerCase().split('.').pop();
    signal.part = relationship.path;
    signal.mediaType = metadata?.mediaType ?? ({png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', emf: 'image/x-emf', wmf: 'image/x-wmf', tif: 'image/tiff', tiff: 'image/tiff', bmp: 'image/bmp'}[extension]);
    signal.bytes = bytes.length;
    if (metadata) signal.naturalPx = {w: metadata.width, h: metadata.height};
  } else if (relId) signal.unresolved = true;
  const crop = picProps['p:blipFill']?.['a:srcRect'];
  if (crop && ['l', 'r', 't', 'b'].some(key => number(crop[key]))) signal.crop = Object.fromEntries(['l', 't', 'r', 'b'].map(key => [key, round((number(crop[key]) ?? 0) / 1000, 2)]));
  if (picProps['p:blipFill']?.['a:tile']) signal.tiled = true;
  return signal;
}

function mediaKind(nvPr) {
  const kids = kidsOf(nvPr);
  if (findKid(kids, 'a:videoFile')) return 'video';
  if (findKid(kids, 'a:audioFile') || findKid(kids, 'a:wavAudioFile')) return 'audio';
  const ext = findKid(kids, 'p:extLst');
  if (JSON.stringify(ext ?? '').includes('p14:media')) return 'video';
  return undefined;
}

// ---------------------------------------------------------------------------
// The slide walker

/** Indexes matching nativeTextShapes / nativePictures: a level's own elements first, then each group's, depth first. */
function indexByTag(nodes, tag) {
  const map = new Map();
  const visit = list => {
    for (const node of list ?? []) if (Object.hasOwn(node, tag)) map.set(node, map.size);
    for (const node of list ?? []) if (Object.hasOwn(node, 'p:grpSp')) visit(node['p:grpSp']);
  };
  visit(nodes);
  return map;
}

function nvOf(node) {
  const kids = kidsOf(node);
  const nv = kids.find(child => (tagOf(child) ?? '').startsWith('p:nv'));
  const kidsOfNv = kidsOf(nv);
  const cNvPr = attrsOf(findKid(kidsOfNv, 'p:cNvPr'));
  const nvPr = findKid(kidsOfNv, 'p:nvPr');
  const ph = findKid(kidsOf(nvPr), 'p:ph');
  const cNvSpPr = attrsOf(findKid(kidsOfNv, 'p:cNvSpPr'));
  return {cNvPr, nvPr, ph: ph ? attrsOf(ph) : undefined, txBox: cNvSpPr.txBox === '1' || cNvSpPr.txBox === 'true'};
}

function extractSlide(slidePath, index, archive, limits, budget, links, record) {
  const slideTree = archive.part(slidePath, parser);
  const slideNode = slideTree.find(node => Object.hasOwn(node, 'p:sld'));
  const slideKids = kidsOf(slideNode);
  const cSld = findKid(slideKids, 'p:cSld');
  const spTree = findKid(kidsOf(cSld), 'p:spTree');
  const treeKids = kidsOf(spTree);
  const relationships = archive.relationships(slidePath);
  const context = buildContext(slidePath, archive);

  const slide = {
    index, part: slidePath,
    ...(attrsOf(cSld).name ? {name: attrsOf(cSld).name} : {}),
    ...(attrsOf(slideNode).show === '0' ? {hidden: true} : {}),
    layout: {part: context.layoutPath ?? null, name: context.layout?.['p:cSld']?.name ?? null, ...(context.layout?.type ? {type: context.layout.type} : {})},
    master: {part: context.masterPath ?? null, name: context.master?.['p:cSld']?.name ?? null, theme: context.themeName ?? null},
    provenance: record?.structure ?? 'untagged',
    shapes: []
  };

  const shapeLimit = Math.min(limits.maxShapesPerSlide, budget.shapes);
  const truncated = {};
  const note = (kind) => { truncated[kind] = (truncated[kind] ?? 0) + 1; };
  const spIndex = indexByTag(treeKids, 'p:sp'), picIndex = indexByTag(treeKids, 'p:pic');
  const frameNodes = filterKids(treeKids, 'p:graphicFrame');
  const alternateNodes = filterKids(treeKids, 'mc:AlternateContent');
  const nodeKey = node => spIndex.has(node) ? `sp:${spIndex.get(node)}` : picIndex.has(node) ? `pic:${picIndex.get(node)}` : undefined;

  let zOrder = 0;
  const ids = [];

  const walk = (nodes, parentId, transform, depth, topLevel) => {
    for (const node of nodes ?? []) {
      let tag = tagOf(node), target = node, key;
      if (tag === 'mc:AlternateContent') {
        const alternate = alternateNodes.indexOf(node);
        const choice = findKid(kidsOf(node), 'mc:Choice'), fallback = findKid(kidsOf(node), 'mc:Fallback');
        const inner = kidsOf(choice).find(child => tagOf(child)?.startsWith('p:')) ?? kidsOf(fallback).find(child => tagOf(child)?.startsWith('p:'));
        if (!inner) continue;
        target = inner; tag = tagOf(inner);
        key = alternate >= 0 ? `alt:${alternate}` : undefined;
      } else if (tag === 'p:graphicFrame') {
        const frame = frameNodes.indexOf(node);
        key = topLevel && frame >= 0 ? `frame:${frame}` : undefined;
      } else key = nodeKey(node);
      if (!['p:sp', 'p:cxnSp', 'p:pic', 'p:graphicFrame', 'p:grpSp', 'p:contentPart'].includes(tag)) continue;
      const z = zOrder++;
      const id = `s${z}`;
      if (slide.shapes.length >= shapeLimit) { note('shapes'); if (tag === 'p:grpSp') walkIgnored(kidsOf(target), true); continue; }
      let shape;
      try { shape = readShape(target, tag, id, z, parentId, transform, depth, key, topLevel); }
      catch (error) { shape = {id, zOrder: z, kind: 'unknown', parent: parentId, depth, unreadable: String(error?.message ?? error).slice(0, 200)}; }
      slide.shapes.push(shape);
      ids.push(shape);
      if (tag === 'p:grpSp' && depth + 1 < limits.maxGroupDepth) {
        const xfrm = readXfrm(propsOf(findKid(kidsOf(target), 'p:grpSpPr'))?.['a:xfrm']);
        const inner = xfrm ? childTransform(transform, xfrm) : transform;
        const before = slide.shapes.length;
        walk(kidsOf(target), id, inner, depth + 1, false);
        shape.children = slide.shapes.slice(before).filter(child => child.parent === id).map(child => child.id);
      } else if (tag === 'p:grpSp') { shape.children = []; note('depth'); walkIgnored(kidsOf(target), false); }
    }
  };
  // Shapes that are not reported still take a z-order slot, so ids of the shapes that are stay stable under a lower limit.
  const walkIgnored = (nodes, counted) => {
    for (const node of nodes ?? []) {
      const tag = tagOf(node);
      if (!['p:sp', 'p:cxnSp', 'p:pic', 'p:graphicFrame', 'p:grpSp', 'p:contentPart', 'mc:AlternateContent'].includes(tag)) continue;
      zOrder += 1;
      if (counted) note('shapes');
      if (tag === 'p:grpSp') walkIgnored(kidsOf(node), counted);
    }
  };

  const readShape = (node, tag, id, z, parentId, transform, depth, key, topLevel) => {
    const kids = kidsOf(node);
    const props = propsOf(node) ?? {};
    const nv = nvOf(node);
    const shape = {id, zOrder: z, nativeId: number(nv.cNvPr.id), name: nv.cNvPr.name ?? '', kind: 'unknown', parent: parentId ?? null, depth};
    if (nv.cNvPr.descr) shape.alt = clip(nv.cNvPr.descr, 500);
    if (nv.cNvPr.title) shape.title = clip(nv.cNvPr.title, 200);
    if (nv.cNvPr.hidden === '1' || nv.cNvPr.hidden === 'true') shape.hidden = true;
    if (key) shape.nativeKey = key;
    const tagged = Boolean(findKid(kidsOf(nv.nvPr), 'p:custDataLst'));
    if (tagged) shape.opfTagged = true;

    const spPr = props['p:spPr'] ?? props['p:grpSpPr'];
    let xfrm = readXfrm(tag === 'p:graphicFrame' ? props['p:xfrm'] : spPr?.['a:xfrm']);
    let source = 'own';
    let layoutPh, masterPh;
    if (nv.ph) {
      shape.placeholder = {type: nv.ph.type ?? 'obj', ...(number(nv.ph.idx) !== undefined ? {idx: number(nv.ph.idx)} : {}), ...(nv.ph.sz ? {size: nv.ph.sz} : {}), ...(nv.ph.orient ? {orientation: nv.ph.orient} : {})};
      layoutPh = findPlaceholder(context.layoutPlaceholders, nv.ph);
      masterPh = findPlaceholder(context.masterPlaceholders, layoutPh?.ph ?? nv.ph);
      if (!xfrm) {
        const fromLayout = readXfrm(layoutPh?.sp?.['p:spPr']?.['a:xfrm']);
        const fromMaster = readXfrm(masterPh?.sp?.['p:spPr']?.['a:xfrm']);
        xfrm = fromLayout ?? fromMaster; source = fromLayout ? 'layout' : fromMaster ? 'master' : 'own';
      }
    }
    if (xfrm) {
      shape.box = boxOf(xfrm, source === 'own' ? transform : IDENTITY, source);
      if (xfrm.rot) shape.rotation = round(xfrm.rot / 60000, 3);
      if (xfrm.flipH) shape.flipH = true;
      if (xfrm.flipV) shape.flipV = true;
    } else shape.box = null;

    const chain = [layoutPh?.sp?.['p:spPr'], masterPh?.sp?.['p:spPr']];
    const style = props['p:style'];
    const finishVisuals = () => {
      const fill = fillSignal(spPr, chain, style, context), outline = outlineSignal(spPr, chain, style, context);
      if (fill) shape.fill = fill;
      if (outline) shape.outline = outline;
      const geometry = spPr?.['a:prstGeom']?.prst ?? (spPr?.['a:custGeom'] ? 'custom' : undefined);
      if (geometry) shape.geometry = geometry;
    };

    if (tag === 'p:grpSp') { shape.kind = 'group'; shape.children = []; return shape; }
    if (tag === 'p:cxnSp') { shape.kind = 'connector'; finishVisuals(); return shape; }
    if (tag === 'p:pic') {
      const media = mediaKind(findKid(kidsOf(kids.find(child => tagOf(child) === 'p:nvPicPr')), 'p:nvPr'));
      shape.kind = media ? 'media' : 'picture';
      if (media) shape.mediaKind = media;
      Object.assign(shape, {picture: pictureSignal(props, kids, relationships, archive)});
      finishVisuals();
      return shape;
    }
    if (tag === 'p:graphicFrame') {
      const uri = attrsOf(findKid(kidsOf(findKid(kids, 'a:graphic')), 'a:graphicData')).uri;
      if (findKid(kidsOf(findKid(kidsOf(findKid(kids, 'a:graphic')), 'a:graphicData')), 'a:tbl')) {
        shape.kind = 'table'; shape.table = tableSignal(kids, limits, budget, note);
      } else if (uri === GRAPHIC_CHART || uri?.includes('chartex') || findKid(kidsOf(findKid(kidsOf(findKid(kids, 'a:graphic')), 'a:graphicData')), 'c:chart')) {
        shape.kind = 'chart'; shape.chart = chartSignal(kids, relationships, archive);
      } else if (uri === GRAPHIC_DIAGRAM) shape.kind = 'smartart';
      else if (findKid(kidsOf(findKid(kidsOf(findKid(kids, 'a:graphic')), 'a:graphicData')), 'p:oleObj')) shape.kind = 'ole';
      else { shape.kind = 'unknown'; if (uri) shape.graphicType = clip(uri, 120); }
      return shape;
    }
    if (tag === 'p:contentPart') { shape.kind = 'unknown'; return shape; }

    // p:sp
    const txBody = findKid(kids, 'p:txBody');
    const info = {ph: nv.ph};
    const text = txBody ? readTextBody(txBody, info, context, relationships, limits, budget, note) : undefined;
    const geometry = spPr?.['a:prstGeom']?.prst;
    const hasText = text && text.chars > 0;
    if (hasText || nv.txBox) shape.kind = 'text';
    else if (nv.ph) shape.kind = 'placeholder';
    else if (geometry === 'line' || geometry === 'straightConnector1') shape.kind = 'line';
    else shape.kind = 'shape';
    if (text) shape.text = text;
    finishVisuals();
    return shape;
  };

  walk(treeKids, null, IDENTITY, 0, true);

  // Links to the imported OPF, then groups: a group links where all its members do.
  for (const shape of slide.shapes) {
    const link = shape.nativeKey ? links.get(shape.nativeKey) : undefined;
    shape.opf = link ?? null;
    delete shape.nativeKey;
  }
  const byId = new Map(slide.shapes.map(shape => [shape.id, shape]));
  const settle = shape => {
    if (shape.kind !== 'group' || shape.opf) return shape.opf;
    const members = (shape.children ?? []).map(id => settle(byId.get(id)) ?? null);
    const first = members[0];
    if (first && first.path && members.every(member => member && member.path === first.path)) shape.opf = {...first};
    return shape.opf;
  };
  for (const shape of slide.shapes) if (shape.kind === 'group') settle(shape);

  budget.shapes -= slide.shapes.length;
  slide.stats = {
    shapes: slide.shapes.length,
    text: slide.shapes.filter(shape => shape.kind === 'text').length,
    pictures: slide.shapes.filter(shape => shape.kind === 'picture').length,
    tables: slide.shapes.filter(shape => shape.kind === 'table').length,
    charts: slide.shapes.filter(shape => shape.kind === 'chart').length,
    groups: slide.shapes.filter(shape => shape.kind === 'group').length
  };
  if (Object.keys(truncated).length) slide.truncated = truncated;
  return slide;
}

// ---------------------------------------------------------------------------
// Links from native shapes to the imported OPF

/**
 * Resolve a slide's recorded sources (see importSlide) to OPF paths.
 * `contentPaths` maps a flat imported block index to its path under the slide
 * when document provenance rebuilt the authored structure.
 */
export function resolveSlideLinks(slideIndex, recorded, contentPaths) {
  const links = new Map();
  if (!recorded) return links;
  const put = (key, link) => { if (!links.has(key)) links.set(key, link); };
  for (const [key, role] of recorded.roles ?? []) put(key, {role});
  for (const role of ['tag', 'title', 'subtitle']) for (const key of recorded[role] ?? []) links.set(key, {role, path: `slides.${slideIndex}.${role}`});
  (recorded.blocks ?? []).forEach((block, index) => {
    const relative = contentPaths?.get(index) ?? `blocks.${index}`;
    for (const key of block.sources ?? []) links.set(key, {role: 'block', path: `slides.${slideIndex}.${relative}`, blockType: block.type});
  });
  return links;
}

// ---------------------------------------------------------------------------
// Deck

export function extractSignals({archive, presentationRoot, slidePaths, themeFacts, limits, recorded, slideProvenance, contentPaths}) {
  const budget = {chars: limits.maxTextCharsTotal, shapes: limits.maxTotalShapes};
  const slides = [];
  const reported = slidePaths.slice(0, limits.maxSlides);
  for (const [index, path] of reported.entries()) {
    const links = resolveSlideLinks(index, recorded[index], contentPaths?.[index]);
    slides.push(extractSlide(path, index, archive, limits, budget, links, slideProvenance?.[index]));
  }
  const cx = number(presentationRoot['p:sldSz']?.cx), cy = number(presentationRoot['p:sldSz']?.cy);
  const tagged = (slideProvenance ?? []).filter(entry => entry && entry.structure !== 'untagged').length;
  const deck = {
    slideCount: slidePaths.length,
    ...(cx && cy ? {dimensions: {widthEmu: cx, heightEmu: cy, widthPx: round(cx / EMU_PER_PX), heightPx: round(cy / EMU_PER_PX)}} : {}),
    referencePxPerInch: 96,
    theme: themeFacts,
    provenance: {opfTaggedSlides: tagged, opf: tagged > 0}
  };
  const truncated = {};
  if (slidePaths.length > reported.length) truncated.slides = slidePaths.length - reported.length;
  if (budget.chars <= 0) truncated.text = true;
  const signals = {version: SIGNALS_VERSION, deck, limits: {...limits}, slides, ...(Object.keys(truncated).length ? {truncated} : {})};
  // Canonical JSON: drops undefined keys and guarantees the value is serializable.
  return JSON.parse(JSON.stringify(signals));
}

/** Theme facts for the deck block, from the first slide's resolved theme (name, fonts, twelve colours). */
export function themeFactsFor(slidePath, archive) {
  const theme = readSlideTheme(slidePath, archive);
  const {colors} = theme.colors ? readThemeSlotColors(theme.colors) : {colors: {}};
  const latin = key => theme.fonts?.[key]?.['a:latin']?.typeface || undefined;
  return {
    ...(theme.colors?.name ? {colorSchemeName: theme.colors.name} : {}),
    ...(theme.fonts?.name ? {fontSchemeName: theme.fonts.name} : {}),
    majorFont: latin('a:majorFont'), minorFont: latin('a:minorFont'),
    colors: Object.fromEntries(Object.entries(colors).map(([slot, hex]) => [slot, `#${hex}`]))
  };
}
