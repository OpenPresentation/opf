// NT-04b: what a .pptx holds, per slide, in the shared object vocabulary (core/result/README.md, 15 kinds). Reads OPF's
// export and an application's own PowerPoint copy alike, so outcomes.mjs can compare the two. Pure Node: fflate and
// @rgrove/parse-xml, the zip and XML libraries the pptx package already depends on, through createRequire.
//
// A port of the 0.36.0 Keynote round's pptx_inspect.py (items, boxes, text, pictures, tables, charts, links, notes) and of
// rt_text.py's bullet inheritance (Keynote's copy writes no bullet on the paragraph: it relies on the layout's and master's
// list styles, so whether a paragraph is a list item takes the whole chain).
//
// Kinds come from DrawingML first and from OPF's own shape names second. The names are written by packages/pptx/src:
//   "OPF heading <path> line N"  index.js (titles; <path> "slides.N.title" for the slide title)
//   "OPF native body <path>"     native-body.js
//   "OPF list <path> line N", "OPF list rule <path> N"  index.js
//   "OPF text <path> line N"     index.js
//   "OPF furniture N part K line L"  index.js (footer, slide number, date)
//   "OPF diagram N"              diagram-provenance.js (diagramName)
// A rename there changes the kinds here: search for these prefixes when one moves.
//
// Diagrams (NT-01b): a live SmartArt graphic frame (DrawingML's dgm:relIds) is kind "diagram", with the layout and the node
// count its parts state in `diagram`. OPF's own diagrams ("OPF diagram N": Mermaid, DOT, PlantUML and the arrangements
// drawn as shapes) are groups of ordinary shapes in every application, so they stay kind "group" (label "diagram"): their
// question is whether the shapes stay shapes, which the group's members answer. "Did it stay a live diagram" is asked of
// the SmartArt frame alone, and its outcome answers it (native: still a frame; picture; changed: drawn as a group).
// Media (NT-01b): a picture carrying a video or audio file (a:videoFile, a:audioFile, a:wavAudioFile, a:quickTimeFile, or
// PowerPoint 2010's p14:media) is kind "media". Alt text: every object's DrawingML description (p:cNvPr@descr) is `alt`.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { cutText } from '../result/result.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const requirePptx = createRequire(path.join(root, 'packages/pptx/package.json'));
const { unzipSync, strFromU8 } = requirePptx('fflate');
const { parseXml } = await import(pathToFileURL(requirePptx.resolve('@rgrove/parse-xml')).href);

export const EMU_PER_POINT = 12700;
const TABLE_URI = 'http://schemas.openxmlformats.org/drawingml/2006/table';
const CHART_URI = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
const CHARTEX_URI = 'http://schemas.microsoft.com/office/drawing/2014/chartex';
const DIAGRAM_URI = 'http://schemas.openxmlformats.org/drawingml/2006/diagram';
const MEDIA_FILES = { videoFile: 'video', quickTimeFile: 'video', audioFile: 'audio', wavAudioFile: 'audio', audioCd: 'audio' };
const BULLETS = ['buNone', 'buChar', 'buAutoNum', 'buBlip'];
const SHAPE_ELEMENTS = new Set(['sp', 'pic', 'graphicFrame', 'cxnSp', 'grpSp', 'contentPart']);
const FOOTER_ROLES = { ftr: 'footer', sldNum: 'slide-number', dt: 'date' };

// The 0.36.0 round's finer vocabulary (rt_objects.py KINDS). Each object carries it as `label`; `kind` is the shared one.
export const LABELS = Object.freeze([
  'slide title', 'body text', 'other text', 'list items', 'table', 'chart (native)', 'chart (extended)', 'shape', 'line/connector', 'group', 'diagram',
  'picture', 'link on text', 'link on a shape', 'link on a cell', 'link to a slide', 'presenter notes', 'footer / slide number / date', 'hidden slide',
  'empty text box', 'media',
]);

