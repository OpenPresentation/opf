// render#199: the Node entries locate the files they read (harfbuzzjs's .wasm, the installed `@expo-google-fonts/*` packages, the
// vendored `fonts/` directory) in a form bundlers leave alone, so a Next.js app that imports `/fonts-node` builds with Turbopack and
// no config. A bundler traces `require.resolve` on `createRequire(import.meta.url)` (a .wasm is compiled as a module and fails the
// build; a computed specifier becomes a stub that always throws) and `new URL(<dynamic>, import.meta.url)` (an unrelated asset URL).
// The source guard below keeps every such lookup in src/node-resolve.js, behind the bundlers' ignore comments; the rest checks that
// plain Node resolves exactly as before and that a server without harfbuzzjs still loads fonts and says why it has no subsets.
// `node scripts/check-next-bundle.mjs` builds and serves a real Next.js app against the packed package (network, minutes).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const src = path.join(root, 'src');
// Code only: whole-line `//` comments and JSDoc/block comment lines are prose that may name the patterns.
const code = (text) => text.split('\n').filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line)).join('\n');

// 1. No module but node-resolve.js asks a bundler-visible resolver for a file.
for (const name of readdirSync(src).filter((file) => file.endsWith('.js') && file !== 'node-resolve.js')) {
  const text = code(readFileSync(path.join(src, name), 'utf8'));
  assert.doesNotMatch(text, /createRequire/, `${name}: locate installed files through node-resolve.js, not createRequire`);
  assert.doesNotMatch(text, /\brequire(\.resolve)?\s*\(/, `${name}: no require or require.resolve (bundlers trace them)`);
  assert.doesNotMatch(text, /import\.meta\.resolve/, `${name}: no import.meta.resolve (bundlers trace it)`);
  for (const [, argument] of text.matchAll(/new URL\(\s*([^,()]+?)\s*,\s*import\.meta\.url\s*\)/g)) {
    assert.match(argument, /^(["'])\.\.?\/[^"'`$]+\.m?js\1$/, `${name}: new URL(${argument}, import.meta.url) is an asset reference a bundler rewrites; use packageRoot from node-resolve.js`);
  }
}

// 2. node-resolve.js keeps its one lookup opaque: createRequire through the namespace, a variable specifier, both ignore comments.
{
  const text = code(readFileSync(path.join(src, 'node-resolve.js'), 'utf8'));
  assert.match(text, /import \* as nodeModule from "node:module";/);
  assert.doesNotMatch(text, /import\s*\{[^}]*createRequire/, 'a named createRequire import is what webpack traces');
  const calls = [...text.matchAll(/\b(?!path\.)\w+\.resolve\(([^)]*)\)/g)].map((match) => match[1]);
  assert.deepEqual(calls, ['/* webpackIgnore: true */ /* turbopackIgnore: true */ specifier'], 'one resolve call: ignore comments and a variable specifier');
  for (const name of ['fonts-node.js', 'preview-fonts-node.js']) assert.match(readFileSync(path.join(src, name), 'utf8'), /from "\.\/node-resolve\.js";/, `${name} locates files through node-resolve.js`);
}

// 3. Plain Node resolves exactly what `createRequire(import.meta.url)` of the entry resolved before.
const { packageRoot, resolveInstalled } = await import('../dist/node-resolve.js');
assert.equal(path.resolve(packageRoot), path.resolve(root), 'packageRoot is the package directory');
const before = createRequire(pathToFileURL(path.join(root, 'dist', 'fonts-node.js')));
for (const specifier of ['harfbuzzjs/dist/harfbuzz.wasm', 'harfbuzzjs/dist/harfbuzz-subset.wasm', '@expo-google-fonts/roboto/package.json']) {
  assert.equal(resolveInstalled(specifier), before.resolve(specifier), specifier);
  assert.equal(resolveInstalled(specifier, root), createRequire(path.join(root, 'package.json')).resolve(specifier), `${specifier} from a directory`);
}
assert.throws(() => resolveInstalled('@expo-google-fonts/not-a-font/package.json'), { code: 'MODULE_NOT_FOUND' });
{
  const { loadFonts } = await import('../dist/fonts-node.js');
  const diagnostics = [];
  const fonts = await loadFonts({ onDiagnostic: (diagnostic) => diagnostics.push(diagnostic) });
  assert.equal(typeof fonts.subsets?.subsetDataUrl, 'function', 'plain Node subsets by default');
  assert.deepEqual(diagnostics, [], 'both HarfBuzz engines load in plain Node');
}

// 4. A server that did not ship harfbuzzjs (a bundler's file trace that missed it): fonts load, the handle has no subsets, and
// `harfbuzz-unavailable` names each missing file. The package is copied beside links to every installed package but harfbuzzjs.
const temporary = mkdtempSync(path.join(tmpdir(), 'opf-render-no-harfbuzz-'));
try {
  const packageDirectory = path.join(temporary, 'opf-render'), modules = path.join(packageDirectory, 'node_modules');
  mkdirSync(modules, { recursive: true });
  cpSync(path.join(root, 'dist'), path.join(packageDirectory, 'dist'), { recursive: true });
  cpSync(path.join(root, 'package.json'), path.join(packageDirectory, 'package.json'));
  for (const entry of readdirSync(path.join(root, 'node_modules'))) {
    if (entry === 'harfbuzzjs' || entry.startsWith('.')) continue;
    symlinkSync(path.join(root, 'node_modules', entry), path.join(modules, entry), 'junction');
  }
  const probe = path.join(temporary, 'probe.mjs');
  writeFileSync(probe, `import { loadFonts } from ${JSON.stringify(pathToFileURL(path.join(packageDirectory, 'dist', 'fonts-node.js')).href)};
const diagnostics = [];
const fonts = await loadFonts({ onDiagnostic: (diagnostic) => diagnostics.push(diagnostic) });
console.log(JSON.stringify({ subsets: Boolean(fonts.subsets), faces: fonts.registry.describeFaces().length, diagnostics }));
`);
  const run = spawnSync(process.execPath, [probe], { cwd: temporary, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const result = JSON.parse(run.stdout);
  assert.equal(result.subsets, false, 'no subset engine without harfbuzz-subset.wasm');
  assert.ok(result.faces > 0, 'fonts still load');
  assert.deepEqual(result.diagnostics.map(({ code, package: name, file }) => [code, name, file]), [
    ['harfbuzz-unavailable', 'harfbuzzjs', 'harfbuzzjs/dist/harfbuzz-subset.wasm'],
    ['harfbuzz-unavailable', 'harfbuzzjs', 'harfbuzzjs/dist/harfbuzz.wasm'],
  ]);
  assert.ok(result.diagnostics.every(({ message }) => message.includes('could not be loaded')));
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
console.log('Node entries locate harfbuzzjs, font packages and vendored fonts bundler-safely; a missing harfbuzzjs is reported.');
