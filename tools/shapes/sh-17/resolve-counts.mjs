// Resolve the count and list conflicts: main (SH-18) has 33 layouts; SH-17 adds three, so every count is main's plus three.
import { readFileSync, writeFileSync } from 'node:fs';
const root = 'C:/opf-work/sh-17-linear-smartart/';
const bump = (text, pairs) => text.replace(/\b(33|34|35|99)\b/g, m => String(pairs[m] ?? m));
const plus3 = { 33: 36, 34: 37, 35: 38, 99: 108 };
const files = {
  'packages/cli/test/cli.mjs': (o, t) => bump(t, plus3),
  'packages/editor/test/design-menu-browser.mjs': (o, t) => bump(t, plus3).replace("SH-18 cycle)", "SH-18 cycle, SH-17 chevrons, flow and vertical-flow)"),
  'packages/gallery/test/layout-equivalence.test.mjs': (o, t) => t.replace('"cycle"]);', '"cycle", "chevrons", "flow", "vertical-flow"]);'),
  'packages/gallery/test/records.test.mjs': (o, t) => t.includes('"cycle",') ? t.replace('"cycle",', '"cycle", "chevrons", "flow", "vertical-flow",') : bump(t, plus3),
  'packages/javascript/test/layout-catalog-content.test.mjs': (o, t) => bump(t, plus3),
  'packages/javascript/test/layout-content.test.mjs': (o, t) => bump(t, plus3),
  'packages/javascript/test/layout-templates.test.mjs': (o, t) => bump(t, plus3),
  'packages/javascript/test/template-goldens.test.mjs': (o, t) => bump(t, plus3),
  'packages/pptx/test/template-layouts.mjs': (o, t) => bump(t, plus3),
  'packages/render/test/layout-template-goldens.mjs': (o, t) => bump(t, plus3),
  'packages/render/test/layout-templates.mjs': (o, t) => bump(t, plus3),
  'packages/gallery/scripts/editorial-previews.mjs': (o, t) => t + o,
  'packages/javascript/test/sh-09-arrangements.test.mjs': (o) => o,
};
for (const [file, resolve] of Object.entries(files)) {
  let n = 0;
  const text = readFileSync(root + file, 'utf8').replace(/^<<<<<<< [^\n]*\n([\s\S]*?)^=======\n([\s\S]*?)^>>>>>>> [^\n]*\n/gm, (_, ours, theirs) => { n++; return resolve(ours, theirs); });
  writeFileSync(root + file, text);
  console.log(file, n);
}
