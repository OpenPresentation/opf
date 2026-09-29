// Run `tar` on an archive without absolute Windows paths in its arguments.
//
// GNU tar (the one first on PATH under Git for Windows) reads `C:\dir\x.tgz` after -f
// as host:path ("Cannot connect to C: resolve failed") and does not reliably accept
// backslash paths for -C either. Running in the archive's directory with its bare file
// name, and giving -C a path relative to that directory, works with GNU tar and bsdtar.
// A destination on another drive cannot be relative and is passed through unchanged.
import {spawnSync} from 'node:child_process';
import path from 'node:path';

export function tarInvocation(archive, flags, extra = []) {
  const absolute = path.resolve(archive), cwd = path.dirname(absolute);
  const args = [flags, path.basename(absolute)];
  for (let index = 0; index < extra.length; index++) {
    if (extra[index] === '-C' && index + 1 < extra.length) {
      const destination = path.resolve(cwd, extra[++index]), relative = path.relative(cwd, destination);
      args.push('-C', path.isAbsolute(relative) ? destination : (relative || '.').split(path.sep).join('/'));
    } else args.push(extra[index]);
  }
  return {args, cwd};
}

// Returns stdout (utf8); throws with stderr on failure. `flags` ends in `f`, e.g. '-tzf', '-xf'.
export function tar(archive, flags, extra = [], options = {}) {
  const {args, cwd} = tarInvocation(archive, flags, extra);
  const result = spawnSync('tar', args, {encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, ...options, cwd});
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`tar ${args.join(' ')} exited ${result.status} in ${cwd}\n${result.stderr}`);
  return result.stdout;
}
