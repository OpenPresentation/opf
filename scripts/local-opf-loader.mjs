// Node loader for exercising sibling repositories against this checkout.
// Does not modify node_modules or package locks. Build OPF before using it.
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
