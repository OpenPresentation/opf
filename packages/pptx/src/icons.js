// LH-14 in the PPTX export and import: the icons core composes (`SlideComposition.icons`, core composition.ts `ComposedIcon`), drawn as
// native shapes at core's geometry, as the preview draws them:
//
//   chip     an ellipse in core's chip color, under the glyph
//   glyph    a monochrome icon: core's placed path commands (M, L, C, Z) as one custom geometry (a:custGeom) per part, in core's glyph
//            color: filled, or stroked at the part's width with its caps and joins and no fill, or both. Editable in PowerPoint.
//   picture  a multicolor SVG icon: an SVG picture over its PNG fallback, as pictures are, contained in the chip's square, with no chip
//
// The chip and the glyph name their color by its theme slot where the deck theme holds it (`a:schemeClr val="accent1"` with core's
// lumMod and lumOff for the chip's tint), so the icon recolors with the theme in PowerPoint; a literal sRGB otherwise. Every shape carries
// an OPF_ICON_V1 tag naming the `icon` field's path, the reference as written and the shape's role. Import consumes the tagged shapes
// (they are the drawing of an `icon`, not content) and gives each reference back to its list entry, metric or group (restoreIcons).
import {XMLParser} from 'fast-xml-parser';
import {attachTextTags, decodeTextTag} from './code-provenance.js';
import {schemeColorValue} from './theme-colors.js';

