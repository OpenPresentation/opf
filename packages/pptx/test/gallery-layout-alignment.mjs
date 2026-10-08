// FF-51: the gallery layouts that audit A flagged "export shape placement
// ignores layout that changes preview" differ from the no-layout default only
// in text alignment (the gallery derives design.titleAlignment and
// design.contentAlignment from the layout record). The preview anchors text
// inside the same boxes; the export must write the same alignment inside the
// same boxes, so both engines place every shape identically with and without
// the layout, and the layout changes exactly the same text in both.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {unzipSync} from 'fflate';
import {renderSvg} from '@openpresentation/opf-render';
import {resolvePresentation} from '@openpresentation/opf-render/svg';
import {defaultCatalog} from '@openpresentation/opf/catalog';
import {toPptx, fromPptx} from '../dist/index.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/gallery-alignment-layouts.json', import.meta.url), 'utf8'));
// OPF 0.15: the 7 gallery-only records are embedded in their documents under catalogs.default; the 50 others are default
// catalog records the host registers (zero built-ins), as the gallery itself does.
const HOST = {catalogs: [defaultCatalog]};
assert.equal(fixture.layouts.length, 57, 'the 50 partial and 7 gallery-only layouts audit A flagged');
assert.equal(fixture.layouts.filter(layout => layout.status === 'partial').length, 50);

const decoder = new TextDecoder();
const EXPORT = {seed: 1, timestamp: '2026-01-01T00:00:00Z', zipDate: '2026-01-01T00:00:00Z', ...HOST};
const PT_PER_EMU = 1 / 12700, PT_PER_PX = 0.75, GATE_PT = 0.02;
const nativeAlign = {start: 'l', middle: 'ctr', end: 'r'};
const unescape = text => text.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const tokens = text => text.split(/(?=<)/);
const slideXml = async deck => decoder.decode(unzipSync(await toPptx(deck, EXPORT))['ppt/slides/slide1.xml']);
// Every native text paragraph (outside tables and charts) with its alignment.
const paragraphs = xml => [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].flatMap(([shape]) => [...shape.matchAll(/<a:p>([\s\S]*?)<\/a:p>/g)].map(([, body]) => ({
  text: unescape([...body.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(match => match[1]).join('')),
  align: body.match(/<a:pPr\b[^>]*\balgn="(\w+)"/)?.[1] ?? 'l',
})));
// Every preview text element with its anchor.
const previewTexts = svg => [...svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)].map(([, attrs, body]) => ({
  text: unescape(body.replace(/<[^>]+>/g, '')),
  anchor: attrs.match(/text-anchor="(\w+)"/)?.[1] ?? 'start',
}));
const geometry = xml => [...xml.matchAll(/<a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/>/g)].map(match => match.slice(1).join(','));
const shapeCounts = xml => ({sp: (xml.match(/<p:sp>/g) ?? []).length, pic: (xml.match(/<p:pic>/g) ?? []).length, frame: (xml.match(/<p:graphicFrame>/g) ?? []).length});
const withoutLayout = document => {
  const base = structuredClone(document);
  const id = base.slides[0].layout, record = base.catalogs?.default?.layouts?.[id] ?? defaultCatalog.layouts[id];
  delete base.slides[0].layout; delete base.slides[0].design; delete base.slides[0].composition; delete base.catalogs;
  // OPF 0.15's default fit is cover (0.14's was contain): a layout's imageFit is kept on the deck, so the comparison still
  // isolates the alignment the layout changes.
  if (record?.design?.imageFit) base.design = {...base.design, imageFit: record.design.imageFit};
  return base;
};
// The alignment the gallery design asks for, restated independently of core.
const expectedAlignment = (slide, field) => (field === 'title' ? slide.design?.titleAlignment : slide.design?.contentAlignment) ?? 'left';

