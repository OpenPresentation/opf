// Resolve the SH-17 x SH-18 conflicts of composition.ts.
import { readFileSync, writeFileSync } from 'node:fs';
const file = 'C:/opf-work/sh-17-linear-smartart/packages/javascript/src/composition.ts';
let i = 0;
const text = readFileSync(file, 'utf8').replace(/^<<<<<<< [^\n]*\n([\s\S]*?)^=======\n([\s\S]*?)^>>>>>>> [^\n]*\n/gm, (_, ours, theirs) => {
  i++;
  const o = ours.split('\n'), t = theirs.split('\n');
  if (i === 1) {
    // theirs: [cycle import, arrangements import, cycle export, arrangements export]; ours: [arrangements import, linear import, arrangements export, linear export]
    const arrangementsImport = t[1].replace('smartArtUnavailable,type Arrangement', 'smartArtUnavailable,SMART_ART_NAMES,type Arrangement');
    const linearImport = o[1].replace(',type ArrangementArrow}', '}');
    const arrangementsExport = t[3].replace('smartArtUnavailable,type Arrangement', 'smartArtUnavailable,SMART_ART_NAMES,type Arrangement');
    const linearExport = o[3].replace(',rightArrowPoints,', ',').replace(',type ArrangementArrow,', ',');
    return [t[0], arrangementsImport, linearImport, t[2], arrangementsExport, linearExport, ''].join('\n');
  }
  if (i === 2) return ours;
  if (i === 3) return theirs + ours;
  if (i === 4) return ours;
  if (i === 5) return `      // Of the card grids, of a cycle's designs and of OPF's rows or columns of a linear arrangement (SH-17, \`largest\`), the one that holds the largest text.
      const largest = design.design === 'cards' || kind === 'cycle' || design.largest === true;
      if (largest && chosen && chosen.design.design === design.design && chosen.size >= result.size) continue;
      chosen = { design, ...result };
      if (design.design === 'smartart' || !largest) break;
    }
    if (!chosen && outside) { chosen = outside; skipped = undefined; }
    if (!chosen) {
      diagnostics.push({ code: 'arrangement-adapted', path: item.path, message: \`The entries of the \${kind === 'chevrons' ? 'row of chevrons' : kind.replace('-', ' ')} do not fit its \${SMART_ART_NAMES[kind].nodes} at the list's size, so they are drawn as a list.\` });
      fillRegionWithList(item, area, top);
`;
  if (i === 6) return ours;
  if (i === 7) return ours;
  throw new Error(`hunk ${i}`);
});
if (i !== 7) throw new Error(`${i} hunks`);
writeFileSync(file, text);
console.log('resolved', i);
