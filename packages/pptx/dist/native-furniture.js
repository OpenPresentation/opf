// Native PowerPoint Header & Footer objects (RR-11, docs/native-header-footer.md).
//
// PowerPoint's Insert > Header & Footer owns three slide placeholders: a date
// (`dt`), a footer text (`ftr`) and a slide number (`sldNum`). OPF footer parts
// that map onto one of those become real placeholders on the slide, with matching
// placeholders on the slide master and layouts and `p:hf` flags that say which of
// them the deck uses, so the dialog shows the right state and "Apply to All"
// works. Everything PowerPoint has no object for (header zones, organization,
// section, socials, images, a second text/date/number part, multi-line text)
// stays an ordinary tagged OPF furniture shape.
//
// Geometry never moves: a native slide placeholder carries the explicit `a:xfrm`
// core composed (exactly the box the tagged shape had), so preview, export and the
// parity harness agree. The master and layout placeholders are the defaults for
// footers a user adds natively; they sit where the first slide's native part sits,
// or where core would draw a default footer when no slide has one.

import {XMLParser} from 'fast-xml-parser';
import {DEFAULT_DATE_FORMAT, NATIVE_DATE_FIELDS, formatDate, hasSlideNumberField, slideNumberTemplate} from './furniture-fields.js';

const enc = new TextEncoder(), dec = new TextDecoder('utf-8', {fatal: true});
const parser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: false, trimValues: false});
const array = value => value === undefined ? [] : Array.isArray(value) ? value : [value];
const EMU = 9525;

// idx values are PowerPoint's own: layouts number the three footer placeholders
// 10, 11, 12 and the master 2, 3, 4; a slide placeholder points at its layout by idx.
export const NATIVE_PLACEHOLDERS = Object.freeze({
  dt: {field: 'date', name: 'Date Placeholder', sz: 'half', idx: 10, masterIdx: 2, zone: 'left', align: 'l'},
  ftr: {field: 'text', name: 'Footer Placeholder', sz: 'quarter', idx: 11, masterIdx: 3, zone: 'center', align: 'ctr'},
  sldNum: {field: 'text', name: 'Slide Number Placeholder', sz: 'quarter', idx: 12, masterIdx: 4, zone: 'right', align: 'r'},
});
const ORDER = ['dt', 'ftr', 'sldNum'];
export const isNativePlaceholderType = value => Object.hasOwn(NATIVE_PLACEHOLDERS, value);
/**
 * The placeholder type a core footer part maps to: a date is `dt`; a zone `text` with a slide-number field
 * (`{{slide.number}}`) is `sldNum`, its words around the field fixed runs; any other zone `text` is `ftr`.
 */
export function nativePlaceholderForPart(part) {
  if (part.type !== 'text') return undefined;
  if (part.field === 'date') return 'dt';
  if (part.field !== 'text') return undefined;
  return hasSlideNumberField(part) ? 'sldNum' : 'ftr';
}
const ZONES = ['left', 'center', 'right'];
const ALIGN = {left: 'l', center: 'ctr', right: 'r'};

/**
 * Which accepted core parts of one slide become native placeholders: the first
 * footer text, the first footer date and the first footer text with a slide-number
 * field whose text fits one accepted line. Returns Map<partIndex, 'dt'|'ftr'|'sldNum'>.
 */
export function nativeFurnitureParts(layout) {
  const chosen = new Map(), taken = new Set();
  for (const [index, part] of (layout?.parts ?? []).entries()) {
    const ph = nativePlaceholderForPart(part);
    if (part.kind !== 'footer' || !ph || taken.has(ph)) continue;
    // One native shape holds one line; a part that wraps or breaks stays tagged shapes.
    if (part.fit?.sourceLines?.length !== 1 || part.fit.lines?.length !== 1 || !part.text || part.links?.length) continue;
    taken.add(ph);
    chosen.set(index, ph);
  }
  return chosen;
}

/** Geometry of a default footer part for the master and layouts: its box and alignment in EMU. */
export function defaultPlaceholderGeometry(part) {
  if (!part?.box) return undefined;
  return {x: Math.round(part.box.x * EMU), y: Math.round(part.box.y * EMU), cx: Math.round(part.box.width * EMU),
    cy: Math.round((part.fit?.lineHeight ?? part.box.height) * EMU), algn: ALIGN[part.alignment] ?? 'l', sz: Math.round((part.fit?.fontSize ?? 16) * .75 * 100)};
}

