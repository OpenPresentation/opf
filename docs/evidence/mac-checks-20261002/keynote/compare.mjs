// Compare a Keynote export of each deck with manifest.json.
//   node compare.mjs [--out out] [--deck 09-charts-core] [--report out/compare-report]
// Reads out/<deck>.pdf (Keynote > File > Export To > PDF) and out/<deck>.pptx (Export To > PowerPoint).
// Writes <report>.json and <report>.md; exits 1 when any check FAILs. A missing export is reported, not hidden.
import {readFile, writeFile, access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import JSZip from 'jszip';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import {inspectPptx} from './lib/inspect-pptx.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const outDir = path.resolve(root, option('--out', 'out'));
const only = option('--deck');
const reportBase = path.resolve(root, option('--report', path.join(path.relative(root, outDir), 'compare-report')));
const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));

const exists = (file) => access(file).then(() => true, () => false);
// Kangxi radicals (U+2F00-U+2FD5) come out of CID-keyed CJK fonts whose ToUnicode maps a glyph to the radical
// rather than the unified ideograph (Keynote's PDF: 入 extracted as U+2F0A). NFKC maps exactly that block back;
// it is applied to those code points only, so no other text is folded.
const radicals = (s) => s.replace(/[\u2F00-\u2FD5]/g, (ch) => ch.normalize('NFKC'));
const squash = (s) => radicals(s.normalize('NFC')).replace(/[\s‎‏‪-‮⁦-⁩]+/g, '');
const reverse = (s) => [...s].reverse().join('');
const words = (s) => radicals(s.normalize('NFC')).split(/\s+/).filter(Boolean);

/** How well `needle` (an expected paragraph) is found in `haystack` (a slide's extracted text):
 *  exact (contiguous, spaces ignored), reversed (a visual-order RTL extraction), words (every word present
 *  somewhere), reordered (characters present, shaped order) or partial with a coverage ratio. */
export function findParagraph(haystack, needle) {
  const h = squash(haystack), n = squash(needle);
  if (!n) return {status: 'exact', ratio: 1};
  if (h.includes(n)) return {status: 'exact', ratio: 1};
  if (h.includes(reverse(n))) return {status: 'reversed', ratio: 1};
  const found = words(needle).filter((w) => { const s = squash(w); return h.includes(s) || h.includes(reverse(s)); });
  const ratio = found.length / Math.max(1, words(needle).length);
  if (ratio === 1) return {status: 'words', ratio};
  // Complex scripts (Devanagari, Arabic) come out of a PDF as shaped glyphs in visual order, so the characters are
  // all there but not in sequence. Accept that as 'reordered' when at least 95% of the characters are present.
  const have = new Map();
  for (const ch of h) have.set(ch, (have.get(ch) ?? 0) + 1);
  const want = new Map();
  for (const ch of n) want.set(ch, (want.get(ch) ?? 0) + 1);
  let covered = 0;
  for (const [ch, count] of want) covered += Math.min(count, have.get(ch) ?? 0);
  const charRatio = covered / n.length;
  if (charRatio >= 0.95) return {status: 'reordered', ratio: charRatio};
  return {status: 'partial', ratio: Math.max(ratio, charRatio * 0.99)};
}

function textChecks(label, expectedParagraphs, actualText, add) {
  const missing = [], loose = [];
  for (const paragraph of expectedParagraphs) {
    const r = findParagraph(actualText, paragraph);
    if (r.status === 'partial') missing.push(`${paragraph}  (${Math.round(r.ratio * 100)}% of words)`);
    else if (r.status !== 'exact') loose.push(`${paragraph}  (${r.status})`);
  }
  if (missing.length) add('FAIL', `${label}: text missing`, missing.join(' | '));
  if (loose.length) add('WARN', `${label}: text found but not contiguous`, loose.join(' | '));
  if (/�/.test(actualText)) add('FAIL', `${label}: replacement character U+FFFD in the text`, '');
}

const family = (name) => name.replace(/^[A-Z]{6}\+/, '').replace(/[-,](Bold|Italic|Regular|Oblique|BoldItalic|BoldOblique|Light|Medium|Semibold|Black|Roman)\b.*$/i, '').replace(/MT$/, '');
const key = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

