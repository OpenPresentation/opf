// Qualification evidence is append-only between attempts: use a fresh or empty directory, never erase an earlier result.
import { existsSync, lstatSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';

export function prepareOutputDirectory(directory) {
  const resolved = path.resolve(directory);
  if (existsSync(resolved)) {
    const stat = lstatSync(resolved);
    if (!stat.isDirectory() || stat.isSymbolicLink() || readdirSync(resolved).length) throw new Error(`Refusing output directory ${resolved}: choose a fresh or empty directory; earlier files are preserved.`);
  } else mkdirSync(resolved, { recursive: true });
  return resolved;
}