let agreements = 0, layoutEffects = 0, chartFrames = 0;
for (const {id, status, document} of fixture.layouts) {
  const slide = document.slides[0];
  assert.equal(slide.layout, id);
  const base = withoutLayout(document);
  const [svg, baseSvg] = [renderSvg(document, HOST)[0], renderSvg(base, HOST)[0]];
  const [xml, baseXml] = [await slideXml(document), await slideXml(base)];
  const bound = resolvePresentation(document, HOST).slides[0];
  assert.ok(Array.isArray(bound.layout?.placeholders), `${id}: preview resolves the layout (0.15 records are keyed by id and carry none)`);

  // 1. Core resolves one alignment per item from the gallery design, for both engines.
  for (const item of bound.geometry.items) assert.equal(item.alignment, expectedAlignment(slide, item.field), `${id}: ${item.path} item.alignment`);

  // 2. Absolute agreement: every preview text that is a native paragraph has the same alignment.
  const native = paragraphs(xml), preview = previewTexts(svg);
  let matched = 0, titleMatched = false;
  for (const text of preview) {
    const same = native.filter(paragraph => paragraph.text === text.text);
    if (!same.length) continue;
    for (const paragraph of same) assert.equal(paragraph.align, nativeAlign[text.anchor], `${id}: native alignment of ${JSON.stringify(text.text)} (preview anchor ${text.anchor})`);
    matched += same.length;
    if (slide.title !== undefined && text.text === slide.title) titleMatched = true;
  }
  assert.ok(matched > 0, `${id}: at least one preview text is a native paragraph`);
  if (slide.title !== undefined) assert.ok(titleMatched, `${id}: the title is compared`);
  agreements += matched;

  // 3. The layout changes only alignment, identically in both engines: every
  //    shape keeps its box (a:off/a:ext byte for byte), no shape is added or
  //    dropped, and the only differing tokens are algn (native) and the text
  //    anchor with its x origin (preview).
  assert.deepEqual(geometry(xml), geometry(baseXml), `${id}: native shape boxes with and without the layout`);
  assert.deepEqual(shapeCounts(xml), shapeCounts(baseXml), `${id}: native shape counts with and without the layout`);
  const [a, b] = [tokens(xml), tokens(baseXml)];
  assert.equal(a.length, b.length, `${id}: native token count`);
  let nativeChanges = 0;
  for (let index = 0; index < a.length; index++) if (a[index] !== b[index]) {
    assert.equal(a[index].replace(/\balgn="\w+"/, ''), b[index].replace(/\balgn="\w+"/, ''), `${id}: native difference beyond paragraph alignment: ${a[index].slice(0, 120)}`);
    nativeChanges++;
  }
  const [c, d] = [tokens(svg), tokens(baseSvg)];
  assert.equal(c.length, d.length, `${id}: preview token count`);
  let previewChanges = 0;
  for (let index = 0; index < c.length; index++) if (c[index] !== d[index]) {
    assert.match(c[index], /^<(text|tspan)\b/, `${id}: preview difference outside text: ${c[index].slice(0, 120)}`);
    const strip = token => token.replace(/\btext-anchor="\w+"/, '').replace(/\bx="[\d.]+"/, '').replace(/\s+/g, ' ').replace(/ (?=[>/])/g, '');
    assert.equal(strip(c[index]), strip(d[index]), `${id}: preview difference beyond the text anchor: ${c[index].slice(0, 120)}`);
    previewChanges++;
  }
  assert.ok(nativeChanges > 0 && previewChanges > 0, `${id}: the layout changes text alignment in both engines (native ${nativeChanges}, preview ${previewChanges})`);
  layoutEffects++;

  // 4. Chart frames sit at the composed box within the native 0.02 pt gate.
  const charts = bound.geometry.items.filter(item => item.type === 'chart');
  const frames = [...xml.matchAll(/<p:graphicFrame>[\s\S]*?<a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/>[\s\S]*?<\/p:graphicFrame>/g)].map(match => match.slice(1).map(Number));
  assert.equal(frames.length, charts.length, `${id}: one native chart frame per composed chart`);
  for (const item of charts) {
    const box = [item.box.x, item.box.y, item.box.width, item.box.height].map(px => px * PT_PER_PX);
    const frame = frames.find(candidate => candidate.every((emu, index) => Math.abs(emu * PT_PER_EMU - box[index]) <= GATE_PT));
    assert.ok(frame, `${id}: chart frame for ${item.path} within ${GATE_PT} pt of ${JSON.stringify(box)}`);
    chartFrames++;
  }

  // 5. Determinism and round trip: the same bytes twice; the layout id and
  //    the alignment design survive re-import.
  const bytes = await toPptx(document, EXPORT);
  assert.ok(Buffer.from(bytes).equals(Buffer.from(await toPptx(document, EXPORT))), `${id}: deterministic export`);
  const imported = await fromPptx(bytes, HOST);
  assert.equal(imported.slides[0].layout, id, `${id}: re-import keeps the layout id`);
  for (const field of ['titleAlignment', 'contentAlignment']) if (slide.design[field] !== undefined) assert.equal(imported.slides[0].design?.[field], slide.design[field], `${id}: re-import keeps design.${field}`);
  assert.ok(status === 'partial' || status === 'gallery-only');
}
console.log(`Gallery layout alignment passed: ${fixture.layouts.length} flagged layouts (pptx-gallery ${fixture.gallery.slice(0, 7)}), ${agreements} native paragraphs at the preview's alignment, ${layoutEffects} layouts changing only alignment in both engines, ${chartFrames} chart frames within ${GATE_PT} pt, deterministic exports and round trips.`);
