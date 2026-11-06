// SH-04: connectors of a slide's overlay (core ComposedConnector) as native PowerPoint connectors.
//
// A connector is one p:cxnSp named `OPF connector <path>` (slides.N.shapes.I): core's frame as a:xfrm (a:off, a:ext, rot, flipH, flipV),
// PowerPoint's own connector preset (straightConnector1, bentConnector2/3, curvedConnector2/3) as a:prstGeom with core's a:avLst, and
// the line as a shape's (shape-blocks.js lineXml: color, width, dash, compound, arrowheads and the sketch). Each end is glued to the
// native shape it attaches to (a:stCxn, a:endCxn: the shape's p:cNvPr id and core's connection site index), so the connector follows
// the shape when it is moved in PowerPoint. A shape glues when one native shape is the block's frame: a shape block or overlay shape
// (`OPF shape <path>`), a picture, or a block's card (`OPF card <path>`). A text block without a card is drawn as one text box per line,
// so its end is not glued (the connector still runs to the block's site).
//
// PptxGenJS cannot write a p:cxnSp: the exporter adds a placeholder line shape with the connector's name, and writeConnectors replaces it
// in the finished slide part, where the ids of the shapes at its ends are known.
import { lineXml } from './shape-blocks.js';
import { writeFrameAlt } from './frame-alt.js';

const EMU_PER_PX = 9525;
const emu = value => Math.round(value * EMU_PER_PX);
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]));
const unescape = value => value.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/** The native name of a connector. */
export const connectorName = path => `OPF connector ${path}`;

/** A point of the slide in the connector frame's own coordinates (core frameToSlide inverted: unrotate, then unflip). */
function toFrame(connector, x, y) {
  const { box } = connector, radians = -(connector.rotate ?? 0) * Math.PI / 180, cos = Math.cos(radians), sin = Math.sin(radians);
  const dx = x - box.x - box.width / 2, dy = y - box.y - box.height / 2;
  let u = dx * cos - dy * sin, v = dx * sin + dy * cos;
  if (connector.flipH) u = -u;
  if (connector.flipV) v = -v;
  return [u + box.width / 2, v + box.height / 2];
}
// SVG path data (absolute M, L, C, Q, Z, as core writes a sketch) in the frame's coordinates.
function pathToFrame(connector, d) {
  const tokens = d.match(/[MLCQZ]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) ?? [];
  const out = [];
  for (let at = 0; at < tokens.length;) {
    if (/^[A-Za-z]$/.test(tokens[at])) { out.push(tokens[at++].toUpperCase()); continue; }
    const [x, y] = toFrame(connector, Number(tokens[at]), Number(tokens[at + 1]));
    out.push(String(Math.round(x * 1000) / 1000), String(Math.round(y * 1000) / 1000));
    at += 2;
  }
  return out.join(' ');
}

/**
 * What writeConnectors needs of one connector: its frame and preset XML, its line, its accessibility and the native names of the
 * shapes its ends glue to (`from.name`, `to.name`: undefined for an end that does not glue) with core's site indexes.
 */
export function connectorRecord(connector, paint, palette, ends) {
  const { box } = connector;
  const xfrm = `<a:xfrm${connector.rotate ? ` rot="${Math.round(connector.rotate * 60000)}"` : ''}${connector.flipH ? ' flipH="1"' : ''}${connector.flipV ? ' flipV="1"' : ''}><a:off x="${emu(box.x)}" y="${emu(box.y)}"/><a:ext cx="${emu(box.width)}" cy="${emu(box.height)}"/></a:xfrm>`;
  const gd = Object.entries(connector.avLst ?? {}).map(([name, value]) => `<a:gd name="${name}" fmla="val ${value}"/>`).join('');
  const geometry = `<a:prstGeom prst="${connector.preset}">${gd ? `<a:avLst>${gd}</a:avLst>` : '<a:avLst/>'}</a:prstGeom>`;
  // A sketched line's a:custGeom is in the frame's own coordinates (before its flips and rotation), as a shape's is in its frame.
  const sketched = connector.stroke?.sketched;
  const stroke = sketched ? { ...connector.stroke, sketched: { ...sketched, lines: sketched.lines.map(line => line && pathToFrame(connector, line)), fills: sketched.fills.map(() => null) } } : connector.stroke;
  const frame = { x: 0, y: 0, width: box.width, height: box.height };
  const paths = sketched ? [{ d: '', fill: 'none', stroke: true }] : undefined;
  const ln = lineXml(stroke, paint, palette, frame, paths);
  return { xfrm, geometry, ln, from: ends.from, to: ends.to, alt: connector.alt, decorative: connector.decorative === true, hidden: connector.hidden === true };
}

/**
 * Replace the placeholder of every recorded connector (`records`: Map of connector name to connectorRecord) in a slide part by its
 * p:cxnSp, glued (a:stCxn, a:endCxn) to the shapes of the part that its ends name.
 */
export function writeConnectors(xml, records) {
  if (!records?.size || !xml.includes('OPF connector ')) return xml;
  const ids = new Map();
  for (const match of xml.matchAll(/<p:cNvPr\b[^>]*?\bid="(\d+)"[^>]*?\bname="([^"]*)"/g)) ids.set(unescape(match[2]), match[1]);
  return xml.replace(/<p:sp>[\s\S]*?<\/p:sp>/g, shape => {
    const named = shape.match(/<p:cNvPr\b[^>]*?\bid="(\d+)"[^>]*?\bname="([^"]+)"/);
    const record = named && records.get(unescape(named[2]));
    if (!record) return shape;
    const glue = (tag, end) => { const id = end?.name !== undefined ? ids.get(end.name) : undefined; return id ? `<a:${tag} id="${id}" idx="${end.site}"/>` : ''; };
    let cNvPr = `<p:cNvPr id="${named[1]}" name="${escape(unescape(named[2]))}"${record.hidden ? ' hidden="1"' : ''}/>`;
    if (record.decorative) cNvPr = writeFrameAlt(cNvPr, '');
    else if (record.alt !== undefined && record.alt !== '') cNvPr = writeFrameAlt(cNvPr, record.alt);
    return `<p:cxnSp><p:nvCxnSpPr>${cNvPr}<p:cNvCxnSpPr>${glue('stCxn', record.from)}${glue('endCxn', record.to)}</p:cNvCxnSpPr><p:nvPr/></p:nvCxnSpPr><p:spPr>${record.xfrm}${record.geometry}<a:noFill/>${record.ln}</p:spPr></p:cxnSp>`;
  });
}
