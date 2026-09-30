import assert from 'node:assert/strict';
import { test } from 'node:test';
import { alignmentAgreement, geometry, nativeParagraphs, placementSignature, previewTexts } from './placement.mjs';

const shape = (name, box, paragraphs, anchor) => `<p:sp><p:nvSpPr><p:cNvPr id="2" name="${name}"/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${box[0]}" y="${box[1]}"/><a:ext cx="${box[2]}" cy="${box[3]}"/></a:xfrm></p:spPr><p:txBody><a:bodyPr${anchor ? ` anchor="${anchor}"` : ''}/>${paragraphs.map(([text, algn]) => `<a:p><a:pPr${algn ? ` algn="${algn}"` : ''}/><a:r><a:t>${text}</a:t></a:r></a:p>`).join('')}</p:txBody></p:sp>`;
const pic = (box) => `<p:pic><p:nvPicPr><p:cNvPr id="3" name="Picture"/></p:nvPicPr><p:spPr><a:xfrm><a:off x="${box[0]}" y="${box[1]}"/><a:ext cx="${box[2]}" cy="${box[3]}"/></a:xfrm></p:spPr></p:pic>`;
const svgText = (text, anchor, x) => `<text fill="#fff" font-size="54" text-anchor="${anchor}" x="${x}" y="111.6">${text}</text>`;

const box = [548640, 548640, 11094720, 627507];
const left = shape('Title', box, [['Text 1x Title Center', 'l']]) + shape('Body', [1, 2, 3, 4], [['Body copy', 'l']]);
const centered = shape('Title', box, [['Text 1x Title Center', 'ctr']]) + shape('Body', [1, 2, 3, 4], [['Body copy', 'l']]);

test('a paragraph alignment change inside the same box changes the placement signature but not the box geometry', () => {
  assert.equal(geometry(left), geometry(centered));
  assert.notEqual(placementSignature(left), placementSignature(centered));
  assert.equal(placementSignature(left), placementSignature(left));
});

test('the signature covers every shape kind, the body anchor and a moved box', () => {
  const base = shape('Title', box, [['A', 'l']]) + pic([9, 9, 9, 9]);
  assert.notEqual(placementSignature(base), placementSignature(shape('Title', box, [['A', 'l']], 'ctr') + pic([9, 9, 9, 9])));
  assert.notEqual(placementSignature(base), placementSignature(shape('Title', box, [['A', 'l']]) + pic([9, 9, 10, 9])));
  assert.notEqual(placementSignature(base), placementSignature(shape('Title', box, [['A', 'l']])));
  assert.match(placementSignature(base), /^sp:548640,548640,11094720,627507::l;pic:9,9,9,9::$/);
});

test('a part without shapes falls back to the raw box geometry', () => {
  const bare = '<p:spTree><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></p:spTree>';
  assert.equal(placementSignature(bare), '0,0,0,0');
});

test('native paragraphs and preview texts are read with their alignment', () => {
  assert.deepEqual(nativeParagraphs(centered), [{ text: 'Text 1x Title Center', align: 'ctr' }, { text: 'Body copy', align: 'l' }]);
  assert.deepEqual(previewTexts(svgText('Venn &amp; Overlap', 'middle', 640) + '<text x="1">Plain</text>'), [{ text: 'Venn & Overlap', anchor: 'middle' }, { text: 'Plain', anchor: 'start' }]);
});

test('alignment agreement compares each preview text with its native paragraph', () => {
  const svg = svgText('Text 1x Title Center', 'middle', 640) + svgText('Body copy', 'start', 57.6) + svgText('Only in preview', 'end', 9);
  assert.deepEqual(alignmentAgreement(svg, centered), { compared: 2, mismatches: [] });
  assert.deepEqual(alignmentAgreement(svg, left), { compared: 2, mismatches: [{ text: 'Text 1x Title Center', preview: 'middle', native: 'l' }] });
  assert.deepEqual(alignmentAgreement('<text x="1"> </text>', left), { compared: 0, mismatches: [] });
});
