// node fixture.mjs <out.json>: the SH-19 COM fixture of the interpreter's unit test, from the spike's measured files: each case is an
// OPF-written layout definition (parsed back from the file), a frame (points), a node count, and the shapes PowerPoint drew (points,
// relative to the frame).
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { parseLayoutDefinition } from './layout-xml.mjs';
const spike = 'C:/opf-work/shapes/sh-19/spike';
const sets = [['exp1', ['fill-3', 'interior-3', 'interiorBg-3']], ['exp2', ['rot-0', 'rot-1', 'rot-2', 'rot-3']], ['exp3', ['conn-abs']], ['exp3b', ['close-first', 'close-allAfter']]];
const r4 = v => Math.round(v * 1e4) / 1e4;
const cases = [];
for (const [dir, files] of sets) {
  const m = JSON.parse(readFileSync(`${spike}/${dir}/m.json`, 'utf8').replace(/^\uFEFF/, ''));
  for (const file of files) {
    const deck = [m].flat().find(entry => entry.file === file), d = [deck.diagrams].flat()[0];
    const definition = parseLayoutDefinition(execFileSync('unzip', ['-p', `${spike}/${dir}/${file}.pptx`, 'ppt/diagrams/layout1.xml']).toString());
    const steps = d.sweep ? [d.sweep].flat() : [{ W: d.w, H: d.h, n: d.nodes, shapes: d.shapes }];
    cases.push({ id: `${dir}/${file}`, definition, steps: steps.map(s => ({ frame: [s.W, s.H], count: s.n, shapes: [s.shapes].flat().map(g => [r4(g.l), r4(g.t), r4(g.w), r4(g.h), r4(g.rot)]) })) });
  }
}
writeFileSync(process.argv[2], JSON.stringify({ source: 'SH-19 spike, PowerPoint for Microsoft 365 through COM, 2026-11-07; points, relative to the frame: [left, top, width, height, rotation]', cases }));
console.log(cases.length, 'cases', cases.reduce((n, c) => n + c.steps.length, 0), 'steps');
