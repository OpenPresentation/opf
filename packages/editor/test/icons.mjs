import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeIcons, resolveIcon } from '../src/icons.js';

// CE-29: the icon helper every part draws through (src/icons.js), against a minimal DOM. The browser run (styling-hooks-browser.mjs) shows the
// icons in each part; this checks the three forms of a given icon, the fallbacks, the decoration and the validation.
class FakeNode {
  constructor(ownerDocument, localName) {
    this.ownerDocument = ownerDocument; this.localName = localName; this.nodeType = 1; this.children = []; this.attributes = new Map();
    const classes = new Set();
    this.classList = { add: (...names) => names.forEach((name) => classes.add(name)), contains: (name) => classes.has(name), get list() { return [...classes]; } };
  }
  setAttribute(name, value) { if (name === 'class') this.classList.add(...String(value).split(/\s+/).filter(Boolean)); else this.attributes.set(name, String(value)); }
  getAttribute(name) { return name === 'class' ? this.classList.list.join(' ') : (this.attributes.get(name) ?? null); }
  hasAttribute(name) { return this.attributes.has(name); }
  append(child) { this.children.push(child); }
}
const makeDocument = () => {
  const doc = {
    createElementNS: (_ns, tag) => new FakeNode(doc, tag),
    importNode(node) { const copy = new FakeNode(doc, node.localName); node.attributes.forEach((value, key) => copy.attributes.set(key, value)); node.classList.list.forEach((name) => copy.classList.add(name)); copy.children = node.children.map((child) => doc.importNode(child)); copy.imported = true; return copy; },
  };
  return doc;
};
const doc = makeDocument();
const other = makeDocument();

// path data: a 24x24 stroked icon in currentColor, decorative
const fromPath = resolveIcon(doc, 'M5 12h14', 'M0 0', { name: 'plus', className: 'opf-test-icon opf-more', size: 16 });
assert.equal(fromPath.localName, 'svg');
assert.equal(fromPath.getAttribute('viewBox'), '0 0 24 24');
assert.equal(fromPath.getAttribute('stroke'), 'currentColor');
assert.equal(fromPath.getAttribute('fill'), 'none');
assert.equal(fromPath.getAttribute('aria-hidden'), 'true');
assert.equal(fromPath.getAttribute('focusable'), 'false');
assert.equal(fromPath.getAttribute('data-opf-icon'), 'plus');
assert.equal(fromPath.getAttribute('width'), '16');
assert.deepEqual(fromPath.classList.list, ['opf-icon', 'opf-test-icon', 'opf-more'], 'opf-icon first, then the part classes');
assert.equal(fromPath.children.length, 1);
assert.equal(fromPath.children[0].getAttribute('d'), 'M5 12h14', 'the given path, not the fallback');

// the fallback: path data, shapes, or nothing
assert.equal(resolveIcon(doc, undefined, 'M1 1h2').children[0].getAttribute('d'), 'M1 1h2');
assert.equal(resolveIcon(doc, null, 'M1 1h2').children[0].getAttribute('d'), 'M1 1h2');
const shapes = resolveIcon(doc, undefined, [['circle', { cx: 12, cy: 12, r: 10 }], ['path', { d: 'M9 9' }]]);
assert.deepEqual(shapes.children.map((child) => child.localName), ['circle', 'path']);
assert.equal(shapes.children[0].getAttribute('r'), '10');
assert.equal(resolveIcon(doc, undefined, null), null, 'no given icon and no fallback: nothing');
assert.equal(resolveIcon(doc, undefined, undefined), null);
assert.equal(resolveIcon(doc, undefined, 'M1 1', {}).hasAttribute('width'), false, 'no size, no width');

// an SVG element: cloned into the document, never moved; the host keeps its own attributes and its own size
const host = new FakeNode(other, 'svg');
host.setAttribute('viewBox', '0 0 16 16');
host.setAttribute('width', '20');
host.setAttribute('stroke', 'red');
host.append(new FakeNode(other, 'circle'));
const cloned = resolveIcon(doc, host, 'M0 0', { name: 'dot', size: 16 });
assert.notEqual(cloned, host);
assert.equal(cloned.imported, true, 'importNode');
assert.equal(cloned.getAttribute('viewBox'), '0 0 16 16');
assert.equal(cloned.getAttribute('stroke'), 'red', 'the host element keeps its own paint');
assert.equal(cloned.getAttribute('width'), '20', 'a width of its own is kept');
assert.equal(cloned.hasAttribute('height'), false);
assert.equal(cloned.children.length, 1);
assert.equal(cloned.getAttribute('aria-hidden'), 'true');
assert.ok(cloned.classList.contains('opf-icon'));
assert.equal(host.classList.contains('opf-icon'), false, 'the original is untouched');
assert.equal(host.hasAttribute('aria-hidden'), false);
assert.notEqual(resolveIcon(doc, host, null), resolveIcon(doc, host, null), 'two uses make two clones');

