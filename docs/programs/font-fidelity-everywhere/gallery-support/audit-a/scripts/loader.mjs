// Resolve @openpresentation/opf and @openpresentation/opf-render to the audit-A worktrees (current mains).
// Mirrors core scripts/local-opf-loader.mjs; does not modify any node_modules.
const S = new URL('../../../sources/', import.meta.url);
const dist = new URL('audit-A-opf/packages/javascript/dist/', S);
const render = new URL('audit-A-opf-render/src/', S);
export function resolve(specifier, context, nextResolve) {
  if (specifier === '@openpresentation/opf') return { url: new URL('index.js', dist).href, shortCircuit: true };
  if (specifier.startsWith('@openpresentation/opf/')) {
    const sub = specifier.slice('@openpresentation/opf/'.length);
    if (sub === 'package.json') return { url: new URL('../package.json', dist).href, shortCircuit: true, importAttributes: { type: 'json' } };
    if (!sub.includes('..')) return { url: new URL(sub.startsWith('spec/') ? sub : `${sub}.js`, dist).href, shortCircuit: true };
  }
  if (specifier === '@openpresentation/opf-render') return { url: new URL('index.js', render).href, shortCircuit: true };
  if (specifier.startsWith('@openpresentation/opf-render/')) return { url: new URL(`${specifier.slice(28)}.js`, render).href, shortCircuit: true };
  return nextResolve(specifier, context);
}