const xmlEscape = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const guid = (kind, n) => `{0F0F2701-${kind}-4000-8000-${n.toString(16).toUpperCase().padStart(12, '0')}}`;

/**
 * Turn the recorded generated shapes of each slide into placeholders. `records`
 * maps a generated object name to its placeholder type. Runs after the tags are
 * attached: the shape keeps its name, geometry, runs, fields and tags, and gains
 * `p:ph` (a placeholder is a text shape the layout can supply defaults for).
 * `bands` maps a generated object name to its zone's band (`{x, width}` in pixels) for a part narrower than its zone.
 * Returns the placeholders in use and the first geometry/alignment seen per type.
 */
export function attachNativePlaceholders(entries, records, bands = new Map()) {
  const used = new Set(), first = new Map(), seen = new Set();
  if (!records.size) return {used, first};
  const slides = Object.keys(entries).filter(path => /^ppt\/slides\/slide\d+\.xml$/.test(path)).sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
  for (const path of slides) {
    let changed = false;
    const xml = dec.decode(entries[path]).replace(/<p:sp>[\s\S]*?<\/p:sp>/g, shape => {
      const name = shape.match(/<p:cNvPr\b[^>]*\bname="([^"]+)"/)?.[1];
      const ph = records.get(name);
      if (!ph) return shape;
      if (seen.has(name)) throw new Error('Duplicate generated native furniture shape.');
      seen.add(name);
      const properties = NATIVE_PLACEHOLDERS[ph];
      if (!/<p:cNvSpPr\b[^>]*\/>/.test(shape)) throw new Error('Generated furniture shape has no plain shape properties.');
      shape = shape.replace(/<p:cNvSpPr\b([^>]*)\/>/, '<p:cNvSpPr$1><a:spLocks noGrp="1"/></p:cNvSpPr>').replace(/<p:nvPr\s*\/>/, '<p:nvPr></p:nvPr>');
      if (!shape.includes('<p:nvPr>')) throw new Error('Generated furniture shape has no native application properties.');
      shape = shape.replace('<p:nvPr>', `<p:nvPr><p:ph type="${ph}" sz="${properties.sz}" idx="${properties.idx}"/>`);
      used.add(ph);
      if (!first.has(ph)) {
        const geometry = shape.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/>/);
        const algn = shape.match(/<a:pPr\b[^>]*\balgn="(\w+)"/)?.[1] ?? 'l';
        // A part in a zone with other parts (a logo beside the footer text) is only as wide as its text (RR-71); the master and
        // layout placeholders a footer added natively lands in use the zone's whole band at the same edge.
        const band = bands.get(name);
        if (geometry) first.set(ph, {x: band ? Math.round(band.x * EMU) : Number(geometry[1]), y: Number(geometry[2]), cx: band ? Math.round(band.width * EMU) : Number(geometry[3]), cy: Number(geometry[4]), algn});
      }
      changed = true;
      return shape;
    });
    if (changed) entries[path] = enc.encode(xml);
  }
  if (seen.size !== records.size) throw new Error('Missing generated native furniture shapes.');
  return {used, first};
}

// The text style a footer placeholder defaults to: the run properties of the deck's
// first native footer shape (else its first furniture shape), read from the finished
// slide (colors already theme references), so a footer added natively matches the
// exported ones. A hyperlink belongs to one slide's relationships and is dropped.
function furnitureRunStyle(slideXmls, names) {
  for (const native of [true, false]) for (const xml of slideXmls) for (const [shape] of xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)) {
    const name = shape.match(/<p:cNvPr\b[^>]*\bname="(OPF furniture \d+ part \d+ line \d+)"/)?.[1];
    if (!name || names.has(name) !== native) continue;
    const run = shape.match(/<a:(?:r|fld)\b[^>]*>(<a:rPr\b[^>]*\/>|<a:rPr\b[^>]*>[\s\S]*?<\/a:rPr>)/)?.[1];
    if (!run) continue;
    const sz = run.match(/\bsz="(\d+)"/)?.[1];
    const inner = (run.match(/^<a:rPr\b[^>]*>([\s\S]*)<\/a:rPr>$/)?.[1] ?? '')
      .replace(/<a:hlink(Click|MouseOver)\b[^>]*\/>|<a:hlink(Click|MouseOver)\b[^>]*>[\s\S]*?<\/a:hlink(?:Click|MouseOver)>/g, '');
    return {sz: sz ? Number(sz) : undefined, inner};
  }
  return undefined;
}

