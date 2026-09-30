// Shape placement of an exported slide part, for the layout check (FF-51).
//
// The preview check compares the whole SVG with and without the layout, so a
// layout that only changes where text sits inside its box (the gallery's
// *-title-center, *-center and number-* layouts: text-anchor="middle" in the
// same <text> box) counts as a preview effect. The export check must see the
// same property: a paragraph's algn inside the same a:off/a:ext box is the
// native form of that anchor. A signature of the boxes alone reported those
// layouts as "export shape placement ignores layout" although the PPTX carried
// algn="ctr" in byte-identical boxes.
const unescape = (text) => String(text).replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/** a:off/a:ext of every shape, in document order (the pre-FF-51 signature). */
export const geometry = (xml) => [...xml.matchAll(/<a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"/g)].map((m) => m.slice(1).join(',')).join(';');

/**
 * Placement signature: every shape's box plus, for text shapes, the body
 * anchor and each paragraph's horizontal alignment. Two exports with the same
 * signature place every shape and every paragraph identically.
 */
export function placementSignature(xml) {
  const shapes = [...xml.matchAll(/<p:(sp|pic|graphicFrame|grpSp|cxnSp)>([\s\S]*?)<\/p:\1>/g)];
  if (!shapes.length) return geometry(xml);
  return shapes.map(([, kind, body]) => {
    const box = body.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"/);
    const anchor = body.match(/<a:bodyPr\b[^>]*\banchor="(\w+)"/)?.[1] ?? '';
    const paragraphs = [...body.matchAll(/<a:p>([\s\S]*?)<\/a:p>/g)].map(([, p]) => p.match(/<a:pPr\b[^>]*\balgn="(\w+)"/)?.[1] ?? 'l');
    return `${kind}:${box ? box.slice(1).join(',') : '-'}:${anchor}:${paragraphs.join('')}`;
  }).join(';');
}

/** Every native text paragraph outside tables and charts, with its alignment. */
export const nativeParagraphs = (xml) => [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].flatMap(([shape]) => [...shape.matchAll(/<a:p>([\s\S]*?)<\/a:p>/g)].map(([, body]) => ({
  text: unescape([...body.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]).join('')),
  align: body.match(/<a:pPr\b[^>]*\balgn="(\w+)"/)?.[1] ?? 'l',
})));

/** Every preview text element with its anchor. */
export const previewTexts = (svg) => [...svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)].map(([, attrs, body]) => ({
  text: unescape(body.replace(/<[^>]+>/g, '')),
  anchor: attrs.match(/text-anchor="(\w+)"/)?.[1] ?? 'start',
}));

export const NATIVE_ALIGN = { start: 'l', middle: 'ctr', end: 'r' };

/**
 * Preview/export alignment agreement: every preview text that is also a whole
 * native paragraph must have the native form of its anchor. Returns the number
 * of paragraphs compared and the mismatches.
 */
export function alignmentAgreement(svg, xml) {
  const native = nativeParagraphs(xml), mismatches = [];
  let compared = 0;
  for (const text of previewTexts(svg)) {
    if (!text.text.trim()) continue;
    for (const paragraph of native.filter((p) => p.text === text.text)) {
      compared++;
      if (paragraph.align !== NATIVE_ALIGN[text.anchor]) mismatches.push({ text: text.text.slice(0, 60), preview: text.anchor, native: paragraph.align });
    }
  }
  return { compared, mismatches };
}
