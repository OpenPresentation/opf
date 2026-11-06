// SH-02: shape blocks as native PowerPoint shapes, and the stroke (a:ln) of shapes and pictures.
//
// A shape block (core ComposedItem.shape) is one native p:sp named `OPF shape <path>`: core's frame as a:xfrm (rot, flipH, flipV),
// the preset as a:prstGeom with its a:avLst (core's adjust values in DrawingML units), or a custom path as a:custGeom; the fill
// (a:noFill, a:solidFill, a:gradFill with a:lin or a:path, a:pattFill), the line (a:ln with every stroke property), the effects
// (SH-03's drawEffects; an empty a:effectLst until then, so the theme's effect style adds nothing the preview does not draw) and a
// p:style with the theme references of the shape's style, so PowerPoint shows the style as applied. The text is the shape's own
// p:txBody: core's fitted size and font, centered, at core's anchor (a:bodyPr anchor), insets (lIns, tIns, rIns, bIns) and direction
// (vert), wrapped by PowerPoint in the same text rectangle, and never autofit. Alt text is p:cNvPr descr, decorative the adec extension,
// hidden p:cNvPr hidden and the click link a:hlinkClick (PptxGenJS writes its relationship).
//
// PptxGenJS writes the shape with its runs (escaping, languages and run links stay its job); writeShapeBlocks then replaces its
// p:spPr, a:bodyPr and p:cNvPr in the finished slide part, before RR-96 turns the literal scheme colors into a:schemeClr (with
// a:lumMod and a:lumOff for the lighter and darker colors, theme-colors.js addTransformedColors).
import { writeFrameAlt } from './frame-alt.js';

const EMU_PER_PX = 9525;
const emu = value => Math.round(value * EMU_PER_PX);
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]));

/** OPF dash names to DrawingML a:prstDash values. */
export const PRESET_DASH_VALUES = Object.freeze({ solid: 'solid', dot: 'dot', dash: 'dash', longDash: 'lgDash', dashDot: 'dashDot', longDashDot: 'lgDashDot', longDashDotDot: 'lgDashDotDot', sysDot: 'sysDot', sysDash: 'sysDash', sysDashDot: 'sysDashDot', sysDashDotDot: 'sysDashDotDot' });
const CAPS = { flat: 'flat', round: 'rnd', square: 'sq' };
const COMPOUNDS = { single: 'sng', double: 'dbl', thickThin: 'thickThin', thinThick: 'thinThick', triple: 'tri' };
const HEAD_SIZES = { small: 'sm', medium: 'med', large: 'lg' };
const SKETCH = { curved: 'lineSketchCurved', freehand: 'lineSketchFreehand', scribble: 'lineSketchScribble' };
const SKETCH_URI = '{C807C97D-BFC1-408E-A445-0C87EB9F89A2}';
const SKETCH_NS = 'http://schemas.microsoft.com/office/drawing/2018/sketchyshapes';

/**
 * A DrawingML color element for a ColorRef: `paint(ref, fallback)` gives `{hex, alpha, scheme}` (RRGGBB, 0..1 and the slide's scheme
 * value where the reference names one) from the exporter's resolution; `alpha` multiplies in (a fill's opacity). Otherwise a literal,
 * which RR-96 rewrites where it is a scheme color.
 */
export function colorXml(ref, paint, fallback, alpha = 1) {
  const { hex, alpha: own, scheme } = paint(ref, fallback);
  const value = Math.round(own * alpha * 100000), transparency = value < 100000 ? `<a:alpha val="${value}"/>` : '';
  return scheme ? `<a:schemeClr val="${scheme}">${transparency}</a:schemeClr>` : `<a:srgbClr val="${hex}">${transparency}</a:srgbClr>`;
}

