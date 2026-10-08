// A picture repeated on many slides embeds one media part: every slide keeps its
// own picture and relationship, all pointing at the same part.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { unzipSync } from 'fflate';
import { toPptx, fromPptx } from '../dist/index.js';

const decode = bytes => new TextDecoder().decode(bytes);
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = bytes => { let c = 0xffffffff; for (const byte of bytes) c = crcTable[(c ^ byte) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
// A deterministic, poorly compressible RGB PNG of about `size` bytes.
function noisePng(seed, side = 260) {
  const raw = Buffer.alloc((side * 3 + 1) * side);
  let state = seed >>> 0;
  for (let index = 0; index < raw.length; index++) { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; raw[index] = index % (side * 3 + 1) === 0 ? 0 : state >>> 24; }
  const chunk = (type, data) => { const body = Buffer.concat([Buffer.from(type), data]), out = Buffer.alloc(body.length + 8); out.writeUInt32BE(data.length, 0); body.copy(out, 4); out.writeUInt32BE(crc(body), body.length + 4); return out; };
  const header = Buffer.alloc(13); header.writeUInt32BE(side, 0); header.writeUInt32BE(side, 4); header[8] = 8; header[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw, { level: 0 })), chunk('IEND', Buffer.alloc(0))]);
}
const uri = bytes => `data:image/png;base64,${bytes.toString('base64')}`;
const mark = noisePng(1), photo = noisePng(2, 120), other = noisePng(3, 120);
assert.ok(mark.length > 190_000, `watermark fixture is realistic (${mark.length} bytes)`);

const mediaParts = entries => Object.keys(entries).filter(path => /^ppt\/media\/[^/]+$/.test(path));
function packageIsConsistent(entries) {
  const types = decode(entries['[Content_Types].xml']);
  for (const path of Object.keys(entries).filter(path => path.endsWith('.rels'))) {
    const source = path.replace(/(^|\/)_rels\/([^/]*)\.rels$/, '$1$2'), directory = source.slice(0, source.lastIndexOf('/') + 1);
    for (const [, target] of decode(entries[path]).matchAll(/Target="([^"]+)"(?![^>]*TargetMode="External")/g)) {
      if (/^https?:/.test(target)) continue;
      const parts = []; for (const segment of (target.startsWith('/') ? target.slice(1) : directory + target).split('/')) { if (segment === '..') parts.pop(); else if (segment && segment !== '.') parts.push(segment); }
      assert.ok(entries[parts.join('/')], `${path} target ${target} exists`);
    }
  }
  for (const [, part] of types.matchAll(/PartName="\/([^"]+)"/g)) assert.ok(entries[part], `${part} named in [Content_Types].xml exists`);
  for (const part of mediaParts(entries)) assert.ok(types.includes(`Extension="${part.split(".").at(-1)}"`) || types.includes(`PartName="/${part}"`), `${part} has a content type`);
}

let checked = 0;
const slides = count => Array.from({ length: count }, (_, index) => ({ title: `Slide ${index + 1}`, text: 'Body', image: uri(photo) }));
{
  const deck = { design: { watermark: { src: uri(mark), opacity: 0.1 } }, slides: slides(50) };
  const bytes = await toPptx(deck, { imageFormat: 'preserve', strictAssets: true });
  const entries = unzipSync(bytes);
  assert.equal(mediaParts(entries).length, 2, 'One part for the watermark and one for the repeated picture');
  packageIsConsistent(entries);
  const slideParts = Object.keys(entries).filter(path => /^ppt\/slides\/slide\d+\.xml$/.test(path));
  assert.equal(slideParts.length, 50);
  const targets = new Set();
  for (const part of slideParts) {
    const relationships = decode(entries[part.replace('/slides/', '/slides/_rels/') + '.rels']);
    const images = [...relationships.matchAll(/Type="[^"]*\/image"[^>]*Target="([^"]+)"|Target="([^"]+)"[^>]*Type="[^"]*\/image"/g)].map(match => match[1] ?? match[2]);
    assert.equal(images.length, 2, `${part} keeps its own relationship to each picture`);
    for (const target of images) targets.add(target);
    const xml = decode(entries[part]);
    assert.equal([...xml.matchAll(/<p:pic>/g)].length, 2);
    for (const [, id] of xml.matchAll(/r:embed="([^"]+)"/g)) assert.ok(relationships.includes(`Id="${id}"`), `${part} embed ${id} resolves`);
  }
  assert.equal(targets.size, 2);
  // Both bytes are preserved exactly.
  const contents = mediaParts(entries).map(path => Buffer.from(entries[path]));
  for (const original of [mark, photo]) assert.ok(contents.some(content => content.equals(original)), 'Original bytes preserved');
  // Round trip: every slide still carries the watermark and its picture.
  const diagnostics = [];
  const imported = await fromPptx(bytes, { onDiagnostic: d => diagnostics.push(d) });
  assert.equal(imported.slides.length, 50);
  assert.equal(imported.design.watermark.opacity, 0.1);
  assert.equal(diagnostics.filter(d => /watermark/i.test(d.code)).length, 0);
  assert.ok(imported.slides.every(slide => JSON.stringify(slide).includes('data:image/png')), 'Every slide imports its picture');
  const again = unzipSync(await toPptx(imported, { imageFormat: 'preserve', strictAssets: true }));
  assert.equal(mediaParts(again).length, 2, 'The re-exported deck also embeds each picture once');
  packageIsConsistent(again);
  // Deterministic.
  const second = await toPptx(deck, { imageFormat: 'preserve', strictAssets: true });
  assert.deepEqual(Buffer.from(second), Buffer.from(bytes), 'Export stays byte-identical');
  checked++;
  console.log(`50 slides, watermark ${mark.length} B + picture ${photo.length} B: package ${bytes.length} B, ${mediaParts(entries).length} media parts`);
}
{
  // Different pictures stay different parts.
  const deck = { slides: [{ title: 'A', image: uri(photo) }, { title: 'B', image: uri(other) }, { title: 'C', image: uri(photo) }] };
  const entries = unzipSync(await toPptx(deck, { imageFormat: 'preserve', strictAssets: true }));
  assert.equal(mediaParts(entries).length, 2);
  packageIsConsistent(entries);
  checked++;
}
{
  // A placed image block and a watermark with the same bytes share one part and keep their own frames.
  const deck = { design: { watermark: { src: uri(photo), opacity: 0.2 } }, slides: [{ title: 'A', blocks: [{ type: 'image', image: uri(photo), placement: { edge: 'left' } }, { type: 'text', text: 'x' }] }] };
  const entries = unzipSync(await toPptx(deck, { imageFormat: 'preserve', strictAssets: true }));
  assert.equal(mediaParts(entries).length, 1);
  const xml = decode(entries['ppt/slides/slide1.xml']);
  assert.match(xml, /name="OPF image 1"/); assert.match(xml, /name="OPF watermark"/);
  packageIsConsistent(entries);
  const imported = await fromPptx(await toPptx(deck, { imageFormat: 'preserve', strictAssets: true }), { onDiagnostic: () => {} });
  assert.ok(imported.slides[0].blocks[0].placement?.edge === 'left' && imported.design.watermark.opacity === 0.2);
  checked++;
}
console.log(`Media dedupe checks passed (${checked}).`);
