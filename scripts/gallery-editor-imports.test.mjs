import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { UNEXPORTED_EDITOR_MODULES, editorSpecifier, exportsKey, rewriteEditorExampleImports, sourceImports } from './gallery-editor-imports.mjs';

// The editor examples import the library by source path and the pptx.gallery vendoring step rewrites those imports to the published package's
// subpaths (OPF v0.27.0 shipped playground.js importing ../src/workspace-measure.js, which the package does not export, and the vendor build
// failed with "Package subpath './workspace-measure' is not defined by exports"). The packed-install test of the editor
// (packages/editor/test/packed-install.mjs) resolves the same specifiers against the installed tarball; this test is the fast source-level check.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const editor = path.join(root, 'packages/editor');
const manifest = JSON.parse(readFileSync(path.join(editor, 'package.json'), 'utf8'));
const examples = readdirSync(path.join(editor, 'examples')).filter((file) => file.endsWith('.js')).sort();

test('the rewrite maps ../src/<module>.js to the package specifier and keeps the quotes', () => {
  assert.equal(editorSpecifier('index'), '@openpresentation/opf-editor');
  assert.equal(editorSpecifier('workspace'), '@openpresentation/opf-editor/workspace');
  assert.equal(exportsKey('@openpresentation/opf-editor'), '.');
  assert.equal(exportsKey('@openpresentation/opf-editor/workspace'), './workspace');
  const text = `import { a } from "../src/index.js";\nimport {b} from '../src/workspace.js';\nconst c = await import('../src/data.js');\nimport './x.js';\nimport '../src/a/b.js';`;
  assert.equal(rewriteEditorExampleImports(text),
    `import { a } from "@openpresentation/opf-editor";\nimport {b} from '@openpresentation/opf-editor/workspace';\nconst c = await import('@openpresentation/opf-editor/data');\nimport './x.js';\nimport '../src/a/b.js';`);
  assert.deepEqual(sourceImports(text), ['index', 'workspace', 'data']);
});

test('every example import of ../src is a public entry of the editor package', () => {
  assert.ok(examples.includes('playground.js'));
  const missing = [];
  let imports = 0;
  for (const file of examples) {
    for (const module of sourceImports(readFileSync(path.join(editor, 'examples', file), 'utf8'))) {
      imports += 1;
      const specifier = editorSpecifier(module);
      if (!(exportsKey(specifier) in manifest.exports) && !UNEXPORTED_EDITOR_MODULES.includes(specifier)) missing.push(`examples/${file}: ../src/${module}.js -> ${specifier} is not in packages/editor/package.json "exports"`);
    }
  }
  assert.ok(imports > 20, 'the scan found the example imports');
  assert.deepEqual(missing, [], `${missing.join('\n')}\nImport a public entry (for example ./workspace) or export the module deliberately.`);
});

test('every export the examples reach is built from the source module the example imports', () => {
  // The rewrite assumes src/<module>.js is what "./<module>" publishes; "./tables" (table-options) would not be.
  for (const file of examples) {
    for (const module of sourceImports(readFileSync(path.join(editor, 'examples', file), 'utf8'))) {
      const key = exportsKey(editorSpecifier(module));
      if (!(key in manifest.exports)) continue;
      const entry = manifest.exports[key];
      assert.equal(entry.default, `./dist/${module}.js`, `${file}: ${key} publishes ${entry.default}, not the ${module} module the example imports`);
      assert.ok(existsSync(path.join(editor, 'src', `${module}.js`)), `${file}: src/${module}.js does not exist`);
    }
  }
});

test('the unexported-module workaround lists only modules that exist and are still unexported', () => {
  for (const specifier of UNEXPORTED_EDITOR_MODULES) {
    assert.ok(!(exportsKey(specifier) in manifest.exports), `${specifier} is exported now: remove it from UNEXPORTED_EDITOR_MODULES (and the vendoring workaround)`);
    assert.ok(existsSync(path.join(editor, 'src', `${specifier.split('/').pop()}.js`)), `${specifier} has no source module`);
  }
});
