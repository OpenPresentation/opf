// RR-43 (2026-10-02): snippets for the catalog records that have no pptx.gallery config, so audit B and the parity harness can
// measure them. Run after gen-snippets.mjs (it reads out/snippets.json, the gallery's own snippets) with the audit-B core built.
//
//   node gen-catalog-only.mjs           append the synthetic snippets to out/snippets.json
//   node gen-catalog-only.mjs --only    replace out/snippets.json with only the synthetic snippets
//
// Each synthetic snippet is a gallery snippet of the same kind with only the value swapped, and says so in `synthetic`:
// narratives: the narratives/problem-solution snippet with `narrative` = the id; audiences: the audiences/executive snippet with
// `audience` = [id]; purposes: the tones/formal snippet without `tone`, with `purpose` = the id; slide sizes: the themes/minimal
// snippet with `design.dimensions` = the preset. Only the ids the gallery does not show are added (the catalog-only records of
// the gallery tracker, RR-41), plus every slide-size preset (the gallery has no slide-size page).
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, '../../../sources');
const OUT = path.resolve(here, '../out');
const core = `${SRC}/audit-B-opf/packages/javascript/dist`;
const C = await import(pathToFileURL(`${core}/catalogs.js`).href);
const recs = kind => (Array.isArray(C[kind]) ? C[kind] : C.catalogs?.[kind] ?? []);
const presets = JSON.parse(await readFile(`${core}/spec/schemas/opf.schema.json`, 'utf8')).$defs.DimensionPreset.enum;

const gallery = JSON.parse(await readFile(`${OUT}/snippets.json`, 'utf8'));
const find = (dimension, id) => {
  const s = gallery.find(x => x.dimension === dimension && x.id === id);
  if (!s?.snippet) throw new Error(`gen-catalog-only: no gallery snippet ${dimension}/${id} in out/snippets.json (run gen-snippets.mjs first)`);
  return s.snippet;
};
const shown = dimension => new Set(gallery.filter(x => x.dimension === dimension).map(x => x.id));
const synthetic = (dimension, id, template, from, apply) => {
  const snippet = structuredClone(template);
  apply(snippet);
  snippet.name = `${dimension} ${id} (catalog-only, measured by RR-43)`;
  snippet.tags = [`gallery:${dimension}/${id}`];
  return {dimension, id, snippet, error: null, record: recs(dimension === 'slide-sizes' ? 'none' : dimension).find(r => r.id === id) ?? {id}, synthetic: {from, swapped: dimension === 'slide-sizes' ? 'design.dimensions' : dimension === 'audiences' ? 'audience' : dimension.replace(/s$/, '')}};
};

const out = [];
const narrativesShown = shown('narratives'), audiencesShown = shown('audiences');
for (const r of recs('narratives')) if (!narrativesShown.has(r.id)) out.push(synthetic('narratives', r.id, find('narratives', 'problem-solution'), 'narratives/problem-solution', d => { d.narrative = r.id; }));
for (const r of recs('audiences')) if (!audiencesShown.has(r.id)) out.push(synthetic('audiences', r.id, find('audiences', 'executive'), 'audiences/executive', d => { d.audience = [r.id]; }));
for (const r of recs('purposes')) out.push(synthetic('purposes', r.id, find('tones', 'formal'), 'tones/formal', d => { delete d.tone; d.purpose = r.id; }));
for (const p of presets) out.push(synthetic('slide-sizes', p, find('themes', 'minimal'), 'themes/minimal', d => { d.design = {...d.design, dimensions: p}; }));

const only = process.argv.includes('--only');
await writeFile(`${OUT}/snippets.json`, JSON.stringify(only ? out : [...gallery, ...out], null, 1));
const counts = {}; for (const s of out) counts[s.dimension] = (counts[s.dimension] ?? 0) + 1;
console.log(`${only ? 'wrote' : 'appended'} ${out.length} catalog-only snippets`, counts);
