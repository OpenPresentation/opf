import { readFileSync, realpathSync } from 'node:fs';
import { readFile, realpath, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { registryPlan } from './registry-plan.mjs';
import { UNEXPORTED_EDITOR_MODULES } from './gallery-editor-imports.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const EDITOR_SUBPATH = /^@openpresentation\/opf-editor\/[a-z-]+$/;


/** Every registry entry must be a real file within this consumer, never an ancestor or escaped link. */
export function registryFile(modules, url) {
  const file = realpathSync(fileURLToPath(url));
  const relative = path.relative(modules, file);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Registry package resolves outside the installed consumer: ${file}`);
  }
  return file;
}
export const registryImport = async (modules, resolve, specifier) => import(pathToFileURL(registryFile(modules, resolve(specifier))).href);

// Consume the clean installation produced by test:registry-ecosystem, with no
// sibling source aliases or file dependencies. Keep its registry evidence.
export async function registryToolchain() {
  const consumer = path.join(root, 'artifacts/npm/registry-consumer');
  const plan = registryPlan();
  const lock = JSON.parse(await readFile(path.join(consumer, 'package-lock.json'), 'utf8'));
  const modules = await realpath(path.join(consumer, 'node_modules'));
  const packages = [];
  for (const { name, version } of plan.packages) {
    const directory = await realpath(path.join(modules, name));
    const installed = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
    const record = lock.packages[`node_modules/${name}`];
    if (!directory.startsWith(modules + path.sep) || installed.version !== version ||
        record?.version !== version || !record?.resolved?.startsWith('https://registry.npmjs.org/') ||
        !record?.integrity?.startsWith('sha512-') || record.link) {
      throw new Error(`Expected a clean registry installation of ${name}@${version}; run pnpm test:registry-ecosystem`);
    }
    packages.push({ name, version, tarball: record.resolved, integrity: record.integrity });
  }
  const resolver = path.join(consumer, 'asset-resolver.mjs');
  await writeFile(resolver, 'export const resolve = specifier => import.meta.resolve(specifier);\n');
  const { resolve } = await import(pathToFileURL(resolver).href);
  return {consumer, packages, verificationRefs: plan.verificationRefs, exampleRefs: plan.exampleRefs, ...registryBindings(modules, resolve)};
}

export function registryBindings(modules, resolve) {
  const resolvable = (specifier) => {
    try {
      return Boolean(resolve(specifier));
    } catch {
      return false;
    }
  };
  // RR-20 (core 0.18): core's root export is conditional (node: the full build, browser: dist/browser.js). import.meta.resolve takes
  // the node condition, so a browser bundle takes the subpath's `browser` entry instead, as a browser host's bundler does.
  const browserEntry = (specifier) => {
    const match = /^(@openpresentation\/[a-z-]+)(\/.*)?$/.exec(specifier);
    if (!match) return null;
    let manifestPath;
    // A boundary failure must propagate; it must not fall back to an ancestor entry.
    manifestPath = registryFile(modules, resolve(`${match[1]}/package.json`));
    const entry = JSON.parse(readFileSync(manifestPath, 'utf8')).exports?.[`.${match[2] ?? ''}`];
    return entry && typeof entry === 'object' && typeof entry.browser === 'string' ? registryFile(modules, pathToFileURL(path.join(path.dirname(manifestPath), entry.browser))) : null;
  };
  return {
    import: (specifier) => registryImport(modules, resolve, specifier),
    plugin: (browser = false) => ({
      name: 'published-opf-packages',
      setup(build) {
        build.onResolve({ filter: /^@openpresentation\// }, ({ path: specifier }) => {
          // The playground example imports editor modules the installed release may not list in package.json "exports": font-gate
          // (UNEXPORTED_EDITOR_MODULES), and a module exported only after that release (exact-source, before the release after 0.28.0).
          // Bundle the published file by its path inside the installed package; the bytes are still the registry's.
          if (UNEXPORTED_EDITOR_MODULES.includes(specifier) || (EDITOR_SUBPATH.test(specifier) && !resolvable(specifier))) {
            return { path: registryFile(modules, pathToFileURL(path.join(path.dirname(registryFile(modules, resolve('@openpresentation/opf-editor'))), `${specifier.split('/').pop()}.js`))) };
          }
          if (browser && specifier === '@openpresentation/opf-render') return { path: registryFile(modules, resolve('@openpresentation/opf-render/svg')) };
          return { path: (browser && browserEntry(specifier)) || registryFile(modules, resolve(specifier)) };
        });
      },
    }),
  };
}