const ICON_TAG = 'OPF_ICON_V1', REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags';
const parser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: false, trimValues: false});
const decoder = new TextDecoder('utf-8', {fatal: true}), array = value => value === undefined ? [] : Array.isArray(value) ? value : [value];
const hex = value => String(value).replace(/^#/, '').slice(0, 6).toUpperCase();
const EMU = 914400;

/** The shape name of an icon's part: `OPF icon <path> <role>`. */
export const iconShapeName = (path, role) => `OPF icon ${path} ${role}`;

/**
 * A core IconPaint as a PptxGenJS color: the theme slot it names where the deck theme holds that exact color (the primary as accent1,
 * `bg1`, `tx1`), with core's luminance transform, so a theme edit recolors the icon; the literal color core computed otherwise.
 */
export function iconColor(paint, context) {
  const role = paint.role === 'primary' ? 'primary' : paint.role === 'bg1' ? 'background' : 'text';
  const base = paint.role === 'primary' ? context.colors?.accent ?? paint.hex : paint.hex;
  const slot = schemeColorValue(role, `#${hex(paint.lumMod !== undefined ? base : paint.hex)}`, context, {vendor: true});
  if (!slot) return hex(paint.hex);
  return paint.lumMod !== undefined || paint.lumOff !== undefined ? {baseColor: slot, ...(paint.lumMod !== undefined ? {lumMod: paint.lumMod / 1000} : {}), ...(paint.lumOff !== undefined ? {lumOff: paint.lumOff / 1000} : {})} : slot;
}

/** Core's path commands (canvas pixels) as PptxGenJS custGeom points in EMU, relative to `origin` (canvas pixels). */
function geometryPoints(commands, origin) {
  const x = value => Math.round((value - origin.x) / 96 * EMU), y = value => Math.round((value - origin.y) / 96 * EMU);
  const points = [];
  for (const command of commands) {
    if (command[0] === 'M') points.push({x: x(command[1]), y: y(command[2]), moveTo: true});
    else if (command[0] === 'L') points.push({x: x(command[1]), y: y(command[2])});
    else if (command[0] === 'C') points.push({x: x(command[5]), y: y(command[6]), curve: {type: 'cubic', x1: x(command[1]), y1: y(command[2]), x2: x(command[3]), y2: y(command[4])}});
    else points.push({close: true});
  }
  return points;
}

const CAPS = {round: 'rnd', square: 'sq', butt: 'flat'};

/**
 * Draw a slide's icons (core `geometry.icons`), each a chip ellipse and its glyph's custom geometries, or a multicolor icon's picture
 * (`addPicture(icon, box, name)`, which the exporter resolves as an SVG picture with its PNG fallback). `tags` collects each shape's
 * record for attachIconTags.
 */
export async function addIcons(slide, icons, context, tags, addPicture) {
  if (!icons?.length) return;
  for (const icon of icons) {
    const record = {v: 1, path: icon.path, owner: icon.owner, reference: icon.reference};
    const box = {x: icon.box.x / 96, y: icon.box.y / 96, w: icon.box.width / 96, h: icon.box.height / 96};
    if (icon.picture) {
      const name = iconShapeName(icon.path, 'picture');
      if (await addPicture(icon, box, name)) tags.set(name, {...record, role: 'picture'});
      continue;
    }
    const chip = iconShapeName(icon.path, 'chip'), glyph = iconColor(icon.colors.glyph, context);
    slide.addShape('ellipse', {x: (icon.chip.cx - icon.chip.radius) / 96, y: (icon.chip.cy - icon.chip.radius) / 96, w: 2 * icon.chip.radius / 96, h: 2 * icon.chip.radius / 96,
      fill: {color: iconColor(icon.colors.chip, context)}, line: {type: 'none'}, objectName: chip});
    tags.set(chip, {...record, role: 'chip'});
    for (const [index, part] of (icon.parts ?? []).entries()) {
      const name = iconShapeName(icon.path, `glyph ${index}`);
      // The geometry spans the glyph's square (the 24-unit icon box), so a straight-line icon never has an empty side.
      slide.addShape('custGeom', {...box, pathW: Math.round(box.w * EMU), pathH: Math.round(box.h * EMU), paths: [geometryPoints(part.commands, icon.box)],
        fill: part.fill ? {color: glyph} : {type: 'none'},
        line: part.stroke !== undefined ? {color: glyph, width: part.stroke * .75, cap: CAPS[part.linecap ?? 'butt'], join: part.linejoin ?? 'miter'} : {type: 'none'},
        objectName: name});
      tags.set(name, {...record, role: 'glyph', part: index});
    }
  }
}

/** Bind each icon shape to its `icon` with a native tag (export, after the package is written). Pictures are tagged too. */
export function attachIconTags(entries, tags) {
  attachTextTags(entries, tags, ICON_TAG, 'opfIcon', 'icon', {pictures: true});
}

/**
 * Import: the shapes and pictures of a slide that carry a valid OPF_ICON_V1 tag (consumed: the drawing of an icon, not content) and the
 * references they drew, by the `icon` field's path (`slides.N.blocks.I.items.J.icon`, `….metric.icon`, `….blocks.I.icon`).
 */
export function importIconShapes(shapes, relationships, entries) {
  const consumed = new Set(), references = new Map();
  for (const shape of shapes) {
    const properties = shape['p:nvSpPr'] ?? shape['p:nvPicPr'];
    for (const link of array(properties?.['p:nvPr']?.['p:custDataLst']?.['p:tags'])) {
      const rel = relationships.get(link['r:id']);
      if (rel?.type !== REL || rel.targetMode === 'External' || !entries[rel.path]) continue;
      try {
        for (const tag of array(parser.parse(decoder.decode(entries[rel.path]))['p:tagLst']?.['p:tag'])) {
          if (String(tag.name ?? '').toUpperCase() !== ICON_TAG) continue;
          const record = decodeTextTag(tag.val);
          if (record?.v !== 1 || typeof record.path !== 'string' || typeof record.reference !== 'string' || !/\.icon$/.test(record.path)) continue;
          consumed.add(shape);
          references.set(record.path, record.reference);
        }
      } catch { /* an unreadable tag leaves the shape as ordinary content */ }
    }
  }
  return {consumed, references};
}

/**
 * Import: put each icon reference back on the imported document at its path (`references` from importIconShapes), where the path
 * still names a list entry object, a metric object or a group of the document. A plain-string entry or metric becomes its object form.
 */
export function restoreIcons(document, references) {
  if (!references?.size || !document || typeof document !== 'object') return document;
  for (const [path, reference] of references) {
    const keys = path.split('.').slice(0, -1);
    let parent, key, node = document;
    for (const part of keys) {
      parent = node;
      key = /^\d+$/.test(part) ? Number(part) : part;
      node = node?.[key];
      if (node === undefined) break;
    }
    if (node === undefined || parent === undefined) continue;
    if (typeof node === 'string' && keys.at(-2) === 'items') parent[key] = {text: node, icon: reference};
    else if ((typeof node === 'string' || typeof node === 'number') && keys.at(-1) === 'metric') parent[key] = {value: node, icon: reference};
    else if (node && typeof node === 'object' && !Array.isArray(node)) node.icon = reference;
  }
  return document;
}
