let shim;
export function initialize(data) {
  shim = data.shim;
}
export function resolve(specifier, context, nextResolve) {
  if (specifier === "@openpresentation/opf") return { url: shim, shortCircuit: true };
  return nextResolve(specifier, context);
}
