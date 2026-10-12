// RR-81: OPF 0.19 layout templates as native PowerPoint slide layouts (core docs/programs/release-readiness/0.19-layouts.md,
// section 8).
//
// Export. When a slide of the deck uses a template, every template the deck can reach becomes one `p:sldLayout` under each
// slide master (one per theme and script profile), so Change Layout reaches all of them (design question 7): the templates of
// the registered catalogs in catalog order, then the templates the document embeds (`custom` first, then the other groups by
// name), each by id. Automatic slides also get an OPF auto titleOnly layout. Named by the record's `name`, with one placeholder per area of the empty layout that core's
// `composeLayoutAreas` composes at the deck size (nothing collapsed): `title` (`ctrTitle` with a `subTitle` below it on
// `cover` and `section`), `subTitle` for a `subtitle` area, and per body region a placeholder typed by what it accepts
// (`placeholderType`). The layout keeps RR-11's date, footer and slide-number placeholders and `p:hf` (it starts as a copy of
// the layout the slide used), and carries an OPF_LAYOUT_V1 tag in its common slide data: the layout's id, group, source, the
// reference its first slide wrote, a hash of the record and the placeholder index of every region. Slides relate to it. A
// slide whose areas collapse still uses the full layout: its own geometry is explicit.
//
// A `none` region that holds one picture, chart or table binds that object to its placeholder (`p:ph idx` at the composed
// geometry), so PowerPoint's Reset, Change Picture and Change Layout move it. Blocks of flowing regions, text blocks and
// everything else stay editable shapes at core's geometry (the slide's OPF_SLIDE_V1 content topology names the region of
// each root block); the slide does not instantiate those placeholders, so a filled slide shows no prompt.
//
// Accepted one-line plain titles bind to the native title placeholder; long and rich titles remain tagged line shapes.
// Automatic slides use OPF auto (titleOnly), independently of registered catalogs. Layout prompts carry explicit OPF typography.
//
// Import. Foreign layouts map by type or a case-insensitive built-in name when v2 built-ins are registered. A slide whose layout carries OPF_LAYOUT_V1 takes that layout's reference when it has none (a slide added in
// PowerPoint, or an export without provenance) or when its stored layout names another layout (Change Layout:
// `layout-changed`). A block read from a placeholder of a region gets a `region` pin when plain binding would put it
// elsewhere; content that document provenance restored is never pinned.

import {composeLayoutAreas, composeSlide, layoutTemplate, bindRegions, regionAccepts} from '@openpresentation/opf/composition';
import {validateCatalogRecord, catalogRecords, resolveReference} from '@openpresentation/opf';
import {gallery} from '@openpresentation/gallery';
import {decodeTextTag, encodeTextTag} from './code-provenance.js';

export const LAYOUT_TAG = 'OPF_LAYOUT_V1';
const dec = new TextDecoder('utf-8', {fatal: true}), enc = new TextEncoder();
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const LAYOUT_TYPE = 'application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml';
const TAGS_TYPE = 'application/vnd.openxmlformats-officedocument.presentationml.tags+xml';
const EMU = 9525;
// Region placeholder indexes (coordinator decisions on RR-81): a base per placeholder kind plus the region's position among the
// layout's regions of that kind, in the record's `regions` order: `obj` 100, `body` 300, `pic` 500, `chart` 700, `tbl` 900,
// `media` 1100 (so the first chart region of every layout is 700, its second 701). PowerPoint's Change Layout pairs a slide's
// placeholders with the new layout's by `idx`, so only regions of one kind pair (Pillars to Text keeps `obj` with `obj`; a chart
// bound to Chart beside's `chart` region never lands in Table beside's `tbl` region, as it did with one sequence for every kind).
// The indexes stay clear of PowerPoint's subtitle (1) and date, footer and slide-number placeholders (10, 11, 12, RR-11), and
// Each kind reserves 200 indexes so a 144-region custom grid cannot collide across kinds. They
// depend on the record only, so they are the same under every slide master.
export const REGION_IDX_BASE = Object.freeze({obj: 100, body: 300, pic: 500, chart: 700, tbl: 900, media: 1100});
export const SUBTITLE_IDX = 1;
const NAME = /^[a-z][a-z0-9-]*$/;
const MAX_REGIONS = 144;

/**
 * The PowerPoint layout type of a built-in id (design section 8); every other template is `cust`. `statement` is `cust` too
 * (coordinator decision on RR-81): `titleOnly` would contradict its message placeholder.
 */
export const POWERPOINT_LAYOUT_TYPES = Object.freeze({
  cover: 'title', section: 'secHead', text: 'obj', list: 'obj', agenda: 'obj', faq: 'obj',
  'two-column': 'twoObj', comparison: 'twoObj', 'image-beside': 'picTx',
});
const CENTERED_TITLE = new Set(['cover', 'section']);

/**
 * The placeholder type of a body region: `pic` when it accepts only pictures (or is a `media` region whose leaf kinds are
 * pictures and video), `chart` when only charts, `tbl` when only tables, `media` when only video, `body` when only text and
 * lists, otherwise a content placeholder, `obj` (written without a type, as PowerPoint does).
 */
