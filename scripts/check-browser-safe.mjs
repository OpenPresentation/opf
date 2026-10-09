#!/usr/bin/env node
// RR-62, RR-70: core runs in a browser and a worker. Two checks:
//
//   1. Sources. For each tsup entry of packages/javascript except the Node build of the root (`index`) and the CLI engine
//      (`node-engine`), this bundles the entry's source with esbuild (browser ESM), with Node builtins and the optional peers
//      (@openpresentation/opf-render, @openpresentation/opf-pptx) left external so that an import of one stays visible in the
//      metafile, and fails when the bundle imports a Node builtin or a peer, or includes a module of the Node engine (src/node/,
//      src/index.ts, src/node-engine.ts). The browser build of the root (`browser`) is one of these entries. The Node entries
//      must hold the engine.
//   2. The package root through its conditional exports. The built package is bundled as an application imports it,
//      `import * as opf from "@openpresentation/opf"`, for the browser (platform browser), for a worker (conditions `worker` and
//      `workerd`, no `browser`) and for a bundler with no runtime condition (`default`). Each bundle must reach dist/browser.js
//      and not the Node build, import no builtin and no peer, and, when run, export the Node build's names with `open`, `save`
//      and `convert` rejecting with `OPFApiError` `node-only`. Under platform node the root must reach the Node build.
//
//   node scripts/check-browser-safe.mjs
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { NODE_ENTRIES, tsupEntries } from './check-catalog-free.mjs';
import { packageManagerInvocation } from './package-manager.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageRoot = path.join(root, 'packages', 'javascript');
const PEERS = /^@openpresentation\/opf-(render|pptx)(\/|$)/;
const BUILTINS = ['fs', 'path', 'url', 'os', 'crypto', 'zlib', 'module', 'child_process', 'net', 'stream', 'util', 'worker_threads'];
const EXTERNAL = ['node:*', '@openpresentation/opf-render', '@openpresentation/opf-render/*', '@openpresentation/opf-pptx', '@openpresentation/opf-pptx/*', ...BUILTINS, ...BUILTINS.map((item) => `${item}/*`)];
const isBuiltin = (specifier) => specifier.startsWith('node:') || BUILTINS.some((name) => specifier === name || specifier.startsWith(`${name}/`));
const slash = (input) => input.split('\\').join('/');

/** A module of the Node engine: everything under src/node/, the Node build of the root (src/index.ts) and the CLI engine (src/node-engine.ts). */
export const isNodeModule = (input) => /(^|\/)src\/node(\/|-engine\.ts$)|(^|packages\/javascript\/)src\/index\.ts$/.test(slash(input));

/** What is wrong with one browser entry's bundle, from its metafile output: Node builtins, peers, engine modules. */
export function entryProblems(name, output) {
  const found = [];
  const imports = (output.imports ?? []).map((item) => item.path);
  const builtins = [...new Set(imports.filter(isBuiltin))];
  const peers = [...new Set(imports.filter((item) => PEERS.test(item)))];
  const engine = Object.keys(output.inputs ?? {}).filter(isNodeModule);
  if (builtins.length) found.push(`${name}: imports Node builtins (${builtins.join(', ')}); only the Node build and the CLI engine may`);
  if (peers.length) found.push(`${name}: imports the optional peers (${peers.join(', ')}); only the Node build and the CLI engine load them`);
  if (engine.length) found.push(`${name}: includes Node engine modules (${engine.map((input) => slash(input).replace(/^.*?(src\/)/, '$1')).join(', ')})`);
  return found;
}

/** The bundles of the package root: how each target bundles it and which build it must reach. */
export const ROOT_TARGETS = [
  { name: 'browser', options: { platform: 'browser' }, build: 'browser' },
  { name: 'worker', options: { platform: 'neutral', mainFields: ['module', 'main'], conditions: ['worker', 'workerd'] }, build: 'browser' },
  { name: 'default', options: { platform: 'neutral', mainFields: ['module', 'main'] }, build: 'browser' },
  { name: 'node', options: { platform: 'node' }, build: 'node' },
];

/** Which build of the root a bundle reached, from its metafile inputs: `node`, `browser`, both or neither. */
export function reachedBuild(inputs) {
  const files = Object.keys(inputs ?? {}).map(slash);
  const node = files.some((input) => /(^|\/)packages\/javascript\/dist\/(index|node-engine)\.js$/.test(input));
  const browser = files.some((input) => /(^|\/)packages\/javascript\/dist\/browser\.js$/.test(input));
  return node && browser ? 'both' : node ? 'node' : browser ? 'browser' : 'neither';
}

