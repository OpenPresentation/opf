// CE-01: validates the edge corpus with the package's browser build in this process and writes the results to a JSON file:
//   [OPF_EDGE_LIMIT=<documents>] node [--conditions=workerd] [--disallow-code-generation-from-strings] test/support/edge-run.mjs <out.json> [precompiled]
// The optional second argument imports `@openpresentation/opf/precompiled` first, as a host does when its bundler resolves the Node
// build. Not a test; test/precompiled-validators.test.mjs starts it once per way of choosing an engine and compares the files.
import { writeFileSync } from 'node:fs';
import { corpus } from './edge-corpus.mjs';
import { evaluate } from './edge-evaluate.mjs';

if (process.argv[3] === 'precompiled') await import('../../dist/precompiled.js');
const opf = await import('../../dist/browser.js');
// A run that is expected to fail on every document (Ajv with code generation disallowed) logs the whole generated function each time.
const limit = Number(process.env.OPF_EDGE_LIMIT) || Infinity;
const results = Object.fromEntries(corpus().slice(0, limit).map((document) => [document.id, evaluate(opf, document)]));
writeFileSync(process.argv[2], JSON.stringify(results));
console.log(`${Object.keys(results).length} documents`);
