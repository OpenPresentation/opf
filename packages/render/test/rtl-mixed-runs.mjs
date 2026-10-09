// RR-59 (#175): Arabic text with Latin phrases in the preview, the ar-mixed deck of the native pass (opf#477). PowerPoint drew all three
// cases right from the PPTX the same fonts handle wrote; only the SVG preview was wrong:
//   1. the space at an Arabic/Latin run boundary was lost: a positioned right-to-left run kept its trailing space inside its isolate, and
//      bidi rule L1 moved that space to the run's right edge (the chunk's paragraph is left to right), so the gap closed up;
//   2. the bullet of a right-to-left list item with a Latin phrase overlapped the item text: the entry line had no placed origin from core,
//      so it was drawn as one unpinned chunk starting at its measured left edge, and it drew wider than measured, into the marker;
//   3. the Latin phrase of an Arabic list item drew in a wider fallback face: resvg shapes such a chunk with the outer (Latin) face, and
//      when a fallback face covers every character it replaces every glyph of the chunk with that face's.
// Offline and deterministic: the office pack with the Arabic script faces (Noto Naskh Arabic previews Arabic Typesetting).
import assert from 'node:assert/strict';
import {catalogs, renderSvg} from './catalog-harness.mjs';
import {loadFonts} from '../dist/fonts-node.js';

const deck = {
  name: 'RR-59 mixed Arabic and Latin',
  language: 'ar-SA',
  slides: [
    {id: 'paragraph', title: 'ملخص الإصدار PowerPoint 365',
      text: ['تم تصدير هذا العرض إلى ', {text: 'PowerPoint 365', bold: true}, ' بنجاح. زر الموقع ', {text: 'https://openpresentation.org/docs', underline: true}, ' وراجع الملف ', {text: 'report-2026.pptx', bold: true}, ' المرفق.']},
    {id: 'list', title: 'قائمة المهام',
      items: ['فتح الملف في PowerPoint 365 والتحقق من الخطوط', 'إطلاق الإصدار v2.0 في الربع الثالث', 'نشر الدليل على https://openpresentation.org', 'التحقق من اتجاه النص (RTL) في كل شريحة']},
  ],
};
const fonts = await loadFonts({pack: 'office', scripts: 'auto', presentation: deck, renderOptions: {catalogs}});
const [paragraphSvg, listSvg] = renderSvg(structuredClone(deck), {fonts, trace: true});

const ARABIC = /\p{Script=Arabic}/u, LATIN = /[A-Za-z0-9]/;
const ISOLATES = /[⁦-⁩]/gu;
const attribute = (attrs, name) => new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(attrs)?.[1];
const unescape = text => text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

/**
 * Every text node inside a <text>, with what it is drawn with: the font-family and font-size it inherits, the element that starts its
 * text chunk (the nearest <text> or <tspan> with its own x) and that element's x and textLength, and the enclosing <text>'s trace path.
 */
