// Usage: node r.mjs <edits.mjs>; the module default-exports [[file, old, new, all], ...]; a string old must occur exactly once (or `all`).
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const edits = (await import(pathToFileURL(process.argv[2]).href)).default;
const root = 'C:/opf-work/sh-02-shape-block/';
for (const [file, old, next, all] of edits) {
  const path = root + file;
  const text = fs.readFileSync(path, 'utf8');
  if (old instanceof RegExp) {
    if (!old.test(text)) throw new Error(`${file}: no match for ${old}`);
    fs.writeFileSync(path, text.replace(old, () => next ?? ''));
    console.log('edited', file, 're');
    continue;
  }
  const count = text.split(old).length - 1;
  if (count === 0 || (count > 1 && !all)) throw new Error(`${file}: ${count} matches for ${JSON.stringify(old.slice(0, 160))}`);
  fs.writeFileSync(path, all ? text.split(old).join(next) : text.replace(old, () => next));
  console.log('edited', file, all ? `(${count})` : '');
}
