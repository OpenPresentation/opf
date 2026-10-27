import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Compartment, Prec } from '@codemirror/state';
import { ViewPlugin, hoverTooltip, lineNumbers } from '@codemirror/view';
import { autocompletion } from '@codemirror/autocomplete';
import { highlightSelectionMatches, search } from '@codemirror/search';
import { lintGutter } from '@codemirror/lint';
import { bracketMatching, codeFolding, foldGutter } from '@codemirror/language';
import { json } from '@codemirror/lang-json';
import { yaml } from '@codemirror/lang-yaml';
import { checkCodeMirrorCopies, duplicateViewError, foreignViewPlugins } from '../src/codemirror-guard.js';

// A second copy of @codemirror/view (a host's own CodeMirror, or a package manager that did not dedupe) makes the editor's EditorView
// ignore every plugin the other copy built: tooltips, completions, problems and find stop working with no error. The guard finds those
// plugins in the extensions the code editor mounts with and says so once per page.

const REPORTED = Symbol.for('@openpresentation/opf-editor:duplicate-codemirror-view');

// One copy: the extensions the code editor really mounts with (every CodeMirror package it uses) hold no foreign plugin.
const ours = [
  autocompletion(), search({ top: true }), highlightSelectionMatches(), lintGutter(), bracketMatching(), codeFolding(), foldGutter(), json(), yaml(),
  lineNumbers(), hoverTooltip(() => null), Prec.high(ViewPlugin.define(() => ({}))), new Compartment().of(ViewPlugin.define(() => ({})).of(1)),
];
assert.deepEqual(foreignViewPlugins(ours), [], 'one copy of @codemirror/view: nothing foreign');

// A real second copy of @codemirror/view, next to the same @codemirror/state (the usual way it happens).
const require = createRequire(import.meta.url);
const viewDir = path.dirname(path.dirname(realpathSync(require.resolve('@codemirror/view'))));
const siblings = path.resolve(viewDir, '..', '..');
const temp = mkdtempSync(path.join(os.tmpdir(), 'opf-cm-copy-'));
try {
  const modules = path.join(temp, 'node_modules');
  mkdirSync(path.join(modules, '@codemirror'), { recursive: true });
  cpSync(viewDir, path.join(modules, '@codemirror', 'view'), { recursive: true, dereference: true });
  for (const name of ['@codemirror/state', 'style-mod', 'crelt', 'w3c-keyname']) {
    symlinkSync(path.join(siblings, name), path.join(modules, name), 'dir');
  }
  const other = await import(pathToFileURL(path.join(modules, '@codemirror', 'view', 'dist', 'index.js')).href);
  assert.notEqual(other.ViewPlugin, ViewPlugin, 'the test loads a second copy');

  const plain = other.ViewPlugin.define(() => ({}));
  const withArgument = other.ViewPlugin.define(() => ({}));
  const tooltip = other.hoverTooltip(() => null);
  const mixed = [ours, plain, Prec.low([withArgument.of('x')]), new Compartment().of(tooltip)];
  const found = foreignViewPlugins(mixed);
  assert.ok(found.includes(plain), 'a plugin of the other copy is found');
  assert.ok(found.includes(withArgument), 'a plugin given an argument (`plugin.of(arg)`) inside a precedence wrapper is found');
  assert.ok(found.length >= 3, `the hover tooltip's plugin inside a compartment is found too (${found.length} found)`);
  assert.ok(found.every((plugin) => !(plugin instanceof ViewPlugin)), 'nothing of the editor’s own copy is reported');
  // From the other copy's point of view, the editor's plugins are the foreign ones.
  assert.ok(foreignViewPlugins(ours, other.ViewPlugin).length > 0);

  // Reported once per page: through onError when the host gave one, else on the console.
  delete globalThis[REPORTED];
  const heard = [];
  assert.equal(checkCodeMirrorCopies(mixed, (error) => heard.push(error)), true);
  assert.equal(checkCodeMirrorCopies(mixed, (error) => heard.push(error)), true, 'a second mount still answers true');
  assert.equal(heard.length, 1, 'onError hears it once');
  assert.equal(heard[0].code, 'duplicate-codemirror');
  assert.match(heard[0].message, /Two copies of @codemirror\/view/);
  assert.match(heard[0].message, /dedupe/);

  delete globalThis[REPORTED];
  const logged = [];
  const original = console.error;
  console.error = (message) => logged.push(message);
  try {
    checkCodeMirrorCopies(mixed);
    checkCodeMirrorCopies(mixed);
    // A host callback that throws: the console still says it.
    delete globalThis[REPORTED];
    checkCodeMirrorCopies(mixed, () => { throw new Error('host'); });
  } finally {
    console.error = original;
  }
  assert.deepEqual(logged, [duplicateViewError().message, duplicateViewError().message], 'the console says it once per page, and when onError throws');

  delete globalThis[REPORTED];
  assert.equal(checkCodeMirrorCopies(ours, () => assert.fail('one copy is not reported')), false);
  delete globalThis[REPORTED];
} finally {
  rmSync(temp, { recursive: true, force: true });
}

console.log('codemirror-guard: a second copy of @codemirror/view is found (plain, with an argument, wrapped) and reported once; one copy is quiet.');
