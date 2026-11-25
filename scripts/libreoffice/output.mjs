// Qualification evidence is append-only between attempts: use a fresh or empty directory, never erase an earlier result.
import { existsSync, lstatSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertValid } from '../native-acceptance/apps/impress/from-libreoffice.mjs';

export function prepareOutputDirectory(directory) {
  const resolved = path.resolve(directory);
  if (existsSync(resolved)) {
    const stat = lstatSync(resolved);
    if (!stat.isDirectory() || stat.isSymbolicLink() || readdirSync(resolved).length) throw new Error(`Refusing output directory ${resolved}: choose a fresh or empty directory; earlier files are preserved.`);
  } else mkdirSync(resolved, { recursive: true });
  return resolved;
}

/**
 * The shared native result format (scripts/native-acceptance/core/result/README.md) in `directory` (<out>/native): every
 * result.json and the run.json are validated first, and nothing is written unless all of them are valid; a validation error
 * throws. The pictures and resaved.pptx files are already in files/<id>/ (run.mjs writes them while it measures).
 */
export function writeNativeRun(directory, run, results) {
  for (const result of results) assertValid('result', result, `files/${result.file.id}/result.json`);
  assertValid('run', run, 'run.json');
  for (const result of results) {
    const folder = path.join(directory, 'files', result.file.id);
    mkdirSync(folder, { recursive: true });
    writeFileSync(path.join(folder, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
  }
  mkdirSync(directory, { recursive: true });
  writeFileSync(path.join(directory, 'run.json'), `${JSON.stringify(run, null, 2)}\n`);
}
