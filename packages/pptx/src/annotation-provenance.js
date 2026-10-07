// Round trip of captions, citations and footnotes (RR-34).
//
// Export writes captions and footnote lines as tagged text boxes (annotation-export.js):
//   OPF_CAPTION_V1   {v:1, role:'caption', path, field, media, position, align, line, count, boundary, separator, rich?}
//   OPF_FOOTNOTES_V1 {v:1, role:'rule', slide} | {v:1, role:'entry', slide, entry, number, kind, id?, source, url?, line, count, boundary, separator, rich?}
// and the deck's `references` travel in the document record (document-provenance.js, metadata
// supplement). Citation markers are ordinary superscript runs (`baseline="30000"`) with no tag.
//
// Import consumes the tagged shapes: caption lines re-attach to the block whose native media shape
// the tag names (current native text wins, so an edited caption keeps its edit); footnote lines
// rebuild each slide's notes (number, kind, reference id, current text); then every superscript
// run whose text is a marker (`1`, `1,2`) directly after another run, and whose numbers all resolve
// to this slide's notes, is removed and the run before it gets `cite` (reference ids) and/or
// `footnote` (the note text). The references list is the stored list with the current text of every
// note that was edited natively, plus any reference the stored list does not hold. Without tags
// nothing is guessed: a superscript number stays a superscript run and a text box stays a text block.
// Tags are untrusted input: every field is checked before use and the result still validates.
import {XMLParser} from 'fast-xml-parser';
import {attachTextTags, decodeTextTag} from './code-provenance.js';
import {sourceLineParagraphs} from './text-provenance.js';
import {CAPTION_TAG, FOOTNOTES_TAG} from './annotation-export.js';

const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags';
const parser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: false, trimValues: false});
const decoder = new TextDecoder('utf-8', {fatal: true});
const array = value => value === undefined ? [] : Array.isArray(value) ? value : [value];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const MAX_VALUE_CHARS = 64 * 1024;
const MARKER = /^\d+(?:,\d+)*$/;
const ENGINE_STYLE = new Set(['fontSize', 'fontFamily', 'color']);
// Internal reader markers (`_opfScheme`: the scheme slot a colour resolved from) are not authored style either.
const engineKey = key => ENGINE_STYLE.has(key) || key.startsWith('_opf');
const name = shape => shape?.['p:nvSpPr']?.['p:cNvPr']?.name ?? shape?.['p:nvPicPr']?.['p:cNvPr']?.name ?? shape?.['p:nvGraphicFramePr']?.['p:cNvPr']?.name;

export function attachAnnotationTags(entries, context) {
  attachTextTags(entries, context.captionTags, CAPTION_TAG, 'opfCaption', 'caption');
  attachTextTags(entries, context.footnoteTags, FOOTNOTES_TAG, 'opfFootnotes', 'footnotes');
}

function readTags(shape, relationships, entries) {
  const tags = [];
  let unreadable = false;
  for (const link of array(shape['p:nvSpPr']?.['p:nvPr']?.['p:custDataLst']?.['p:tags'])) {
    const rel = relationships.get(link['r:id']);
    if (rel?.type !== REL || rel.targetMode === 'External' || !entries[rel.path]) { unreadable = true; continue; }
    try { tags.push(...array(parser.parse(decoder.decode(entries[rel.path]))['p:tagLst']?.['p:tag'])); } catch { unreadable = true; }
  }
  return {tags, unreadable};
}

function readRecord(shape, relationships, entries, tagName) {
  const {tags, unreadable} = readTags(shape, relationships, entries);
  const own = tags.filter(tag => String(tag.name ?? '').toUpperCase() === tagName);
  if (!own.length) return undefined;
  if (unreadable || own.length !== 1 || tags.some(tag => /^OPF_/i.test(tag.name ?? '') && String(tag.name).toUpperCase() !== tagName)) return null;
  try {
    if (typeof own[0].val !== 'string' || own[0].val.length > MAX_VALUE_CHARS * 2) return null;
    const record = decodeTextTag(own[0].val);
    if (!object(record) || record.v !== 1) return null;
    if (record.line !== undefined && (!Number.isSafeInteger(record.line) || record.line < 0 || !Number.isSafeInteger(record.count) || record.count < 1 || record.count > 1000 || record.line >= record.count)) return null;
    if (record.boundary !== undefined && !['hard', 'soft', 'end'].includes(record.boundary)) return null;
    if (record.separator !== undefined && (typeof record.separator !== 'string' || !/^(?:\r\n|\r|\n)?$/.test(record.separator))) return null;
    return record;
  } catch { return null; }
}

