#!/usr/bin/env node
// Pure local Git gate for trusted publication. Run immediately after a full-depth checkout, before installing anything.
// node scripts/publish-source.mjs --manifest packages/javascript/package.json --tag-prefix opf-v --tag-prefix @openpresentation/opf@v
// Siblings use their own manifest and literal tag prefix. No fetch, API, package installation or publication occurs here.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function verifyPublishSource({ cwd = process.cwd(), manifest, tagPrefixes, ref = process.env.GITHUB_REF, sha = process.env.GITHUB_SHA }) {
  const fail = (message) => { throw new Error(`publish-source: ${message}`); };
  const git = (...args) => {
    try {
      return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    } catch (error) {
      const status = Number.isInteger(error.status) ? `exit ${error.status}` : `code ${error.code || 'unknown'}`;
      const stderr = String(error.stderr || '').replace(/\p{Cc}/gu, (character) => character === '\n' || character === '\t' ? character : '').trim();
      const detail = stderr.length > 2048 ? `${stderr.slice(0, 1024)} [truncated] ${stderr.slice(-1024)}` : stderr;
      fail(`Git identity check failed: git ${args.join(' ')} (${status})${detail ? `; stderr: ${detail}` : ''}`);
    }
  };
  if (typeof manifest !== 'string' || !manifest || path.isAbsolute(manifest) || manifest.split(/[\\/]/).includes('..')) fail('a repository-relative manifest is required');
  if (!Array.isArray(tagPrefixes) || !tagPrefixes.length || tagPrefixes.some((prefix) => typeof prefix !== 'string' || !prefix)) fail('at least one literal tag prefix is required');
  if (typeof ref !== 'string' || !ref.startsWith('refs/tags/')) fail('publication requires an explicit refs/tags/ release ref, including manual retries');
  if (typeof sha !== 'string' || !/^[a-f0-9]{40}$/.test(sha)) fail('GITHUB_SHA must be the exact release object or commit hash');
  git('check-ref-format', ref);
  if (git('rev-parse', '--is-shallow-repository') !== 'false') fail('a full-depth checkout is required');
  const head = git('rev-parse', '--verify', 'HEAD^{commit}');
  const tagObject = git('rev-parse', '--verify', ref);
  const tagCommit = git('rev-parse', '--verify', `${ref}^{commit}`);
  if (head !== tagCommit || (sha !== tagCommit && sha !== tagObject)) fail('checked-out HEAD, release tag and GITHUB_SHA must identify the same release');
  git('merge-base', '--is-ancestor', tagCommit, 'refs/remotes/origin/main');
  const manifestPath = manifest.split(path.sep).join('/');
  const committed = git('show', `${head}:${manifestPath}`);
  if (readFileSync(path.resolve(cwd, manifest), 'utf8').trim() !== committed) fail('the manifest differs from the checked-out release commit');
  const { version } = JSON.parse(committed);
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) fail('manifest has no supported release version');
  const tag = ref.slice('refs/tags/'.length);
  if (!tagPrefixes.some((prefix) => tag === `${prefix}${version}`)) fail(`tag ${tag} does not match manifest version ${version}`);
  return { ref, tag, version, commit: head, tagObject, main: git('rev-parse', '--verify', 'refs/remotes/origin/main^{commit}'), manifest: manifestPath };
}

function main(argv) {
  const options = { tagPrefixes: [] };
  for (let i = 0; i < argv.length; i += 2) {
    const [flag, value] = [argv[i], argv[i + 1]];
    if (!value || !['--manifest', '--tag-prefix'].includes(flag)) throw new Error('Usage: publish-source.mjs --manifest <package.json> --tag-prefix <prefix> [--tag-prefix <prefix>]');
    if (flag === '--manifest') {
      if (options.manifest) throw new Error('publish-source: --manifest may be provided only once');
      options.manifest = value;
    } else options.tagPrefixes.push(value);
  }
  console.log(JSON.stringify(verifyPublishSource(options)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
