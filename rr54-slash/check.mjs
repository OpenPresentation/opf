// RR-54 slash probe: compare what PowerPoint applied (read-deck.ps1 output) with manifest.json.
// node check.mjs <core packages/javascript checkout, built, at opf#376 d955d600 or later> [out]
// Reads <out>/read-rr54-slash.json and writes <out>/check.md and <out>/check.json. PASS for a slide when every series'
// data-label NumberFormat is not General and core numberFormatFromExcel maps it back to the slide's format (PowerPoint may
// re-spell a code on load, for example \$ for $ or \ before a quoted unit; that is still a PASS).
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const core = await import(pathToFileURL(path.join(path.resolve(process.argv[2] ?? ''), 'dist/index.js')).href);
const out = path.resolve(process.argv[3] ?? path.join(here, 'out'));
const manifest = JSON.parse(await readFile(path.join(here, 'manifest.json'), 'utf8'));
const read = JSON.parse((await readFile(path.join(out, 'read-rr54-slash.json'), 'utf8')).replace(/^﻿/, ''));
const shaOk = String(read.sha256Before ?? '').toLowerCase() === manifest.file.sha256;
const rows = manifest.slides.map(slide => {
  const seen = read.slides?.find(entry => entry.index === slide.index);
  const series = seen?.charts?.[0]?.series ?? [];
  const formats = series.map(entry => entry.labelFormat);
  const ok = series.length > 0 && formats.every(code => typeof code === 'string' && !/^general$/i.test(code.trim()) && core.numberFormatFromExcel(code) === slide.format);
  return {slide: slide.index, format: slide.format, exported: slide.excelCode, powerpoint: formats, result: ok ? 'PASS' : 'FAIL', expectedLabels: slide.labels, png: seen?.png};
});
const verdict = shaOk && read.stage === 'done' && rows.every(row => row.result === 'PASS') ? 'PASS' : 'FAIL';
await writeFile(path.join(out, 'check.json'), `${JSON.stringify({verdict, shaOk, stage: read.stage, powerpoint: read.powerpoint, rows}, null, 2)}\n`);
const md = [`# RR-54 slash probe: ${verdict}`, '', `Deck sha256 ${shaOk ? 'matches' : 'DOES NOT match'} manifest.json; read stage \`${read.stage}\`; PowerPoint ${read.powerpoint?.version ?? '?'} build ${read.powerpoint?.build ?? '?'}.`, '',
  '| Slide | Format | Exported code | PowerPoint label format | Result | Labels the PNG should show |', '| --- | --- | --- | --- | --- | --- |',
  ...rows.map(row => `| ${row.slide} | \`${row.format}\` | \`${row.exported}\` | ${row.powerpoint.map(code => `\`${code}\``).join(', ') || '(none)'} | ${row.result} | ${row.expectedLabels.join(' / ')} |`)].join('\n');
await writeFile(path.join(out, 'check.md'), `${md}\n`);
console.log(md);
