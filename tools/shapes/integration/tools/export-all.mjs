// node export-all.mjs <repo> <outDir> <list.json>   list: [{id, file, dropCatalogs}]
// For each deck: the PPTX and one PNG per slide through the core convert API (the CLI's pipeline: office font pack,
// ensureIcons, measured pictures, images next to the deck). Writes <outDir>/results.json.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const [repo, out, listFile] = process.argv.slice(2);
const { convert } = await import(pathToFileURL(`${repo}/packages/javascript/dist/index.js`).href);
const list = JSON.parse(readFileSync(listFile, 'utf8'));
const results = [];
for (const { id, file, dropCatalogs } of list) {
  const started = Date.now();
  let input = file;
  if (dropCatalogs) { input = JSON.parse(readFileSync(file, 'utf8')); delete input.catalogs; }
  const assetDir = path.dirname(file);
  const row = { id, file };
  try {
    mkdirSync(`${out}/pptx`, { recursive: true });
    mkdirSync(`${out}/preview/${id}`, { recursive: true });
    const p = await convert(input, `${out}/pptx/${id}.pptx`, { assetDir });
    row.pptxFindings = (p.findings ?? []).filter((f) => f.severity !== 'info').map((f) => `${f.severity} ${f.ruleId}`);
    const r = await convert(input, `${out}/preview/${id}/s-{n}.png`, { assetDir });
    row.slides = r.files?.length ?? r.outputs?.length;
    row.ok = true;
  } catch (error) {
    row.ok = false;
    row.error = `${error.code ?? ''} ${error.message}`.slice(0, 400);
  }
  row.ms = Date.now() - started;
  results.push(row);
  console.log(row.ok ? 'ok  ' : 'FAIL', id, row.slides ?? '', row.error ?? '');
}
writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 1));
