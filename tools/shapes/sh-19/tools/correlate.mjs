// node correlate.mjs <sweep>: for the live OPF-layout instances whose layout matched, the gate against the domain facts.
const sweep = process.argv[2] ?? 'sweep';
const { createRequire } = await import('node:module'); const req = createRequire(import.meta.url);
const rows = [];
for (const k of ['pyramid', 'matrix', 'cycle', 'chevrons', 'flow', 'vertical-flow']) {
  const g = req(`../${sweep}/${k}/gate.json`), s = req(`../${sweep}/${k}/stats.json`);
  for (const r of g) if (r.drew === 'SmartArt (OPF layout)') rows.push({ ...r, st: s[r.id] });
}
const t = rows.map(r => ({ id: r.id, layoutOk: r.checks.layout, pass: r.result === 'pass', mad: r.native?.mad, text: r.native?.text, ink: r.st?.ink, stable: r.st?.stable?.every(Boolean), maxl: Math.max(...(r.st?.lines ?? [0])), tot: (r.st?.lines ?? []).reduce((a, b) => a + b, 0), fill: r.st?.fill, script: r.script, design: r.st?.recipe, err: r.st?.error }));
console.log('live OPF', t.length, 'layout ok', t.filter(x => x.layoutOk).length, 'pass', t.filter(x => x.pass).length, 'no stats', t.filter(x => x.ink === undefined).length);
for (const lim of [.04, .06, .08, .1, .12, .15]) for (const lines of [2, 3, 4]) {
  const inn = t.filter(x => x.ink !== undefined && x.ink <= lim && x.stable && x.script === 'latin' && x.maxl <= lines);
  console.log(`ink<=${lim} lines<=${lines} stable latin: ${inn.length}, pass ${inn.filter(x => x.pass).length}; fail: ${inn.filter(x => !x.pass).map(x => `${x.id}(${x.mad},${x.ink},${x.maxl}${x.layoutOk ? '' : ',LAYOUT'})`).slice(0, 6).join(' ')}`);
}