/** a:gradFill for a core ComposedGradient: a:lin at its angle (unscaled), or a:path circle, rect or shape from the center. */
export function gradientXml(gradient, paint, alpha = 1) {
  const stops = gradient.stops.map(stop => `<a:gs pos="${Math.round(stop.position * 100000)}">${colorXml(stop.color, paint, '000000', alpha)}</a:gs>`).join('');
  const shade = gradient.type === 'linear'
    ? `<a:lin ang="${Math.round((((gradient.angle % 360) + 360) % 360) * 60000)}" scaled="0"/>`
    : `<a:path path="${gradient.type === 'radial' ? 'circle' : gradient.type === 'rectangle' ? 'rect' : 'shape'}"><a:fillToRect l="50000" t="50000" r="50000" b="50000"/></a:path>`;
  return `<a:gradFill rotWithShape="1"><a:gsLst>${stops}</a:gsLst>${shade}</a:gradFill>`;
}

/** The fill of a shape (core ComposedFill). */
export function fillXml(fill, paint, context) {
  if (!fill || fill.type === 'none') return '<a:noFill/>';
  const alpha = fill.opacity ?? 1;
  if (fill.type === 'solid') return `<a:solidFill>${colorXml(fill.color, paint, context.primary, alpha)}</a:solidFill>`;
  if (fill.type === 'gradient') return gradientXml(fill.gradient, paint, alpha);
  return `<a:pattFill prst="${escape(fill.preset === 'diagStripe' ? 'wdUpDiag' : fill.preset)}"><a:fgClr>${colorXml(fill.foreground ?? 'accent1', paint, context.primary, alpha)}</a:fgClr><a:bgClr>${colorXml(fill.background ?? 'background', paint, context.background, alpha)}</a:bgClr></a:pattFill>`;
}

/**
 * a:ln for a core ComposedStroke (shapes and pictures): width, cap, compound and alignment, the solid or gradient line, the preset or
 * custom dash, the join, the arrowheads and the sketch style. `geometry` is the shape's own a:prstGeom or a:custGeom, which the sketch
 * extension repeats. Undefined stroke: no line.
 */
export function lineXml(stroke, paint, context, geometry = '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>') {
  if (!stroke) return '<a:ln><a:noFill/></a:ln>';
  const fill = stroke.gradient ? gradientXml(stroke.gradient, paint) : `<a:solidFill>${colorXml(stroke.color ?? 'border', paint, context.border)}</a:solidFill>`;
  const dash = Array.isArray(stroke.dash)
    ? `<a:custDash>${pairs(stroke.dash).map(([d, sp]) => `<a:ds d="${Math.round(d * 100000)}" sp="${Math.round(sp * 100000)}"/>`).join('')}</a:custDash>`
    : `<a:prstDash val="${PRESET_DASH_VALUES[stroke.dash] ?? 'solid'}"/>`;
  const join = stroke.join === 'round' ? '<a:round/>' : stroke.join === 'bevel' ? '<a:bevel/>' : `<a:miter lim="${Math.round(stroke.miterLimit * 100000)}"/>`;
  const head = (name, value) => value ? `<a:${name} type="${value.type}" w="${HEAD_SIZES[value.width]}" len="${HEAD_SIZES[value.length]}"/>` : '';
  const sketch = stroke.sketch ? `<a:extLst><a:ext uri="${SKETCH_URI}"><ask:lineSketchStyleProps xmlns:ask="${SKETCH_NS}" sd="${sketchSeed(geometry)}">${geometry}<ask:type><ask:${SKETCH[stroke.sketch]}/></ask:type></ask:lineSketchStyleProps></a:ext></a:extLst>` : '';
  return `<a:ln w="${emu(stroke.width)}" cap="${CAPS[stroke.cap] ?? 'flat'}" cmpd="${COMPOUNDS[stroke.compound] ?? 'sng'}" algn="${stroke.align === 'inside' ? 'in' : 'ctr'}">${fill}${dash}${join}${head('headEnd', stroke.start)}${head('tailEnd', stroke.end)}${sketch}</a:ln>`;
}
// An odd custom dash repeats, as SVG's dasharray does.
const pairs = values => {
  const list = values.length % 2 ? [...values, ...values] : values;
  return list.flatMap((value, index) => index % 2 ? [] : [[value, list[index + 1]]]);
};
// PowerPoint seeds the sketch's randomness; a fixed seed from the geometry keeps the file stable.
const sketchSeed = text => { let hash = 2166136261; for (const char of text) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0; return hash % 2147483647; };

