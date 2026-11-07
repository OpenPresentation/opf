import { readFileSync, writeFileSync } from 'node:fs';
const root = 'C:/opf-work/sh-17-linear-smartart/';
const between = (text, start, end) => { const a = text.indexOf(start); if (a < 0) throw new Error(`no ${start}`); const b = end ? text.indexOf(end, a) : text.length; if (b < 0) throw new Error(`no ${end}`); return text.slice(a, b); };
const insertBefore = (text, marker, addition) => { const at = text.indexOf(marker); if (at < 0) throw new Error(`no marker ${marker}`); return text.slice(0, at) + addition + text.slice(at); };
const files = {
  'spec/schemas/layout.schema.json': (o, t) => {
    const sentence = between(o, "SH-17: 'chevrons'", " Nodes are filled");
    return t.replace('            "cycle"\n', '            "cycle",\n            "chevrons",\n            "flow",\n            "vertical-flow"\n').replace(' Nodes are filled', ` ${sentence} Nodes are filled`);
  },
  'spec/README.md': (o, t) => t.replace('33 v2', '36 v2'),
  'docs/default-catalog.md': (o, t) => t.replace('33 v2', '36 v2'),
  'packages/gallery/README.md': (o, t) => t.includes('| `cycle`') ? t + o : t.replace('the 33 OPF', 'the 36 OPF'),
  'skills/opf-author/SKILL.md': (o, t) => insertBefore(t, " See the OPF repository's docs/smartart.md.", ' ' + between(o, 'Stages or steps in order are layout', " See the OPF repository's docs/smartart.md.")),
  'skills/opf-layout/SKILL.md': (o, t) => insertBefore(t, ' One message: layout `statement`', ' ' + between(o, 'Stages or steps in order, each a word or two:', ' One message: layout `statement`')),
  'skills/opf-export/SKILL.md': (o, t) => t.replace('A `pyramid`, `matrix` or `cycle` layout', 'A `pyramid`, `matrix`, `cycle`, `chevrons`, `flow` or `vertical-flow` layout').replace('Basic Pyramid, Basic Matrix or Basic Cycle', 'Basic Pyramid, Basic Matrix, Basic Cycle, Basic Chevron Process, Basic Process or Vertical Process'),
  'docs/catalog-schema-reference.md': (o, t) => t,
  'docs/validate.md': (o, t) => t,
};
for (const [file, resolve] of Object.entries(files)) {
  let n = 0;
  const text = readFileSync(root + file, 'utf8').replace(/^<<<<<<< [^\n]*\n([\s\S]*?)^=======\n([\s\S]*?)^>>>>>>> [^\n]*\n/gm, (_, ours, theirs) => { n++; return resolve(ours, theirs); });
  writeFileSync(root + file, text);
  console.log(file, n);
}
