// node list.mjs <mode> [ids...]: the PowerPoint batch list for ../<mode>/pptx.
import { readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const require_path = (dir, id) => path.win32.normalize(dir + '/' + id + '.pptx');
const [mode, ...only] = process.argv.slice(2);
const dir = `${process.env.SH07_ROOT ?? 'C:/opf-work/shapes/sh-07'}/${mode}/pptx`;
const lines = readdirSync(dir).filter((f) => f.endsWith('.pptx')).map((f) => f.slice(0, -5))
  .filter((id) => !only.length || only.some((o) => id === o || id.startsWith(`${o}-`)))
  .map((id) => [id, require_path(dir, id), 0].join(String.fromCharCode(124)));
writeFileSync(`${process.env.SH07_ROOT ?? 'C:/opf-work/shapes/sh-07'}/${mode}/list.txt`, lines.join('\n'));
console.log(lines.length);
