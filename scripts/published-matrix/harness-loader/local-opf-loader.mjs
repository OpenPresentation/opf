// Node loader that points every engine of a harness at one core (MR-34: moved here from scripts/; installed-parity.mjs copies it, with
// register-local-opf.mjs, to sources/parity-opf/scripts/ of its harness layout, where `../packages/javascript/dist/` is the core it
// installed). In this repository set OPF_CORE_DIST to a built core `dist` directory. Does not modify node_modules or package locks.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
// OPF_CORE_DIST (optional) names another built core `dist` directory, to compare two builds (docs/programs/release-readiness/rr-16-corpus-impact.mjs).
const dist = process.env.OPF_CORE_DIST ? pathToFileURL(path.resolve(process.env.OPF_CORE_DIST) + path.sep) : new URL('../packages/javascript/dist/', import.meta.url);
export function resolve(specifier, context, nextResolve) {
  if (specifier === '@openpresentation/opf') return { url: new URL('index.js', dist).href, shortCircuit: true };
  if (specifier.startsWith('@openpresentation/opf/')) {
    const subpath = specifier.slice('@openpresentation/opf/'.length);
    if (subpath === 'package.json') return { url: new URL('../package.json', dist).href, shortCircuit: true };
    // RR-70: the CLI engine is `./internal/engine` (dist/node-engine.js).
    if (subpath === 'internal/engine') return { url: new URL('node-engine.js', dist).href, shortCircuit: true };
    if (!subpath.includes('..')) return { url: new URL(subpath.startsWith('spec/') ? subpath : `${subpath}.js`, dist).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