/** a:prstGeom with core's DrawingML adjust values, or a:custGeom of a custom path (core's paths, frame-relative, in EMU). */
export function geometryXml(shape) {
  if (shape.preset) {
    const gd = Object.entries(shape.avLst ?? {}).map(([name, value]) => `<a:gd name="${name}" fmla="val ${value}"/>`).join('');
    return `<a:prstGeom prst="${shape.preset}">${gd ? `<a:avLst>${gd}</a:avLst>` : '<a:avLst/>'}</a:prstGeom>`;
  }
  const { x, y, width, height } = shape.box;
  const point = (px, py) => `<a:pt x="${emu(px - x)}" y="${emu(py - y)}"/>`;
  const paths = shape.paths.map(path => {
    const tokens = path.d.match(/[MLCQAZ]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) ?? [];
    let xml = '', at = 0, command = '', current = [0, 0];
    const read = () => Number(tokens[at++]);
    while (at < tokens.length) {
      if (/^[A-Za-z]$/.test(tokens[at])) command = tokens[at++].toUpperCase();
      if (command === 'Z') { xml += '<a:close/>'; continue; }
      if (command === 'M') { current = [read(), read()]; xml += `<a:moveTo>${point(...current)}</a:moveTo>`; command = 'L'; continue; }
      if (command === 'L') { current = [read(), read()]; xml += `<a:lnTo>${point(...current)}</a:lnTo>`; continue; }
      if (command === 'C') { const c = [read(), read(), read(), read(), read(), read()]; current = [c[4], c[5]]; xml += `<a:cubicBezTo>${point(c[0], c[1])}${point(c[2], c[3])}${point(c[4], c[5])}</a:cubicBezTo>`; continue; }
      if (command === 'Q') { const c = [read(), read(), read(), read()]; current = [c[2], c[3]]; xml += `<a:quadBezTo>${point(c[0], c[1])}${point(c[2], c[3])}</a:quadBezTo>`; continue; }
      if (command === 'A') { const [rx, ry, , large, sweep, ex, ey] = [read(), read(), read(), read(), read(), read(), read()]; xml += arcXml(current, rx, ry, large, sweep, [ex, ey], point); current = [ex, ey]; continue; }
      at++;
    }
    const fill = path.fill === 'norm' ? '' : ` fill="${path.fill}"`;
    return `<a:path w="${emu(width)}" h="${emu(height)}"${fill}${path.stroke ? '' : ' stroke="0"'}>${xml}</a:path>`;
  }).join('');
  return `<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="l" t="t" r="r" b="b"/><a:pathLst>${paths}</a:pathLst></a:custGeom>`;
}

// An SVG elliptical arc (axis-aligned, as core's custom paths are) as cubic Béziers.
function arcXml([x1, y1], rx, ry, large, sweep, [x2, y2], point) {
  if (!rx || !ry) return `<a:lnTo>${point(x2, y2)}</a:lnTo>`;
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  let lambda = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
  if (lambda > 1) { rx *= Math.sqrt(lambda); ry *= Math.sqrt(lambda); lambda = 1; }
  const sign = large === sweep ? -1 : 1, factor = sign * Math.sqrt(Math.max(0, (rx * rx * ry * ry - rx * rx * dy * dy - ry * ry * dx * dx) / (rx * rx * dy * dy + ry * ry * dx * dx)));
  const cx = factor * rx * dy / ry + (x1 + x2) / 2, cy = -factor * ry * dx / rx + (y1 + y2) / 2;
  const angle = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const start = angle(1, 0, (x1 - cx) / rx, (y1 - cy) / ry);
  let sweepAngle = angle((x1 - cx) / rx, (y1 - cy) / ry, (x2 - cx) / rx, (y2 - cy) / ry);
  if (!sweep && sweepAngle > 0) sweepAngle -= 2 * Math.PI; else if (sweep && sweepAngle < 0) sweepAngle += 2 * Math.PI;
  const segments = Math.ceil(Math.abs(sweepAngle) / (Math.PI / 2)), step = sweepAngle / segments, k = 4 / 3 * Math.tan(step / 4);
  let xml = '';
  for (let index = 0; index < segments; index++) {
    const a = start + index * step, b = a + step;
    const p1 = [cx + rx * (Math.cos(a) - k * Math.sin(a)), cy + ry * (Math.sin(a) + k * Math.cos(a))];
    const p2 = [cx + rx * (Math.cos(b) + k * Math.sin(b)), cy + ry * (Math.sin(b) - k * Math.cos(b))];
    xml += `<a:cubicBezTo>${point(...p1)}${point(...p2)}${point(cx + rx * Math.cos(b), cy + ry * Math.sin(b))}</a:cubicBezTo>`;
  }
  return xml;
}

