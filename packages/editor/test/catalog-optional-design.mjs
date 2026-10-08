import assert from 'node:assert/strict';
import { createEditorSession, setCatalogId, createCatalogSelect } from '../dist/index.js';
import { createOPFReactComponents } from '../dist/react.js';
import { opfCatalogSelect } from '../dist/svelte.js';
import { defaultCatalog } from '@openpresentation/opf/catalog';

// OPF 0.15: the host registers the catalog whose ids the controls offer (the editor library ships none).
const catalogs = [defaultCatalog];

const initial = { name: 'Minimal', slides: [{ title: 'Hello' }] };
for (const path of ['design.theme', '/slides/0/design/theme']) {
  const editor = createEditorSession(initial, { catalogs, rejectInvalid: true });
  let notifications = 0;
  editor.subscribe(() => notifications++);
  setCatalogId(editor, path, 'themes', 'dark');
  assert.equal(editor.get(path), 'dark');
  assert.equal(notifications, 1, 'parent creation and selection are one transaction');
  editor.undo();
  assert.deepEqual(editor.presentation, initial, 'one Undo removes the created parent');
  assert.equal(editor.undo(), null);
  editor.redo();
  assert.equal(editor.get(path), 'dark');
}
// OPF 0.15 references are plain `id` / `name:id` strings; the sibling design fields stay as they are.
const existing = { ...initial, design: { fontScheme: 'roboto', theme: 'classic', contentBox: false } };
const editor = createEditorSession(existing, { catalogs });
setCatalogId(editor, 'design.theme', 'themes', 'dark');
assert.deepEqual(editor.get('design'), { fontScheme: 'roboto', theme: 'dark', contentBox: false });
editor.undo();
assert.deepEqual(editor.presentation, existing);
for (const path of ['design.theme', 'slides.0.design.theme']) {
  const session = createEditorSession(initial, { catalogs });
  assert.throws(() => setCatalogId(session, path, 'themes', 'unknown'), /Unknown/);
  assert.deepEqual(session.presentation, initial);
  assert.equal(session.undo(), null);
}
const strict = createEditorSession(initial, { catalogs });
assert.throws(() => strict.set('design.theme', 'dark'), /parent/i);
assert.throws(() => setCatalogId(strict, 'extension.theme', 'themes', 'dark'), /parent/i);
assert.throws(() => setCatalogId(strict, 'slides.9.design.theme', 'themes', 'dark'), /parent/i);
assert.equal(strict.undo(), null);

const document = { createElement: () => node(), defaultView: { CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } } } };
function node() {
  const handlers = new Map();
  return { ownerDocument: document, value: '', children: [], attributes: {}, events: [],
    setAttribute(key, value) { this.attributes[key] = value; }, removeAttribute(key) { delete this.attributes[key]; },
    appendChild(child) { this.children.push(child); }, removeChild(child) { this.children.splice(this.children.indexOf(child), 1); },
    get firstChild() { return this.children[0]; }, addEventListener(type, fn) { handlers.set(type, fn); }, removeEventListener(type) { handlers.delete(type); },
    dispatchEvent(event) { this.events.push(event); }, setCustomValidity(message) { this.validityMessage = message; },
    reportValidity() { this.reported = true; }, change() { handlers.get('change')(); }
  };
}
const React = { createElement: (tag, props) => ({tag, props}), useSyncExternalStore: (_subscribe, get) => get() };
const { OPFCatalogSelect } = createOPFReactComponents(React);
for (const binding of ['DOM', 'React', 'Svelte']) {
  const session = createEditorSession(initial, { catalogs });
  const failures = [];
  const params = { editor: session, path: 'design.theme', catalogKind: 'themes', onError: error => failures.push(error) };
  let control = node();
  let fire, destroy = () => {};
  if (binding === 'DOM') { control = createCatalogSelect(session, {...params, document}); fire = () => control.change(); destroy = () => control.destroy(); }
  if (binding === 'Svelte') { const action = opfCatalogSelect(control, params); fire = () => control.change(); destroy = () => action.destroy(); }
  if (binding === 'React') fire = () => OPFCatalogSelect(params).props.onChange({ currentTarget: control, defaultPrevented: false });
  control.value = 'dark'; fire();
  assert.equal(session.get('design.theme'), 'dark', binding);
  session.undo(); assert.deepEqual(session.presentation, initial, binding);
  session.redo(); assert.equal(session.get('design.theme'), 'dark', binding);
  control.value = 'unknown'; fire();
  assert.equal(failures.length, 1, binding);
  assert.equal(control.value, 'dark', 'rejected selection restores committed value');
  assert.equal(control.attributes['aria-invalid'], 'true');
  assert.match(control.validityMessage, /Unknown/);
  assert.equal(control.events.at(-1).type, 'opferror');
  assert.equal(session.get('design.theme'), 'dark');
  control.value = 'classic'; fire();
  assert.equal(control.validityMessage, '');
  assert.equal(control.attributes['aria-invalid'], undefined);
  destroy();
}
console.log('Optional design catalog transactions and all three binding error paths passed.');
