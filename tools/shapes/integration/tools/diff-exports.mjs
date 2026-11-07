// Compares two export dirs: preview PNG per slide (sha256) and each PPTX slide part, per deck.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const { unzipSync, strFromU8 } = createRequire('C:/opf-work/sh-phase-2/packages/pptx/package.json')('fflate');
const [a, b] = process.argv.slice(2);
const h = (buf) => createHash('sha256').update(buf).digest('hex');
const preview = [], pptx = [], added = [];
for (const id of readdirSync(`${a}/preview`)) {
  if (!existsSync(`${b}/preview/${id}`)) { added.push(id); continue; }
  for (const f of readdirSync(`${a}/preview/${id}`)) if (!existsSync(`${b}/preview/${id}/${f}`) || h(readFileSync(`${a}/preview/${id}/${f}`)) !== h(readFileSync(`${b}/preview/${id}/${f}`))) preview.push(`${id}#${f.match(/(\d+)/)[1]}`);
  const za = unzipSync(readFileSync(`${a}/pptx/${id}.pptx`)), zb = unzipSync(readFileSync(`${b}/pptx/${id}.pptx`));
  for (const part of Object.keys(za).filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))) if (!zb[part] || strFromU8(za[part]) !== strFromU8(zb[part])) pptx.push(`${id}#${part.match(/(\d+)\.xml/)[1]}`);
}
console.log(JSON.stringify({ added, preview, pptx }, null, 1));