/** SH-03 writes a shape's effects here (a:effectLst). On SH-02's branch it writes none: an empty list keeps the theme's effect style off. */
export function drawEffects(_shape, _paint) {
  return '';
}

/** The p:style of a shape's theme style (core ShapeStyleLook ref); empty for style none. */
export function styleXml(ref, paint, context) {
  if (!ref) return '';
  const color = value => colorXml(value, paint, context.primary);
  return `<p:style><a:lnRef idx="${ref.line.idx}">${color(ref.line.color)}</a:lnRef><a:fillRef idx="${ref.fill.idx}">${color(ref.fill.color)}</a:fillRef><a:effectRef idx="${ref.effect.idx}">${color(ref.effect.color)}</a:effectRef><a:fontRef idx="${ref.font.idx}">${color(ref.font.color)}</a:fontRef></p:style>`;
}

/** The finished parts of a shape: p:spPr, p:style and a:bodyPr, recorded by name for writeShapeBlocks. */
export function shapeBlockRecord(shape, paint, context) {
  const geometry = geometryXml(shape), box = shape.box;
  const xfrm = `<a:xfrm${shape.rotate ? ` rot="${Math.round(shape.rotate * 60000)}"` : ''}${shape.flipH ? ' flipH="1"' : ''}${shape.flipV ? ' flipV="1"' : ''}><a:off x="${emu(box.x)}" y="${emu(box.y)}"/><a:ext cx="${emu(box.width)}" cy="${emu(box.height)}"/></a:xfrm>`;
  const effects = drawEffects(shape, paint) || '<a:effectLst/>';
  const spPr = `<p:spPr>${xfrm}${geometry}${fillXml(shape.fill, paint, context)}${lineXml(shape.stroke, paint, context, geometry)}${effects}</p:spPr>`;
  const insets = shape.textRect && shape.padding ? shape.padding : { left: 0, top: 0, right: 0, bottom: 0 };
  const vert = { horizontal: 'horz', vertical: 'vert', vertical270: 'vert270', stacked: 'wordArtVert' }[shape.textDirection] ?? 'horz';
  const anchor = { top: 't', middle: 'ctr', bottom: 'b' }[shape.anchor] ?? 'ctr';
  const bodyPr = `<a:bodyPr rot="0" spcFirstLastPara="0" vertOverflow="overflow" horzOverflow="overflow" vert="${vert}" wrap="square" lIns="${emu(insets.left)}" tIns="${emu(insets.top)}" rIns="${emu(insets.right)}" bIns="${emu(insets.bottom)}" numCol="1" spcCol="0" rtlCol="0" fromWordArt="0" anchor="${anchor}" anchorCtr="0" forceAA="0" compatLnSpc="1"><a:prstTxWarp prst="textNoShape"><a:avLst/></a:prstTxWarp><a:noAutofit/></a:bodyPr>`;
  return { spPr, style: styleXml(shape.styleRef, paint, context), bodyPr, alt: shape.alt, decorative: shape.decorative === true, hidden: shape.hidden === true };
}