export function placeholderType(region) {
  const accepts = new Set(region.accepts);
  const only = (...kinds) => [...accepts].every(kind => kinds.includes(kind));
  if (only('image')) return 'pic';
  if (only('chart')) return 'chart';
  if (only('table')) return 'tbl';
  if (only('video')) return 'media';
  if (region.role === 'media' && accepts.has('image') && only('image', 'video', 'group')) return 'pic';
  if (only('text', 'list')) return 'body';
  return 'obj';
}

/** Which slide objects a placeholder of each type takes (binding a `none` region's lone object). */
const BINDS = {title: ['title'], ctrTitle: ['title'], pic: ['picture'], chart: ['chart'], tbl: ['table'], obj: ['picture', 'chart', 'table']};
export const bindsObject = (type, object) => (BINDS[type] ?? []).includes(object);

/** The placeholder index of each region: its kind's base plus its position among the regions of that kind (REGION_IDX_BASE). */
export function regionIndexes(record) {
  const regions = new Map(layoutTemplate(record).regions.map(region => [region.name, region]));
  const counts = {};
  return Object.fromEntries(Object.keys(record?.regions ?? {}).filter(name => regions.has(name)).map(name => {
    const type = placeholderType(regions.get(name));
    counts[type] = (counts[type] ?? -1) + 1;
    return [name, REGION_IDX_BASE[type] + counts[type]];
  }));
}

// FNV-1a (64-bit) of the record's canonical JSON: evidence of which record the layout was made from.
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
export function recordHash(record) {
  let hash = 0xcbf29ce484222325n;
  for (const byte of enc.encode(canonical(record))) hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * 0x100000001b3n);
  return hash.toString(16).padStart(16, '0');
}

/**
 * The template a slide uses, from core's slide context (`resolveSlideContext`): undefined for automatic composition and 0.18
 * records. `provenance` is core's provenance of the resolved layout reference.
 */
export function slideTemplate(core) {
  const record = core?.resolved?.layout, provenance = core?.resolved?.provenance?.layout;
  if (!record || !provenance || !Object.hasOwn(record, 'areas')) return undefined;
  try { layoutTemplate(record); } catch { return undefined; }
  return {record, id: provenance.id, group: provenance.group, ...(provenance.source !== undefined ? {source: provenance.source} : {}), reference: provenance.reference, origin: provenance.origin,
    key: templateKey(provenance)};
}

const templateKey = ({group, id, source}) => `${group}\u0000${id}\u0000${source ?? ''}`;
function isTemplate(record) {
  if (record === null || typeof record !== 'object' || !Object.hasOwn(record, 'areas')) return false;
  try { layoutTemplate(record); return true; } catch { return false; }
}

/**
 * Every template the deck can reach, in the order its layouts are written: the registered catalogs' templates in catalog order
 * (each catalog's ids as it lists them), then the document's embedded templates (`custom` first, then the other groups by name,
 * each by id). `resolve(reference)` is core's resolveReference for the deck's layouts; a record is listed under the first
 * reference that resolves to it, and a record no reference reaches is left out.
 */
export function deckTemplates(document, catalogs, resolve) {
  const result = [], seen = new Set();
  const add = (references, matches) => {
    for (const reference of references) {
      let found;
      try { found = resolve(reference); } catch { found = undefined; }
      if (!found || !matches(found) || !isTemplate(found.record)) continue;
      const template = {record: found.record, id: found.id, group: found.group, ...(found.source !== undefined ? {source: found.source} : {}), reference, origin: found.origin};
      template.key = templateKey(template);
      if (!seen.has(template.key)) { seen.add(template.key); result.push(template); }
      return;
    }
  };
  const groups = document?.catalogs !== null && typeof document?.catalogs === 'object' ? document.catalogs : {};
  for (const catalog of Array.isArray(catalogs) ? catalogs : []) {
    const named = Object.keys(groups).filter(name => name !== 'custom' && groups[name]?.source === catalog?.source);
    for (const [id, record] of Object.entries(catalog?.layouts ?? {})) {
      if (!NAME.test(id) || !isTemplate(record)) continue;
      add([id, `default:${id}`, ...named.map(name => `${name}:${id}`)], found => found.origin === 'host' && found.id === id && found.source === catalog.source);
    }
  }
  const names = Object.keys(groups).filter(name => NAME.test(name)).sort((a, b) => a === 'custom' ? -1 : b === 'custom' ? 1 : a < b ? -1 : a > b ? 1 : 0);
  for (const group of names) for (const id of Object.keys(groups[group]?.layouts ?? {}).filter(id => NAME.test(id)).sort()) {
    add(group === 'custom' ? [id, `custom:${id}`] : [`${group}:${id}`], found => found.origin === 'document' && found.group === group && found.id === id);
  }
  return result;
}

const escapeXml = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const attribute = (xml, name) => new RegExp(`\\s${name}="([^"]*)"`).exec(xml)?.[1];
const relsOf = path => path.replace(/([^/]+)$/, '_rels/$1.rels');
const unescapeAttribute = value => value.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

