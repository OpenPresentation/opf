// RR-54 slash probe (opf#387): number formats whose literal text holds '/' or another Excel special character.
// node build.mjs <opf-pptx checkout>
//   The opf-pptx checkout is codex/rr-54-chart-table-data b076bb6 (opf-pptx#171) with core opf#376 d955d600 linked
//   (node_modules/@openpresentation/opf -> the core checkout's packages/javascript, built). It needs node_modules and a
//   built dist/. Writes decks/rr54-slash.pptx, decks/rr54-slash.opf.json and manifest.json.
import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {realpathSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const pptxDir = path.resolve(process.argv[2] ?? '');
const pptx = await import(pathToFileURL(path.join(pptxDir, 'dist/index.js')).href);
const coreDir = realpathSync(path.join(pptxDir, 'node_modules/@openpresentation/opf'));
const core = await import(pathToFileURL(path.join(coreDir, 'dist/index.js')).href);
const fflate = await import(pathToFileURL(path.join(pptxDir, 'node_modules/fflate/esm/index.mjs')).href);
const git = (dir, ...args) => execFileSync('git', ['-C', dir, ...args]).toString().trim();
const OPTIONS = {seed: 1, timestamp: '2026-10-05T00:00:00Z', zipDate: '2026-10-05T00:00:00Z'};
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

// One column chart per format, data labels on, so each format reaches the series cache, the labels, the value axis and
// the embedded workbook. Slide 1 is a control that passed in opf#385.
const FORMATS = [
  ['$#,##0.0', 'control (passed in opf#385)'],
  ['0.0 m/s', "'/' (Excel's fraction bar) in a unit; failed in opf#387 as 0.0 \"m\"/\"s\""],
  ['km/h 0', "'/' in a prefix"],
  ['#,##0 items/day', "'/' in a longer unit"],
  ['0.0 E+3 m', "'E+' (Excel's exponent) in a unit"],
  ['#,##0 @HQ', "'@' (Excel's text placeholder)"],
  ['#,##0 *est', "'*' (Excel's repeat fill)"],
  ['#,##0 net_rev', "'_' (Excel's skip-width)"],
  ['#,##0 ok?', "'?' (Excel's digit placeholder)"],
  ['0.0% p.a.', "'%' with a literal '.' after it"],
  ['#,##0 (est)', "parentheses around a unit (the '(' stays bare, the rest is quoted)"],
  ['0 "q"', 'literal double quotes (written as \\" escapes)'],
];
const VALUES = [3.25, 4.8, 12.5];
const document = {
  name: 'RR-54 slash probe',
  slides: FORMATS.map(([format, note], index) => ({
    title: `${index + 1}. ${format}`,
    chart: {type: 'column', dataLabels: true, data: {columns: ['Item', {name: 'Value', format}], rows: VALUES.map((value, row) => [String.fromCharCode(97 + row), value])}},
    notes: note,
  })),
};

const bytes = new Uint8Array(await pptx.toPptx(document, OPTIONS));
const parts = fflate.unzipSync(bytes);
const decode = text => text.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const slides = FORMATS.map(([format, note], index) => {
  const chartPart = Object.keys(parts).filter(name => /^ppt\/charts\/chart\d+\.xml$/.test(name)).sort((a, b) => Number(/\d+/.exec(a)[0]) - Number(/\d+/.exec(b)[0]))[index];
  const xml = new TextDecoder().decode(parts[chartPart]);
  const excelCode = decode(/<c:formatCode>([^<]*)<\/c:formatCode>/.exec(xml)?.[1] ?? '');
  const labelCode = decode(/<c:dLbls>[\s\S]*?<c:numFmt formatCode="([^"]*)"/.exec(xml)?.[1] ?? '');
  const axisCode = decode(/<c:valAx>[\s\S]*?<c:numFmt formatCode="([^"]*)"/.exec(xml)?.[1] ?? '');
  return {
    index: index + 1, format, note, chartPart, excelCode, labelCode, axisCode,
    mapsBack: core.numberFormatFromExcel(excelCode) === format,
    labels: VALUES.map(value => core.formatDataNumber(value, format)),
  };
});
for (const slide of slides) if (!slide.mapsBack || slide.excelCode !== slide.labelCode || slide.excelCode !== slide.axisCode) throw new Error(`slide ${slide.index}: export codes disagree ${JSON.stringify(slide)}`);

await mkdir(path.join(here, 'decks'), {recursive: true});
await writeFile(path.join(here, 'decks/rr54-slash.pptx'), bytes);
await writeFile(path.join(here, 'decks/rr54-slash.opf.json'), `${JSON.stringify(document, null, 2)}\n`);
const manifest = {
  item: 'RR-54 slash probe: Excel format codes for literal text with / and other Excel special characters (opf#387 FAIL, fixed in core opf#376 d955d600)',
  build: {pptx: git(pptxDir, 'rev-parse', '--short', 'HEAD'), core: git(coreDir, 'rev-parse', '--short=8', 'HEAD'), coreVersion: JSON.parse(await readFile(path.join(coreDir, 'package.json'), 'utf8')).version},
  options: OPTIONS,
  file: {name: 'decks/rr54-slash.pptx', bytes: bytes.length, sha256: sha(bytes)},
  pass: 'Per slide, PowerPoint keeps the number format: read-deck.ps1 reports a data-label NumberFormat other than General that core numberFormatFromExcel maps back to the slide\'s format (PowerPoint may re-spell it, for example \\$ or \\ before a quote), and the slide PNG shows the labels below. No repair prompt.',
  slides,
};
await writeFile(path.join(here, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`rr54-slash: ${slides.length} slides, ${bytes.length} bytes, sha256 ${manifest.file.sha256}`);
for (const slide of slides) console.log(`${String(slide.index).padStart(2)}  ${slide.format.padEnd(18)} -> ${slide.excelCode.padEnd(22)} labels ${slide.labels.join(' | ')}`);
