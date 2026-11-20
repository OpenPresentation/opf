// RR-105 (#1290, ribbon audit gap 11): the names Home > Layout and View > Slide Master show. The layouts OPF writes carry internal
// names while they are built ("DEFAULT", "OPF auto", "Text (native body)", "OPF auto (furniture 2)", "Cover (no furniture)",
// "Quote (custom:quote)"); after every layout pass, each layout gets a user-facing name: the layout record's own name, "Title Only"
// for OPF's automatic layout ("Title and Text" for its native-body variant), "Blank" for the base layout, and a plain number for a
// second layout of the same name under one master ("Text 2", "Text 3").
//
// A layout's identity is its OPF_LAYOUT_V1 tag, never its name: import reads the tag (template-layouts.js readLayoutTag), and a
// layout without one (the base layout) maps by its type, which these names do not change; only a `cust` layout without a tag is
// matched by name, and none of the names written here is on such a layout.

const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const decoder = new TextDecoder(), encoder = new TextEncoder();

// The suffixes the layout passes add to a base name: a variant (native body, automatic grid), a furniture variant (RR-72), and a
// name taken by another catalog group.
const SUFFIX = /\s+\((?:native body|automatic grid|furniture \d+|no furniture|[^():]+:[^():]+)\)$/;

/** The user-facing base name for a layout's internal name and type. */
export function layoutDisplayName(name, type) {
  let base = String(name ?? '').trim();
  while (SUFFIX.test(base)) base = base.replace(SUFFIX, '');
  if (base === 'OPF auto') return type === 'tx' ? 'Title and Text' : 'Title Only';
  if (base === '' || base === 'DEFAULT' || /^OPF (?:furniture \d+|no furniture)$/.test(base)) return 'Blank';
  return base;
}

const attribute = (tag, name) => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];
const relsOf = path => path.replace(/([^/]+)$/, '_rels/$1.rels');
const resolve = (from, target) => {
  const parts = from.split('/').slice(0, -1);
  for (const segment of target.split('/')) segment === '..' ? parts.pop() : segment !== '.' && parts.push(segment);
  return parts.join('/');
};

/** Rename every slide layout of the package (`output`: path -> [bytes, options]) in master and layout-list order. */
export function nameLayouts(output) {
  const read = path => decoder.decode(output[path][0]);
  const masters = Object.keys(output).filter(path => /^ppt\/slideMasters\/slideMaster\d+\.xml$/.test(path))
    .sort((a, b) => Number(/(\d+)\.xml$/.exec(a)[1]) - Number(/(\d+)\.xml$/.exec(b)[1]));
  const done = new Set();
  for (const master of masters) {
    const rels = output[relsOf(master)] ? read(relsOf(master)) : '';
    const targets = new Map([...rels.matchAll(/<Relationship\b[^>]*>/g)].map(([tag]) => [attribute(tag, 'Id'), tag])
      .filter(([, tag]) => attribute(tag, 'Type') === `${REL}/slideLayout`).map(([id, tag]) => [id, resolve(master, attribute(tag, 'Target'))]));
    const order = [...read(master).matchAll(/<p:sldLayoutId\b[^>]*\br:id="([^"]+)"/g)].map(match => targets.get(match[1])).filter(path => path && output[path]);
    const used = new Map();
    for (const path of order) {
      if (done.has(path)) continue;
      done.add(path);
      const xml = read(path), open = /<p:sldLayout\b[^>]*>/.exec(xml)?.[0] ?? '';
      const current = /<p:cSld\b[^>]*\bname="([^"]*)"/.exec(xml)?.[1];
      const base = layoutDisplayName(current, attribute(open, 'type'));
      const count = (used.get(base) ?? 0) + 1;
      used.set(base, count);
      const name = count === 1 ? base : `${base} ${count}`;
      if (name === current) continue;
      const next = current === undefined ? xml.replace(/<p:cSld\b/, `<p:cSld name="${name}"`) : xml.replace(/(<p:cSld\b[^>]*\bname=")[^"]*(")/, `$1${name}$2`);
      output[path] = [encoder.encode(next), output[path][1]];
    }
  }
}
