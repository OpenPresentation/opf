// Run `tar` on an archive without absolute Windows paths in its arguments.
//
// GNU tar (the one first on PATH under Git for Windows) reads `C:\dir\x.tgz` after -f
// as host:path ("Cannot connect to C: resolve failed") and does not reliably accept
// backslash paths for -C either. Running in the archive's directory with its bare file
// name, and giving -C a path relative to that directory, works with GNU tar and bsdtar.
// A destination on another drive cannot be relative and uses forward slashes so Git for Windows tar can open it.
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {realpathSync} from 'node:fs';

export function tarInvocation(archive, flags, extra = [], paths = path) {
  const absolute = paths.resolve(archive), cwd = paths.dirname(absolute);
  const args = [flags, paths.basename(absolute)];
  for (let index = 0; index < extra.length; index++) {
    if (extra[index] === '-C' && index + 1 < extra.length) {
      const destination = paths.resolve(cwd, extra[++index]), relative = paths.relative(cwd, destination);
      args.push('-C', (paths.isAbsolute(relative) ? destination : relative || '.').split(paths.sep).join('/'));
    } else args.push(extra[index]);
  }
  return {args, cwd};
}

// Returns stdout (utf8); throws with stderr on failure. `flags` ends in `f`, e.g. '-tzf', '-xf'.
export function tar(archive, flags, extra = [], options = {}) {
  // Resolve cwd aliases (for example macOS /var -> /private/var) before computing relative destinations.
  const absolute = path.resolve(archive);
  const canonical = path.join(realpathSync(path.dirname(absolute)), path.basename(absolute));
  const {args, cwd} = tarInvocation(canonical, flags, extra);
  const result = spawnSync('tar', args, {encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, ...options, cwd});
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`tar ${args.join(' ')} exited ${result.status} in ${cwd}\n${result.stderr}`);
  return result.stdout;
}
