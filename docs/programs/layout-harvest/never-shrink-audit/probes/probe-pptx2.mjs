import { toPptx } from '@openpresentation/opf-pptx';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
const files = execSync('find ../../examples -name "*.opf.json"').toString().trim().split('\n');
let total = 0, hits = [];
for (const f of files) {
  let deck; try { deck = JSON.parse(readFileSync(f,'utf8')); } catch { continue; }
  for (const mode of ['measured','native']) {
    try { const out = await toPptx(deck, { bodyText: mode }); const p = `C:/opf-work/never-shrink/out/x.pptx`; writeFileSync(p, Buffer.from(out));
      const n = execSync(`unzip -p ${p} 'ppt/slides/*.xml' 'ppt/slideLayouts/*.xml' 'ppt/slideMasters/*.xml' | grep -o "normAutofit[^/]*" | wc -l`).toString().trim();
      total++; if (n !== '0') hits.push(`${f} ${mode} ${n}`);
    } catch (e) { }
  }
}
console.log('exports', total, 'with normAutofit', hits.length); console.log(hits.slice(0,20).join('\n'));