// Current native text of a group of line shapes, in line order: rich runs when the reader yields
// them, else the plain paragraph text. Soft wraps insert nothing; hard boundaries keep their separator.
function groupText(members, paragraphs, readBody) {
  const ordered = members.sort((a, b) => a.record.line - b.record.line);
  const rich = ordered.map(member => readBody?.(member.index));
  if (rich.every(body => Array.isArray(body) && body.length)) {
    const runs = [];
    ordered.forEach((member, position) => {
      const body = rich[position];
      body.forEach((paragraph, paragraphIndex) => {
        if (paragraphIndex) runs.push('\n');
        // Caption and note lines are drawn in the engine's caption/footnote size, family and muted
        // colour: those are not authored run styles, so only the authored emphasis comes back.
        runs.push(...(Array.isArray(paragraph.richText) ? paragraph.richText.map(run => typeof run === 'string' ? run : Object.fromEntries(Object.entries(run).filter(([key]) => !engineKey(key)))) : [paragraph.richText ?? paragraph.text ?? '']));
      });
      const separator = member.record.boundary === 'hard' ? (member.record.separator || '\n') : '';
      if (separator && position < ordered.length - 1) runs.push(separator);
    });
    return normalizeRuns(runs);
  }
  try {
    return sourceLineParagraphs(ordered.map(member => ({index: member.index, data: {boundary: member.record.boundary ?? (member.record.line === member.record.count - 1 ? 'end' : 'soft'), separator: member.record.separator ?? (member.record.boundary === 'hard' ? '\n' : '')}})), paragraphs)[0].text;
  } catch {
    return ordered.map(member => (paragraphs[member.index] ?? []).map(paragraph => paragraph.text).join('\n')).join('');
  }
}

// Merge adjacent plain strings; a run list with no styled run is a plain string.
function normalizeRuns(runs) {
  const merged = [];
  for (const run of runs) {
    const last = merged[merged.length - 1];
    if (typeof run === 'string') { if (!run) continue; if (typeof last === 'string') merged[merged.length - 1] = last + run; else merged.push(run); }
    else if (object(run) && typeof run.text === 'string') {
      // A reader may leave keys with undefined values (no native value); they are not authored style.
      const style = Object.fromEntries(Object.entries(run).filter(([key, value]) => key !== 'text' && value !== undefined));
      if (!Object.keys(style).length) { if (typeof last === 'string') merged[merged.length - 1] = last + run.text; else merged.push(run.text); }
      else merged.push({text: run.text, ...style});
    }
  }
  return merged.every(run => typeof run === 'string') ? merged.join('') : merged;
}

const plain = value => typeof value === 'string' ? value : Array.isArray(value) ? value.map(run => typeof run === 'string' ? run : run.text).join('') : '';

// Strip the `<n> ` prefix a listed note starts with.
function withoutNumber(value, number) {
  const prefix = `${number} `;
  if (typeof value === 'string') return value.startsWith(prefix) ? value.slice(prefix.length) : value;
  if (!Array.isArray(value) || !value.length) return value;
  const [first, ...rest] = value, text = typeof first === 'string' ? first : first.text;
  if (!text.startsWith(prefix)) return value;
  const remainder = text.slice(prefix.length);
  const head = typeof first === 'string' ? (remainder ? [remainder] : []) : remainder ? [{...first, text: remainder}] : [];
  return normalizeRuns([...head, ...rest]);
}

/**
 * Consume the tagged caption and footnote shapes of one slide. Returns the shapes to skip, the
 * captions keyed by the media shape name they belong to, and the slide's notes in number order.
 */