async function readPdf(file) {
  const data = new Uint8Array(await readFile(file));
  // CID fonts (Keynote's CJK PDFs) need the predefined CMaps, or pdfjs drops the kana from the text layer.
  const pdfjsDir = path.join(root, 'node_modules/pdfjs-dist');
  const doc = await pdfjs.getDocument({data, useSystemFonts: false, verbosity: 0, cMapUrl: path.join(pdfjsDir, 'cmaps') + '/', cMapPacked: true, standardFontDataUrl: path.join(pdfjsDir, 'standard_fonts') + '/'}).promise;
  const pages = [], fonts = new Set();
  for (let number = 1; number <= doc.numPages; number++) {
    const page = await doc.getPage(number);
    const content = await page.getTextContent();
    let text = '';
    for (const item of content.items) text += item.str + (item.hasEOL ? '\n' : ' ');
    const ops = await page.getOperatorList();
    for (let i = 0; i < ops.fnArray.length; i++) {
      if (ops.fnArray[i] !== pdfjs.OPS.setFont) continue;
      const id = ops.argsArray[i][0];
      try { const font = page.commonObjs.has(id) ? page.commonObjs.get(id) : page.objs.get(id); if (font?.name) fonts.add(font.name); } catch { /* font object not resolved */ }
    }
    pages.push(text);
  }
  await doc.destroy();
  return {pages, fonts: [...fonts].sort()};
}

const results = [];
for (const [id, expected] of Object.entries(manifest.decks)) {
  if (only && id !== only) continue;
  const findings = [];
  const add = (level, check, detail) => findings.push({level, check, detail});
  const pdfFile = path.join(outDir, `${id}.pdf`), pptxFile = path.join(outDir, `${id}.pptx`);
  const summary = {id, title: expected.title, pdf: null, pptx: null};

  if (!(await exists(pdfFile))) add('MISSING', 'PDF export', `${path.relative(root, pdfFile)} not found`);
  else {
    try {
      const pdf = await readPdf(pdfFile);
      summary.pdf = {pages: pdf.pages.length, fonts: pdf.fonts};
      if (pdf.pages.length !== expected.slideCount) add('FAIL', 'PDF page count', `expected ${expected.slideCount}, got ${pdf.pages.length}`);
      expected.slides.forEach((slide, index) => {
        if (pdf.pages[index] !== undefined) textChecks(`PDF slide ${index + 1}`, slide.paragraphs, pdf.pages[index], add);
      });
      // Fonts: every font the deck names should appear in the PDF; anything else is what Keynote substituted.
      const pdfFamilies = [...new Set(pdf.fonts.map(family))];
      const named = expected.fonts;
      const present = named.filter((f) => pdfFamilies.some((p) => key(p).includes(key(f)) || key(f).includes(key(p))));
      const absent = named.filter((f) => !present.includes(f));
      const extra = pdfFamilies.filter((p) => !named.some((f) => key(p).includes(key(f)) || key(f).includes(key(p))));
      if (absent.length) add('WARN', 'PDF fonts: named in the deck but not embedded', `${absent.join(', ')} (substituted or not used by the text on these pages)`);
      if (extra.length) add('INFO', 'PDF fonts: embedded but not named in the deck', extra.join(', '));
      add('INFO', 'PDF fonts (all)', pdf.fonts.join(', ') || 'none found');
    } catch (error) { add('FAIL', 'PDF could not be read', error.message); }
  }

  if (!(await exists(pptxFile))) add('MISSING', 'PPTX export', `${path.relative(root, pptxFile)} not found`);
  else {
    try {
      const got = await inspectPptx(await JSZip.loadAsync(await readFile(pptxFile)));
      summary.pptx = {slides: got.slideCount, charts: got.charts.length, pictures: got.pictures, notesSlides: got.notesSlides, fonts: got.fonts};
      if (got.slideCount !== expected.slideCount) add('FAIL', 'PPTX slide count', `expected ${expected.slideCount}, got ${got.slideCount}`);
      expected.slides.forEach((slide, index) => {
        const slideNo = index + 1, actual = got.slides[index];
        if (!actual) return;
        textChecks(`PPTX slide ${slideNo}`, [...slide.paragraphs, ...slide.tables.flatMap((t) => t.cells)], [...actual.paragraphs, ...actual.tables.flatMap((t) => t.cells)].join('\n'), add);
        // Tables stay native tables with the same shape.
        if (slide.tables.length !== actual.tables.length) add('FAIL', `PPTX slide ${slideNo}: table count`, `expected ${slide.tables.length}, got ${actual.tables.length}`);
        else slide.tables.forEach((table, t) => { const a = actual.tables[t]; if (table.rows !== a.rows || table.columns !== a.columns) add('FAIL', `PPTX slide ${slideNo}: table ${t + 1} shape`, `expected ${table.rows}x${table.columns}, got ${a.rows}x${a.columns}`); });
        // Charts: native families must stay charts; chartex families are expected to degrade, so record what happened.
        const expectedNative = slide.charts.filter((c) => c.family === 'native'), expectedEx = slide.charts.filter((c) => c.family === 'chartex');
        const gotCharts = actual.charts;
        if (expectedEx.length) {
          add('INFO', `PPTX slide ${slideNo}: chartex ${expectedEx.flatMap((c) => c.kinds).join(',')}`, gotCharts.length ? `Keynote wrote ${gotCharts.length} chart part(s): ${gotCharts.map((c) => c.family + ':' + c.kinds.join('+')).join(', ')}` : `no chart part; pictures on the slide: ${actual.pictures}`);
        } else if (expectedNative.length) {
          if (!gotCharts.length) add('FAIL', `PPTX slide ${slideNo}: chart lost`, `expected ${expectedNative.map((c) => c.kinds.join('+')).join(', ')}; pictures on the slide: ${actual.pictures}`);
          else {
            const want = expectedNative.map((c) => c.kinds.join('+')).join(','), have = gotCharts.map((c) => c.kinds.join('+')).join(',');
            if (want !== have) add('WARN', `PPTX slide ${slideNo}: chart type changed`, `expected ${want}, got ${have}`);
          }
        }
        // Pictures (SVG slide keeps a raster at least).
        if (slide.pictures > 0 && actual.pictures < slide.pictures) add('FAIL', `PPTX slide ${slideNo}: picture lost`, `expected ${slide.pictures}, got ${actual.pictures}`);
        if (slide.hasSvgPicture && actual.hasSvgPicture) add('INFO', `PPTX slide ${slideNo}: SVG kept`, 'the export still carries an SVG picture part');
        // Notes.
        const wantNotes = (slide.notes ?? []).join(' '), haveNotes = (actual.notes ?? []).join(' ');
        if (wantNotes && !haveNotes) add('FAIL', `PPTX slide ${slideNo}: speaker notes lost`, wantNotes);
        else if (wantNotes) { const r = findParagraph(haveNotes, wantNotes); if (r.status !== 'exact') add('WARN', `PPTX slide ${slideNo}: speaker notes differ`, `expected "${wantNotes}", got "${haveNotes}"`); }
        else if (haveNotes) add('INFO', `PPTX slide ${slideNo}: notes added by Keynote`, haveNotes);
        // Background kind.
        if (slide.background !== actual.background) add('INFO', `PPTX slide ${slideNo}: background`, `expected ${slide.background}, got ${actual.background}`);
      });
      const named = expected.fonts, gotFonts = got.fonts;
      const absent = named.filter((f) => !gotFonts.some((g) => key(g) === key(f)));
      if (absent.length) add('WARN', 'PPTX fonts: named in the deck but not in the Keynote export', absent.join(', '));
      add('INFO', 'PPTX fonts (Keynote export)', gotFonts.join(', ') || 'none found');
      const lostLang = expected.languages.filter((l) => !got.languages.includes(l));
      if (lostLang.length) add('WARN', 'PPTX language tags lost', lostLang.join(', '));
    } catch (error) { add('FAIL', 'PPTX could not be read', error.message); }
  }
  summary.findings = findings;
  summary.status = findings.some((f) => f.level === 'FAIL') ? 'FAIL' : findings.some((f) => f.level === 'MISSING') ? 'MISSING' : findings.some((f) => f.level === 'WARN') ? 'WARN' : 'PASS';
  results.push(summary);
}

