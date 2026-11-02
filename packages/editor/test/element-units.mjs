import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// CE-30 without a browser: the element module is safe to import where there is no DOM (a server render, a bundler's SSR pass), the event list
// covers every event of the workspace handle, and the package, the types and the docs name the same entry points and attributes.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(path.join(root, file), 'utf8');
assert.equal(typeof globalThis.window, 'undefined');
assert.equal(typeof globalThis.customElements, 'undefined');

const element = await import('../dist/element.js');
assert.deepEqual(Object.keys(element).sort(), ['OPF_EDITOR_EVENTS', 'defineOpfEditorElement', 'opfEventType'], 'the entry exports the definer, the event list and the event-type helper');
assert.throws(() => element.defineOpfEditorElement(), /needs a browser/, 'defining needs customElements; importing does not');
await import('../dist/element-define.js');
assert.equal(typeof globalThis.customElements, 'undefined', 'the define entry does nothing on a server');

// Every key of OpfEditorEvents is re-dispatched.
const types = read('src/workspace.d.ts');
const block = types.slice(types.indexOf('export interface OpfEditorEvents {'));
const keys = [];
for (const line of block.slice(0, block.indexOf('\n}\n')).split('\n')) {
  const key = /^ {2}(?:"([^"]+)"|([A-Za-z]+))\??:/.exec(line);
  if (key) keys.push(key[1] ?? key[2]);
}
assert.ok(keys.length >= 30 && keys.includes('ready') && keys.includes('review-goto') && keys.includes('layoutStudio'), `read the event keys: ${keys.join(', ')}`);
for (const key of keys) assert.ok(element.OPF_EDITOR_EVENTS.includes(key), `OPF_EDITOR_EVENTS lacks the workspace event "${key}": add it to src/element.js and docs/web-component.md`);
for (const name of ['deckName', 'expand', 'dirty', 'save', 'review-open']) assert.ok(element.OPF_EDITOR_EVENTS.includes(name), `the chrome's "${name}" event is forwarded`);
assert.deepEqual([...new Set(element.OPF_EDITOR_EVENTS)], [...element.OPF_EDITOR_EVENTS], 'no event twice');
assert.equal(Object.isFrozen(element.OPF_EDITOR_EVENTS), true);

assert.equal(element.opfEventType('ready'), 'opf-ready');
assert.equal(element.opfEventType('layoutStudio'), 'opf-layout-studio');
assert.equal(element.opfEventType('review-goto'), 'opf-review-goto');
assert.equal(element.opfEventType('deck-name'), 'opf-deck-name');

// The package exposes both entries, and keeps the define entry (its import is its effect) out of "no side effects".
const pkg = JSON.parse(read('package.json'));
assert.deepEqual(pkg.exports['./element'], { types: './dist/element.d.ts', default: './dist/element.js' });
assert.deepEqual(pkg.exports['./element/define'], { types: './dist/element-define.d.ts', default: './dist/element-define.js' });
assert.ok(pkg.sideEffects.includes('./dist/element-define.js'), 'a bundler must keep `import "@openpresentation/opf-editor/element/define"`');
assert.ok(!pkg.sideEffects.includes('./dist/element.js'), 'the definer itself has no side effect on import');
for (const file of ['element.js', 'element.d.ts', 'element-define.js', 'element-define.d.ts']) assert.ok(existsSync(path.join(root, 'dist', file)), `dist/${file}`);

const declarations = read('src/element.d.ts');
assert.match(declarations, /interface HTMLElementTagNameMap \{\s*"opf-editor": OpfEditorElement;/, 'the tag name map knows <opf-editor>');
assert.match(declarations, /export declare function defineOpfEditorElement\(name\?: string, defaults\?: OpfEditorElementDefaults\)/);

// The docs name every observed attribute, every event and both entries.
const guide = read('docs/web-component.md');
const observed = [...new Set([...read('src/element.js').matchAll(/const OBSERVED = \[([^\]]*)\]/g)].flatMap((match) => [...match[1].matchAll(/"([^"]+)"/g)].map((item) => item[1])))];
assert.deepEqual(observed, ['layout', 'toolbar', 'readonly', 'theme', 'density', 'slide', 'src', 'fonts']);
for (const attribute of observed) assert.ok(guide.includes(`\`${attribute}\``), `docs/web-component.md documents the "${attribute}" attribute`);
// CE-30: the typings list the same observed attributes as the code.
const typedObserved = /Attributes ((?:`[a-z]+`(?:, | and )?)+) are observed/.exec(declarations.replace(/\s*\*\s*/g, ' '));
assert.ok(typedObserved, 'src/element.d.ts says which attributes are observed');
assert.deepEqual([...typedObserved[1].matchAll(/`([a-z]+)`/g)].map((match) => match[1]), observed, 'src/element.d.ts lists exactly the observed attributes of src/element.js');
for (const name of element.OPF_EDITOR_EVENTS) assert.ok(guide.includes(`\`${element.opfEventType(name)}\``), `docs/web-component.md lists ${element.opfEventType(name)}`);
for (const entry of ['@openpresentation/opf-editor/element', '@openpresentation/opf-editor/element/define', '@openpresentation/opf-editor/styles.css']) assert.ok(guide.includes(entry), `docs/web-component.md names ${entry}`);

console.log('element unit checks passed');
