import {readFileSync, writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const files = ['README.md','docs/compatibility-matrix.md','docs/content-payloads.md','docs/data-import.md','docs/dynamic-composition.md','docs/ecosystem-development.md','docs/live-editor.md','docs/quickstart.md','docs/rich-text.md','docs/table-text-colors.md','docs/font-fidelity.md','skills/opf-edit/references/editor.md','skills/opf-export/references/rendering.md'];
const keep = /\(editor 0\.10\.2\)|Editor 0\.10\.2 follows|editor 0\.10\.2 loads/;
let changed = 0;
for (const f of files) {
  let s = readFileSync(f, 'utf8'); const crlf = s.includes('\r\n'); if (crlf) s = s.replace(/\r\n/g, '\n');
  const out = s.split('\n').map(line => {
    let l = line;
    l = l.replace(/renderer 0\.11\.4/g, 'renderer 0.11.5').replace(/renderer \*\*0\.11\.4\*\*/g, 'renderer **0.11.5**').replace(/opf-render@0\.11\.4/g, 'opf-render@0.11.5').replace(/(`@openpresentation\/opf-render` \| )0\.11\.4/g, '$10.11.5');
    if (!keep.test(l)) l = l.replace(/editor 0\.10\.2/g, 'editor 0.10.3').replace(/Published editor 0\.10\.2/g, 'Published editor 0.10.3').replace(/editor \*\*0\.10\.2\*\*/g, 'editor **0.10.3**').replace(/opf-editor@0\.10\.2/g, 'opf-editor@0.10.3').replace(/(`@openpresentation\/opf-editor` \| )0\.10\.2/g, '$10.10.3');
    return l;
  }).join('\n');
  if (out !== s) { writeFileSync(f, crlf ? out.replace(/\n/g, '\r\n') : out); changed++; console.log('edited', f); }
}
let plan = readFileSync('release-plan.json', 'utf8'); const pcrlf = plan.includes('\r\n'); if (pcrlf) plan = plan.replace(/\r\n/g, '\n');
const rep = (a, b) => { if (plan.split(a).length !== 2) throw new Error(a); plan = plan.replace(a, b); };
rep('"name": "@openpresentation/opf-render",\n      "version": "0.11.4"', '"name": "@openpresentation/opf-render",\n      "version": "0.11.5"');
rep('"name": "@openpresentation/opf-editor",\n      "version": "0.10.2"', '"name": "@openpresentation/opf-editor",\n      "version": "0.10.3"');
const old = 'c7995eda57b4159f0b7f9d403182bf12ec110c28';
if (plan.split(old).length !== 3) throw new Error('editor refs');
plan = plan.split(old).join('633c8e0355b09ff15426cbea33de1318f3bf6eb0');
rep('"opf-render": "1a724a68fdd644061e225e1052612fe834496c35"', '"opf-render": "20495bab72571c9bd83f591496b2c59f0bc35029"');
writeFileSync('release-plan.json', pcrlf ? plan.replace(/\n/g, '\r\n') : plan);
console.log(changed, 'docs edited');
