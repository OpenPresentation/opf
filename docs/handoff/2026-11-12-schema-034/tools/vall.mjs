// Validate every example and doc fixture deck with the built core; print the files with errors.
import fs from 'node:fs'; import path from 'node:path';
const core = await import(path.resolve('packages/javascript/dist/index.js'));
const gallery = await import(path.resolve('packages/gallery/dist/index.js')).catch(() => null);
const files = process.argv.slice(2); let bad = 0;
for (const file of files) {
  let doc; try { doc = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { continue; }
  if (!doc || !Array.isArray(doc.slides)) continue;
  const report = core.checkDocument ? core.checkDocument(doc, { only: ['format'] }) : core.validate(doc);
  const errors = (report.findings ?? []).filter((f) => f.severity === 'error');
  if (errors.length) { bad++; console.log(file); for (const e of errors.slice(0, 4)) console.log('   ', e.ruleId, e.path, '-', String(e.message).slice(0, 140)); }
}
console.log(`${files.length} files, ${bad} with format errors`);
