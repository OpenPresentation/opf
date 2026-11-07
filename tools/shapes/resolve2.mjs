import fs from 'node:fs';
const p='docs/shapes.md';
let s=fs.readFileSync(p,'utf8');
s=s.replace('<<<<<<< HEAD\n## Importing','## Importing').replace('=======\n>>>>>>> origin/codex/sh-06-editor-shapes\n','');
fs.writeFileSync(p,s);
