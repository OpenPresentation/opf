#!/usr/bin/env node
// RR-62: core's root and every subpath except the Node-only `/node` and `/node/engine` run in a browser. For each tsup entry of
// packages/javascript this bundles the entry's source with esbuild (browser ESM), with Node builtins and the optional peers
// (@openpresentation/opf-render, @openpresentation/opf-pptx) left external so that an import of one stays visible in the
// metafile, and fails when the bundle imports a Node builtin or a peer, or includes a module of the Node engine (src/node/,
// src/node.ts, src/node-engine.ts). The Node-only entries must hold the engine.
//
//   node scripts/check-browser-safe.mjs
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NODE_ENTRIES, tsupEntries } from './check-catalog-free.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageRoot = path.join(root, 'packages', 'javascript');
const PEERS = /^@openpresentation\/opf-(render|pptx)(\/|$)/;
const BUILTINS = ['fs', 'path', 'url', 'os', 'crypto', 'zlib', 'module', 'child_process', 'net', 'stream', 'util', 'worker_threads'];
const isBuiltin = (specifier) => specifier.startsWith('node:') || BUILTINS.some((name) => specifier === name || specifier.startsWith(`${name}/`));

/** A module of the Node engine: the /node and /node/engine entries and everything under src/node/. */
export const isNodeModule = (input) => /(^|\/)src\/node(\/|\.ts$|-engine\.ts$)/.test(input.split('\\').join('/'));

/** What is wrong with one browser entry's bundle, from its metafile output: Node builtins, peers, engine modules. */
export function entryProblems(name, output) {
  const found = [];
  const imports = (output.imports ?? []).map((item) => item.path);
  const builtins = [...new Set(imports.filter(isBuiltin))];
  const peers = [...new Set(imports.filter((item) => PEERS.test(item)))];
  const engine = Object.keys(output.inputs ?? {}).filter(isNodeModule);
  if (builtins.length) found.push(`${name}: imports Node builtins (${builtins.join(', ')}); only /node and /node/engine may`);
  if (peers.length) found.push(`${name}: imports the optional peers (${peers.join(', ')}); only /node and /node/engine load them`);
  if (engine.length) found.push(`${name}: includes Node engine modules (${engine.map((input) => input.split('\\').join('/').replace(/^.*?(src\/)/, '$1')).join(', ')})`);
  return found;
}

async function main() {
  if (!existsSync(path.join(packageRoot, 'src', 'generated', 'engine-data.ts'))) {
    const generated = spawnSync(process.execPath, ['scripts/generate.mjs'], { cwd: packageRoot, stdio: 'inherit' });
    for (const script of ['scripts/generate-previews.mjs', 'scripts/generate-content.mjs']) if (generated.status === 0) spawnSync(process.execPath, [script], { cwd: packageRoot, stdio: 'inherit' });
  }
  const requireFromCore = createRequire(path.join(packageRoot, 'package.json'));
  const { build } = createRequire(requireFromCore.resolve('tsup'))('esbuild');
  const entries = tsupEntries(readFileSync(path.join(packageRoot, 'tsup.config.ts'), 'utf8'));
  const found = [];
  let browser = 0;
  for (const [name, source] of Object.entries(entries).sort(([a], [b]) => a.localeCompare(b))) {
    const result = await build({
      entryPoints: [path.join(packageRoot, source)],
      bundle: true,
      format: 'esm',
      platform: 'browser',
      target: 'es2022',
      write: false,
      metafile: true,
      logLevel: 'silent',
      // Keep builtins and peers visible: a bundle that reaches one lists it in `imports`.
      external: ['node:*', '@openpresentation/opf-render', '@openpresentation/opf-render/*', '@openpresentation/opf-pptx', '@openpresentation/opf-pptx/*', ...BUILTINS, ...BUILTINS.map((item) => `${item}/*`)],
    });
    const output = Object.values(result.metafile.outputs)[0];
    if (NODE_ENTRIES.has(name)) {
      if (!Object.keys(output.inputs).some(isNodeModule)) found.push(`${name}: the Node-only entry includes no Node engine module`);
      continue;
    }
    browser++;
    found.push(...entryProblems(name, output));
  }
  for (const name of NODE_ENTRIES) if (!(name in entries)) found.push(`the tsup config has no ${name} entry`);
  if (found.length) {
    console.error(`browser-safe check failed:\n${found.map((line) => `  ${line}`).join('\n')}`);
    process.exitCode = 1;
  } else console.log(`browser-safe: ${browser} core entries import no Node builtin, no optional peer and no Node engine module; /node and /node/engine hold the engine.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
