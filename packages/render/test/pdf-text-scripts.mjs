// The text of the vector PDF reads back as the author wrote it, in logical order, for every sample of the script corpora whose
// shaping reorders, decomposes or ligates characters (Indic, Sinhala, Thai, Lao, Khmer, Myanmar and Tibetan, and Arabic, Hebrew,
// Syriac and Thaana with their marks), drawn by both shapers (HarfBuzz from the fonts handle, fontkit without one) and read by a
// reader that only reads the glyph-to-Unicode map (pdf.js, Firefox's) and one that honors /ActualText (PDFium, Chrome's and
// Edge's). A reordered cluster (a pre-base vowel sign or medial drawn before its consonant, a Thai am split into nikhahit and aa)
// carries its whole text on its first drawn glyph and its word carries /ActualText (src/pdf-text.js, attributeClusters).
// Whitespace is ignored, as in test/pdf-vector.mjs: readers insert spaces where glyphs leave gaps. `limits` lists what a reader
// still reads differently, with the reason; a limit that no longer differs must be removed. poppler's pdftotext, when installed,
// is only reported: its version is the machine's.
import assert from 'node:assert/strict';
import { toPdf } from '../dist/index.js';
import { loadFonts } from '../dist/fonts-node.js';
import { loadCorpora, loadFaces } from '../scripts/script-corpora.mjs';
import { openPdf, pageText, pdfiumRtlLine, pdfiumText, popplerText } from './pdf-helpers.mjs';

const SCRIPTS = ['Arab', 'Hebr', 'Syrc', 'Thaa', 'Deva', 'Beng', 'Guru', 'Gujr', 'Orya', 'Taml', 'Telu', 'Knda', 'Mlym', 'Sinh', 'Thai', 'Laoo', 'Khmr', 'Mymr', 'Tibt'];
const both = ['harfbuzz', 'fontkit'];
const limits = {
  pdfjs: {
    'arab-digits': [both, 'pdf.js orders the Arabic-Indic numbers of a right-to-left line by their position, after the words around them'],
    'arab-fa-digits': [both, 'pdf.js orders the Arabic-Indic numbers of a right-to-left line by their position, after the words around them'],
    'arab-fa-letters': [both, 'pdf.js drops the zero width non-joiner (U+200C); fontkit draws it as a space glyph that claims U+0020'],
    'telu-zwnj': [both, 'pdf.js drops the zero width non-joiner (U+200C); fontkit draws it as a space glyph that claims U+0020'],
  },
  pdfium: {
    'arab-harakat': [both, 'PDFium reads the marks of a right-to-left line apart from their letters, by position'],
    'arab-digits': [both, 'PDFium reads the numbers and the dash of a right-to-left line in visual order'],
    'arab-punctuation': [both, 'PDFium reads the punctuation and a final tanwin of a right-to-left line by position'],
    'arab-fa-letters': [both, 'PDFium reads a word split by a zero width non-joiner as two words in visual order'],
    'hebr-niqqud': [both, 'PDFium reads the points of a right-to-left line apart from their letters, by position'],
    'hebr-maqaf': [both, 'PDFium reads the commas of a right-to-left line in visual order'],
    'syrc-marks': [both, 'PDFium reads the marks of a right-to-left line apart from their letters, by position'],
    'thaa-words': [both, 'PDFium reads the vowel signs of a right-to-left line apart from their letters, by position'],
    'tibt-words': [both, 'PDFium reads a Tibetan vowel sign above its stack by its position, before the stack'],
    'thai-sara-am': [['harfbuzz'], 'PDFium reads a Thai tone mark after the next consonant (by position) where no /ActualText covers it; HarfBuzz keeps the am whole, so that word has none'],
  },
};

const fonts = await loadFonts({ pack: 'office', scripts: 'all' });
const shapers = { harfbuzz: fonts, fontkit: { fontFiles: fonts.fontFiles, useBundledFonts: false } };
const readers = { pdfjs: async (pdf) => pageText(await openPdf(pdf), 1), pdfium: pdfiumText };
const corpora = await loadCorpora();
const { faces } = await loadFaces();
const strip = (text) => text.replace(/[\s​‎‏]/g, '').normalize('NFKC');
const escape = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;');

let compared = 0;
const failures = [], stillLimited = new Set(), popplerDiffers = [];
let popplerSeen = false;
for (const group of corpora.groups.filter((candidate) => SCRIPTS.includes(candidate.script))) {
  const face = faces.find((candidate) => candidate.scripts.includes(group.script) && candidate.weight === 400 && !candidate.italic);
  assert.ok(face, `${group.script}: a face`);
  const rtl = group.direction === 'rtl';
  for (const sample of group.samples) {
    // Mixed-direction lines (Latin letters or ASCII digits in a right-to-left sample) are test/pdf-vector.mjs's.
    if (rtl && /[A-Za-z0-9]/.test(sample.text)) continue;
    const text = rtl ? `⁧${sample.text}⁩` : sample.text;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="140"><text x="40" y="90" font-family="${face.family}" font-size="24"${sample.lang ? ` lang="${sample.lang}"` : ''} xml:space="preserve">${escape(text)}</text></svg>`;
    for (const [shaper, options] of Object.entries(shapers)) {
      const pdf = await toPdf(svg, { fonts: options });
      for (const [reader, read] of Object.entries(readers)) {
        const got = await read(pdf);
        // PDFium gives the words of a right-to-left line in visual order, each in logical order (see pdf-helpers.mjs).
        const wanted = reader === 'pdfium' && rtl ? pdfiumRtlLine(sample.text) : sample.text;
        const same = strip(got) === strip(wanted);
        const limit = limits[reader][sample.id];
        if (limit?.[0].includes(shaper)) {
          if (!same) stillLimited.add(`${reader}:${sample.id}:${shaper}`);
          else failures.push(`${sample.id} (${shaper}): ${reader} now reads it right; remove its limit`);
        } else if (!same) failures.push(`${sample.id} (${shaper}): ${reader} reads "${got}", expected "${sample.text}"`);
      }
      const poppler = await popplerText(pdf);
      if (poppler !== null) {
        popplerSeen = true;
        if (strip(poppler) !== strip(sample.text)) popplerDiffers.push(`${sample.id} (${shaper})`);
      }
      compared++;
    }
  }
}
assert.deepEqual(failures, [], failures.join('\n'));
const listed = Object.entries(limits).flatMap(([reader, entries]) => Object.entries(entries).flatMap(([id, [shapersOf]]) => shapersOf.map((shaper) => `${reader}:${id}:${shaper}`)));
assert.deepEqual(listed.filter((key) => !stillLimited.has(key)), [], 'every limit is exercised');
assert.ok(compared >= 150, `${compared} sample exports`);
console.log(`PDF text, scripts: ${compared} exports of ${SCRIPTS.length} scripts (HarfBuzz and fontkit) read back in logical order by pdf.js and PDFium, ${listed.length} recorded reader limits; ${popplerSeen ? `poppler differs on ${popplerDiffers.length} (not asserted)` : 'poppler is not installed'}.`);
