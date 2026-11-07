// node try.mjs <file>: sources separated by lines "=== name"; prints the type or the issue of each.
import {readFileSync} from 'node:fs';
import {checkDiagram, layoutDiagram} from 'file:///C:/opf-work/sh-07-native-diagrams/packages/javascript/dist/composition.js';
const measure = (text, size, style) => Array.from(text).length * size * (style.mono ? .6 : style.bold ? .58 : .52);
const parts = readFileSync(process.argv[2], 'utf8').split(/^=== /m).filter(Boolean);
for (const part of parts) {
  const nl = part.indexOf('\n'); const name = part.slice(0, nl).trim(); const src = part.slice(nl + 1).replace(/\s+$/, '');
  const r = checkDiagram(src);
  let extra = '';
  if (r.ok) { try { const d = layoutDiagram(src, {width: 1100, height: 560, nominal: 32, floor: 16, measure, idPrefix: 'd'}); extra = `${Math.round(d.width)}x${Math.round(d.height)} font ${d.fontSize.toFixed(1)} ${d.svg.length}b`; if (process.argv[3]) console.log(d.svg); } catch (e) { extra = 'LAYOUT ' + e.message; } }
  console.log(name.padEnd(22), r.ok ? `ok ${r.type} ${extra}` : `ISSUE ${r.issue.code} L${r.issue.line}:${r.issue.column} ${r.issue.message.slice(0, 150)}`);
}
