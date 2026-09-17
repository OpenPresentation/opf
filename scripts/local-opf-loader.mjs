// Node loader for exercising sibling repositories against this checkout.
// Does not modify node_modules or package locks. Build OPF before using it.
const dist = new URL('../packages/javascript/dist/', import.meta.url);
export function resolve(specifier, context, nextResolve) {
  if (specifier === '@openpresentation/opf') return { url: new URL('index.js', dist).href, shortCircuit: true };
  if (specifier.startsWith('@openpresentation/opf/')) {
    const subpath = specifier.slice('@openpresentation/opf/'.length);
    if (subpath === 'package.json') return { url: new URL('../package.json', dist).href, shortCircuit: true };
    if (!subpath.includes('..')) return { url: new URL(subpath.startsWith('spec/') ? subpath : `${subpath}.js`, dist).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
