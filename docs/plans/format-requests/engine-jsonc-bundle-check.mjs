// A starting point for the check of engine-jsonc-bundle.md: bundle three core entries the way the Cloudflare adapter for Next.js
// bundles a server (esbuild, platform node, ESM output, the `workerd` condition, `require` available for Node builtins), run each
// bundle, and fail when jsonc-parser's own files are an input or a bundle throws while loading.
//
//   node engine-jsonc-bundle-check.mjs <path to packages/javascript, built>
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const pkg = path.resolve(process.argv[2] ?? 'packages/javascript');
const req = createRequire(path.join(pkg, 'package.json'));
const esbuild = req(req.resolve('esbuild', { paths: [path.dirname(req.resolve('tsup/package.json'))] }));
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'opf-node-bundle-'));
const entries = { validator: '@openpresentation/opf/validator', source: '@openpresentation/opf/source', root: '@openpresentation/opf' };
let failed = false;
for (const [name, specifier] of Object.entries(entries)) {
  const file = path.join(out, `${name}.mjs`);
  const result = await esbuild.build({
    stdin: { contents: `import * as m from '${specifier}'; export const names = Object.keys(m).length;`, resolveDir: pkg, loader: 'js' },
    bundle: true, platform: 'node', format: 'esm', conditions: ['workerd'], outfile: file, metafile: true, logLevel: 'silent',
    // The adapter gives its bundle a working `require` for Node builtins; without one, yaml's Node build fails on require("process").
    banner: { js: 'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);' },
  });
  const inputs = Object.keys(result.metafile.inputs).filter((input) => /[\\/]jsonc-parser[\\/]/.test(input));
  let ran;
  try { ran = `runs (${(await import(pathToFileURL(file).href)).names} names)`; } catch (error) { ran = `THROWS ${String(error.message).split('\n')[0]}`; failed = true; }
  if (inputs.length) failed = true;
  console.log(`${name}: ${ran}; jsonc-parser files resolved from node_modules: ${inputs.length}`);
}
fs.rmSync(out, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