/** What is wrong with one root bundle: the build it reached, and (for a browser build) builtins and peers it imports. */
export function rootProblems(target, output) {
  const found = [];
  const reached = reachedBuild(output.inputs);
  if (reached !== target.build) found.push(`root (${target.name}): reaches the ${reached} build, not the ${target.build} build`);
  if (target.build === 'browser') {
    const imports = (output.imports ?? []).map((item) => item.path);
    const builtins = [...new Set(imports.filter(isBuiltin))];
    const peers = [...new Set(imports.filter((item) => PEERS.test(item)))];
    if (builtins.length) found.push(`root (${target.name}): imports Node builtins (${builtins.join(', ')})`);
    if (peers.length) found.push(`root (${target.name}): imports the optional peers (${peers.join(', ')})`);
  }
  return found;
}

const PROBE = `import * as opf from '@openpresentation/opf';
const settle = async (call) => { try { await call(); return 'resolved'; } catch (error) { return { name: error?.name, code: error?.code, sameClass: error instanceof opf.OPFApiError }; } };
export const names = Object.keys(opf).sort();
export const results = {
  open: await settle(() => opf.open('deck.opf.md')),
  save: await settle(() => opf.save({ slides: [] }, 'deck.opf.md')),
  convertFile: await settle(() => opf.convert('deck.opf.md', 'deck.pdf')),
  convertInMemory: await settle(() => opf.convert({ slides: [{ title: 'x' }] }, { format: 'svg' })),
};
`;

async function checkRoot(build) {
  const found = [];
  if (!existsSync(path.join(packageRoot, 'dist', 'browser.js')) || !existsSync(path.join(packageRoot, 'dist', 'index.js'))) {
    const pnpm = packageManagerInvocation('pnpm', ['run', 'build']);
    const built = spawnSync(pnpm.command, pnpm.args, { cwd: packageRoot, stdio: 'inherit' });
    if (built.status !== 0) return ['the core package did not build; the root bundles need dist/'];
  }
  const nodeNames = Object.keys(await import(pathToFileURL(path.join(packageRoot, 'dist', 'index.js')).href)).sort();
  // An application folder whose node_modules holds the package, as an install has it.
  const app = mkdtempSync(path.join(os.tmpdir(), 'opf-browser-safe-'));
  try {
    mkdirSync(path.join(app, 'node_modules', '@openpresentation'), { recursive: true });
    symlinkSync(packageRoot, path.join(app, 'node_modules', '@openpresentation', 'opf'), 'junction');
    for (const target of ROOT_TARGETS) {
      const result = await build({
        stdin: { contents: PROBE, resolveDir: app, sourcefile: 'probe.mjs', loader: 'js' },
        bundle: true,
        format: 'esm',
        target: 'es2022',
        write: false,
        metafile: true,
        logLevel: 'silent',
        absWorkingDir: root,
        external: EXTERNAL,
        ...target.options,
      });
      const output = Object.values(result.metafile.outputs)[0];
      found.push(...rootProblems(target, output));
      if (target.build !== 'browser') continue;
      const file = path.join(app, `bundle-${target.name}.mjs`);
      writeFileSync(file, result.outputFiles[0].contents);
      const run = await import(pathToFileURL(file).href);
      const missing = nodeNames.filter((name) => !run.names.includes(name));
      const extra = run.names.filter((name) => !nodeNames.includes(name));
      if (missing.length || extra.length) found.push(`root (${target.name}): the browser build's names differ from the Node build's (missing ${missing.join(', ') || 'none'}; extra ${extra.join(', ') || 'none'})`);
      for (const [call, outcome] of Object.entries(run.results)) {
        if (outcome?.code !== 'node-only' || outcome.name !== 'OPFApiError' || !outcome.sameClass) found.push(`root (${target.name}): ${call} must reject with OPFApiError node-only (got ${JSON.stringify(outcome)})`);
      }
    }
  } finally {
    rmSync(app, { recursive: true, force: true });
  }
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
      external: EXTERNAL,
    });
    const output = Object.values(result.metafile.outputs)[0];
    if (NODE_ENTRIES.has(name)) {
      if (!Object.keys(output.inputs).some((input) => /(^|\/)src\/node\//.test(slash(input)))) found.push(`${name}: the Node entry includes no Node engine module`);
      continue;
    }
    browser++;
    found.push(...entryProblems(name, output));
  }
  for (const name of [...NODE_ENTRIES, 'browser']) if (!(name in entries)) found.push(`the tsup config has no ${name} entry`);
  found.push(...(await checkRoot(build)));
  if (found.length) {
    console.error(`browser-safe check failed:\n${found.map((line) => `  ${line}`).join('\n')}`);
    process.exitCode = 1;
  } else
    console.log(
      `browser-safe: ${browser} core entries (the browser build of the root among them) import no Node builtin, no optional peer and no Node engine module; the root resolves to the browser build for ${ROOT_TARGETS.filter((target) => target.build === 'browser').map((target) => target.name).join(', ')} (its open, save and convert reject with node-only) and to the Node build for node.`,
    );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
