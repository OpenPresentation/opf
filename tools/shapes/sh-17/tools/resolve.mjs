// node resolve.mjs <file> <resolutions.json>: replace the i-th conflict hunk of <file> with resolutions[i] ("ours", "theirs",
// "both" (ours then theirs), "theirs+ours", or literal text). Prints the hunk count.
import { readFileSync, writeFileSync } from 'node:fs';
const [file, spec] = process.argv.slice(2), text = readFileSync(file, 'utf8'), res = JSON.parse(readFileSync(spec, 'utf8'));
let i = 0;
const out = text.replace(/^<<<<<<< [^\n]*\n([\s\S]*?)^=======\n([\s\S]*?)^>>>>>>> [^\n]*\n/gm, (_, ours, theirs) => {
  const r = res[i++];
  if (r === undefined) throw new Error(`no resolution for hunk ${i}`);
  return r === 'ours' ? ours : r === 'theirs' ? theirs : r === 'both' ? ours + theirs : r === 'theirs+ours' ? theirs + ours : r.endsWith('\n') ? r : r + '\n';
});
if (i !== res.length) throw new Error(`${i} hunks, ${res.length} resolutions`);
writeFileSync(file, out);
console.log(file, i, 'hunks');
