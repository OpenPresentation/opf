// node merge-redo.mjs <kind>: merge redo/<kind>'s PowerPoint probe into sweep4/<kind>/ppt/probe.json and refresh the redone decks' findings.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const base = 'C:/opf-work/shapes/sh-19', k = process.argv[2], d = `${base}/sweep4/${k}`, t = `${base}/redo/${k}`, CLI = 'C:/opf-work/sh-19-smartart-layouts/packages/cli/dist/index.js';
const read = f => [JSON.parse(readFileSync(f, 'utf8').replace(/^\uFEFF/, ''))].flat();
const all = read(`${d}/ppt/probe.json`), fresh = read(`${t}/ppt/probe.json`), ids = new Set(fresh.map(x => x.file));
writeFileSync(`${d}/ppt/probe.json`, JSON.stringify([...all.filter(x => !ids.has(x.file)), ...fresh], null, 1));
const meta = JSON.parse(readFileSync(`${d}/meta.json`, 'utf8'));
for (const id of ids) {
  const r = JSON.parse(execFileSync('node', [CLI, 'convert', `${d}/decks/${id}.opf.json`, `${t}/x.pptx`, '--force'], { encoding: 'utf8' }));
  meta[`${id}-1`] = { ...meta[`${id}-1`], findings: [...new Set((r.findings ?? []).filter(f => !/typeface-not-office-safe/.test(f.ruleId)).map(f => `${f.ruleId}: ${f.message}`))] };
}
writeFileSync(`${d}/meta.json`, JSON.stringify(meta, null, 2));
console.log(k, [...ids].join(' '));
