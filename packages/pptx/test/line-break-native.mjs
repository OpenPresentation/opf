// LH-11: where PowerPoint wraps the text itself (a native title and body under bodyText 'native', table cells) the export writes a
// no-break space (U+00A0) in the places core's line breaker never breaks (a number and its unit or %, a closing mark), so PowerPoint
// breaks where the preview does. Import writes the spaces back, so the OPF text round-trips unchanged. Measured text (one text
// box per line, the default) is cut by core's own lines and needs none.
import assert from 'node:assert/strict';
import { unzipSync } from 'fflate';
import { toPptx, fromPptx } from '../dist/index.js';

const NBSP = '\u00a0';
const title = 'Revenue grew 26 % to $4.8 M in the year across twelve of our markets worldwide';
const body = 'Revenue grew by 26 % in the last year and reached $4.8 M across 12 km of routes (really) , said the CEO.';
const arabic = 'ارتفعت الإيرادات ٢٦ ٪ إلى 4.8 مليون دولار في السنة الأخيرة.';
const deck = { slides: [{ title, blocks: [{ type: 'text', text: body }, { type: 'table', table: { columns: ['Metric', 'Value'], rows: [['Growth', '26 % up'], ['Revenue', '$4.8 M total'], ['Note', 'plain words only']] } }] }] };
const slideXml = async (document, options) => new TextDecoder().decode(unzipSync(await toPptx(document, options))['ppt/slides/slide1.xml']);
const texts = xml => [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(match => match[1]);
const bound = text => text.replaceAll(' %', `${NBSP}%`).replaceAll(' M ', `${NBSP}M `).replaceAll(' km ', `${NBSP}km `).replaceAll(' ,', `${NBSP},`).replaceAll(' ٪', `${NBSP}٪`);

// Native body: the title, the body and the table cells carry the no-break spaces.
{
  const found = texts(await slideXml(deck, { bodyText: 'native' }));
  assert.ok(found.includes(bound(title)), JSON.stringify(found));
  assert.ok(found.includes(bound(body)), JSON.stringify(found));
  assert.ok(found.includes(`26${NBSP}% up`) && found.includes(`$4.8${NBSP}M total`), JSON.stringify(found));
  assert.ok(found.includes('plain words only'), 'text with nothing bound is untouched');
  const imported = await fromPptx(await toPptx(deck, { bodyText: 'native' }), { onDiagnostic: () => {} });
  const text = JSON.stringify(imported.slides[0]);
  assert.ok(!text.includes(NBSP), 'import writes the spaces back');
  assert.equal(imported.slides[0].title, title);
  assert.deepEqual(imported.slides[0].blocks.find(block => block.type === 'table').table.rows, deck.slides[0].blocks[1].table.rows);
}

// Measured text (the default) keeps its lines; only the table cells, which PowerPoint wraps, are bound.
{
  const found = texts(await slideXml(deck, {}));
  assert.ok(found.includes(`26${NBSP}% up`), 'a table cell is bound');
  assert.equal(found.filter(text => text.includes('Revenue grew') && text.includes(NBSP)).length, 0, 'a measured line is not rewritten');
  const imported = await fromPptx(await toPptx(deck, {}), { onDiagnostic: () => {} });
  assert.ok(!JSON.stringify(imported.slides[0]).includes(NBSP));
}

// Right to left: the same rule on the Arabic percent sign; an author's own no-break space between words is kept.
{
  const document = { slides: [{ title: 'Arabic', blocks: [{ type: 'table', table: { columns: ['A'], rows: [[arabic], [`Mr.${NBSP}Smith`]] } }] }] };
  const found = texts(await slideXml(document, {}));
  assert.ok(found.includes(arabic.replace(' ٪', `${NBSP}٪`).replace(' مليون', `${NBSP}مليون`)), JSON.stringify(found));
  const imported = await fromPptx(await toPptx(document, {}), { onDiagnostic: () => {} });
  assert.deepEqual(imported.slides[0].blocks.find(block => block.type === 'table').table.rows, document.slides[0].blocks[0].table.rows);
}
console.log('native line breaks: no-break spaces exported where core never breaks, restored on import');
