// node canon.mjs a.xml b.xml: compare two layout definitions after normalizing what PowerPoint rewrites on save (the sample, style and
// color data it adds with useDef, namespace declarations, empty r:blip, attribute order).
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const { XMLParser } = createRequire(import.meta.url)('C:/opf-work/sh-19-smartart-layouts/node_modules/.pnpm/fast-xml-parser@5.11.2/node_modules/fast-xml-parser');
const p = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', preserveOrder: true });
const DROP = new Set(['dgm:sampData', 'dgm:styleData', 'dgm:clrData', '?xml']);
// The schema defaults PowerPoint leaves out on save (ECMA-376 Part 1, 21.4).
const DEFAULTS = { 'dgm:constr': { fact: '1', op: 'none', val: '0', refFor: 'self', for: 'self', refType: 'none' }, 'dgm:forEach': { st: '1', cnt: '0', step: '1', hideLastTrans: '1', axis: 'none', ptType: 'all' }, 'dgm:shape': { rot: '0', zOrderOff: '0', hideGeom: '0', lkTxEntry: '0', blipPhldr: '0' }, 'dgm:if': { arg: 'none' }, 'dgm:presOf': { st: '1', cnt: '0', step: '1' } };
function norm(list) {
  const out = [];
  for (const item of list) {
    const name = Object.keys(item).find(k => k !== ':@');
    if (DROP.has(name)) continue;
    const attrs = Object.entries(item[':@'] ?? {}).filter(([a, v]) => !a.startsWith('xmlns') && !(a === 'r:blip' && v === '') && !(DEFAULTS[name]?.[a] === v)).sort(([a], [b]) => a.localeCompare(b));
    out.push(`<${name}${attrs.map(([a, v]) => ` ${a}="${/^-?\d*\.\d+$/.test(v) && process.env.ROUND ? String(Number(Number(v).toFixed(4))) : v}"`).join('')}>${Array.isArray(item[name]) ? norm(item[name]) : item[name]}</${name}>`);
  }
  return out.join('');
}
const [a, b] = process.argv.slice(2).map(f => norm(p.parse(readFileSync(f, 'utf8'))));
if (a === b) console.log('EQUAL after normalizing');
else { let i = 0; while (a[i] === b[i]) i++; console.log('DIFFERENT at', i, '\n', a.slice(i - 150, i + 150), '\n---\n', b.slice(i - 150, i + 150)); }
