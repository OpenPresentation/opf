// node mklist.mjs <repo> <out.json>: every example deck of the repo.
import {readdirSync, statSync, writeFileSync} from 'node:fs';
import path from 'node:path';
const [repo, out] = process.argv.slice(2);
const root = `${repo}/examples`, list = [];
const slash = (value) => value.split(path.sep).join('/');
const walk = (dir) => { for (const name of readdirSync(dir)) { const p = path.join(dir, name); if (statSync(p).isDirectory()) walk(p); else if (name.endsWith('.opf.json')) list.push({id: 'ex__' + slash(path.relative(root, p)).replace(/\.opf\.json$/, '').split('/').join('__'), file: slash(p), dropCatalogs: false}); } };
walk(root);
writeFileSync(out, JSON.stringify(list, null, 1));
console.log(list.length);