function resolvePart(source, target) {
  if (target.startsWith('/')) return target.slice(1);
  const parts = source.split('/').slice(0, -1);
  for (const piece of target.split('/')) {
    if (piece === '..') parts.pop();
    else if (piece !== '.' && piece) parts.push(piece);
  }
  return parts.join('/');
}
function relativeTarget(source, path) {
  const from = source.split('/').slice(0, -1), to = path.split('/');
  let common = 0;
  while (common < from.length && common < to.length - 1 && from[common] === to[common]) common++;
  return [...Array(from.length - common).fill('..'), ...to.slice(common)].join('/');
}
const relationships = xml => [...xml.matchAll(/<Relationship\b[^>]*\/>/g)].map(([node]) => ({node, id: attribute(node, 'Id'), type: attribute(node, 'Type') ?? '',
  target: unescapeAttribute(attribute(node, 'Target') ?? ''), external: attribute(node, 'TargetMode') === 'External'}));
function addRelationship(relsXml, type, target) {
  const taken = new Set(relationships(relsXml).map(rel => rel.id));
  let n = 1, rid;
  do rid = `rId${n++}`; while (taken.has(rid));
  return {rid, relsXml: relsXml.replace('</Relationships>', `<Relationship Id="${rid}" Type="${type}" Target="${escapeXml(target)}"/></Relationships>`)};
}

/**
 * The placeholders of one template layout in EMU: [{name, type, idx?, x, y, cx, cy, anchor?}]. Core's composeLayoutAreas
 * composes the empty layout as composeSlide composes a slide with a one-line title and subtitle and every region kept:
 * `template.areaOptions` are composeSlide's options of a slide on the template (canvas, the deck's header and footer, direction)
 * plus its placed-image `placements`, so each box is where that slide's region lands, bled regions reaching the slide edge.
 */
export function layoutPlaceholders(template) {
  const {record, id} = template;
  const parsed = layoutTemplate(record);
  const {areas} = composeLayoutAreas(record, {...template.areaOptions, textMeasurement: undefined});
  const regions = new Map(parsed.regions.map(region => [region.name, region]));
  const indexes = regionIndexes(record);
  const emu = box => ({x: Math.round(box.x * EMU), y: Math.round(box.y * EMU), cx: Math.max(0, Math.round(box.width * EMU)), cy: Math.max(0, Math.round(box.height * EMU))});
  const result = [];
  for (const area of areas) {
    if (area.name === 'title') {
      if (CENTERED_TITLE.has(id) && area.parts) {
        // `cover` and `section`: PowerPoint's centred title over its subtitle, at core's title and subtitle sub-boxes.
        result.push({name: 'Title', type: 'ctrTitle', anchor: 'b', ...emu(area.parts.title)});
        result.push({name: 'Subtitle', type: 'subTitle', idx: SUBTITLE_IDX, anchor: 't', ...emu(area.parts.subtitle)});
      } else result.push({name: 'Title', type: CENTERED_TITLE.has(id) ? 'ctrTitle' : 'title', ...emu(area.box)});
      continue;
    }
    if (area.name === 'subtitle') { result.push({name: 'Subtitle', type: 'subTitle', idx: SUBTITLE_IDX, anchor: 't', ...emu(area.box)}); continue; }
    const region = regions.get(area.name);
    if (region) result.push({name: region.name, type: placeholderType(region), idx: indexes[region.name], ...emu(area.box)});
  }
  const sample = composeSlide({title: 'Title', subtitle: 'Subtitle', blocks: [{text: 'Body'}]}, {...template.areaOptions, layout: record, textMeasurement: undefined});
  for (const placeholder of result) {
    const field = placeholder.type === 'title' || placeholder.type === 'ctrTitle' ? 'title' : placeholder.type === 'subTitle' ? 'subtitle' : 'text';
    const item = sample.items.find(item => item.field === field);
    if (item?.textStyle && item.text?.fontSize) placeholder.style = {...item.textStyle, fontSize: item.text.fontSize, alignment: item.alignment};
  }
  return result;
}

const PROMPTS = {title: 'Click to edit Master title style', ctrTitle: 'Click to edit Master title style', subTitle: 'Click to edit Master subtitle style', body: 'Click to edit Master text styles', obj: 'Click to edit Master text styles'};
function placeholderShape(placeholder, id) {
  const style = placeholder.style;
  const align = {left: 'l', center: 'ctr', right: 'r'}[style?.alignment] ?? 'l';
  // Each copy inherits its own master's chosen heading/body fonts (including script-profile variants).
  const fontRole = placeholder.type === 'title' || placeholder.type === 'ctrTitle' ? 'mj' : 'mn';
  const defaults = style ? `<a:defRPr sz="${Math.round(style.fontSize * 75)}"${Number(style.fontWeight) >= 600 ? ' b="1"' : ''}><a:latin typeface="${fontRole === 'mj' ? '+mj-lt' : '+mn-lt'}"/><a:ea typeface="+${fontRole}-ea"/><a:cs typeface="+${fontRole}-cs"/></a:defRPr>` : '';
  const listStyle = defaults ? `<a:lstStyle>${Array.from({length: 9}, (_, level) => `<a:lvl${level + 1}pPr algn="${align}">${defaults}</a:lvl${level + 1}pPr>`).join('')}</a:lstStyle>` : '<a:lstStyle/>';
  const typeAttribute = placeholder.type === 'obj' ? '' : ` type="${placeholder.type}"`;
  const idx = placeholder.idx !== undefined ? ` idx="${placeholder.idx}"` : '';
  const prompt = PROMPTS[placeholder.type];
  const paragraph = prompt ? `<a:p><a:r><a:rPr lang="en-US"/><a:t>${prompt}</a:t></a:r></a:p>` : '<a:p><a:endParaRPr lang="en-US"/></a:p>';
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${escapeXml(placeholder.name)}"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph${typeAttribute}${idx}/></p:nvPr></p:nvSpPr>` +
    `<p:spPr><a:xfrm><a:off x="${placeholder.x}" y="${placeholder.y}"/><a:ext cx="${placeholder.cx}" cy="${placeholder.cy}"/></a:xfrm></p:spPr>` +
    `<p:txBody><a:bodyPr${placeholder.anchor ? ` anchor="${placeholder.anchor}"` : ''}/>${listStyle}${paragraph}</p:txBody></p:sp>`;
}

