// FA-09, FA-27: the text alternative of a chart (`Chart.alt`) or a table (`Table.alt`) is its graphic frame's
// `p:nvGraphicFramePr/p:cNvPr/@descr`, the attribute a picture's alt text uses. An empty `alt` marks the frame decorative, which PowerPoint stores as the `adec:decorative` extension of
// the same `p:cNvPr` ("Mark as decorative"), not as an empty `descr`: PowerPoint writes `descr=""` for any shape without alt text.
const DECORATIVE_URI = '{C183D7F6-B498-43B3-948B-1728B52AA6E4}';
const DECORATIVE_NS = 'http://schemas.microsoft.com/office/drawing/2017/decorative';
const ESCAPES = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;', '\r': '&#13;', '\n': '&#10;', '\t': '&#9;'};
const escape = value => value.replace(/[&<>"'\r\n\t]/g, char => ESCAPES[char]);
const decorativeExt = `<a:ext uri="${DECORATIVE_URI}"><adec:decorative xmlns:adec="${DECORATIVE_NS}" val="1"/></a:ext>`;
const decorativeExtPattern = new RegExp(`<a:ext\\b[^>]*\\buri="${DECORATIVE_URI.replace(/[{}]/g, '\\$&')}"[^>]*>[\\s\\S]*?</a:ext>`, 'g');

// The one a:extLst of a p:cNvPr is edited in place: PowerPoint's own extensions (a16:creationId and others) stay untouched and in
// order, an earlier decorative ext is replaced and never duplicated, and an extLst left with no ext is removed.
function withDecorative(body, decorative) {
  const list = body.match(/<a:extLst(?:\s[^>]*)?(?:\/>|>[\s\S]*?<\/a:extLst>)/);
  const inner = list ? list[0].replace(/^<a:extLst(?:\s[^>]*)?>|<\/a:extLst>$|^<a:extLst(?:\s[^>]*)?\/>$/g, '').replace(decorativeExtPattern, '') : '';
  const exts = decorative ? inner + decorativeExt : inner;
  const next = exts.trim() === '' ? '' : `<a:extLst>${exts}</a:extLst>`;
  return list ? body.slice(0, list.index) + next + body.slice(list.index + list[0].length) : body + next;
}

/** Write `alt` on the first `p:cNvPr` of a graphic frame: `descr` for text, the decorative extension for the empty string. */
export function writeFrameAlt(frame, alt) {
  const start = frame.match(/<p:cNvPr\b[^>]*?(\/?)>/);
  if (!start) return frame;
  const selfClosing = start[1] === '/';
  const end = selfClosing ? start.index + start[0].length : frame.indexOf('</p:cNvPr>', start.index);
  if (end < 0) return frame;
  let tag = start[0].replace(/\sdescr="[^"]*"/, '');
  const body = withDecorative(selfClosing ? '' : frame.slice(start.index + start[0].length, end), alt === '');
  if (alt !== '') tag = tag.replace(/\s*\/?>$/, match => ` descr="${escape(alt)}"${match.trim()}`);
  const tail = selfClosing ? start.index + start[0].length : end + '</p:cNvPr>'.length;
  const open = selfClosing && body ? tag.replace(/\s*\/>$/, '>') : tag;
  const close = !selfClosing || body ? '</p:cNvPr>' : '';
  return `${frame.slice(0, start.index)}${open}${body}${close}${frame.slice(tail)}`;
}

/** Apply every recorded chart and table alt to the frames (classic and chartex fallback charts, tables) of a slide part's XML, matched by frame name. */
export function applyFrameAlt(xml, alts) {
  return xml.replace(/<p:graphicFrame>[\s\S]*?<\/p:graphicFrame>/g, frame => {
    const name = frame.match(/<p:cNvPr\b[^>]*\bname="([^"]+)"/)?.[1];
    return alts.has(name) ? writeFrameAlt(frame, alts.get(name)) : frame;
  });
}

const list = value => (Array.isArray(value) ? value : value === undefined || value === null ? [] : [value]);

/** The alt of a parsed `p:cNvPr`: its `descr`, `""` when marked decorative, or undefined. */
export function readFrameAlt(cNvPr) {
  if (!cNvPr || typeof cNvPr !== 'object') return undefined;
  const descr = cNvPr.descr;
  if (typeof descr === 'string' && descr.trim() !== '') return descr;
  const decorative = list(list(cNvPr['a:extLst'])[0]?.['a:ext']).some(ext => list(ext?.['adec:decorative']).some(node => node?.val === '1' || node?.val === 'true'));
  return decorative ? '' : undefined;
}
