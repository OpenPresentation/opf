// RR-62: an installation runs ONE core. The opf CLI imports core as a regular dependency and runs its `/node` engine, and the
// optional peers (@openpresentation/opf-render, @openpresentation/opf-pptx) depend on core too, so an application that imports
// core next to them shares one set of error classes, catalogs and functions. This checks an installation (a `node_modules`
// directory) three ways:
//   1. the tree holds exactly one copy of core (by real path);
//   2. the CLI, and each installed peer, resolves the very file the application resolves;
//   3. across the boundary: `/node` re-exports core's own functions and classes, and an error core throws is an
//      `instanceof OPFValidationError` of the core the application imported.
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

/**
 * RR-62: fail loudly when a tree resolves more than one core. `roots` are directories whose `node_modules` trees are scanned
 * (a sibling checkout, a consumer project); `resolvers` are files to resolve `@openpresentation/opf` from (a sibling's package
 * root or its built entry). Every copy found and every resolution must be `expected` (a core package directory). The message
 * names each path and its version.
 */
export async function assertSingleCore({ expected, roots = [], resolvers = [], label = 'tree' }) {
  const want = await realpath(expected);
  const version = async (directory) => JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8')).version;
  const problems = [];
  for (const root of roots) {
    for (const copy of await coreCopies(path.join(root, 'node_modules'))) {
      if (copy !== want) problems.push(`${root} holds another @openpresentation/opf at ${copy} (${await version(copy)})`);
    }
  }
  for (const from of resolvers) {
    let resolved;
    try {
      resolved = path.dirname(await realpath(createRequire(from).resolve('@openpresentation/opf/package.json')));
    } catch (error) {
      problems.push(`${from} resolves no @openpresentation/opf (${error.message})`);
      continue;
    }
    if (resolved !== want) problems.push(`${from} resolves @openpresentation/opf at ${resolved} (${await version(resolved)})`);
  }
  assert.deepEqual(problems, [], `${label}: one core expected at ${want} (${await version(want)}), found more:\n  ${problems.join('\n  ')}`);
}

/**
 * @param {string} nodeModules a node_modules directory with @openpresentation/cli and @openpresentation/opf installed
 * @param {{application?: boolean}} [options] application: false for a global install (`npm install --global`), where no
 *   application sits beside the CLI and core is the CLI's own dependency: the CLI must then resolve the one copy.
 */
export async function assertOneCore(nodeModules, { application: withApplication = true } = {}) {
  const copies = [...(await coreCopies(nodeModules))];
  assert.equal(copies.length, 1, `the installation holds ${copies.length} copies of @openpresentation/opf: ${copies.join(', ')}`);
  const application = createRequire(path.join(path.dirname(nodeModules), 'application.cjs'));
  const cliManifest = application.resolve('@openpresentation/cli/package.json');
  const fromCli = createRequire(cliManifest);
  if (withApplication) assert.equal(await realpath(fromCli.resolve('@openpresentation/opf/package.json')), await realpath(application.resolve('@openpresentation/opf/package.json')), 'the CLI and the application resolve different cores');
  else assert.equal(await realpath(fromCli.resolve('@openpresentation/opf/package.json')), path.join(copies[0], 'package.json'), 'the CLI resolves the one installed core');
  const coreRoot = path.dirname(await realpath(fromCli.resolve('@openpresentation/opf/package.json')));
  const coreManifest = JSON.parse(await readFile(path.join(coreRoot, 'package.json'), 'utf8'));
  const core = await import(pathToFileURL(path.join(coreRoot, coreManifest.exports['.'].import)).href);
  // Every installed peer resolves the same core.
  for (const peer of ['@openpresentation/opf-render', '@openpresentation/opf-pptx']) {
    let peerManifest;
    try {
      peerManifest = application.resolve(`${peer}/package.json`);
    } catch {
      continue;
    }
    assert.equal(await realpath(createRequire(peerManifest).resolve('@openpresentation/opf/package.json')), path.join(coreRoot, 'package.json'), `${peer} resolves another core`);
  }
  const nodeEntry = coreManifest.exports['./node']?.import;
  if (nodeEntry) {
    const node = await import(pathToFileURL(path.join(coreRoot, nodeEntry)).href);
    assert.equal(node.OPFValidationError, core.OPFValidationError);
    assert.equal(node.validate, core.validate);
    assert.equal(node.parse, core.parse);
    assert.throws(() => node.assertValid({ slides: 42 }, { only: ['format'] }), (error) => error instanceof core.OPFValidationError);
  }
  return { copy: copies[0], version: coreManifest.version };
}
