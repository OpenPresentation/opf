// Scratch: the published opf font-policy chunk with its policy literal replaced by a core checkout's spec/reference/font-policy.json
// (the opf#361 PR branch), for listing which renderer goldens move. Never committed. Usage: node make-patch-final.mjs <core checkout>
import {readdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(HERE, '..', 'node_modules', '@openpresentation', 'opf', 'dist');
const policy = JSON.parse(readFileSync(path.join(process.argv[2], 'spec/reference/font-policy.json'), 'utf8'));
const chunk = readdirSync(dist).find(n => /^chunk-.*\.js$/.test(n) && readFileSync(path.join(dist, n), 'utf8').includes('var fontPolicySource = {'));
const src = readFileSync(path.join(dist, chunk), 'utf8');
const start = src.indexOf('var fontPolicySource = {'), end = src.indexOf('// src/font-policy.ts');
const out = `${src.slice(0, start)}var fontPolicySource = ${JSON.stringify(policy, null, 2)};\n\n${src.slice(end)}`;
writeFileSync(path.join(HERE, 'font-policy-chunk.patched.js'), out);
writeFileSync(path.join(HERE, 'target.json'), `${JSON.stringify({original: pathToFileURL(path.join(dist, chunk)).href, patched: pathToFileURL(path.join(HERE, 'font-policy-chunk.patched.js')).href, rows: 'core opf#361 branch font-policy.json'}, null, 1)}\n`);
console.log('patched from', process.argv[2]);