function textNodes(svg) {
  const nodes = [], stack = [];
  // <style> and <metadata> hold no drawn text; the embedded font data is skipped with them.
  const body = svg.replace(/<style\b[\s\S]*?<\/style>|<metadata\b[\s\S]*?<\/metadata>/g, '');
  for (const [token, close, name, attrs = ''] of body.matchAll(/<(\/?)([A-Za-z][\w:.-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)\/?>|[^<]+/g)) {
    const top = stack.at(-1);
    if (name === undefined) {
      if (top?.inText && token) nodes.push({text: unescape(token), family: top.family, size: top.size, chunk: top.chunk, path: top.path});
      continue;
    }
    if (close) { stack.pop(); continue; }
    if (token.endsWith('/>')) continue;
    const text = name === 'text' || name === 'tspan', x = attribute(attrs, 'x');
    stack.push({
      inText: top?.inText || name === 'text',
      family: (text && attribute(attrs, 'font-family')) || top?.family,
      size: Number((text && attribute(attrs, 'font-size')) || top?.size),
      chunk: text && (x !== undefined || name === 'text') ? {x: Number(x), textLength: attribute(attrs, 'textLength') === undefined ? undefined : Number(attribute(attrs, 'textLength'))} : top?.chunk,
      path: attribute(attrs, 'data-opf-path') ?? top?.path,
    });
  }
  return nodes;
}
/** Text chunks (the drawn pieces resvg and a browser shape on their own), in document order, with their text and drawing attributes. */
function chunks(svg) {
  const list = [];
  for (const node of textNodes(svg)) {
    let chunk = list.find(item => item.chunk === node.chunk);
    if (!chunk) list.push(chunk = {chunk: node.chunk, x: node.chunk.x, textLength: node.chunk.textLength, text: '', path: node.path, faces: []});
    chunk.text += node.text;
    if (node.text.replace(ISOLATES, '').trim()) chunk.faces.push({text: node.text.replace(ISOLATES, ''), family: node.family, size: node.size});
  }
  return list.map(item => ({...item, visible: item.text.replace(ISOLATES, ''), right: item.textLength === undefined ? undefined : item.x + item.textLength}));
}

// 1. The space at a run boundary. No positioned right-to-left chunk ends in white space inside its isolate (bidi L1 would draw that space
// at the chunk's right edge), and the measured gap between an Arabic run and the Latin run after it is there in x.
{
  for (const [label, svg] of [['paragraph', paragraphSvg], ['list', listSvg]]) {
    for (const chunk of chunks(svg)) {
      assert.doesNotMatch(chunk.text, /\S\s+⁩$/u, `${label}: the chunk "${chunk.visible}" keeps no trailing white space inside its right-to-left isolate`);
    }
  }
  const all = chunks(paragraphSvg);
  // Arabic run "... X " then Latin run "Y": in a right-to-left line the Latin run sits left of the Arabic one, a space apart.
  const pairs = [['ملخص الإصدار', 'PowerPoint 365', 'title'], ['إلى', 'PowerPoint 365', 'body'], ['الموقع', 'https://openpresentation.org/docs', 'body'], ['الملف', 'report-2026.pptx', 'body']];
  for (const [arabic, latin, field] of pairs) {
    const inField = all.filter(chunk => chunk.path?.endsWith(field === 'title' ? '.title' : '.text'));
    const before = inField.find(chunk => chunk.visible.trimEnd().endsWith(arabic) && ARABIC.test(chunk.visible));
    const after = inField.find(chunk => chunk.visible.trim() === latin);
    assert.ok(before && after, `${field}: found the runs "${arabic}" and "${latin}"`);
    assert.ok(before.textLength !== undefined && after.textLength !== undefined, `${field}: both runs are pinned to their measured advance`);
    const gap = before.x - after.right;
    // A space is 0.2 to 0.3 em in Intos and Noto Naskh Arabic; the title is 54 px, the body 25 px (Arabic drawn at 0.64 of it).
    assert.ok(gap > 2.5, `${field}: "${latin}" ends a space before "${arabic}" starts (gap ${gap.toFixed(2)} px)`);
  }
}

// 2. Right-to-left list markers. Every chunk of an item is pinned to its measured advance, and the whole item ends before its marker
// (the marker is anchored at its end, the right edge; the bullet glyph is under half an em wide).
{
  const markers = chunks(listSvg).filter(chunk => chunk.visible === '•');
  assert.equal(markers.length, 4, 'four bullets');
  const markerTexts = [...listSvg.matchAll(/<text\b([^>]*)>•<\/text>/g)].map(([, attrs]) => ({x: Number(attribute(attrs, 'x')), y: Number(attribute(attrs, 'y')), size: Number(attribute(attrs, 'font-size')), anchor: attribute(attrs, 'text-anchor')}));
  const items = chunks(listSvg).filter(chunk => chunk.path?.includes('.items.') && chunk.visible.trim() && chunk.visible !== '•');
  markerTexts.forEach((marker, index) => {
    assert.equal(marker.anchor, 'end', `item ${index + 1}: the marker sits at the right edge`);
    const own = items.filter(chunk => chunk.path.endsWith(`.items.${index}`));
    assert.ok(own.length >= 2, `item ${index + 1}: drawn as its script runs`);
    for (const chunk of own) {
      assert.ok(Number.isFinite(chunk.x) && chunk.textLength > 0, `item ${index + 1}: "${chunk.visible}" is pinned to its measured advance`);
      assert.ok(chunk.right <= marker.x - marker.size * 0.5, `item ${index + 1}: "${chunk.visible}" ends at ${chunk.right.toFixed(2)}, clear of the bullet at ${marker.x} (anchored at its end)`);
    }
    // The first glyph run (the rightmost one) ends on the item's text edge, the same for every item.
    const right = Math.max(...own.map(chunk => chunk.right));
    assert.ok(Math.abs(right - Math.max(...items.filter(chunk => chunk.path.endsWith('.items.1')).map(chunk => chunk.right))) < 0.01, `item ${index + 1}: starts on the common right edge`);
  });
}

// 3. Latin runs of an Arabic list item are drawn as the body's Latin runs are: their own text chunk (no Arabic shaped with them, so no
// fallback face can take them over), in the body family at the body size.
{
  const bodyLatin = chunks(paragraphSvg).filter(chunk => chunk.path?.endsWith('.text') && LATIN.test(chunk.visible) && !ARABIC.test(chunk.visible));
  assert.ok(bodyLatin.length >= 3, 'the body paragraph has Latin runs');
  const regular = bodyLatin.flatMap(chunk => chunk.faces).find(face => face.text.includes('openpresentation'));
  const listLatin = chunks(listSvg).filter(chunk => chunk.path?.includes('.items.') && LATIN.test(chunk.visible));
  assert.equal(listLatin.length, 4, 'each list item has one Latin run');
  for (const chunk of listLatin) {
    assert.doesNotMatch(chunk.visible, ARABIC, `"${chunk.visible.trim()}" shares its text chunk with no Arabic text`);
    for (const face of chunk.faces) {
      assert.equal(face.family, regular.family, `"${face.text.trim()}" is drawn in the body's Latin family`);
      assert.equal(face.size, regular.size, `"${face.text.trim()}" is drawn at the body's Latin size`);
    }
  }
  assert.match(regular.family, /^Intos\b/, 'Aptos previews in Intos');
}

console.log('RTL mixed runs: run-boundary spaces, right-to-left bullet clearance and the Latin face of Arabic list items match the body.');
