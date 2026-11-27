// NT-16: what powerpoint.ps1 writes (files/<id>/powerpoint-raw.json) -> result.json of the shared format
// (core/result/README.md). The PowerShell side reports PowerPoint's own facts (MsoShapeType, PpPlaceholderType, the text,
// the table cells, the links); this module decides the shared kind of each object, so the mapping is tested in Node.
import { readFileSync } from 'node:fs';
import { cutText, editPath, emptyResult } from '../../core/result/result.mjs';
import { pngInfo } from '../keynote/driver.mjs';

/** MsoShapeType by number: the object's appClass. */
export const SHAPE_TYPES = Object.freeze({
  1: 'msoAutoShape',
  2: 'msoCallout',
  3: 'msoChart',
  4: 'msoComment',
  5: 'msoFreeform',
  6: 'msoGroup',
  7: 'msoEmbeddedOLEObject',
  8: 'msoFormControl',
  9: 'msoLine',
  10: 'msoLinkedOLEObject',
  11: 'msoLinkedPicture',
  12: 'msoOLEControlObject',
  13: 'msoPicture',
  14: 'msoPlaceholder',
  15: 'msoTextEffect',
  16: 'msoMedia',
  17: 'msoTextBox',
  18: 'msoScriptAnchor',
  19: 'msoTable',
  20: 'msoCanvas',
  21: 'msoDiagram',
  22: 'msoInk',
  23: 'msoInkComment',
  24: 'msoSmartArt',
  25: 'msoSlicer',
  26: 'msoWebVideo',
  27: 'msoContentApp',
  28: 'msoGraphic',
  29: 'msoLinkedGraphic',
  30: 'mso3DModel',
  31: 'msoLinked3DModel',
});

/** PpPlaceholderType by number. */
export const PLACEHOLDER_TYPES = Object.freeze({
  1: 'title',
  2: 'body',
  3: 'centerTitle',
  4: 'subtitle',
  5: 'verticalTitle',
  6: 'verticalBody',
  7: 'object',
  8: 'chart',
  9: 'bitmap',
  10: 'mediaClip',
  11: 'orgChart',
  12: 'table',
  13: 'slideNumber',
  14: 'header',
  15: 'footer',
  16: 'date',
  17: 'verticalObject',
  18: 'picture',
});

const TITLE = new Set([1, 3, 5]);
const BODY = new Set([2, 4, 6, 7, 17]);
const FOOTER_ROLE = Object.freeze({ 13: 'slide-number', 15: 'footer', 16: 'date' });
const PICTURE_TYPES = new Set([11, 13, 28, 29]);

/** What `open: done` means for this driver (core/result/README.md, "open: done"). */
export const OPEN_NOTE =
  'opened read-only without a window over COM: done means opened without an error; PowerPoint shows no repair prompt in this mode, so it does not establish that none would appear';

const asArray = (value) => (Array.isArray(value) ? value : value === null || value === undefined ? [] : [value]);
/** PowerPoint separates paragraphs with \r and line breaks with \v. */
export const plainText = (text) => String(text ?? '').replace(/\r\n?|\v/gu, '\n');
const hasText = (raw) => typeof raw.text === 'string' && raw.text.trim() !== '';

/** The shared kind of one raw shape (core/result/README.md, "Objects: 15 kinds", PowerPoint column). */
export function kindOf(raw) {
  const ph = raw.placeholder?.type ?? null;
  const contained = raw.placeholder?.containedType ?? null;
  if (raw.hasSmartArt || raw.type === 24) return 'diagram';
  if (raw.type === 6) return 'group';
  if (raw.hasTable || raw.type === 19 || contained === 19) return 'table';
  if (raw.hasChart || raw.type === 3 || contained === 3) return 'chart';
  if (raw.type === 16 || raw.type === 26 || contained === 16) return 'media';
  if (FOOTER_ROLE[ph]) return 'footer';
  if (TITLE.has(ph)) return 'title';
  if (raw.connector || raw.type === 9) return 'connector';
  if (PICTURE_TYPES.has(raw.type) || contained === 13 || contained === 28) return 'picture';
  if (hasText(raw) && raw.bullets) return 'list';
  if (BODY.has(ph)) return 'body';
  if (hasText(raw) || raw.type === 17) return 'text';
  return 'shape';
}

