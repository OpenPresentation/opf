// node import-ppt.mjs <pptx>...: import PowerPoint-authored files with the worktree's opf-pptx and print each slide's layout and list.
import { readFileSync } from 'node:fs';
const { fromPptx } = await import('file:///C:/opf-work/sh-17-linear-smartart/packages/pptx/test/helpers/default-catalog.mjs');
for (const file of process.argv.slice(2)) {
  const diagnostics = [];
  const deck = await fromPptx(readFileSync(file), { onDiagnostic: d => diagnostics.push(d.code) });
  console.log(file.split(/[\/]/).pop(), JSON.stringify(deck.slides.map(s => [s.layout, s.items ?? s.blocks?.map(b => b.items ?? Object.keys(b))])), [...new Set(diagnostics)].join(','));
  if (JSON.stringify(deck).includes('layoutDef')) console.log('  STORED A LAYOUT PART');
}