function placeholderGeometry(ph, info) {
  const native = info.first.get(ph);
  if (native) return native;
  const fallback = info.defaults?.get(ph);
  if (fallback) return fallback;
  // No core geometry at all: PowerPoint's own proportions for a footer band.
  const {width, height} = info.slideSize;
  const band = Math.round(height * .0534), zone = Math.round(width * .26), left = Math.round(width * .07);
  const at = {dt: left, ftr: Math.round(width * .37), sldNum: Math.round(width * .67)}[ph];
  return {x: at, y: Math.round(height * .9), cx: zone, cy: band, algn: NATIVE_PLACEHOLDERS[ph].align};
}

function defRunProperties(style, geometry, extra) {
  const sz = style?.sz ?? geometry.sz ?? 1200;
  return `<a:defRPr sz="${sz}"${extra}>${style?.inner ?? ''}</a:defRPr>`;
}

function fieldRun(ph, id, text) {
  if (ph === 'ftr') return '<a:endParaRPr lang="en-US"/>';
  return `<a:fld id="${id}" type="${ph === 'dt' ? 'datetimeFigureOut' : 'slidenum'}"><a:rPr lang="en-US"/><a:t>${xmlEscape(text)}</a:t></a:fld><a:endParaRPr lang="en-US"/>`;
}

function masterShape(ph, order, info, style) {
  const properties = NATIVE_PLACEHOLDERS[ph], geometry = placeholderGeometry(ph, info), id = order + 2;
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${properties.name} ${id - 1}"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>` +
    `<p:nvPr><p:ph type="${ph}" sz="${properties.sz}" idx="${properties.masterIdx}"/></p:nvPr></p:nvSpPr>` +
    `<p:spPr><a:xfrm><a:off x="${geometry.x}" y="${geometry.y}"/><a:ext cx="${geometry.cx}" cy="${geometry.cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>` +
    `<p:txBody><a:bodyPr vert="horz" lIns="0" tIns="0" rIns="0" bIns="0" rtlCol="0" anchor="t"/>` +
    `<a:lstStyle><a:lvl1pPr algn="${geometry.algn}">${defRunProperties(style, geometry, '')}</a:lvl1pPr></a:lstStyle>` +
    `<a:p>${fieldRun(ph, guid('0001', order + 1), ph === 'dt' ? info.dateText : '‹#›')}</a:p></p:txBody></p:sp>`;
}

function layoutShape(ph, order, info) {
  const properties = NATIVE_PLACEHOLDERS[ph], id = order + 2;
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${properties.name} ${id - 1}"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>` +
    `<p:nvPr><p:ph type="${ph}" sz="${properties.sz}" idx="${properties.idx}"/></p:nvPr></p:nvSpPr><p:spPr/>` +
    `<p:txBody><a:bodyPr/><a:lstStyle/><a:p>${fieldRun(ph, guid('0002', order + 1), ph === 'dt' ? info.dateText : '‹#›')}</a:p></p:txBody></p:sp>`;
}

const flag = value => value ? '1' : '0';
const headerFooterFlags = used => `<p:hf sldNum="${flag(used.has('sldNum'))}" hdr="0" ftr="${flag(used.has('ftr'))}" dt="${flag(used.has('dt'))}"/>`;

function insertPlaceholders(xml, shapes, part) {
  if (/<p:ph\b[^>]*\btype="(?:dt|ftr|sldNum)"/.test(xml)) throw new Error(`${part} already has footer placeholders.`);
  const end = xml.indexOf('</p:spTree>');
  if (end < 0) throw new Error(`${part} has no shape tree.`);
  return xml.slice(0, end) + shapes + xml.slice(end);
}