/**
 * The OPF_LAYOUT_V1 value of a template layout. With `record` (full provenance) a template the document embeds carries its
 * record, so a template no slide uses comes back on import (document provenance stores only the records slides reference).
 */
export function layoutTagValue(template, {record = false} = {}) {
  return {v: 1, id: template.id, group: template.group, ...(template.source !== undefined ? {source: template.source} : {}), reference: template.reference,
    hash: recordHash(template.record), regions: Object.fromEntries(Object.entries(regionIndexes(template.record)).map(([name, idx]) => [String(idx), name])),
    ...(record && template.origin === 'document' ? {record: template.record} : {})};
}

/**
 * Write the template layouts of the finished package and bind the placeholder objects. `output` maps a package path to
 * [bytes, zipOptions]; runs after the per-script slide masters and before RR-72 lifts furniture. `slides[i]` is slide i's
 * template plan ({template, areaOptions}) or undefined; `templates` (deckTemplates, each with the `areaOptions` its placeholders
 * are composed with) are the layouts to write under every slide master, in order (a slide's own template is added when missing). `bindings`
 * maps an object name on a slide to {slide, region, object} (`picture`, `chart` or `table`). `partText(path, xml)` applies the
 * deck's language to a generated part.
 */
export function writeTemplateLayouts(output, slides, templates, bindings = new Map(), partText = (path, xml) => xml, {records = false, automaticSlides = []} = {}) {
  if (!slides.some(Boolean) && !templates.length && !automaticSlides.some(Boolean)) return;
  const all = [...templates];
  for (const plan of slides) if (plan && !all.some(template => template.key === plan.template.key)) all.push({...plan.template, areaOptions: plan.areaOptions});
  const has = path => Object.hasOwn(output, path);
  const read = path => dec.decode(output[path][0]);
  const options = output['ppt/presentation.xml'][1];
  const write = (path, xml) => { output[path] = [enc.encode(xml), output[path]?.[1] ?? options]; };
  let types = read('[Content_Types].xml');
  const presentation = read('ppt/presentation.xml'), presentationRels = relationships(read('ppt/_rels/presentation.xml.rels'));
  // Slide parts in presentation order.
  const slidePaths = [...presentation.matchAll(/<p:sldId\b[^>]*\br:id="([^"]+)"/g)].map(match => {
    const rel = presentationRels.find(item => item.id === match[1]);
    return rel ? resolvePart('ppt/presentation.xml', rel.target) : undefined;
  });
  const related = (path, type) => {
    if (!has(relsOf(path))) return undefined;
    const rel = relationships(read(relsOf(path))).find(item => !item.external && item.type === `${REL}/${type}`);
    return rel ? resolvePart(path, rel.target) : undefined;
  };
  const used = [...presentation.matchAll(/<p:sldMasterId\b[^>]*\bid="(\d+)"/g), ...Object.keys(output).filter(path => /^ppt\/slideMasters\/slideMaster\d+\.xml$/.test(path))
    .flatMap(path => [...read(path).matchAll(/<p:sldLayoutId\b[^>]*\bid="(\d+)"/g)])].map(match => Number(match[1]));
  let nextLayoutId = Math.max(2147483648, ...used) + 1;
  let nextLayout = Math.max(0, ...Object.keys(output).map(path => Number(/^ppt\/slideLayouts\/slideLayout(\d+)\.xml$/.exec(path)?.[1] ?? 0))) + 1;
  let nextTag = Math.max(0, ...Object.keys(output).map(path => Number(/^ppt\/tags\/opfLayout(\d+)\.xml$/.exec(path)?.[1] ?? 0))) + 1;
  const created = new Map(); // master + template key -> {path, placeholders}
  // Every slide master that holds a slide, in slide order, with the layout its slides use now (the copy each new layout starts from).
  const masters = new Map();
  for (const [index, slidePath] of slidePaths.entries()) {
    if (!slidePath || !has(slidePath)) throw new Error(`Slide ${index + 1} is missing.`);
    const base = related(slidePath, 'slideLayout'), master = base && related(base, 'slideMaster');
    if (!base || !master) throw new Error(`Slide ${index + 1} has no slide layout and master.`);
    if (!masters.has(master)) masters.set(master, base);
  }
  for (const [master, base] of masters) {
    const taken = new Set(Object.keys(output).filter(part => /^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(part) && related(part, 'slideMaster') === master)
      .map(part => unescapeAttribute(read(part).match(/<p:cSld\b[^>]*\bname="([^"]*)"/)?.[1] ?? '')));
    for (const template of all) {
      const key = `${master}\u0001${template.key}`;
      const path = `ppt/slideLayouts/slideLayout${nextLayout++}.xml`, tagPath = `ppt/tags/opfLayout${nextTag++}.xml`;
      let name = typeof template.record.name === 'string' && template.record.name.trim() ? template.record.name : template.id;
      if (taken.has(name)) name = `${name} (${template.group}:${template.id})`;
      taken.add(name);
      const type = POWERPOINT_LAYOUT_TYPES[template.id] ?? 'cust';
      const placeholders = layoutPlaceholders(template);
      let xml = read(base);
      xml = xml.replace(/<p:sldLayout\b[^>]*>/, open => `${open.slice(0, -1).replace(/\s+(?:type|userDrawn|showMasterSp)="[^"]*"/g, '')} type="${type}" userDrawn="1">`);
      xml = xml.replace(/(<p:cSld\b[^>]*?)(\s+name="[^"]*")?(\s*>)/, (match, open, _name, close) => `${open} name="${escapeXml(name)}"${close}`);
      let nextId = Math.max(1, ...[...xml.matchAll(/<p:cNvPr\b[^>]*\bid="(\d+)"/g)].map(match => Number(match[1]))) + 1;
      const shapes = placeholders.map(placeholder => placeholderShape(placeholder, nextId++)).join('');
      const groupEnd = xml.indexOf('</p:grpSpPr>');
      if (groupEnd < 0 || /<p:custDataLst>\s*<p:tags\b[^>]*\/>\s*<\/p:custDataLst>\s*<\/p:cSld>/.test(xml)) throw new Error(`${base} cannot take template placeholders.`);
      xml = xml.slice(0, groupEnd + '</p:grpSpPr>'.length) + shapes + xml.slice(groupEnd + '</p:grpSpPr>'.length);
      // A copied layout keeps only its master relationship; the tag brings its own.
      const masterRel = relationships(has(relsOf(base)) ? read(relsOf(base)) : '').find(rel => rel.type === `${REL}/slideMaster`);
      if (!masterRel) throw new Error(`${base} has no slide master relationship.`);
      const tagged = addRelationship(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${masterRel.node}</Relationships>`,
        `${REL}/tags`, relativeTarget(path, tagPath));
      xml = xml.replace('</p:spTree>', `</p:spTree><p:custDataLst><p:tags r:id="${tagged.rid}"/></p:custDataLst>`);
      write(path, partText(path, xml));
      write(relsOf(path), tagged.relsXml);
      output[tagPath] = [enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:tagLst xmlns:p="${NS}"><p:tag name="${LAYOUT_TAG}" val="${encodeTextTag(layoutTagValue(template, {record: records}))}"/></p:tagLst>`), options];
      types = types.replace('</Types>', `<Override PartName="/${path}" ContentType="${LAYOUT_TYPE}"/><Override PartName="/${tagPath}" ContentType="${TAGS_TYPE}"/></Types>`);
      const masterRels = has(relsOf(master)) ? read(relsOf(master)) : '';
      const added = addRelationship(masterRels, `${REL}/slideLayout`, relativeTarget(master, path));
      write(relsOf(master), added.relsXml);
      const masterXml = read(master);
      if (!masterXml.includes('</p:sldLayoutIdLst>')) throw new Error(`${master} has no layout list.`);
      write(master, masterXml.replace('</p:sldLayoutIdLst>', `<p:sldLayoutId id="${nextLayoutId++}" r:id="${added.rid}"/></p:sldLayoutIdLst>`));
      created.set(key, {path, placeholders: new Map(placeholders.map(item => [item.name, item]))});
    }
  }
  // Automatic composition is its own titleOnly layout, independently of catalog region templates.
  for (const [master, base] of masters) {
    const first = automaticSlides.find((plan, index) => plan && related(related(slidePaths[index], 'slideLayout'), 'slideMaster') === master);
    if (!first) continue;
    const path = `ppt/slideLayouts/slideLayout${nextLayout++}.xml`, tagPath = `ppt/tags/opfLayout${nextTag++}.xml`;
    // Reuse accepted title geometry; an empty slide needs only the engine's default prompt, never a re-fit through the caller's measurement provider.
    const title = first.title ?? composeSlide({title: 'Title'}, {...first.areaOptions, layout: undefined, textMeasurement: undefined}).items.find(item => item.field === 'title');
    const placeholder = {name: 'Title', type: 'title', x: Math.round(title.box.x * EMU), y: Math.round(title.box.y * EMU), cx: Math.round(title.box.width * EMU), cy: Math.round(title.box.height * EMU), style: {...title.textStyle, fontSize: title.text.fontSize, alignment: title.alignment}};
    let xml = read(base).replace(/<p:sldLayout\b[^>]*>/, open => `${open.slice(0, -1).replace(/\s+(?:type|userDrawn|showMasterSp)="[^"]*"/g, '')} type="titleOnly" userDrawn="1">`);
    xml = xml.replace(/(<p:cSld\b[^>]*?)(\s+name="[^"]*")?(\s*>)/, (match, open, _name, close) => `${open} name="OPF auto"${close}`);
    const nextId = Math.max(1, ...[...xml.matchAll(/<p:cNvPr\b[^>]*\bid="(\d+)"/g)].map(match => Number(match[1]))) + 1;
    xml = xml.replace('</p:grpSpPr>', `</p:grpSpPr>${placeholderShape(placeholder, nextId)}`);
    const masterRel = relationships(read(relsOf(base))).find(rel => rel.type === `${REL}/slideMaster`);
    const tagged = addRelationship(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${masterRel.node}</Relationships>`, `${REL}/tags`, relativeTarget(path, tagPath));
    xml = xml.replace('</p:spTree>', `</p:spTree><p:custDataLst><p:tags r:id="${tagged.rid}"/></p:custDataLst>`);
    write(path, partText(path, xml)); write(relsOf(path), tagged.relsXml);
    output[tagPath] = [enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:tagLst xmlns:p="${NS}"><p:tag name="${LAYOUT_TAG}" val="${encodeTextTag({v: 1, id: 'auto', group: 'custom', reference: 'auto', hash: recordHash({auto: true}), regions: {}})}"/></p:tagLst>`), options];
    types = types.replace('</Types>', `<Override PartName="/${path}" ContentType="${LAYOUT_TYPE}"/><Override PartName="/${tagPath}" ContentType="${TAGS_TYPE}"/></Types>`);
    const added = addRelationship(read(relsOf(master)), `${REL}/slideLayout`, relativeTarget(master, path));
    write(relsOf(master), added.relsXml);
    write(master, read(master).replace('</p:sldLayoutIdLst>', `<p:sldLayoutId id="${nextLayoutId++}" r:id="${added.rid}"/></p:sldLayoutIdLst>`));
    created.set(`${master}\u0001auto`, {path, placeholders: new Map([['Title', placeholder]])});
  }
  for (const [index, plan] of slidePaths.map((_, index) => slides[index]).entries()) {
    if (!plan && !automaticSlides[index]) continue;
    const slidePath = slidePaths[index];
    const master = related(related(slidePath, 'slideLayout'), 'slideMaster');
    const layout = created.get(`${master}\u0001${plan ? plan.template.key : 'auto'}`);
    if (!layout) throw new Error(`Slide ${index + 1} has no template layout.`);
    const slideRels = relsOf(slidePath);
    write(slideRels, read(slideRels).replace(/<Relationship\b[^>]*\/>/g, node => attribute(node, 'Type') === `${REL}/slideLayout` ? node.replace(/\sTarget="[^"]*"/, ` Target="${relativeTarget(slidePath, layout.path)}"`) : node));
    // The lone picture, chart or table of a `none` region becomes its placeholder's content.
    let slideXml = read(slidePath), changed = false;
    for (const [objectName, binding] of bindings) {
      if (binding.slide !== index) continue;
      const placeholder = layout.placeholders.get(binding.region);
      if (!placeholder || !bindsObject(placeholder.type, binding.object)) continue;
      const ph = `<p:ph${placeholder.type === 'obj' ? '' : ` type="${placeholder.type}"`}${placeholder.idx !== undefined ? ` idx="${placeholder.idx}"` : ''}/>`;
      const element = binding.object === 'picture' ? 'pic' : binding.object === 'title' ? 'sp' : 'graphicFrame';
      const pattern = new RegExp(`<p:${element}>[\\s\\S]*?<\\/p:${element}>`, 'g');
      slideXml = slideXml.replace(pattern, shape => {
        if (unescapeAttribute(shape.match(/<p:cNvPr\b[^>]*\bname="([^"]*)"/)?.[1] ?? '') !== objectName || /<p:ph\b/.test(shape)) return shape;
        changed = true;
        let next = shape.replace(/<p:nvPr\s*\/>/, '<p:nvPr></p:nvPr>').replace(/<p:nvPr>/, `<p:nvPr>${ph}`);
        if (element === 'pic') {
          next = /<a:picLocks\b[^>]*\/>/.test(next) ? next.replace(/<a:picLocks\b([^>]*?)\s*\/>/, (match, rest) => /noGrp=/.test(rest) ? match : `<a:picLocks noGrp="1"${rest}/>`)
            : next.replace(/<p:cNvPicPr\s*\/>/, '<p:cNvPicPr><a:picLocks noGrp="1"/></p:cNvPicPr>').replace(/<p:cNvPicPr>(?!<a:picLocks)/, '<p:cNvPicPr><a:picLocks noGrp="1"/>');
        } else if (element === 'sp') {
          next = next.replace(/<p:cNvSpPr\b([^>]*)\/>/, '<p:cNvSpPr$1><a:spLocks noGrp="1"/></p:cNvSpPr>');
        } else if (element === 'graphicFrame') {
          next = /<a:graphicFrameLocks\b[^>]*\/>/.test(next) ? next.replace(/<a:graphicFrameLocks\b([^>]*?)\s*\/>/, (match, rest) => /noGrp=/.test(rest) ? match : `<a:graphicFrameLocks noGrp="1"${rest}/>`)
            : next.replace(/<p:cNvGraphicFramePr\s*\/>/, '<p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr>');
        }
        return next;
      });
    }
    if (changed) write(slidePath, slideXml);
  }
  write('[Content_Types].xml', types);
}

// ---------------------------------------------------------------------------
// Import

function tagIdentityError(tag) {
  if (!NAME.test(tag?.id ?? '') || !NAME.test(tag?.group ?? '')) return 'invalid id or group';
  const reference = /^(?:([a-z][a-z0-9-]*):)?([a-z][a-z0-9-]*)$/.exec(tag.reference ?? '');
  if (!reference || reference[2] !== tag.id || (reference[1] !== undefined && reference[1] !== tag.group)) return 'reference does not match id and group';
  if (reference[1] === undefined && !['custom', 'default'].includes(tag.group)) return 'bare reference cannot name an external catalog';
  if (tag.source !== undefined && (typeof tag.source !== 'string' || !/^(?:https:\/\/[^\s]+|pkg:[^\s]+)$/.test(tag.source))) return 'invalid catalog source';
  if (tag.group === 'custom' && tag.source !== undefined) return 'custom catalog cannot have a source';
  if (tag.group !== 'custom' && tag.source === undefined) return 'catalog source is missing';
  return undefined;
}

/** The validated OPF_LAYOUT_V1 value of a slide layout part, or undefined. `report(message)` names a damaged tag. */
export function readLayoutTag(entries, layoutPath, report = () => {}) {
  if (!layoutPath || !entries[layoutPath]) return undefined;
  const xml = dec.decode(entries[layoutPath]);
  const rid = xml.match(/<\/p:spTree>\s*<p:custDataLst>([\s\S]*?)<\/p:custDataLst>/)?.[1]?.match(/<p:tags\b[^>]*\br:id="([^"]+)"/)?.[1];
  if (!rid || !entries[relsOf(layoutPath)]) return undefined;
  const rel = relationships(dec.decode(entries[relsOf(layoutPath)])).find(item => item.id === rid && item.type === `${REL}/tags` && !item.external);
  const tagPath = rel && resolvePart(layoutPath, rel.target);
  if (!tagPath || !entries[tagPath]) return undefined;
  const tag = [...dec.decode(entries[tagPath]).matchAll(/<p:tag\b[^>]*\/>/g)].map(([node]) => node).find(node => attribute(node, 'name') === LAYOUT_TAG);
  if (!tag) return undefined;
  try {
    const value = decodeTextTag(unescapeAttribute(attribute(tag, 'val') ?? ''));
    if (value === null || typeof value !== 'object' || Array.isArray(value) || value.v !== 1) throw Error('unknown version');
    const identityError = tagIdentityError(value);
    if (identityError) throw Error(identityError);
    if (typeof value.reference !== 'string' || !/^(?:[a-z][a-z0-9-]*:)?[a-z][a-z0-9-]*$/.test(value.reference) || typeof value.hash !== 'string') throw Error('invalid reference');
    if (value.record !== undefined && (value.record === null || typeof value.record !== 'object' || Array.isArray(value.record))) throw Error('invalid record');
    const regions = value.regions;
    if (regions === null || typeof regions !== 'object' || Array.isArray(regions) || Object.keys(regions).length > MAX_REGIONS
      || Object.entries(regions).some(([idx, name]) => !/^\d{1,4}$/.test(idx) || typeof name !== 'string' || !NAME.test(name) || name.length > 64)) throw Error('invalid regions');
    return value;
  } catch (error) {
    report(`The OPF layout tag of ${layoutPath} is damaged (${error.message}); the slide layout is read as a foreign layout.`);
    return undefined;
  }
}

/** The region of a native slide object from its placeholder index, through the layout tag. */
export function placeholderRegion(node, tag) {
  if (!tag) return undefined;
  const nv = node?.['p:nvSpPr'] ?? node?.['p:nvPicPr'] ?? node?.['p:nvGraphicFramePr'];
  const idx = nv?.['p:nvPr']?.['p:ph']?.idx;
  return idx === undefined ? undefined : tag.regions[String(idx)];
}

const bareId = reference => /^(?:([a-z][a-z0-9-]*):)?([a-z][a-z0-9-]*)$/.exec(reference ?? '');

/**
 * After document provenance: each slide's layout from its tagged slide layout, and the region pins of blocks read from region
 * placeholders. `slides[i]` = {tag, blockRegions, restored}; `recordOf(index)` resolves the slide's layout record.
 */
export function applyTemplateLayouts(imported, slides, recordOf, report = () => {}, layoutTags = []) {
  const usable = tag => {
    const error = tagIdentityError(tag);
    const existing = imported.catalogs?.[tag?.group];
    const conflict = existing === false || (existing?.source !== undefined && existing.source !== tag.source);
    if (!error && !conflict) return true;
    report({code: 'invalid-layout-provenance', path: `catalogs.${tag?.group}`, message: `The PowerPoint layout tag was not restored (${error ?? 'catalog source conflicts with document provenance'}).`});
    return false;
  };
  // Restore unused embedded templates only with consistent, schema-valid catalog provenance.
  for (const tag of layoutTags) {
    if (!tag?.record || !usable(tag) || recordHash(tag.record) !== tag.hash) continue;
    if (imported.catalogs?.[tag.group]?.layouts?.[tag.id] !== undefined) continue;
    if (!isTemplate(tag.record)) continue;
    let valid = false;
    try { valid = validateCatalogRecord('layouts', {$schema: 'https://openpresentation.org/schema/opf-layout/v2', id: tag.id, ...tag.record}).valid; } catch { valid = false; }
    if (!valid) { report({code: 'invalid-layout-provenance', path: `catalogs.${tag.group}.layouts.${tag.id}`, message: `The layout record stored with the PowerPoint layout of ${tag.reference} does not validate; it was not restored.`}); continue; }
    imported.catalogs = {...imported.catalogs, [tag.group]: {...(tag.source ? {source: tag.source} : {}), ...imported.catalogs?.[tag.group], layouts: {...imported.catalogs?.[tag.group]?.layouts, [tag.id]: structuredClone(tag.record)}}};
  }
  for (const [index, entry] of slides.entries()) {
    const slide = imported.slides[index], tag = entry?.tag;
    if (!slide || !tag || !usable(tag)) continue;
    const qualified = bareId(tag.reference)?.[1];
    if (qualified && tag.source && (!imported.catalogs?.[qualified] || typeof imported.catalogs[qualified] !== 'object'))
      imported.catalogs = {...imported.catalogs, [qualified]: {source: tag.source}};
    if (tag.id === 'auto' && entry.preservedAutomatic && (entry.storedLayout === undefined || entry.storedLayout === 'auto')) { if (entry.storedLayout === 'auto') slide.layout = 'auto'; continue; }
    if (slide.layout === undefined) slide.layout = tag.reference;
    else if (slide.layout !== tag.reference) {
      const match = bareId(slide.layout);
      const same = match && match[2] === tag.id && (match[1] === undefined || match[1] === tag.group);
      if (!same) {
        report({code: 'layout-changed', path: `slides.${index}.layout`, message: `The slide uses the PowerPoint layout of ${tag.reference} (Change Layout), not its stored layout ${slide.layout}; slides.${index}.layout is now ${tag.reference} and its content is bound by that layout.`});
        slide.layout = tag.reference;
      }
    }
    if (entry.restored || !Array.isArray(slide.blocks) || !entry.blockRegions?.some(Boolean)) continue;
    let record;
    try { record = recordOf(index); layoutTemplate(record); } catch { continue; }
    const regions = new Map(layoutTemplate(record).regions.map(region => [region.name, region]));
    for (const [position, name] of entry.blockRegions.entries()) {
      const block = slide.blocks[position], region = regions.get(name);
      if (!name || !region || !block || typeof block !== 'object' || block.region !== undefined || !regionAccepts(region, block)) continue;
      const bound = bindRegions(slide, record, {slideIndex: index}).regions.find(item => [...item.blocks, ...item.overflow].some(node => node.block === position));
      if (bound?.name !== name) block.region = name;
    }
  }
}

/** Map foreign PowerPoint layouts to available v2 built-ins; no layout reconstruction or migration aliases. */
export function foreignLayoutReference(layout, catalogs = [gallery]) {
  const types = {title: 'cover', secHead: 'section', obj: 'text', tx: 'text', twoObj: 'two-column', twoTxTwoObj: 'two-column', picTx: 'image-beside'};
  const type = layout?.type;
  if (type === 'blank' || type === 'titleOnly') return 'auto';
  const options = catalogs === undefined ? {} : {catalogs};
  // Use core's default catalog resolution: a same-id record in another host catalog must never supply a misleading name match.
  const builtins = catalogRecords({}, 'layouts', options).filter(entry => entry.group === 'default' && isTemplate(entry.record))
    .filter(entry => Object.hasOwn(POWERPOINT_LAYOUT_TYPES, entry.id) || ['image', 'gallery', 'chart', 'chart-beside', 'table', 'table-beside', 'code', 'pillars', 'process', 'timeline', 'quote', 'metrics', 'scorecard', 'hero', 'dashboard', 'team', 'logos', 'statement', 'closing'].includes(entry.id))
    .filter(entry => resolveReference({}, 'layouts', `default:${entry.id}`, options)?.source === entry.source);
  const id = types[type];
  if (id) return builtins.some(entry => entry.id === id) ? `default:${id}` : undefined;
  if (type === 'cust') {
    const name = String(layout?.['p:cSld']?.name ?? '').trim().toLowerCase();
    const matched = builtins.find(entry => entry.id.toLowerCase() === name || String(entry.record.name ?? '').trim().toLowerCase() === name);
    return matched ? `default:${matched.id}` : 'auto';
  }
  return 'auto';
}
