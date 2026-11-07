// SH-02: picture `border` -> `stroke`, mask names -> preset names, cornerRadius -> adjust.adj, in the given files.
import fs from 'node:fs';
const root = 'C:/opf-work/sh-02-shape-block/';
const files = process.argv.slice(2);
const names = { rounded: 'roundRect', circle: 'ellipse', rectangle: 'rect' };
for (const file of files) {
  const path = root + file;
  let text = fs.readFileSync(path, 'utf8'), before = text;
  text = text.replace(/(["']?)shape\1(\s*:\s*)(["'])(rounded|circle|rectangle)\3/g, (_, q, sep, quote, name) => `${q}shape${q}${sep}${quote}${names[name]}${quote}`);
  text = text.replace(/(["']?)cornerRadius\1(\s*:\s*)(-?[\d.]+(?:\s*\*\s*[\w.]+)?)/g, (_, q, sep, value) => q ? `${q}adjust${q}${sep}{ ${q}adj${q}: ${value} }` : `adjust${sep}{ adj: ${value} }`);
  text = text.replace(/(["']?)border\1(\s*:\s*)\{/g, (_, q, sep) => `${q}stroke${q}${sep}{`);
  text = text.replace(/\.image\.border\b/g, '.image.stroke');
  if (text !== before) { fs.writeFileSync(path, text); console.log('renamed', file); }
}