/**
 * The master, layout and notes master half of the native header/footer, written
 * into the finished package. `read`/`write` access parts by path.
 *
 * - Slide master and layouts: `dt`, `ftr` and `sldNum` placeholders and a
 *   `p:hf` whose flags say which the deck uses (`hdr` is 0: slides have no
 *   header placeholder).
 * - Notes master: PowerPoint's own placeholders stay; `p:hf` records that the
 *   notes pages carry a page number only, as the generated notes slides do.
 */
export function writeNativeMasters(paths, read, write, info) {
  const slideXmls = paths.filter(path => /^ppt\/slides\/slide\d+\.xml$/.test(path)).sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0])).map(path => dec.decode(read(path)));
  const style = furnitureRunStyle(slideXmls, info.names);
  const flags = headerFooterFlags(info.used);
  for (const path of paths.filter(path => /^ppt\/slideMasters\/slideMaster\d+\.xml$/.test(path))) {
    let xml = dec.decode(read(path));
    xml = insertPlaceholders(xml, ORDER.map((ph, order) => masterShape(ph, order, info, style)).join(''), path);
    xml = /<p:hf\b[^>]*\/>/.test(xml) ? xml.replace(/<p:hf\b[^>]*\/>/, flags) : xml.replace(/<p:txStyles\b/, `${flags}<p:txStyles`);
    if (!xml.includes(flags)) throw new Error('Slide master header/footer flags could not be written.');
    write(path, enc.encode(xml));
  }
  for (const path of paths.filter(path => /^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(path))) {
    let xml = dec.decode(read(path));
    xml = insertPlaceholders(xml, ORDER.map((ph, order) => layoutShape(ph, order, info)).join(''), path);
    if (!xml.includes('</p:clrMapOvr>')) throw new Error('Slide layout has no color map override.');
    xml = /<p:hf\b[^>]*\/>/.test(xml) ? xml.replace(/<p:hf\b[^>]*\/>/, flags) : xml.replace('</p:clrMapOvr>', `</p:clrMapOvr>${flags}`);
    write(path, enc.encode(xml));
  }
  for (const path of paths.filter(path => /^ppt\/notesMasters\/notesMaster\d+\.xml$/.test(path))) {
    let xml = dec.decode(read(path));
    const notes = '<p:hf hdr="0" ftr="0" dt="0"/>';
    xml = /<p:hf\b[^>]*\/>/.test(xml) ? xml.replace(/<p:hf\b[^>]*\/>/, notes) : xml.replace(/(<p:clrMap\b[^>]*\/>)/, `$1${notes}`);
    if (!xml.includes(notes)) throw new Error('Notes master header/footer flags could not be written.');
    write(path, enc.encode(xml));
  }
}

export const nativeDateText = date => formatDate(date ?? '', DEFAULT_DATE_FORMAT) ?? formatDate('2026-01-01', DEFAULT_DATE_FORMAT);

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

const dateFormatForField = Object.fromEntries(Object.entries(NATIVE_DATE_FIELDS).map(([format, type]) => [type, format]));
const REL_LAYOUT = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout';
const REL_MASTER = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster';

function xfrmBounds(xfrm) {
  const x = Number(xfrm?.['a:off']?.x), y = Number(xfrm?.['a:off']?.y), cx = Number(xfrm?.['a:ext']?.cx), cy = Number(xfrm?.['a:ext']?.cy);
  return [x, y, cx, cy].every(Number.isFinite) && cx > 0 ? {x, y, cx, cy} : undefined;
}

// A placeholder without its own xfrm inherits it: slide -> layout (same idx, else same
// type) -> master (same type). Parsed layout/master trees are cached per package read.
function inheritedBounds(shape, ph, slidePath, relationships, readPart) {
  const own = xfrmBounds(shape['p:spPr']?.['a:xfrm']);
  if (own) return own;
  const index = shape['p:nvSpPr']?.['p:nvPr']?.['p:ph']?.idx;
  const find = (path, byIdx) => {
    const tree = readPart(path)?.[path.includes('slideMaster') ? 'p:sldMaster' : 'p:sldLayout']?.['p:cSld']?.['p:spTree'];
    const candidates = array(tree?.['p:sp']).filter(candidate => candidate['p:nvSpPr']?.['p:nvPr']?.['p:ph']?.type === ph);
    const match = (byIdx && index !== undefined ? candidates.find(candidate => candidate['p:nvSpPr']['p:nvPr']['p:ph'].idx === index) : undefined) ?? candidates[0];
    return match ? xfrmBounds(match['p:spPr']?.['a:xfrm']) : undefined;
  };
  const layout = [...relationships(slidePath).values()].find(relationship => relationship.type === REL_LAYOUT)?.path;
  if (!layout) return undefined;
  const fromLayout = find(layout, true);
  if (fromLayout) return fromLayout;
  const master = [...relationships(layout).values()].find(relationship => relationship.type === REL_MASTER)?.path;
  return master ? find(master, false) : undefined;
}

