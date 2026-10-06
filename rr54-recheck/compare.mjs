// RR-54 re-check: compare out\ with manifest.json. No npm install needed. Run reimport.mjs first for C4.
//   node compare.mjs   -> out/compare.md, out/compare.json
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
const json = file => existsSync(file) ? JSON.parse(readFileSync(file, 'utf8').replace(/^﻿/, '')) : undefined;
const reimport = json('out/reimport.json');
const rows = [];
const add = (file, check, status, detail) => rows.push({file, check, status, detail});
for (const [id, deck] of Object.entries(manifest.decks)) {
  for (const [file, record] of Object.entries(deck.files)) {
    const name = file.replace(/\.pptx$/, ''), before = record.build.endsWith('before');
    // C3: read-only open, the deck is untouched.
    const read = json(`out/read-${name}.json`);
    if (!read) add(file, 'C3 open', 'NOT RUN', '');
    else add(file, 'C3 open', read.stage === 'done' && read.sha256Before === record.sha256 && read.sha256After === record.sha256 ? 'PASS' : 'FAIL',
      `stage ${read.stage}; ${read.slides?.length ?? 0} slides; source sha256 ${read.sha256After === record.sha256 ? 'unchanged' : 'CHANGED'}${read.error ? `; ${read.error}` : ''}. A repair prompt is a FAIL: record it by hand.`);
    if (deck.check === 'C2') {
      for (const chart of record.workbook) {
        const label = `C2 Edit Data slide ${chart.slide}${chart.scatter ? ' (scatter)' : ''}`;
        const out = json(`out/editdata-${name}-slide${String(chart.slide).padStart(2, '0')}.json`);
        if (!out) { add(file, label, 'NOT RUN', ''); continue; }
        if (out.stage !== 'done') { add(file, label, 'FAIL', `stage ${out.stage}${out.error ? `; ${out.error}` : ''}`); continue; }
        const wrong = Object.entries(chart.cells).filter(([ref, expected]) => {
          const value = out.cells?.[ref]?.value2;
          return expected === null ? !(value === null || value === undefined || value === '') : value !== expected;
        }).map(([ref, expected]) => `${ref}: expected ${expected === null ? 'blank' : expected}, read ${JSON.stringify(out.cells?.[ref]?.value2)} (text ${JSON.stringify(out.cells?.[ref]?.text)})`);
        const zeros = Object.entries(chart.cells).filter(([, value]) => value === 0).map(([ref]) => ref);
        add(file, label, wrong.length === 0 && out.sha256After === record.sha256 ? 'PASS' : before ? 'BASELINE (expected fail)' : 'FAIL',
          wrong.length ? wrong.join('; ') : `every value cell matches the chart cache (zeros ${zeros.join(', ') || 'none'}; used range ${out.usedRange})`);
      }
    } else {
      const save = json(`out/save-${name}.json`);
      if (!save) add(file, 'C4 save copy', 'NOT RUN', '');
      else if (save.stage !== 'done' || save.sourceSha256After !== record.sha256) add(file, 'C4 save copy', 'FAIL', `stage ${save.stage}; source sha256 ${save.sourceSha256After === record.sha256 ? 'unchanged' : 'CHANGED'}`);
      else {
        const result = reimport?.results?.find(item => item.file === file);
        if (!result) add(file, 'C4 save copy', 'NOT RUN', 'saved; run reimport.mjs');
        else add(file, 'C4 save copy', result.status, `payloads equal ${result.payloadsEqual}, datasets equal ${result.datasetsEqual}; data diagnostics: ${result.dataDiagnostics?.join(', ') || 'none'}; scatter names ${result.scatterPointNames?.join(', ') ?? '-'}; re-spelled codes: ${result.respelledCodes?.join(' ; ') || 'none'}`);
      }
    }
  }
}
const count = status => rows.filter(row => row.status === status).length;
const md = ['# RR-54 re-check: format re-spelling (opf-pptx#171) and workbook zeros (opf-pptx#172)', '',
  `Builds: ${Object.entries(manifest.builds).map(([key, build]) => `${key} ${build.commit} (core ${build.core})`).join(', ')}.`, '',
  `Summary: ${count('PASS')} PASS, ${count('FAIL')} FAIL, ${count('BASELINE (expected fail)')} BASELINE, ${count('NOT RUN')} NOT RUN.`, '',
  '| File | Check | Status | Detail |', '| --- | --- | --- | --- |',
  ...rows.map(row => `| ${row.file} | ${row.check} | ${row.status} | ${String(row.detail).replaceAll('|', '\\|')} |`)];
writeFileSync('out/compare.md', md.join('\n') + '\n');
writeFileSync('out/compare.json', JSON.stringify({builds: manifest.builds, rows}, null, 2) + '\n');
console.log(md.join('\n'));
