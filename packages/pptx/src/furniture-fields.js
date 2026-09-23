// Native PowerPoint fields inside OPF furniture shapes. Core supplies the
// displayed text plus half-open UTF-16 ranges for live values; this module turns
// those ranges into <a:fld> runs and maps them back on import. It never reads a
// clock: the cached field text is whatever core laid out.

const enc = new TextEncoder(), dec = new TextDecoder('utf-8', {fatal: true});

// PowerPoint's en-US date field types (ECMA-376 ST_TextField "datetime1".."datetime7").
// Exported runs carry lang="en-US", so these patterns are what PowerPoint displays.
export const NATIVE_DATE_FIELDS = Object.freeze({
  'M/d/yyyy': 'datetime1',
  'EEEE, MMMM d, yyyy': 'datetime2',
  'd MMMM yyyy': 'datetime3',
  'MMMM d, yyyy': 'datetime4',
  'd-MMM-yy': 'datetime5',
  'MMMM yy': 'datetime6',
  'MMM-yy': 'datetime7',
});
export const DEFAULT_DATE_FORMAT = 'M/d/yyyy';
export const DEFAULT_SLIDE_NUMBER_FORMAT = '{current}';

const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const weekdays = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const widths = {y: [1, 2, 4], M: [1, 2, 3, 4], d: [1, 2], E: [1, 2, 3, 4]};
const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const escapeXml = value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const unescapeXml = value => value.replace(/&(lt|gt|quot|apos|amp|#x[0-9A-Fa-f]+|#\d+);/g, (match, entity) =>
  entity === 'lt' ? '<' : entity === 'gt' ? '>' : entity === 'quot' ? '"' : entity === 'apos' ? "'" : entity === 'amp' ? '&' :
  String.fromCodePoint(entity[1] === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1))));

/** Tokenize the same LDML-style subset core formats; null when unsupported. */
function tokens(pattern) {
  if (typeof pattern !== 'string' || !pattern) return null;
  const out = [];
  for (let index = 0; index < pattern.length;) {
    const character = pattern[index];
    if (character === "'") {
      if (pattern[index + 1] === "'") { out.push({text: "'"}); index += 2; continue; }
      let end = index + 1, text = '';
      for (;;) {
        if (end >= pattern.length) return null;
        if (pattern[end] === "'") { if (pattern[end + 1] === "'") { text += "'"; end += 2; continue; } break; }
        text += pattern[end++];
      }
      out.push({text}); index = end + 1; continue;
    }
    if (/[A-Za-z]/.test(character)) {
      let end = index;
      while (pattern[end] === character) end++;
      if (!widths[character]?.includes(end - index)) return null;
      out.push({letter: character, width: end - index}); index = end; continue;
    }
    out.push({text: character}); index++;
  }
  return out;
}

function isoParts(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number), date = new Date(Date.UTC(2000, month - 1, day));
  date.setUTCFullYear(year);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? {year, month, day, weekday: date.getUTCDay()} : null;
}

export function formatDate(iso, pattern) {
  const date = isoParts(iso), list = tokens(pattern);
  if (!date || !list) return null;
  const pad = (value, width) => String(value).padStart(width, '0');
  return list.map(token => token.text ?? (
    token.letter === 'y' ? (token.width === 2 ? pad(date.year % 100, 2) : token.width === 4 ? pad(date.year, 4) : String(date.year)) :
    token.letter === 'M' ? (token.width >= 3 ? months[date.month - 1].slice(0, token.width === 4 ? undefined : 3) : pad(date.month, token.width)) :
    token.letter === 'd' ? pad(date.day, token.width) :
    weekdays[date.weekday].slice(0, token.width === 4 ? undefined : 3))).join('');
}

/**
 * Recover the ISO date that `pattern` formats as exactly `text`. Returns null when
 * the pattern omits the day, month or a four-digit year, or the text no longer
 * matches; callers then keep the current text as a literal date.
 */
