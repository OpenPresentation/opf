// Native PowerPoint fields inside OPF furniture shapes. Core supplies the
// displayed text plus half-open UTF-16 ranges for live values; this module turns
// those ranges into <a:fld> runs and maps them back on import. It never reads a
// clock: the cached field text is whatever core laid out.

const enc = new TextEncoder(), dec = new TextDecoder('utf-8', {fatal: true});

// PowerPoint's en-US date field types (ECMA-376 ST_TextField "datetime1".."datetime7"): what a field whose run
// carries lang="en-US" displays. Other languages: LANGUAGE_DATE_FIELDS below.
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

// RR-102: what PowerPoint shows for `datetime1`..`datetime7` in each language (the field's `lang` picks the list, and Insert >
// Header & Footer shows it as the Language), read through COM from PowerPoint 16.0.20527 for Windows on 2026-11-06: today was
// Friday 6 November 2026, so day and year widths and names are observed and a two-digit month is read with the language's
// day width (Windows' own pattern for the language agrees). Only patterns OPF can draw are listed: OPF's month and weekday
// names are English, so a language with other names keeps its numeric patterns only. `datetime8`..`datetime13` hold a time,
// which an OPF dateFormat cannot express. Arabic (Saudi Arabia), Hebrew and Hindi default to the Hijri, Hebrew and Saka
// calendars, so none of their fields shows OPF's Gregorian date. The first type that shows a pattern wins.
const ENGLISH_DATE_TAIL = {'d-MMM-yy': 'datetime5', 'MMMM yy': 'datetime6', 'MMM-yy': 'datetime7'};
const LANGUAGE_DATE_FIELDS = Object.freeze({
  'en-us': NATIVE_DATE_FIELDS,
  'en-gb': {'dd/MM/yyyy': 'datetime1', 'EEEE, dd MMMM yyyy': 'datetime2', 'd MMMM, yyyy': 'datetime3', 'dd MMMM yyyy': 'datetime4', ...ENGLISH_DATE_TAIL},
  'en-au': {'d/MM/yyyy': 'datetime1', 'EEEE, d MMMM yyyy': 'datetime2', 'd MMMM, yyyy': 'datetime3', 'd MMMM yyyy': 'datetime4', ...ENGLISH_DATE_TAIL},
  'en-nz': {'d/MM/yyyy': 'datetime1', 'EEEE, d MMMM yyyy': 'datetime2', 'd MMMM yyyy': 'datetime3', ...ENGLISH_DATE_TAIL},
  'en-ca': {'yyyy-MM-dd': 'datetime1', 'EEEE, MMMM d, yyyy': 'datetime2', 'd MMMM yyyy': 'datetime3', 'MMMM d, yyyy': 'datetime4', 'yy-MMM-d': 'datetime5', 'MMMM yy': 'datetime6', 'MMM-yy': 'datetime7'},
  'en-in': {'dd-MM-yyyy': 'datetime1', 'EEEE, dd MMMM yyyy': 'datetime2', 'd MMMM yyyy': 'datetime3', 'dd MMMM yyyy': 'datetime4', ...ENGLISH_DATE_TAIL},
  'de-de': {'dd.MM.yyyy': 'datetime1', 'dd/MM/yy': 'datetime3', 'yy-MM-dd': 'datetime5'},
  'fr-fr': {'dd/MM/yyyy': 'datetime1', 'dd.MM.yy': 'datetime3'},
  'es-es': {'dd/MM/yyyy': 'datetime1', 'dd.MM.yy': 'datetime3'},
  'it-it': {'dd/MM/yyyy': 'datetime1'},
  'nl-nl': {'d-M-yyyy': 'datetime1', 'd/M/yy': 'datetime3'},
  'pt-br': {'dd/MM/yyyy': 'datetime1', 'dd.MM.yy': 'datetime3'},
  'pt-pt': {'dd/MM/yyyy': 'datetime1', 'dd.MM.yy': 'datetime3'},
  'ja-jp': {'yyyy年M月d日': 'datetime4'},
  'zh-cn': {'yyyy年M月d日': 'datetime2', 'yyyy年M月': 'datetime6'},
  'ko-kr': {'yyyy년 M월 d일': 'datetime4', 'yyyy년 M월': 'datetime6'},
});
/** The language of a date field no deck-language field can show: the language of OPF's English month and weekday names. */
export const FIELD_LANGUAGE = 'en-US';

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

/**
 * Live field ranges for one accepted furniture text part: core's `part.fields` (one `slideNumber` per substituted
 * `{{slide.number}}`, one `date` for a current date), as half-open UTF-16 offsets into `part.text`.
 */
export function furniturePartFields(part) {
  return Array.isArray(part.fields) ? part.fields : [];
}

/** True when a core text part carries at least one slide-number field. */
export const hasSlideNumberField = part => furniturePartFields(part).some(field => field.type === 'slideNumber');

/**
 * True when the whole text of a core text part is one slide-number field (`{{slide.number}}` and nothing else): the only shape
 * a native `sldNum` placeholder can carry. Words around the number (`Page 2 of 6`, `2 / 6`) make it an ordinary text box with the
 * field, because Keynote (and Google Slides) show only the number of a slide-number placeholder and drop the literal runs.
 */
export function isBareSlideNumber(part) {
  const fields = furniturePartFields(part);
  return fields.length === 1 && fields[0].type === 'slideNumber' && fields[0].start === 0 && fields[0].end === part.text?.length;
}

