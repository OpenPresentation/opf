// Judge the Keynote run of the chart bisect set (opf-pptx#162): per deck in bisect/manifest.json, did Keynote keep the chart?
//   node bisect/judge.mjs [--out out]     (from the keynote-set directory, after the supervisor ran keynote-one.sh on decks/b-*)
// Evidence per deck:
//   pptx: Keynote's PowerPoint export (out/<id>.pptx) has a chart part on slide 1 (lib/inspect-pptx.mjs), with its kinds;
//   pdf:  Keynote's PDF export (out/<id>.pdf) page 1 has vector drawing beyond the slide background and the title
//         (pdfjs operator list: constructPath count; a dropped chart leaves 2, the title-only baseline seen in deck 09),
//         and how many of the chart's category labels appear in the page text.
// Verdict: KEPT (both say chart), DROPPED (neither), MIXED (they disagree), MISSING (an export is absent).
// Writes bisect/judge-report.md and .json; exit code 0 (this is evidence, not a gate).
import {readFile, writeFile, access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import JSZip from 'jszip';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import {inspectPptx} from '../lib/inspect-pptx.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(here);
const args = process.argv.slice(2);
const outDir = path.resolve(root, args.includes('--out') ? args[args.indexOf('--out') + 1] : 'out');
const manifest = JSON.parse(await readFile(path.join(here, 'manifest.json'), 'utf8'));
const exists = (f) => access(f).then(() => true, () => false);
const PATH_BASELINE = 4; // title-only slides in Keynote's PDF: 2 constructPath ops (background + clip)

async function pdfFacts(file) {
  const doc = await pdfjs.getDocument({data: new Uint8Array(await readFile(file)), verbosity: 0}).promise;
  const page = await doc.getPage(1);
  const ops = await page.getOperatorList();
  const count = (op) => ops.fnArray.filter((f) => f === op).length;
  const text = (await page.getTextContent()).items.map((i) => i.str).join(' ');
  const facts = {pages: doc.numPages, constructPath: count(pdfjs.OPS.constructPath), images: count(pdfjs.OPS.paintImageXObject), forms: count(pdfjs.OPS.paintFormXObjectBegin), text};
  await doc.destroy();
  return facts;
}

const rows = [];
for (const [id, deck] of Object.entries(manifest.decks)) {
  const pdfFile = path.join(outDir, `${id}.pdf`), pptxFile = path.join(outDir, `${id}.pptx`), errFile = path.join(outDir, `${id}.osascript.err`);
  const row = {id, role: deck.role, change: deck.change, pptx: null, pdf: null, osascriptError: (await exists(errFile)) ? (await readFile(errFile, 'utf8')).trim().slice(0, 300) : null};
  if (await exists(pptxFile)) {
    const got = await inspectPptx(await JSZip.loadAsync(await readFile(pptxFile)));
    const charts = got.charts.filter((c) => c.slide === 1);
    row.pptx = {slides: got.slideCount, charts: charts.map((c) => `${c.family}:${c.kinds.join('+')}`), pictures: got.pictures, chart: charts.length > 0};
  }
  if (await exists(pdfFile)) {
    const f = await pdfFacts(pdfFile);
    const body = f.text.replace(deck.title, '');
    const labels = deck.categoryLabels.filter((l) => new RegExp(`(^|\\s)${l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`).test(body));
    row.pdf = {pages: f.pages, constructPath: f.constructPath, images: f.images, labelsFound: `${labels.length}/${deck.categoryLabels.length}`, chart: f.constructPath > PATH_BASELINE || labels.length > 0};
  }
  row.verdict = !row.pptx || !row.pdf ? 'MISSING' : row.pptx.chart && row.pdf.chart ? 'KEPT' : !row.pptx.chart && !row.pdf.chart ? 'DROPPED' : 'MIXED';
  rows.push(row);
}

const counts = Object.fromEntries(['KEPT', 'DROPPED', 'MIXED', 'MISSING'].map((v) => [v, rows.filter((r) => r.verdict === v).length]));
await writeFile(path.join(here, 'judge-report.json'), JSON.stringify({packages: manifest.packages, counts, rows}, null, 2) + '\n');
const lines = ['# Keynote chart bisect: verdicts', '', `Decks built with ${Object.entries(manifest.packages).map(([k, v]) => `${k} ${v}`).join(', ')}. KEPT ${counts.KEPT}, DROPPED ${counts.DROPPED}, MIXED ${counts.MIXED}, MISSING ${counts.MISSING}.`, '',
  '| Deck | Role | Verdict | Keynote PPTX chart parts | PDF paths | PDF labels | Change |', '|---|---|---|---|---|---|---|'];
for (const r of rows) lines.push(`| ${r.id} | ${r.role} | ${r.verdict} | ${r.pptx ? (r.pptx.charts.join(', ') || 'none') : '-'} | ${r.pdf?.constructPath ?? '-'} | ${r.pdf?.labelsFound ?? '-'} | ${r.change.replace(/\|/g, '/')} |`);
const errs = rows.filter((r) => r.osascriptError);
if (errs.length) lines.push('', '## osascript errors', '', ...errs.map((r) => `- ${r.id}: ${r.osascriptError}`));
await writeFile(path.join(here, 'judge-report.md'), lines.join('\n') + '\n');
console.log(lines.join('\n'));
