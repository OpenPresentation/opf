import { readFile, realpath, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const UNEXPORTED_EDITOR_MODULES = ['@openpresentation/opf-editor/exact-source', '@openpresentation/opf-editor/font-gate'];

// Consume the clean installation produced by test:registry-ecosystem, with no
// sibling source aliases or file dependencies. Keep its registry evidence.
export async function registryToolchain() {
  const consumer = path.join(root, 'artifacts/npm/registry-consumer');
  const plan = JSON.parse(await readFile(path.join(root, 'release-plan.json'), 'utf8'));
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
  return {
    consumer, packages, verificationRefs: plan.verificationRefs, exampleRefs: plan.exampleRefs,
    import: (specifier) => import(resolve(specifier)),
    plugin: (browser = false) => ({
      name: 'published-opf-packages',
      setup(build) {
        build.onResolve({ filter: /^@openpresentation\// }, ({ path: specifier }) => {
          // opf-editor 0.10.0 ships dist/exact-source.js (imported by the playground example, which the build rewrites from
          // ../src/exact-source.js) but does not list it in package.json "exports". Bundle the published file by its path
          // inside the installed package; the bytes are still the registry's. Remove this when a release exports it.
          if (UNEXPORTED_EDITOR_MODULES.includes(specifier)) {
            return { path: path.join(path.dirname(fileURLToPath(resolve('@openpresentation/opf-editor'))), `${specifier.split('/').pop()}.js`) };
          }
          return { path: fileURLToPath(resolve(browser && specifier === '@openpresentation/opf-render'
            ? '@openpresentation/opf-render/svg' : specifier)) };
        });
      },
    }),
  };
}
