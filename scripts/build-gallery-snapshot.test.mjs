// The gallery snapshot bundles pptx.gallery's snippet builders with esbuild for Node (CommonJS). Since the snippets import
// core's root, the bundle includes jsonc-parser, whose `main` is a UMD build that esbuild cannot resolve inside a bundle;
// its `module` entry is plain ESM. So every build of the snapshot prefers `module` (mainFields ['module', 'main']).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const core = path.join(root, 'packages/javascript');
const { build } = createRequire(createRequire(path.join(core, 'package.json')).resolve('tsup'))('esbuild');

test('every esbuild build of the gallery snapshot prefers the module entry', () => {
  const source = readFileSync(path.join(root, 'scripts/build-gallery-snapshot.mjs'), 'utf8');
  const builds = [...source.matchAll(/await build\(\{([^\n]*?)\}\);/g)].map((match) => match[1]);
  assert.ok(builds.length >= 2, 'the snippet and image-treatment builds');
  for (const options of builds) assert.match(options, /mainFields:\['module','main'\]/, options.slice(0, 120));
});

test("a Node CommonJS bundle of jsonc-parser works with those mainFields (core's root depends on it)", async () => {
  const result = await build({
    stdin: { contents: "import { parse } from 'jsonc-parser'; module.exports = parse('{\"a\": 1, /* c */ \"b\": [2,]}');", resolveDir: core },
    bundle: true, platform: 'node', format: 'cjs', mainFields: ['module', 'main'], write: false, logLevel: 'silent',
  });
  const module = { exports: {} };
  new Function('module', 'exports', 'require', result.outputFiles[0].text)(module, module.exports, createRequire(import.meta.url));
  assert.deepEqual(module.exports, { a: 1, b: [2] });
});
