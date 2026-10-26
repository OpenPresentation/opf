// CE-01: tsup prints every chunk readable again, which turns the minified precompiled validators (scripts/validators-codegen.mjs)
// back into 2 MB of indented code in dist/. Run after tsup: it minifies the chunk that holds them and checks, on the file that
// ships, that it still generates no code at runtime. Identifiers may change, as in the generator (an error's `parentSchema` is an
// object of `schemas` found by identity; property names are never renamed); imports and exports keep their names.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const require = createRequire(import.meta.url);
const { transformSync } = createRequire(require.resolve('tsup'))('esbuild');

/** The unique string src/schema-engine-precompiled.ts keeps, so the chunk that holds the validators can be found. */
const MARKER = 'opf-precompiled-validators';

const chunks = readdirSync(dist).filter((name) => name.endsWith('.js') && readFileSync(path.join(dist, name), 'utf8').includes(`"${MARKER}"`));
if (chunks.length !== 1) throw new Error(`Expected one dist chunk with the precompiled validators, found ${chunks.length} (${chunks.join(', ')}).`);
const file = path.join(dist, chunks[0]);
const before = readFileSync(file, 'utf8');
const code = transformSync(before, { loader: 'js', format: 'esm', target: 'es2022', minify: true, legalComments: 'none' }).code;
if (/\bnew Function\b|\beval\s*\(|\bFunction\s*\(/.test(code) || /\b__require\(/.test(code)) throw new Error(`${chunks[0]} generates code or requires a module at runtime.`);
writeFileSync(file, code);
console.log(`Minified dist/${chunks[0]}: ${before.length} -> ${code.length} bytes.`);
