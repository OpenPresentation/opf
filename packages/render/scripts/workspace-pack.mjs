// MR-23b/23e: packing and installing the workspace packages from this package's scripts and tests. The workspace has no registry
// copy of the version under development, so a check that installs this package the way a consumer does packs it (and the
// workspace packages it depends on) with `pnpm pack`, through the shared ../../../scripts/workspace-pack.mjs, and installs the
// tarballs with npm, the client consumers use. Nothing reads a `workspace:` specifier from a source package.json.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSpec } from '../../../scripts/package-manager.mjs';
import { packWorkspacePackage } from '../../../scripts/workspace-pack.mjs';

export const packageRoot = fileURLToPath(new URL('../', import.meta.url));
export const repositoryRoot = path.resolve(packageRoot, '../..');
export { packedManifest } from '../../../scripts/workspace-pack.mjs';

/** Runs `npm` (on Windows through its JavaScript entrypoint, never a shell, and without pnpm's npm_config_* variables) and returns its stdout. */
export function npm(args, cwd) {
  const { command, args: argv, options } = spawnSpec(['npm', ...args]);
  return execFileSync(command, argv, { ...options, cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

/** Packs this package, core and the gallery (core's dependency): the set a consumer install needs before the release is published. Each is a packWorkspacePackage result. */
export function packWithDependencies(destination) {
  return {
    self: packWorkspacePackage('@openpresentation/opf-render', destination),
    core: packWorkspacePackage('@openpresentation/opf', destination),
    gallery: packWorkspacePackage('@openpresentation/gallery', destination),
  };
}