// ---- XML helpers: names are compared without their prefix, so a file that binds other prefixes reads the same.
const local = (name) => name.slice(name.indexOf(':') + 1);
const elements = (node) => (node?.children ?? []).filter((child) => child.type === 'element');
const kids = (node, name) => elements(node).filter((child) => local(child.name) === name);
const kid = (node, name) => elements(node).find((child) => local(child.name) === name);
const at = (node, ...names) => names.reduce((current, name) => kid(current, name), node);
function descendants(node, name, out = []) {
  for (const child of elements(node)) {
    if (local(child.name) === name) out.push(child);
    descendants(child, name, out);
  }
  return out;
}
/** A relationship attribute (r:id, r:embed) by local name: it carries a prefix the file chooses; an unprefixed "id" is another attribute. */
function relAttr(node, name = 'id') {
  if (!node) return undefined;
  for (const [key, value] of Object.entries(node.attributes ?? {})) if (key.includes(':') && local(key) === name) return value;
  return undefined;
}
const textOf = (node) => descendants(node, 't').map((t) => t.text).join('');
const normalize = (text) => String(text ?? '').replace(/\s+/gu, ' ').trim();

// ---- the package
function normalizePath(base, target) {
  const parts = [];
  for (const part of `${base}/${target}`.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return parts.join('/');
}

class Package {
  constructor(bytes) {
    this.files = unzipSync(bytes);
    this.cache = new Map();
  }
  has(name) {
    return name in this.files;
  }
  xml(name) {
    if (!this.cache.has(name)) this.cache.set(name, this.has(name) ? parseXml(strFromU8(this.files[name])).root : null);
    return this.cache.get(name);
  }
  rels(part) {
    const directory = part.includes('/') ? part.slice(0, part.lastIndexOf('/')) : '';
    const base = part.slice(part.lastIndexOf('/') + 1);
    const doc = this.xml(`${directory ? `${directory}/` : ''}_rels/${base}.rels`);
    const out = {};
    for (const rel of kids(doc, 'Relationship')) {
      const external = rel.attributes.TargetMode === 'External';
      const target = external ? rel.attributes.Target : normalizePath(directory, rel.attributes.Target);
      out[rel.attributes.Id] = { type: String(rel.attributes.Type ?? '').split('/').at(-1), target, external };
    }
    return out;
  }
  relOf(part, type) {
    return Object.values(this.rels(part)).find((rel) => rel.type === type)?.target ?? null;
  }
}

// ---- geometry: boxes in points, slide coordinates (group transforms applied)
function readXfrm(xfrm) {
  const off = kid(xfrm, 'off')?.attributes;
  const ext = kid(xfrm, 'ext')?.attributes;
  if (!off || !ext) return null;
  const chOff = kid(xfrm, 'chOff')?.attributes;
  const chExt = kid(xfrm, 'chExt')?.attributes;
  return {
    x: Number(off.x ?? 0),
    y: Number(off.y ?? 0),
    w: Number(ext.cx ?? 0),
    h: Number(ext.cy ?? 0),
    child: chOff && chExt ? { x: Number(chOff.x ?? 0), y: Number(chOff.y ?? 0), w: Number(chExt.cx ?? 0), h: Number(chExt.cy ?? 0) } : null,
  };
}

/** A child box through its groups' transforms, outermost last. */
function toSlide(box, groups) {
  let { x, y, w, h } = box;
  for (const group of groups) {
    const child = group.child ?? { x: group.x, y: group.y, w: group.w, h: group.h };
    const sx = child.w ? group.w / child.w : 1;
    const sy = child.h ? group.h / child.h : 1;
    x = group.x + (x - child.x) * sx;
    y = group.y + (y - child.y) * sy;
    w *= sx;
    h *= sy;
  }
  return [x, y, w, h].map((value) => Math.round((value / EMU_PER_POINT) * 100) / 100);
}

// ---- placeholders and the list-style chain (rt_text.py)
function placeholderOf(shape) {
  const nv = elements(shape).find((child) => local(child.name).startsWith('nv'));
  const ph = at(nv, 'nvPr', 'ph');
  return ph ? { type: ph.attributes.type ?? null, idx: ph.attributes.idx ?? null } : null;
}

const SAME_TYPE = { ctrTitle: 'title', subTitle: 'body', obj: 'body' };
/** The placeholder of a layout or master matching { type, idx }: by idx, then type, then the type's family. */
function findPlaceholder(tree, ph, byTypeOnly = false) {
  if (!tree || !ph) return null;
  const candidates = descendants(tree, 'sp')
    .map((shape) => ({ ph: placeholderOf(shape), shape }))
    .filter((entry) => entry.ph);
  const type = ph.type ?? 'obj';
  const typeOf = (entry) => entry.ph.type ?? 'obj';
  if (!byTypeOnly && ph.idx != null) {
    const byIndex = candidates.find((entry) => entry.ph.idx === ph.idx);
    if (byIndex) return byIndex.shape;
  }
  const byType = candidates.find((entry) => typeOf(entry) === type) ?? candidates.find((entry) => (SAME_TYPE[typeOf(entry)] ?? typeOf(entry)) === (SAME_TYPE[type] ?? type));
  return byType?.shape ?? null;
}

class Styles {
  constructor(pkg) {
    this.pkg = pkg;
    this.defaultStyle = at(pkg.xml('ppt/presentation.xml'), 'defaultTextStyle');
  }
  /** List-style containers holding lvlNpPr, nearest first, for a shape on a slide. */
  chain(shape, slidePart) {
    const out = [at(shape, 'txBody', 'lstStyle')];
    const layout = this.pkg.relOf(slidePart, 'slideLayout');
    const master = layout ? this.pkg.relOf(layout, 'slideMaster') : null;
    const masterXml = master ? this.pkg.xml(master) : null;
    const ph = placeholderOf(shape);
    if (ph) {
      const layoutShape = findPlaceholder(layout ? this.pkg.xml(layout) : null, ph);
      if (layoutShape) out.push(at(layoutShape, 'txBody', 'lstStyle'));
      const ph2 = (layoutShape && placeholderOf(layoutShape)) || ph;
      const masterShape = findPlaceholder(masterXml, ph2, true);
      if (masterShape) out.push(at(masterShape, 'txBody', 'lstStyle'));
      const type = ph2.type ?? 'obj';
      const style = ['title', 'ctrTitle'].includes(type) ? 'titleStyle' : ['body', 'obj', 'subTitle', 'tbl', 'chart', 'dgm', 'media', 'clipArt', 'pic'].includes(type) ? 'bodyStyle' : 'otherStyle';
      out.push(at(masterXml, 'txStyles', style));
    } else {
      out.push(this.defaultStyle);
      out.push(at(masterXml, 'txStyles', 'otherStyle'));
    }
    return out;
  }
  /** The box of a placeholder that has no a:xfrm of its own: its layout's, else its master's. */
  inheritedXfrm(shape, slidePart) {
    const ph = placeholderOf(shape);
    if (!ph) return null;
    const layout = this.pkg.relOf(slidePart, 'slideLayout');
    const master = layout ? this.pkg.relOf(layout, 'slideMaster') : null;
    const layoutShape = findPlaceholder(layout ? this.pkg.xml(layout) : null, ph);
    const fromLayout = layoutShape && at(layoutShape, 'spPr', 'xfrm');
    if (fromLayout) return fromLayout;
    const masterShape = findPlaceholder(master ? this.pkg.xml(master) : null, (layoutShape && placeholderOf(layoutShape)) || ph, true);
    return (masterShape && at(masterShape, 'spPr', 'xfrm')) ?? null;
  }
}

// ---- text
function paragraphsOf(txBody, chain) {
  return kids(txBody, 'p').map((paragraph) => {
    const pPr = kid(paragraph, 'pPr');
    const lvl = Number(pPr?.attributes.lvl ?? 0);
    let text = '';
    const fields = [];
    const links = [];
    for (const child of elements(paragraph)) {
      const name = local(child.name);
      if (name === 'r' || name === 'fld') {
        const runText = kid(child, 't')?.text ?? '';
        text += runText;
        if (name === 'fld') fields.push(child.attributes.type ?? '');
        const link = at(child, 'rPr', 'hlinkClick');
        if (link) links.push({ node: link, text: runText });
      } else if (name === 'br') text += '\n';
    }
    let bullet = null;
    for (const level of [pPr, ...chain.map((container) => kid(container, `lvl${lvl + 1}pPr`))]) {
      const found = level && BULLETS.map((kind) => kid(level, kind)).find(Boolean);
      if (found) {
        bullet = { kind: local(found.name), char: found.attributes.char ?? null, type: found.attributes.type ?? null };
        break;
      }
    }
    return { text, lvl, bullet, fields, links };
  });
}

const isListBullet = (paragraph) => paragraph.bullet?.kind === 'buChar' || paragraph.bullet?.kind === 'buAutoNum';

// ---- fills and lines (only whether there is one: the round's "shape or empty text box" test)
function fillOf(spPr) {
  for (const child of elements(spPr)) {
    const name = local(child.name);
    if (name === 'noFill') return 'none';
    if (['solidFill', 'gradFill', 'blipFill', 'pattFill', 'grpFill'].includes(name)) return name;
  }
  return null;
}
// As the round's line_summary: a width, any fill (a:noFill included), a dash or an arrow end makes an outline worth naming.
function hasLine(spPr) {
  const ln = kid(spPr, 'ln');
  if (!ln) return false;
  if (ln.attributes.w !== undefined || fillOf(ln) !== null || kid(ln, 'prstDash')) return true;
  return ['headEnd', 'tailEnd'].some((end) => {
    const type = kid(ln, end)?.attributes.type;
    return type !== undefined && type !== 'none';
  });
}

// ---- charts
function chartInfo(pkg, part) {
  const doc = pkg.xml(part);
  if (!doc) return { missing: true };
  const plotArea = descendants(doc, 'plotArea')[0];
  const types = [];
  const series = [];
  for (const child of elements(plotArea)) {
    const name = local(child.name);
    if (!name.endsWith('Chart')) continue;
    types.push({ type: name, grouping: kid(child, 'grouping')?.attributes.val ?? null, barDir: kid(child, 'barDir')?.attributes.val ?? null });
    for (const ser of kids(child, 'ser')) {
      const name = descendants(kid(ser, 'tx'), 'v')[0]?.text ?? '';
      const points = descendants(kid(ser, 'val'), 'pt').length || descendants(kid(ser, 'yVal'), 'pt').length;
      series.push({ name, points });
    }
  }
  const legend = descendants(doc, 'legend')[0];
  return { types, series, legend: legend ? (kid(legend, 'legendPos')?.attributes.val ?? 'present') : null };
}

// ---- diagrams and media
/**
 * A SmartArt frame's layout and node count as its parts state them: { layoutId?, layout?, nodes? }, the names PowerPoint's
 * object model uses (SmartArt.Layout.Id and .Name, the node count): layoutId the layout definition's uniqueId, layout its title.
 */
function diagramInfo(pkg, data, rels) {
  const relIds = kid(data, 'relIds');
  const target = (name) => {
    const id = relAttr(relIds, name);
    return id && rels[id] && !rels[id].external ? rels[id].target : null;
  };
  const info = {};
  const layoutPart = target('lo');
  const layoutDef = layoutPart ? pkg.xml(layoutPart) : null;
  if (layoutDef?.attributes.uniqueId) info.layoutId = layoutDef.attributes.uniqueId;
  const title = kid(layoutDef, 'title')?.attributes.val;
  if (title) info.layout = title;
  const dataPart = target('dm');
  const model = dataPart ? pkg.xml(dataPart) : null;
  if (model) {
    const points = kids(kid(model, 'ptLst'), 'pt');
    // A content node is a point of type "node" (the default) or "asst"; doc, transitions and presentation points are not.
    info.nodes = points.filter((point) => ['node', 'asst'].includes(point.attributes.type ?? 'node')).length;
    // A data model without a layout part still names its layout on the document point.
    const documentLayout = at(points.find((point) => point.attributes.type === 'doc'), 'prSet')?.attributes.loTypeId;
    if (!info.layoutId && documentLayout) info.layoutId = documentLayout;
  }
  return info;
}

/** "video" or "audio" when a picture's p:nvPr carries a media file; null otherwise. */
function mediaOf(nvPr) {
  for (const child of elements(nvPr)) {
    const name = local(child.name);
    if (MEDIA_FILES[name]) return MEDIA_FILES[name];
    if (name === 'extLst' && descendants(child, 'media').length > 0) return 'video';
  }
  return null;
}

// ---- links
function linkOf(node, rels, slideIndexOfPart) {
  const id = relAttr(node);
  const rel = id ? rels[id] : undefined;
  const action = node.attributes.action ?? null;
  const link = { action, external: rel?.external ?? false, relType: rel?.type ?? null };
  if (action?.includes('hlinksldjump') || rel?.type === 'slide') {
    const index = rel ? slideIndexOfPart.get(rel.target) : undefined;
    link.target = index ? `slide:${index}` : (rel?.target ?? action);
    link.jump = true;
  } else if (rel?.external) link.target = rel.target;
  else link.target = action ?? rel?.target ?? null;
  return link;
}

// ---- the round's label and the shared kind (rt_objects.py kind_of, then the mapping to the 15 kinds)
function labelOf(item) {
  const name = item.name ?? '';
  const ph = item.placeholder?.type ?? null;
  if (item.media) return 'media';
  if (item.element === 'pic') return 'picture';
  if (item.frame === 'table') return 'table';
  if (item.frame === 'chart') return 'chart (native)';
  if (item.frame === 'chartex') return 'chart (extended)';
  if (item.element === 'graphicFrame') return 'diagram';
  if (item.element === 'grpSp') return /^OPF diagram \d+$/u.test(name) ? 'diagram' : 'group';
  if (item.element === 'cxnSp' || item.preset === 'line') return 'line/connector';
  if (item.element !== 'sp') return 'shape';
  if (name.startsWith('OPF furniture') || ['sldNum', 'ftr', 'dt'].includes(ph)) return 'footer / slide number / date';
  if (!item.hasText) return !item.emptyText || !['none', null].includes(item.fill) || item.line ? 'shape' : 'empty text box';
  if (/^OPF heading slides\.\d+\.title line/u.test(name)) return 'slide title';
  const bullets = item.paragraphs.some(isListBullet);
  if (name.startsWith('OPF native body')) return bullets ? 'list items' : 'body text';
  if (name.startsWith('OPF list slides') && !name.includes('rule')) return 'list items';
  if (name.startsWith('OPF text slides')) return 'body text';
  // A file OPF did not name (an application's own deck): the placeholder type says what it is.
  if (!name.startsWith('OPF ')) {
    if (ph === 'title' || ph === 'ctrTitle') return 'slide title';
    if (item.paragraphs.some((paragraph) => isListBullet(paragraph) && paragraph.text.trim())) return 'list items';
    if (['body', 'obj', 'subTitle', null].includes(ph) && item.placeholder) return 'body text';
  }
  return 'other text';
}

const BODY_PLACEHOLDERS = new Set([null, 'body', 'obj', 'subTitle']);
function kindOf(item) {
  switch (item.label) {
    case 'slide title':
      return 'title';
    case 'body text':
      return item.placeholder && BODY_PLACEHOLDERS.has(item.placeholder.type) ? 'body' : 'text';
    case 'other text':
    case 'empty text box':
      return 'text';
    case 'list items':
      return 'list';
    case 'table':
      return 'table';
    case 'chart (native)':
    case 'chart (extended)':
      return 'chart';
    case 'line/connector':
      return 'connector';
    case 'group':
      return 'group';
    case 'diagram':
      // A live SmartArt frame is a diagram; OPF's group of shapes named "OPF diagram N" is a group (see the head of the file).
      return item.frame === 'diagram' ? 'diagram' : 'group';
    case 'picture':
      return 'picture';
    case 'media':
      return 'media';
    case 'footer / slide number / date':
      return 'footer';
    default:
      return 'shape';
  }
}

function footerRole(item) {
  const ph = item.placeholder?.type;
  if (FOOTER_ROLES[ph]) return FOOTER_ROLES[ph];
  const fields = item.paragraphs.flatMap((paragraph) => paragraph.fields);
  if (fields.some((type) => type === 'slidenum')) return 'slide-number';
  if (fields.some((type) => type.startsWith('datetime'))) return 'date';
  return 'footer';
}

// ---- the shape tree
function walk(tree, context, groups, depth) {
  const items = [];
  for (const node of elements(tree)) {
    const element = local(node.name);
    if (element === 'AlternateContent') {
      const branch = kid(node, 'Choice') ?? kid(node, 'Fallback');
      if (branch) items.push(...walk(branch, context, groups, depth));
      continue;
    }
    if (!SHAPE_ELEMENTS.has(element)) continue;
    items.push(itemOf(node, element, context, groups, depth));
  }
  return items;
}

function itemOf(node, element, context, groups, depth) {
  const { pkg, rels, slidePart, styles, slideIndexOfPart } = context;
  const nv = elements(node).find((child) => local(child.name).startsWith('nv'));
  const cNvPr = kid(nv, 'cNvPr');
  const item = { element, depth, name: cNvPr?.attributes.name ?? null, placeholder: placeholderOf(node) };
  if (cNvPr?.attributes.descr) {
    item.descr = cNvPr.attributes.descr;
    item.alt = cNvPr.attributes.descr;
  }
  if (cNvPr?.attributes.title) item.title = cNvPr.attributes.title;
  if (cNvPr?.attributes.hidden === '1' || cNvPr?.attributes.hidden === 'true') item.hidden = true;
  const links = [];
  const shapeLink = kid(cNvPr, 'hlinkClick');
  if (shapeLink) links.push({ on: 'shape', text: null, ...linkOf(shapeLink, rels, slideIndexOfPart) });

  const spPr = element === 'grpSp' ? kid(node, 'grpSpPr') : kid(node, 'spPr');
  let xfrmNode = element === 'graphicFrame' ? kid(node, 'xfrm') : kid(spPr, 'xfrm');
  if (!xfrmNode && element === 'sp') xfrmNode = styles.inheritedXfrm(node, slidePart);
  const xfrm = xfrmNode ? readXfrm(xfrmNode) : null;
  item.box = xfrm ? toSlide(xfrm, groups) : null;
  const preset = kid(spPr, 'prstGeom')?.attributes.prst;
  item.preset = preset ?? (kid(spPr, 'custGeom') ? 'custGeom' : null);
  item.fill = fillOf(spPr);
  item.line = hasLine(spPr);

  item.paragraphs = [];
  item.hasText = false;
  if (element === 'sp') {
    const txBody = kid(node, 'txBody');
    if (txBody) {
      item.paragraphs = paragraphsOf(txBody, styles.chain(node, slidePart));
      item.hasText = item.paragraphs.some((paragraph) => paragraph.text !== '');
      item.emptyText = !item.hasText;
      for (const paragraph of item.paragraphs) for (const link of paragraph.links) links.push({ on: 'text', text: link.text, ...linkOf(link.node, rels, slideIndexOfPart) });
    }
  } else if (element === 'pic') {
    const blipFill = kid(node, 'blipFill');
    const srcRect = kid(blipFill, 'srcRect');
    if (srcRect && Object.keys(srcRect.attributes).length > 0) item.crop = { ...srcRect.attributes };
    const media = mediaOf(kid(nv, 'nvPr'));
    if (media) item.media = media;
  } else if (element === 'graphicFrame') {
    const data = at(node, 'graphic', 'graphicData');
    const uri = data?.attributes.uri ?? null;
    if (uri === TABLE_URI) {
      const table = kid(data, 'tbl');
      const rows = kids(table, 'tr');
      item.frame = 'table';
      item.rows = rows.length;
      item.columns = kids(kid(table, 'tblGrid'), 'gridCol').length;
      item.merges = [];
      item.cells = rows.map((row, r) =>
        kids(row, 'tc').map((cell, c) => {
          const merge = ['gridSpan', 'rowSpan', 'hMerge', 'vMerge'].filter((key) => cell.attributes[key]);
          if (merge.length > 0) item.merges.push({ row: r, column: c });
          for (const run of descendants(cell, 'r')) {
            const link = at(run, 'rPr', 'hlinkClick');
            if (link) links.push({ on: 'cell', text: kid(run, 't')?.text ?? '', ...linkOf(link, rels, slideIndexOfPart) });
          }
          return textOf(cell);
        }),
      );
      const tblPr = kid(table, 'tblPr');
      item.firstRow = tblPr?.attributes.firstRow ?? null;
    } else if (uri === CHART_URI) {
      item.frame = 'chart';
      const id = relAttr(kid(data, 'chart'));
      item.chart = id && rels[id] ? chartInfo(pkg, rels[id].target) : null;
    } else if (uri === CHARTEX_URI || descendants(data, 'chart').some((chart) => chart.name.startsWith('cx:'))) {
      item.frame = 'chartex';
    } else {
      item.frame = uri === DIAGRAM_URI ? 'diagram' : 'other';
      item.uri = uri;
      if (item.frame === 'diagram') item.diagram = diagramInfo(pkg, data, rels);
    }
  } else if (element === 'grpSp') {
    item.items = walk(node, context, xfrm ? [xfrm, ...groups] : groups, depth + 1);
  }
  item.links = links;
  item.textFull = item.paragraphs.map((paragraph) => paragraph.text).filter(Boolean).join('\n');
  if (item.hasText) item.text = cutText(item.textFull);
  item.label = labelOf(item);
  item.kind = kindOf(item);
  if (item.kind === 'footer') item.role = footerRole(item);
  return item;
}

/** Every item of a tree, depth first (groups before their members). */
export function* allItems(items) {
  for (const item of items) {
    yield item;
    if (item.items) yield* allItems(item.items);
  }
}

function notesOf(pkg, part) {
  const doc = pkg.xml(part);
  const texts = [];
  for (const shape of descendants(doc, 'sp')) {
    if (placeholderOf(shape)?.type !== 'body') continue;
    texts.push(descendants(shape, 'p').map(textOf).join('\n'));
  }
  const text = texts.join('\n').trim();
  return text === '' ? null : text;
}

/**
 * inspectPptx(bytes | path) -> { slideSize: { width, height } (points), slides: [ { index, hidden, layout, notes, items, links } ] }
 * Slides in presentation order (hidden slides included and flagged). Items in z-order, groups nested in `items`. Each item:
 * { element: sp|pic|graphicFrame|cxnSp|grpSp|contentPart, frame?: table|chart|chartex|diagram|other, kind (the 15 shared
 * kinds), label (the round's finer kind), role? (footer), name, descr?, alt? (= descr), title?, media? (video|audio),
 * diagram? ({ layoutId?, layout?, nodes? }), placeholder: {type, idx}|null, box: [x, y,
 * w, h] points|null, preset (a preset name, "custGeom", or null), fill, line, paragraphs [{text, lvl, bullet, fields}],
 * hasText, emptyText?, text? (cut to 200), textFull, crop?, rows?, columns?, cells?, merges?, firstRow?, chart?, links,
 * items? }. A slide's links: { on: text|shape|cell, name, text, target (a URL, "slide:<index>", or an action), action,
 * external, jump? }.
 */
export function inspectPptx(input) {
  const bytes = typeof input === 'string' ? readFileSync(input) : input;
  const pkg = new Package(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
  const presentation = pkg.xml('ppt/presentation.xml');
  if (!presentation) throw new Error('inspectPptx: no ppt/presentation.xml (not a PowerPoint file)');
  const presentationRels = pkg.rels('ppt/presentation.xml');
  const size = kid(presentation, 'sldSz')?.attributes ?? {};
  const styles = new Styles(pkg);
  const parts = kids(kid(presentation, 'sldIdLst'), 'sldId').map((entry) => presentationRels[relAttr(entry)]?.target);
  const slideIndexOfPart = new Map(parts.map((part, position) => [part, position + 1]));
  const slides = parts.map((slidePart, position) => {
    const doc = pkg.xml(slidePart);
    const rels = pkg.rels(slidePart);
    const layoutPart = pkg.relOf(slidePart, 'slideLayout');
    const layout = layoutPart ? (kid(pkg.xml(layoutPart), 'cSld')?.attributes.name ?? null) : null;
    const tree = at(doc, 'cSld', 'spTree');
    const items = walk(tree, { pkg, rels, slidePart, styles, slideIndexOfPart }, [], 0);
    const links = [];
    for (const item of allItems(items)) for (const link of item.links) links.push({ ...link, name: item.name });
    const notesPart = pkg.relOf(slidePart, 'notesSlide');
    return {
      index: position + 1,
      hidden: doc?.attributes.show === '0' || doc?.attributes.show === 'false',
      part: slidePart,
      layout,
      notes: notesPart ? notesOf(pkg, notesPart) : null,
      items,
      links,
    };
  });
  return {
    slideSize: { width: Number(size.cx ?? 0) / EMU_PER_POINT, height: Number(size.cy ?? 0) / EMU_PER_POINT },
    slides,
  };
}

export { normalize as normalizeText };
