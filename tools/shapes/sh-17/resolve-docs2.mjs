import { readFileSync, writeFileSync } from 'node:fs';
const root = 'C:/opf-work/sh-17-linear-smartart/';
const files = {
  'docs/layout-templates.md': (o, t, n) => n === 2
    ? t.replace('`pyramid`, `matrix` or `cycle` (SH-09, SH-18:', '`pyramid`, `matrix`, `cycle`, `chevrons`, `flow` or `vertical-flow` (SH-09, SH-18:')
      .replace('the gallery `pyramid`, `matrix` and `cycle` use them) | none |', "the gallery `pyramid`, `matrix` and `cycle` use them; SH-17: `chevrons` draws the list as PowerPoint's Basic Chevron Process, `flow` as its Basic Process (boxes with arrows) and `vertical-flow` as its Vertical Process, or OPF's own rows or columns of them, used by the gallery layouts of the same names) | none |")
    : t.replace('The 33 built-in', 'The 36 built-in').replace('the 33 built-ins', 'the 36 built-ins'),
  'docs/programs/shapes/burndown.md': (o, t) => t + o,
  'docs/shapes.md': (o, t) => t.replace('The `pyramid`, `matrix` and `cycle` layouts', 'The `pyramid`, `matrix`, `cycle`, `chevrons`, `flow` and `vertical-flow` layouts')
    .replace('Basic Pyramid, Basic Matrix or Basic Cycle,', 'Basic Pyramid, Basic Matrix, Basic Cycle, Basic Chevron Process, Basic Process or Vertical Process,')
    .replace("a cycle's `ellipse` and turned `rightArrow`)", "a cycle's `ellipse`, a `chevron`, and turned `rightArrow`s)"),
};
for (const [file, resolve] of Object.entries(files)) {
  let n = 0;
  const text = readFileSync(root + file, 'utf8').replace(/^<<<<<<< [^\n]*\n([\s\S]*?)^=======\n([\s\S]*?)^>>>>>>> [^\n]*\n/gm, (_, ours, theirs) => resolve(ours, theirs, ++n));
  writeFileSync(root + file, text);
  console.log(file, n);
}
