// RR-62: an installed `@openpresentation/cli` next to `@openpresentation/opf` runs ONE core. `@openpresentation/cli/api`
// imports core as a regular dependency (it does not bundle a copy), so an application that also imports core directly shares
// core's error classes, catalogs and functions with it. This checks an installation (a `node_modules` directory holding
// both packages) three ways:
//   1. the tree holds exactly one copy of core (by real path);
//   2. the CLI resolves the very file the application resolves;
//   3. across the boundary: the error `assertValid` throws through the API is an `instanceof OPFValidationError` of the core
//      the application imported, and the API's re-exports are core's own functions.
import assert from 'node:assert/strict';
import { readdir, readFile, realpath } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

async function coreCopies(directory, found = new Set(), depth = 0) {
  if (depth > 6) return found;
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
    const child = path.join(directory, entry.name);
    if (entry.name === 'node_modules') await coreCopies(child, found, depth + 1);
    else if (entry.name.startsWith('@')) {
      for (const scoped of await readdir(child).catch(() => [])) {
        const pkg = path.join(child, scoped);
        if (`${entry.name}/${scoped}` === '@openpresentation/opf') found.add(await realpath(pkg));
        await coreCopies(path.join(pkg, 'node_modules'), found, depth + 1);
      }
    } else await coreCopies(path.join(child, 'node_modules'), found, depth + 1);
  }
  return found;
}

/** @param {string} nodeModules a node_modules directory with @openpresentation/cli and @openpresentation/opf installed */
export async function assertOneCore(nodeModules) {
  const copies = [...(await coreCopies(nodeModules))];
  assert.equal(copies.length, 1, `the installation holds ${copies.length} copies of @openpresentation/opf: ${copies.join(', ')}`);
  const application = createRequire(path.join(path.dirname(nodeModules), 'application.cjs'));
  const cliManifest = application.resolve('@openpresentation/cli/package.json');
  const fromCli = createRequire(cliManifest);
  assert.equal(await realpath(fromCli.resolve('@openpresentation/opf/package.json')), await realpath(application.resolve('@openpresentation/opf/package.json')), 'the CLI and the application resolve different cores');
  const coreRoot = path.dirname(await realpath(fromCli.resolve('@openpresentation/opf/package.json')));
  const coreManifest = JSON.parse(await readFile(path.join(coreRoot, 'package.json'), 'utf8'));
  const core = await import(pathToFileURL(path.join(coreRoot, coreManifest.exports['.'].import)).href);
  const cliRoot = path.dirname(await realpath(cliManifest));
  const api = await import(pathToFileURL(path.join(cliRoot, 'dist/api.js')).href);
  assert.equal(api.OPFValidationError, core.OPFValidationError);
  assert.equal(api.validate, core.validate);
  assert.equal(api.readDeck, core.readDeck);
  assert.throws(() => api.assertValid({ slides: 42 }, { only: ['format'] }), (error) => error instanceof core.OPFValidationError);
  return { copy: copies[0], version: coreManifest.version };
}
