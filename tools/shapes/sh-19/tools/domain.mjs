// node domain.mjs <sweep>: candidate domains for OPF's layouts against the gate (live OPF-layout instances).
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url), sweep = process.argv[2] ?? 'sweep3';
const rows = [];
for (const k of ['pyramid', 'matrix', 'cycle', 'chevrons', 'flow', 'vertical-flow']) {
  const g = req(`../${sweep}/${k}/gate.json`), s = req(`../${sweep}/${k}/stats.json`);
  for (const r of g) if (r.drew === 'SmartArt (OPF layout)') rows.push({ id: r.id, pass: r.result === 'pass', result: r.result, mad: r.native?.mad, text: r.native?.text, script: r.script, ...s[r.id], lines: s[r.id]?.lines ?? [] });
}
const test = (name, f) => { const inn = rows.filter(f); console.log(`${name}: ${inn.length} in, ${inn.filter(r => r.pass).length} pass; out ${rows.length - inn.length} (passing out ${rows.filter(r => !f(r) && r.pass).length}); fails in: ${inn.filter(r => !r.pass).map(r => `${r.id}(${r.mad},${r.ink},${r.result})`).join(' ')}`); };
const latin = r => r.script === 'latin';
for (const ink of [.06, .07, .075, .08]) {
  test(`latin ink<=${ink}`, r => latin(r) && r.ink <= ink);
  test(`latin stable ink<=${ink}`, r => latin(r) && r.ink <= ink && r.stable?.every(Boolean));
}
console.log('passing outside latin:', rows.filter(r => !latin(r) && r.pass).map(r => r.id).join(' '));
console.log('by script', ['latin', 'rtl', 'cjk', 'blocks'].map(s => `${s}: ${rows.filter(r => r.script === s).length} live, ${rows.filter(r => r.script === s && r.pass).length} pass`).join('; '));
for (const ink of [.08, .1, .12, .15, .2]) test(`latin one line ink<=${ink}`, r => latin(r) && r.ink <= ink && Math.max(...r.lines) === 1);
for (const ink of [.08, .1, .12]) test(`latin two lines ink<=${ink}`, r => latin(r) && r.ink <= ink && Math.max(...r.lines) <= 2);
const hi = rows.filter(r => latin(r) && r.ink > .08 && r.pass);
console.log('passing above .08:', hi.map(r => `${r.id}(${r.ink},${Math.max(...r.lines)})`).join(' '));
const final = r => latin(r) && r.ink <= .075 && r.stable?.every(Boolean);
test('FINAL latin stable ink<=0.075', final);
const inn = rows.filter(final); console.log('max lines in', Math.max(...inn.map(r => Math.max(...r.lines))), 'designs', [...new Set(inn.map(r => r.recipe + (r.compact ? '-compact' : '')))].join(','), 'counts', inn.map(r => r.lines.length).join(','));
const by = {}; for (const r of inn) by[r.recipe] = (by[r.recipe] ?? 0) + 1; console.log(JSON.stringify(by));
const per = {}; for (const r of inn) (per[r.recipe + (r.compact ? '-compact' : '')] ??= []).push(r.lines.length);
console.log('per design counts', JSON.stringify(Object.fromEntries(Object.entries(per).map(([k, v]) => [k, [...new Set(v)].sort((a, b) => a - b)]))));
