import assert from 'node:assert/strict';
import { strFromU8, unzipSync, zipSync } from 'fflate';
import { toPptx, fromPptx } from '../dist/index.js';
import { gallery } from '@openpresentation/gallery';
import { documentProvenance } from '../src/document-provenance.js';
// Legacy decks must not gain per-slide provenance or change their exact archive bytes.
assert.deepEqual(documentProvenance({language: 'en-US', slides: [{title: 'Legacy'}]}).slides, [{v: 1, slide: 0}]);
assert.deepEqual(documentProvenance({slides: [{title: 'Legacy'}]}).slides, [{v: 1, slide: 0}]);
const deck = { language: 'en-US', slides: [
  { title: 'English', text: 'A simple sentence.' },
  { language: 'ar-SA', title: 'العربية', items: ['الأول', 'الثاني'] },
  { language: 'ja', title: '日本語', text: '同じ資料で言語を選べる' },
] };
const bytes = await toPptx(deck);
const zip = unzipSync(new Uint8Array(bytes));
const slide = n => strFromU8(zip['ppt/slides/slide' + n + '.xml']);
assert.match(slide(1), /lang="en-US"/);
assert.match(slide(2), /lang="ar-SA"/);
assert.match(slide(2), /rtl="1"/);
assert.match(slide(3), /lang="ja-JP"/);
const restored = await fromPptx(bytes);
assert.equal(restored.language, 'en-US');
assert.equal(restored.slides[1].language, 'ar-SA');
assert.equal(restored.slides[2].language, 'ja');
console.log('LH-106: PPTX per-slide language tags, RTL and round trip');

// Native edits win over stored slide-language metadata.
const edited = { ...zip, 'ppt/slides/slide2.xml': new TextEncoder().encode(slide(2).replaceAll('lang="ar-SA"', 'lang="he-IL"')) };
assert.equal((await fromPptx(zipSync(edited))).slides[1].language, 'he-IL');
const selected = { language: 'en-US', slides: [{language: 'ar-SA', design: {fontScheme: 'noto-sans-arabic'}, title: 'العربية', text: 'اختر خط الشريحة'}] };
const selectedZip = unzipSync(new Uint8Array(await toPptx(selected, {catalogs: [gallery]})));
assert.ok(Object.entries(selectedZip).some(([name, value]) => /^ppt\/theme\/theme\d+\.xml$/.test(name) && /<a:cs typeface="Noto Naskh Arabic"/.test(strFromU8(value))), 'the selected Arabic slide face is written in the complex-script theme slot');
