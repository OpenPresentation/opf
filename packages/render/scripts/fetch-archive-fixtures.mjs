#!/usr/bin/env node
// RR-15 (opf-render#24): the variable-font metric gate reads only the hashed Source Serif 4 fixtures and the retained 356-row native
// evidence from the archived checkpoint named in #24 (opf-render 343fb84, a commit that is not on main and so was not imported with the
// history in MR-22). The per-package CI checked it out beside the package; here it is fetched once into the repository's
// artifacts/render-archive/ (git ignored, and outside packages/ because the root check:text scans every file under
// packages/render) by a shallow, blobless, sparse fetch of the frozen OpenPresentation/opf-render repository. Nothing is built
// from it, and test/variable-font-retained-gate.mjs and test/platform-residual-probe.mjs verify the SHA-256 of every file they read.
//   node scripts/fetch-archive-fixtures.mjs        fetch when artifacts/render-archive is missing or at another commit
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ARCHIVE_REPOSITORY = 'https://github.com/OpenPresentation/opf-render.git';
export const ARCHIVE_REF = '343fb84223f4383ffe546157c6989ccc505c0acb';
export const ARCHIVE_PATHS = ['test/fixtures/font-formats/source-serif', 'docs/evidence/rejected-truetype-rounding-20260915'];
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const archiveDirectory = path.resolve(root, '../../artifacts/render-archive');

const git = (...args) => execFileSync('git', args, { cwd: archiveDirectory, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });

export function fetchArchive() {
  if (existsSync(path.join(archiveDirectory, '.git'))) {
    try {
      if (git('rev-parse', 'HEAD').trim() === ARCHIVE_REF && ARCHIVE_PATHS.every((entry) => existsSync(path.join(archiveDirectory, entry)))) return archiveDirectory;
    } catch { /* a broken checkout is fetched again */ }
    rmSync(archiveDirectory, { recursive: true, force: true });
  }
  mkdirSync(archiveDirectory, { recursive: true });
  git('init', '--quiet');
  git('remote', 'add', 'origin', ARCHIVE_REPOSITORY);
  git('sparse-checkout', 'set', '--cone', ...ARCHIVE_PATHS);
  git('fetch', '--quiet', '--depth', '1', '--filter=blob:none', 'origin', ARCHIVE_REF);
  git('checkout', '--quiet', '--detach', 'FETCH_HEAD');
  if (git('rev-parse', 'HEAD').trim() !== ARCHIVE_REF) throw new Error(`The archive checkout is not ${ARCHIVE_REF}`);
  return archiveDirectory;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(`Archived #24 fixtures and evidence: ${fetchArchive()}`);