/** A link's target: the URL, or "slide:<index>" from a SubAddress "<slide id>,<slide index>,<title>". */
export function linkTarget(link) {
  const address = String(link?.address ?? '').trim();
  const sub = String(link?.subAddress ?? '').trim();
  if (address) return sub ? `${address}#${sub}` : address;
  const slide = /^\d+,(\d+),/u.exec(sub);
  if (slide) return `slide:${slide[1]}`;
  return sub || null;
}

function linkObject(raw, link, on) {
  const target = linkTarget(link);
  if (!target) return null;
  const object = { kind: 'link', outcome: null };
  if (raw.name) object.name = raw.name;
  if (link.text && String(link.text).trim()) object.text = cutText(plainText(link.text));
  object.on = on;
  object.target = target;
  const details = { address: link.address ?? '', subAddress: link.subAddress ?? '' };
  if (link.row !== undefined) Object.assign(details, { row: link.row, column: link.column });
  object.details = details;
  return object;
}

/** The link objects a raw shape carries: its click, its text runs', its table cells'. */
export function linksOf(raw) {
  return [
    ...(raw.click ? [linkObject(raw, raw.click, 'shape')] : []),
    ...asArray(raw.textLinks).map((link) => linkObject(raw, link, 'text')),
    ...asArray(raw.cellLinks).map((link) => linkObject(raw, link, 'cell')),
  ].filter(Boolean);
}

const finite = (value) => typeof value === 'number' && Number.isFinite(value);

/** One raw shape -> [the object, then its links]. */
export function objectsOf(raw) {
  const kind = kindOf(raw);
  const object = { kind, outcome: null };
  if (raw.name) object.name = String(raw.name);
  if (raw.alt) object.alt = String(raw.alt);
  object.appClass = SHAPE_TYPES[raw.type] ?? `MsoShapeType ${raw.type}`;
  if ([raw.left, raw.top, raw.width, raw.height].every(finite)) object.box = [raw.left, raw.top, raw.width, raw.height];
  if (kind !== 'table' && kind !== 'group' && hasText(raw)) object.text = cutText(plainText(raw.text));
  const fonts = [...new Set(asArray(raw.fonts).filter((name) => typeof name === 'string' && name !== ''))];
  if (fonts.length > 0) object.fonts = fonts;
  if (kind === 'table') {
    if (Number.isInteger(raw.rows)) object.rows = raw.rows;
    if (Number.isInteger(raw.columns)) object.columns = raw.columns;
  }
  if (kind === 'footer') object.role = FOOTER_ROLE[raw.placeholder.type];
  if (kind === 'group') object.objects = asArray(raw.members).flatMap(objectsOf);

  const details = {};
  if (raw.id !== undefined && raw.id !== null) details.shapeId = raw.id;
  if (finite(raw.rotation) && raw.rotation !== 0) details.rotation = raw.rotation;
  if (raw.placeholder) details.placeholder = { type: PLACEHOLDER_TYPES[raw.placeholder.type] ?? raw.placeholder.type ?? null, ...(raw.placeholder.containedType !== undefined ? { containedType: SHAPE_TYPES[raw.placeholder.containedType] ?? raw.placeholder.containedType } : {}) };
  if (raw.textFrame) details.textFrame = raw.textFrame;
  if (raw.bullets) details.bullets = true;
  if (raw.line) details.line = raw.line;
  if (kind === 'table' && raw.cells) details.cells = asArray(raw.cells).map((row) => asArray(row).map((cell) => ({ text: plainText(cell.text), fill: cell.fill ?? null, color: cell.color ?? null })));
  if (raw.chart) details.chart = raw.chart;
  if (raw.smartArt) Object.assign(details, { layout: raw.smartArt.layout, layoutId: raw.smartArt.layoutId, nodes: raw.smartArt.nodes });
  if (raw.mediaType !== undefined && raw.mediaType !== null) details.mediaType = raw.mediaType;
  if (Object.keys(details).length > 0) object.details = details;
  return [object, ...linksOf(raw)];
}

const verbOf = (raw) => {
  const verb = { status: raw?.status ?? 'not-run' };
  if (finite(raw?.seconds) && raw.seconds >= 0) verb.seconds = raw.seconds;
  if (raw?.message) verb.message = String(raw.message);
  return verb;
};

