/**
 * Deterministic header/footer field formatting. Nothing here consults a clock,
 * the host locale or the host time zone: dates are calendar dates supplied by the
 * document or the host, and month/weekday names are fixed English names.
 */

/** A live field inside displayed furniture text, as half-open UTF-16 offsets into the part's `text`. */
export interface FurnitureField {
  type: 'slideNumber' | 'date';
  start: number;
  end: number;
  /** Resolved date pattern for a current (`date: true`) date. */
  format?: string;
}

/** PowerPoint's first Insert > Date and Time choice for en-US (`datetime1`). */
export const DEFAULT_FURNITURE_DATE_FORMAT = 'M/d/yyyy';
export const DEFAULT_SLIDE_NUMBER_FORMAT = '{current}';

const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const weekdays = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const tokenWidths: Record<string, number[]> = {y:[1,2,4],M:[1,2,3,4],d:[1,2],E:[1,2,3,4]};

export type DateToken = {kind:'literal';text:string}|{kind:'field';letter:'y'|'M'|'d'|'E';width:number};

/** Tokenize an LDML-style date pattern (`yyyy`, `yy`, `MMMM`, `MMM`, `MM`, `M`, `dd`, `d`, `EEEE`, `EEE`, quoted literals). */
export function parseFurnitureDateFormat(pattern: string): DateToken[] | string {
  if (!pattern) return 'dateFormat must not be empty.';
  const tokens: DateToken[] = [];
  const literal = (text: string) => { const last = tokens[tokens.length - 1]; if (last?.kind === 'literal') last.text += text; else tokens.push({kind:'literal',text}); };
  for (let index = 0; index < pattern.length;) {
    const character = pattern.charAt(index);
    if (character === "'") {
      if (pattern[index + 1] === "'") { literal("'"); index += 2; continue; }
      let end = index + 1, text = '';
      for (;;) {
        if (end >= pattern.length) return 'dateFormat has an unterminated quoted literal.';
        if (pattern[end] === "'") { if (pattern[end + 1] === "'") { text += "'"; end += 2; continue; } break; }
        text += pattern[end]; end++;
      }
      literal(text); index = end + 1; continue;
    }
    if (/[A-Za-z]/.test(character)) {
      let end = index;
      while (pattern[end] === character) end++;
      const width = end - index;
      if (!tokenWidths[character]?.includes(width)) return `dateFormat token '${pattern.slice(index, end)}' is not supported; use yyyy, yy, MMMM, MMM, MM, M, dd, d, EEEE or EEE, and quote literal letters.`;
      tokens.push({kind:'field',letter:character as 'y'|'M'|'d'|'E',width}); index = end; continue;
    }
    literal(character); index++;
  }
  return tokens;
}

/** Parse a strict ISO calendar date (YYYY-MM-DD). */
export function parseIsoDate(value: string): {year:number;month:number;day:number} | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const date = new Date(Date.UTC(2000, month - 1, day));
  date.setUTCFullYear(year);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return {year, month, day};
}

/** Format an ISO calendar date with an LDML-style pattern. Returns an error message when either input is unsupported. */
export function formatFurnitureDate(iso: string, pattern: string): {text: string} | {error: string} {
  const date = parseIsoDate(iso);
  if (!date) return {error: `'${iso}' is not an ISO YYYY-MM-DD calendar date.`};
  const tokens = parseFurnitureDateFormat(pattern);
  if (typeof tokens === 'string') return {error: tokens};
  const utc = new Date(Date.UTC(2000, date.month - 1, date.day)); utc.setUTCFullYear(date.year);
  const pad = (value: number, width: number) => String(value).padStart(width, '0');
  let text = '';
  for (const token of tokens) {
    if (token.kind === 'literal') { text += token.text; continue; }
    const {letter, width} = token;
    if (letter === 'y') text += width === 2 ? pad(date.year % 100, 2) : width === 4 ? pad(date.year, 4) : String(date.year);
    else if (letter === 'M') { const name = months[date.month - 1] ?? ''; text += width >= 3 ? (width === 4 ? name : name.slice(0, 3)) : pad(date.month, width); }
    else if (letter === 'd') text += pad(date.day, width);
    else { const name = weekdays[utc.getUTCDay()] ?? ''; text += width === 4 ? name : name.slice(0, 3); }
  }
  return {text};
}

/** Resolve a slide-number template. `{current}` becomes a live field; `{total}` is fixed text. */
export function formatSlideNumber(format: string, current: number, total: number | undefined): {text: string; fields: FurnitureField[]} | {error: string} {
  if (!format.includes('{current}')) return {error: 'slideNumberFormat must contain {current}.'};
  if (format.includes('{total}') && total === undefined) return {error: 'slideNumberFormat uses {total}, which needs the rendered slide count.'};
  let text = '';
  const fields: FurnitureField[] = [];
  for (const piece of format.split(/(\{current\}|\{total\})/)) {
    if (piece === '{current}') { const value = String(current); fields.push({type:'slideNumber',start:text.length,end:text.length + value.length}); text += value; }
    else if (piece === '{total}') text += String(total);
    else text += piece;
  }
  return {text, fields};
}