export function importAnnotations({shapes, paragraphs, relationships, entries, slideIndex, readBody, report}) {
  const consumed = new Set(), captionGroups = new Map(), entryGroups = new Map();
  for (const [index, shape] of shapes.entries()) {
    const caption = readRecord(shape, relationships, entries, CAPTION_TAG);
    if (caption !== undefined) {
      consumed.add(shape);
      if (!caption || caption.role !== 'caption' || typeof caption.path !== 'string' || typeof caption.field !== 'string' || !['below', 'above'].includes(caption.position) || !['left', 'center', 'right'].includes(caption.align) || caption.line === undefined) { report({code: 'invalid-caption-provenance', path: `slides.${slideIndex}`, message: 'A caption tag is unreadable or invalid; its text stays an ordinary text block.'}); consumed.delete(shape); continue; }
      const key = caption.path;
      if (!captionGroups.has(key)) captionGroups.set(key, []);
      captionGroups.get(key).push({index, shape, record: caption});
      continue;
    }
    const footnote = readRecord(shape, relationships, entries, FOOTNOTES_TAG);
    if (footnote === undefined) continue;
    consumed.add(shape);
    if (!footnote || !['rule', 'entry'].includes(footnote.role)) { report({code: 'invalid-footnote-provenance', path: `slides.${slideIndex}`, message: 'A footnote tag is unreadable or invalid; its text stays an ordinary text block.'}); consumed.delete(shape); continue; }
    if (footnote.role === 'rule') continue;
    if (!Number.isSafeInteger(footnote.entry) || !Number.isSafeInteger(footnote.number) || footnote.number < 1 || !['reference', 'footnote'].includes(footnote.kind) || (footnote.kind === 'reference' && typeof footnote.id !== 'string') || footnote.line === undefined) { report({code: 'invalid-footnote-provenance', path: `slides.${slideIndex}`, message: 'A footnote entry tag is invalid; its text stays an ordinary text block.'}); consumed.delete(shape); continue; }
    if (!entryGroups.has(footnote.entry)) entryGroups.set(footnote.entry, []);
    entryGroups.get(footnote.entry).push({index, shape, record: footnote});
  }
  const complete = members => members.length === members[0].record.count && new Set(members.map(member => member.record.line)).size === members.length;
  const captions = new Map();
  for (const [path, members] of captionGroups) {
    if (!complete(members)) { report({code: 'invalid-caption-provenance', path, message: 'Caption lines were removed or duplicated; the remaining text stays an ordinary text block.'}); for (const member of members) consumed.delete(member.shape); continue; }
    const {record} = members[0];
    const value = groupText(members, paragraphs, readBody);
    captions.set(typeof record.media === 'string' ? record.media : `path:${path}`, {value, path, field: record.field, position: record.position, align: record.align});
  }
  const notes = [];
  for (const members of entryGroups.values()) {
    if (!complete(members)) { report({code: 'invalid-footnote-provenance', path: `slides.${slideIndex}`, message: 'Footnote lines were removed or duplicated; the remaining text stays an ordinary text block.'}); for (const member of members) consumed.delete(member.shape); continue; }
    const {record} = members[0];
    notes.push({number: record.number, kind: record.kind, ...(record.kind === 'reference' ? {id: record.id} : {}), ...(typeof record.url === 'string' ? {url: record.url} : {}), text: withoutNumber(groupText(members, paragraphs, readBody), record.number)});
  }
  notes.sort((a, b) => a.number - b.number);
  return {consumed, captions, notes};
}

/** The caption value to write into a block: a string or TextRun[] with the default position and alignment, else the object form. */
export function captionValue(caption) {
  return caption.position === 'below' && caption.align === 'left' ? caption.value : {text: caption.value, position: caption.position, align: caption.align};
}