export function parseDate(text, pattern) {
  const list = tokens(pattern);
  if (!list || typeof text !== 'string') return null;
  const letters = new Set(list.filter(token => token.letter).map(token => `${token.letter}${token.letter === 'y' ? token.width : ''}`));
  if (!letters.has('M') || !letters.has('d') || !(letters.has('y4') || letters.has('y1'))) return null;
  const groups = [];
  const source = list.map(token => {
    if (token.text !== undefined) return escapeRegExp(token.text);
    groups.push(token);
    if (token.letter === 'M' && token.width >= 3) return `(${months.map(name => token.width === 4 ? name : name.slice(0, 3)).join('|')})`;
    if (token.letter === 'E') return `(${weekdays.map(name => token.width === 4 ? name : name.slice(0, 3)).join('|')})`;
    return token.width === 1 ? '(\\d+)' : `(\\d{${token.width}})`;
  }).join('');
  const match = new RegExp(`^${source}$`).exec(text);
  if (!match) return null;
  let year, month, day;
  for (const [index, token] of groups.entries()) {
    const value = match[index + 1];
    if (token.letter === 'y' && token.width !== 2) year = Number(value);
    else if (token.letter === 'M') month = token.width >= 3 ? months.findIndex(name => (token.width === 4 ? name : name.slice(0, 3)) === value) + 1 : Number(value);
    else if (token.letter === 'd') day = Number(value);
  }
  if (!(year >= 0 && year <= 9999)) return null;
  const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  // Reformatting must reproduce the current text exactly, including the weekday.
  return formatDate(iso, pattern) === text ? iso : null;
}

export function formatSlideNumber(format, current, total) {
  if (typeof format !== 'string' || !format.includes('{current}') || (format.includes('{total}') && !Number.isSafeInteger(total))) return null;
  return format.split(/(\{current\}|\{total\})/).map(piece => piece === '{current}' ? String(current) : piece === '{total}' ? String(total) : piece).join('');
}

/**
 * Live field ranges for one accepted furniture text part. Core >= FF-27 supplies
 * `part.fields`; earlier cores only supply a bare generated number, which is
 * still a whole slide-number field.
 */
export function furniturePartFields(part) {
  if (Array.isArray(part.fields)) return part.fields;
  return part.field === 'slideNumber' && /^\d+$/.test(part.text) ? [{type: 'slideNumber', start: 0, end: part.text.length}] : [];
}

/** Native <a:fld> type for a core field, or null when the value must stay fixed text. */
export function nativeFieldType(field) {
  if (field.type === 'slideNumber') return 'slidenum';
  if (field.type === 'date') return NATIVE_DATE_FIELDS[field.format ?? DEFAULT_DATE_FORMAT] ?? null;
  return null;
}

/** Split fitted lines into per-line field ranges; a field broken across lines stays fixed text. */
export function lineFields(text, fields, sourceLines, lines) {
  return lines.map((line, index) => {
    const source = sourceLines?.[index];
    if (!source) return [];
    return fields.filter(field => field.start >= source.start && field.end <= source.end && field.end > field.start)
      .map(field => ({...field, start: field.start - source.start, end: field.end - source.start}))
      .filter(field => line.slice(field.start, field.end) === text.slice(field.start + source.start, field.end + source.start));
  });
}

/**
 * Rewrite the single generated run of each recorded furniture shape into runs and
 * <a:fld> elements. Field ids are deterministic so exports stay byte-stable.
 */
export function attachFurnitureFields(entries, records) {
  if (!records.size) return;
  let count = 0;
  const seen = new Set();
  for (const path of Object.keys(entries).filter(path => /^ppt\/slides\/slide\d+\.xml$/.test(path)).sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]))) {
    const xml = dec.decode(entries[path]).replace(/<p:sp>[\s\S]*?<\/p:sp>/g, shape => {
      const name = shape.match(/<p:cNvPr\b[^>]*\bname="([^"]+)"/)?.[1];
      const record = records.get(name);
      if (!record) return shape;
      if (seen.has(name)) throw new Error('Duplicate generated furniture field shape.');
      seen.add(name);
      const runs = [...shape.matchAll(/<a:r>(<a:rPr\b[^>]*\/>|<a:rPr\b[^>]*>[\s\S]*?<\/a:rPr>)<a:t>([^<]*)<\/a:t><\/a:r>/g)];
      if (runs.length !== 1 || unescapeXml(runs[0][2]) !== record.text) throw new Error('Generated furniture field text does not match its accepted line.');
      const [run, properties] = runs[0];
      let cursor = 0, body = '';
      const literal = text => { if (text) body += `<a:r>${properties}<a:t>${escapeXml(text)}</a:t></a:r>`; };
      for (const field of [...record.fields].sort((a, b) => a.start - b.start)) {
        if (field.start < cursor) throw new Error('Overlapping furniture fields.');
        literal(record.text.slice(cursor, field.start));
        const id = `{0F0F2700-0000-4000-8000-${(++count).toString(16).toUpperCase().padStart(12, '0')}}`;
        body += `<a:fld id="${id}" type="${field.nativeType}">${properties}<a:t>${escapeXml(record.text.slice(field.start, field.end))}</a:t></a:fld>`;
        cursor = field.end;
      }
      literal(record.text.slice(cursor));
      return shape.replace(run, body);
    });
    entries[path] = enc.encode(xml);
  }
  if (seen.size !== records.size) throw new Error('Missing generated furniture field shapes.');
}
