/** UTF-16 ranges match DOM Selection; boundaries must be whole graphemes. */
export function richTextContent(value) {
  return runs(value).map(run => typeof run === 'string' ? run : run.text).join('');
}
function runs(value) {
  const result = typeof value === 'string' ? [value] : value;
  if (!Array.isArray(result) || result.some(run => typeof run !== 'string' && (!run || typeof run !== 'object' || typeof run.text !== 'string')))
    throw new TypeError('Expected a string or OPF text runs.');
  return result;
}
function range(value, start, end, allowEmpty) {
  const text = richTextContent(value);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end > text.length || (!allowEmpty && start === end))
    throw new RangeError('Select a nonempty text range within the content.');
  const boundaries = new Set([0, text.length]);
  for (const part of new Intl.Segmenter(undefined, {granularity:'grapheme'}).segment(text)) boundaries.add(part.index);
  if (!boundaries.has(start) || !boundaries.has(end)) throw new RangeError('Text ranges must end at whole grapheme boundaries.');
  return runs(value);
}
const booleans = ['bold','italic','underline','strikethrough','superscript','subscript'];
const strings = ['color','fontFamily','link'];
function checkedFormat(format) {
  if (!format || typeof format !== 'object' || Array.isArray(format)) throw new TypeError('Expected a run formatting object.');
  for (const [key,value] of Object.entries(format)) {
    if (![...booleans,...strings,'fontSize'].includes(key)) throw new TypeError(`Unknown run style: ${key}`);
    if (value === null) continue;
    if (booleans.includes(key) && typeof value !== 'boolean' || strings.includes(key) && typeof value !== 'string' || key === 'fontSize' && (!Number.isFinite(value) || value <= 0))
      throw new TypeError(`Invalid run style: ${key}`);
  }
  if (format.superscript && format.subscript) throw new TypeError('Choose superscript or subscript, not both.');
  return {...format, ...(format.superscript ? {subscript:false} : {}), ...(format.subscript ? {superscript:false} : {})};
}
function piece(run, text) { return typeof run === 'string' ? text : {...structuredClone(run),text}; }
export function formatRichTextRange(value, start, end, format) {
  const source = range(value,start,end,false), patch = checkedFormat(format), result = [];
  let offset = 0;
  for (const run of source) {
    const text = typeof run === 'string' ? run : run.text, next = offset + text.length;
    if (next <= start || offset >= end || !text.length) result.push(structuredClone(run));
    else {
      const a = Math.max(0,start-offset), b = Math.min(text.length,end-offset);
      if (a) result.push(piece(run,text.slice(0,a)));
      const changed = typeof run === 'string' ? {text:text.slice(a,b)} : piece(run,text.slice(a,b));
      for (const [key,value] of Object.entries(patch)) { if (value === null) delete changed[key]; else changed[key] = value; }
      result.push(changed);
      if (b < text.length) result.push(piece(run,text.slice(b)));
    }
    offset = next;
  }
  return result;
}
/** Replacement inherits the first selected run (the preceding run for insertion). */
export function replaceRichTextRange(value, start, end, replacement) {
  const source = range(value,start,end,true);
  if (typeof replacement !== 'string') throw new TypeError('Replacement text must be a string.');
  const result = []; let offset = 0, inserted = false;
  for (const run of source) {
    const text = typeof run === 'string' ? run : run.text, next = offset + text.length;
    const insertion = start === end && start >= offset && start <= next;
    if (!inserted && (insertion || next > start && offset < end)) {
      if (start > offset) result.push(piece(run,text.slice(0,start-offset)));
      if (replacement) result.push(piece(run,replacement));
      inserted = true;
      if (end < next) result.push(piece(run,text.slice(Math.max(0,end-offset))));
    } else if (next <= start || offset >= end) result.push(structuredClone(run));
    else if (end < next) result.push(piece(run,text.slice(end-offset)));
    offset = next;
  }
  if (!inserted && replacement) result.push(replacement);
  return result.length ? result : [''];
}
