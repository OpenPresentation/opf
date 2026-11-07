// node ppt-list.mjs <pptxDir> <out.txt> [roundtrip ids comma list] [extra id=path ...]
import { readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const [dir, out, rtList = '', ...extra] = process.argv.slice(2);
const rt = new Set(rtList.split(',').filter(Boolean));
const lines = readdirSync(dir).filter((f) => f.endsWith('.pptx')).map((f) => {
  const id = f.slice(0, -5);
  return [id, path.win32.normalize(path.resolve(dir, f)), rt.has(id) ? 1 : 0].join('|');
});
for (const item of extra) { const [id, file] = item.split('='); lines.push([id, path.win32.normalize(path.resolve(file)), 1].join('|')); }
writeFileSync(out, lines.join('\r\n') + '\r\n');
console.log(lines.length, lines[0], lines.at(-1));
