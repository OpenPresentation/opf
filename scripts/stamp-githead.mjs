#!/usr/bin/env node
// MR-10 (monorepo plan, section 5 and spike S4 finding F2): add `gitHead` to the package.json inside npm tarballs.
//
// npm records `gitHead` only for a package published from a directory. `pnpm pack` omits it, and publishing a tarball ships
// it unchanged, so the registry manifest would lose the field that `release.mjs verify` compares with the release commit.
// The build job runs this on the packed tarballs, before the smoke test and the publish.
//
//   node scripts/stamp-githead.mjs <commit-sha> <package.tgz>…
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { tar } from './archive-tar.mjs';

/** Rewrite `tarball` in place so package/package.json carries gitHead. Returns the package's name and version. */
export function stampGitHead(tarball, commit) {
  if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error(`gitHead must be a full 40-character commit SHA, not ${commit}`);
  const work = mkdtempSync(path.join(tmpdir(), 'opf-stamp-'));
  try {
    const env = { ...process.env, COPYFILE_DISABLE: '1' }; // keep macOS tar from adding AppleDouble entries
    tar(tarball, '-xzf', ['-C', work], { env });
    const manifestFile = path.join(work, 'package/package.json');
    const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
    writeFileSync(manifestFile, `${JSON.stringify({ ...manifest, gitHead: commit }, null, 2)}\n`);
    tar(tarball, '-czf', ['-C', work, 'package'], { env });
    return { name: manifest.name, version: manifest.version };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [commit, ...tarballs] = process.argv.slice(2);
  if (!commit || tarballs.length === 0) {
    console.error('usage: node scripts/stamp-githead.mjs <commit-sha> <package.tgz>...');
    process.exit(64);
  }
  for (const tarball of tarballs) {
    const { name, version } = stampGitHead(tarball, commit);
    console.log(`stamped ${name}@${version} (${path.basename(tarball)}) gitHead ${commit}`);
  }
}