function zoneOf(bounds, slideWidth, fallback) {
  if (!bounds || !(slideWidth > 0)) return fallback;
  const center = (bounds.x + bounds.cx / 2) / slideWidth;
  return center < 1 / 3 ? 'left' : center > 2 / 3 ? 'right' : 'center';
}

/**
 * The footer one slide's native placeholders describe. `claimed` is the set of
 * shape indexes OPF provenance already consumed or reserved. Returns
 * [{zone, field, value, settings, index, ph}] where `value` is the OPF field value (a zone
 * `text` carries `{{slide.number}}` where the placeholder holds a native slide-number field)
 * and `settings` the zone's `dateFormat`.
 */
export function readNativePlaceholders(context, claimed, relationships, readPart) {
  const fields = [];
  for (const [index, shape] of context.shapes.entries()) {
    const ph = shape['p:nvSpPr']?.['p:nvPr']?.['p:ph']?.type;
    if (!isNativePlaceholderType(ph) || claimed.has(index)) continue;
    const paragraphs = context.paragraphs[index] ?? [];
    const text = paragraphs.map(paragraph => paragraph.text).join('\n');
    // The native fields with their offsets into `text` (the paragraphs are joined by a newline).
    const nativeFields = [];
    let base = 0;
    for (const paragraph of paragraphs) {
      for (const field of paragraph.fields ?? []) nativeFields.push({...field, start: base + (field.start ?? text.indexOf(field.text, base) - base)});
      base += paragraph.text.length + 1;
    }
    const zone = zoneOf(inheritedBounds(shape, ph, context.path, relationships, readPart), context.slideWidth, NATIVE_PLACEHOLDERS[ph].zone);
    const properties = NATIVE_PLACEHOLDERS[ph];
    if (ph === 'sldNum') {
      // The words around a native slide-number field are the zone text and the field is `{{slide.number}}`.
      if (!nativeFields.some(field => field.type === 'slidenum')) continue;
      fields.push({index, zone, ph, field: properties.field, value: slideNumberTemplate(text, nativeFields), settings: {}});
    } else if (ph === 'dt') {
      if (!text.trim()) continue;
      const pattern = nativeFields.length === 1 && nativeFields[0].text === text ? dateFormatForField[nativeFields[0].type] : undefined;
      if (pattern) fields.push({index, zone, ph, field: properties.field, value: true, settings: pattern === DEFAULT_DATE_FORMAT ? {} : {dateFormat: pattern}});
      // A fixed date, or a field with no OPF pattern (a time, the master's datetimeFigureOut), keeps its current words.
      else fields.push({index, zone, ph, field: properties.field, value: text, settings: {}});
    } else {
      if (!text.trim()) continue;
      fields.push({index, zone, ph, field: properties.field, value: slideNumberTemplate(text, nativeFields), settings: {}});
    }
  }
  return fields;
}

/**
 * The OPF footer value for native placeholder fields: zones keyed left/center/right. A footer text and a slide
 * number in one zone are one `text`: the footer words, then the number's line (the zone stack's order).
 */
export function footerValue(fields) {
  const value = {};
  for (const item of [...fields].sort((a, b) => ORDER.indexOf(a.ph) - ORDER.indexOf(b.ph))) {
    value[item.zone] ??= {};
    const zone = value[item.zone];
    zone[item.field] = item.field === 'text' && typeof zone.text === 'string' ? `${zone.text}\n${item.value}` : item.value;
    Object.assign(zone, item.settings);
  }
  return Object.fromEntries(ZONES.filter(zone => value[zone]).map(zone => [zone, value[zone]]));
}
