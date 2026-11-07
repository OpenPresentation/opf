// Resolve the SH-17 x SH-18 conflicts of smart-art.js: SH-18's arrows (native, adjustments, drawing) serve both; SH-17 keeps its chevrons,
// margins, flips and wording.
import { readFileSync, writeFileSync } from 'node:fs';
const file = 'C:/opf-work/sh-17-linear-smartart/packages/pptx/src/smart-art.js';
let i = 0;
let text = readFileSync(file, 'utf8').replace(/^<<<<<<< [^\n]*\n([\s\S]*?)^=======\n([\s\S]*?)^>>>>>>> [^\n]*\n/gm, (_, ours, theirs) => {
  i++;
  if (i === 1) return `  const head = kind === 'pyramid' ? \`Pyramid of \${count} level\${count === 1 ? '' : 's'}, top to bottom\` : kind === 'cycle' ? cycleOutlineHead(count) : kind === 'matrix' ? \`Matrix of \${count} \${count === 1 ? 'entry' : 'entries'}, in reading order\`
    // SH-17: the linear arrangements, in order.
    : \`\${kind === 'chevrons' ? 'Chevrons' : kind === 'flow' ? 'Flow' : 'Vertical flow'} of \${count} \${kind === 'chevrons' ? 'stage' : 'step'}\${count === 1 ? '' : 's'}, \${kind === 'vertical-flow' ? 'top to bottom' : 'in order'}\`;
`;
  if (i === 2) return `const LAYOUT_CATEGORY = Object.freeze({pyramid: 'pyramid', matrix: 'matrix', cycle: 'cycle', chevrons: 'process', flow: 'process', 'vertical-flow': 'process'});\n`;
  if (i === 3) return ours;
  if (i === 4) return ours;
  if (i === 5) return ours + theirs;
  if (i === 6) return `      // SH-18 and SH-17: the arrows of a cycle or a flow (sibTrans2D1) in the primary lightened 40%, without an outline.\n`;
  if (i === 7) {
    // Ours: the node with SH-17's geometry, insets and flip, then SH-17's arrow loop; theirs: the node, then SH-18's arrow after its node.
    const node = ours.slice(0, ours.indexOf('  }\n  // SH-17: the arrows between'));
    const after = theirs.slice(theirs.indexOf('    // SH-18: a cycle\'s arrow after its node.'));
    return node + after.replace("    // SH-18: a cycle's arrow after its node.", "    // SH-18: an arrow after its node (a cycle's, SH-17 a flow's).");
  }
  throw new Error(`hunk ${i}`);
});
if (i !== 7) throw new Error(`${i} hunks`);
// SH-17's own flow arrows are SH-18's now: drop the separate native loop and the adjustment branch.
const loop = /    \/\/ SH-17: a flow's arrows, DrawingML rightArrows turned about their centers[^\n]*\n    for \(const arrow of arrangement\.arrows \?\? \[\]\) \{\n[\s\S]*?\n    \}\n/;
if (!loop.test(text)) throw new Error('native loop');
text = text.replace(loop, '');
const branch = /      if \(record\?\.role === 'arrow'\) return shape\.replace\(geometry\('rightArrow'\)[^\n]*\n/;
if (!branch.test(text)) throw new Error('adjust branch');
text = text.replace(branch, '');
writeFileSync(file, text);
console.log('resolved', i);