const HYPERLINK = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink';
/**
 * Give every recorded shape block with a `link` its click link: an external hyperlink relationship in its slide's rels part and
 * a:hlinkClick in its p:cNvPr (PptxGenJS links a text shape's runs, not the shape). `entries` is the package (part name to bytes).
 */
export function linkShapeBlocks(entries, records, {decode, encode}) {
  const linked = [...(records?.entries() ?? [])].filter(([, record]) => record.link);
  if (!linked.length) return;
  const byName = new Map(linked);
  for (const part of Object.keys(entries).filter(path => /^ppt\/slides\/slide\d+\.xml$/.test(path))) {
    let xml = decode(entries[part]);
    if (!linked.some(([name]) => xml.includes(`name="${escape(name)}"`))) continue;
    const relsPath = part.replace(/^ppt\/slides\//, 'ppt/slides/_rels/') + '.rels';
    let rels = entries[relsPath] ? decode(entries[relsPath]) : '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
    const taken = new Set([...rels.matchAll(/\bId="([^"]+)"/g)].map(match => match[1]));
    xml = xml.replace(/<p:cNvPr\b([^>]*?\bname="([^"]+)"[^>]*?)(\/?)>/g, (match, attributes, name, close) => {
      const record = byName.get(name.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'));
      if (!record) return match;
      let n = 1, rid;
      do rid = `rId${n++}`; while (taken.has(rid));
      taken.add(rid);
      rels = rels.replace('</Relationships>', `<Relationship Id="${rid}" Type="${HYPERLINK}" Target="${escape(record.link)}" TargetMode="External"/></Relationships>`);
      const link = `<a:hlinkClick r:id="${rid}"/>`;
      return close ? `<p:cNvPr${attributes}>${link}</p:cNvPr>` : `<p:cNvPr${attributes}>${link}`;
    });
    entries[part] = encode(xml);
    entries[relsPath] = encode(rels);
  }
}

/** Replace the parts PptxGenJS wrote for every recorded shape block (`records`: Map of object name to shapeBlockRecord) in a slide part. */
export function writeShapeBlocks(xml, records) {
  if (!records?.size) return xml;
  return xml.replace(/<p:sp>[\s\S]*?<\/p:sp>/g, shape => {
    const name = shape.match(/<p:cNvPr\b[^>]*\bname="([^"]+)"/)?.[1];
    const record = name !== undefined && records.get(name.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'));
    if (!record) return shape;
    let next = shape.replace(/<p:spPr\b[^>]*\/>|<p:spPr\b[^>]*>[\s\S]*?<\/p:spPr>/, () => record.spPr);
    next = next.replace(/<p:style>[\s\S]*?<\/p:style>/, '');
    if (record.style) next = next.replace('</p:spPr>', () => `</p:spPr>${record.style}`);
    next = next.replace(/<a:bodyPr\b[^>]*\/>|<a:bodyPr\b[^>]*>[\s\S]*?<\/a:bodyPr>/, () => record.bodyPr);
    // No text: an empty body keeps the shape's text editable in PowerPoint at its anchor and insets.
    if (!/<p:txBody>/.test(next)) next = next.replace(/<\/p:sp>$/, () => `<p:txBody>${record.bodyPr}<a:lstStyle/><a:p><a:endParaRPr lang="en-US" dirty="0"/></a:p></p:txBody></p:sp>`);
    // A shape is a shape, not a text box: PptxGenJS marks text frames txBox="1".
    next = next.replace(/<p:cNvSpPr txBox="1"/, '<p:cNvSpPr');
    if (record.hidden) next = next.replace(/<p:cNvPr\b([^>]*?)(\/?)>/, (match, attributes, close) => /\bhidden=/.test(attributes) ? match : `<p:cNvPr${attributes} hidden="1"${close}>`);
    if (record.decorative) next = writeFrameAlt(next, '');
    else if (record.alt !== undefined && record.alt !== '') next = writeFrameAlt(next, record.alt);
    return next;
  });
}