/** The slides of a raw file in the shared shape. */
export function slidesOf(raw) {
  return asArray(raw.slides).map((slide) => {
    const notes = typeof slide.notes === 'string' && slide.notes.trim() !== '' ? plainText(slide.notes) : null;
    const objects = asArray(slide.shapes).flatMap(objectsOf);
    if (notes) objects.push({ kind: 'notes', outcome: null, text: cutText(notes) });
    const details = {};
    if (slide.id !== undefined && slide.id !== null) details.slideId = slide.id;
    const placeholders = asArray(slide.shapes)
      .filter((shape) => shape.placeholder)
      .map((shape) => ({ name: shape.name, type: PLACEHOLDER_TYPES[shape.placeholder.type] ?? shape.placeholder.type ?? null }));
    if (placeholders.length > 0) details.placeholders = placeholders;
    if (slide.probeError) details.probeError = String(slide.probeError);
    return {
      index: slide.index,
      hidden: Boolean(slide.hidden),
      layout: slide.layout ? String(slide.layout) : null,
      picture: slide.picture ?? null,
      notes,
      objects,
      ...(Object.keys(details).length > 0 ? { details } : {}),
    };
  });
}

/** A raw file for an input powerpoint.ps1 wrote nothing about (it stopped or crashed before the file). */
export function missingRaw(input, why) {
  return { id: input.id, path: input.path, sha256Before: null, sha256After: null, open: { status: 'not-run', message: why }, resave: { status: 'not-run' }, render: { status: 'not-run' }, probe: { status: 'not-run' }, close: { status: 'not-run' }, edits: [], slides: [] };
}

/**
 * result.json of one file.
 *   buildResult({ raw, input: { deck, variant, relativePath }, application, system, opf, fonts, started, finished,
 *                 hashes: { before, after }, fileDir })
 * hashes are Node's SHA-256 of the input before and after the run; unchangedAfterRun is true only when they are equal and
 * the PowerShell side's own two hashes (when it took them) agree with them.
 */
export function buildResult({ raw, input, application, system, opf, fonts = 'installed', started, finished, hashes, fileDir }) {
  const psHashes = [raw.sha256Before, raw.sha256After].filter(Boolean);
  let unchangedAfterRun = null;
  if (hashes.before && hashes.after) unchangedAfterRun = hashes.before === hashes.after && psHashes.every((hash) => hash === hashes.before);
  const result = emptyResult({
    target: 'powerpoint',
    application,
    system,
    fonts,
    opf,
    file: { deck: input.deck, variant: input.variant ?? 'default', path: input.relativePath, sha256: hashes.before ?? '', unchangedAfterRun },
    started,
    finished,
  });
  const open = verbOf(raw.open);
  if (open.status === 'done') {
    open.slideCount = raw.slideCount;
    open.message = OPEN_NOTE;
  }
  result.verbs.open = { ...open, warnings: { status: 'not-read', source: null, lines: [] } };
  result.verbs.render = verbOf(raw.render);
  if (Array.isArray(raw.render?.pixelSize)) result.verbs.render.pixelSize = raw.render.pixelSize;
  result.verbs.probe = verbOf(raw.probe);
  result.verbs.resave = verbOf(raw.resave);
  if (raw.resave?.path) result.verbs.resave.path = raw.resave.path;
  const edits = asArray(raw.edits).map((edit) => ({ id: edit.id, what: edit.what || edit.id, path: editPath(edit.id), ...verbOf(edit) }));
  if (edits.length > 0) result.verbs.edits = edits;
  if (open.status === 'done') result.slides = slidesOf(raw);

  // The size PowerPoint wrote, from the first picture's header where it can be read; else the size it was asked for.
  const first = result.slides.find((slide) => slide.picture);
  if (first && fileDir) {
    try {
      const facts = pngInfo(readFileSync(`${fileDir}/${first.picture}`));
      if (facts) Object.assign(result.verbs.render, facts);
    } catch {
      // The picture went away: keep the requested size.
    }
  }
  const details = { driver: 'powerpoint.ps1: PowerPoint over COM, read-only, no window' };
  if (raw.slideSize) details.slideSize = raw.slideSize;
  if (raw.fonts) details.fonts = asArray(raw.fonts);
  details.close = verbOf(raw.close);
  details.sha256 = { node: hashes, powershell: { before: raw.sha256Before ?? null, after: raw.sha256After ?? null } };
  if (raw.excelSeen) details.excelSeen = true;
  result.details = details;
  return result;
}
