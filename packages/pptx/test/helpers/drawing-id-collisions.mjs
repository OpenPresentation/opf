import {XMLParser} from 'fast-xml-parser';

const MC = 'http://schemas.openxmlformats.org/markup-compatibility/2006';
const PML = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const reader = new XMLParser({preserveOrder: true, ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: false});
const nameOf = node => Object.keys(node).find(key => key !== ':@');
const namespacesOf = (inherited, attributes) => {
  const own = {...inherited};
  for (const [key, value] of Object.entries(attributes ?? {})) {
    if (key === 'xmlns') own[''] = value;
    else if (key.startsWith('xmlns:')) own[key.slice(6)] = value;
  }
  return own;
};
const expanded = (name, namespaces) => {
  const colon = name.indexOf(':');
  return colon < 0 ? [namespaces[''], name] : [namespaces[name.slice(0, colon)], name.slice(colon + 1)];
};

// ECMA-376 Part 3 selects one Choice/Fallback before application validation. A pair of IDs can coexist unless at least one
// shared AlternateContent ancestor puts them in different branches. This checks every feasible branch without a combinatorial
// expansion and conservatively retains collisions between independent wrappers, even if their Requires conditions overlap.
// https://learn.microsoft.com/en-us/office/open-xml/general/introduction-to-markup-compatibility
export function drawingIdCollisions(xml) {
  const occurrences = new Map(), collisions = new Set();
  let wrapper = 0;
  const visit = (nodes, namespaces, guards) => {
    for (const node of nodes) {
      const name = nameOf(node);
      if (!name || name.startsWith('#') || name.startsWith('?')) continue;
      const attributes = node[':@'] ?? {}, own = namespacesOf(namespaces, attributes);
      const [namespace, local] = expanded(name, own);
      if (namespace === MC && local === 'AlternateContent') {
        const scope = ++wrapper;
        for (const [branch, child] of node[name].entries()) {
          const childName = nameOf(child), childNamespaces = namespacesOf(own, child[':@']);
          const [childNamespace, childLocal] = expanded(childName, childNamespaces);
          if (childNamespace === MC && (childLocal === 'Choice' || childLocal === 'Fallback')) {
            visit(child[childName], childNamespaces, new Map([...guards, [scope, branch]]));
          } else visit([child], own, guards);
        }
        continue;
      }
      if (namespace === PML && local === 'cNvPr' && attributes.id !== undefined) {
        const rawId = String(attributes.id), id = /^\d+$/.test(rawId) ? BigInt(rawId).toString() : rawId;
        const previous = occurrences.get(id) ?? [];
        if (previous.some(prior => ![...prior].some(([scope, branch]) => guards.has(scope) && guards.get(scope) !== branch))) collisions.add(id);
        previous.push(guards);
        occurrences.set(id, previous);
      }
      if (Array.isArray(node[name])) visit(node[name], own, guards);
    }
  };
  visit(reader.parse(xml), {}, new Map());
  return [...collisions];
}