// a function returning one: called with the document; nothing returned means the fallback
let seen;
const viaFunction = resolveIcon(doc, (d) => { seen = d; return host; }, 'M0 0');
assert.equal(seen, doc);
assert.equal(viaFunction.children[0].localName, 'circle');
assert.equal(resolveIcon(doc, () => 'M2 2h2', 'M0 0').children[0].getAttribute('d'), 'M2 2h2', 'a function may return path data');
assert.equal(resolveIcon(doc, () => undefined, 'M0 0').children[0].getAttribute('d'), 'M0 0');

// bad values are a TypeError, not a silent default
for (const bad of [42, true, {}, '<svg onload=alert(1)>', 'url(#x)', '   ', [], new FakeNode(other, 'div')]) {
  assert.throws(() => resolveIcon(doc, bad, 'M0 0'), TypeError, `rejected: ${Array.isArray(bad) ? '[]' : typeof bad === 'object' ? 'object' : String(bad)}`);
}
assert.throws(() => resolveIcon(doc, () => 7, 'M0 0'), TypeError, 'a function that returns junk');

// normalizeIcons: the names a part has, the three forms, null skipped
assert.deepEqual(normalizeIcons(undefined, ['a']), {});
assert.deepEqual(normalizeIcons(null, ['a']), {});
assert.deepEqual(normalizeIcons({ a: 'M0 0', b: null, c: undefined }, ['a', 'b', 'c']), { a: 'M0 0' });
const fn = () => host;
assert.equal(normalizeIcons({ a: fn }, ['a']).a, fn);
assert.equal(normalizeIcons({ a: host }, ['a']).a, host);
assert.throws(() => normalizeIcons({ typo: 'M0 0' }, ['expand', 'collapse'], 'createExpandButton icons'), (error) => error instanceof RangeError && /createExpandButton icons: "typo" is not an icon of this part\. Use one of expand, collapse/.test(error.message));
assert.throws(() => normalizeIcons({ a: 5 }, ['a']), TypeError);
assert.throws(() => normalizeIcons({ a: '<svg/>' }, ['a'], 'icons'), /icons\.a must be an SVG element/);
assert.throws(() => normalizeIcons(['a'], ['a']), TypeError);
assert.throws(() => normalizeIcons('M0 0', ['a']), TypeError);
assert.throws(() => normalizeIcons(host, ['a']), TypeError, 'an svg is not the options object');
const original = { a: 'M0 0' };
assert.notEqual(normalizeIcons(original, ['a']), original, 'a copy');

// the package wiring: the typings, the export, and each part takes `icons`
const read = (relative) => readFile(new URL(relative, import.meta.url), 'utf8');
const pkg = JSON.parse(await read('../package.json'));
assert.deepEqual(pkg.exports['./icons'], { types: './dist/icons.d.ts', default: './dist/icons.js' });
const types = await read('../src/icons.d.ts');
for (const name of ['OpfIcon', 'OpfIcons', 'resolveIcon', 'normalizeIcons', 'ResolveIconOptions']) assert.match(types, new RegExp(`\\b${name}\\b`), `${name} is typed`);
const parts = { 'editor-expand': ['"expand" | "collapse"'], 'review-pill': ['"valid"', '"unavailable"'], 'shortcuts-sheet': ['"help" | "close"'], 'design-menu': ['"trigger" | "close" | "check"'], 'slide-navigator': ['"previous" | "next"'], 'thumbnail-strip': ['"add"'], toolbar: ['"more"'], presenter: ['"present"'] };
for (const [part, fragments] of Object.entries(parts)) {
  const dts = await read(`../src/${part}.d.ts`);
  assert.match(dts, /import type \{ OpfIcons \} from "\.\/icons\.js"/, `${part}.d.ts imports OpfIcons`);
  for (const fragment of fragments) assert.ok(dts.includes(fragment), `${part}.d.ts documents the icon ${fragment}`);
  assert.match(await read(`../src/${part}.js`), /resolveIcon|normalizeIcons/, `${part}.js draws through src/icons.js`);
}
assert.match(await read('../src/toolbar-actions.d.ts'), /icon\?: OpfIcon;/);
assert.match(await read('../src/toolbar-actions.js'), /resolveIcon/);

console.log('icon helper checks passed');
