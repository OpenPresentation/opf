#!/usr/bin/env node
// FA-21: core's root and every subpath except `@openpresentation/opf/catalog` import no catalog data. For each tsup
// entry of packages/javascript, this bundles the entry's source with esbuild (browser ESM, minified), reads the
// metafile, and fails when a catalog module is among its inputs or when its gzip size passes the recorded budget.
//
//   node scripts/check-catalog-free.mjs            check against scripts/catalog-free-budget.json
//   node scripts/check-catalog-free.mjs --report   print the sizes and catalog bytes, never fail
//   node scripts/check-catalog-free.mjs --update   rewrite the budget from the current sizes (+ headroom)
//
// The generated modules are inputs; the script generates them when they are missing. Catalog modules are the
// generated snapshot (src/generated/catalogs.ts), the layout previews (src/generated/previews.ts), the /catalog entry
// itself (src/catalog.ts) and anything read from spec/catalogs/.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageRoot = path.join(root, 'packages', 'javascript');
const budgetFile = path.join(root, 'scripts', 'catalog-free-budget.json');
const CATALOG_ENTRY = 'catalog';
/** Content entries (the example decks, the docs, the README) change with every example edit: they carry no catalog modules, but no size budget either. */
const CONTENT_ENTRIES = new Set(['examples', 'docs', 'repo-readme']);
/** RR-62, RR-70: the Node entries, the Node build of the root (`index`, the `node` condition) and the CLI engine (`node-engine`,
 * `./internal/engine`), read files and register the default catalog, as a Node host does; they are not browser bundles, so they
 * have neither a catalog rule nor a budget. The browser build of the root (`browser`) has both. scripts/check-browser-safe.mjs
 * proves no other entry reaches them. */
export const NODE_ENTRIES = new Set(['index', 'node-engine']);
/** Headroom over the measured gzip size when the budget is rewritten. */
const HEADROOM = 0.03;

export const isCatalogModule = (input) => /(^|\/)src\/generated\/(catalogs|previews)\.ts$|(^|\/)src\/catalog\.ts$|(^|\/)spec\/catalogs\//.test(input.split(path.sep).join('/'));

/** The tsup entries of the core package, as { name: source }. */
export function tsupEntries(text) {
  const block = /entry\s*[:=]\s*\{([\s\S]*?)\}/.exec(text)?.[1] ?? '';
  return Object.fromEntries([...block.matchAll(/["']?([\w-]+)["']?\s*:\s*["']([^"']+)["']/g)].map((match) => [match[1], match[2]]));
}

async function measure() {
  // The generated modules are inputs; a fresh checkout generates them first.
  if (!existsSync(path.join(packageRoot, 'src', 'generated', 'engine-data.ts'))) {
    const generated = spawnSync(process.execPath, ['scripts/generate.mjs'], { cwd: packageRoot, stdio: 'inherit' });
    for (const script of ['scripts/generate-previews.mjs', 'scripts/generate-content.mjs']) if (generated.status === 0) spawnSync(process.execPath, [script], { cwd: packageRoot, stdio: 'inherit' });
  }
  const requireFromCore = createRequire(path.join(packageRoot, 'package.json'));
  const { build } = createRequire(requireFromCore.resolve('tsup'))('esbuild');
  const entries = tsupEntries(readFileSync(path.join(packageRoot, 'tsup.config.ts'), 'utf8'));
  const results = {};
  for (const [name, source] of Object.entries(entries).sort(([a], [b]) => a.localeCompare(b))) {
    if (NODE_ENTRIES.has(name)) continue;
    const result = await build({
      entryPoints: [path.join(packageRoot, source)],
      bundle: true,
      format: 'esm',
      platform: 'browser',
      target: 'es2022',
      minify: true,
      write: false,
      metafile: true,
      logLevel: 'silent',
    });
    const code = result.outputFiles[0].contents;
    const output = Object.values(result.metafile.outputs)[0];
    const catalogBytes = Object.entries(output.inputs).filter(([input]) => isCatalogModule(input)).reduce((sum, [, entry]) => sum + entry.bytesInOutput, 0);
    const catalogModules = Object.keys(output.inputs).filter(isCatalogModule).map((input) => path.relative(packageRoot, path.resolve(input)).split(path.sep).join('/'));
    results[name] = { minified: code.length, gzip: gzipSync(code, { level: 9 }).length, catalogBytes, catalogModules };
  }
  return results;
}

export function problems(results, budget) {
  const found = [];
  for (const [name, entry] of Object.entries(results)) {
    if (name === CATALOG_ENTRY) {
      if (entry.catalogBytes === 0) found.push(`${name}: the /catalog entry carries no catalog data`);
      // The full gallery catalog (OPF 0.15): opt-in, so it has a budget of its own, which a sync that adds records raises with --update.
      const limit = budget?.entries?.[name];
      if (limit === undefined) found.push(`${name}: no recorded budget; run node scripts/check-catalog-free.mjs --update`);
      else if (entry.gzip > limit) found.push(`${name}: ${entry.gzip} bytes gzipped, over the budget of ${limit}; a catalog sync that adds records raises it with --update`);
      continue;
    }
    if (entry.catalogBytes > 0) found.push(`${name}: ${entry.catalogBytes} bytes from catalog modules (${entry.catalogModules.join(', ')}); only @openpresentation/opf/catalog may import catalog data`);
    if (CONTENT_ENTRIES.has(name)) continue;
    const limit = budget?.entries?.[name];
    if (limit === undefined) found.push(`${name}: no recorded budget; run node scripts/check-catalog-free.mjs --update`);
    else if (entry.gzip > limit) found.push(`${name}: ${entry.gzip} bytes gzipped, over the budget of ${limit}; check what grew, then run --update if it is intended`);
  }
  return found;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const results = await measure();
  const args = process.argv.slice(2);
  if (args.includes('--report')) {
    console.log(JSON.stringify(results, (key, value) => (key === 'catalogModules' ? undefined : value), 2));
  } else if (args.includes('--update')) {
    const entries = Object.fromEntries(Object.entries(results).filter(([name]) => !CONTENT_ENTRIES.has(name)).map(([name, entry]) => [name, Math.ceil(entry.gzip * (1 + HEADROOM))]));
    const measured = Object.fromEntries(Object.entries(results).map(([name, entry]) => [name, { minified: entry.minified, gzip: entry.gzip }]));
    writeFileSync(budgetFile, `${JSON.stringify({ description: 'FA-21: gzip budget (bytes) of each catalog-free core entry, bundled by scripts/check-catalog-free.mjs (esbuild, browser ESM, minified, gzip level 9). The budget is the measured size plus 3% headroom; the content entries (examples, docs, repo-readme) have none. The catalog entry (@openpresentation/opf/catalog, the full pptx.gallery catalog) is the only one that carries catalog data. `measured` is the size when it was last updated.', entries, measured }, null, 2)}\n`);
    console.log(`Wrote ${path.relative(root, budgetFile)}`);
  } else {
    const budget = JSON.parse(readFileSync(budgetFile, 'utf8'));
    const found = problems(results, budget);
    if (found.length) {
      console.error(`catalog-free check failed:\n${found.map((line) => `  ${line}`).join('\n')}`);
      process.exitCode = 1;
    } else console.log(`catalog-free: ${Object.keys(results).length - 1} entries import no catalog data and stay within their gzip budget; /catalog carries ${results[CATALOG_ENTRY]?.catalogBytes ?? 0} catalog bytes.`);
  }
}