export const SLIDE_NUMBER_TOKEN ='{{slide.number}}';
// The slide-scoped tokens core substitutes per slide (core SLIDE_TOKEN_BODY): typed text that spells one must be
// escaped, or the next export would turn it into a live value.
const literalSlideToken = /\{\{(?=\s*(?:slide(?:\.[A-Za-z0-9_-]+){1,2}|deck\.slideCount)\s*(?:\|[^{}]*)?\}\})/g;
const slideTokenUsed = /\{\{\s*(?:slide\.|deck\.slideCount)/;
/** True when a string mentions a slide-scoped token (escaped or not). */
export const mentionsSlideToken = text => typeof text === 'string' && slideTokenUsed.test(text);
const anyToken = /(\\)?\{\{\s*([^{}|]*?)\s*(?:\|[^{}]*)?\}\}/g;
const builtinName = /^(?:speakers|(?:deck|speaker|organization|slide)(?:\.[A-Za-z0-9_-]+){1,2})$/;
/**
 * True when a zone text uses {{ }} and every unescaped token in it is a built-in variable (core's pattern: deck.*, speaker.*,
 * speakers, organization.*, slide.*, deck.slideCount). Such an authored text is stored in the furniture manifest because the deck-wide
 * pass resolves its built-ins before export; a text with a user variable ({{customer}}) is not: the filled deck is what round-trips.
 */
export function isBuiltinTemplate(text) {
  if (typeof text !== 'string' || !text.includes('{{')) return false;
  for (const match of text.matchAll(anyToken)) if (!match[1] && !builtinName.test(match[2])) return false;
  return true;
}
export const escapeSlideTokens = text => text.replace(literalSlideToken, '\\{{');
// A current native literal is never a template, including already displayed
// backslashes. Add one escape for each complete token using core's convention.
export const escapeLiteralTokens = text => text.replace(anyToken, token => token.replace('{{', '\\{{'));

/**
 * The zone `text` a native footer or header line stands for: every native slide-number field (`{type, text, start}`,
 * `start` an offset into `text`) becomes `{{slide.number}}`, and typed words that spell a slide-scoped token stay
 * literal. A field whose words are not at its recorded offset is left as the words it shows.
 */
export function slideNumberTemplate(text, nativeFields) {
  let cursor = 0, out = '';
  for (const field of [...nativeFields].filter(field => field.type === 'slidenum').sort((a, b) => a.start - b.start)) {
    if (!(field.start >= cursor) || text.slice(field.start, field.start + field.text.length) !== field.text) continue;
    out += escapeSlideTokens(text.slice(cursor, field.start)) + SLIDE_NUMBER_TOKEN;
    cursor = field.start + field.text.length;
  }
  return out + escapeSlideTokens(text.slice(cursor));
}

// The same pattern spelled two ways (`yyyy年M月` and `yyyy'年'M'月'`) has one key: its tokens, literal text merged.
function patternKey(pattern) {
  const list = tokens(pattern);
  if (!list) return null;
  let key = '', literal = '';
  for (const token of list) {
    if (token.text !== undefined) { literal += token.text; continue; }
    key += `${JSON.stringify(literal)}${token.letter}${token.width}`;
    literal = '';
  }
  return key + JSON.stringify(literal);
}
const dateTable = lang => LANGUAGE_DATE_FIELDS[String(lang ?? FIELD_LANGUAGE).toLowerCase()];
const typeIn = (table, pattern) => {
  const key = patternKey(pattern);
  return key === null ? undefined : Object.entries(table ?? {}).find(([candidate]) => patternKey(candidate) === key)?.[1];
};

/**
 * RR-102: the PowerPoint date field that shows `pattern` (an OPF dateFormat): `{type, lang}`, or null when no field does.
 * The deck's own language wins when one of its fields shows the pattern (Insert > Header & Footer then shows the deck's
 * language); otherwise an English (United States) field shows it, the language of the words OPF draws. A pattern no field
 * shows stays fixed text.
 */
export function nativeDateField(pattern = DEFAULT_DATE_FORMAT, deckLang = FIELD_LANGUAGE) {
  const own = typeIn(dateTable(deckLang), pattern);
  if (own) return {type: own, lang: deckLang};
  const english = typeIn(NATIVE_DATE_FIELDS, pattern);
  return english ? {type: english, lang: FIELD_LANGUAGE} : null;
}

/**
 * The OPF dateFormat a PowerPoint date field shows: its type read in its language (`lang`, en-US when absent). Undefined for a
 * time field, `datetimeFigureOut` and a language whose list is not known (its words then import as a literal date).
 */
export function dateFormatOfField(type, lang) {
  return Object.entries(dateTable(lang) ?? {}).find(([, candidate]) => candidate === type)?.[0];
}

/** Native <a:fld> type for a core field, or null when the value must stay fixed text. A date's language is `deckLang`'s or en-US. */
export function nativeFieldType(field, deckLang) {
  if (field.type === 'slideNumber') return 'slidenum';
  if (field.type === 'date') return nativeDateField(field.format ?? DEFAULT_DATE_FORMAT, deckLang)?.type ?? null;
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
        // RR-102: a date field in another language than the deck's carries it with an altLang, which the deck-language pass keeps.
        const own = field.lang ? properties.replace(/\slang="[^"]*"/, ` lang="${field.lang}" altLang="${FIELD_LANGUAGE}"`) : properties;
        body += `<a:fld id="${id}" type="${field.nativeType}">${own}<a:t>${escapeXml(record.text.slice(field.start, field.end))}</a:t></a:fld>`;
        cursor = field.end;
      }
      literal(record.text.slice(cursor));
      return shape.replace(run, body);
    });
    entries[path] = enc.encode(xml);
  }
  if (seen.size !== records.size) throw new Error('Missing generated furniture field shapes.');
}