const counts = Object.fromEntries(['PASS', 'WARN', 'FAIL', 'MISSING'].map((s) => [s, results.filter((r) => r.status === s).length]));
await writeFile(`${reportBase}.json`, JSON.stringify({packages: manifest.packages, counts, results}, null, 2) + '\n');
const lines = [`# Keynote comparison`, '', `Source decks exported with ${Object.entries(manifest.packages).map(([k, v]) => `${k} ${v}`).join(', ')}.`, '', `PASS ${counts.PASS}, WARN ${counts.WARN}, FAIL ${counts.FAIL}, MISSING ${counts.MISSING}`, '', '| Deck | Status | PDF pages | PPTX slides | PPTX charts | Findings (FAIL/WARN) |', '|---|---|---|---|---|---|'];
for (const r of results) lines.push(`| ${r.id} | ${r.status} | ${r.pdf?.pages ?? '-'} | ${r.pptx?.slides ?? '-'} | ${r.pptx?.charts ?? '-'} | ${r.findings.filter((f) => f.level === 'FAIL' || f.level === 'WARN' || f.level === 'MISSING').length} |`);
for (const r of results) {
  lines.push('', `## ${r.id} (${r.status})`, '', r.title, '');
  for (const f of r.findings) lines.push(`- ${f.level}: ${f.check}${f.detail ? ' - ' + f.detail : ''}`);
}
await writeFile(`${reportBase}.md`, lines.join('\n') + '\n');
console.log(lines.slice(0, 8 + results.length).join('\n'));
console.log(`\nReport: ${path.relative(root, reportBase)}.md and .json`);
process.exitCode = counts.FAIL || counts.MISSING ? 1 : 0;
