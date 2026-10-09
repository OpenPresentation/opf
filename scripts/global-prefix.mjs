// RR-66 (opf#466): the isolated global install the packed CLI tests make with `npm install --global --prefix <prefix>`, and the rule
// that keeps their `npm exec` runs from resolving into it.
//
// npm lays a global prefix out per platform: on Windows the packages go to <prefix>/node_modules and the bin shims (opf, opf.cmd,
// opf.ps1) to <prefix> itself; elsewhere to <prefix>/lib/node_modules and <prefix>/bin. `npm exec` takes the nearest folder at or
// above its working directory that holds a package.json or a node_modules as its project, and a registry spec that the project's
// node_modules already satisfies is not installed again: npm only puts <project>/node_modules/.bin on PATH. A Windows global
// prefix has no node_modules/.bin, so `npm exec --package @openpresentation/cli@<version> -- opf` run inside it failed with
// "'opf' is not recognized" (a tarball spec never matches an installed package, which is why only the registry run failed).
import path from 'node:path';

/** Where `npm install --global --prefix <prefix>` puts packages (`modules`) and bin shims (`bin`) on `platform`. */
export function globalPrefixLayout(prefix, platform = process.platform) {
  const paths = platform === 'win32' ? path.win32 : path.posix;
  return platform === 'win32'
    ? { prefix, modules: paths.join(prefix, 'node_modules'), bin: prefix }
    : { prefix, modules: paths.join(prefix, 'lib', 'node_modules'), bin: paths.join(prefix, 'bin') };
}

/**
 * Throw when `npm exec` run in `cwd` could take the global install's node_modules as its project's: when the node_modules of
 * `cwd` or of any folder above it is `layout.modules`.
 */
export function assertExecOutsideGlobal(cwd, layout, platform = process.platform) {
  const paths = platform === 'win32' ? path.win32 : path.posix;
  const same = (a, b) => (platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b);
  const modules = paths.resolve(layout.modules);
  for (let directory = paths.resolve(cwd); ; directory = paths.dirname(directory)) {
    if (same(paths.join(directory, 'node_modules'), modules)) {
      throw new Error(`npm exec in ${cwd} would resolve packages from the global install at ${layout.prefix} (opf#466): install the global prefix in a folder that is not ${directory} or above the npm exec folder.`);
    }
    if (paths.dirname(directory) === directory) return;
  }
}
