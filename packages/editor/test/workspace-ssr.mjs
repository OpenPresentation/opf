import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createElement as h } from 'react';
import { renderToStaticMarkup, renderToString } from 'react-dom/server';
import { fileURLToPath } from 'node:url';

// CE-06: the React bindings on the server (no DOM at all): the entry point imports, the component renders an empty container and calls nothing
// of the editor, the hooks give their empty values, and the package declares the new entry points and the optional React peer.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
assert.equal(typeof globalThis.window, 'undefined');
assert.equal(typeof globalThis.document, 'undefined');
const { OpfEditor, useOpfDocument, useOpfSelection, useOpfEditor, createOPFReactComponents } = await import('../dist/react.js');
assert.equal(typeof createOPFReactComponents, 'function', 'the existing factory is still exported');

let asked = 0;
const props = { id: 'ed', className: 'editor', style: { height: 300 }, document: { name: 'Server', slides: [] }, fonts: () => { asked += 1; throw new Error('fonts are asked for on the server'); }, onEditor: () => { asked += 1; }, onChange: () => { asked += 1; } };
const html = renderToString(h(OpfEditor, props));
assert.equal(html, '<div id="ed" class="editor" style="height:300px" data-opf-react=""></div>', 'an empty container: nothing of the editor is rendered on the server');
assert.equal(renderToStaticMarkup(h(OpfEditor, {})), '<div data-opf-react=""></div>');
assert.equal(asked, 0, 'no option, callback or fonts function runs on the server');

function Probe() {
  const { ref, editor } = useOpfEditor({ document: { name: 'x', slides: [] } });
  const document = useOpfDocument(editor);
  const selection = useOpfSelection(editor);
  return h('p', { ref }, JSON.stringify({ editor, document: document ?? null, selection }));
}
assert.equal(renderToString(h(Probe)), '<p>{&quot;editor&quot;:null,&quot;document&quot;:null,&quot;selection&quot;:null}</p>', 'the hooks are empty until the client has mounted an editor');
const NoEditor = () => h('i', null, String(useOpfDocument(null) ?? 'none'));
assert.equal(renderToString(h(NoEditor)), '<i>none</i>');

// The package: the entry points, the types and the optional peer.
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
assert.deepEqual(pkg.exports['./workspace'], { types: './dist/workspace.d.ts', default: './dist/workspace.js' });
assert.deepEqual(pkg.exports['./react'], { types: './dist/react.d.ts', default: './dist/react.js' });
assert.equal(pkg.peerDependencies.react, '>=18');
assert.deepEqual(pkg.peerDependenciesMeta.react, { optional: true }, 'React is an optional peer: only the /react entry needs it');
assert.ok(!pkg.dependencies.react && !pkg.dependencies['react-dom'], 'React is not a dependency');
for (const file of ['workspace.js', 'workspace.d.ts', 'react.js', 'react.d.ts', 'workspace-layouts.d.ts']) assert.ok(existsSync(path.join(root, 'dist', file)), `dist/${file} is built`);
// Only the /react entry imports React.
for (const file of ['index.js', 'workspace.js', 'canvas.js', 'source-pane.js']) {
  assert.ok(!/from\s+["']react["']/.test(readFileSync(path.join(root, 'dist', file), 'utf8')), `${file} does not import react`);
}
const reactSource = readFileSync(path.join(root, 'dist', 'react.js'), 'utf8');
assert.match(reactSource, /import\("\.\/workspace\.js"\)/, 'the editor module is loaded on demand, not when /react is imported');
assert.ok(!/^import .* from "\.\/workspace\.js"/m.test(reactSource));

console.log('workspace SSR checks passed');