// Every run array of a slide payload that may carry markers, with a setter.
function runArrays(slide) {
  const found = [];
  const visit = (host, path) => {
    if (!object(host)) return;
    if (Array.isArray(host.blocks)) { host.blocks.forEach((block, index) => visit(block, `${path}.blocks.${index}`)); return; }
    if (Array.isArray(host.text)) found.push({path: `${path}.text`, get: () => host.text, set: value => { host.text = value; }});
    // FA-10: a quote's text may carry markers too.
    if (object(host.quote) && Array.isArray(host.quote.text)) found.push({path: `${path}.quote.text`, get: () => host.quote.text, set: value => { host.quote.text = value; }});
    for (const field of ['bullets', 'items']) if (Array.isArray(host[field])) host[field].forEach((item, index) => {
      if (Array.isArray(item)) found.push({path: `${path}.${field}.${index}`, get: () => host[field][index], set: value => { host[field][index] = value; }});
      else if (object(item)) {
        if (Array.isArray(item.text)) found.push({path: `${path}.${field}.${index}.text`, get: () => item.text, set: value => { item.text = value; }});
        if (Array.isArray(item.description)) found.push({path: `${path}.${field}.${index}.description`, get: () => item.description, set: value => { item.description = value; }});
      }
    });
  };
  // FA-10: the heading group (tag, title, subtitle) may carry markers when it is TextRun[].
  for (const field of ['tag', 'title', 'subtitle']) if (Array.isArray(slide[field])) found.push({path: field, get: () => slide[field], set: value => { slide[field] = value; }});
  const keys = Object.keys(slide).filter(key => /^(top|middle|bottom|left|center|right)([+:]|$)/.test(key) && object(slide[key]));
  if (keys.length) for (const key of keys.sort()) visit(slide[key], key); else visit(slide, '');
  return found;
}

const isMarkerRun = run => object(run) && run.superscript === true && typeof run.text === 'string' && MARKER.test(run.text);

/**
 * Replace the marker runs of `slide` by `cite`/`footnote` on the runs before them, using the slide's
 * notes. A marker whose numbers do not all resolve, or that starts a run array, is left as it is.
 * Returns the reference notes the slide used.
 */
export function restoreSlideCitations(slide, notes) {
  const byNumber = new Map(notes.map(note => [note.number, note]));
  for (const target of runArrays(slide)) {
    const runs = target.get();
    if (!runs.some(isMarkerRun)) continue;
    const result = [];
    for (const run of runs) {
      const previous = result[result.length - 1];
      if (!isMarkerRun(run) || previous === undefined || typeof previous === 'object' && previous.superscript) { result.push(run); continue; }
      const resolved = run.text.split(',').map(Number).map(number => byNumber.get(number));
      if (resolved.some(note => !note)) { result.push(run); continue; }
      const marked = typeof previous === 'string' ? {text: previous} : {...previous};
      const ids = [...new Set(resolved.filter(note => note.kind === 'reference').map(note => note.id))];
      const footnotes = resolved.filter(note => note.kind === 'footnote');
      if (ids.length) marked.cite = ids.length === 1 ? ids[0] : ids;
      if (footnotes.length) marked.footnote = footnotes[0].text;
      result[result.length - 1] = marked;
    }
    target.set(result);
  }
}

/**
 * Apply the notes of every slide to `imported` (markers become cite/footnote) and rebuild
 * `references`: the stored list (document provenance) with the current native text of each note
 * that was edited, plus any cited reference the stored list does not hold, in number order.
 */
export function restoreCitations(imported, slideNotes, report) {
  const used = new Map();
  imported.slides.forEach((slide, index) => {
    const notes = slideNotes[index] ?? [];
    if (!notes.length) return;
    restoreSlideCitations(slide, notes);
    for (const note of notes) if (note.kind === 'reference' && !used.has(note.id)) used.set(note.id, note);
  });
  const stored = Array.isArray(imported.references) ? imported.references.filter(object) : [];
  if (!stored.length && !used.size) return;
  const references = stored.map(reference => {
    const note = used.get(reference.id);
    if (!note) return reference;
    const current = note.text;
    if (plain(current) === plain(reference.text)) return reference;
    report({code: 'reference-text-changed', path: `references.${stored.indexOf(reference)}`, message: `Reference '${reference.id}' shows edited text in a footnote area; the imported reference keeps the edited text.`});
    return {...reference, text: current};
  });
  for (const note of used.values()) if (!references.some(reference => reference.id === note.id)) references.push({id: note.id, text: note.text, ...(note.url !== undefined ? {url: note.url} : {})});
  imported.references = references;
}
